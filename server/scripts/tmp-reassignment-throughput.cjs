const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const hours = Math.max(1, Number(process.argv[2] || 6));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 45000,
    query_timeout: 45000,
  });
  await client.connect();
  try {
    const res = await client.query(
      `
        SELECT
          release_reason,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '30 minutes')::int AS last_30m,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '1 hour')::int AS last_1h,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '6 hours')::int AS last_6h,
          MAX(updated_at) AS latest_updated_at
        FROM leasedialer_assignments
        WHERE release_reason IN (
          'idle_no_recent_dial_reclaim',
          'hourly_stale_queue_sweeper',
          'hourly_bad_queue_sweeper',
          'stale_lease_cleanup'
        )
          AND updated_at >= NOW() - ($1::int * INTERVAL '1 hour')
        GROUP BY release_reason
        ORDER BY last_6h DESC, release_reason ASC
      `,
      [hours],
    );
    console.log(JSON.stringify({ ranAt: new Date().toISOString(), lookbackHours: hours, reasons: res.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
