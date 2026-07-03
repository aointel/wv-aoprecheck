/**
 * Analyze client responses to state-verification prompts from Taalk call messages.
 *
 * Input:
 * - JSON exported by export-taalk-calls-for-gpt.ts (default: latest taalk-vbeu1-missing-city-*-calls.json)
 *
 * Output:
 * - CSV with prompt + client response + verdict
 * - JSON summary
 *
 * Usage:
 *   npx tsx server/scripts/analyze-state-prompt-responses.ts
 *   npx tsx server/scripts/analyze-state-prompt-responses.ts --input="server/scripts/output/taalk-vbeu1-missing-city-...-calls.json"
 *   npx tsx server/scripts/analyze-state-prompt-responses.ts --db=michaelmandella
 */

import * as fs from "fs";
import * as path from "path";

type CallRow = {
  callId: string | null;
  declaredState?: string;
  name?: string;
  phone?: string;
};

type Message = {
  role?: string;
  content?: string;
  createdAt?: string;
};

const API_KEY =
  process.env.TAALK_API_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const DEFAULT_DB = process.env.TAALK_DB || "michaelmandella";

const STATE_MAP: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO",
  CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID",
  ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA",
  MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN",
  MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR",
  PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD",
  TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA",
  "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY", "DISTRICT OF COLUMBIA": "DC",
};

const STATE_NAMES = Object.keys(STATE_MAP).sort((a, b) => b.length - a.length);
const STATE_ABBRS = new Set(Object.values(STATE_MAP));

function getArg(name: string): string | undefined {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length) : undefined;
}

function latestExportFile(): string | null {
  const outDir = path.join(process.cwd(), "server", "scripts", "output");
  if (!fs.existsSync(outDir)) return null;
  const files = fs
    .readdirSync(outDir)
    .filter((f) => /^taalk-vbeu1-missing-city-.*-calls\.json$/i.test(f))
    .sort();
  if (!files.length) return null;
  return path.join(outDir, files[files.length - 1]);
}

