/**
 * Prove we can INSERT and SELECT from Supabase twilio_call_logs.
 * Run from repo root: npx tsx server/scripts/prove-twilio-call-logs-supabase.ts
 */

import { supabaseAdmin } from "../supabase.js";

const TEST_SID = `PROVE_${Date.now()}`;

async function main() {
  console.log("\n🧪 Prove Supabase twilio_call_logs write/read\n");

  if (!supabaseAdmin) {
    console.error("❌ supabaseAdmin is null. Set SUPABASE_URL and SUPABASE_SERVICE_KEY (or use hardcoded-config).");
    process.exit(1);
  }

  console.log("1. INSERT one row into twilio_call_logs...");
  const row = {
    twilio_call_sid: TEST_SID,
    call_direction: "outbound",
    call_status: "completed",
    call_duration: 99,
    call_started_at: new Date().toISOString(),
    call_ended_at: new Date().toISOString(),
    owner_email: "prove-test@aoglobelife.com",
    from_number: "+15550001111",
    to_number: "+15551234567",
    call_source: "prove_twilio_call_logs_script",
  };

  const { data: insertData, error: insertErr } = await supabaseAdmin
    .from("twilio_call_logs")
    .upsert(row, { onConflict: "twilio_call_sid" })
    .select("twilio_call_sid, call_duration, call_status")
    .single();

  if (insertErr) {
    console.error("   ❌ INSERT failed:", insertErr.message);
    console.error("   Code:", insertErr.code, "Details:", insertErr.details);
    process.exit(1);
  }
  console.log("   ✅ Inserted:", insertData);

  console.log("2. SELECT same row back...");
  const { data: selected, error: selectErr } = await supabaseAdmin
    .from("twilio_call_logs")
    .select("twilio_call_sid, call_duration, call_status, owner_email, call_source")
    .eq("twilio_call_sid", TEST_SID)
    .single();

  if (selectErr) {
    console.error("   ❌ SELECT failed:", selectErr.message);
    process.exit(1);
  }
  if (!selected) {
    console.error("   ❌ SELECT returned no row");
    process.exit(1);
  }
  console.log("   ✅ Read back:", selected);

  const ok =
    selected.twilio_call_sid === TEST_SID &&
    selected.call_duration === 99 &&
    (selected.call_status || "").toLowerCase() === "completed";
  if (!ok) {
    console.error("   ❌ Data mismatch");
    process.exit(1);
  }

  console.log("\n✅ PROVED: We can save and read an entry in Supabase twilio_call_logs.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
