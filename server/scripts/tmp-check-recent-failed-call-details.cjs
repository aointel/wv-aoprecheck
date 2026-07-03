const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const cols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='twilio_call_logs'
      ORDER BY ordinal_position
    `);

    const rows = await client.query(`
      SELECT twilio_call_sid, owner_email, from_number, to_number, call_status, call_direction, call_started_at, metadata
      FROM twilio_call_logs
      WHERE lower(coalesce(call_status,'')) = 'failed'
        AND call_started_at >= NOW() - INTERVAL '2 hours'
      ORDER BY call_started_at DESC
      LIMIT 25
    `);

    console.log(JSON.stringify({
      columns: cols.rows.map(r => r.column_name),
      sample_failed_2h: rows.rows
    }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

