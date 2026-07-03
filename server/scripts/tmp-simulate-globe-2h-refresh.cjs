const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function normalizeStateCode(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const refreshHours = Math.max(1, Number(process.argv[3] || 2));
  const packsPerAgent = Math.max(1, Number(process.argv[4] || 3));
  const packSize = Math.max(1, Number(process.argv[5] || 100));
  const dailyLossRate = Math.max(0, Math.min(0.9, Number(process.argv[6] || 0)));

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });

  await client.connect();
  try {
    const callersRes = await client.query(
      `
      WITH bounds AS (
        SELECT
          (((now() AT TIME ZONE $1)::date)::timestamp AT TIME ZONE $1) AS start_ts,
          ((((now() AT TIME ZONE $1)::date + 1)::timestamp) AT TIME ZONE $1) AS end_ts
      ),
      latest_profiles AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets,
          states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      globe_agents AS (
        SELECT lp.agent_email, lp.states
        FROM latest_profiles lp
        WHERE EXISTS (
          SELECT 1
          FROM unnest(COALESCE(lp.markets, ARRAY[]::text[])) m
          WHERE lower(regexp_replace(m, '\\s+', '', 'g')) LIKE '%globe%'
        )
      ),
      dialers AS (
        SELECT DISTINCT lower(adm.agent_email) AS agent_email
        FROM agent_dial_metrics adm
        CROSS JOIN bounds b
        WHERE lower(trim(coalesce(adm.event_type, ''))) = 'dial'
          AND adm.event_timestamp >= b.start_ts
          AND adm.event_timestamp < b.end_ts
      ),
      first_requests AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          updated_at AS first_request_at
        FROM leasedialer_client_status
        CROSS JOIN bounds b
        WHERE updated_at >= b.start_ts
          AND updated_at < b.end_ts
        ORDER BY lower(agent_email), updated_at ASC
      )
      SELECT
        d.agent_email,
        fr.first_request_at,
        ga.states
      FROM dialers d
      JOIN globe_agents ga ON ga.agent_email = d.agent_email
      LEFT JOIN first_requests fr ON fr.agent_email = d.agent_email
      ORDER BY fr.first_request_at NULLS LAST, d.agent_email ASC
      `,
      [timezone],
    );

    const agents = callersRes.rows
      .map((r) => ({
        agent_email: String(r.agent_email || "").toLowerCase(),
        first_request_at: r.first_request_at ? new Date(r.first_request_at) : null,
        states: Array.isArray(r.states)
          ? r.states.map(normalizeStateCode).filter((s) => /^[A-Z]{2}$/.test(s))
          : [],
      }))
      .filter((r) => r.first_request_at && r.states.length > 0);

    const inventoryRes = await client.query(
      `
      WITH active AS (
        SELECT DISTINCT lead_id
        FROM leasedialer_assignments
        WHERE queue = 'hotlead'
          AND status IN ('queued','active')
      )
      SELECT
        COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) AS state,
        COUNT(*)::int AS available
      FROM masterlead ml
      LEFT JOIN active a ON a.lead_id = ml.id
      WHERE lower(trim(coalesce(ml.cnresolution, 'pending'))) IN ('pending', 'new', '', 'null')
        AND COALESCE(btrim(ml.taalk_lead_id::text), '') <> ''
        AND COALESCE(btrim(ml.cn_email), '') = ''
        AND a.lead_id IS NULL
        AND lower(regexp_replace(COALESCE(NULLIF(btrim(ml.taalk_market::text), ''), btrim(ml.market::text), ''), '\\s+', '', 'g')) LIKE '%globe%'
      GROUP BY 1
      HAVING COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) ~ '^[A-Z]{2}$'
      `,
    );

    const inventoryByState = new Map();
    for (const row of inventoryRes.rows) {
      const raw = Number(row.available || 0);
      const adjusted = Math.floor(raw * (1 - dailyLossRate));
      inventoryByState.set(normalizeStateCode(row.state), adjusted);
    }

    const events = [];
    for (const agent of agents) {
      for (let i = 0; i < packsPerAgent; i += 1) {
        events.push({
          agent_email: agent.agent_email,
          round: i + 1,
          event_time: new Date(agent.first_request_at.getTime() + i * refreshHours * 60 * 60 * 1000),
          states: agent.states,
        });
      }
    }
    events.sort((a, b) => a.event_time - b.event_time || a.agent_email.localeCompare(b.agent_email) || a.round - b.round);

    const agentTotals = new Map();
    const eventResults = [];
    let firstShortageAt = null;
    let totalAssigned = 0;

    for (const event of events) {
      let needed = packSize;
      let assigned = 0;
      const states = event.states
        .map((state) => ({ state, available: Number(inventoryByState.get(state) || 0) }))
        .filter((x) => x.available > 0)
        .sort((a, b) => b.available - a.available || a.state.localeCompare(b.state));

      for (const s of states) {
        if (needed <= 0) break;
        const current = Number(inventoryByState.get(s.state) || 0);
        if (current <= 0) continue;
        const take = Math.min(current, needed);
        inventoryByState.set(s.state, current - take);
        assigned += take;
        needed -= take;
      }

      if (assigned < packSize && !firstShortageAt) firstShortageAt = event.event_time;
      totalAssigned += assigned;
      agentTotals.set(event.agent_email, Number(agentTotals.get(event.agent_email) || 0) + assigned);
      eventResults.push({
        agent_email: event.agent_email,
        round: event.round,
        event_time: event.event_time.toISOString(),
        assigned,
        requested: packSize,
      });
    }

    const totals = Array.from(agentTotals.entries()).map(([agent_email, assigned]) => ({
      agent_email,
      assigned_total: assigned,
      needed_total: packsPerAgent * packSize,
      fully_fed_300: assigned >= packsPerAgent * packSize,
    }));

    const fullEvents = eventResults.filter((e) => e.assigned >= packSize).length;
    const partialEvents = eventResults.filter((e) => e.assigned > 0 && e.assigned < packSize).length;
    const zeroEvents = eventResults.filter((e) => e.assigned === 0).length;

    const fullyFedAgents = totals.filter((t) => t.fully_fed_300).length;
    const atLeast200 = totals.filter((t) => t.assigned_total >= 200).length;
    const atLeast100 = totals.filter((t) => t.assigned_total >= 100).length;

    console.log(
      JSON.stringify(
        {
          assumptions: {
            timezone,
            refresh_hours: refreshHours,
            packs_per_agent: packsPerAgent,
            pack_size: packSize,
            daily_loss_rate: dailyLossRate,
            model: "request-order timeline; state-constrained Globe pool; no replenishment added",
          },
          summary: {
            agents_considered: agents.length,
            events_total: events.length,
            total_assigned: totalAssigned,
            full_events: fullEvents,
            partial_events: partialEvents,
            zero_events: zeroEvents,
            fully_fed_agents_300: fullyFedAgents,
            agents_at_least_200: atLeast200,
            agents_at_least_100: atLeast100,
            first_shortage_at: firstShortageAt ? firstShortageAt.toISOString() : null,
          },
          not_fully_fed_agents: totals.filter((t) => !t.fully_fed_300).slice(0, 200),
          sample_event_results: eventResults.slice(0, 120),
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
