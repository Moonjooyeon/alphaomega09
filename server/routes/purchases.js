const express = require("express");
const { recordAuditLog } = require("../services/audit");
const { requireUser } = require("../services/auth");
const { verifyPurchase } = require("../services/purchases");
const { jsonError } = require("../utils");

const router = express.Router();

router.post("/purchases/verify", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await verifyPurchase({ ...req.body, userId: user.id });
    await recordAuditLog(req, {
      userId: user.id,
      eventType: "purchase_verified",
      status: "ok",
      entityType: "purchase_order",
      entityId: result.order?.id,
      metadata: {
        provider: result.order?.provider,
        productId: result.order?.productId,
        amountKrw: result.order?.amountKrw,
        passId: result.pass?.id,
        allowedUses: result.pass?.allowedUses,
      },
    });
    res.json(result);
  } catch (error) {
    await recordAuditLog(req, {
      eventType: "purchase_verified",
      status: "failed",
      metadata: {
        provider: req.body?.provider,
        productId: req.body?.productId,
        reason: error.message || "결제 검증 실패",
        httpStatus: error.status || 500,
      },
    });
    res.status(error.status || 500).json(jsonError(error.message || "결제를 검증하지 못했습니다."));
  }
});

module.exports = router;
