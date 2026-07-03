const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function quantiles(values, q) {
  if (!values.length) return null;
  const idx = Math.floor((values.length - 1) * q);
  return values[idx];
}

async function run() {
  const day = String(process.argv[2] || "2026-05-15").trim();
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();
  try {
    const rowsRes = await client.query(
      `
        SELECT
          id,
          created_at,
          taalk_lead_id,
          COALESCE(NULLIF(upper(btrim(taalk_state::text)), ''), NULLIF(upper(btrim(state::text)), ''), '??') AS state,
          COALESCE(taalk_group_code, '') AS taalk_group_code
        FROM masterlead
        WHERE (created_at AT TIME ZONE 'America/Chicago')::date = $1::date
          AND COALESCE(btrim(taalk_lead_id::text), '') <> ''
      `,
      [day],
    );

    const rows = rowsRes.rows.map((r) => ({
      ...r,
      taalk_lead_num: toNum(r.taalk_lead_id),
    })).filter((r) => r.taalk_lead_num != null);

    const cohort = rows.filter((r) => r.state === "TX" && String(r.taalk_group_code).toUpperCase().includes("VN125"));
    const sameDayOther = rows.filter((r) => !(r.state === "TX" && String(r.taalk_group_code).toUpperCase().includes("VN125")));

    const cohortNums = cohort.map((r) => r.taalk_lead_num).sort((a, b) => a - b);
    const otherNums = sameDayOther.map((r) => r.taalk_lead_num).sort((a, b) => a - b);

    const cohortMin = cohortNums[0] ?? null;
    const cohortMax = cohortNums[cohortNums.length - 1] ?? null;

    const inRangeOthers = (cohortMin != null && cohortMax != null)
      ? sameDayOther.filter((r) => r.taalk_lead_num >= cohortMin && r.taalk_lead_num <= cohortMax)
      : [];

    const createdSorted = [...cohort].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let monotonicBreaks = 0;
    for (let i = 1; i < createdSorted.length; i++) {
      if (createdSorted[i].taalk_lead_num < createdSorted[i - 1].taalk_lead_num) monotonicBreaks++;
    }

    const gaps = [];
    for (let i = 1; i < cohortNums.length; i++) gaps.push(cohortNums[i] - cohortNums[i - 1]);
    gaps.sort((a, b) => a - b);

    const stateInterleaveCounts = inRangeOthers.reduce((acc, r) => {
      const s = r.state || "??";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

    const topInterleaveStates = Object.entries(stateInterleaveCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([state, count]) => ({ state, count }));

    console.log(
      JSON.stringify(
        {
          day,
          cohort: {
            definition: "TX + taalk_group_code contains VN125",
            rows_with_numeric_taalk_lead_id: cohortNums.length,
            taalk_lead_id_min: cohortMin,
            taalk_lead_id_max: cohortMax,
            taalk_lead_id_range_width: cohortMin != null && cohortMax != null ? cohortMax - cohortMin : null,
            monotonic_breaks_when_sorted_by_created_at: monotonicBreaks,
            gap_stats: {
              p50: quantiles(gaps, 0.5),
              p90: quantiles(gaps, 0.9),
              p99: quantiles(gaps, 0.99),
              max: gaps[gaps.length - 1] ?? null,
            },
          },
          same_day_comparison: {
            total_other_rows_with_numeric_taalk_lead_id: otherNums.length,
            other_rows_inside_tx_vn125_id_range: inRangeOthers.length,
            pct_other_inside_range:
              otherNums.length > 0 ? Number(((inRangeOthers.length / otherNums.length) * 100).toFixed(2)) : 0,
            top_interleaved_states_inside_range: topInterleaveStates,
          },
          sample_cohort_edges: {
            first_5: cohortNums.slice(0, 5),
            last_5: cohortNums.slice(-5),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
