const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const phone10 = String(process.argv[3] || "").replace(/\D/g, "").slice(-10);
  const days = Math.max(1, Number(process.argv[4] || 7) || 7);

  if (!email.includes("@")) {
    throw new Error(
      "usage: node server/scripts/tmp-debug-agent-phone-presentation.cjs <agentEmail> <phone10> [days=7]",
    );
  }
  if (phone10.length !== 10) {
    throw new Error("phone10 must be 10 digits");
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
            twilio_call_sid,
            parent_call_sid,
            call_started_at,
            lower(COALESCE(call_status, '')) AS call_status_lc
          FROM twilio_call_logs
          WHERE lower(owner_email) = lower($1)
            AND lower(COALESCE(call_direction, '')) LIKE 'outbound%'
            AND call_started_at >= NOW() - ($3::int * INTERVAL '1 day')
            AND RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) = $2
        ),
        assignments AS (
          SELECT
            la.id,
            la.lead_id,
            la.status,
            la.created_at,
            la.assigned_at,
            la.updated_at,
            la.release_reason
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE lower(la.agent_email) = lower($1)
            AND la.created_at >= NOW() - ($3::int * INTERVAL '1 day')
            AND RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) = $2
        )
        SELECT
          (SELECT COUNT(*)::int FROM calls) AS call_rows,
          (SELECT COUNT(DISTINCT twilio_call_sid)::int FROM calls) AS distinct_call_sids,
          (SELECT COUNT(DISTINCT COALESCE(NULLIF(parent_call_sid, ''), twilio_call_sid))::int FROM calls) AS distinct_call_groups,
          (
            SELECT COALESCE(json_object_agg(call_status_lc, cnt), '{}'::json)
            FROM (
              SELECT call_status_lc, COUNT(*)::int AS cnt
              FROM calls
              GROUP BY call_status_lc
            ) s
          ) AS call_status_breakdown,
          (SELECT COUNT(*)::int FROM assignments) AS assignment_rows,
          (SELECT COUNT(DISTINCT lead_id)::int FROM assignments) AS distinct_lead_ids_assigned,
          (
            SELECT COALESCE(json_object_agg(status, cnt), '{}'::json)
            FROM (
              SELECT status, COUNT(*)::int AS cnt
              FROM assignments
              GROUP BY status
            ) a
          ) AS assignment_status_breakdown
      `,
      [email, phone10, days],
    );

    const recentAssignments = await client.query(
      `
        SELECT
          la.id,
          la.lead_id,
          la.status,
          la.created_at,
          la.assigned_at,
          la.updated_at,
          la.release_reason,
          ml.cnresolution,
          ml.cn_email
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.created_at >= NOW() - ($3::int * INTERVAL '1 day')
          AND RIGHT(REGEXP_REPLACE(COALESCE(ml.phone, ''), '\\D', '', 'g'), 10) = $2
        ORDER BY la.created_at DESC, la.id DESC
        LIMIT 20
      `,
      [email, phone10, days],
    );

    const recentCalls = await client.query(
      `
        SELECT
          twilio_call_sid,
          parent_call_sid,
          call_started_at,
          call_status,
          call_duration,
          from_number,
          to_number
        FROM twilio_call_logs
        WHERE lower(owner_email) = lower($1)
          AND lower(COALESCE(call_direction, '')) LIKE 'outbound%'
          AND call_started_at >= NOW() - ($3::int * INTERVAL '1 day')
          AND RIGHT(REGEXP_REPLACE(COALESCE(to_number, ''), '\\D', '', 'g'), 10) = $2
        ORDER BY call_started_at DESC, id DESC
        LIMIT 30
      `,
      [email, phone10, days],
    );

    console.log(
      JSON.stringify(
        {
          email,
          phone10,
          days,
          summary: summary.rows[0] || {},
          recent_assignments: recentAssignments.rows,
          recent_calls: recentCalls.rows,
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
