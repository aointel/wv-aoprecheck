const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const limit = Math.max(1, Math.min(1000, Number(process.argv[2] || 500)));
  const timezone = String(process.argv[3] || "America/Los_Angeles");
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const summary = await client.query(
      `
      SELECT
        COUNT(DISTINCT lower(agent_email))::int AS unique_agents,
        COUNT(*)::int AS total_events
      FROM leasedialer_client_status
      WHERE updated_at::date = (NOW() AT TIME ZONE $1)::date
      `,
      [timezone],
    );

    const details = await client.query(
      `
      WITH today AS (
        SELECT
          lower(agent_email) AS agent_email,
          updated_at,
          COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count
        FROM leasedialer_client_status
        WHERE updated_at::date = (NOW() AT TIME ZONE $1)::date
      )
      SELECT
        agent_email,
        COUNT(*)::int AS request_events,
        MIN(updated_at) AS first_request_at,
        MAX(updated_at) AS last_request_at,
        MIN(local_leased_lead_count)::int AS min_local_leads,
        MAX(local_leased_lead_count)::int AS max_local_leads
      FROM today
      GROUP BY agent_email
      ORDER BY last_request_at DESC, agent_email ASC
      LIMIT $2
      `,
      [timezone, limit],
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          timezone,
          summary: summary.rows[0] || { unique_agents: 0, total_events: 0 },
          agents: details.rows,
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
