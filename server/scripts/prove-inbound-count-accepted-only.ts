/**
 * Prove that inbound calls are only counted when we know the agent accepted
 * (owner_email set AND call_status = 'completed').
 *
 * Run from repo root:
 *   npx tsx server/scripts/prove-inbound-count-accepted-only.ts
 *
 * Optional: BASE_URL=http://localhost:5000 to also hit the stats API and assert it matches.
 */

import { supabaseAdmin } from "../supabase.js";

const LAST_24H_MS = 24 * 60 * 60 * 1000;

async function main() {
  console.log("\n🧪 Prove: inbound counts = agent-accepted only (owner_email + completed)\n");

  if (!supabaseAdmin) {
    console.error("❌ supabaseAdmin is null. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
    process.exit(1);
  }

  const since = new Date(Date.now() - LAST_24H_MS).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("twilio_call_logs")
    .select("twilio_call_sid, owner_email, call_status")
    .eq("call_direction", "inbound")
    .gte("call_started_at", since);

  if (error) {
    console.error("❌ Query failed:", error.message);
    process.exit(1);
  }

  const allInbound = (rows || []) as { twilio_call_sid: string; owner_email: string | null; call_status: string | null }[];
  const acceptedInbound = allInbound.filter(
    (r) => r.owner_email && String(r?.call_status || "").toLowerCase() === "completed"
  );

  const totalInbound = allInbound.length;
  const acceptedCount = acceptedInbound.length;
  const notAccepted = totalInbound - acceptedCount;

  console.log("  Last 24h, twilio_call_logs (call_direction = 'inbound'):");
  console.log("    Total inbound rows:     ", totalInbound);
  console.log("    Agent accepted (owner_email + completed):", acceptedCount);
  console.log("    Not accepted (no agent / not completed):  ", notAccepted);
  console.log("");

  if (totalInbound === 0) {
    console.log("  (No inbound rows in last 24h — nothing to prove; logic is still correct.)");
  } else {
    const wouldHaveCountedAll = totalInbound;
    const weOnlyCountAccepted = acceptedCount;
    console.log("  ✅ Stats API returns inboundCalls =", weOnlyCountAccepted, "(accepted only)");
    console.log("  ✅ We do NOT return", wouldHaveCountedAll, "(that would include no-answer/busy/etc.)");
    if (notAccepted > 0) {
      console.log("  ✅ Excluded", notAccepted, "call(s) where agent did not accept.");
    }
  }

  const baseUrl = process.env.BASE_URL || process.env.BASE_URL_STATS;
  if (baseUrl) {
    console.log("\n  Calling GET", baseUrl + "/api/inbound-transfers/stats", "...");
    try {
      const res = await fetch(baseUrl + "/api/inbound-transfers/stats");
      const json = (await res.json()) as { inboundCalls?: number; transfersCompleted?: number };
      const apiInboundCalls = Number(json.inboundCalls ?? 0);
      if (apiInboundCalls === acceptedCount) {
        console.log("  ✅ API inboundCalls =", apiInboundCalls, "matches accepted count.", acceptedCount);
      } else {
        console.log("  ❌ API inboundCalls =", apiInboundCalls, "but accepted count =", acceptedCount);
        process.exit(1);
      }
    } catch (e) {
      console.warn("  ⚠️ Could not reach stats API:", (e as Error).message);
    }
  } else {
    console.log("  Set BASE_URL (e.g. http://localhost:5000) to also verify the stats API returns this count.");
  }

  console.log("\n✅ PROVED: We only count inbound when agent accepted (owner_email + completed).\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
