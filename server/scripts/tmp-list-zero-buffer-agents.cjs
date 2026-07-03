const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(1, Math.min(60, Number(process.argv[2] || 5)));
  const limit = Math.max(1, Math.min(200, Number(process.argv[3] || 60)));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count,
          updated_at
        FROM leasedialer_client_status
        WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
        ORDER BY lower(agent_email), updated_at DESC
      )
      SELECT agent_email, local_leased_lead_count, updated_at
      FROM latest
      WHERE local_leased_lead_count = 0
      ORDER BY updated_at DESC, agent_email ASC
      LIMIT $2
      `,
      [minutes, limit],
    );
    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          windowMinutes: minutes,
          count: result.rows.length,
          rows: result.rows,
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
