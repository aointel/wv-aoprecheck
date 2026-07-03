const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "coxsteven@aoglobelife.com").toLowerCase();
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const clientStatus = await client.query(
      `
      SELECT
        *
      FROM leasedialer_client_status
      WHERE lower(agent_email) = lower($1)
      ORDER BY updated_at DESC
      LIMIT 3
      `,
      [email],
    );

    const dialActivity = await client.query(
      `
      SELECT
        MAX(event_timestamp) AS last_dial_at,
        COUNT(*) FILTER (WHERE event_timestamp >= NOW() - INTERVAL '2 hours')::int AS dials_last_2h,
        COUNT(*) FILTER (WHERE event_timestamp >= NOW() - INTERVAL '24 hours')::int AS dials_last_24h
      FROM agent_dial_metrics
      WHERE lower(agent_email) = lower($1)
        AND event_type = 'dial'
      `,
      [email],
    );

    console.log(
      JSON.stringify(
        {
          email,
          client_status: clientStatus.rows,
          dial_activity: dialActivity.rows[0] || null,
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
