import { pool } from '../db.js';

async function main() {
  const day = process.argv[2] || '2026-04-22';

  const dup = await pool.query<{
    rows_total: string;
    distinct_sids: string;
    duplicated_sid_count: string;
  }>(
    `
      WITH day_calls AS (
        SELECT twilio_call_sid
        FROM twilio_call_logs
        WHERE call_started_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND call_started_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND LOWER(COALESCE(call_direction, '')) = 'outbound-dial'
          AND owner_email IS NOT NULL
      ),
      dups AS (
        SELECT twilio_call_sid, COUNT(*) AS c
        FROM day_calls
        GROUP BY twilio_call_sid
        HAVING COUNT(*) > 1
      )
      SELECT
        (SELECT COUNT(*)::text FROM day_calls) AS rows_total,
        (SELECT COUNT(DISTINCT twilio_call_sid)::text FROM day_calls) AS distinct_sids,
        (SELECT COUNT(*)::text FROM dups) AS duplicated_sid_count
    `,
    [day],
  );

  const totals = await pool.query<{ stats_total: string; twilio_distinct_total: string }>(
    `
      SELECT
        (SELECT COALESCE(SUM(dials), 0)::text FROM agent_daily_stats WHERE stat_date = $1::date) AS stats_total,
        (
          SELECT COUNT(DISTINCT twilio_call_sid)::text
          FROM twilio_call_logs
          WHERE owner_email IS NOT NULL
            AND COALESCE(TRIM(owner_email), '') <> ''
            AND LOWER(COALESCE(call_direction, '')) = 'outbound-dial'
            AND call_started_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
            AND call_started_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
        ) AS twilio_distinct_total
    `,
    [day],
  );

  const mismatchTop = await pool.query<{
    agent_email: string;
    tw_dials: number;
    ds_dials: number;
    delta: number;
  }>(
    `
      WITH tw AS (
        SELECT
          LOWER(TRIM(owner_email)) AS agent_email,
          COUNT(DISTINCT twilio_call_sid)::int AS tw_dials
        FROM twilio_call_logs
        WHERE owner_email IS NOT NULL
          AND COALESCE(TRIM(owner_email), '') <> ''
          AND LOWER(COALESCE(call_direction, '')) = 'outbound-dial'
          AND call_started_at >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND call_started_at < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
        GROUP BY 1
      ),
      ds AS (
        SELECT LOWER(TRIM(agent_email)) AS agent_email, dials::int AS ds_dials
        FROM agent_daily_stats
        WHERE stat_date = $1::date
      )
      SELECT
        COALESCE(tw.agent_email, ds.agent_email) AS agent_email,
        COALESCE(tw.tw_dials, 0)::int AS tw_dials,
        COALESCE(ds.ds_dials, 0)::int AS ds_dials,
        (COALESCE(ds.ds_dials, 0) - COALESCE(tw.tw_dials, 0))::int AS delta
      FROM tw
      FULL OUTER JOIN ds ON ds.agent_email = tw.agent_email
      ORDER BY ABS(COALESCE(ds.ds_dials, 0) - COALESCE(tw.tw_dials, 0)) DESC
      LIMIT 15
    `,
    [day],
  );

  console.log(
    JSON.stringify(
      {
        day,
        sidIntegrity: dup.rows[0],
        totals: totals.rows[0],
        topMismatches: mismatchTop.rows,
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

