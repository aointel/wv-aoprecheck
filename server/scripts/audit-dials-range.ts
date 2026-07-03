import { pool } from "../db.js";

async function main() {
  const startDate = String(process.argv[2] || "2026-04-30");
  const endDate = String(process.argv[3] || "2026-05-06");

  const result = await pool.query<{
    agent_daily_sum: string;
    team_raw_sum: string;
    twilio_outbound_distinct: string;
    twilio_outbound_rows: string;
    twilio_owner_outbound_distinct: string;
  }>(
    `
      WITH bounds AS (
        SELECT
          (($1::date::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS ts_start,
          (((($2::date + 1)::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS ts_end
      )
      SELECT
        (
          SELECT COALESCE(SUM(dials), 0)::bigint::text
          FROM agent_daily_stats
          WHERE stat_date >= $1::date
            AND stat_date <= $2::date
        ) AS agent_daily_sum,
        (
          SELECT COALESCE(SUM(raw_outbound_dials), 0)::bigint::text
          FROM team_raw_dials_daily
          WHERE stat_date >= $1::date
            AND stat_date <= $2::date
        ) AS team_raw_sum,
        (
          SELECT COUNT(DISTINCT twilio_call_sid)::bigint::text
          FROM twilio_call_logs t
          CROSS JOIN bounds b
          WHERE t.call_started_at >= b.ts_start
            AND t.call_started_at < b.ts_end
            AND LOWER(COALESCE(t.call_direction, '')) IN ('outbound', 'outbound-dial')
        ) AS twilio_outbound_distinct,
        (
          SELECT COUNT(*)::bigint::text
          FROM twilio_call_logs t
          CROSS JOIN bounds b
          WHERE t.call_started_at >= b.ts_start
            AND t.call_started_at < b.ts_end
            AND LOWER(COALESCE(t.call_direction, '')) IN ('outbound', 'outbound-dial')
        ) AS twilio_outbound_rows,
        (
          SELECT COUNT(DISTINCT twilio_call_sid)::bigint::text
          FROM twilio_call_logs t
          CROSS JOIN bounds b
          WHERE t.call_started_at >= b.ts_start
            AND t.call_started_at < b.ts_end
            AND LOWER(COALESCE(t.call_direction, '')) IN ('outbound', 'outbound-dial')
            AND t.owner_email IS NOT NULL
            AND COALESCE(TRIM(t.owner_email), '') <> ''
        ) AS twilio_owner_outbound_distinct
    `,
    [startDate, endDate],
  );

  console.log(
    JSON.stringify(
      {
        startDate,
        endDate,
        totals: result.rows[0],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error((err as Error)?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
