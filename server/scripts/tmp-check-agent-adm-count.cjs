const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "").toLowerCase().trim();
  const day = String(process.argv[3] || "2026-05-06").trim();
  if (!email.includes("@")) throw new Error("Usage: node tmp-check-agent-adm-count.cjs <email> <YYYY-MM-DD>");

  const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 120000, query_timeout: 120000 });
  await client.connect();
  try {
    const res = await client.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'dial')::int AS dials,
          COUNT(*) FILTER (WHERE event_type = 'reach')::int AS reaches,
          COUNT(DISTINCT call_sid) FILTER (WHERE event_type = 'dial')::int AS unique_dial_sids,
          MAX(event_timestamp) AS latest_event_at
        FROM agent_dial_metrics
        WHERE lower(agent_email) = lower($1)
          AND event_timestamp >= ((($2::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')
          AND event_timestamp < ((((($2::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours'))
      `,
      [email, day],
    );

    console.log(JSON.stringify({ email, day, adm: res.rows[0] || null }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
