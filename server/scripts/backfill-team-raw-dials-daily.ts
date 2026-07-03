import { pool } from "../db.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_raw_dials_daily (
      stat_date date PRIMARY KEY,
      raw_outbound_dials integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

async function backfillChunk(start: string, end: string): Promise<number> {
  const result = await pool.query({
    text: `
      WITH agg AS (
        SELECT
          ((call_started_at AT TIME ZONE 'America/New_York') - interval '6 hours')::date AS stat_date,
          COUNT(DISTINCT twilio_call_sid)::int AS raw_outbound_dials
        FROM twilio_call_logs
        WHERE call_started_at >= (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND call_started_at < ((($2::date + 1)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial')
          AND COALESCE(TRIM(twilio_call_sid), '') <> ''
        GROUP BY 1
      )
      INSERT INTO team_raw_dials_daily (stat_date, raw_outbound_dials, updated_at)
      SELECT stat_date, raw_outbound_dials, NOW()
      FROM agg
      ON CONFLICT (stat_date)
      DO UPDATE SET
        raw_outbound_dials = EXCLUDED.raw_outbound_dials,
        updated_at = NOW()
      RETURNING stat_date
    `,
    values: [start, end],
    query_timeout: 120000,
  });
  return result.rowCount || 0;
}

async function main() {
  const startIso = getArg("start") || "2026-01-01";
  const endIso =
    getArg("end") ||
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const chunkDays = Math.max(1, Number(getArg("chunkDays") || 14));

  await ensureTable();

  let cur = toUtcDate(startIso);
  const end = toUtcDate(endIso);
  let totalRows = 0;
  let chunks = 0;

  while (cur <= end) {
    const chunkStart = isoDate(cur);
    const chunkEndDate = new Date(cur);
    chunkEndDate.setUTCDate(chunkEndDate.getUTCDate() + (chunkDays - 1));
    if (chunkEndDate > end) chunkEndDate.setTime(end.getTime());
    const chunkEnd = isoDate(chunkEndDate);

    const rows = await backfillChunk(chunkStart, chunkEnd);
    totalRows += rows;
    chunks += 1;
    console.log(`[raw-dials-backfill] ${chunkStart}..${chunkEnd} upserted=${rows}`);

    cur.setUTCDate(cur.getUTCDate() + chunkDays);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        start: startIso,
        end: endIso,
        chunkDays,
        chunks,
        totalRows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error((e as Error)?.message || String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

