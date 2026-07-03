const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const email = String(process.argv[2] || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: node server/scripts/tmp-diagnose-single-agent-leads.cjs <agent_email>");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const byStatus = await client.query(
      `
        SELECT status, COUNT(*)::int AS count
        FROM leasedialer_assignments
        WHERE lower(agent_email) = lower($1)
          AND queue = 'hotlead'
        GROUP BY status
        ORDER BY status
      `,
      [email],
    );

    const callableQueuedActive = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
      `,
      [email],
    );

    const recentAssignments = await client.query(
      `
        SELECT
          la.id,
          la.status,
          la.assigned_at,
          la.updated_at,
          la.release_reason,
          ml.id AS lead_id,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state,
          COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)) AS market,
          lower(trim(coalesce(ml.cnresolution, 'pending'))) AS cnresolution,
          lower(trim(coalesce(ml.cn_email, ''))) AS cn_email
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
        ORDER BY la.updated_at DESC NULLS LAST, la.created_at DESC
        LIMIT 20
      `,
      [email],
    );

    let liveStatus = { rows: [] };
    try {
      liveStatus = await client.query(
        `
          SELECT
            lower(agent_email) AS agent_email,
            status,
            ccpro_enabled,
            last_heartbeat_at,
            updated_at
          FROM agent_live_call_status
          WHERE lower(agent_email) = lower($1)
          ORDER BY updated_at DESC
          LIMIT 3
        `,
        [email],
      );
    } catch {
      // This table can be Supabase-managed in some environments.
      liveStatus = { rows: [] };
    }

    const queueHealth = await client.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE la.status = 'queued')::int AS queued,
          COUNT(*) FILTER (WHERE la.status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null'))::int AS pending_like,
          COUNT(*) FILTER (WHERE COALESCE(btrim(ml.taalk_lead_id::text), '') = '')::int AS missing_taalk_lead_id,
          COUNT(*) FILTER (
            WHERE COALESCE(btrim(ml.cn_email), '') <> ''
              AND lower(btrim(ml.cn_email)) <> lower($1)
          )::int AS owned_by_other_agent
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
      `,
      [email],
    );

    const profile = await client.query(
      `
        SELECT markets, states
        FROM agent_routing_profiles
        WHERE lower(agent_email) = lower($1)
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [email],
    );

    const markets = Array.isArray(profile.rows[0]?.markets) ? profile.rows[0].markets : [];
    const states = Array.isArray(profile.rows[0]?.states) ? profile.rows[0].states : [];
    let readyPoolByState = [];
    if (markets.length > 0 && states.length > 0) {
      const readyPool = await client.query(
        `
          SELECT ep.state, COUNT(*)::int AS ready
          FROM leasedialer_eligible_pool ep
          WHERE ep.queue = 'hotlead'
            AND ep.status = 'ready'
            AND ep.market = ANY($1::text[])
            AND ep.state = ANY($2::text[])
          GROUP BY ep.state
          ORDER BY ready DESC, ep.state ASC
        `,
        [markets, states],
      );
      readyPoolByState = readyPool.rows;
    }

    console.log(
      JSON.stringify(
        {
          email,
          by_status: byStatus.rows,
          callable_queued_active: Number(callableQueuedActive.rows[0]?.count || 0),
          queue_health: queueHealth.rows[0] || null,
          routing_profile: profile.rows[0] || null,
          ready_pool_by_state: readyPoolByState,
          live_status: liveStatus.rows,
          recent_assignments: recentAssignments.rows,
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
