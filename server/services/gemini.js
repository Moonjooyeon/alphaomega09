const config = require("../config");

function geminiEndpointForModel(model) {
  const apiBase = config.gemini.apiBase.replace(/\/+$/, "");
  if (apiBase.includes("monorouter/v1")) {
    return `${apiBase}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  }
  if (apiBase.includes("{model}")) {
    return apiBase.replace("{model}", encodeURIComponent(model));
  }
  if (apiBase.endsWith(":generateContent")) {
    return apiBase;
  }
  return `${apiBase}/models/${encodeURIComponent(model)}:generateContent`;
}

function geminiHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
  if (config.gemini.apiBase.includes("monorouter/v1")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function geminiBody({ contents, generationConfig }) {
  const body = {
    contents,
    generationConfig: { ...(generationConfig || {}) },
  };

  if (config.gemini.apiBase.includes("monorouter/v1")) {
    body.model = config.gemini.model;
    delete body.generationConfig.thinkingConfig;
    return body;
  }

  body.generationConfig.thinkingConfig = {
    thinkingBudget: config.gemini.thinkingBudget,
    ...(generationConfig?.thinkingConfig || {}),
  };
  return body;
}

async function callGemini({ apiKey, contents, generationConfig }) {
  const response = await fetch(
    geminiEndpointForModel(config.gemini.model),
    {
      method: "POST",
      headers: geminiHeaders(apiKey),
      body: JSON.stringify(geminiBody({ contents, generationConfig })),
    }
  );

  let body;
  try {
    body = await response.json();
  } catch {
    body = { error: { message: `Gemini 응답을 JSON으로 읽지 못했습니다. HTTP ${response.status}` } };
  }

  return { response, body };
}

module.exports = { callGemini, geminiEndpointForModel };
