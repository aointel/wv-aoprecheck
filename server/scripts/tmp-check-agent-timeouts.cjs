const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TIMEOUT_STATUSES = ["no-answer", "no_answer", "failed"];

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const hours = Number(process.argv[3] || 72);
  const topN = Number(process.argv[4] || 25);
  if (!email || !email.includes("@")) {
    throw new Error(
      "usage: node server/scripts/tmp-check-agent-timeouts.cjs <agentEmail> [hours=72] [topN=25]",
    );
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const summaryResult = await client.query(
      `
        WITH scoped AS (
          SELECT
            lower(coalesce(call_status, '')) AS status_lc,
            RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            COALESCE(
              NULLIF(lead_id::text, ''),
              NULLIF(taalk_lead_id::text, ''),
              NULLIF(metadata->>'lead_id', ''),
              NULLIF(metadata->>'taalk_lead_id', '')
            ) AS lead_key
          FROM twilio_call_logs
          WHERE lower(owner_email) = lower($1)
            AND call_started_at >= (NOW() - ($2::int * INTERVAL '1 hour'))
            AND lower(coalesce(call_direction, '')) LIKE 'outbound%'
        )
        SELECT
          COUNT(*)::int AS total_outbound_attempts,
          COUNT(*) FILTER (WHERE status_lc = ANY($3::text[]))::int AS timeout_like_attempts,
          COUNT(DISTINCT phone10) FILTER (WHERE status_lc = ANY($3::text[]) AND length(phone10) = 10)::int AS timeout_distinct_phones,
          COUNT(DISTINCT lead_key) FILTER (WHERE status_lc = ANY($3::text[]) AND lead_key IS NOT NULL)::int AS timeout_distinct_leads
        FROM scoped
      `,
      [email, hours, TIMEOUT_STATUSES],
    );

    const topPhones = await client.query(
      `
        SELECT
          phone10,
          COUNT(*)::int AS timeout_count,
          MAX(call_started_at) AS last_timeout_at
        FROM (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            call_started_at
          FROM twilio_call_logs
          WHERE lower(owner_email) = lower($1)
            AND call_started_at >= (NOW() - ($2::int * INTERVAL '1 hour'))
            AND lower(coalesce(call_direction, '')) LIKE 'outbound%'
            AND lower(coalesce(call_status, '')) = ANY($3::text[])
        ) t
        WHERE length(phone10) = 10
        GROUP BY phone10
        HAVING COUNT(*) >= 2
        ORDER BY timeout_count DESC, last_timeout_at DESC
        LIMIT $4
      `,
      [email, hours, TIMEOUT_STATUSES, topN],
    );

    const topLeads = await client.query(
      `
        SELECT
          lead_key,
          COUNT(*)::int AS timeout_count,
          MAX(call_started_at) AS last_timeout_at
        FROM (
          SELECT
            COALESCE(
              NULLIF(lead_id::text, ''),
              NULLIF(taalk_lead_id::text, ''),
              NULLIF(metadata->>'lead_id', ''),
              NULLIF(metadata->>'taalk_lead_id', '')
            ) AS lead_key,
            call_started_at
          FROM twilio_call_logs
          WHERE lower(owner_email) = lower($1)
            AND call_started_at >= (NOW() - ($2::int * INTERVAL '1 hour'))
            AND lower(coalesce(call_direction, '')) LIKE 'outbound%'
            AND lower(coalesce(call_status, '')) = ANY($3::text[])
        ) t
        WHERE lead_key IS NOT NULL
        GROUP BY lead_key
        HAVING COUNT(*) >= 2
        ORDER BY timeout_count DESC, last_timeout_at DESC
        LIMIT $4
      `,
      [email, hours, TIMEOUT_STATUSES, topN],
    );

    console.log(
      JSON.stringify(
        {
          email,
          hours,
          timeout_statuses: TIMEOUT_STATUSES,
          summary: summaryResult.rows[0] || {},
          top_timeout_phones: topPhones.rows,
          top_timeout_leads: topLeads.rows,
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
