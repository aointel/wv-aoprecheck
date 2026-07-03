import { pool } from "../db";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

type Row = {
  id: number;
  taalk_lead_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  state: string | null;
  taalk_state: string | null;
  market: string | null;
  taalk_market: string | null;
  groupcode?: string | null;
  group_code?: string | null;
  cnresolution: string | null;
  cn_email: string | null;
  updated_at: string | null;
};

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const marketArgRaw = String(
    process.argv.find((a) => a.startsWith("--market=")) || "--market=globe market",
  ).replace(/^--market=/, "");
  const marketNeedle = marketArgRaw.trim().toLowerCase();
  if (!marketNeedle) {
    throw new Error("Provide --market=<value>");
  }

  const colsRes = await pool.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'masterlead'
  `);
  const colSet = new Set(colsRes.rows.map((r) => r.column_name));

  const keyCols: string[] = [];
  if (colSet.has("groupcode")) keyCols.push("groupcode");
  if (colSet.has("group_code")) keyCols.push("group_code");
  if (colSet.has("taalk_market")) keyCols.push("taalk_market");
  if (colSet.has("market")) keyCols.push("market");
  if (keyCols.length === 0) {
    throw new Error("No key columns found (groupcode/group_code/taalk_market/market)");
  }
  const keyMatchSql = keyCols
    .map((c) => `lower(trim(coalesce(${c}::text, ''))) LIKE '%${marketNeedle.replace(/'/g, "''")}%'`)
    .join(" OR ");
  const extraKeySelect = keyCols
    .filter((c) => c !== "market" && c !== "taalk_market")
    .map((c) => `, ${c}`)
    .join("");

  const rowsRes = await pool.query<Row>(`
    SELECT
      id,
      taalk_lead_id,
      first_name,
      last_name,
      phone,
      state,
      taalk_state,
      market,
      taalk_market,
      cnresolution,
      cn_email,
      updated_at
      ${extraKeySelect}
    FROM masterlead
    WHERE (${keyMatchSql})
      AND (
        cnresolution IS NULL
        OR lower(trim(coalesce(cnresolution, ''))) = 'pending'
        OR trim(coalesce(cnresolution, '')) = ''
      )
    ORDER BY
      upper(coalesce(nullif(trim(state), ''), nullif(trim(taalk_state), ''), 'ZZ')),
      id
  `);

  const rows = rowsRes.rows;

  const stateCounts = new Map<string, number>();
  for (const r of rows) {
    const st = (r.state || r.taalk_state || "UNKNOWN").toUpperCase();
    stateCounts.set(st, (stateCounts.get(st) || 0) + 1);
  }

  const outputDir = join(process.cwd(), "server", "scripts", "output");
  mkdirSync(outputDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const marketSlug = marketNeedle.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const outputPath = join(outputDir, `${marketSlug || "market"}-pending-null-${ts}.csv`);

  const header = [
    "id",
    "taalk_lead_id",
    "first_name",
    "last_name",
    "phone",
    "state",
    "taalk_state",
    "market",
    "taalk_market",
    "group_key",
    "cnresolution",
    "cn_email",
    "updated_at",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    const groupKey = [r.groupcode, r.group_code, r.taalk_market, r.market]
      .map((v) => String(v || "").trim())
      .find((v) => v.toLowerCase().includes(marketNeedle)) || "";
    lines.push(
      [
        r.id,
        r.taalk_lead_id,
        r.first_name,
        r.last_name,
        r.phone,
        r.state,
        r.taalk_state,
        r.market,
        r.taalk_market,
        groupKey,
        r.cnresolution,
        r.cn_email,
        r.updated_at,
      ].map(csvEscape).join(","),
    );
  }
  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  const stateBreakdown = Array.from(stateCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, count]) => ({ state, count }));

  console.log(
    JSON.stringify(
      {
        keyColumnsUsed: keyCols,
        marketFilter: marketNeedle,
        totalRows: rows.length,
        stateBreakdown,
        outputPath,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err?.stack || err?.message || String(err));
    await pool.end().catch(() => undefined);
    process.exit(1);
  });

