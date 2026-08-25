const config = require("../config");
const { query } = require("../db");
const { hashText, id } = require("../utils");

const MAX_METADATA_BYTES = 6000;

function compactMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const copy = { ...metadata };
  for (const key of ["token", "accessToken", "authorizationCode", "apiKey", "rawResponse"]) {
    if (key in copy) copy[key] = "[redacted]";
  }

  const json = JSON.stringify(copy);
  if (Buffer.byteLength(json, "utf8") <= MAX_METADATA_BYTES) return copy;
  return {
    truncated: true,
    keys: Object.keys(copy),
  };
}

function auditToken(req) {
  const header = req.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return req.get("x-audit-token") || "";
}

function requireAuditAccess(req) {
  if (!config.audit.logToken) {
    const error = new Error("AUDIT_LOG_TOKEN이 설정되지 않았습니다.");
    error.status = 403;
    throw error;
  }
  if (auditToken(req) !== config.audit.logToken) {
    const error = new Error("audit log 접근 권한이 없습니다.");
    error.status = 403;
    throw error;
  }
}

async function recordAuditLog(req, { userId = null, eventType, status = "ok", entityType = null, entityId = null, metadata = {} }) {
  if (!eventType) return null;
  try {
    const result = await query(
      `
        INSERT INTO audit_logs (
          id, actor_user_id, event_type, status, entity_type, entity_id,
          ip_hash, user_agent_hash, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      [
        id("audit"),
        userId,
        eventType,
        status,
        entityType,
        entityId,
        hashText(req?.ip),
        hashText(req?.get?.("user-agent")),
        compactMetadata(metadata),
      ]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.warn("audit log write failed:", error?.message || error);
    return null;
  }
}

async function listAuditLogs({ limit = 100 } = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const { rows } = await query(
    `
      SELECT
        a.id,
        a.actor_user_id,
        u.login_id,
        u.display_name,
        a.event_type,
        a.status,
        a.entity_type,
        a.entity_id,
        a.metadata,
        a.created_at
      FROM audit_logs a
      LEFT JOIN app_users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.actor_user_id,
    loginId: row.login_id,
    displayName: row.display_name,
    eventType: row.event_type,
    status: row.status,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

module.exports = { listAuditLogs, recordAuditLog, requireAuditAccess };
