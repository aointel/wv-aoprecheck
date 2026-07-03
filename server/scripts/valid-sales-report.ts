/**
 * Sales = company submitted applications tied to a connect (billing) or booked (agent_dial_metrics).
 * Run: npx tsx server/scripts/valid-sales-report.ts [file.txt]   — parse file, match to connect/booked, return only tied rows
 * Or: npx tsx server/scripts/valid-sales-report.ts [--dateFrom=...] [--dateTo=...] [--csv]  — from DB (rows already matched)
 */

import * as fs from "fs";
import {
  getValidSales,
  parsePastedSubmittedApplications,
  isValidSale,
  matchSubmittedApplicationRow,
} from "../submitted-applications";

function parseArgs(): {
  file?: string;
  dateFrom?: string;
  dateTo?: string;
  agent?: string;
  csv: boolean;
  out?: string;
} {
  const args = process.argv.slice(2);
  let file: string | undefined;
  let dateFrom: string | undefined;
  let dateTo: string | undefined;
  let agent: string | undefined;
  let csv = false;
  let out: string | undefined;
  for (const a of args) {
    if (a === "--csv") {
      csv = true;
    } else if (a.startsWith("--dateFrom=")) {
      dateFrom = a.slice("--dateFrom=".length).trim();
    } else if (a.startsWith("--dateTo=")) {
      dateTo = a.slice("--dateTo=".length).trim();
    } else if (a.startsWith("--agent=")) {
      agent = a.slice("--agent=".length).trim();
    } else if (a.startsWith("--file=")) {
      file = a.slice("--file=".length).trim();
    } else if (a.startsWith("--out=")) {
      out = a.slice("--out=".length).trim();
    } else if (!a.startsWith("--")) {
      file = a.trim();
    }
  }
  return { file, dateFrom, dateTo, agent, csv, out };
}

/** From pasted file: only rows that match to a connect or booked (insured+agent+date ±30d). Exclude cancel/declined. */
async function validSalesFromParsed(
  rows: Array<Record<string, unknown>>
): Promise<{
  rows: Array<Record<string, unknown>>;
  totalCount: number;
  validCount: number;
  totalCwa: number;
}> {
  const notCancelDeclined = rows.filter((r) => isValidSale(r));
  const valid: Array<Record<string, unknown>> = [];
  for (const r of notCancelDeclined) {
    const match = await matchSubmittedApplicationRow({
      insured: (r.insured as string) ?? null,
      agent: (r.agent as string) ?? null,
      sga_submit: (r.sga_submit as string) ?? null,
      agent_release: (r.agent_release as string) ?? null,
    });
    if (!match) continue;
    valid.push({
      ...r,
      transfer_type: match.type,
      matched_billing_transaction_id: match.type === "aoi_connect" ? match.id : null,
      matched_agent_dial_metric_id: match.type === "ccpro_reached" ? match.id : null,
    });
  }
  let totalCwa = 0;
  valid.forEach((r) => {
    const cwa = r.cwa;
    if (cwa) {
      const num = parseFloat(String(cwa).replace(/[$,]/g, ""));
      if (!isNaN(num)) totalCwa += num;
    }
  });
  return {
    rows: valid,
    totalCount: rows.length,
    validCount: valid.length,
    totalCwa: Math.round(totalCwa * 100) / 100,
  };
}

const CSV_HEADERS = [
  "insured",
  "sga_submit",
  "policy_number",
  "lob",
  "cwa",
  "submit_type",
  "nilico_status",
  "agent",
  "office",
  "verification_result",
  "mac_status",
  "transfer_type",
  "matched_billing_transaction_id",
  "matched_agent_dial_metric_id",
];

const VALIDITY_CRITERIA =
  "Sales = portal rows tied to a connect or booked. Step 1: all connects/booked in date range (sga_submit ±30d). Step 2: name match = portal insured + masterlead (last_name) name variants vs lead_name (any case). Step 3: same agent OR same MGA. Exclude Cancel/Declined.";

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsvFile(
  result: { rows: Array<Record<string, unknown>>; totalCount: number; validCount: number; totalCwa: number },
  source: string,
  outPath: string
) {
  const lines: string[] = [
    "# valid-sales.csv",
    "# source," + source,
    "# criteria," + VALIDITY_CRITERIA,
    "# total_rows_in_source," + result.totalCount,
    "# valid_count," + result.validCount,
    "# total_cwa," + result.totalCwa,
    "#",
    CSV_HEADERS.join(","),
  ];
  for (const row of result.rows) {
    lines.push(CSV_HEADERS.map((h) => escapeCsvCell(row[h])).join(","));
  }
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
}

function outputResult(
  result: { rows: Array<Record<string, unknown>>; totalCount: number; validCount: number; totalCwa: number },
  csv: boolean,
  source: string,
  outPath: string | undefined
) {
  if (csv) {
    const path = outPath ?? "valid-sales.csv";
    writeCsvFile(result, source, path);
    console.log("Wrote " + path);
    console.log("# source: " + source);
    console.log("# " + VALIDITY_CRITERIA);
    return;
  }
  console.log(
    JSON.stringify(
      {
        totalCount: result.totalCount,
        validCount: result.validCount,
        totalCwa: result.totalCwa,
        data: result.rows,
      },
      null,
      2
    )
  );
}

async function main() {
  const { file, dateFrom, dateTo, agent, csv, out } = parseArgs();

  if (file) {
    const content = fs.readFileSync(file, "utf8");
    const rows = parsePastedSubmittedApplications(content);
    const result = await validSalesFromParsed(rows as Array<Record<string, unknown>>);
    const source = "file: " + file;
    outputResult(result, csv, source, out);
    return;
  }

  const result = await getValidSales({ dateFrom, dateTo, agent });
  const source =
    "submitted_applications (DB)" +
    (dateFrom && dateTo ? ` dateFrom=${dateFrom} dateTo=${dateTo}` : "") +
    (agent ? ` agent=${agent}` : "");
  outputResult(result, csv, source, out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
