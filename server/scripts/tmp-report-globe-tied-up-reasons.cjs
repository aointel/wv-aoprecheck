const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const idleMinutes = Math.max(1, Math.min(7 * 24 * 60, Number(process.argv[2] || 120)));
  const topN = Math.max(1, Math.min(200, Number(process.argv[3] || 40)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const reasonBreakdown = await client.query(
      `
      WITH scoped AS (
        SELECT
          la.id AS assignment_id,
          lower(la.agent_email) AS agent_email,
          ml.id AS lead_id,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), ''), 'UNKNOWN') AS state,
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS canonical_market,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
          COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id,
          lower(COALESCE(btrim(ml.cn_email), '')) AS lead_owner_email
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
      ),
      globe_callable AS (
        SELECT *
        FROM scoped
        WHERE canonical_market = 'Globe Market'
          AND norm_resolution IN ('pending', 'new', '', 'null')
          AND taalk_lead_id <> ''
      ),
      agents AS (
        SELECT DISTINCT agent_email FROM globe_callable
      ),
      last_dials AS (
        SELECT lower(adm.agent_email) AS agent_email, MAX(adm.event_timestamp) AS last_dial_at
        FROM agent_dial_metrics adm
        JOIN agents a ON a.agent_email = lower(adm.agent_email)
        WHERE adm.event_type = 'dial'
        GROUP BY lower(adm.agent_email)
      ),
      prof AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets,
          states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      scored AS (
        SELECT
          g.*,
          d.last_dial_at,
          p.markets,
          p.states,
          CASE
            WHEN p.agent_email IS NULL THEN 'missing_routing_profile'
            WHEN array_length(p.states, 1) IS NULL OR array_length(p.markets, 1) IS NULL THEN 'empty_routing_profile'
            WHEN g.state !~ '^[A-Z]{2}$' THEN 'invalid_state_format'
            WHEN g.lead_owner_email <> '' AND g.lead_owner_email <> g.agent_email THEN 'owner_mismatch'
            WHEN g.state <> ALL(ARRAY(SELECT upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) FROM unnest(p.states) s)) THEN 'profile_state_mismatch'
            WHEN g.canonical_market <> ALL(p.markets) THEN 'profile_market_mismatch'
            WHEN d.last_dial_at IS NULL OR d.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute') THEN 'held_by_idle_agent'
            ELSE 'held_by_recently_active_agent'
          END AS tie_reason
        FROM globe_callable g
        LEFT JOIN last_dials d ON d.agent_email = g.agent_email
        LEFT JOIN prof p ON p.agent_email = g.agent_email
      )
      SELECT tie_reason, COUNT(*)::int AS lead_count
      FROM scored
      GROUP BY tie_reason
      ORDER BY lead_count DESC, tie_reason ASC
      `,
      [idleMinutes],
    );

    const topAgents = await client.query(
      `
      WITH scoped AS (
        SELECT
          lower(la.agent_email) AS agent_email,
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS canonical_market,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS norm_resolution,
          COALESCE(btrim(ml.taalk_lead_id::text), '') AS taalk_lead_id
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
      ),
      globe_callable AS (
        SELECT *
        FROM scoped
        WHERE canonical_market = 'Globe Market'
          AND norm_resolution IN ('pending', 'new', '', 'null')
          AND taalk_lead_id <> ''
      ),
      last_dials AS (
        SELECT lower(agent_email) AS agent_email, MAX(event_timestamp) AS last_dial_at
        FROM agent_dial_metrics
        WHERE event_type = 'dial'
        GROUP BY lower(agent_email)
      )
      SELECT
        g.agent_email,
        COUNT(*)::int AS tied_count,
        d.last_dial_at,
        CASE
          WHEN d.last_dial_at IS NULL OR d.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute') THEN true
          ELSE false
        END AS idle_holder
      FROM globe_callable g
      LEFT JOIN last_dials d ON d.agent_email = g.agent_email
      GROUP BY g.agent_email, d.last_dial_at
      ORDER BY tied_count DESC, g.agent_email ASC
      LIMIT $2
      `,
      [idleMinutes, topN],
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          market: "Globe Market",
          idleMinutes,
          tie_reason_breakdown: reasonBreakdown.rows,
          top_holders: topAgents.rows,
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
