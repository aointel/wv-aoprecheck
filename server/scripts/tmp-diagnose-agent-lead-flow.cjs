const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const AGENT_TERMS = [
  "kimberlyalston",
  "cynthiaschomp",
  "lynettedurand",
  "emilyrogers",
  "alvater",
  "altvater",
  "christina",
];

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
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();

  try {
    const profilesByEmail = new Map();
    for (const term of AGENT_TERMS) {
      const found = await client.query(
        `
          SELECT lower(agent_email) AS agent_email, markets, states, updated_at
          FROM agent_routing_profiles
          WHERE lower(agent_email) LIKE $1
          ORDER BY updated_at DESC
          LIMIT 20
        `,
        [`%${term}%`],
      );
      for (const row of found.rows) {
        profilesByEmail.set(String(row.agent_email).toLowerCase(), row);
      }
    }

    const output = [];
    for (const row of profilesByEmail.values()) {
      const email = String(row.agent_email).toLowerCase();
      const markets = Array.isArray(row.markets) ? [...new Set(row.markets.map(normalizeMarket).filter(Boolean))] : [];
      const states = Array.isArray(row.states) ? [...new Set(row.states.map(normalizeState).filter(Boolean))] : [];

      const queued = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE lower(la.agent_email) = lower($1)
            AND la.queue = 'hotlead'
            AND la.status IN ('queued', 'active')
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        `,
        [email],
      );

      const poolReady = await client.query(
        `
          SELECT
            COALESCE(ep.state, '??') AS state,
            COUNT(*)::int AS ready
          FROM leasedialer_eligible_pool ep
          WHERE ep.queue = 'hotlead'
            AND ep.status = 'ready'
            AND ep.market = ANY($1::text[])
            AND ep.state = ANY($2::text[])
          GROUP BY ep.state
          ORDER BY ready DESC, state ASC
        `,
        [markets, states],
      );

      const poolClaimed = await client.query(
        `
          SELECT COUNT(*)::int AS count
          FROM leasedialer_eligible_pool ep
          WHERE ep.queue = 'hotlead'
            AND ep.status = 'claimed'
            AND ep.market = ANY($1::text[])
            AND ep.state = ANY($2::text[])
        `,
        [markets, states],
      );

      const live = await client.query(
        `
          SELECT
            lower(agent_email) AS agent_email,
            status,
            ccpro_enabled,
            source,
            last_heartbeat_at,
            updated_at
          FROM agent_live_call_status
          WHERE lower(agent_email) = lower($1)
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [email],
      );

      const queuedByState = await client.query(
        `
          SELECT
            COALESCE(NULLIF(upper(btrim(coalesce(ml.taalk_state::text, ml.state::text))), ''), '??') AS state,
            COUNT(*)::int AS queued
          FROM leasedialer_assignments la
          JOIN masterlead ml ON ml.id = la.lead_id
          WHERE lower(la.agent_email) = lower($1)
            AND la.queue = 'hotlead'
            AND la.status IN ('queued', 'active')
            AND lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          GROUP BY 1
          ORDER BY queued DESC, state ASC
        `,
        [email],
      );

      output.push({
        agent_email: email,
        updated_at: row.updated_at,
        markets,
        states,
        queued_count: Number(queued.rows[0]?.count || 0),
        live_status: live.rows[0] || null,
        queued_by_state: queuedByState.rows,
        ready_pool_by_state: poolReady.rows,
        claimed_pool_total: Number(poolClaimed.rows[0]?.count || 0),
      });
    }

    console.log(JSON.stringify({ agent_count: output.length, agents: output }, null, 2));
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

