/**
 * Get one call recording from taalk_call_analytics (Taalk or Twilio analyzed calls).
 * Run: npx tsx server/scripts/get-one-analytics-recording.ts
 */

import { supabaseAdmin } from "../supabase";

async function main() {
  if (!supabaseAdmin) {
    console.error("❌ Supabase not configured.");
    process.exit(1);
  }

  const { data: rows, error } = await supabaseAdmin
    .from("taalk_call_analytics")
    .select("taalk_call_id, billing_transaction_id, recording_url, agent_email, call_date")
    .not("recording_url", "is", null)
    .neq("recording_url", "")
    .neq("recording_url", "PENDING")
    .order("call_date", { ascending: false })
    .limit(1);

  if (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log("No rows in taalk_call_analytics with a recording_url.");
    process.exit(0);
  }

  const r = rows[0];
  console.log("--- One call with recording (taalk_call_analytics) ---\n");
  console.log("taalk_call_id:        ", r.taalk_call_id);
  console.log("billing_transaction_id:", r.billing_transaction_id ?? "—");
  console.log("agent_email:          ", r.agent_email ?? "—");
  console.log("call_date:            ", r.call_date ?? "—");
  console.log("");
  console.log("To listen:");
  console.log("  1. In your app (dev or production), open in browser:");
  console.log(`     /api/call-analytics/recording/${r.taalk_call_id}`);
  console.log("     Example: https://<your-host>/api/call-analytics/recording/" + r.taalk_call_id);
  console.log("");
  if (r.recording_url) {
    console.log("  2. Direct URL (if playable in browser):");
    console.log("     " + (r.recording_url.length > 100 ? r.recording_url.substring(0, 100) + "..." : r.recording_url));
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
