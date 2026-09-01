const config = require("../config");

function isOpenAiCompatible(apiFormat, apiBase) {
  return apiFormat === "openai" || /llm-router\.cafe24\.com|chat\/completions|\/api\/v1/i.test(apiBase || "");
}

function geminiEndpointForModel(model, configuredApiBase = config.gemini.apiBase) {
  const apiBase = configuredApiBase.replace(/\/+$/, "");
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

function openAiCompatibleEndpoint(configuredApiBase = config.gemini.apiBase) {
  const apiBase = configuredApiBase.replace(/\/+$/, "");
  if (apiBase.endsWith("/chat/completions")) return apiBase;
  if (apiBase.endsWith("/api/v1")) return `${apiBase}/chat/completions`;
  return `${apiBase}/api/v1/chat/completions`;
}

function geminiHeaders(apiKey, configuredApiBase = config.gemini.apiBase, apiFormat = "gemini") {
  if (isOpenAiCompatible(apiFormat, configuredApiBase)) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  const headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
  if (configuredApiBase.includes("monorouter/v1")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function openAiMessagePart(part) {
  if (part?.text) return { type: "text", text: part.text };
  const inlineData = part?.inline_data || part?.inlineData;
  if (inlineData?.data) {
    const mimeType = inlineData.mime_type || inlineData.mimeType || "image/jpeg";
    return {
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${inlineData.data}`,
      },
    };
  }
  return null;
}

function openAiCompatibleMessages(contents = []) {
  return contents.map((item) => {
    const role = item.role === "model" ? "assistant" : item.role || "user";
    const parts = (item.parts || []).map(openAiMessagePart).filter(Boolean);
    return { role, content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts };
  });
}

function openAiCompatibleBody({ contents, generationConfig, model }) {
  return {
    model,
    messages: openAiCompatibleMessages(contents),
    max_tokens: generationConfig?.maxOutputTokens,
    temperature: generationConfig?.temperature,
    top_p: generationConfig?.topP,
    stream: false,
  };
}

function geminiBody({ contents, generationConfig, apiBase = config.gemini.apiBase, model = config.gemini.model }) {
  const body = {
    contents,
    generationConfig: { ...(generationConfig || {}) },
  };

  if (apiBase.includes("monorouter/v1")) {
    body.model = model;
    delete body.generationConfig.thinkingConfig;
    return body;
  }

  body.generationConfig.thinkingConfig = {
    thinkingBudget: config.gemini.thinkingBudget,
    ...(generationConfig?.thinkingConfig || {}),
  };
  return body;
}

function normalizeOpenAiCompatibleBody(body) {
  if (!Array.isArray(body?.choices)) return body;
  const text = body.choices
    .map((choice) => {
      const content = choice?.message?.content || "";
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((part) => part?.text || "").join("");
      }
      return "";
    })
    .join("");
  const usage = body.usage || {};

  return {
    ...body,
    candidates: [
      {
        content: {
          role: "model",
          parts: [{ text }],
        },
        finishReason: String(body.choices[0]?.finish_reason || "STOP").toUpperCase(),
      },
    ],
    usageMetadata: {
      promptTokenCount: Number(usage.prompt_tokens || 0),
      candidatesTokenCount: Number(usage.completion_tokens || 0),
      totalTokenCount: Number(usage.total_tokens || 0),
    },
  };
}

async function callGemini({
  apiKey,
  contents,
  generationConfig,
  apiBase = config.gemini.apiBase,
  model = config.gemini.model,
  apiFormat = "gemini",
}) {
  const openAiCompatible = isOpenAiCompatible(apiFormat, apiBase);
  const response = await fetch(
    openAiCompatible ? openAiCompatibleEndpoint(apiBase) : geminiEndpointForModel(model, apiBase),
    {
      method: "POST",
      headers: geminiHeaders(apiKey, apiBase, apiFormat),
      body: JSON.stringify(
        openAiCompatible
          ? openAiCompatibleBody({ contents, generationConfig, model })
          : geminiBody({ contents, generationConfig, apiBase, model })
      ),
    }
  );

  let body;
  try {
    body = await response.json();
  } catch {
    body = { error: { message: `Gemini 응답을 JSON으로 읽지 못했습니다. HTTP ${response.status}` } };
  }

  return { response, body: response.ok && openAiCompatible ? normalizeOpenAiCompatibleBody(body) : body };
}

module.exports = { callGemini, geminiEndpointForModel, openAiCompatibleEndpoint };
