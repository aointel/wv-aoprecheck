const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const EMAIL = 'chrislafond@aoglobelife.com';

async function run() {
  const c = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await c.connect();
  try {
    const twilio = await c.query(
      `
      SELECT
        COUNT(*)::int AS outbound_rows,
        COUNT(DISTINCT twilio_call_sid)::int AS unique_sids,
        COUNT(*) FILTER (WHERE COALESCE(call_duration, 0) >= 45 AND LOWER(COALESCE(call_status, '')) IN ('answered','completed'))::int AS reach_45_rows
      FROM twilio_call_logs
      WHERE call_started_at >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND call_started_at < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND LOWER(COALESCE(call_direction, '')) IN ('outbound','outbound-dial','outbound-api')
        AND LOWER(COALESCE(owner_email, '')) = $1
      `,
      [EMAIL],
    );

    const adm = await c.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE event_type='dial')::int AS dial_events,
        COUNT(DISTINCT call_sid) FILTER (WHERE event_type='dial')::int AS dial_unique_sids,
        COUNT(*) FILTER (WHERE event_type='reach')::int AS reach_events,
        COUNT(DISTINCT call_sid) FILTER (WHERE event_type='reach')::int AS reach_unique_sids
      FROM agent_dial_metrics
      WHERE event_timestamp >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND event_timestamp < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        AND LOWER(TRIM(agent_email)) = $1
      `,
      [EMAIL],
    );

    const ads = await c.query(
      `
      SELECT
        stat_date::text AS stat_date,
        dials, reached, booked, instants, updated_at
      FROM agent_daily_stats
      WHERE stat_date = CURRENT_DATE
        AND LOWER(TRIM(agent_email)) = $1
      `,
      [EMAIL],
    );

    console.log(
      JSON.stringify(
        {
          email: EMAIL,
          twilio: twilio.rows[0] || null,
          adm: adm.rows[0] || null,
          ads: ads.rows[0] || null,
        },
        null,
        2,
      ),
    );
  } finally {
    await c.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

