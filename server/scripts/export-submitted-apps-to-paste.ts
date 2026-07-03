/**
 * Export submitted_applications from Supabase to submitted-apps-paste.txt (same format as portal paste).
 * Optional date filter: --from 2026-02-04 --to 2026-02-11
 * Run: npx tsx server/scripts/export-submitted-apps-to-paste.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 */

import * as fs from "fs";
import * as path from "path";
import { supabaseAdmin } from "../supabase";

const HEADER =
  "Insured\tAgent Release\tSGA Submit\tTenure\tPolicy #\tLOB\tCWA\tSubmit Type\tNILICO Status\tAgent\tOffice\tQA Specialist\tDirector\tTelecheck\tVerification Result\tSubmitted By\tMAC Status";

function toPasteDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const am = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${mm}/${dd}/${yyyy} ${h12}:${m}:${s} ${am}`;
}

function escapeCell(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v).replace(/\t/g, " ").trim();
}

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let dateFrom: string | null = "2026-02-04";
  let dateTo: string | null = "2026-02-11";
  let all = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      dateFrom = args[++i];
    } else if (args[i] === "--to" && args[i + 1]) {
      dateTo = args[++i];
    } else if (args[i] === "--all") {
      all = true;
    }
  }

  let query = supabaseAdmin
    .from("submitted_applications")
    .select(
      "insured, agent_release, sga_submit, tenure, policy_number, lob, cwa, submit_type, nilico_status, agent, office, qa_specialist, director, telecheck, verification_result, submitted_by, mac_status"
    )
    .order("sga_submit", { ascending: true });

  if (!all && dateFrom && dateTo) {
    const start = new Date(dateFrom);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    query = query.gte("sga_submit", start.toISOString()).lte("sga_submit", end.toISOString());
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("Supabase error:", error);
    process.exit(1);
  }

  const outPath = path.join(process.cwd(), "submitted-apps-paste.txt");
  const lines = [HEADER];
  for (const r of rows ?? []) {
    const row = r as Record<string, string | null | undefined>;
    const sga = row.sga_submit;
    const agentRelease = row.agent_release;
    lines.push(
      [
        escapeCell(row.insured),
        sga ? toPasteDate(agentRelease ?? sga) : "",
        sga ? toPasteDate(sga) : "",
        escapeCell(row.tenure),
        escapeCell(row.policy_number),
        escapeCell(row.lob),
        escapeCell(row.cwa),
        escapeCell(row.submit_type),
        escapeCell(row.nilico_status),
        escapeCell(row.agent),
        escapeCell(row.office),
        escapeCell(row.qa_specialist),
        escapeCell(row.director),
        escapeCell(row.telecheck),
        escapeCell(row.verification_result),
        escapeCell(row.submitted_by),
        escapeCell(row.mac_status),
      ].join("\t")
    );
  }
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(
    "Exported %d rows to %s%s",
    lines.length - 1,
    outPath,
    all ? " (all)" : ` (SGA ${dateFrom} to ${dateTo})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
