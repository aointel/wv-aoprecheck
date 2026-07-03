const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const AGENTS = [
  "drewsharp@aoglobelife.com",
  "daultonbutler@aoglobelife.com",
  "shaneculbert@aoglobelife.com",
  "kingsleyibeh@aoglobelife.com",
  "kennethhollobaugh@aoglobelife.com",
  "nathaliabrennan@aoglobelife.com",
  "ankitadas@aoglobelife.com",
  "emilyrogers@aoglobelife.com",
];

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
        WITH target_agents AS (
          SELECT unnest($1::text[]) AS agent_email
        ),
        rollup AS (
          SELECT
            lower(adm.agent_email) AS agent_email,
            MAX(adm.event_timestamp) FILTER (WHERE adm.event_type = 'dial') AS last_dial_at,
            COUNT(*) FILTER (
              WHERE adm.event_type = 'dial'
                AND adm.event_timestamp >= NOW() - INTERVAL '1 hour'
            )::int AS dials_last_hour,
            COUNT(*) FILTER (
              WHERE adm.event_type = 'dial'
                AND adm.event_timestamp >= NOW() - INTERVAL '4 hours'
            )::int AS dials_last_4h,
            COUNT(*) FILTER (
              WHERE adm.event_type = 'dial'
                AND adm.event_timestamp >= NOW() - INTERVAL '24 hours'
            )::int AS dials_last_24h
          FROM agent_dial_metrics adm
          WHERE lower(adm.agent_email) = ANY($1::text[])
          GROUP BY lower(adm.agent_email)
        )
        SELECT
          ta.agent_email,
          r.last_dial_at,
          COALESCE(r.dials_last_hour, 0) AS dials_last_hour,
          COALESCE(r.dials_last_4h, 0) AS dials_last_4h,
          COALESCE(r.dials_last_24h, 0) AS dials_last_24h
        FROM target_agents ta
        LEFT JOIN rollup r ON r.agent_email = lower(ta.agent_email)
        ORDER BY ta.agent_email ASC
      `,
      [AGENTS.map((e) => e.toLowerCase())],
    );

    console.log(JSON.stringify({ checked_at: new Date().toISOString(), rows: result.rows }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
