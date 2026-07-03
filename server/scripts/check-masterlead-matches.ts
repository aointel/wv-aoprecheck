/**
 * Check which masterlead "booked" records match submitted applications (name + SGA ± 14 days).
 * Run: npx tsx server/scripts/check-masterlead-matches.ts [paste-file.txt]
 * Default: test-submitted-paste.txt
 */

import * as fs from "fs";
import * as path from "path";
import { leadNameMatchesVariants } from "../submitted-applications";
import { parsePastedSubmittedApplications } from "../submitted-applications";

const DATE_WINDOW_DAYS = 14;

function insuredToVariants(insured: string): { full: string[]; lastOnly: string[] } {
  const full: string[] = [];
  const lastOnly: string[] = [];
  if (!insured || !insured.trim()) return { full, lastOnly };
  const raw = insured.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const lastName = parts[0]!;
    const firstName = parts[1]!;
    const firstLast = `${firstName} ${lastName}`;
    const lastFirst = `${lastName} ${firstName}`;
    for (const form of [firstLast, lastFirst]) {
      full.push(form, form.toLowerCase(), form.toUpperCase());
      lastOnly.push(lastName, lastName.toLowerCase(), lastName.toUpperCase());
    }
  } else if (parts.length === 1) {
    lastOnly.push(parts[0]!, parts[0]!.toLowerCase(), parts[0]!.toUpperCase());
  }
  return { full: [...new Set(full)], lastOnly: [...new Set(lastOnly)] };
}

function withinWindow(sgaStr: string | null, eventStr: string | null): boolean {
  if (!sgaStr || !eventStr) return false;
  const sga = new Date(sgaStr);
  const ev = new Date(eventStr);
  if (isNaN(sga.getTime()) || isNaN(ev.getTime())) return false;
  const start = new Date(sga);
  start.setDate(start.getDate() - DATE_WINDOW_DAYS);
  const end = new Date(sga);
  end.setDate(end.getDate() + DATE_WINDOW_DAYS);
  return ev >= start && ev <= end;
}

// 23 masterlead records from user (cnresolution=booked, cn_email=chrislafond@aoglobelife.com)
const MASTERLEAD_BOOKED = [
  { id: 410881, first_name: "John", last_name: "Servinski", phone: "9897391282", updated_at: "2026-02-07 20:00:35.352" },
  { id: 412962, first_name: "Georgi", last_name: "Watson", phone: "3043952504", updated_at: "2026-02-07 19:55:05.874" },
  { id: 623858, first_name: "Debra", last_name: "Wallace", phone: "4796335903", updated_at: "2026-02-07 18:52:18.486" },
  { id: 654606, first_name: "Thomas A", last_name: "Saunders", phone: "9075391248", updated_at: "2026-02-07 18:52:18.486" },
  { id: 635792, first_name: "Craig", last_name: "Poston", phone: "5204789646", updated_at: "2026-02-07 18:52:18.486" },
  { id: 525409, first_name: "David", last_name: "Adams", phone: "7575357845", updated_at: "2026-02-07 18:52:18.485" },
  { id: 637191, first_name: "Dr. Darren", last_name: "Skinner", phone: "9082004990", updated_at: "2026-02-07 18:52:18.485" },
  { id: 603597, first_name: "Barney", last_name: "Green", phone: "6193580182", updated_at: "2026-02-07 18:52:18.485" },
  { id: 590281, first_name: "Melvin", last_name: "Pleasant", phone: "7329215090", updated_at: "2026-02-07 18:52:18.485" },
  { id: 573081, first_name: "MATHEW D", last_name: "KRAMER", phone: "9073109223", updated_at: "2026-02-07 18:52:18.485" },
  { id: 647406, first_name: "Ua", last_name: "Ba", phone: "8622906035", updated_at: "2026-02-07 18:52:18.485" },
  { id: 564956, first_name: "TEVA", last_name: "RABB", phone: "8622378012", updated_at: "2026-02-07 18:52:18.485" },
  { id: 689580, first_name: "Micky", last_name: "Grimm", phone: "4236610265", updated_at: "2026-02-07 18:52:18.485" },
  { id: 576486, first_name: "TIFFANY", last_name: "ANDERSON", phone: "3607318062", updated_at: "2026-02-07 18:52:18.485" },
  { id: 603653, first_name: "Joanna", last_name: "Miller", phone: "6052123222", updated_at: "2026-02-07 18:52:18.485" },
  { id: 691354, first_name: "Judy", last_name: "Cooney", phone: "4172291956", updated_at: "2026-02-06 23:27:33.273" },
  { id: 681717, first_name: "Dean", last_name: "Aakhus", phone: "7123311558", updated_at: "2026-02-06 23:16:01.854" },
  { id: 692295, first_name: "Matt", last_name: "Pickel", phone: "4252292376", updated_at: "2026-02-06 16:41:03.833" },
  { id: 692229, first_name: "Dan", last_name: "Pinto", phone: "2156691464", updated_at: "2026-02-06 14:55:18.398" },
  { id: 678830, first_name: "Jeff", last_name: "Savko", phone: "7024821594", updated_at: "2026-02-04 01:48:53.729" },
  { id: 665826, first_name: "Kathryn", last_name: "Mitchell", phone: "8045646180", updated_at: "2026-01-27 16:10:00.89" },
  { id: 651852, first_name: "Calvin", last_name: "Garrison", phone: "3073376350", updated_at: "2026-01-22 17:19:13.635" },
  { id: 637815, first_name: "john", last_name: "Hulstrom", phone: "5034128145", updated_at: "2026-01-22 01:26:54.016" },
];

