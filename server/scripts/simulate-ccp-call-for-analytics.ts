/**
 * Simulate a Call Connector Pro call so it appears in Call Analytics.
 * Inserts a test row into twilio_call_logs and taalk_call_analytics (same as
 * what the call-status webhook does when an outbound call completes).
 *
 * Run: npx tsx server/scripts/simulate-ccp-call-for-analytics.ts [--email agent@example.com]
 */

import { supabaseAdmin } from "../supabase";

function fakeCallSid(): string {
  const hex = "0123456789abcdef";
  let s = "CA";
  for (let i = 0; i < 32; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

async function main() {
  if (!supabaseAdmin) {
    console.error("Supabase admin not configured.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let agentEmail = "test-ccp@aoglobelife.com";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      agentEmail = args[i + 1];
      i++;
    }
  }

  const callSid = fakeCallSid();
  const now = new Date().toISOString();
  const callStarted = new Date(Date.now() - 120 * 1000).toISOString(); // 2 min ago

  console.log("Simulating CCP call for Call Analytics");
  console.log("  Call SID:  ", callSid);
  console.log("  Agent:     ", agentEmail);
  console.log("  To number: +15551234567 (test)\n");

  const { error: logErr } = await supabaseAdmin.from("twilio_call_logs").upsert(
    {
      twilio_call_sid: callSid,
      call_direction: "outbound",
      call_status: "completed",
      call_duration: 95,
      call_started_at: callStarted,
      call_ended_at: now,
      from_number: "+19142289324",
      to_number: "+15551234567",
      owner_email: agentEmail,
      agent_identity: "client:" + agentEmail,
      call_source: "call_connector_pro",
      metadata: { simulated: true, call_connector_pro: true },
    },
    { onConflict: "twilio_call_sid" }
  );

  if (logErr) {
    console.error("Failed to insert twilio_call_logs:", logErr);
    process.exit(1);
  }
  console.log("  Inserted twilio_call_logs row.");

  const { error: analyticsErr } = await supabaseAdmin.from("taalk_call_analytics").insert({
    billing_transaction_id: "twilio-" + callSid,
    taalk_call_id: callSid,
    agent_email: agentEmail,
    call_date: callStarted,
    call_duration: 95,
    analysis_status: "pending",
  });

  if (analyticsErr) {
    if (analyticsErr.code === "23505") {
      console.log("  taalk_call_analytics row already exists (duplicate), skipping insert.");
    } else {
      console.error("Failed to insert taalk_call_analytics:", analyticsErr);
      process.exit(1);
    }
  } else {
    console.log("  Inserted taalk_call_analytics placeholder.");
  }

  console.log("\nDone. Open Call Analytics (Taalk Transfers) and you should see this call:");
  console.log("  transaction_id: twilio-" + callSid);
  console.log("  agent_email:    " + agentEmail);
  console.log("  status:        Pending Analysis");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
