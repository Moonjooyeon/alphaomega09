const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const GEMINI_THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET || 2048);
const COST_LIMIT_KRW = Number(process.env.GEMINI_COST_LIMIT_KRW || 10000);
const USD_TO_KRW = Number(process.env.USD_TO_KRW || 1400);
const INPUT_USD_PER_MILLION = Number(process.env.GEMINI_INPUT_USD_PER_MILLION || 0.1);
const OUTPUT_USD_PER_MILLION = Number(process.env.GEMINI_OUTPUT_USD_PER_MILLION || 0.4);
const USAGE_STORE = "gemini-usage";
const MAX_REQUEST_BYTES = Number(process.env.MAX_REQUEST_BYTES || 4_500_000);

async function getUsageStore(event) {
  if (process.env.NETLIFY_LOCAL === "true") {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = path.join(process.cwd(), ".netlify", "local-blobs", USAGE_STORE);

    return {
      async list({ prefix = "" } = {}) {
        try {
          const names = await fs.readdir(path.join(root, "requests"));
          return {
            blobs: names
              .filter((name) => name.endsWith(".json"))
              .map((name) => ({ key: `requests/${name}` }))
              .filter(({ key }) => key.startsWith(prefix)),
          };
        } catch {
          return { blobs: [] };
        }
      },
      async get(key, { type } = {}) {
        try {
          const text = await fs.readFile(path.join(root, key), "utf8");
          return type === "json" ? JSON.parse(text) : text;
        } catch {
          return null;
        }
      },
      async setJSON(key, value) {
        const file = path.join(root, key);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, JSON.stringify(value, null, 2));
      },
    };
  }

  const { connectLambda, getStore } = await import("@netlify/blobs");
  connectLambda(event);
  return getStore({ name: USAGE_STORE });
}

async function readUsage(store) {
  const usage = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, costKrw: 0 };
  const listed = await store.list({ prefix: "requests/" });

  await Promise.all(
    listed.blobs.map(async ({ key }) => {
      const entry = await store.get(key, { type: "json" });
      if (!entry) return;
      usage.requests += 1;
      usage.inputTokens += Number(entry.inputTokens || 0);
      usage.outputTokens += Number(entry.outputTokens || 0);
      usage.costUsd += Number(entry.costUsd || 0);
      usage.costKrw += Number(entry.costKrw || 0);
    })
  );

  usage.remainingKrw = Math.max(0, COST_LIMIT_KRW - usage.costKrw);
  return usage;
}

function getTokenUsage(body) {
  const metadata = body?.usageMetadata || {};
  const inputTokens = Number(metadata.promptTokenCount || 0);
  const outputTokens = Number(metadata.candidatesTokenCount || 0) + Number(metadata.thoughtsTokenCount || 0);
  return { inputTokens, outputTokens };
}

function estimateCost({ inputTokens, outputTokens }) {
  const inputUsd = (inputTokens / 1_000_000) * INPUT_USD_PER_MILLION;
  const outputUsd = (outputTokens / 1_000_000) * OUTPUT_USD_PER_MILLION;
  const costUsd = inputUsd + outputUsd;
  return { costUsd, costKrw: costUsd * USD_TO_KRW };
}

async function recordUsage(store, entry) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await store.setJSON(`requests/${Date.now()}-${id}.json`, {
    ...entry,
    createdAt: new Date().toISOString(),
    model: GEMINI_MODEL,
    usdToKrw: USD_TO_KRW,
  });
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify(body),
  };
}

function getRequestBodyText(event) {
  if (!event.body) return "{}";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: { message: "POST 요청만 허용됩니다." } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, { error: { message: "서버에 GEMINI_API_KEY가 설정되지 않았습니다." } });
  }

  let usageStore;
  let usage;
  try {
    usageStore = await getUsageStore(event);
    usage = await readUsage(usageStore);
  } catch (error) {
    return json(500, { error: { message: error?.message || "사용량 저장소를 읽지 못했습니다." } });
  }

  if (usage.costKrw >= COST_LIMIT_KRW) {
    return json(429, {
      error: {
        message: `누적 사용 한도 ${COST_LIMIT_KRW.toLocaleString("ko-KR")}원을 초과하여 검사를 닫았습니다.`,
        usage,
      },
    });
  }

  const requestText = getRequestBodyText(event);
  if (Buffer.byteLength(requestText, "utf8") > MAX_REQUEST_BYTES) {
    return json(413, { error: { message: "요청 이미지가 너무 큽니다. 더 작은 이미지로 다시 접수해 주십시오." } });
  }

  let requestBody;
  try {
    requestBody = JSON.parse(requestText);
  } catch {
    return json(400, { error: { message: "요청 본문이 올바른 JSON이 아닙니다." } });
  }

  const { contents, generationConfig = {} } = requestBody;
  if (!Array.isArray(contents) || contents.length === 0) {
    return json(400, { error: { message: "contents가 비어 있습니다." } });
  }

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            ...generationConfig,
            thinkingConfig: {
              thinkingBudget: GEMINI_THINKING_BUDGET,
              ...(generationConfig.thinkingConfig || {}),
            },
          },
        }),
      }
    );
  } catch (error) {
    return json(502, { error: { message: error?.message || "Gemini 요청에 실패했습니다." } });
  }

  let body;
  try {
    body = await geminiRes.json();
  } catch {
    return json(geminiRes.status, {
      error: { message: `Gemini 응답을 JSON으로 읽지 못했습니다. HTTP ${geminiRes.status}` },
    });
  }

  const tokens = getTokenUsage(body);
  const cost = estimateCost(tokens);

  try {
    await recordUsage(usageStore, {
      ...tokens,
      ...cost,
      ok: geminiRes.ok,
      status: geminiRes.status,
    });
  } catch (error) {
    return json(500, { error: { message: error?.message || "사용량을 저장하지 못했습니다." } });
  }

  body.usageLimit = {
    before: usage,
    request: { ...tokens, ...cost },
    limitKrw: COST_LIMIT_KRW,
    estimatedTotalKrw: usage.costKrw + cost.costKrw,
    estimatedRemainingKrw: Math.max(0, COST_LIMIT_KRW - usage.costKrw - cost.costKrw),
  };

  return json(geminiRes.status, body);
};
