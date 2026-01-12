import "dotenv/config";

import fs from "fs";
import path from "path";

import { getPostgresPool, disconnectPostgres } from "../config/postgres";

type AppliedRow = { filename: string };

async function ensureMigrationsTable() {
  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedFilenames(): Promise<Set<string>> {
  const pool = getPostgresPool();
  const res = await pool.query<AppliedRow>(`SELECT filename FROM schema_migrations;`);
  return new Set(res.rows.map((r) => r.filename));
}

async function applyMigration(filename: string, sql: string) {
  const pool = getPostgresPool();
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1);`, [filename]);
    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

async function run() {
  const pool = getPostgresPool();

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations folder not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  await ensureMigrationsTable();
  const applied = await getAppliedFilenames();

  const pending = files.filter((f) => !applied.has(f));

  console.log(
    JSON.stringify({
      level: "info",
      msg: "migrate.status",
      total: files.length,
      applied: applied.size,
      pending: pending.length
    })
  );

  for (const file of pending) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, "utf8");

    console.log(JSON.stringify({ level: "info", msg: "migrate.run", file }));
    await applyMigration(file, sql);
    console.log(JSON.stringify({ level: "info", msg: "migrate.done", file }));
  }

  // Optional: verify connection still good
  await pool.query("SELECT 1");
}

run()
  .then(async () => {
    await disconnectPostgres();
    process.exit(0);
  })
  .catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", msg: "migrate.error", error: message }));
    await disconnectPostgres();
    process.exit(1);
  });
