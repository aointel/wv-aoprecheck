const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const BASE_URL = process.env.AOIRAIL_DATA_URL || "https://aoirail-data-production.up.railway.app";
const MAX_AGENTS = Math.max(1, Number(process.env.MAX_AGENTS || 120));
const TARGET_PER_AGENT = Math.max(1, Number(process.env.TARGET_PER_AGENT || 50));
const INSERT_CHUNK = Math.max(1, Number(process.env.INSERT_CHUNK || 25));
const SLEEP_MS = Math.max(0, Number(process.env.SLEEP_MS || 100));
const MAX_AGENT_ATTEMPTS = Math.max(1, Number(process.env.MAX_AGENT_ATTEMPTS || 300));
const TARGET_AGENT_INPUT = String(process.env.TARGET_AGENTS || process.env.AGENT_EMAILS || "").trim();

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

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function getOnlineAgents() {
  const response = await fetch(`${BASE_URL}/api/call-connector-pro/eligible-for-inbound`);
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

function normalizeAgentIdentity(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  return `${raw}@aoglobelife.com`;
}

function parseTargetAgents() {
  if (!TARGET_AGENT_INPUT) return [];
  const out = [];
  const seen = new Set();
  for (const token of TARGET_AGENT_INPUT.split(/[,\s;|]+/g)) {
    const email = normalizeAgentIdentity(token);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

async function getProfiles(client, emails) {
  if (!emails.length) return new Map();
  const result = await client.query(
    `
      WITH ranked AS (
        SELECT
          lower(agent_email) AS agent_email,
          markets,
          states,
          ROW_NUMBER() OVER (
            PARTITION BY lower(agent_email)
            ORDER BY updated_at DESC NULLS LAST
          ) AS rn
        FROM agent_routing_profiles
        WHERE lower(agent_email) = ANY($1::text[])
      )
      SELECT agent_email, markets, states
      FROM ranked
      WHERE rn = 1
    `,
    [emails],
  );
  const map = new Map();
  for (const row of result.rows) {
    const markets = Array.from(new Set((row.markets || []).map(normalizeMarket).filter(Boolean)));
    const states = Array.from(
      new Set((row.states || []).map(normalizeState).filter((state) => /^[A-Z]{2}$/.test(state))),
    );
    map.set(String(row.agent_email).toLowerCase(), { markets, states });
  }
  return map;
}

async function getQueuedCounts(client, emails) {
  const counts = new Map();
  if (!emails.length) return counts;
  const result = await client.query(
    `
      SELECT lower(agent_email) AS agent_email, COUNT(*)::int AS queued_count
      FROM leasedialer_assignments
      WHERE lower(agent_email) = ANY($1::text[])
        AND queue = 'hotlead'
        AND status = 'queued'
      GROUP BY lower(agent_email)
    `,
    [emails],
  );
  for (const row of result.rows) {
    counts.set(String(row.agent_email).toLowerCase(), Number(row.queued_count || 0));
  }
  return counts;
}

async function collectLeadsByKey(csvPath) {
  const byKey = new Map();
  const input = fs.createReadStream(csvPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let header = null;
  let idx = {};
  let scanned = 0;
  let eligible = 0;

  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line).map((h) => String(h || "").trim());
      idx = {
        id: header.indexOf("id"),
        taalk_lead_id: header.indexOf("taalk_lead_id"),
        cn_email: header.indexOf("cn_email"),
        cnresolution: header.indexOf("cnresolution"),
        market: header.indexOf("market"),
        taalk_market: header.indexOf("taalk_market"),
        state: header.indexOf("state"),
        taalk_state: header.indexOf("taalk_state"),
      };
      if (idx.id < 0) throw new Error("CSV missing id column");
      continue;
    }

    scanned += 1;
    const row = parseCsvLine(line);
    const leadId = Number(row[idx.id] || 0);
    if (!Number.isInteger(leadId) || leadId <= 0) continue;

    const cnresolution = String(row[idx.cnresolution] || "pending")
      .trim()
      .toLowerCase();
    if (!["pending", "new", "", "null"].includes(cnresolution)) continue;

    const taalkLeadId = String(row[idx.taalk_lead_id] || "").trim();
    if (!taalkLeadId) continue;

    const cnEmail = String(row[idx.cn_email] || "").trim();
    if (cnEmail) continue;

    const market = normalizeMarket(String(row[idx.taalk_market] || row[idx.market] || ""));
    const state = normalizeState(String(row[idx.taalk_state] || row[idx.state] || ""));
    if (!market || !/^[A-Z]{2}$/.test(state)) continue;

    const key = `${market}|${state}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(leadId);
    eligible += 1;
  }

  return { byKey, scanned, eligible };
}

function nextLeadIdsForPlan(plan, byKey, count) {
  const ids = [];
  for (const market of plan.markets) {
    for (const state of plan.states) {
      if (ids.length >= count) break;
      const key = `${market}|${state}`;
      const pool = byKey.get(key);
      if (!pool || !pool.length) continue;
      while (pool.length && ids.length < count) {
        ids.push(pool.pop());
      }
    }
    if (ids.length >= count) break;
  }
  return ids;
}

function buildAgentPlans(agents, profiles, queuedCounts) {
  const plans = [];
  let totalNeed = 0;

  for (const email of agents) {
    const profile = profiles.get(email);
    if (!profile || !profile.markets.length || !profile.states.length) {
      plans.push({
        agentEmail: email,
        target: 0,
        need: 0,
        queuedBefore: queuedCounts.get(email) || 0,
        markets: [],
        states: [],
        skipped: "missing_profile",
      });
      continue;
    }

    const alreadyQueued = queuedCounts.get(email) || 0;
    const need = Math.max(0, TARGET_PER_AGENT - alreadyQueued);
    if (!need) {
      plans.push({
        agentEmail: email,
        target: TARGET_PER_AGENT,
        need: 0,
        queuedBefore: alreadyQueued,
        markets: profile.markets,
        states: profile.states,
        skipped: "already_full",
      });
      continue;
    }
    totalNeed += need;
    plans.push({
      agentEmail: email,
      target: TARGET_PER_AGENT,
      need,
      queuedBefore: alreadyQueued,
      markets: profile.markets,
      states: profile.states,
      statesCount: profile.states.length,
    });
  }

  return { plans, totalNeed };
}

async function insertAssignments(client, plan, byKey) {
  if (!plan.need) return { insertedTotal: 0, attemptedIds: 0 };
  let insertedTotal = 0;
  let attemptedIds = 0;
  let attempts = 0;

  while (insertedTotal < plan.need && attempts < MAX_AGENT_ATTEMPTS) {
    attempts += 1;
    const remaining = plan.need - insertedTotal;
    const ids = nextLeadIdsForPlan(plan, byKey, Math.min(INSERT_CHUNK, remaining));
    if (!ids.length) break;
    attemptedIds += ids.length;

    const result = await client.query(
      `
        WITH input_ids AS (
          SELECT UNNEST($2::bigint[]) AS lead_id
        ),
        available AS (
          SELECT i.lead_id
          FROM input_ids i
          WHERE NOT EXISTS (
            SELECT 1
            FROM leasedialer_assignments la
            WHERE la.lead_id = i.lead_id
              AND la.status IN ('queued', 'active')
          )
        ),
        inserted AS (
          INSERT INTO leasedialer_assignments (
            lead_id,
            agent_email,
            queue,
            status,
            assigned_at,
            created_at,
            updated_at
          )
          SELECT lead_id, $1, 'hotlead', 'queued', NOW(), NOW(), NOW()
          FROM available
          ON CONFLICT DO NOTHING
          RETURNING lead_id
        )
        SELECT COUNT(*)::int AS inserted_count
        FROM inserted
      `,
      [plan.agentEmail, ids],
    );
    insertedTotal += Number(result.rows[0]?.inserted_count || 0);
    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }

  return { insertedTotal, attemptedIds };
}

async function run() {
  const csvPath = path.resolve(
    process.argv[2] || "server/scripts/output/masterlead-full-2026-05-11T21-30-35-598Z.csv",
  );
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const explicitAgents = parseTargetAgents();
  const agents = explicitAgents.length ? explicitAgents : await getOnlineAgents();
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 30000,
    query_timeout: 30000,
  });

  await client.connect();
  try {
    const [profiles, queuedCounts, leadData] = await Promise.all([
      getProfiles(client, agents),
      getQueuedCounts(client, agents),
      collectLeadsByKey(csvPath),
    ]);

    const { plans, totalNeed } = buildAgentPlans(agents, profiles, queuedCounts);
    let totalInserted = 0;
    let assignedAgents = 0;
    let totalAttemptedIds = 0;

    for (const plan of plans) {
      const { insertedTotal, attemptedIds } = await insertAssignments(client, plan, leadData.byKey);
      totalInserted += insertedTotal;
      totalAttemptedIds += attemptedIds;
      if (insertedTotal > 0) assignedAgents += 1;
      console.log(
        JSON.stringify({
          event: "csv_assignment",
          agentEmail: plan.agentEmail,
          queuedBefore: plan.queuedBefore || 0,
          need: plan.need || 0,
          attemptedIds,
          inserted: insertedTotal,
          skipped: plan.skipped || null,
        }),
      );
    }

    console.log(
      JSON.stringify({
        event: "csv_assignment_complete",
        csvPath,
        onlineAgents: agents.length,
        scannedCsvRows: leadData.scanned,
        eligibleCsvRows: leadData.eligible,
        targetNeed: totalNeed,
        attemptedIds: totalAttemptedIds,
        assignedAgents,
        totalInserted,
        targetPerAgent: TARGET_PER_AGENT,
        insertChunk: INSERT_CHUNK,
        maxAgentAttempts: MAX_AGENT_ATTEMPTS,
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
