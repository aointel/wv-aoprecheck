const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "").toLowerCase().trim();
  const day = String(process.argv[3] || "").trim();
  if (!email.includes("@")) {
    throw new Error(
      "Usage: node server/scripts/tmp-check-agent-today-unique-leads.cjs <email> <YYYY-MM-DD>",
    );
  }
  if (!day.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error("day must be YYYY-MM-DD");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const result = await client.query(
      `
        WITH w AS (
          SELECT
            ((($2::date)::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours') AS start_utc,
            ((((($2::date + 1))::timestamp AT TIME ZONE 'America/New_York') + interval '6 hours')) AS end_utc
        ),
        received AS (
          SELECT
            COUNT(*)::int AS assignment_rows,
            COUNT(DISTINCT la.lead_id)::int AS unique_leads_received
          FROM leasedialer_assignments la
          CROSS JOIN w
          WHERE lower(la.agent_email) = lower($1)
            AND la.assigned_at >= w.start_utc
            AND la.assigned_at < w.end_utc
        ),
        called AS (
          SELECT
            COUNT(*)::int AS call_rows,
            COUNT(DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) FILTER (
              WHERE length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
            )::int AS unique_phones_called,
            COUNT(DISTINCT COALESCE(
              NULLIF(t.lead_id::text, ''),
              NULLIF(t.taalk_lead_id::text, ''),
              NULLIF(t.metadata->>'lead_id', ''),
              NULLIF(t.metadata->>'taalk_lead_id', '')
            ))::int AS unique_lead_keys_called
          FROM twilio_call_logs t
          CROSS JOIN w
          WHERE lower(t.owner_email) = lower($1)
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND t.call_started_at >= w.start_utc
            AND t.call_started_at < w.end_utc
        )
        SELECT
          (SELECT assignment_rows FROM received) AS assignment_rows,
          (SELECT unique_leads_received FROM received) AS unique_leads_received,
          (SELECT call_rows FROM called) AS call_rows,
          (SELECT unique_phones_called FROM called) AS unique_phones_called,
          (SELECT unique_lead_keys_called FROM called) AS unique_lead_keys_called
      `,
      [email, day],
    );

    console.log(
      JSON.stringify(
        {
          email,
          day,
          metrics: result.rows[0] || {},
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
