const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const idleMinutes = Math.max(1, Number(process.argv[2] || 60));
  const agentBatchSize = Math.max(1, Math.min(100, Number(process.argv[3] || 25)));
  const leadBatchPerAgent = Math.max(1, Math.min(1000, Number(process.argv[4] || 150)));
  const maxRounds = Math.max(1, Math.min(200, Number(process.argv[5] || 20)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    let roundsRan = 0;
    let totalReleased = 0;
    let totalClearedOwners = 0;
    let totalReturnedPool = 0;
    const roundSummaries = [];

    while (roundsRan < maxRounds) {
      roundsRan += 1;
      const idleAgentsRes = await client.query(
        `
          WITH callable_holders AS (
            SELECT
              lower(la.agent_email) AS agent_email,
              COUNT(*)::int AS callable_count
            FROM leasedialer_assignments la
            JOIN masterlead ml ON ml.id = la.lead_id
            WHERE la.queue = 'hotlead'
              AND la.status IN ('queued', 'active')
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND (
                COALESCE(btrim(ml.cn_email), '') = ''
                OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
              )
            GROUP BY 1
          ),
          agent_last AS (
            SELECT
              h.agent_email,
              h.callable_count,
              MAX(adm.event_timestamp) AS last_dial_at
            FROM callable_holders h
            LEFT JOIN agent_dial_metrics adm
              ON lower(adm.agent_email) = h.agent_email
             AND adm.event_type = 'dial'
            GROUP BY h.agent_email, h.callable_count
          )
          SELECT agent_email
          FROM agent_last
          WHERE last_dial_at IS NULL
             OR last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
          ORDER BY callable_count DESC, agent_email ASC
          LIMIT $2
        `,
        [idleMinutes, agentBatchSize],
      );

      const idleAgents = idleAgentsRes.rows.map((r) => String(r.agent_email).toLowerCase());
      if (idleAgents.length === 0) {
        roundSummaries.push({
          round: roundsRan,
          idle_agents_checked: 0,
          released: 0,
          cleared_owner: 0,
          returned_pool: 0,
        });
        break;
      }

      let roundReleased = 0;
      let roundClearedOwners = 0;
      let roundReturnedPool = 0;

      for (const agentEmail of idleAgents) {
        const result = await client.query(
          `
            WITH candidates AS (
              SELECT la.id, la.lead_id, la.agent_email
              FROM leasedialer_assignments la
              JOIN masterlead ml ON ml.id = la.lead_id
              WHERE lower(la.agent_email) = $1
                AND la.queue = 'hotlead'
                AND la.status IN ('queued', 'active')
                AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
                AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
                AND (
                  COALESCE(btrim(ml.cn_email), '') = ''
                  OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
                )
              ORDER BY la.updated_at ASC NULLS FIRST, la.assigned_at ASC
              LIMIT $2
            ),
            updated_assignments AS (
              UPDATE leasedialer_assignments la
              SET status = 'released',
                  released_at = NOW(),
                  release_reason = 'manual_idle_batch_reclaim',
                  updated_at = NOW()
              FROM candidates c
              WHERE la.id = c.id
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
          [agentEmail, leadBatchPerAgent],
        );

        roundReleased += Number(result.rows[0]?.released_count || 0);
        roundClearedOwners += Number(result.rows[0]?.cleared_owner_count || 0);
        roundReturnedPool += Number(result.rows[0]?.returned_pool_count || 0);
      }

      totalReleased += roundReleased;
      totalClearedOwners += roundClearedOwners;
      totalReturnedPool += roundReturnedPool;
      roundSummaries.push({
        round: roundsRan,
        idle_agents_checked: idleAgents.length,
        released: roundReleased,
        cleared_owner: roundClearedOwners,
        returned_pool: roundReturnedPool,
      });

      if (roundReleased === 0) break;
    }

    const post = await client.query(
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
          input: { idleMinutes, agentBatchSize, leadBatchPerAgent, maxRounds },
          roundsRan,
          totalReleased,
          totalClearedOwners,
          totalReturnedPool,
          postQueueStatus: post.rows[0] || null,
          roundSummaries,
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
