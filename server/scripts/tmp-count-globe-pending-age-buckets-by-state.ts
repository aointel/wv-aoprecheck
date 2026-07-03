import { leaseDialerPool as pool } from "../db";

type ChunkRow = {
  state: string;
  bucket_0_2: number;
  bucket_3_30: number;
};

async function main() {
  const includeCalled = process.argv.includes("--include-called");
  const colsRes = await pool.query<{ column_name: string }>({
    text: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='masterlead'
    `,
  });
  const cols = new Set(colsRes.rows.map((r) => r.column_name));

  const marketParts = [
    "LOWER(COALESCE(taalk_market, '')) LIKE '%globe market%'",
    "LOWER(COALESCE(market, '')) LIKE '%globe market%'",
  ];
  if (cols.has("groupcode")) marketParts.push("LOWER(COALESCE(groupcode::text, '')) LIKE '%globe market%'");
  if (cols.has("group_code")) marketParts.push("LOWER(COALESCE(group_code::text, '')) LIKE '%globe market%'");

  const bounds = await pool.query<{ min_id: number; max_id: number }>({
    text: `SELECT COALESCE(MIN(id),0)::int AS min_id, COALESCE(MAX(id),0)::int AS max_id FROM masterlead`,
  });
  const minId = Number(bounds.rows[0]?.min_id || 0);
  const maxId = Number(bounds.rows[0]?.max_id || 0);

  const agg = new Map<string, { bucket_0_2: number; bucket_3_30: number }>();
  const STEP = 25000;

  for (let start = minId; start <= maxId; start += STEP) {
    const end = start + STEP;
    const part = await pool.query<ChunkRow>({
      text: `
        SELECT
          UPPER(COALESCE(NULLIF(TRIM(state), ''), NULLIF(TRIM(taalk_state), ''), 'UNKNOWN')) AS state,
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
            ${includeCalled ? "OR LOWER(TRIM(COALESCE(cnresolution, ''))) = 'called'" : ""}
          )
        GROUP BY 1
      `,
      values: [start, end],
      query_timeout: 120000,
    });

    for (const row of part.rows) {
      const state = String(row.state || "UNKNOWN").toUpperCase();
      const prev = agg.get(state) || { bucket_0_2: 0, bucket_3_30: 0 };
      prev.bucket_0_2 += Number(row.bucket_0_2 || 0);
      prev.bucket_3_30 += Number(row.bucket_3_30 || 0);
      agg.set(state, prev);
    }
  }

  const rows = Array.from(agg.entries())
    .map(([state, v]) => ({
      state,
      bucket_0_2: v.bucket_0_2,
      bucket_3_30: v.bucket_3_30,
      total_0_30: v.bucket_0_2 + v.bucket_3_30,
    }))
    .sort((a, b) => b.total_0_30 - a.total_0_30 || a.state.localeCompare(b.state));

  const totals = rows.reduce(
    (acc, r) => {
      acc.bucket_0_2 += r.bucket_0_2;
      acc.bucket_3_30 += r.bucket_3_30;
      return acc;
    },
    { bucket_0_2: 0, bucket_3_30: 0 },
  );

  console.log(
    JSON.stringify(
      {
        scope: includeCalled
          ? "globe-market pending/null/called cnresolution by state"
          : "globe-market pending/null cnresolution by state",
        as_of_utc: new Date().toISOString(),
        totals,
        states: rows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });

