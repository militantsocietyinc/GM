import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult> {
  return getPool().query(text, params);
}

export async function testConnection(): Promise<boolean> {
  try {
    const result = await query("SELECT 1");
    return result.rowCount === 1;
  } catch {
    return false;
  }
}
