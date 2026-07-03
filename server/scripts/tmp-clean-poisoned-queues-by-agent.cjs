const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function normalizeStates(arr) {
  return Array.from(
    new Set(
      (Array.isArray(arr) ? arr : [])
        .map((v) => String(v || "").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase())
        .filter((s) => /^[A-Z]{2}$/.test(s)),
    ),
  );
}

async function run() {
  const maxAgents = Math.max(1, Math.min(500, Number(process.argv[2] || 150)));
  const perAgentLimit = Math.max(1, Math.min(1000, Number(process.argv[3] || 250)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const agentsRes = await client.query(
      `
      SELECT lower(agent_email) AS agent_email, COUNT(*)::int AS queued_count
      FROM leasedialer_assignments
      WHERE queue = 'hotlead'
        AND status IN ('queued', 'active')
      GROUP BY lower(agent_email)
      ORDER BY queued_count DESC, lower(agent_email) ASC
      LIMIT $1
      `,
      [maxAgents],
    );

    let totalReleased = 0;
    let processedAgents = 0;
    let skippedNoProfile = 0;
    const top = [];

    for (const agent of agentsRes.rows) {
      const email = String(agent.agent_email || "").toLowerCase();
      if (!email.includes("@")) continue;

      const profile = await client.query(
        `
        SELECT states
        FROM agent_routing_profiles
        WHERE lower(agent_email) = lower($1)
        ORDER BY updated_at DESC
        LIMIT 1
        `,
        [email],
      );
      const states = normalizeStates(profile.rows[0]?.states);
      if (!states.length) {
        skippedNoProfile += 1;
        continue;
      }

      const released = await client.query(
        `
        WITH candidates AS (
          SELECT la.id
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE lower(la.agent_email) = lower($1)
            AND la.queue = 'hotlead'
            AND la.status IN ('queued', 'active')
            AND (
              COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) IS NULL
              OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL($2::text[])
              OR COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
              OR lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
            )
          ORDER BY la.updated_at ASC NULLS FIRST, la.assigned_at ASC
          LIMIT $3
        )
        UPDATE leasedialer_assignments la
        SET status = 'released',
            released_at = NOW(),
            release_reason = 'manual_state_mismatch_global_cleanup',
            updated_at = NOW()
        FROM candidates c
        WHERE la.id = c.id
        `,
        [email, states, perAgentLimit],
      );

      const count = Number(released.rowCount || 0);
      if (count > 0) {
        totalReleased += count;
        top.push({ agent_email: email, released: count });
      }
      processedAgents += 1;
    }

    top.sort((a, b) => b.released - a.released || a.agent_email.localeCompare(b.agent_email));

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          maxAgents,
          perAgentLimit,
          processedAgents,
          skippedNoProfile,
          totalReleased,
          top_agents: top.slice(0, 25),
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
