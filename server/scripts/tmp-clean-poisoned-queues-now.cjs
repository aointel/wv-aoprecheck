const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const batchSize = Math.max(1, Math.min(2000, Number(process.argv[2] || 500)));
  const maxPasses = Math.max(1, Math.min(20, Number(process.argv[3] || 5)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    let pass = 0;
    let totalReleased = 0;
    while (pass < maxPasses) {
      pass += 1;
      const res = await client.query(
        `
        WITH latest_profile AS (
          SELECT DISTINCT ON (lower(agent_email))
            lower(agent_email) AS agent_email,
            ARRAY(
              SELECT upper(regexp_replace(s, '[^A-Za-z]', '', 'g'))
              FROM unnest(COALESCE(states, ARRAY[]::text[])) s
              WHERE upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) <> ''
            ) AS states
          FROM agent_routing_profiles
          ORDER BY lower(agent_email), updated_at DESC
        ),
        candidates AS (
          SELECT la.id
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          LEFT JOIN latest_profile p ON p.agent_email = lower(la.agent_email)
          WHERE la.queue = 'hotlead'
            AND la.status IN ('queued', 'active')
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND (
              COALESCE(btrim(ml.cn_email), '') = ''
              OR lower(btrim(ml.cn_email)) = lower(la.agent_email)
            )
            AND (
              p.agent_email IS NULL
              OR array_length(p.states, 1) IS NULL
              OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) IS NULL
              OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL(p.states)
            )
          ORDER BY la.updated_at ASC NULLS FIRST, la.assigned_at ASC
          LIMIT $1
        ),
        updated AS (
          UPDATE leasedialer_assignments la
          SET status = 'released',
              released_at = NOW(),
              release_reason = 'manual_state_mismatch_global_cleanup',
              updated_at = NOW()
          FROM candidates c
          WHERE la.id = c.id
          RETURNING la.id
        )
        SELECT COUNT(*)::int AS released_count
        FROM updated
        `,
        [batchSize],
      );

      const released = Number(res.rows[0]?.released_count || 0);
      totalReleased += released;
      if (released === 0) break;
    }

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          batchSize,
          maxPasses,
          passesRun: pass,
          totalReleased,
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
