const requestedModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

module.exports = {
  port: numberFromEnv("PORT", 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  gemini: {
    model: requestedModel === "gemini-2.5-flash-lite" ? "gemini-3.1-flash-lite" : requestedModel,
    apiBase: process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta",
    apiKey: process.env.GEMINI_API_KEY || "",
    thinkingBudget: numberFromEnv("GEMINI_THINKING_BUDGET", 2048),
    costLimitKrw: numberFromEnv("GEMINI_COST_LIMIT_KRW", 10000),
    usdToKrw: numberFromEnv("USD_TO_KRW", 1400),
    inputUsdPerMillion: numberFromEnv("GEMINI_INPUT_USD_PER_MILLION", 0.25),
    outputUsdPerMillion: numberFromEnv("GEMINI_OUTPUT_USD_PER_MILLION", 1.5),
  },
  billing: {
    paymentProvider: process.env.PAYMENT_PROVIDER || "app_store",
    passUsesPerPurchase: numberFromEnv("PASS_USES_PER_PURCHASE", 5),
  },
  maxRequestBytes: numberFromEnv("MAX_REQUEST_BYTES", 4_500_000),
};
