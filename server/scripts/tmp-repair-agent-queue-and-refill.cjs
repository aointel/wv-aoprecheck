const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TARGET_QUEUED = Number(process.env.TARGET_QUEUED || 25);

function normalizeMarket(value) {
  const raw = String(value || "").trim();
  const n = raw.toLowerCase().replace(/\s+/g, "");
  if (n.includes("globe")) return "Globe Market";
  if (n.includes("veteran")) return "Veteran";
  return raw;
}

function normalizeState(value) {
  return String(value || "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

async function run() {
  const email = String(process.argv[2] || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    throw new Error("Usage: node server/scripts/tmp-repair-agent-queue-and-refill.cjs <agent_email>");
  }

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    const staleCleanup = await client.query(
      `
        UPDATE leasedialer_assignments la
        SET status = 'completed',
            released_at = NOW(),
            release_reason = 'manual_queue_repair_stale_or_noncallable',
            updated_at = NOW()
        FROM masterlead ml
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND ml.id = la.lead_id
          AND (
            lower(trim(coalesce(ml.cnresolution, 'pending'))) NOT IN ('pending', 'new', '', 'null')
            OR COALESCE(btrim(ml.taalk_lead_id::text), '') = ''
            OR (COALESCE(btrim(ml.cn_email), '') <> '' AND lower(btrim(ml.cn_email)) <> lower($1))
          )
      `,
      [email],
    );

    const orphanCleanup = await client.query(
      `
        UPDATE leasedialer_assignments la
        SET status = 'completed',
            released_at = NOW(),
            release_reason = 'manual_queue_repair_orphan_assignment',
            updated_at = NOW()
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND NOT EXISTS (
            SELECT 1
            FROM masterlead ml
            WHERE ml.id = la.lead_id
          )
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

    const markets = Array.from(new Set((profile.rows[0]?.markets || []).map(normalizeMarket).filter(Boolean)));
    const states = Array.from(new Set((profile.rows[0]?.states || []).map(normalizeState).filter((s) => /^[A-Z]{2}$/.test(s))));

    const callableBefore = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = lower($1))
      `,
      [email],
    );
    const currentCallable = Number(callableBefore.rows[0]?.count || 0);
    const needed = Math.max(0, TARGET_QUEUED - currentCallable);

    let inserted = 0;
    let insertedFallback = 0;
    if (needed > 0 && markets.length > 0 && states.length > 0) {
      const directFill = await client.query(
        `
          WITH eligible AS (
            SELECT ml.id
            FROM masterlead ml
            WHERE (
                CASE
                  WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
                  WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text)), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
                  ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text))
                END
              ) = ANY($2::text[])
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($3::text[])
              AND COALESCE(btrim(ml.cn_email), '') = ''
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND NOT EXISTS (
                SELECT 1
                FROM leasedialer_assignments la
                WHERE la.lead_id = ml.id
                  AND la.status IN ('queued', 'active')
              )
            ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
            LIMIT $4
          ),
          ins AS (
            INSERT INTO leasedialer_assignments (
              lead_id, agent_email, queue, status, assigned_at, created_at, updated_at
            )
            SELECT id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
            FROM eligible
            ON CONFLICT DO NOTHING
            RETURNING lead_id
          )
          SELECT COUNT(*)::int AS count
          FROM ins
        `,
        [email, markets, states, needed],
      );
      inserted = Number(directFill.rows[0]?.count || 0);
    }

    // Intentionally no market-only fallback: strict market+state routing only.

    const callableAfter = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments la
        JOIN masterlead ml ON ml.id = la.lead_id
        WHERE lower(la.agent_email) = lower($1)
          AND la.queue = 'hotlead'
          AND la.status IN ('queued', 'active')
          AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND (COALESCE(btrim(ml.cn_email), '') = '' OR lower(btrim(ml.cn_email)) = lower($1))
      `,
      [email],
    );

    const afterCount = Number(callableAfter.rows[0]?.count || 0);

    await client.query(
      `
        INSERT INTO leasedialer_client_status (agent_email, local_leased_lead_count, current_lead_id, updated_at)
        VALUES ($1, $2, NULL, NOW())
        ON CONFLICT (agent_email) DO UPDATE
        SET local_leased_lead_count = EXCLUDED.local_leased_lead_count,
            updated_at = NOW()
      `,
      [email, afterCount],
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          email,
          targetQueued: TARGET_QUEUED,
          staleRowsCompleted: Number(staleCleanup.rowCount || 0),
          orphanRowsCompleted: Number(orphanCleanup.rowCount || 0),
          callableBefore: currentCallable,
          insertedByState: inserted,
          insertedFallbackMarketOnly: insertedFallback,
          callableAfter: afterCount,
          markets,
          states,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
