/**
 * Read raw paste (with UI chrome, repeated headers) and output clean tab-separated
 * header + data rows for parsePastedSubmittedApplications.
 * Usage:
 *   npx tsx extract-submitted-rows.ts <raw-paste.txt> [output-paste.txt]
 *   npx tsx extract-submitted-rows.ts page1.txt page2.txt ... -o submitted-apps-paste.txt
 * Multiple inputs are merged so you can paste each portal page into a file and combine them.
 */
import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("-o");
const outPath = outIdx >= 0 ? args[outIdx + 1] : args[2];
const rawPaths = outIdx >= 0 ? args.filter((_, i) => i < outIdx || i > outIdx + 1) : [args[0]];
if (!rawPaths[0]) {
  console.error("Usage: npx tsx extract-submitted-rows.ts <raw-paste.txt> [output-paste.txt]");
  console.error("   or: npx tsx extract-submitted-rows.ts page1.txt page2.txt ... -o out.txt");
  process.exit(1);
}

function readPath(p: string): string {
  const full = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  return fs.readFileSync(full, "utf8");
}

const raw = rawPaths.map(readPath).join("\n");
const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

const header =
  "Insured\tAgent Release\tSGA Submit\tTenure\tPolicy #\tLOB\tCWA\tSubmit Type\tNILICO Status\tAgent\tOffice\tQA Specialist\tDirector\tTelecheck\tVerification Result\tSubmitted By\tMAC Status";
const out: string[] = [header];
const policyRe = /^209\d{5}$/;
for (const line of lines) {
  if (!line.includes("\t")) continue;
  const cells = line.split("\t").map((c) => c.trim());
  if (cells.length < 9) continue;
  const first = (cells[0] ?? "").toLowerCase();
  if (first === "insured" || first === "agent release") continue;
  const policy = cells[4] ?? "";
  if (!policyRe.test(policy)) continue;
  out.push(line);
}
const text = out.join("\n") + "\n";
const dataRowCount = out.length - 1;
if (outPath) {
  const fullOut = path.isAbsolute(outPath) ? outPath : path.join(process.cwd(), outPath);
  fs.writeFileSync(fullOut, text, "utf8");
  console.error("Extracted %d data rows → %s", dataRowCount, fullOut);
} else {
  process.stdout.write(text);
}
