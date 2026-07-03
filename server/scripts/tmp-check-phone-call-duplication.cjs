const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const owner = String(process.argv[2] || "").trim().toLowerCase();
  const phone10 = String(process.argv[3] || "").replace(/\D/g, "").slice(-10);
  const days = Math.max(1, Number(process.argv[4] || 7) || 7);

  if (!owner || !owner.includes("@")) {
    throw new Error("usage: node server/scripts/tmp-check-phone-call-duplication.cjs <owner_email> <phone10> [days=7]");
  }
  if (phone10.length !== 10) {
    throw new Error("phone10 must be exactly 10 digits");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const summary = await client.query(
      `
        SELECT
          lower(coalesce(owner_email, '')) AS owner_email,
          RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) AS phone10,
          COUNT(*)::int AS rows,
          COUNT(DISTINCT twilio_call_sid)::int AS distinct_sids,
          COUNT(DISTINCT COALESCE(NULLIF(parent_call_sid, ''), twilio_call_sid))::int AS distinct_call_groups,
          MIN(call_started_at) AS first_call_started_at,
          MAX(call_started_at) AS last_call_started_at
        FROM twilio_call_logs
        WHERE lower(coalesce(owner_email, '')) = lower($1)
          AND RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) = $2
          AND call_started_at >= NOW() - ($3::int * INTERVAL '1 day')
        GROUP BY 1, 2
      `,
      [owner, phone10, days],
    );

    const perSid = await client.query(
      `
        SELECT
          twilio_call_sid,
          COALESCE(NULLIF(parent_call_sid, ''), twilio_call_sid) AS call_group_sid,
          COUNT(*)::int AS row_count_for_sid,
          MIN(call_started_at) AS first_seen,
          MAX(call_started_at) AS last_seen,
          ARRAY_AGG(DISTINCT lower(coalesce(call_status, ''))) AS statuses
        FROM twilio_call_logs
        WHERE lower(coalesce(owner_email, '')) = lower($1)
          AND RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) = $2
          AND call_started_at >= NOW() - ($3::int * INTERVAL '1 day')
        GROUP BY 1, 2
        ORDER BY last_seen DESC
        LIMIT 50
      `,
      [owner, phone10, days],
    );

    console.log(
      JSON.stringify(
        {
          owner,
          phone10,
          days,
          summary: summary.rows[0] || null,
          sid_rows: perSid.rows,
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

