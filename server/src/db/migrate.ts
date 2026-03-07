import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getPool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await pool.query("SELECT name FROM _migrations ORDER BY id");
  const appliedNames = new Set(applied.rows.map((r: { name: string }) => r.name));

  const migrations = ["001_initial.sql"];

  for (const migration of migrations) {
    if (appliedNames.has(migration)) {
      console.log(`[migrate] Skipping ${migration} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(__dirname, "migrations", migration), "utf-8");
    await pool.query(sql);
    await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [migration]);
    console.log(`[migrate] Applied ${migration}`);
  }

  await pool.end();
  console.log("[migrate] Done");
}

migrate().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
