const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const limit = Math.max(1, Math.min(200, Number(process.argv[2] || 50)));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const res = await client.query(
      `
      SELECT
        lower(agent_email) AS agent_email,
        COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count,
        updated_at
      FROM leasedialer_client_status
      WHERE updated_at >= NOW() - INTERVAL '30 minutes'
        AND COALESCE(local_leased_lead_count, 0) = 0
      ORDER BY updated_at DESC NULLS LAST, lower(agent_email) ASC
      LIMIT $1
      `,
      [limit],
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          limit,
          waiting_count: res.rows.length,
          waiting_agents: res.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
