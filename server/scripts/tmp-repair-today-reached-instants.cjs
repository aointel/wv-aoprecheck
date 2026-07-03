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
    await client.query('BEGIN');

    const insertedReach = await client.query(`
      WITH base AS (
        SELECT
          LOWER(
            TRIM(
              COALESCE(
                NULLIF(t.owner_email, ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(t.to_number, '')) LIKE 'client:%' THEN LOWER(t.to_number) ELSE '' END, 'client:', ''), ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(t.from_number, '')) LIKE 'client:%' THEN LOWER(t.from_number) ELSE '' END, 'client:', ''), ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(t.agent_identity, '')) LIKE 'client:%' THEN LOWER(t.agent_identity) ELSE '' END, 'client:', ''), ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(p.from_number, '')) LIKE 'client:%' THEN LOWER(p.from_number) ELSE '' END, 'client:', ''), ''),
                NULLIF(REPLACE(CASE WHEN LOWER(COALESCE(p.agent_identity, '')) LIKE 'client:%' THEN LOWER(p.agent_identity) ELSE '' END, 'client:', ''), ''),
                NULLIF(p.owner_email, '')
              )
            )
          ) AS agent_email,
          RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(t.to_number, ''), NULLIF(p.to_number, '')), '[^0-9]', '', 'g'), 10) AS lead_phone,
          COALESCE(t.call_duration, 0)::int AS call_duration,
          LOWER(COALESCE(t.call_status, '')) AS call_status,
          t.twilio_call_sid AS call_sid,
          t.call_started_at AS event_timestamp
        FROM twilio_call_logs t
        LEFT JOIN twilio_call_logs p ON p.twilio_call_sid = t.parent_call_sid
        WHERE t.call_started_at >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND t.call_started_at < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND LOWER(COALESCE(t.call_direction, '')) IN ('outbound', 'outbound-dial', 'outbound-api')
          AND COALESCE(TRIM(t.twilio_call_sid), '') <> ''
      ),
      reach_events AS (
        SELECT
          agent_email,
          lead_phone,
          'reach'::text AS event_type,
          event_timestamp,
          NULLIF(call_duration, 0) AS call_duration,
          call_status,
          call_sid,
          'dial_stats_chain'::text AS source,
          'connected'::text AS disposition
        FROM base
        WHERE COALESCE(TRIM(agent_email), '') <> ''
          AND lead_phone <> ''
          AND call_duration >= 45
          AND call_status IN ('answered', 'completed')
      )
      INSERT INTO agent_dial_metrics (
        agent_email, lead_phone, event_type, event_timestamp, call_duration, call_status, call_sid, source, disposition
      )
      SELECT
        e.agent_email, e.lead_phone, e.event_type, e.event_timestamp, e.call_duration, e.call_status, e.call_sid, e.source, e.disposition
      FROM reach_events e
      WHERE NOT EXISTS (
        SELECT 1
        FROM agent_dial_metrics adm
        WHERE adm.call_sid = e.call_sid
          AND adm.event_type = 'reach'
      )
    `);

    const updatedReached = await client.query(`
      WITH reached_by_agent AS (
        SELECT
          LOWER(TRIM(agent_email)) AS agent_email,
          COUNT(DISTINCT COALESCE(NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(lead_phone, ''), '\\D', '', 'g'), 10), ''), NULLIF(call_sid, ''), 'row:' || id::text))::int AS reached
        FROM agent_dial_metrics
        WHERE event_type = 'reach'
          AND COALESCE(TRIM(agent_email), '') <> ''
          AND event_timestamp >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND event_timestamp < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        GROUP BY 1
      )
      UPDATE agent_daily_stats ads
      SET reached = COALESCE(r.reached, 0),
          updated_at = NOW()
      FROM reached_by_agent r
      WHERE ads.stat_date = CURRENT_DATE
        AND LOWER(TRIM(ads.agent_email)) = r.agent_email
    `);

    const updatedInstants = await client.query(`
      WITH instants_by_agent AS (
        SELECT
          LOWER(TRIM(agent_email)) AS agent_email,
          COUNT(DISTINCT COALESCE(NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(lead_phone, ''), '\\D', '', 'g'), 10), ''), NULLIF(call_sid, ''), 'row:' || id::text))::int AS instants
        FROM agent_dial_metrics
        WHERE event_type = 'dial'
          AND COALESCE(TRIM(agent_email), '') <> ''
          AND COALESCE(call_duration, 0) >= 600
          AND event_timestamp >= (((CURRENT_DATE)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND event_timestamp < ((((CURRENT_DATE + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
        GROUP BY 1
      )
      UPDATE agent_daily_stats ads
      SET instants = COALESCE(i.instants, 0),
          updated_at = NOW()
      FROM instants_by_agent i
      WHERE ads.stat_date = CURRENT_DATE
        AND LOWER(TRIM(ads.agent_email)) = i.agent_email
    `);

    await client.query('COMMIT');

    const summary = await client.query(`
      SELECT
        stat_date::text AS stat_date,
        SUM(dials)::int AS dials,
        SUM(reached)::int AS reached,
        SUM(booked)::int AS booked,
        SUM(instants)::int AS instants,
        COUNT(*)::int AS agents
      FROM agent_daily_stats
      WHERE stat_date = CURRENT_DATE
      GROUP BY 1
    `);

    console.log(
      JSON.stringify(
        {
          inserted_reach_events: Number(insertedReach.rowCount || 0),
          updated_ads_reached_rows: Number(updatedReached.rowCount || 0),
          updated_ads_instants_rows: Number(updatedInstants.rowCount || 0),
          today_summary: summary.rows[0] || null,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

