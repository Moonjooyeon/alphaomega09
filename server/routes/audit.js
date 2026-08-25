const express = require("express");
const { listAuditLogs, requireAuditAccess } = require("../services/audit");
const { jsonError } = require("../utils");

const router = express.Router();

router.get("/audit/recent", async (req, res) => {
  try {
    requireAuditAccess(req);
    res.json({ logs: await listAuditLogs({ limit: req.query.limit }) });
  } catch (error) {
    res.status(error.status || 500).json(jsonError(error.message || "audit log를 조회하지 못했습니다."));
  }
});

module.exports = router;
