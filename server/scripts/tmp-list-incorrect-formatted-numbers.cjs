const fs = require("fs");

const sourcePath = "server/scripts/reports/bad-failed-targets-30d-2026-05-20T18-15-49-034Z.csv";
const txt = fs.readFileSync(sourcePath, "utf8").trim();
const lines = txt.split(/\r?\n/);
lines.shift();

function getFormatIssue(digitsRaw) {
  const s = (digitsRaw || "").trim();
  if (!s) return "empty";
  if (!/^\d+$/.test(s)) return "non_numeric_chars";
  if (s.length < 11) return "not_e164_length_too_short";
  if (s.length > 11) return "not_e164_length_too_long";
  if (!s.startsWith("1")) return "not_nanp_country_code";
  if (/^1(\d)\1{9}$/.test(s)) return "placeholder_repeated_digits";
  if (
    /^1234567890$/.test(s) ||
    /^11234567890$/.test(s) ||
    /^10000000000$/.test(s) ||
    /^11111111111$/.test(s)
  ) {
    return "placeholder_sequence";
  }
  if (/^1555/.test(s)) return "likely_test_555";
  return "structurally_ok_but_reported_invalid";
}

const rows = [];
for (const line of lines) {
  if (!line.trim()) continue;
  const cols = line.split(",");
  const digits = cols[0] || "";
  const last10 = cols[1] || "";
  const failedCalls = Number(cols[2] || 0);
  rows.push({
    digits,
    last10,
    failedCalls,
    formatIssue: getFormatIssue(digits),
  });
}

const byReason = {};
for (const r of rows) byReason[r.formatIssue] = (byReason[r.formatIssue] || 0) + 1;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outCsvPath = `server/scripts/reports/incorrect-formatted-numbers-30d-${stamp}.csv`;
const outJsonPath = `server/scripts/reports/incorrect-formatted-numbers-30d-${stamp}.json`;

const outCsv = [
  "digits,last10,failed_calls,format_issue",
  ...rows.map((r) => `${r.digits},${r.last10},${r.failedCalls},${r.formatIssue}`),
].join("\n");
fs.writeFileSync(outCsvPath, outCsv, "utf8");

const summary = {
  sourcePath,
  totalIncorrectNumbers: rows.length,
  byReason,
  top20ByFailedCalls: [...rows].sort((a, b) => b.failedCalls - a.failedCalls).slice(0, 20),
  outCsvPath,
};
fs.writeFileSync(outJsonPath, JSON.stringify(summary, null, 2), "utf8");

console.log(JSON.stringify(summary, null, 2));
