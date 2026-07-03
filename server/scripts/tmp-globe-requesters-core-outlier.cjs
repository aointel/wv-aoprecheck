const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

async function run() {
  const timezone = String(process.argv[2] || "America/Los_Angeles");
  const corePct = Number(process.argv[3] || 0.4); // state appears in >=40% of requesters
  const outlierPct = Number(process.argv[4] || 0.1); // state appears in <=10% of requesters

  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 120000,
    query_timeout: 120000,
  });
  await client.connect();
  try {
    const res = await client.query(
      `
      WITH bounds AS (
        SELECT
          (((now() AT TIME ZONE $1)::date)::timestamp AT TIME ZONE $1) AS start_ts,
          ((((now() AT TIME ZONE $1)::date + 1)::timestamp) AT TIME ZONE $1) AS end_ts
      ),
      requesters AS (
        SELECT DISTINCT lower(agent_email) AS agent_email
        FROM leasedialer_client_status lcs
        CROSS JOIN bounds b
        WHERE lcs.updated_at >= b.start_ts
          AND lcs.updated_at < b.end_ts
      ),
      latest_profiles AS (
        SELECT DISTINCT ON (lower(agent_email))
          lower(agent_email) AS agent_email,
          markets,
          states
        FROM agent_routing_profiles
        ORDER BY lower(agent_email), updated_at DESC
      ),
      globe_requesters AS (
        SELECT r.agent_email, lp.states
        FROM requesters r
        JOIN latest_profiles lp ON lp.agent_email = r.agent_email
        WHERE EXISTS (
          SELECT 1
          FROM unnest(COALESCE(lp.markets, ARRAY[]::text[])) m
          WHERE lower(regexp_replace(m, '\\s+', '', 'g')) LIKE '%globe%'
        )
      ),
      states_expanded AS (
        SELECT
          gr.agent_email,
          upper(regexp_replace(s, '[^A-Za-z]', '', 'g')) AS state
        FROM globe_requesters gr
        CROSS JOIN LATERAL unnest(COALESCE(gr.states, ARRAY[]::text[])) s
      ),
      states_clean AS (
        SELECT agent_email, state
        FROM states_expanded
        WHERE state ~ '^[A-Z]{2}$'
      ),
      state_counts AS (
        SELECT state, COUNT(DISTINCT agent_email)::int AS agent_count
        FROM states_clean
        GROUP BY state
      ),
      agent_state_counts AS (
        SELECT agent_email, COUNT(DISTINCT state)::int AS state_count
        FROM states_clean
        GROUP BY agent_email
      )
      SELECT
        (SELECT COUNT(*)::int FROM globe_requesters) AS globe_requesters,
        (SELECT json_agg(x ORDER BY x.agent_count DESC, x.state ASC)
         FROM (SELECT state, agent_count FROM state_counts ORDER BY agent_count DESC, state ASC LIMIT 20) x) AS top_states,
        (SELECT json_agg(y ORDER BY y.agent_count ASC, y.state ASC)
         FROM (SELECT state, agent_count FROM state_counts ORDER BY agent_count ASC, state ASC LIMIT 20) y) AS bottom_states,
        (SELECT json_agg(z ORDER BY z.agent_email ASC)
         FROM (SELECT agent_email, state_count FROM agent_state_counts ORDER BY agent_email ASC) z) AS agent_state_counts
      `,
      [timezone],
    );

    const row = res.rows[0] || {};
    const globeRequesters = Number(row.globe_requesters || 0);
    const topStates = Array.isArray(row.top_states) ? row.top_states : [];
    const bottomStates = Array.isArray(row.bottom_states) ? row.bottom_states : [];
    const agentStateCounts = Array.isArray(row.agent_state_counts) ? row.agent_state_counts : [];

    const stateCountMap = new Map();
    for (const s of topStates) stateCountMap.set(String(s.state), Number(s.agent_count || 0));
    for (const s of bottomStates) if (!stateCountMap.has(String(s.state))) stateCountMap.set(String(s.state), Number(s.agent_count || 0));

    const topStatesWithPct = topStates.map((s) => ({
      state: s.state,
      agent_count: Number(s.agent_count || 0),
      pct_of_requesters: globeRequesters > 0 ? Number((Number(s.agent_count || 0) / globeRequesters).toFixed(3)) : 0,
    }));

    const bottomStatesWithPct = bottomStates.map((s) => ({
      state: s.state,
      agent_count: Number(s.agent_count || 0),
      pct_of_requesters: globeRequesters > 0 ? Number((Number(s.agent_count || 0) / globeRequesters).toFixed(3)) : 0,
    }));

    const stateCountsAllKnown = [...stateCountMap.values()];
    const coreThresholdCount = Math.ceil(globeRequesters * corePct);
    const outlierThresholdCount = Math.floor(globeRequesters * outlierPct);
    const coreStatesKnown = [...stateCountMap.entries()].filter(([, c]) => c >= coreThresholdCount).map(([s]) => s);
    const outlierStatesKnown = [...stateCountMap.entries()].filter(([, c]) => c <= outlierThresholdCount).map(([s]) => s);

    const widths = agentStateCounts.map((a) => Number(a.state_count || 0)).sort((a, b) => a - b);
    const stats = {
      min: widths[0] || 0,
      p25: percentile(widths, 0.25),
      median: percentile(widths, 0.5),
      p75: percentile(widths, 0.75),
      max: widths[widths.length - 1] || 0,
      avg: widths.length ? Number((widths.reduce((x, y) => x + y, 0) / widths.length).toFixed(2)) : 0,
    };

    console.log(
      JSON.stringify(
        {
          timezone,
          globe_requesters: globeRequesters,
          thresholds: { core_pct: corePct, outlier_pct: outlierPct, core_count_min: coreThresholdCount, outlier_count_max: outlierThresholdCount },
          state_coverage: {
            top_states: topStatesWithPct,
            bottom_states: bottomStatesWithPct,
            core_states_count_known: coreStatesKnown.length,
            outlier_states_count_known: outlierStatesKnown.length,
            core_states_known: coreStatesKnown.sort(),
            outlier_states_known: outlierStatesKnown.sort(),
          },
          agent_state_width_distribution: stats,
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
