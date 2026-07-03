const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) return `"${s.replace(/"/g, "\"\"")}"`;
  return s;
}

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 0,
    query_timeout: 0,
  });
  await client.connect();
  try {
    const badTargets = await client.query(`
      SELECT DISTINCT
        REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g') AS digits,
        RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS last10
      FROM twilio_call_logs t
      WHERE t.call_started_at >= NOW() - INTERVAL '30 days'
        AND lower(COALESCE(t.call_status, '')) = 'failed'
        AND lower(COALESCE(t.call_direction, '')) = 'outbound-dial'
        AND NOT (
          length(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g')) = 11
          AND REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g') LIKE '1%'
        )
    `);

    const last10Targets = Array.from(
      new Set((badTargets.rows || []).map((r) => String(r.last10 || "")).filter((v) => v.length === 10))
    );
    const rows = [];
    const batchSize = 300;
    for (let i = 0; i < last10Targets.length; i += batchSize) {
      const batch = last10Targets.slice(i, i + batchSize);
      const batchRows = await client.query(
        `
          SELECT
            COALESCE(NULLIF(BTRIM(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)) AS bad_last10,
            ml.id AS lead_id,
            ml.phone,
            COALESCE(NULLIF(BTRIM(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)) AS lead_last10,
            COALESCE(NULLIF(BTRIM(ml.taalk_state::text), ''), NULLIF(BTRIM(ml.state::text), ''), 'UNKNOWN') AS state_value,
            COALESCE(NULLIF(BTRIM(ml.taalk_market::text), ''), NULLIF(BTRIM(ml.market::text), ''), 'UNKNOWN') AS market_value,
            ml.cn_email,
            lower(trim(COALESCE(ml.cnresolution, 'pending'))) AS cnresolution_norm
          FROM masterlead ml
          WHERE COALESCE(NULLIF(BTRIM(ml.phone_last10), ''), RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)) = ANY($1::text[])
        `,
        [batch]
      );
      for (const r of batchRows.rows || []) rows.push(r);
    }

    const byState = new Map();
    const byMarket = new Map();
    const byMarketState = new Map();

    for (const r of rows) {
      const st = (r.state_value || "UNKNOWN").toString();
      const mk = (r.market_value || "UNKNOWN").toString();
      const ms = `${mk}__${st}`;
      byState.set(st, (byState.get(st) || 0) + 1);
      byMarket.set(mk, (byMarket.get(mk) || 0) + 1);
      byMarketState.set(ms, (byMarketState.get(ms) || 0) + 1);
    }

    const stateBreakdown = Array.from(byState.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([state, lead_rows]) => ({ state, lead_rows }));
    const marketBreakdown = Array.from(byMarket.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([market, lead_rows]) => ({ market, lead_rows }));
    const marketStateBreakdown = Array.from(byMarketState.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1000)
      .map(([key, lead_rows]) => {
        const [market, state] = key.split("__");
        return { market, state, lead_rows };
      });

    const outDir = path.resolve(process.cwd(), "server", "scripts", "reports");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outDir, `bad-failed-state-market-30d-${stamp}.json`);
    const csvPath = path.join(outDir, `bad-failed-state-market-30d-${stamp}.csv`);

    const payload = {
      generatedAtUtc: new Date().toISOString(),
      window: "30 days",
      matchedLeadRows: rows.length,
      distinctBadLast10Matched: new Set(rows.map((r) => r.bad_last10).filter(Boolean)).size,
      stateBreakdown,
      marketBreakdown,
      topMarketStatePairs: marketStateBreakdown,
      rows,
    };
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

    const header = [
      "bad_last10",
      "lead_id",
      "phone",
      "lead_last10",
      "state_value",
      "market_value",
      "cn_email",
      "cnresolution_norm",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.bad_last10,
          r.lead_id,
          r.phone,
          r.lead_last10,
          r.state_value,
          r.market_value,
          r.cn_email,
          r.cnresolution_norm,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    fs.writeFileSync(csvPath, lines.join("\n"), "utf8");

    console.log(
      JSON.stringify(
        {
          matchedLeadRows: payload.matchedLeadRows,
          distinctBadLast10Matched: payload.distinctBadLast10Matched,
          topStates: stateBreakdown.slice(0, 15),
          topMarkets: marketBreakdown.slice(0, 15),
          jsonReport: jsonPath,
          csvReport: csvPath,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

