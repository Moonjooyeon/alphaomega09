const express = require("express");
const config = require("../config");
const { recordAuditLog } = require("../services/audit");
const { requireUser } = require("../services/auth");
const { grantIapPass } = require("../services/purchases");
const { jsonError } = require("../utils");

const router = express.Router();

router.post("/iap/grant-pass", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await grantIapPass({ ...req.body, userId: user.id });
    await recordAuditLog(req, {
      userId: user.id,
      eventType: "iap_pass_granted",
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
    res.json({ status: "captured", credits: config.billing.passUsesPerPurchase, ...result });
  } catch (error) {
    await recordAuditLog(req, {
      eventType: "iap_pass_granted",
      status: "failed",
      metadata: {
        reason: error.message || "인앱 이용권 발급 실패",
        httpStatus: error.status || 500,
        productId: req.body?.sku,
      },
    });
    res.status(error.status || 500).json(jsonError(error.message || "인앱 이용권을 발급하지 못했습니다."));
  }
});

module.exports = router;
