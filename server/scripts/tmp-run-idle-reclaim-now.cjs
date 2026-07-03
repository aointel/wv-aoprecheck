const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const idleMinutes = Math.max(15, Number(process.argv[2] || 120));
  const batchSize = Math.max(1, Math.min(5000, Number(process.argv[3] || 1000)));
  const maxPasses = Math.max(1, Math.min(30, Number(process.argv[4] || 10)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    let pass = 0;
    let totalReleased = 0;
    let totalReturnedPool = 0;
    let totalClearedOwners = 0;

    while (pass < maxPasses) {
      pass += 1;
      const res = await client.query(
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
          ),
          candidates AS (
            SELECT la.id, la.lead_id, la.agent_email
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
              AND (
                ald.last_dial_at IS NULL
                OR ald.last_dial_at < NOW() - ($1::int * INTERVAL '1 minute')
              )
            ORDER BY la.updated_at ASC NULLS FIRST, la.assigned_at ASC
            LIMIT $2
          ),
          updated_assignments AS (
            UPDATE leasedialer_assignments la
            SET status = 'released',
                released_at = NOW(),
                release_reason = 'idle_no_recent_dial_reclaim',
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
        [idleMinutes, batchSize],
      );

      const released = Number(res.rows[0]?.released_count || 0);
      const clearedOwners = Number(res.rows[0]?.cleared_owner_count || 0);
      const returnedPool = Number(res.rows[0]?.returned_pool_count || 0);
      totalReleased += released;
      totalClearedOwners += clearedOwners;
      totalReturnedPool += returnedPool;
      if (released === 0) break;
    }

    const reasonSummary = await client.query(
      `
        SELECT
          release_reason,
          COUNT(*)::int AS count,
          MAX(updated_at) AS latest_updated_at
        FROM leasedialer_assignments
        WHERE release_reason = 'idle_no_recent_dial_reclaim'
          AND updated_at >= NOW() - INTERVAL '60 minutes'
        GROUP BY release_reason
      `,
    );

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          input: { idleMinutes, batchSize, maxPasses },
          passCount: pass,
          totalReleased,
          totalClearedOwners,
          totalReturnedPool,
          lastHourIdleReclaims: reasonSummary.rows,
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
