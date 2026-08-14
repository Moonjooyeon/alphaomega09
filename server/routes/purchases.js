const express = require("express");
const { requireUser } = require("../services/auth");
const { verifyPurchase } = require("../services/purchases");
const { jsonError } = require("../utils");

const router = express.Router();

router.post("/purchases/verify", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await verifyPurchase({ ...req.body, userId: user.id });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(jsonError(error.message || "결제를 검증하지 못했습니다."));
  }
});

module.exports = router;
