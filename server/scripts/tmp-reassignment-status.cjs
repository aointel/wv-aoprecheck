const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const idleMinutes = Math.max(15, Number(process.argv[2] || 120));
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const reassignments = await client.query(
      `
        SELECT
          release_reason,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '1 hour')::int AS last_1h,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '6 hours')::int AS last_6h,
          COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '24 hours')::int AS last_24h,
          MAX(updated_at) AS latest_updated_at
        FROM leasedialer_assignments
        WHERE release_reason IN (
          'idle_no_recent_dial_reclaim',
          'hourly_stale_queue_sweeper',
          'hourly_bad_queue_sweeper',
          'stale_lease_cleanup'
        )
          AND updated_at >= NOW() - INTERVAL '24 hours'
        GROUP BY release_reason
        ORDER BY last_24h DESC, release_reason ASC
      `,
    );

    const queueNow = await client.query(
      `
        WITH active_assignment_agents AS (
          SELECT DISTINCT lower(la.agent_email) AS agent_email
          FROM leasedialer_assignments la
          WHERE la.status IN ('queued', 'active')
            AND la.queue = 'hotlead'
        ),
        agent_last_dial AS (
          SELECT aaa.agent_email, MAX(adm.event_timestamp) AS last_dial_at
          FROM active_assignment_agents aaa
          LEFT JOIN agent_dial_metrics adm
            ON lower(adm.agent_email) = aaa.agent_email
           AND adm.event_type = 'dial'
          GROUP BY aaa.agent_email
        )
        SELECT
          COUNT(*)::int AS callable_total,
          COUNT(*) FILTER (
            WHERE ald.last_dial_at IS NULL
               OR ald.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
          )::int AS callable_held_by_idle,
          COUNT(DISTINCT lower(la.agent_email))::int AS holder_agents,
          COUNT(DISTINCT lower(la.agent_email)) FILTER (
            WHERE ald.last_dial_at IS NULL
               OR ald.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
          )::int AS idle_holder_agents
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        LEFT JOIN agent_last_dial ald ON ald.agent_email = lower(la.agent_email)
        WHERE la.status IN ('queued', 'active')
          AND la.queue = 'hotlead'
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (
            COALESCE(btrim(ml.cn_email), '') = ''
            OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
          )
      `,
      [idleMinutes],
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          idleMinutes,
          reassignment_release_reasons: reassignments.rows,
          queue_status_now: queueNow.rows[0] || null,
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
