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
    const rows = await client.query(
      `
        SELECT
          (created_at AT TIME ZONE 'America/Chicago')::date AS day_ct,
          COALESCE(NULLIF(upper(btrim(taalk_state::text)), ''), NULLIF(upper(btrim(state::text)), ''), '??') AS state,
          COUNT(*)::int AS leads
        FROM masterlead
        WHERE created_at >= NOW() - INTERVAL '72 hours'
          AND taalk_group_code ILIKE '%VN125%'
        GROUP BY 1, 2
        ORDER BY day_ct DESC, leads DESC, state ASC
      `,
    );
    console.log(JSON.stringify({ rows: rows.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
