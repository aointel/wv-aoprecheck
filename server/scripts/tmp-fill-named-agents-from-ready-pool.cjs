const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TARGET_QUEUED = Number(process.env.TARGET_QUEUED || 100);
const AGENTS = [
  "kimberlyalston@aoglobelife.com",
  "cynthiaschomp@aoglobelife.com",
  "lynettedurand@aoglobelife.com",
  "emilyrogers@aoglobelife.com",
  "christinamariaaltvater@aoglobelife.com",
];

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
    const inserted = await client.query(
      `
        WITH picked AS (
          SELECT ep.id, ep.lead_id
          FROM leasedialer_eligible_pool ep
          WHERE ep.queue = 'hotlead'
            AND ep.status = 'ready'
            AND ep.market = ANY($1::text[])
            AND ep.state = ANY($2::text[])
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
      inserted: Number(inserted.rows[0]?.count || 0),
      after: Number(after.rows[0]?.count || 0),
      markets,
      states,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    return { email, current, error: error.message || String(error), markets, states };
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
    const results = [];
    for (const email of AGENTS) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await fillAgent(client, email));
    }
    console.log(JSON.stringify({ target: TARGET_QUEUED, results }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

