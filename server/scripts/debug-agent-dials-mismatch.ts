import { pool } from '../db.js';

async function main() {
  const day = process.argv[2] || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  const rawDialEvents = await pool.query<{ dial_events: string }>(
    `
      SELECT COUNT(*)::text AS dial_events
      FROM agent_dial_metrics
      WHERE LOWER(TRIM(event_type)) = 'dial'
        AND event_timestamp >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
        AND event_timestamp < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
    `,
    [day],
  );

  const dailyStatsSum = await pool.query<{ daily_dials: string }>(
    `
      SELECT COALESCE(SUM(dials), 0)::text AS daily_dials
      FROM agent_daily_stats
      WHERE stat_date = $1::date
    `,
    [day],
  );

  const mismatchTop = await pool.query<{
    agent_email: string;
    raw_dials: string;
    stats_dials: string;
    delta: string;
  }>(
    `
      WITH raw AS (
        SELECT
          LOWER(TRIM(agent_email)) AS agent_email,
          COUNT(*) FILTER (WHERE LOWER(TRIM(event_type)) = 'dial')::int AS raw_dials
        FROM agent_dial_metrics
        WHERE event_timestamp >= ($1::date::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND event_timestamp < (($1::date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles')
          AND COALESCE(TRIM(agent_email), '') <> ''
        GROUP BY LOWER(TRIM(agent_email))
      ),
      stats AS (
        SELECT LOWER(TRIM(agent_email)) AS agent_email, COALESCE(dials, 0)::int AS stats_dials
        FROM agent_daily_stats
        WHERE stat_date = $1::date
      )
      SELECT
        COALESCE(raw.agent_email, stats.agent_email) AS agent_email,
        COALESCE(raw.raw_dials, 0)::text AS raw_dials,
        COALESCE(stats.stats_dials, 0)::text AS stats_dials,
        (COALESCE(raw.raw_dials, 0) - COALESCE(stats.stats_dials, 0))::text AS delta
      FROM raw
      FULL OUTER JOIN stats ON raw.agent_email = stats.agent_email
      ORDER BY ABS(COALESCE(raw.raw_dials, 0) - COALESCE(stats.stats_dials, 0)) DESC
      LIMIT 25
    `,
    [day],
  );

  console.log(
    JSON.stringify(
      {
        day,
        totals: {
          rawDialEvents: Number(rawDialEvents.rows[0]?.dial_events || 0),
          dailyStatsDials: Number(dailyStatsSum.rows[0]?.daily_dials || 0),
        },
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