async function main() {
  const fileArg = process.argv[2] || "test-submitted-paste.txt";
  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, "utf8");
  const rows = parsePastedSubmittedApplications(content);
  const submitted = rows.map((r) => ({
    insured: r.insured ?? "",
    sga_submit: r.sga_submit ?? null,
  }));
  console.log("Submitted applications: %d rows (from %s)\n", submitted.length, filePath);

  // Unique (insured, sga_submit) for matching
  const byInsuredSga = new Map<string, string[]>();
  for (const r of submitted) {
    if (!r.insured) continue;
    const sga = r.sga_submit || "";
    const key = r.insured;
    if (!byInsuredSga.has(key)) byInsuredSga.set(key, []);
    const sgas = byInsuredSga.get(key)!;
    if (!sgas.includes(sga)) sgas.push(sga);
  }

  console.log("--- Masterlead booked vs submitted (name + SGA ± 14 days) ---\n");
  let matchCount = 0;
  for (const ml of MASTERLEAD_BOOKED) {
    const leadName = [ml.first_name, ml.last_name].filter(Boolean).join(" ").trim();
    const variants = { full: [leadName, leadName.toLowerCase(), leadName.toUpperCase()], lastOnly: [ml.last_name, ml.last_name.toLowerCase(), ml.last_name.toUpperCase()] };
    const matches: { insured: string; sga_submit: string }[] = [];
    for (const [insured, sgaList] of byInsuredSga) {
      const subVariants = insuredToVariants(insured);
      if (!leadNameMatchesVariants(leadName, subVariants)) continue;
      for (const sga of sgaList) {
        if (withinWindow(sga, ml.updated_at)) matches.push({ insured, sga_submit: sga });
      }
    }
    const status = matches.length > 0 ? "MATCH" : "no match";
    if (matches.length > 0) matchCount++;
    console.log("%s id=%d %s %s | updated_at=%s", status, ml.id, ml.first_name, ml.last_name, ml.updated_at);
    for (const m of matches) console.log("    -> submitted: %s | SGA %s", m.insured, m.sga_submit);
  }
  console.log("\nTotal masterlead booked checked: %d | With at least one submitted match: %d", MASTERLEAD_BOOKED.length, matchCount);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
