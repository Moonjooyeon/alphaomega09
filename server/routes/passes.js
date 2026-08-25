const express = require("express");
const { recordAuditLog } = require("../services/audit");
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
    await recordAuditLog(req, {
      userId: user.id,
      eventType: "pass_consumed",
      status: "ok",
      entityType: "access_pass_charge",
      entityId: result.charge?.id,
      metadata: {
        sessionId,
        chargeKeySuffix: String(chargeKey).slice(-8),
        idempotent: Boolean(result.idempotent),
        passId: result.pass?.id || result.charge?.access_pass_id,
        remainingUses: result.pass?.remainingUses,
      },
    });
    res.json(result);
  } catch (error) {
    let userId = null;
    try {
      const user = await requireUser(req);
      userId = user.id;
    } catch {}
    await recordAuditLog(req, {
      userId,
      eventType: "pass_consumed",
      status: "failed",
      metadata: {
        sessionId,
        chargeKeySuffix: String(chargeKey).slice(-8),
        reason: error.message || "이용권 차감 실패",
        httpStatus: error.status || 500,
      },
    });
    res.status(error.status || 500).json(jsonError(error.message || "이용권을 차감하지 못했습니다."));
  }
});

module.exports = router;
