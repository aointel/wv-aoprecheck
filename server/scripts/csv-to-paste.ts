/**
 * Convert a CSV/TSV export from the Submitted Apps report into submitted-apps-paste.txt.
 * Use this when you export the report (e.g. 421 rows) as CSV — no pasting.
 * Run: npx tsx server/scripts/csv-to-paste.ts [path/to/export.csv]
 * Default: submitted-export.csv in project root
 */

import * as fs from "fs";
import * as path from "path";

const HEADER =
  "Insured\tAgent Release\tSGA Submit\tTenure\tPolicy #\tLOB\tCWA\tSubmit Type\tNILICO Status\tAgent\tOffice\tQA Specialist\tDirector\tTelecheck\tVerification Result\tSubmitted By\tMAC Status";

const COL_ORDER = [
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
];

function parseCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === sep) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const inPath = args[0]
    ? path.resolve(process.cwd(), args[0])
    : path.join(process.cwd(), "submitted-export.csv");

  if (!fs.existsSync(inPath)) {
    console.error("File not found:", inPath);
    console.error("Export your report as CSV, save as submitted-export.csv (or pass path), then run this script.");
    process.exit(1);
  }

  const raw = fs.readFileSync(inPath, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    console.error("No lines in file.");
    process.exit(1);
  }

  const sep = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = parseCsvLine(lines[0], sep).map((c) => c.replace(/^"|"$/g, "").trim());
  const isHeader = firstCells[0]?.toLowerCase() === "insured" || /policy\s*#/i.test(lines[0]);
  const start = isHeader ? 1 : 0;

  const outPath = path.join(process.cwd(), "submitted-apps-paste.txt");
  const outLines: string[] = [HEADER];

  for (let i = start; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], sep).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cells.length < 5) continue;
    const policy = (cells[4] ?? "").trim();
    if (!/^209\d{5}$/.test(policy)) continue;
    outLines.push(cells.slice(0, 17).join("\t"));
  }

  fs.writeFileSync(outPath, outLines.join("\n") + "\n", "utf8");
  console.log("Wrote %d rows to %s (from %s)", outLines.length - 1, outPath, inPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
