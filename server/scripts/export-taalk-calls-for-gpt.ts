/**
 * Export Taalk call details from a CSV to GPT-ready artifacts.
 *
 * Default scope:
 * - group code: VBEU1
 * - exclude group: PAVET
 * - missing city only
 *
 * Usage:
 *   npx tsx server/scripts/export-taalk-calls-for-gpt.ts
 *   npx tsx server/scripts/export-taalk-calls-for-gpt.ts --csv="server/sql/1e186c90-5ca5-4915-868c-7092a85fd5a6.csv"
 *   npx tsx server/scripts/export-taalk-calls-for-gpt.ts --group=VBEU1 --missing-city-only=true
 *
 * Optional env:
 *   TAALK_API_KEY=...
 *   TAALK_DB=...
 */

import * as fs from "fs";
import * as path from "path";
import { createReadStream } from "fs";
import { createInterface } from "readline";

type CsvRow = Record<string, string>;
type TaalkCallResponse = { payload?: Record<string, unknown> };

const DEFAULT_CSV = path.join(
  process.cwd(),
  "server",
  "sql",
  "1e186c90-5ca5-4915-868c-7092a85fd5a6.csv",
);
const DEFAULT_DB = process.env.TAALK_DB || "michaelmandella";
const DEFAULT_GROUP = "VBEU1";
const EXCLUDE_GROUP = "PAVET";
const API_KEY =
  process.env.TAALK_API_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

function getArg(name: string): string | undefined {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length) : undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(v)) return true;
  if (["0", "false", "no", "n"].includes(v)) return false;
  return fallback;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let s = "";
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          s += '"';
          i += 2;
          continue;
        }
        if (line[i] === '"') break;
        s += line[i];
        i++;
      }
      if (line[i] === '"') i++;
      out.push(s);
      if (line[i] === ",") i++;
      continue;
    }
    let s = "";
    while (i < line.length && line[i] !== ",") {
      s += line[i];
      i++;
    }
    out.push(s.trim());
    if (line[i] === ",") i++;
  }
  return out;
}

