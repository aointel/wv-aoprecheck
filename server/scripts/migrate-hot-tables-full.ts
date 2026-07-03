import { pool } from "../db";
import { supabaseAdminRaw, supabaseAdmin } from "../supabase";

type Row = Record<string, unknown>;

const PAGE_SIZE = Number(process.env.MIGRATE_PAGE_SIZE || 1000);
const WRITE_CHUNK = Number(process.env.MIGRATE_WRITE_CHUNK || 500);

function qcol(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function getRemoteCount(table: string): Promise<number> {
  const remote = (supabaseAdminRaw || supabaseAdmin)!;
  const { count, error } = await remote.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count || 0;
}

async function getLocalCount(table: string): Promise<number> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${table}`);
  return Number(r.rows[0]?.n || 0);
}

async function ensureColumns(table: string, columns: string[]): Promise<void> {
  const existing = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name=$1
    `,
    [table],
  );
  const existingSet = new Set(existing.rows.map((r) => r.column_name));
  for (const c of columns) {
    if (!existingSet.has(c)) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${qcol(c)} TEXT`);
    }
  }
}

async function upsertChunkByConflict(
  table: string,
  rows: Row[],
  conflictColumn: string,
): Promise<number> {
  if (!rows.length) return 0;
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  await ensureColumns(table, columns);

  const values: unknown[] = [];
  const rowSql = rows
    .map((row, rIdx) => {
      const placeholders = columns.map((c, cIdx) => {
        values.push((row as any)[c] ?? null);
        return `$${rIdx * columns.length + cIdx + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    })
    .join(", ");

  const updates = columns
    .filter((c) => c !== conflictColumn)
    .map((c) => `${qcol(c)} = EXCLUDED.${qcol(c)}`)
    .join(", ");

  const sql = `
    INSERT INTO ${table} (${columns.map(qcol).join(", ")})
    VALUES ${rowSql}
    ON CONFLICT (${qcol(conflictColumn)})
    DO UPDATE SET ${updates || `${qcol(conflictColumn)} = EXCLUDED.${qcol(conflictColumn)}`}
  `;

  await pool.query(sql, values);
  return rows.length;
}

async function fetchRemotePage(table: string, from: number, to: number): Promise<Row[]> {
  const remote = (supabaseAdminRaw || supabaseAdmin)!;
  const { data, error } = await remote.from(table).select("*").order("id", { ascending: true }).range(from, to);
  if (error) throw new Error(`fetch ${table} [${from}-${to}]: ${error.message}`);
  return (data || []) as Row[];
}

async function migrateTable(
  table: "twilio_call_logs" | "agent_dial_metrics",
  conflictColumn: "twilio_call_sid" | "id",
): Promise<{ remote: number; localBefore: number; localAfter: number; migratedRows: number }> {
  const remoteCount = await getRemoteCount(table);
  const localBefore = await getLocalCount(table);

  let migratedRows = 0;
  for (let from = 0; from < remoteCount; from += PAGE_SIZE) {
    const to = Math.min(remoteCount - 1, from + PAGE_SIZE - 1);
    const page = await fetchRemotePage(table, from, to);
    if (!page.length) continue;
    for (let i = 0; i < page.length; i += WRITE_CHUNK) {
      const chunk = page.slice(i, i + WRITE_CHUNK);
      migratedRows += await upsertChunkByConflict(table, chunk, conflictColumn);
    }
    console.log(`${table}: migrated ${Math.min(to + 1, remoteCount)}/${remoteCount}`);
  }

  const localAfter = await getLocalCount(table);
  return { remote: remoteCount, localBefore, localAfter, migratedRows };
}

async function main() {
  const twilio = await migrateTable("twilio_call_logs", "twilio_call_sid");
  const metrics = await migrateTable("agent_dial_metrics", "id");

  console.log(
    JSON.stringify(
      {
        pageSize: PAGE_SIZE,
        writeChunk: WRITE_CHUNK,
        results: {
          twilio_call_logs: twilio,
          agent_dial_metrics: metrics,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {}
  });

