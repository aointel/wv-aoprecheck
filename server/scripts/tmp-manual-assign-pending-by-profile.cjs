const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const BASE_URL = process.env.AOIRAIL_DATA_URL || "https://aoirail-data-production.up.railway.app";
const TARGET_PER_AGENT = Math.max(1, Number(process.env.TARGET_PER_AGENT || 15));
const MAX_AGENTS = Math.max(1, Number(process.env.MAX_AGENTS || 40));
const SLEEP_MS = Math.max(0, Number(process.env.SLEEP_MS || 500));
const CLAIM_LOCK_TIMEOUT_MS = Math.max(100, Number(process.env.CLAIM_LOCK_TIMEOUT_MS || 1000));
const CLAIM_STATEMENT_TIMEOUT_MS = Math.max(5000, Number(process.env.CLAIM_STATEMENT_TIMEOUT_MS || 30000));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMarket(value) {
  const raw = String(value || "").trim();
  const compact = raw.toLowerCase().replace(/\s+/g, "");
  if (compact.includes("globe")) return "Globe Market";
  if (compact.includes("veteran")) return "Veteran";
  return raw;
}

function normalizeState(value) {
  return String(value || "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

async function getOnlineAgents() {
  const response = await fetch(`${BASE_URL}/api/call-connector-pro/eligible-for-inbound`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`eligible-for-inbound failed: ${response.status}`);
  }
  const payload = await response.json();
  const list = Array.isArray(payload?.eligibleRingGroup) ? payload.eligibleRingGroup : [];
  const emails = [];
  for (const row of list) {
    const email = String(row?.email || "").trim().toLowerCase();
    if (email.includes("@") && !emails.includes(email)) emails.push(email);
    if (emails.length >= MAX_AGENTS) break;
  }
  return emails;
}

async function assignForAgent(client, agentEmail) {
  const routing = await client.query(
    `
      SELECT markets, states
      FROM agent_routing_profiles
      WHERE lower(agent_email) = lower($1)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
    `,
    [agentEmail],
  );
  const markets = Array.from(
    new Set((routing.rows[0]?.markets || []).map(normalizeMarket).filter(Boolean)),
  );
  const states = Array.from(
    new Set((routing.rows[0]?.states || []).map(normalizeState).filter((s) => /^[A-Z]{2}$/.test(s))),
  );

  if (!markets.length || !states.length) {
    return { agentEmail, inserted: 0, skipped: "missing_profile" };
  }

  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL lock_timeout = '${CLAIM_LOCK_TIMEOUT_MS}ms'`);
    await client.query(`SET LOCAL statement_timeout = '${CLAIM_STATEMENT_TIMEOUT_MS}ms'`);

    const inserted = await client.query(
      `
        WITH candidates AS (
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
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
            AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
            AND COALESCE(btrim(ml.cn_email), '') = ''
            AND NOT EXISTS (
              SELECT 1
              FROM leasedialer_assignments la
              WHERE la.lead_id = ml.id
                AND la.status IN ('queued', 'active')
            )
          ORDER BY ml.created_at DESC NULLS LAST, ml.id DESC
          LIMIT $4
          FOR UPDATE SKIP LOCKED
        ),
        ins AS (
          INSERT INTO leasedialer_assignments (
            lead_id,
            agent_email,
            queue,
            status,
            assigned_at,
            created_at,
            updated_at
          )
          SELECT id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
          FROM candidates
          ON CONFLICT DO NOTHING
          RETURNING lead_id
        )
        SELECT COUNT(*)::int AS count
        FROM ins
      `,
      [agentEmail, markets, states, TARGET_PER_AGENT],
    );

    await client.query("COMMIT");
    return {
      agentEmail,
      inserted: Number(inserted.rows[0]?.count || 0),
      states: states.length,
      markets,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return {
      agentEmail,
      inserted: 0,
      error: String(error?.message || error),
    };
  }
}

async function run() {
  const agents = await getOnlineAgents();
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 15000,
    query_timeout: 15000,
  });
  await client.connect();
  try {
    const results = [];
    for (const email of agents) {
      const result = await assignForAgent(client, email);
      results.push(result);
      console.log(JSON.stringify({ event: "agent_assignment", ...result }));
      await sleep(SLEEP_MS);
    }

    const assignedAgents = results.filter((r) => Number(r.inserted || 0) > 0).length;
    const totalInserted = results.reduce((sum, r) => sum + Number(r.inserted || 0), 0);
    console.log(
      JSON.stringify({
        event: "manual_assignment_complete",
        maxAgents: MAX_AGENTS,
        targetPerAgent: TARGET_PER_AGENT,
        totalAgentsProcessed: results.length,
        assignedAgents,
        totalInserted,
      }),
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
