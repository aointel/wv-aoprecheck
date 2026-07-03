const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const INTERVAL_MS = Math.max(60_000, Number(process.env.QUEUE_CLEANER_INTERVAL_MS || 5 * 60 * 1000));
const AGENT_BATCH_SIZE = Math.max(10, Math.min(200, Number(process.env.QUEUE_CLEANER_AGENT_BATCH_SIZE || 40)));
const ROW_BATCH_SIZE = Math.max(10, Math.min(300, Number(process.env.QUEUE_CLEANER_ROW_BATCH_SIZE || 75)));
const MAX_PASSES = Math.max(1, Math.min(50, Number(process.env.QUEUE_CLEANER_MAX_PASSES || 8)));
const ORPHAN_OWNER_BATCH_SIZE = Math.max(50, Math.min(2000, Number(process.env.QUEUE_CLEANER_ORPHAN_OWNER_BATCH_SIZE || 250)));
const CLEANER_LOCK_ID = Number(process.env.QUEUE_CLEANER_LOCK_ID || 6096048383);
let loopRunning = false;

async function fetchAgents(client) {
  const result = await client.query(
    `
    SELECT lower(agent_email) AS agent_email
    FROM leasedialer_assignments
    WHERE status IN ('queued', 'active')
      AND queue = 'hotlead'
    GROUP BY lower(agent_email)
    ORDER BY lower(agent_email)
    LIMIT $1
    `,
    [AGENT_BATCH_SIZE],
  );
  return result.rows.map((row) => row.agent_email).filter(Boolean);
}

async function cleanAgent(client, agentEmail) {
  const profileRes = await client.query(
    `
    SELECT markets, states
    FROM agent_routing_profiles
    WHERE lower(agent_email) = $1
    LIMIT 1
    `,
    [agentEmail],
  );
  const markets = Array.isArray(profileRes.rows[0]?.markets) ? profileRes.rows[0].markets : [];
  const states = Array.isArray(profileRes.rows[0]?.states) ? profileRes.rows[0].states : [];

  if (markets.length === 0 || states.length === 0) {
    const missingProfile = await client.query(
      `
      WITH scoped AS (
        SELECT id, lead_id
        FROM leasedialer_assignments
        WHERE status IN ('queued', 'active')
          AND queue = 'hotlead'
          AND lower(agent_email) = $1
        ORDER BY updated_at ASC NULLS FIRST, assigned_at ASC
        LIMIT $2
      ),
      completed AS (
        UPDATE leasedialer_assignments la
        SET status = 'completed',
            released_at = NOW(),
            release_reason = 'queue_cleaner_missing_customers_profile',
            updated_at = NOW()
        FROM scoped
        WHERE la.id = scoped.id
        RETURNING scoped.lead_id
      ),
      cleared_owner AS (
        UPDATE masterlead ml
        SET cn_email = NULL,
            assigned_date = NULL,
            updated_at = NOW()
        FROM completed c
        WHERE ml.id = c.lead_id
          AND lower(trim(coalesce(ml.cn_email, ''))) = $1
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        RETURNING ml.id
      )
      SELECT COUNT(*)::int AS completed_count
      FROM completed
      `,
      [agentEmail, ROW_BATCH_SIZE],
    );
    return Number(missingProfile.rows[0]?.completed_count || 0);
  }

  const result = await client.query(
    `
    WITH scoped AS (
      SELECT la.id, la.lead_id
      FROM leasedialer_assignments la
      JOIN masterlead ml ON ml.id = la.lead_id
      WHERE la.status IN ('queued', 'active')
        AND la.queue = 'hotlead'
        AND lower(la.agent_email) = $1
        AND (
          lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
          OR COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
          OR (COALESCE(btrim(ml.cn_email), '') <> '' AND lower(btrim(ml.cn_email)) <> $1)
          OR (
            COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) IS NULL
            OR COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) <> ALL($2::text[])
          )
          OR (
            CASE
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
              WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
              ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
            END
          ) <> ALL($3::text[])
        )
      ORDER BY la.updated_at ASC NULLS FIRST, la.assigned_at ASC
      LIMIT $4
    ),
    completed AS (
      UPDATE leasedialer_assignments la
      SET status = 'completed',
          released_at = NOW(),
          release_reason = 'queue_cleaner_noncallable_or_mismatch',
          updated_at = NOW()
      FROM scoped
      WHERE la.id = scoped.id
      RETURNING scoped.lead_id
    ),
    cleared_owner AS (
      UPDATE masterlead ml
      SET cn_email = NULL,
          assigned_date = NULL,
          updated_at = NOW()
      FROM completed c
      WHERE ml.id = c.lead_id
        AND lower(trim(coalesce(ml.cn_email, ''))) = $1
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
      RETURNING ml.id
    )
    SELECT COUNT(*)::int AS completed_count
    FROM completed
    `,
    [agentEmail, states, markets, ROW_BATCH_SIZE],
  );
  return Number(result.rows[0]?.completed_count || 0);
}

