/**
 * Import Submitted Applications from a CSV/TSV export — no pasting.
 * In the portal: export the report as CSV (all rows), save the file, then run this.
 *
 * Run: npx tsx server/scripts/import-from-csv.ts [path/to/export.csv]
 * Default: submitted-export.csv in project root
 *
 * Supports: header row (column order doesn't matter) or no header (columns by position).
 */

import * as fs from "fs";
import * as path from "path";
import { supabaseAdmin } from "../supabase";
import type { SubmittedApplicationRow } from "../submitted-applications";
import { computeAlp } from "../submitted-applications";

const CANONICAL_HEADERS = [
  "Insured",
  "Agent Release",
  "SGA Submit",
  "Tenure",
  "Policy #",
  "LOB",
  "CWA",
  "Submit Type",
  "NILICO Status",
  "Agent",
  "Office",
  "QA Specialist",
  "Director",
  "Telecheck",
  "Verification Result",
  "Submitted By",
  "MAC Status",
] as const;

const KEY_ALIASES: Record<string, number> = {};
CANONICAL_HEADERS.forEach((h, i) => {
  const k = h.toLowerCase().replace(/\s+/g, " ").trim();
  KEY_ALIASES[k] = i;
  KEY_ALIASES[h.toLowerCase().replace(/\s/g, "")] = i;
  if (h === "Policy #") {
    KEY_ALIASES["policy#"] = i;
    KEY_ALIASES["policynumber"] = i;
    KEY_ALIASES["policy number"] = i;
  }
});

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === sep) {
      out.push(cur.trim().replace(/^"|"$/g, ""));
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim().replace(/^"|"$/g, ""));
  return out;
}

function parseDate(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function buildRow(cells: string[], colIndex: number[]): SubmittedApplicationRow | null {
  const get = (i: number) => (i >= 0 && i < cells.length ? (cells[i] ?? "").trim() : null) || null;
  const policy = get(colIndex[4]);
  if (!policy || !/^209\d{5}$/.test(policy)) return null;
  return {
    insured: get(colIndex[0]),
    agent_release: parseDate(get(colIndex[1])) ?? get(colIndex[1]),
    sga_submit: parseDate(get(colIndex[2])) ?? get(colIndex[2]),
    tenure: get(colIndex[3]),
    policy_number: policy,
    lob: get(colIndex[5]),
    cwa: get(colIndex[6]),
    submit_type: get(colIndex[7]),
    nilico_status: get(colIndex[8]),
    agent: get(colIndex[9]),
    office: get(colIndex[10]),
    qa_specialist: get(colIndex[11]),
    director: get(colIndex[12]),
    telecheck: get(colIndex[13]),
    verification_result: get(colIndex[14]),
    submitted_by: get(colIndex[15]),
    mac_status: get(colIndex[16]),
  };
}

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client.");
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const inPath = args[0]
    ? path.resolve(process.cwd(), args[0])
    : path.join(process.cwd(), "submitted-export.csv");

  if (!fs.existsSync(inPath)) {
    console.error("File not found:", inPath);
    console.error("Export the Submitted Applications report as CSV from the portal, save it (e.g. as submitted-export.csv), then run:");
    console.error("  npx tsx server/scripts/import-from-csv.ts");
    process.exit(1);
  }

  const buf = fs.readFileSync(inPath);
  const content =
    buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString("utf16le").replace(/^\uFEFF/, "")
      : buf.toString("utf8").replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    console.error("No lines in file.");
    process.exit(1);
  }

  const sep = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = parseCsvLine(lines[0], sep);
  const firstLower = firstCells[0]?.toLowerCase().replace(/\s+/g, " ") ?? "";
  const isHeader =
    firstLower === "insured" ||
    /policy\s*#/i.test(lines[0]) ||
    firstCells.some((c) => KEY_ALIASES[c?.toLowerCase().replace(/\s+/g, " ").trim() ?? ""] !== undefined);

  let colIndex: number[];
  let start: number;

  if (isHeader && firstCells.length > 1) {
    colIndex = CANONICAL_HEADERS.map((_, i) => {
      const idx = firstCells.findIndex((cell) => {
        const k = (cell ?? "").toLowerCase().replace(/\s+/g, " ").trim();
        const noSp = k.replace(/\s/g, "");
        return KEY_ALIASES[k] === i || KEY_ALIASES[noSp] === i || (i === 4 && /policy/.test(k));
      });
      return idx >= 0 ? idx : -1;
    });
    if (colIndex[4] < 0) {
      const policyCol = firstCells.findIndex((c) => /policy\s*#?/i.test((c ?? "").trim()));
      if (policyCol >= 0) colIndex[4] = policyCol;
    }
    // Fallback: find column that has 209xxxxx in first data row
    if (colIndex[4] < 0 && lines.length > 1) {
      const row1 = parseCsvLine(lines[1], sep);
      const j = row1.findIndex((c) => /^209\d{5}$/.test((c ?? "").trim()));
      if (j >= 0) colIndex[4] = j;
    }
    start = 1;
  } else {
    colIndex = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    start = 0;
  }

  const rows: SubmittedApplicationRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], sep);
    const row = buildRow(cells, colIndex);
    if (row) rows.push(row);
  }

  console.log("Parsed %d rows from %s", rows.length, inPath);
  if (rows.length === 0) {
    console.log("No rows with policy numbers 209xxxxx to import.");
    return;
  }

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    const alp = computeAlp(row.lob, row.cwa);
    const payload = {
      insured: row.insured ?? null,
      agent_release: row.agent_release ?? null,
      sga_submit: row.sga_submit ?? null,
      tenure: row.tenure ?? null,
      policy_number: row.policy_number ?? null,
      lob: row.lob ?? null,
      cwa: row.cwa ?? null,
      alp: alp ?? null,
      submit_type: row.submit_type ?? null,
      nilico_status: row.nilico_status ?? null,
      agent: row.agent ?? null,
      office: row.office ?? null,
      qa_specialist: row.qa_specialist ?? null,
      director: row.director ?? null,
      telecheck: row.telecheck ?? null,
      verification_result: row.verification_result ?? null,
      submitted_by: row.submitted_by ?? null,
      mac_status: row.mac_status ?? null,
    };

    const { data: existing } = await supabaseAdmin
      .from("submitted_applications")
      .select("id")
      .eq("policy_number", payload.policy_number)
      .eq("sga_submit", payload.sga_submit)
      .maybeSingle();

    if (existing) {
      const { error: upErr } = await supabaseAdmin
        .from("submitted_applications")
        .update(payload)
        .eq("id", existing.id);
      if (!upErr) updated++;
      else console.error("Update failed policy_number=%s: %s", payload.policy_number, upErr.message);
    } else {
      const { error: inErr } = await supabaseAdmin.from("submitted_applications").insert(payload);
      if (!inErr) inserted++;
      else console.error("Insert failed policy_number=%s: %s", payload.policy_number, inErr.message);
    }
  }

  console.log("Done. Inserted: %d  Updated: %d  Total: %d", inserted, updated, rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
