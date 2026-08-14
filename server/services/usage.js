const config = require("../config");
const { query } = require("../db");

function getTokenUsage(body) {
  const metadata = body?.usageMetadata || {};
  const inputTokens = Number(metadata.promptTokenCount || 0);
  const outputTokens = Number(metadata.candidatesTokenCount || 0) + Number(metadata.thoughtsTokenCount || 0);
  return { inputTokens, outputTokens };
}

function estimateCost({ inputTokens, outputTokens }) {
  const inputUsd = (inputTokens / 1_000_000) * config.gemini.inputUsdPerMillion;
  const outputUsd = (outputTokens / 1_000_000) * config.gemini.outputUsdPerMillion;
  const costUsd = inputUsd + outputUsd;
  return { costUsd, costKrw: costUsd * config.gemini.usdToKrw };
}

async function readSharedUsage() {
  const { rows } = await query(`
    SELECT
      count(*)::int AS requests,
      coalesce(sum(input_tokens), 0)::int AS input_tokens,
      coalesce(sum(output_tokens), 0)::int AS output_tokens,
      coalesce(sum(cost_usd), 0)::float8 AS cost_usd,
      coalesce(sum(cost_krw), 0)::float8 AS cost_krw
    FROM gemini_requests
    WHERE key_mode = 'shared'
  `);

  const row = rows[0] || {};
  const usage = {
    requests: Number(row.requests || 0),
    inputTokens: Number(row.input_tokens || 0),
    outputTokens: Number(row.output_tokens || 0),
    costUsd: Number(row.cost_usd || 0),
    costKrw: Number(row.cost_krw || 0),
  };
  return usage;
}

module.exports = { estimateCost, getTokenUsage, readSharedUsage };
