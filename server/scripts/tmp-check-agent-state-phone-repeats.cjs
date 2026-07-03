const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function normalizeState(value) {
  return String(value || "").trim().toUpperCase();
}

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const state = normalizeState(process.argv[3] || "NM");
  const days = Math.max(1, Number(process.argv[4] || 7) || 7);
  const topN = Math.max(1, Number(process.argv[5] || 25) || 25);

  if (!email || !email.includes("@")) {
    throw new Error(
      "usage: node server/scripts/tmp-check-agent-state-phone-repeats.cjs <agentEmail> [state=NM] [days=7] [topN=25]",
    );
  }
  if (state.length !== 2) {
    throw new Error("state must be a 2-letter code");
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
        WITH calls AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            lower(COALESCE(t.call_status, '')) AS status_lc,
            COALESCE(
              NULLIF(t.lead_id::text, ''),
              NULLIF(t.taalk_lead_id::text, ''),
              NULLIF(t.metadata->>'lead_id', ''),
              NULLIF(t.metadata->>'taalk_lead_id', '')
            ) AS lead_key,
            t.call_started_at
          FROM twilio_call_logs t
          WHERE lower(t.owner_email) = lower($1)
            AND t.call_started_at >= NOW() - ($2::int * INTERVAL '1 day')
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
        ),
        nm_phone AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10) AS phone10
          FROM masterlead ml
          WHERE COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = $3
        ),
        scoped AS (
          SELECT c.*
          FROM calls c
          JOIN nm_phone np ON np.phone10 = c.phone10
          WHERE length(c.phone10) = 10
        )
        SELECT
          COUNT(*)::int AS total_nm_call_attempts,
          COUNT(DISTINCT phone10)::int AS distinct_nm_phones_called,
          COUNT(DISTINCT lead_key) FILTER (WHERE lead_key IS NOT NULL)::int AS distinct_nm_lead_keys_called,
          COUNT(*) FILTER (WHERE status_lc = 'failed')::int AS failed_nm_call_attempts,
          COUNT(DISTINCT phone10) FILTER (WHERE status_lc = 'failed')::int AS failed_nm_distinct_phones,
          COUNT(*) FILTER (
            WHERE phone10 IN (
              SELECT phone10 FROM scoped GROUP BY phone10 HAVING COUNT(*) >= 2
            )
          )::int AS attempts_on_repeat_phones,
          COUNT(*) FILTER (
            WHERE status_lc = 'failed'
              AND phone10 IN (
                SELECT phone10 FROM scoped WHERE status_lc = 'failed' GROUP BY phone10 HAVING COUNT(*) >= 2
              )
          )::int AS failed_attempts_on_repeat_phones
        FROM scoped
      `,
      [email, days, state],
    );

    const topPhones = await client.query(
      `
        WITH calls AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            lower(COALESCE(t.call_status, '')) AS status_lc,
            COALESCE(
              NULLIF(t.lead_id::text, ''),
              NULLIF(t.taalk_lead_id::text, ''),
              NULLIF(t.metadata->>'lead_id', ''),
              NULLIF(t.metadata->>'taalk_lead_id', '')
            ) AS lead_key,
            t.call_started_at
          FROM twilio_call_logs t
          WHERE lower(t.owner_email) = lower($1)
            AND t.call_started_at >= NOW() - ($2::int * INTERVAL '1 day')
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
        ),
        nm_phone AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10) AS phone10
          FROM masterlead ml
          WHERE COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = $3
        ),
        scoped AS (
          SELECT c.*
          FROM calls c
          JOIN nm_phone np ON np.phone10 = c.phone10
          WHERE length(c.phone10) = 10
        )
        SELECT
          phone10,
          COUNT(*)::int AS call_attempts,
          COUNT(DISTINCT lead_key) FILTER (WHERE lead_key IS NOT NULL)::int AS distinct_lead_keys,
          MAX(call_started_at) AS last_called_at
        FROM scoped
        GROUP BY phone10
        HAVING COUNT(*) >= 2
        ORDER BY call_attempts DESC, last_called_at DESC
        LIMIT $4
      `,
      [email, days, state, topN],
    );
    const topFailedPhones = await client.query(
      `
        WITH calls AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            lower(COALESCE(t.call_status, '')) AS status_lc,
            t.call_started_at
          FROM twilio_call_logs t
          WHERE lower(t.owner_email) = lower($1)
            AND t.call_started_at >= NOW() - ($2::int * INTERVAL '1 day')
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
        ),
        nm_phone AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10) AS phone10
          FROM masterlead ml
          WHERE COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = $3
        ),
        scoped AS (
          SELECT c.*
          FROM calls c
          JOIN nm_phone np ON np.phone10 = c.phone10
          WHERE length(c.phone10) = 10
            AND c.status_lc = 'failed'
        )
        SELECT
          phone10,
          COUNT(*)::int AS failed_attempts,
          MAX(call_started_at) AS last_failed_at
        FROM scoped
        GROUP BY phone10
        HAVING COUNT(*) >= 1
        ORDER BY failed_attempts DESC, last_failed_at DESC
        LIMIT $4
      `,
      [email, days, state, topN],
    );

    console.log(
      JSON.stringify(
        {
          email,
          state,
          days,
          summary: summary.rows[0] || {},
          top_repeat_phones: topPhones.rows,
          top_failed_phones: topFailedPhones.rows,
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
