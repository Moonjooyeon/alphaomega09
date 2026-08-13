const { query } = require("../db");
const { id } = require("../utils");

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    loginId: user.login_id,
    displayName: user.display_name,
  };
}

async function findUserById(userId) {
  const result = await query("SELECT * FROM app_users WHERE id = $1", [userId]);
  return result.rows[0] || null;
}

async function upsertLoginUser({ loginId, displayName }) {
  const result = await query(
    `
      INSERT INTO app_users (id, login_id, display_name, last_login_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (login_id) DO UPDATE
      SET
        display_name = COALESCE(EXCLUDED.display_name, app_users.display_name),
        last_login_at = now()
      RETURNING *
    `,
    [id("user"), loginId, displayName || null]
  );
  return result.rows[0];
}

module.exports = { findUserById, publicUser, upsertLoginUser };
