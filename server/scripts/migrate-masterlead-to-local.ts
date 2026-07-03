import { pool } from "../db";
import { supabaseAdminRaw } from "../supabase";

const BATCH_SIZE = 1000;
const UPSERT_SUB_BATCH_ROWS = 50;

function qcol(column: string): string {
  return `"${String(column).replace(/"/g, '""')}"`;
}

function normalizeColumn(column: string): string {
  return String(column || "").trim().replace(/^"+|"+$/g, "");
}

async function ensureMasterleadBaseTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS masterlead (
      id BIGINT PRIMARY KEY
    );
  `);
}

async function getExistingColumns(): Promise<Set<string>> {
  const result = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'masterlead'
    `,
  );
  return new Set(result.rows.map((r) => String(r.column_name || "")));
}

async function ensureColumns(columns: string[], known: Set<string>): Promise<void> {
  for (const raw of columns) {
    const col = normalizeColumn(raw);
    if (!col || known.has(col)) continue;
    if (col === "id") {
      known.add(col);
      continue;
    }
    await pool.query(`ALTER TABLE masterlead ADD COLUMN IF NOT EXISTS ${qcol(col)} TEXT`);
    known.add(col);
  }
}

async function getSupabaseCount(): Promise<number> {
  if (!supabaseAdminRaw) throw new Error("supabaseAdminRaw unavailable");
  const { count, error } = await supabaseAdminRaw
    .from("masterlead")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return Number(count || 0);
}

async function fetchBatch(offset: number): Promise<Record<string, unknown>[]> {
  if (!supabaseAdminRaw) throw new Error("supabaseAdminRaw unavailable");
  const { data, error } = await supabaseAdminRaw
    .from("masterlead")
    .select("*")
    .order("id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);
  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

async function upsertBatch(rows: Record<string, unknown>[], knownColumns: Set<string>): Promise<void> {
  if (!rows.length) return;

  const columnSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      const col = normalizeColumn(key);
      if (col) columnSet.add(col);
    }
  }
  const columns = [...columnSet];
  if (!columns.includes("id")) {
    throw new Error("Batch missing required id column");
  }

  await ensureColumns(columns, knownColumns);

  const quotedCols = columns.map((c) => qcol(c)).join(", ");
  const updates = columns
    .filter((c) => c !== "id")
    .map((c) => `${qcol(c)} = EXCLUDED.${qcol(c)}`)
    .join(", ");

  for (let i = 0; i < rows.length; i += UPSERT_SUB_BATCH_ROWS) {
    const subRows = rows.slice(i, i + UPSERT_SUB_BATCH_ROWS);
    const values: unknown[] = [];
    let paramIdx = 1;
    const rowPlaceholders = subRows
      .map((row) => {
        const placeholders = columns.map((col) => {
          const raw = (row as Record<string, unknown>)[col];
          const value = raw == null ? null : col === "id" ? raw : String(raw);
          values.push(value);
          return `$${paramIdx++}`;
        });
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");

    const sql = `
      INSERT INTO masterlead (${quotedCols})
      VALUES ${rowPlaceholders}
      ON CONFLICT (id)
      DO UPDATE SET ${updates || "id = EXCLUDED.id"}
    `;
    await pool.query(sql, values);
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  await ensureMasterleadBaseTable();
  const knownColumns = await getExistingColumns();

  const total = await getSupabaseCount();
  console.log(`Starting masterlead migration: ${total} rows from Supabase`);

  let processed = 0;
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const batch = await fetchBatch(offset);
    if (!batch.length) break;
    await upsertBatch(batch, knownColumns);
    processed += batch.length;
    if (processed % 10000 === 0 || processed >= total) {
      const pct = total > 0 ? ((processed / total) * 100).toFixed(2) : "100.00";
      console.log(`Progress: ${processed}/${total} (${pct}%)`);
    }
    if (batch.length < BATCH_SIZE) break;
  }

  const localCountResult = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM masterlead`,
  );
  const localCount = Number(localCountResult.rows[0]?.c || 0);
  console.log(
    `Migration complete in ${Date.now() - started}ms | local rows=${localCount} | expected~=${total}`,
  );
}

main()
  .catch((error) => {
    console.error("masterlead migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {
      // ignore
    }
  });