function normalizeText(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function extractStateFromText(text: string): string | null {
  const upper = ` ${normalizeText(text).toUpperCase()} `;
  for (const nm of STATE_NAMES) {
    if (upper.includes(` ${nm} `)) return STATE_MAP[nm];
  }
  const tokens = upper.split(/[^A-Z]/).filter(Boolean);
  for (const t of tokens) {
    if (STATE_ABBRS.has(t)) return t;
  }
  return null;
}

function looksLikeStatePrompt(text: string): boolean {
  const t = normalizeText(text).toLowerCase();
  if (!t) return false;
  const hasStateWord = t.includes("state") || /living|live|located|out there in|in\s+[a-z ]+,\s*right\??/.test(t);
  const hasQuestion = t.includes("?") || t.includes("right") || t.includes("correct");
  return hasStateWord && hasQuestion;
}

function classifyResponse(response: string): "yes" | "no" | "unknown" {
  const t = normalizeText(response).toLowerCase();
  if (!t) return "unknown";
  if (/\b(yes|yeah|yep|correct|right|affirmative|that's right|that is right)\b/.test(t)) return "yes";
  if (/\b(no|nope|nah|wrong|not|negative)\b/.test(t)) return "no";
  return "unknown";
}

async function fetchMessages(callId: string, db: string): Promise<Message[]> {
  const url = `https://api.taalk.ai/api/calls/${callId}/messages?db=${encodeURIComponent(db)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { payload?: { messages?: Message[] } };
  return json?.payload?.messages || [];
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const input = getArg("input") ? path.resolve(getArg("input")!) : latestExportFile();
  const db = getArg("db") || DEFAULT_DB;
  if (!input || !fs.existsSync(input)) throw new Error("Input JSON not found. Run export-taalk-calls-for-gpt.ts first.");

  const rows = JSON.parse(fs.readFileSync(input, "utf8")) as CallRow[];
  const calls = rows.filter((r) => r.callId).map((r) => r as Required<Pick<CallRow, "callId">> & CallRow);
  console.log(`\n📥 Loaded calls: ${calls.length} from ${path.basename(input)}`);

  const analyzed: Array<Record<string, unknown>> = [];
  let withPrompt = 0;

  for (let i = 0; i < calls.length; i++) {
    const row = calls[i];
    const callId = String(row.callId);
    const declaredState = String(row.declaredState || "").toUpperCase();
    const messages = await fetchMessages(callId, db);

    let promptText = "";
    let promptedState = "";
    let responseText = "";
    let responseState = "";

    for (let m = 0; m < messages.length; m++) {
      const msg = messages[m];
      if ((msg.role || "").toLowerCase() !== "assistant") continue;
      const content = normalizeText(msg.content || "");
      if (!looksLikeStatePrompt(content)) continue;
      const extracted = extractStateFromText(content);
      if (!extracted && !content.toLowerCase().includes("state")) continue;
      promptText = content;
      promptedState = extracted || declaredState || "";

      for (let n = m + 1; n < messages.length; n++) {
        const nxt = messages[n];
        if ((nxt.role || "").toLowerCase() !== "user") continue;
        const c = normalizeText(nxt.content || "");
        if (!c) continue;
        responseText = c;
        responseState = extractStateFromText(c) || "";
        break;
      }
      break;
    }

    const responseClass = classifyResponse(responseText);
    let verdict = "unknown";
    if (promptText) {
      withPrompt++;
      if (responseState) {
        verdict = responseState === promptedState ? "match_explicit_state" : "mismatch_explicit_state";
      } else if (responseClass === "yes") {
        verdict = "match_yes";
      } else if (responseClass === "no") {
        verdict = "mismatch_no";
      } else {
        verdict = "unknown";
      }
    }

    analyzed.push({
      callId,
      name: row.name || "",
      phone: row.phone || "",
      declaredState,
      promptedState,
      promptText,
      responseText,
      responseClass,
      responseState,
      verdict,
    });

    if ((i + 1) % 50 === 0 || i === calls.length - 1) {
      console.log(`   [${i + 1}/${calls.length}] prompts_found=${withPrompt}`);
    }
    if (i % 15 === 14) await new Promise((r) => setTimeout(r, 120));
  }

  const summary = {
    inputFile: input,
    db,
    counts: {
      totalCallsAnalyzed: analyzed.length,
      promptsFound: analyzed.filter((r) => r.promptText).length,
      withUserResponse: analyzed.filter((r) => r.promptText && r.responseText).length,
      match_yes: analyzed.filter((r) => r.verdict === "match_yes").length,
      match_explicit_state: analyzed.filter((r) => r.verdict === "match_explicit_state").length,
      mismatch_no: analyzed.filter((r) => r.verdict === "mismatch_no").length,
      mismatch_explicit_state: analyzed.filter((r) => r.verdict === "mismatch_explicit_state").length,
      unknown: analyzed.filter((r) => r.verdict === "unknown").length,
    },
  };

  const outDir = path.join(process.cwd(), "server", "scripts", "output");
  await fs.promises.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `state-prompt-response-audit-${stamp}`;
  const summaryPath = path.join(outDir, `${base}-summary.json`);
  const jsonPath = path.join(outDir, `${base}.json`);
  const csvPath = path.join(outDir, `${base}.csv`);

  await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  await fs.promises.writeFile(jsonPath, JSON.stringify(analyzed, null, 2), "utf8");

  const headers = [
    "callId", "name", "phone", "declaredState", "promptedState",
    "promptText", "responseText", "responseClass", "responseState", "verdict",
  ];
  const lines = [headers.join(",")];
  for (const r of analyzed) {
    lines.push(headers.map((h) => csvEscape((r as any)[h])).join(","));
  }
  await fs.promises.writeFile(csvPath, lines.join("\n"), "utf8");

  console.log("\n✅ State prompt response audit complete");
  console.log(`- ${summaryPath}`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${csvPath}`);
  console.log(`\nSummary: ${JSON.stringify(summary.counts, null, 2)}\n`);
}

main().catch((e) => {
  console.error("❌ Script failed:", e?.message || e);
  process.exit(1);
});

