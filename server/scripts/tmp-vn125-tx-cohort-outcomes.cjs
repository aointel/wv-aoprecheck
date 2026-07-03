const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const day = String(process.argv[2] || "2026-05-15").trim();
  const state = String(process.argv[3] || "TX").trim().toUpperCase();
  const marker = String(process.argv[4] || "VN125").trim();

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();

  try {
    const summary = await client.query(
      `
        WITH cohort AS (
          SELECT
            ml.id,
            RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10) AS phone10,
            lower(trim(COALESCE(ml.cnresolution, 'pending'))) AS cnresolution_lc,
            lower(trim(COALESCE(ml.cn_email, ''))) AS cn_email_lc
          FROM masterlead ml
          WHERE (ml.created_at AT TIME ZONE 'America/Chicago')::date = $1::date
            AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = $2
            AND COALESCE(ml.taalk_group_code, '') ILIKE ('%' || $3 || '%')
        ),
        cohort_phones AS (
          SELECT DISTINCT phone10
          FROM cohort
          WHERE length(phone10) = 10
        ),
        calls AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            lower(COALESCE(t.call_status, '')) AS call_status_lc,
            COALESCE(NULLIF(t.parent_call_sid, ''), t.twilio_call_sid) AS call_group_sid,
            COALESCE(t.call_duration, 0) AS call_duration
          FROM twilio_call_logs t
          JOIN cohort_phones cp
            ON cp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)
          WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND t.call_started_at >= $1::date::timestamp
        )
        SELECT
          (SELECT COUNT(*)::int FROM cohort) AS leads_in_cohort,
          (SELECT COUNT(DISTINCT phone10)::int FROM cohort_phones) AS distinct_phones_in_cohort,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc IN ('pending','new','','null')) AS pending_like_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc = 'called') AS called_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc = 'no_answer') AS no_answer_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc = 'no_answer_vm') AS no_answer_vm_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc = 'wrong_number') AS wrong_number_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc = 'booked') AS booked_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc = 'appointment_set') AS appointment_set_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cnresolution_lc = 'not_interested') AS not_interested_now,
          (SELECT COUNT(*)::int FROM cohort WHERE cn_email_lc <> '') AS owned_now,
          (SELECT COUNT(*)::int FROM calls) AS outbound_call_rows,
          (SELECT COUNT(DISTINCT call_group_sid)::int FROM calls) AS outbound_call_groups,
          (SELECT COUNT(DISTINCT phone10)::int FROM calls) AS phones_dialed,
          (
            SELECT COUNT(DISTINCT phone10)::int
            FROM calls
            WHERE call_status_lc IN ('completed', 'answered')
              AND call_duration > 0
          ) AS phones_connected,
          (
            SELECT COUNT(*)::int
            FROM calls
            WHERE call_status_lc IN ('completed', 'answered')
              AND call_duration > 0
          ) AS connected_call_rows
      `,
      [day, state, marker],
    );

    const dispositionBreakdown = await client.query(
      `
        SELECT
          lower(trim(COALESCE(ml.cnresolution, 'pending'))) AS cnresolution,
          COUNT(*)::int AS leads
        FROM masterlead ml
        WHERE (ml.created_at AT TIME ZONE 'America/Chicago')::date = $1::date
          AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = $2
          AND COALESCE(ml.taalk_group_code, '') ILIKE ('%' || $3 || '%')
        GROUP BY 1
        ORDER BY leads DESC, cnresolution ASC
      `,
      [day, state, marker],
    );

    const callStatusBreakdown = await client.query(
      `
        WITH cohort_phones AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10) AS phone10
          FROM masterlead ml
          WHERE (ml.created_at AT TIME ZONE 'America/Chicago')::date = $1::date
            AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = $2
            AND COALESCE(ml.taalk_group_code, '') ILIKE ('%' || $3 || '%')
        )
        SELECT
          lower(COALESCE(t.call_status, '')) AS call_status,
          COUNT(*)::int AS call_rows,
          COUNT(DISTINCT COALESCE(NULLIF(t.parent_call_sid, ''), t.twilio_call_sid))::int AS call_groups
        FROM twilio_call_logs t
        JOIN cohort_phones cp
          ON cp.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)
        WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
          AND t.call_started_at >= $1::date::timestamp
        GROUP BY 1
        ORDER BY call_rows DESC, call_status ASC
      `,
      [day, state, marker],
    );

    console.log(
      JSON.stringify(
        {
          cohort: { day, state, marker },
          summary: summary.rows[0] || {},
          disposition_breakdown: dispositionBreakdown.rows,
          call_status_breakdown: callStatusBreakdown.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
