const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const indexes = await client.query(
      `
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('twilio_call_logs', 'leasedialer_assignments', 'masterlead', 'leasedialer_client_status')
      ORDER BY tablename, indexname
      `,
    );

    const tableStats = await client.query(
      `
      SELECT relname AS table_name, n_live_tup, n_dead_tup, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
      FROM pg_stat_user_tables
      WHERE relname IN ('twilio_call_logs', 'leasedialer_assignments', 'masterlead', 'leasedialer_client_status')
      ORDER BY relname
      `,
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          indexCount: indexes.rows.length,
          indexes: indexes.rows,
          tableStats: tableStats.rows,
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
