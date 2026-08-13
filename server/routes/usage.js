const express = require("express");
const config = require("../config");
const { readSharedUsage } = require("../services/usage");
const { jsonError } = require("../utils");

const router = express.Router();

router.get("/usage", async (_req, res) => {
  try {
    res.json({ usage: await readSharedUsage(), limitKrw: config.gemini.costLimitKrw });
  } catch (error) {
    res.status(500).json(jsonError(error?.message || "사용량을 읽지 못했습니다."));
  }
});

module.exports = router;
