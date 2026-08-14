const express = require("express");
const { requireUser } = require("../services/auth");
const { consumePass, listPassesForUser } = require("../services/passes");
const { jsonError } = require("../utils");

const router = express.Router();

router.get("/passes", async (req, res) => {
  try {
    const user = await requireUser(req);
    res.json(await listPassesForUser(user.id));
  } catch (error) {
    res.status(error.status || 500).json(jsonError(error.message || "이용권을 조회하지 못했습니다."));
  }
});

router.post("/passes/consume", async (req, res) => {
  const { sessionId = "", chargeKey = "" } = req.body || {};
  try {
    const user = await requireUser(req);
    const result = await consumePass({ userId: user.id, sessionId, chargeKey });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(jsonError(error.message || "이용권을 차감하지 못했습니다."));
  }
});

module.exports = router;
