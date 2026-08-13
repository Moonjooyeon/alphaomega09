const config = require("../config");

async function callGemini({ apiKey, contents, generationConfig }) {
  const apiBase = config.gemini.apiBase.replace(/\/+$/, "");
  const response = await fetch(
    `${apiBase}/models/${config.gemini.model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          ...(generationConfig || {}),
          thinkingConfig: {
            thinkingBudget: config.gemini.thinkingBudget,
            ...(generationConfig?.thinkingConfig || {}),
          },
        },
      }),
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

module.exports = { callGemini };
