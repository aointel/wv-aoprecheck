/**
 * Run matching for submitted_applications: link rows to billing_transactions (aoi_connect)
 * or agent_dial_metrics reached only (ccpro_reached). CCPRO = reached period, no booked.
 * Run: npx tsx server/scripts/run-submitted-apps-matching.ts
 * Resume from id 180: npx tsx server/scripts/run-submitted-apps-matching.ts 180
 * Recheck existing (rewrite or clear with current first-name logic): npx tsx server/scripts/run-submitted-apps-matching.ts recheck
 */

import { supabaseAdmin } from "../supabase";
import { runMatchingForSubmittedApplications } from "../submitted-applications";

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const recheckExisting = args.some((a) => a === "recheck" || a === "--recheck");
  const numericArg = args.find((a) => /^\d+$/.test(a));
  const startAfterId = numericArg != null ? parseInt(numericArg, 10) : undefined;
  if (numericArg != null && !Number.isFinite(startAfterId)) {
    console.error("Usage: npx tsx server/scripts/run-submitted-apps-matching.ts [startAfterId] | recheck [startAfterId]");
    process.exit(1);
  }

  if (recheckExisting) {
    console.log("Rechecking existing matched rows (will rewrite or clear with current logic)...");
  } else {
    console.log("Running matching (name + agent/MGA + SGA submit date window)...");
  }
  const result = await runMatchingForSubmittedApplications({
    startAfterId,
    recheckExisting,
  });
  console.log(
    "Done. Matched: %d (aoi_connect: %d, ccpro_reached: %d)%s",
    result.matched,
    result.aoi_connect,
    result.ccpro_reached ?? 0,
    result.cleared != null && result.cleared > 0 ? `, Cleared: ${result.cleared}` : ""
  );
  if (result.errors.length) console.error("Errors:", result.errors);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
