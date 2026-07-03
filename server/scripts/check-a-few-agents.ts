/**
 * Check agent resolution (portal agent string -> email, MGA).
 * Run: npx tsx server/scripts/check-a-few-agents.ts
 * Or pass specific agents (quoted): npx tsx server/scripts/check-a-few-agents.ts "BLASH, DIANKA - ZT730" "BEASLEY, DANIEL - BXQ71"
 * Or pass a number to check N from DB: npx tsx server/scripts/check-a-few-agents.ts 20
 */

import { supabaseAdmin } from "../supabase";
import { resolveAgentEmail, getMgaForEmail } from "../submitted-applications";

async function main() {
  if (!supabaseAdmin) {
    console.error("No Supabase admin client.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const numericArg = args.find((a) => /^\d+$/.test(a));
  const explicitAgents = args.filter((a) => a !== numericArg).map((a) => a.trim()).filter(Boolean);

  let toCheck: string[];

  if (explicitAgents.length > 0) {
    toCheck = explicitAgents;
    console.log("Checking %d agent(s) (provided on command line):\n", toCheck.length);
  } else {
    const limit = numericArg != null ? parseInt(numericArg, 10) : 10;
    const n = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10;

    const { data: rows, error } = await supabaseAdmin
      .from("submitted_applications")
      .select("agent")
      .not("agent", "is", null)
      .limit(5000);

    if (error) {
      console.error("Fetch error:", error.message);
      process.exit(1);
    }

    const agentStrings = [...new Set((rows ?? []).map((r) => (r.agent ?? "").trim()).filter(Boolean))];
    toCheck = agentStrings.slice(0, n);
    console.log("Checking %d agents (from %d distinct in table):\n", toCheck.length, agentStrings.length);
  }

  for (const agent of toCheck) {
    const email = await resolveAgentEmail(agent);
    const mga = email ? await getMgaForEmail(email) : null;
    console.log('  "%s"', agent);
    console.log("    -> email: %s", email ?? "(null)");
    console.log("    -> MGA:   %s\n", mga ?? "(null)");
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
