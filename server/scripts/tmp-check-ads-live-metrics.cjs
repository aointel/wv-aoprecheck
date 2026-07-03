const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const totals = await client.query(`
      SELECT
        stat_date::text AS stat_date,
        COUNT(*)::int AS agents,
        SUM(dials)::int AS dials,
        SUM(reached)::int AS reached,
        SUM(booked)::int AS booked,
        SUM(instants)::int AS instants,
        MAX(updated_at) AS last_updated_at
      FROM agent_daily_stats
      WHERE stat_date IN (
        CURRENT_DATE,
        (CURRENT_DATE - INTERVAL '1 day')::date
      )
      GROUP BY 1
      ORDER BY 1 DESC
    `);

    const nonZero = await client.query(`
      SELECT
        agent_email,
        stat_date::text AS stat_date,
        dials, reached, booked, instants,
        updated_at
      FROM agent_daily_stats
      WHERE stat_date = CURRENT_DATE
        AND (reached > 0 OR booked > 0 OR instants > 0)
      ORDER BY dials DESC, updated_at DESC
      LIMIT 25
    `);

    const twilioDur = await client.query(`
      SELECT
        COUNT(*)::int AS outbound_rows,
        COUNT(*) FILTER (
          WHERE COALESCE(call_duration, 0) >= 45
            AND LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
        )::int AS outbound_reach_45,
        COUNT(*) FILTER (
          WHERE COALESCE(call_duration, 0) >= 55
            AND LOWER(COALESCE(call_status, '')) IN ('answered', 'completed')
        )::int AS outbound_reach_55
      FROM twilio_call_logs
      WHERE call_started_at >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND call_started_at < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND LOWER(COALESCE(call_direction, '')) IN ('outbound', 'outbound-dial', 'outbound-api')
    `);

    const admEvents = await client.query(`
      SELECT
        event_type,
        COUNT(*)::int AS cnt,
        COUNT(*) FILTER (WHERE COALESCE(TRIM(agent_email), '') <> '')::int AS with_email,
        COUNT(*) FILTER (WHERE COALESCE(TRIM(agent_email), '') = '')::int AS without_email
      FROM agent_dial_metrics
      WHERE event_timestamp >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND event_timestamp < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
      GROUP BY event_type
      ORDER BY event_type
    `);

    console.log(
      JSON.stringify(
        {
          totals: totals.rows,
          today_agents_with_nonzero_rbi: nonZero.rows,
          twilio_today_outbound: twilioDur.rows[0] || null,
          adm_today_event_counts: admEvents.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