async function readCsv(filePath: string): Promise<CsvRow[]> {
  const lines = await new Promise<string[]>((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
    const out: string[] = [];
    rl.on("line", (line) => out.push(line));
    rl.on("close", () => resolve(out));
    rl.on("error", reject);
  });
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCsvLine(lines[i]);
    const row: CsvRow = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = (cols[c] || "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function extractCallId(recordingUrl: string): string | null {
  const m = (recordingUrl || "").match(/\/api\/calls\/([^/]+)\/recording/i);
  return m ? m[1] : null;
}

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

async function fetchTaalkCall(callId: string, db: string): Promise<Record<string, unknown> | null> {
  const url = `https://api.taalk.ai/api/calls/${callId}?db=${encodeURIComponent(db)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as TaalkCallResponse;
  return (json.payload as Record<string, unknown>) || null;
}

async function main() {
  const csvPath = path.resolve(getArg("csv") || DEFAULT_CSV);
  const db = getArg("db") || DEFAULT_DB;
  const targetGroup = (getArg("group") || DEFAULT_GROUP).toUpperCase();
  const missingCityOnly = parseBoolean(getArg("missing-city-only"), true);

  if (!API_KEY) throw new Error("TAALK_API_KEY missing");
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  console.log(`\n📥 Reading CSV: ${csvPath}`);
  const rows = await readCsv(csvPath);
  console.log(`   Total rows: ${rows.length}`);

  const scoped = rows.filter((r) => {
    const group = (r["Taalk_GroupCode"] || "").toUpperCase();
    if (group !== targetGroup) return false;
    if (group === EXCLUDE_GROUP) return false;
    if (!missingCityOnly) return true;
    return !(r["Taalk_City"] || "").trim();
  });
  console.log(`   Scoped rows (group=${targetGroup}, missingCityOnly=${missingCityOnly}): ${scoped.length}`);

  const callIds = Array.from(
    new Set(
      scoped
        .map((r) => extractCallId(r["Recording"] || ""))
        .filter((x): x is string => Boolean(x)),
    ),
  );
  console.log(`   Unique Taalk call IDs: ${callIds.length}\n`);

  const taalkById = new Map<string, Record<string, unknown> | null>();
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < callIds.length; i++) {
    const id = callIds[i];
    try {
      const payload = await fetchTaalkCall(id, db);
      taalkById.set(id, payload);
      if (payload) ok++;
      else fail++;
    } catch {
      taalkById.set(id, null);
      fail++;
    }
    if ((i + 1) % 25 === 0 || i === callIds.length - 1) {
      console.log(`   [${i + 1}/${callIds.length}] fetched=${ok} failed=${fail}`);
    }
    if (i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  const enriched = scoped.map((r) => {
    const callId = extractCallId(r["Recording"] || "");
    const payload = callId ? taalkById.get(callId) || null : null;
    const params = (payload?.params || {}) as Record<string, unknown>;
    return {
      callId,
      date: r["Date"] || "",
      time: r["Time"] || "",
      name: r["Name"] || "",
      phone: normalizePhone(r["Phone"] || ""),
      declaredState: (r["Taalk_State"] || "").toUpperCase(),
      declaredCity: r["Taalk_City"] || "",
      groupCode: r["Taalk_GroupCode"] || "",
      transferStatus: r["Transfer Status"] || "",
      transferred: (r["Transferred"] || "").toUpperCase() === "YES",
      taalkStatus: String(payload?.status || ""),
      taalkReason: payload?.reason ?? null,
      taalkDurationMs: payload?.duration ?? null,
      taalkDurationAfterTransferMs: payload?.durationAfterTransfer ?? null,
      taalkCreatedAt: String(payload?.createdAt || ""),
      taalkParamsState: String(params["Taalk_State"] || ""),
      taalkParamsCity: String(params["Taalk_City"] || ""),
      taalkParamsGroupCode: String(params["Taalk_GroupCode"] || ""),
      taalkRaw: payload,
    };
  });

  const summary = {
    sourceCsv: csvPath,
    db,
    scope: { groupCode: targetGroup, missingCityOnly, excludedGroupCode: EXCLUDE_GROUP },
    counts: {
      csvRows: rows.length,
      scopedRows: scoped.length,
      uniqueCallIds: callIds.length,
      fetchedCalls: ok,
      failedCalls: fail,
      transferredRows: enriched.filter((e) => e.transferred).length,
      rowsWithTaalkPayload: enriched.filter((e) => e.taalkRaw).length,
    },
  };

  const outDir = path.join(process.cwd(), "server", "scripts", "output");
  await fs.promises.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `taalk-vbeu1-missing-city-${stamp}`;
  const summaryPath = path.join(outDir, `${base}-summary.json`);
  const jsonPath = path.join(outDir, `${base}-calls.json`);
  const promptPath = path.join(outDir, `${base}-gpt4-prompt.md`);

  await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  await fs.promises.writeFile(jsonPath, JSON.stringify(enriched, null, 2), "utf8");

  const prompt = `# GPT-4 Analysis Request

Use the attached JSON dataset to analyze call quality and data integrity for this exact scope:
- group code: ${targetGroup}
- city is missing
- exclude group code: ${EXCLUDE_GROUP}

## Tasks
1. Identify records where declared location fields look inconsistent with call metadata.
2. Find repeat patterns by state, area code, campaign, and transfer outcome.
3. Rank likely bad data clusters (high confidence first) and explain why.
4. Propose remediation rules we can automate (validation + correction workflow).
5. Provide a concise action plan: quick wins (today), medium-term (this week), and structural fixes.

## Output format
- Executive summary (5-10 bullets)
- Key findings table
- High-confidence anomaly list (top 100)
- Suggested validation rules (pseudocode)
- Risk notes / false-positive caveats

## Context summary (auto-generated)
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`
`;
  await fs.promises.writeFile(promptPath, prompt, "utf8");

  console.log("\n✅ Export complete");
  console.log(`- ${summaryPath}`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${promptPath}\n`);
}

main().catch((e) => {
  console.error("❌ Script failed:", e?.message || e);
  process.exit(1);
});

