import { Pool } from "pg";

/**
 * Pool Postgres (postgres-totum na VPS, database `cashflow`).
 * DATABASE_URL ex.: postgres://cashflow_app:senha@postgres-totum:5432/cashflow
 *
 * BIGINT (centavos) chega como string do driver pg — o parser abaixo converte
 * para number (seguro: valores < 2^53). NUNCA usar NUMERIC para dinheiro.
 */
import pg from "pg";

// int8 (OID 20) → number. Dinheiro em centavos cabe com folga em 2^53.
pg.types.setTypeParser(20, (v: string) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new Error(`int8 fora do intervalo seguro: ${v}`);
  return n;
});
// date (OID 1082) → string "YYYY-MM-DD" (sem timezone surprises)
pg.types.setTypeParser(1082, (v: string) => v);

let _pool: Pool | undefined;

export function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    _pool = new pg.Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return _pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function withTransaction<T>(
  fn: (q: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const q = async (text: string, params: unknown[] = []) =>
      (await client.query(text, params)).rows;
    const out = await fn(q);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
