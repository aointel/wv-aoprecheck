const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const dialsPerAgent = Math.max(1, Number(process.argv[3] || 300));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const result = await client.query(
      `
      WITH bounds AS (
        SELECT
          (((now() AT TIME ZONE $1)::date)::timestamp AT TIME ZONE $1) AS start_ts,
          ((((now() AT TIME ZONE $1)::date + 1)::timestamp) AT TIME ZONE $1) AS end_ts
      ),
      latest_profiles AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      globe_agents AS (
        SELECT lp.agent_email
        FROM latest_profiles lp
        WHERE EXISTS (
          SELECT 1
          FROM unnest(COALESCE(lp.markets, ARRAY[]::text[])) m
          WHERE lower(regexp_replace(m, '\\s+', '', 'g')) LIKE '%globe%'
        )
      ),
      unique_globe_callers_today AS (
        SELECT COUNT(DISTINCT lower(adm.agent_email))::int AS cnt
        FROM agent_dial_metrics adm
        CROSS JOIN bounds b
        JOIN globe_agents ga ON ga.agent_email = lower(adm.agent_email)
        WHERE lower(trim(coalesce(adm.event_type, ''))) = 'dial'
          AND adm.event_timestamp >= b.start_ts
          AND adm.event_timestamp < b.end_ts
      ),
      active_assignments AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued', 'active')
      ),
      globe_callable AS (
        SELECT
          ml.id,
          COALESCE(NULLIF(btrim(ml.cn_email), ''), '') AS owner_email,
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN true
            ELSE false
          END AS is_globe
        FROM masterlead ml
        WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
      ),
      pool AS (
        SELECT gc.id
        FROM globe_callable gc
        LEFT JOIN active_assignments a ON a.lead_id = gc.id
        WHERE gc.is_globe = true
          AND gc.owner_email = ''
          AND a.lead_id IS NULL
      ),
      owned_not_queued AS (
        SELECT gc.id
        FROM globe_callable gc
        LEFT JOIN active_assignments a ON a.lead_id = gc.id
        WHERE gc.is_globe = true
          AND gc.owner_email <> ''
          AND a.lead_id IS NULL
      ),
      queued_or_active AS (
        SELECT gc.id
        FROM globe_callable gc
        JOIN active_assignments a ON a.lead_id = gc.id
        WHERE gc.is_globe = true
      ),
      total_globe_callable AS (
        SELECT COUNT(*)::int AS cnt
        FROM globe_callable gc
        WHERE gc.is_globe = true
      )
      SELECT
        (SELECT cnt FROM unique_globe_callers_today) AS unique_globe_callers_today,
        (SELECT COUNT(*)::int FROM pool) AS unowned_unqueued_callable_pool,
        (SELECT COUNT(*)::int FROM owned_not_queued) AS owned_not_queued_callable,
        (SELECT COUNT(*)::int FROM queued_or_active) AS queued_or_active_callable,
        (SELECT cnt FROM total_globe_callable) AS total_globe_callable
      `
      ,
      [timezone],
    );

    const row = result.rows[0] || {};
    const callers = Number(row.unique_globe_callers_today || 0);
    const pool = Number(row.unowned_unqueued_callable_pool || 0);
    const neededAtTarget = callers * dialsPerAgent;
    const deficit = Math.max(0, neededAtTarget - pool);

    console.log(
      JSON.stringify(
        {
          timezone,
          assumptions: {
            dials_per_agent: dialsPerAgent,
            consumption_model: "1 callable lead consumed per dial",
          },
          counts: {
            unique_globe_callers_today: callers,
            unowned_unqueued_callable_pool: pool,
            owned_not_queued_callable: Number(row.owned_not_queued_callable || 0),
            queued_or_active_callable: Number(row.queued_or_active_callable || 0),
            total_globe_callable: Number(row.total_globe_callable || 0),
          },
          capacity: {
            required_callable_to_keep_fed: neededAtTarget,
            max_agents_supported_at_target_dials: Math.floor(pool / dialsPerAgent),
            deficit_callable: deficit,
            can_keep_all_fed: deficit === 0,
          },
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
