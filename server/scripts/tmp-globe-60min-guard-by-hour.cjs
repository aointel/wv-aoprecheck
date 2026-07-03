const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const minutes = Math.max(1, Number(process.argv[3] || 60));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
      WITH bounds AS (
        SELECT
          (((now() AT TIME ZONE $1)::date)::timestamp AT TIME ZONE $1) AS start_ts,
          ((((now() AT TIME ZONE $1)::date + 1)::timestamp) AT TIME ZONE $1) AS end_ts,
          (now() AT TIME ZONE $1) AS now_local
      ),
      hours AS (
        SELECT generate_series(
          (SELECT start_ts FROM bounds),
          LEAST((SELECT end_ts FROM bounds), (SELECT now_local FROM bounds)),
          INTERVAL '1 hour'
        ) AS hour_mark
      ),
      all_assignments AS (
        SELECT
          la.id,
          la.lead_id,
          la.status,
          la.assigned_at,
          la.updated_at
        FROM leasedialer_assignments la
        WHERE la.queue = 'hotlead'
      ),
      globe_assignments AS (
        SELECT
          aa.id,
          aa.lead_id,
          aa.status,
          COALESCE(aa.updated_at, aa.assigned_at) AS touch_ts
        FROM all_assignments aa
        JOIN masterlead ml ON ml.id = aa.lead_id
        WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%'
      ),
      hourly AS (
        SELECT
          h.hour_mark,
          COUNT(*) FILTER (
            WHERE ga.status IN ('queued', 'active')
              AND ga.touch_ts IS NOT NULL
              AND ga.touch_ts >= h.hour_mark - ($2::int * INTERVAL '1 minute')
              AND ga.touch_ts <= h.hour_mark
          )::int AS recent_locked_active_count,
          COUNT(DISTINCT ga.lead_id) FILTER (
            WHERE ga.touch_ts IS NOT NULL
              AND ga.touch_ts >= h.hour_mark - ($2::int * INTERVAL '1 minute')
              AND ga.touch_ts <= h.hour_mark
          )::int AS recent_touched_any_status
        FROM hours h
        CROSS JOIN globe_assignments ga
        GROUP BY h.hour_mark
      )
      SELECT
        to_char(hour_mark, 'YYYY-MM-DD HH24:MI') AS hour_local,
        recent_locked_active_count,
        recent_touched_any_status
      FROM hourly
      ORDER BY hour_mark ASC
      `,
      [timezone, minutes],
    );

    const rows = result.rows || [];
    const activeCounts = rows.map((r) => Number(r.recent_locked_active_count || 0));
    const touchedCounts = rows.map((r) => Number(r.recent_touched_any_status || 0));
    const avgActive = activeCounts.length ? activeCounts.reduce((a, b) => a + b, 0) / activeCounts.length : 0;
    const maxActive = activeCounts.length ? Math.max(...activeCounts) : 0;
    const minActive = activeCounts.length ? Math.min(...activeCounts) : 0;
    const activeCountsSorted = [...activeCounts].sort((a, b) => a - b);
    const p90Active = activeCountsSorted.length
      ? activeCountsSorted[Math.min(activeCountsSorted.length - 1, Math.floor((activeCountsSorted.length - 1) * 0.9))]
      : 0;
    const avgTouched = touchedCounts.length ? touchedCounts.reduce((a, b) => a + b, 0) / touchedCounts.length : 0;
    const maxTouched = touchedCounts.length ? Math.max(...touchedCounts) : 0;
    const minTouched = touchedCounts.length ? Math.min(...touchedCounts) : 0;
    const touchedCountsSorted = [...touchedCounts].sort((a, b) => a - b);
    const p90Touched = touchedCountsSorted.length
      ? touchedCountsSorted[Math.min(touchedCountsSorted.length - 1, Math.floor((touchedCountsSorted.length - 1) * 0.9))]
      : 0;

    console.log(
      JSON.stringify(
        {
          timezone,
          minutes_window: minutes,
          summary: {
            hours_sampled: rows.length,
            active_only_recent_locked: {
              avg: Number(avgActive.toFixed(2)),
              min: minActive,
              max: maxActive,
              p90: p90Active,
            },
            any_status_recent_touched: {
              avg: Number(avgTouched.toFixed(2)),
              min: minTouched,
              max: maxTouched,
              p90: p90Touched,
            },
          },
          hourly: rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
