const DEFAULT_GEMINI_API_BASE = "https://monogpt.kr/api/monorouter/v1/gemini";
const requestedModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function normalizeGeminiModel(model) {
  return ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"].includes(model)
    ? "gemini-3.5-flash-lite"
    : model;
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function listFromEnv(name) {
  return String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function defaultGeminiApiFormat(provider, apiBase) {
  const value = `${provider || ""} ${apiBase || ""}`;
  return /cafe24|chat\/completions|\/api\/v1/i.test(value) ? "openai" : "gemini";
}

function defaultGeminiModelForProvider(provider, model) {
  return /cafe24/i.test(provider || "") ? "google/gemini-2.5-flash" : model;
}

function geminiApiKeyEntries() {
  const keys = listFromEnv("GEMINI_API_KEYS");
  const providers = listFromEnv("GEMINI_API_KEY_PROVIDERS");
  const bases = listFromEnv("GEMINI_API_BASES");
  const models = listFromEnv("GEMINI_API_KEY_MODELS");
  const formats = listFromEnv("GEMINI_API_KEY_FORMATS");
  const fallbackBase = process.env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE;
  const fallbackModel = normalizeGeminiModel(requestedModel);
  const entries = keys.map((apiKey, index) => {
    const provider = providers[index] || `shared-${index + 1}`;
    const apiBase = bases[index] || fallbackBase;
    return {
      apiKey,
      provider,
      apiBase,
      apiFormat: formats[index] || defaultGeminiApiFormat(provider, apiBase),
      model: normalizeGeminiModel(models[index] || defaultGeminiModelForProvider(provider, fallbackModel)),
    };
  });

  const legacyApiKey = process.env.GEMINI_API_KEY || "";
  if (legacyApiKey && !entries.some((entry) => entry.apiKey === legacyApiKey)) {
    const provider = process.env.GEMINI_API_KEY_PROVIDER || "legacy";
    entries.push({
      apiKey: legacyApiKey,
      provider,
      apiBase: fallbackBase,
      apiFormat: process.env.GEMINI_API_KEY_FORMAT || defaultGeminiApiFormat(provider, fallbackBase),
      model: fallbackModel,
    });
  }

  return entries;
}

module.exports = {
  port: numberFromEnv("PORT", 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "local-dev-session-secret",
  gemini: {
    model: normalizeGeminiModel(requestedModel),
    apiBase: process.env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE,
    apiKey: process.env.GEMINI_API_KEY || "",
    apiKeyEntries: geminiApiKeyEntries(),
    thinkingBudget: numberFromEnv("GEMINI_THINKING_BUDGET", 2048),
    usdToKrw: numberFromEnv("USD_TO_KRW", 1400),
    inputUsdPerMillion: numberFromEnv("GEMINI_INPUT_USD_PER_MILLION", 0.3),
    outputUsdPerMillion: numberFromEnv("GEMINI_OUTPUT_USD_PER_MILLION", 2.5),
  },
  billing: {
    paymentProvider: process.env.PAYMENT_PROVIDER || "app_store",
    passPriceKrw: numberFromEnv("PASS_PRICE_KRW", 627),
    passUsesPerPurchase: numberFromEnv("PASS_USES_PER_PURCHASE", 11),
    purchaseMock: String(process.env.PURCHASE_MOCK || "").toLowerCase() === "true",
  },
  appStore: {
    environment: process.env.APPLE_ENV || "sandbox",
    bundleId: process.env.APPLE_BUNDLE_ID || "",
    issuerId: process.env.APPLE_ISSUER_ID || "",
    keyId: process.env.APPLE_KEY_ID || "",
    privateKey: process.env.APPLE_PRIVATE_KEY || "",
    privateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH || "",
    productIds: listFromEnv("APPLE_PRODUCT_IDS"),
  },
  playStore: {
    packageName: process.env.GOOGLE_PACKAGE_NAME || "",
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "",
    serviceAccountJsonPath: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || "",
    productIds: listFromEnv("GOOGLE_PRODUCT_IDS"),
  },
  toss: {
    apiBase: (process.env.TOSS_API_BASE || "https://apps-in-toss-api.toss.im").replace(/\/+$/, ""),
    mtlsCertPath: process.env.TOSS_MTLS_CERT_PATH || "",
    mtlsKeyPath: process.env.TOSS_MTLS_KEY_PATH || "",
    mtlsKeyPassword: process.env.TOSS_MTLS_KEY_PASSWORD || "",
    loginMock: String(process.env.TOSS_LOGIN_MOCK || "").toLowerCase() === "true",
  },
  audit: {
    logToken: process.env.AUDIT_LOG_TOKEN || "",
  },
  serveStatic: String(process.env.SERVE_STATIC || "true").toLowerCase() !== "false",
  maxRequestBytes: numberFromEnv("MAX_REQUEST_BYTES", 4_500_000),
};
