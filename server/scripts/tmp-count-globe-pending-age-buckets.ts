import { leaseDialerPool as pool } from "../db";

async function main() {
  const includeAllMarkets = process.argv.includes("--all-markets");
  const colsRes = await pool.query<{ column_name: string }>({
    text: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='masterlead'
    `,
  });
  const cols = new Set(colsRes.rows.map((r) => r.column_name));

  const marketParts = includeAllMarkets
    ? ["TRUE"]
    : [
        "LOWER(COALESCE(taalk_market, '')) LIKE '%globe market%'",
        "LOWER(COALESCE(market, '')) LIKE '%globe market%'",
      ];
  if (!includeAllMarkets && cols.has("groupcode")) marketParts.push("LOWER(COALESCE(groupcode::text, '')) LIKE '%globe market%'");
  if (!includeAllMarkets && cols.has("group_code")) marketParts.push("LOWER(COALESCE(group_code::text, '')) LIKE '%globe market%'");

  const bounds = await pool.query<{ min_id: number; max_id: number }>({
    text: `SELECT COALESCE(MIN(id),0)::int AS min_id, COALESCE(MAX(id),0)::int AS max_id FROM masterlead`,
  });
  const minId = Number(bounds.rows[0]?.min_id || 0);
  const maxId = Number(bounds.rows[0]?.max_id || 0);

  let totalPendingNull = 0;
  let bucket0to2 = 0;
  let bucket3to30 = 0;
  const STEP = 25000;

  for (let start = minId; start <= maxId; start += STEP) {
    const end = start + STEP;
    const part = await pool.query<{
      total_pending_null: number;
      bucket_0_2: number;
      bucket_3_30: number;
    }>({
      text: `
        SELECT
          COUNT(*)::int AS total_pending_null,
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - INTERVAL '2 days'
          )::int AS bucket_0_2,
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - INTERVAL '30 days'
              AND created_at < NOW() - INTERVAL '2 days'
          )::int AS bucket_3_30
        FROM masterlead
        WHERE id >= $1
          AND id < $2
          AND (${marketParts.join(" OR ")})
          AND (
            cnresolution IS NULL
            OR LOWER(TRIM(COALESCE(cnresolution, ''))) = 'pending'
            OR TRIM(COALESCE(cnresolution, '')) = ''
          )
      `,
      values: [start, end],
      query_timeout: 120000,
    });
    totalPendingNull += Number(part.rows[0]?.total_pending_null || 0);
    bucket0to2 += Number(part.rows[0]?.bucket_0_2 || 0);
    bucket3to30 += Number(part.rows[0]?.bucket_3_30 || 0);
  }

  const payload = {
    scope: includeAllMarkets
      ? "all-markets pending/null cnresolution (chunked by id)"
      : "globe-market pending/null cnresolution (chunked by id)",
    as_of_utc: new Date().toISOString(),
    total_pending_null: totalPendingNull,
    bucket_0_2_days: bucket0to2,
    bucket_3_30_days: bucket3to30,
  };

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });

