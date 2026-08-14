const { pool, query } = require("../db");
const { id } = require("../utils");

function toPublicPass(row) {
  return {
    id: row.id,
    status: row.status,
    passCode: row.pass_code,
    allowedUses: Number(row.allowed_uses || 0),
    usedCount: Number(row.used_count || 0),
    remainingUses: Math.max(0, Number(row.allowed_uses || 0) - Number(row.used_count || 0)),
    createdAt: row.created_at,
    usedAt: row.used_at,
    expiresAt: row.expires_at,
  };
}

function summarizePasses(rows) {
  const passes = rows.map(toPublicPass);
  return {
    passes,
    totalRemainingUses: passes.reduce((sum, pass) => sum + pass.remainingUses, 0),
  };
}

async function listPassesForUser(userId) {
  const { rows } = await query(
    `
      SELECT *
      FROM access_passes
      WHERE user_id = $1
      ORDER BY
        CASE status WHEN 'available' THEN 0 WHEN 'used' THEN 1 ELSE 2 END,
        created_at ASC
    `,
    [userId]
  );
  return summarizePasses(rows);
}

async function createPassForOrder(client, { userId, orderId, allowedUses, passCode = null }) {
  const { rows } = await client.query(
    `
      INSERT INTO access_passes (id, user_id, order_id, pass_code, allowed_uses)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [id("pass"), userId, orderId || null, passCode, allowedUses]
  );
  return rows[0];
}

async function findChargeByKey(client, chargeKey) {
  const { rows } = await client.query(
    `
      SELECT
        c.*,
        p.user_id,
        p.allowed_uses,
        p.used_count,
        p.status AS pass_status
      FROM access_pass_charges c
      JOIN access_passes p ON p.id = c.access_pass_id
      WHERE c.charge_key = $1
    `,
    [chargeKey]
  );
  return rows[0] || null;
}

async function consumePass({ userId, sessionId, chargeKey }) {
  if (!chargeKey || String(chargeKey).length < 12) {
    const error = new Error("chargeKey가 필요합니다.");
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingCharge = await findChargeByKey(client, chargeKey);
    if (existingCharge) {
      if (existingCharge.user_id !== userId) {
        const error = new Error("이미 다른 사용자에게 사용된 차감 키입니다.");
        error.status = 409;
        throw error;
      }
      await client.query("COMMIT");
      return {
        idempotent: true,
        charge: existingCharge,
        passes: await listPassesForUser(userId),
      };
    }

    const session = await client.query(
      `
        SELECT *
        FROM usage_sessions
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [sessionId, userId]
    );
    if (!session.rowCount) {
      const error = new Error("차감할 검사 세션을 찾지 못했습니다.");
      error.status = 404;
      throw error;
    }
    if (Number(session.rows[0].successful_request_count || 0) < 1) {
      const error = new Error("성공한 검사 요청이 없어 이용권을 차감할 수 없습니다.");
      error.status = 409;
      throw error;
    }

    const passResult = await client.query(
      `
        SELECT *
        FROM access_passes
        WHERE
          user_id = $1
          AND status = 'available'
          AND used_count < allowed_uses
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `,
      [userId]
    );
    if (!passResult.rowCount) {
      const error = new Error("사용 가능한 이용권이 없습니다.");
      error.status = 402;
      throw error;
    }

    const pass = passResult.rows[0];
    const nextUsedCount = Number(pass.used_count || 0) + 1;
    const nextStatus = nextUsedCount >= Number(pass.allowed_uses || 0) ? "used" : "available";

    const updatedPass = await client.query(
      `
        UPDATE access_passes
        SET
          used_count = $2,
          status = $3,
          used_at = CASE WHEN $3 = 'used' THEN now() ELSE used_at END
        WHERE id = $1
        RETURNING *
      `,
      [pass.id, nextUsedCount, nextStatus]
    );

    const charge = await client.query(
      `
        INSERT INTO access_pass_charges (id, access_pass_id, session_id, charge_key)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [id("charge"), pass.id, sessionId, chargeKey]
    );

    await client.query("UPDATE usage_sessions SET access_pass_id = $2 WHERE id = $1", [sessionId, pass.id]);
    await client.query("UPDATE gemini_requests SET access_pass_id = $2 WHERE session_id = $1", [sessionId, pass.id]);

    await client.query("COMMIT");

    return {
      idempotent: false,
      charge: charge.rows[0],
      pass: toPublicPass(updatedPass.rows[0]),
      passes: await listPassesForUser(userId),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { consumePass, createPassForOrder, listPassesForUser, toPublicPass };
