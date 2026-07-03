const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const days = Math.max(1, Number(process.argv[2] || 7) || 7);
  const phones = process.argv
    .slice(3)
    .map((p) => String(p || "").replace(/\D/g, "").slice(-10))
    .filter((p) => p.length === 10);

  if (phones.length === 0) {
    throw new Error(
      "usage: node server/scripts/tmp-check-recover-phones.cjs [days=7] <phone10> <phone10> ...",
    );
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
        WITH target AS (
          SELECT unnest($1::text[]) AS phone10
        ),
        failed AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10,
            COUNT(*)::int AS failed_7d
          FROM twilio_call_logs t
          WHERE lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND lower(COALESCE(t.call_status, '')) = 'failed'
            AND t.call_started_at >= NOW() - ($2::int * INTERVAL '1 day')
          GROUP BY 1
        ),
        lead_stats AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) AS phone10,
            COUNT(*)::int AS masterlead_rows,
            COUNT(*) FILTER (
              WHERE lower(trim(COALESCE(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            )::int AS pending_rows,
            COUNT(*) FILTER (
              WHERE lower(trim(COALESCE(ml.cnresolution, ''))) = 'wrong_number'
            )::int AS wrong_number_rows,
            COUNT(*) FILTER (
              WHERE lower(trim(COALESCE(ml.cnresolution, ''))) = 'wrong_number'
                AND ml.updated_at >= NOW() - INTERVAL '3 hours'
            )::int AS wrong_number_recent_3h
          FROM masterlead ml
          GROUP BY 1
        ),
        assignment_stats AS (
          SELECT
            RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) AS phone10,
            COUNT(*) FILTER (WHERE la.status IN ('queued', 'active'))::int AS queued_active_assignments,
            COUNT(*) FILTER (WHERE la.status = 'queued')::int AS queued_assignments
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          GROUP BY 1
        )
        SELECT
          t.phone10,
          COALESCE(f.failed_7d, 0) AS failed_7d,
          (COALESCE(f.failed_7d, 0) >= 2) AS met_failed_ge_2_rule,
          COALESCE(l.masterlead_rows, 0) AS masterlead_rows,
          COALESCE(l.pending_rows, 0) AS pending_rows,
          COALESCE(l.wrong_number_rows, 0) AS wrong_number_rows,
          COALESCE(l.wrong_number_recent_3h, 0) AS wrong_number_recent_3h,
          COALESCE(a.queued_active_assignments, 0) AS queued_active_assignments,
          COALESCE(a.queued_assignments, 0) AS queued_assignments
        FROM target t
        LEFT JOIN failed f ON f.phone10 = t.phone10
        LEFT JOIN lead_stats l ON l.phone10 = t.phone10
        LEFT JOIN assignment_stats a ON a.phone10 = t.phone10
        ORDER BY t.phone10
      `,
      [phones, days],
    );

    console.log(
      JSON.stringify(
        {
          days,
          phones,
          rows: result.rows,
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
