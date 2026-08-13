const express = require("express");
const config = require("../config");
const { query } = require("../db");
const { callGemini } = require("../services/gemini");
const { estimateCost, getTokenUsage, readSharedUsage } = require("../services/usage");
const { hashText, id, jsonError } = require("../utils");

const router = express.Router();

async function createSession({ keyMode, reportMode }) {
  const sessionId = id("session");
  await query(
    "INSERT INTO usage_sessions (id, key_mode, report_mode, status) VALUES ($1, $2, $3, 'started')",
    [sessionId, keyMode, reportMode || "unknown"]
  );
  return sessionId;
}

async function recordGeminiRequest({ req, sessionId, keyMode, response, body, tokens, cost }) {
  const error = body?.error || {};
  await query(
    `
      INSERT INTO gemini_requests (
        id, session_id, key_mode, requested_model, actual_model, phase, ok, status,
        input_tokens, output_tokens, cost_usd, cost_krw, error_code, error_message,
        ip_hash, user_agent_hash, completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now())
    `,
    [
      id("gemini"),
      sessionId,
      keyMode,
      config.gemini.model,
      config.gemini.model,
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

router.post("/gemini", async (req, res) => {
  const { contents, generationConfig = {}, userApiKey = "", reportMode = "unknown" } = req.body || {};
  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json(jsonError("contents가 비어 있습니다."));
    return;
  }

  const keyMode = userApiKey ? "personal" : "shared";
  if (keyMode === "shared") {
    const usage = await readSharedUsage();
    if (usage.costKrw >= config.gemini.costLimitKrw) {
      res.status(429).json(
        jsonError(`누적 사용 한도 ${config.gemini.costLimitKrw.toLocaleString("ko-KR")}원을 초과하여 검사를 닫았습니다.`, {
          usage,
        })
      );
      return;
    }
  }

  const apiKey = userApiKey || config.gemini.apiKey;
  if (!apiKey) {
    res.status(500).json(jsonError("서버에 GEMINI_API_KEY가 설정되지 않았습니다."));
    return;
  }

  const sessionId = await createSession({ keyMode, reportMode });
  let response;
  let body;
  try {
    ({ response, body } = await callGemini({ apiKey, contents, generationConfig }));
  } catch (error) {
    await query("UPDATE usage_sessions SET status = 'failed', completed_at = now() WHERE id = $1", [sessionId]);
    res.status(502).json(jsonError(error?.message || "Gemini 요청에 실패했습니다."));
    return;
  }

  const tokens = getTokenUsage(body);
  const cost = keyMode === "shared" ? estimateCost(tokens) : { costUsd: 0, costKrw: 0 };

  try {
    await recordGeminiRequest({ req, sessionId, keyMode, response, body, tokens, cost });
  } catch (error) {
    res.status(500).json(jsonError(error?.message || "사용량을 저장하지 못했습니다."));
    return;
  }

  body.usageLimit =
    keyMode === "shared"
      ? {
          request: { ...tokens, ...cost },
          limitKrw: config.gemini.costLimitKrw,
        }
      : { personalKey: true };
  body.sessionId = sessionId;

  res.status(response.status).json(body);
});

module.exports = router;
