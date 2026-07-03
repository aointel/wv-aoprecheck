const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function normalizeMarketName(value) {
  const market = String(value ?? "").trim();
  const normalized = market.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("globe")) return "Globe Market";
  if (normalized.includes("veteran")) return "Veteran";
  return market;
}

function normalizeStateCode(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const limit = Math.max(1, Math.min(2000, Number(process.argv[3] || 500)));
  const mode = String(process.argv[4] || "all").toLowerCase(); // all | first
  const marketFilter = String(process.argv[5] || "").trim();
  const normalizedMarketFilter = marketFilter ? normalizeMarketName(marketFilter) : "";
  const forceRefillAll = String(process.argv[6] || "false").toLowerCase() === "true";
  const refillThreshold = 25;
  const targetQueued = 100;

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const requestOrderQueryAll = `
      SELECT
        lower(agent_email) AS agent_email,
        updated_at AS first_request_at,
        COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count
      FROM leasedialer_client_status
      WHERE updated_at::date = (NOW() AT TIME ZONE $1)::date
      ORDER BY updated_at ASC, lower(agent_email) ASC
      LIMIT $2
    `;

    const requestOrderQueryFirst = `
      WITH first_request AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          updated_at AS first_request_at,
          COALESCE(local_leased_lead_count, 0)::int AS local_leased_lead_count
        FROM leasedialer_client_status
        WHERE updated_at::date = (NOW() AT TIME ZONE $1)::date
        ORDER BY lower(agent_email), updated_at ASC
      )
      SELECT agent_email, first_request_at, local_leased_lead_count
      FROM first_request
      ORDER BY first_request_at ASC, agent_email ASC
      LIMIT $2
    `;

    const requestOrderRes = await client.query(mode === "first" ? requestOrderQueryFirst : requestOrderQueryAll, [timezone, limit]);

    const agents = requestOrderRes.rows;
    const agentEmails = agents.map((r) => String(r.agent_email || "").toLowerCase());

    const profileRes = await client.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets,
          states
        FROM agent_routing_profiles
        WHERE lower(agent_email) = ANY($1::text[])
        ORDER BY lower(agent_email), updated_at DESC
      )
      SELECT agent_email, markets, states
      FROM latest
      `,
      [agentEmails],
    );
    const profileMap = new Map(
      profileRes.rows.map((r) => [
        String(r.agent_email || "").toLowerCase(),
        {
          markets: Array.isArray(r.markets) ? r.markets.map(normalizeMarketName).filter(Boolean) : [],
          states: Array.isArray(r.states) ? r.states.map(normalizeStateCode).filter((s) => /^[A-Z]{2}$/.test(s)) : [],
        },
      ]),
    );

    const inventoryRes = await client.query(
      `
      WITH active AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued','active')
      ),
      base AS (
        SELECT
          CASE
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%' THEN 'Globe Market'
            WHEN lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%veteran%' THEN 'Veteran'
            ELSE COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), '')
          END AS market,
          COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state
        FROM masterlead ml
        LEFT JOIN active a ON a.lead_id = ml.id
        WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
          AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
          AND COALESCE(btrim(ml.cn_email), '') = ''
          AND a.lead_id IS NULL
      )
      SELECT market, state, COUNT(*)::int AS available
      FROM base
      WHERE market <> ''
        AND state ~ '^[A-Z]{2}$'
      GROUP BY market, state
      `,
    );

    const inventoryByKey = new Map();
    for (const row of inventoryRes.rows) {
      const market = normalizeMarketName(row.market);
      const state = normalizeStateCode(row.state);
      const key = `${market}||${state}`;
      inventoryByKey.set(key, Number(row.available || 0));
    }

    let totalAssignedSimulated = 0;
    let canFillTo100Count = 0;
    let skippedAtThreshold = 0;
    let missingProfile = 0;
    let filteredOutByMarket = 0;
    const reasonCounts = new Map();
    const results = [];

    const bumpReason = (reason) => {
      reasonCounts.set(reason, Number(reasonCounts.get(reason) || 0) + 1);
    };

    for (const req of agents) {
      const agentEmail = String(req.agent_email || "").toLowerCase();
      const atRequestCount = Number(req.local_leased_lead_count || 0);
      const profile = profileMap.get(agentEmail) || { markets: [], states: [] };

      if (normalizedMarketFilter && !profile.markets.includes(normalizedMarketFilter)) {
        filteredOutByMarket += 1;
        continue;
      }

      const result = {
        agent_email: agentEmail,
        first_request_at: req.first_request_at,
        local_leased_at_request: atRequestCount,
        markets: profile.markets,
        states: profile.states,
        simulated_assigned: 0,
        simulated_final_queue: atRequestCount,
        could_fill_to_100: false,
        reason: "ok",
      };

      if (profile.markets.length === 0 || profile.states.length === 0) {
        result.reason = "missing_profile";
        missingProfile += 1;
        bumpReason(result.reason);
        results.push(result);
        continue;
      }

      if (!forceRefillAll && atRequestCount >= refillThreshold) {
        result.reason = "skip_threshold_ge_25";
        skippedAtThreshold += 1;
        bumpReason(result.reason);
        results.push(result);
        continue;
      }

      let needed = Math.max(0, targetQueued - atRequestCount);
      if (needed <= 0) {
        result.reason = "already_at_or_above_target";
        result.could_fill_to_100 = true;
        canFillTo100Count += 1;
        bumpReason(result.reason);
        results.push(result);
        continue;
      }

      // Consume virtually, preferring scarcer states first.
      const candidateKeys = [];
      for (const market of profile.markets) {
        for (const state of profile.states) {
          const key = `${market}||${state}`;
          const available = Number(inventoryByKey.get(key) || 0);
          if (available > 0) {
            candidateKeys.push({ key, available, market, state });
          }
        }
      }
      candidateKeys.sort((a, b) => a.available - b.available || a.market.localeCompare(b.market) || a.state.localeCompare(b.state));

      let assigned = 0;
      for (const c of candidateKeys) {
        if (needed <= 0) break;
        const currentAvailable = Number(inventoryByKey.get(c.key) || 0);
        if (currentAvailable <= 0) continue;
        const take = Math.min(currentAvailable, needed);
        inventoryByKey.set(c.key, currentAvailable - take);
        needed -= take;
        assigned += take;
      }

      result.simulated_assigned = assigned;
      result.simulated_final_queue = atRequestCount + assigned;
      result.could_fill_to_100 = result.simulated_final_queue >= targetQueued;
      if (!result.could_fill_to_100) result.reason = "inventory_shortfall_for_profile";
      if (result.could_fill_to_100) canFillTo100Count += 1;
      bumpReason(result.reason);

      totalAssignedSimulated += assigned;
      results.push(result);
    }

    const shortfallAgents = results
      .filter((r) => !r.could_fill_to_100 && r.reason === "inventory_shortfall_for_profile")
      .map((r) => ({
        agent_email: r.agent_email,
        local_leased_at_request: r.local_leased_at_request,
        simulated_assigned: r.simulated_assigned,
        simulated_final_queue: r.simulated_final_queue,
        markets: r.markets,
        states: r.states,
      }))
      .slice(0, 100);

    console.log(
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          assumptions: {
            timezone,
            mode,
            market_filter: normalizedMarketFilter || "ALL",
            force_refill_all: forceRefillAll,
            simulated_now: "12:00 America/Los_Angeles",
            no_timezone_blocking: true,
            queue_trigger_threshold: refillThreshold,
            target_queue_size: targetQueued,
            source_inventory: "callable + taalk_lead_id + unowned + not queued/active",
            simulation_only: true,
          },
          summary: {
            request_events_total: agents.length,
            filtered_out_by_market: filteredOutByMarket,
            request_events_considered: results.length,
            can_fill_to_100_count: canFillTo100Count,
            cannot_fill_to_100_count: results.length - canFillTo100Count,
            skipped_due_to_threshold_ge_25: skippedAtThreshold,
            missing_profile: missingProfile,
            total_simulated_assigned: totalAssignedSimulated,
            reason_counts: Object.fromEntries(reasonCounts.entries()),
          },
          shortfall_agents: shortfallAgents,
          sample_results: results.slice(0, 120),
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
