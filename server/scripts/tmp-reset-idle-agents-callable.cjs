const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const idleMinutes = Math.max(1, Number(process.argv[2] || 60));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 0,
    query_timeout: 0,
  });
  await client.connect();

  try {
    const idleAgentsRes = await client.query(
      `
        WITH holders AS (
          SELECT DISTINCT lower(agent_email) AS agent_email
          FROM leasedialer_assignments
          WHERE queue = 'hotlead'
            AND status IN ('queued', 'active')
        ),
        last_dials AS (
          SELECT
            h.agent_email,
            MAX(adm.event_timestamp) AS last_dial_at
          FROM holders h
          LEFT JOIN agent_dial_metrics adm
            ON lower(adm.agent_email) = h.agent_email
           AND adm.event_type = 'dial'
          GROUP BY h.agent_email
        )
        SELECT agent_email
        FROM last_dials
        WHERE last_dial_at IS NULL
           OR last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
        ORDER BY agent_email ASC
      `,
      [idleMinutes],
    );

    const idleAgents = idleAgentsRes.rows.map((r) => String(r.agent_email).toLowerCase());
    let totalReleased = 0;
    let totalClearedOwners = 0;
    let totalReturnedPool = 0;
    const perAgent = [];

    for (const agentEmail of idleAgents) {
      const result = await client.query(
        `
          WITH updated_assignments AS (
            UPDATE leasedialer_assignments la
            SET status = 'released',
                released_at = NOW(),
                release_reason = 'manual_idle_bulk_reset',
                updated_at = NOW()
            FROM masterlead ml
            WHERE ml.id = la.lead_id
              AND lower(la.agent_email) = $1
              AND la.queue = 'hotlead'
              AND la.status IN ('queued', 'active')
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
              )
            RETURNING la.lead_id, la.agent_email
          ),
          cleared_owner AS (
            UPDATE masterlead ml
            SET cn_email = NULL,
                assigned_date = NULL,
                updated_at = NOW()
            FROM updated_assignments ua
            WHERE ml.id = ua.lead_id
              AND lower(trim(coalesce(ml.cn_email, ''))) = lower(ua.agent_email)
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            RETURNING ml.id
          ),
          returned_pool AS (
            UPDATE leasedialer_eligible_pool ep
            SET status = 'ready',
                claimed_by_agent_email = NULL,
                claimed_assignment_id = NULL,
                claimed_at = NULL,
                updated_at = NOW()
            FROM updated_assignments ua
            WHERE ep.lead_id = ua.lead_id
              AND ep.status = 'claimed'
              AND lower(coalesce(ep.claimed_by_agent_email, '')) = lower(ua.agent_email)
            RETURNING ep.lead_id
          )
          SELECT
            (SELECT COUNT(*)::int FROM updated_assignments) AS released_count,
            (SELECT COUNT(*)::int FROM cleared_owner) AS cleared_owner_count,
            (SELECT COUNT(*)::int FROM returned_pool) AS returned_pool_count
        `,
        [agentEmail],
      );

      const released = Number(result.rows[0]?.released_count || 0);
      const clearedOwners = Number(result.rows[0]?.cleared_owner_count || 0);
      const returnedPool = Number(result.rows[0]?.returned_pool_count || 0);

      if (released > 0 || clearedOwners > 0 || returnedPool > 0) {
        perAgent.push({
          agent_email: agentEmail,
          released_count: released,
          cleared_owner_count: clearedOwners,
          returned_pool_count: returnedPool,
        });
      }

      totalReleased += released;
      totalClearedOwners += clearedOwners;
      totalReturnedPool += returnedPool;
    }

    perAgent.sort((a, b) => b.released_count - a.released_count || a.agent_email.localeCompare(b.agent_email));

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          idleMinutes,
          idleAgentsEvaluated: idleAgents.length,
          agentsWithReleases: perAgent.length,
          totalReleased,
          totalClearedOwners,
          totalReturnedPool,
          topAgents: perAgent.slice(0, 50),
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
