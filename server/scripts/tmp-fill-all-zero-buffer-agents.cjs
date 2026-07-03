const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const WINDOW_MINUTES = Math.max(1, Math.min(60, Number(process.argv[2] || 10)));
const LIMIT = Math.max(1, Math.min(500, Number(process.argv[3] || 200)));
const TARGET_QUEUED = Math.max(1, Math.min(500, Number(process.env.TARGET_QUEUED || 100)));

function normalizeMarket(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("globe")) return "Globe Market";
  if (normalized.includes("veteran")) return "Veteran";
  return raw;
}

function normalizeState(value) {
  return String(value || "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

async function listZeroBufferAgents(client) {
  try {
    const result = await client.query(
      `
        WITH latest AS (
          SELECT DISTINCT ON (lower(agent_email))
            lower(agent_email) AS agent_email,
            COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count,
            updated_at
          FROM leasedialer_client_status
          WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
          ORDER BY lower(agent_email), updated_at DESC
        ),
        recruit_now AS (
          SELECT DISTINCT lower(agent_email) AS agent_email
          FROM agent_live_call_status
          WHERE lower(status) IN ('on_recruit', 'aorecruit', 'ao_recruit')
            AND updated_at >= NOW() - INTERVAL '20 minutes'
        )
        SELECT l.agent_email, l.updated_at
        FROM latest l
        LEFT JOIN recruit_now r ON r.agent_email = l.agent_email
        WHERE l.local_leased_lead_count = 0
          AND r.agent_email IS NULL
        ORDER BY l.updated_at DESC, l.agent_email ASC
        LIMIT $2
      `,
      [WINDOW_MINUTES, LIMIT],
    );
    return result.rows.map((row) => String(row.agent_email || "").trim().toLowerCase()).filter(Boolean);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (!message.includes('relation "agent_live_call_status" does not exist')) throw error;
    const fallback = await client.query(
      `
        WITH latest AS (
          SELECT DISTINCT ON (lower(agent_email))
            lower(agent_email) AS agent_email,
            COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count,
            updated_at
          FROM leasedialer_client_status
          WHERE updated_at >= NOW() - ($1::int * INTERVAL '1 minute')
          ORDER BY lower(agent_email), updated_at DESC
        )
        SELECT agent_email, updated_at
        FROM latest
        WHERE local_leased_lead_count = 0
        ORDER BY updated_at DESC, agent_email ASC
        LIMIT $2
      `,
      [WINDOW_MINUTES, LIMIT],
    );
    return fallback.rows.map((row) => String(row.agent_email || "").trim().toLowerCase()).filter(Boolean);
  }
}

async function fillAgent(client, email) {
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

  if (!profile.rowCount) {
    return { email, error: "NO_ROUTING_PROFILE" };
  }

  const markets = Array.from(
    new Set(((profile.rows[0].markets || []).map(normalizeMarket)).filter(Boolean)),
  );
  const states = Array.from(
    new Set(((profile.rows[0].states || []).map(normalizeState)).filter((s) => /^[A-Z]{2}$/.test(s))),
  );
  if (!markets.length || !states.length) {
    return { email, error: "INVALID_ROUTING", markets, states };
  }

  const queued = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM leasedialer_assignments
      WHERE lower(agent_email) = lower($1)
        AND queue = 'hotlead'
        AND status IN ('queued', 'active')
    `,
    [email],
  );

  const current = Number(queued.rows[0]?.count || 0);
  const needed = Math.max(0, TARGET_QUEUED - current);
  if (needed <= 0) {
    return { email, current, inserted: 0, after: current, markets, states };
  }

  await client.query("BEGIN");
  try {
    const insertedFromPool = await client.query(
      `
        WITH picked AS (
          SELECT ep.id, ep.lead_id
          FROM leasedialer_eligible_pool ep
          JOIN masterlead ml ON ml.id = ep.lead_id
          WHERE ep.queue = 'hotlead'
            AND ep.status = 'ready'
            AND ep.market = ANY($1::text[])
            AND ep.state = ANY($2::text[])
            AND COALESCE(btrim(ml.cn_email), '') = ''
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true', 't', 'yes', '1')
          ORDER BY ep.lead_received_at DESC NULLS LAST, ep.lead_id DESC
          LIMIT $4
          FOR UPDATE SKIP LOCKED
        ),
        claimed AS (
          UPDATE leasedialer_eligible_pool ep
          SET status = 'claimed',
              claimed_by_agent_email = $3,
              claimed_at = NOW(),
              updated_at = NOW()
          FROM picked p
          WHERE ep.id = p.id
          RETURNING ep.lead_id
        ),
        ins AS (
          INSERT INTO leasedialer_assignments (
            lead_id, agent_email, queue, status, assigned_at, created_at, updated_at
          )
          SELECT lead_id, $3, 'hotlead', 'queued', NOW(), NOW(), NOW()
          FROM claimed
          ON CONFLICT DO NOTHING
          RETURNING lead_id
        )
        SELECT COUNT(*)::int AS count
        FROM ins
      `,
      [markets, states, email, needed],
    );

    let insertedCount = Number(insertedFromPool.rows[0]?.count || 0);

    if (insertedCount < needed) {
      const stillNeeded = needed - insertedCount;
      const insertedDirect = await client.query(
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
              ) = ANY($1::text[])
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($2::text[])
              AND COALESCE(btrim(ml.cn_email), '') = ''
              AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
              AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
              AND lower(COALESCE(ml.dnc::text, 'false')) NOT IN ('true', 't', 'yes', '1')
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
            SELECT id, $3, 'hotlead', 'queued', NOW(), NOW(), NOW()
            FROM eligible
            ON CONFLICT DO NOTHING
            RETURNING lead_id
          )
          SELECT COUNT(*)::int AS count
          FROM ins
        `,
        [markets, states, email, stillNeeded],
      );
      insertedCount += Number(insertedDirect.rows[0]?.count || 0);
    }

    await client.query("COMMIT");

    const after = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM leasedialer_assignments
        WHERE lower(agent_email) = lower($1)
          AND queue = 'hotlead'
          AND status IN ('queued', 'active')
      `,
      [email],
    );

    return {
      email,
      current,
      inserted: insertedCount,
      after: Number(after.rows[0]?.count || 0),
      markets,
      states,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    return { email, current, error: error?.message || String(error), markets, states };
  }
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const agents = await listZeroBufferAgents(client);
    const results = [];
    for (const email of agents) {
      // one-at-a-time, in order
      // eslint-disable-next-line no-await-in-loop
      const result = await fillAgent(client, email);
      results.push(result);
      console.log(JSON.stringify({ progress: `${results.length}/${agents.length}`, result }, null, 2));
    }

    const summary = {
      ranAt: new Date().toISOString(),
      windowMinutes: WINDOW_MINUTES,
      targetQueued: TARGET_QUEUED,
      agentsConsidered: agents.length,
      filled: results.filter((r) => Number(r.inserted || 0) > 0).length,
      unchanged: results.filter((r) => Number(r.inserted || 0) === 0 && !r.error).length,
      failed: results.filter((r) => !!r.error).length,
      totalInserted: results.reduce((sum, r) => sum + Number(r.inserted || 0), 0),
      results,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
