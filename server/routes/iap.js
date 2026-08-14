const express = require("express");
const config = require("../config");
const { requireUser } = require("../services/auth");
const { grantIapPass } = require("../services/purchases");
const { jsonError } = require("../utils");

const router = express.Router();

router.post("/iap/grant-pass", async (req, res) => {
  try {
    const user = await requireUser(req);
    const result = await grantIapPass({ ...req.body, userId: user.id });
    res.json({ status: "captured", credits: config.billing.passUsesPerPurchase, ...result });
  } catch (error) {
    res.status(error.status || 500).json(jsonError(error.message || "인앱 이용권을 발급하지 못했습니다."));
  }
});

module.exports = router;