async function clearOwnedCallableWithoutActiveLease(client) {
  const result = await client.query(
    `
    WITH candidates AS (
      SELECT ml.id
      FROM masterlead ml
      WHERE COALESCE(btrim(ml.cn_email), '') <> ''
        AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM leasedialer_assignments la
          WHERE la.lead_id = ml.id
            AND la.status IN ('queued', 'active')
        )
      ORDER BY ml.id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    ),
    updated AS (
      UPDATE masterlead ml
      SET cn_email = NULL,
          assigned_date = NULL,
          updated_at = NOW()
      FROM candidates c
      WHERE ml.id = c.id
      RETURNING ml.id
    )
    SELECT COUNT(*)::int AS cleared_count
    FROM updated
    `,
    [ORPHAN_OWNER_BATCH_SIZE],
  );
  return Number(result.rows[0]?.cleared_count || 0);
}

async function runPass() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 45_000,
    query_timeout: 45_000,
  });
  await client.connect();
  let hasLock = false;
  try {
    const lockResult = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [CLEANER_LOCK_ID]);
    hasLock = Boolean(lockResult.rows[0]?.locked);
    if (!hasLock) {
      console.log(JSON.stringify({ ranAt: new Date().toISOString(), skipped: "lock_not_acquired" }));
      return;
    }

    let totalCompleted = 0;
    let passes = 0;
    while (passes < MAX_PASSES) {
      const agents = await fetchAgents(client);
      if (agents.length === 0) break;
      let cleaned = 0;
      for (const agentEmail of agents) {
        cleaned += await cleanAgent(client, agentEmail);
      }
      const orphanOwnerCleared = await clearOwnedCallableWithoutActiveLease(client);
      passes += 1;
      totalCompleted += cleaned + orphanOwnerCleared;
      if (cleaned === 0 && orphanOwnerCleared === 0) break;
    }
    console.log(
      JSON.stringify({
        ranAt: new Date().toISOString(),
        agentBatchSize: AGENT_BATCH_SIZE,
        rowBatchSize: ROW_BATCH_SIZE,
        maxPasses: MAX_PASSES,
        passes,
        completed: totalCompleted,
      }),
    );
  } finally {
    if (hasLock) {
      await client.query("SELECT pg_advisory_unlock($1)", [CLEANER_LOCK_ID]).catch(() => undefined);
    }
    await client.end();
  }
}

async function main() {
  const loop = process.argv.includes("--loop");
  await runPass();
  if (!loop) return;
  setInterval(() => {
    if (loopRunning) return;
    loopRunning = true;
    void runPass()
      .catch((e) => console.error("[queue-cleaner] pass failed:", e?.message || e))
      .finally(() => {
        loopRunning = false;
      });
  }, INTERVAL_MS).unref?.();
  console.log(JSON.stringify({ mode: "loop", intervalMs: INTERVAL_MS }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
