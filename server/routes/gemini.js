const express = require("express");
const config = require("../config");
const { query } = require("../db");
const { recordAuditLog } = require("../services/audit");
const { optionalUser } = require("../services/auth");
const { callGemini } = require("../services/gemini");
const { estimateCost, getTokenUsage } = require("../services/usage");
const { hashText, id, jsonError } = require("../utils");

const router = express.Router();

async function createSession({ userId, keyMode, reportMode }) {
  const sessionId = id("session");
  await query(
    "INSERT INTO usage_sessions (id, user_id, key_mode, report_mode, status) VALUES ($1, $2, $3, $4, 'started')",
    [sessionId, userId || null, keyMode, reportMode || "unknown"]
  );
  return sessionId;
}

async function recordGeminiRequest({ req, userId, sessionId, keyMode, response, body, tokens, cost, model }) {
  const error = body?.error || {};
  await query(
    `
      INSERT INTO gemini_requests (
        id, session_id, user_id, key_mode, requested_model, actual_model, phase, ok, status,
        input_tokens, output_tokens, cost_usd, cost_krw, error_code, error_message,
        ip_hash, user_agent_hash, completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())
    `,
    [
      id("gemini"),
      sessionId,
      userId || null,
      keyMode,
      model || config.gemini.model,
      model || config.gemini.model,
      req.body?.phase || "generate",
      Boolean(response.ok),
      response.status,
      Math.round(tokens.inputTokens),
      Math.round(tokens.outputTokens),
      cost.costUsd,
      cost.costKrw,
      error.code || error.status || null,
      error.message || null,
      hashText(req.ip),
      hashText(req.get("user-agent")),
    ]
  );

  await query(
    `
      UPDATE usage_sessions
      SET
        gemini_request_count = gemini_request_count + 1,
        successful_request_count = successful_request_count + $2,
        status = $3,
        completed_at = now()
      WHERE id = $1
    `,
    [sessionId, response.ok ? 1 : 0, response.ok ? "completed" : "failed"]
  );
}

function shouldRetryWithNextSharedKey(response, body) {
  if (!response || response.ok || ![402, 429, 503].includes(response.status)) return false;
  const text = JSON.stringify(body || {});
  return /quota|credit|insufficient|minimum|prepayment|depleted|resource_exhausted|rate.?limit|too many/i.test(text);
}

async function callGeminiWithSharedKeyFallback({ contents, generationConfig }) {
  const entries = config.gemini.apiKeyEntries;
  let lastResult = null;
  let usedEntry = null;
  const attempts = [];

  for (const [index, entry] of entries.entries()) {
    const result = await callGemini({
      apiKey: entry.apiKey,
      contents,
      generationConfig,
      apiBase: entry.apiBase,
      model: entry.model,
      apiFormat: entry.apiFormat,
    });
    lastResult = result;
    usedEntry = entry;
    attempts.push({
      keyIndex: index + 1,
      provider: entry.provider,
      keyHash: hashText(entry.apiKey),
      status: result.response.status,
      ok: result.response.ok,
      errorCode: result.body?.error?.code || result.body?.error?.status || null,
      retryable: shouldRetryWithNextSharedKey(result.response, result.body),
    });

    if (result.response.ok || !shouldRetryWithNextSharedKey(result.response, result.body)) {
      return { ...result, attempts, usedEntry };
    }
  }

  return { ...lastResult, attempts, usedEntry };
}

router.post("/gemini", async (req, res) => {
  const { contents, generationConfig = {}, userApiKey = "", reportMode = "unknown" } = req.body || {};
  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json(jsonError("contents가 비어 있습니다."));
    return;
  }

  let currentUser = null;
  try {
    currentUser = await optionalUser(req);
  } catch (error) {
    res.status(error.status || 401).json(jsonError(error.message || "로그인이 만료되었습니다."));
    return;
  }

  const keyMode = userApiKey ? "personal" : "shared";
  const apiKeyCount = userApiKey ? 1 : config.gemini.apiKeyEntries.length;
  if (apiKeyCount === 0) {
    await recordAuditLog(req, {
      userId: currentUser?.id,
      eventType: "gemini_request",
      status: "failed",
      metadata: {
        reason: "missing_api_key",
        keyMode,
        reportMode,
        requestedModel: config.gemini.model,
      },
    });
    res.status(500).json(jsonError("서버에 GEMINI_API_KEY가 설정되지 않았습니다."));
    return;
  }

  const sessionId = await createSession({ userId: currentUser?.id, keyMode, reportMode });
  let response;
  let body;
  let keyAttempts = [];
  let usedModel = config.gemini.model;
  try {
    if (keyMode === "shared") {
      const result = await callGeminiWithSharedKeyFallback({ contents, generationConfig });
      ({ response, body, attempts: keyAttempts } = result);
      usedModel = result.usedEntry?.model || config.gemini.model;
    } else {
      ({ response, body } = await callGemini({ apiKey: userApiKey, contents, generationConfig }));
    }
  } catch (error) {
    await query("UPDATE usage_sessions SET status = 'failed', completed_at = now() WHERE id = $1", [sessionId]);
    await recordAuditLog(req, {
      userId: currentUser?.id,
      eventType: "gemini_request",
      status: "failed",
      entityType: "usage_session",
      entityId: sessionId,
      metadata: {
        reason: error?.message || "Gemini 요청 실패",
        keyMode,
        reportMode,
        requestedModel: config.gemini.model,
      },
    });
    res.status(502).json(jsonError(error?.message || "Gemini 요청에 실패했습니다."));
    return;
  }

  const tokens = getTokenUsage(body);
  const cost = keyMode === "shared" ? estimateCost(tokens) : { costUsd: 0, costKrw: 0 };

  try {
    await recordGeminiRequest({ req, userId: currentUser?.id, sessionId, keyMode, response, body, tokens, cost, model: usedModel });
  } catch (error) {
    await recordAuditLog(req, {
      userId: currentUser?.id,
      eventType: "gemini_usage_recorded",
      status: "failed",
      entityType: "usage_session",
      entityId: sessionId,
      metadata: {
        reason: error?.message || "사용량 저장 실패",
        keyMode,
        reportMode,
        requestedModel: config.gemini.model,
      },
    });
    res.status(500).json(jsonError(error?.message || "사용량을 저장하지 못했습니다."));
    return;
  }

  await recordAuditLog(req, {
    userId: currentUser?.id,
    eventType: "gemini_request",
    status: response.ok ? "ok" : "failed",
    entityType: "usage_session",
    entityId: sessionId,
    metadata: {
      keyMode,
      reportMode,
      requestedModel: usedModel,
      httpStatus: response.status,
      inputTokens: Math.round(tokens.inputTokens),
      outputTokens: Math.round(tokens.outputTokens),
      costKrw: cost.costKrw,
      phase: req.body?.phase || "generate",
      sharedKeyAttempts: keyAttempts,
    },
  });

  body.usageLimit =
    keyMode === "shared"
      ? {
          request: { ...tokens, ...cost },
          limitDisabled: true,
        }
      : { personalKey: true };
  body.sessionId = sessionId;

  res.status(response.status).json(body);
});

module.exports = router;
