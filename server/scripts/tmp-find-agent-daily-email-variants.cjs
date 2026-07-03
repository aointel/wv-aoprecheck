const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const term = String(process.argv[2] || "johnavila").toLowerCase().trim();
  const day = String(process.argv[3] || "2026-05-06").trim();
  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const res = await client.query(
      `
        SELECT agent_email, dials, reached, booked, instants, updated_at
        FROM agent_daily_stats
        WHERE stat_date = $2::date
          AND lower(agent_email) LIKE $1
        ORDER BY dials DESC, updated_at DESC
      `,
      [`%${term}%`, day],
    );
    console.log(JSON.stringify({ term, day, rows: res.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
