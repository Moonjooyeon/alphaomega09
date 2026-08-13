const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
const config = require("./config");

const pool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl }) : null;

function requirePool() {
  if (!pool) throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  return pool;
}

async function query(text, params) {
  return requirePool().query(text, params);
}

async function migrate() {
  const db = requirePool();
  const dir = path.join(__dirname, "migrations");
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const done = await db.query("SELECT 1 FROM schema_migrations WHERE id = $1", [id]);
    if (done.rowCount) continue;

    const sql = await fs.readFile(path.join(dir, file), "utf8");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { pool, query, migrate };
