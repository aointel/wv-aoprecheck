/**
 * List last names (surnames) from submitted_applications with row counts, so you can
 * prioritize backfill/review for common last names (where last-name-only matching may be ambiguous).
 * Run: npx tsx server/scripts/list-common-last-names-submitted-apps.ts
 * Optional: npx tsx server/scripts/list-common-last-names-submitted-apps.ts 50   (min count to show)
 */

import { supabaseAdmin } from "../supabase";
import { getPortalSurname } from "../submitted-applications";

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client.");
    process.exit(1);
  }

  const minCount = process.argv[2] != null ? parseInt(process.argv[2], 10) : 5;
  const n = Number.isFinite(minCount) && minCount >= 0 ? minCount : 5;

  const { data: rows, error } = await supabaseAdmin
    .from("submitted_applications")
    .select("id, insured")
    .not("insured", "is", null);

  if (error) {
    console.error("Fetch error:", error.message);
    process.exit(1);
  }

  const bySurname = new Map<string, number>();
  for (const r of rows ?? []) {
    const surname = getPortalSurname(r.insured);
    if (!surname) continue;
    const key = surname.toLowerCase().trim();
    bySurname.set(key, (bySurname.get(key) ?? 0) + 1);
  }

  const sorted = [...bySurname.entries()]
    .filter(([, count]) => count >= n)
    .sort((a, b) => b[1] - a[1]);

  console.log("Surnames with at least %d rows (for common-name backfill priority):\n", n);
  console.log("  Surname (normalized)        Row count");
  console.log("  --------------------------- ---------");
  for (const [surname, count] of sorted) {
    console.log("  %-28s %d", surname, count);
  }
  console.log("\nTotal distinct surnames with count >= %d: %d", n, sorted.length);
  console.log("(Use first-name tightening for new matches; review/backfill these common last names as needed.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
