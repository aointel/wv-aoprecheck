const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const minutes = Math.max(5, Number(process.argv[2] || 60) || 60);
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const snapshot = await client.query(
      `
        WITH failed_calls AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            COALESCE(NULLIF(t.parent_call_sid, ''), t.twilio_call_sid) AS call_group_sid,
            t.call_started_at
          FROM twilio_call_logs t
          WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND lower(COALESCE(t.call_status, '')) = 'failed'
            AND t.call_started_at >= NOW() - ($1::int * INTERVAL '1 minute')
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
        ),
        failed_phones AS (
          SELECT DISTINCT phone10
          FROM failed_calls
        ),
        lead_state AS (
          SELECT
            fp.phone10,
            COUNT(*)::int AS total_masterlead_rows,
            COUNT(*) FILTER (WHERE lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending','new','','null'))::int AS pending_rows,
            COUNT(*) FILTER (WHERE lower(trim(COALESCE(ml.cnresolution, ''))) = 'no_answer')::int AS no_answer_rows,
            COUNT(*) FILTER (WHERE lower(trim(COALESCE(ml.cnresolution, ''))) = 'wrong_number')::int AS wrong_number_rows,
            COUNT(*) FILTER (
              WHERE lower(trim(COALESCE(ml.cnresolution, ''))) IN ('no_answer', 'wrong_number')
                AND ml.updated_at >= NOW() - INTERVAL '2 hours'
            )::int AS handled_recent_rows
          FROM failed_phones fp
          LEFT JOIN masterlead ml
            ON RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) = fp.phone10
          GROUP BY fp.phone10
        ),
        queue_state AS (
          SELECT
            fp.phone10,
            COUNT(*) FILTER (WHERE la.status IN ('queued','active'))::int AS queued_active_assignments
          FROM failed_phones fp
          LEFT JOIN masterlead ml
            ON RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) = fp.phone10
          LEFT JOIN leasedialer_assignments la
            ON la.lead_id = ml.id
          GROUP BY fp.phone10
        )
        SELECT
          (SELECT COUNT(*)::int FROM failed_calls) AS failed_call_rows_window,
          (SELECT COUNT(DISTINCT call_group_sid)::int FROM failed_calls) AS failed_call_groups_window,
          (SELECT COUNT(*)::int FROM failed_phones) AS failed_distinct_phones_window,
          (SELECT COUNT(*)::int FROM lead_state WHERE handled_recent_rows > 0) AS failed_phones_with_recent_handling,
          (SELECT COUNT(*)::int FROM lead_state WHERE pending_rows > 0) AS failed_phones_still_pending,
          (SELECT COUNT(*)::int FROM queue_state WHERE queued_active_assignments > 0) AS failed_phones_still_in_queue
      `,
      [minutes],
    );

    const sample = await client.query(
      `
        WITH failed_phones AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10
          FROM twilio_call_logs t
          WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND lower(COALESCE(t.call_status, '')) = 'failed'
            AND t.call_started_at >= NOW() - ($1::int * INTERVAL '1 minute')
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
          LIMIT 40
        )
        SELECT
          fp.phone10,
          COUNT(*) FILTER (WHERE lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending','new','','null'))::int AS pending_rows,
          COUNT(*) FILTER (WHERE lower(trim(COALESCE(ml.cnresolution, ''))) = 'no_answer')::int AS no_answer_rows,
          COUNT(*) FILTER (WHERE lower(trim(COALESCE(ml.cnresolution, ''))) = 'wrong_number')::int AS wrong_number_rows,
          COUNT(*) FILTER (WHERE la.status IN ('queued','active'))::int AS queued_active_assignments
        FROM failed_phones fp
        LEFT JOIN masterlead ml
          ON RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) = fp.phone10
        LEFT JOIN leasedialer_assignments la
          ON la.lead_id = ml.id
        GROUP BY fp.phone10
        ORDER BY queued_active_assignments DESC, pending_rows DESC, fp.phone10
        LIMIT 20
      `,
      [minutes],
    );

    console.log(
      JSON.stringify(
        {
          window_minutes: minutes,
          summary: snapshot.rows[0] || {},
          sample_phones: sample.rows,
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
