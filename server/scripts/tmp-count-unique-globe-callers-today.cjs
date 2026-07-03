const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const eventType = String(process.argv[3] || "dial").toLowerCase();

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
          ((((now() AT TIME ZONE $1)::date + 1)::timestamp) AT TIME ZONE $1) AS end_ts
      ),
      latest_profiles AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      globe_agents AS (
        SELECT lp.agent_email
        FROM latest_profiles lp
        WHERE EXISTS (
          SELECT 1
          FROM unnest(COALESCE(lp.markets, ARRAY[]::text[])) m
          WHERE lower(regexp_replace(m, '\\s+', '', 'g')) LIKE '%globe%'
        )
      )
      SELECT
        COUNT(DISTINCT lower(adm.agent_email))::int AS unique_globe_agents_called_today,
        ARRAY_AGG(DISTINCT lower(adm.agent_email) ORDER BY lower(adm.agent_email)) AS agents,
        (SELECT COUNT(*)::int FROM globe_agents) AS total_globe_agents_profiled,
        (SELECT COUNT(DISTINCT lower(x.agent_email))::int FROM agent_dial_metrics x, bounds b2 WHERE x.event_timestamp >= b2.start_ts AND x.event_timestamp < b2.end_ts) AS total_unique_agents_with_any_events_today
      FROM agent_dial_metrics adm
      JOIN globe_agents ga
        ON ga.agent_email = lower(adm.agent_email)
      CROSS JOIN bounds b
      WHERE lower(trim(coalesce(adm.event_type, ''))) = $2
        AND adm.event_timestamp >= b.start_ts
        AND adm.event_timestamp < b.end_ts
      `,
      [timezone, eventType],
    );

    console.log(
      JSON.stringify(
        {
          timezone,
          event_type: eventType,
          unique_globe_agents_called_today:
            Number(result.rows[0]?.unique_globe_agents_called_today || 0),
          total_globe_agents_profiled:
            Number(result.rows[0]?.total_globe_agents_profiled || 0),
          total_unique_agents_with_any_events_today:
            Number(result.rows[0]?.total_unique_agents_with_any_events_today || 0),
          agents: result.rows[0]?.agents || [],
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
