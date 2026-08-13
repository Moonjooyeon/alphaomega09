const express = require("express");
const config = require("../config");
const { pool, query } = require("../db");

const router = express.Router();

router.get("/health", async (_req, res) => {
  const body = {
    ok: true,
    service: "alphaomega",
    databaseConfigured: Boolean(pool),
    geminiConfigured: Boolean(config.gemini.apiKey),
    model: config.gemini.model,
  };

  if (!pool) {
    res.status(503).json({ ...body, ok: false, database: "missing DATABASE_URL" });
    return;
  }

  try {
    await query("SELECT 1");
    res.json({ ...body, database: "ok" });
  } catch (error) {
    res.status(503).json({ ...body, ok: false, database: error?.message || "unavailable" });
  }
});

module.exports = router;
