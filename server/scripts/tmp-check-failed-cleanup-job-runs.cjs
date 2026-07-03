const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(15, Number(process.argv[2] || 360) || 360);
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const summary = await client.query(
      `
      SELECT
        COUNT(*)::int AS released_rows,
        COUNT(DISTINCT lead_id)::int AS distinct_leads_released,
        MIN(updated_at) AS first_seen,
        MAX(updated_at) AS last_seen
      FROM leasedialer_assignments
      WHERE release_reason = 'failed_call_15m_sync'
        AND updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
      `,
      [minutes]
    );

    const sample = await client.query(
      `
      SELECT id, lead_id, agent_email, status, release_reason, updated_at
      FROM leasedialer_assignments
      WHERE release_reason = 'failed_call_15m_sync'
      ORDER BY updated_at DESC
      LIMIT 20
      `
    );

    console.log(
      JSON.stringify(
        {
          window_minutes: minutes,
          summary: summary.rows[0] || {},
          recent_rows: sample.rows,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

