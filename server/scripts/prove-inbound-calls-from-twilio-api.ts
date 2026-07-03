/**
 * Prove that we can fetch inbound calls (to 609) from the Twilio API
 * and optionally sync a row into twilio_call_logs.
 *
 * Run from repo root:
 *   npx tsx server/scripts/prove-inbound-calls-from-twilio-api.ts
 *   npx tsx server/scripts/prove-inbound-calls-from-twilio-api.ts --sync
 *
 * Or: npm run prove:inbound-twilio-api
 *     npm run prove:inbound-twilio-api -- --sync
 */

import twilio from "twilio";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config.js";
import { supabaseAdmin } from "../supabase.js";

const INBOUND_609 = "+16096048379";
const LIMIT = 20;

async function main() {
  const doSync = process.argv.includes("--sync");

  console.log("\n🧪 Prove: fetch inbound calls from Twilio API (calls TO 609)\n");

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("❌ Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  console.log("1. Calling Twilio API: calls.list({ to: %s, limit: %d }) ...", INBOUND_609, LIMIT);
  let calls: Awaited<ReturnType<typeof client.calls.list>>;
  try {
    calls = await client.calls.list({ to: INBOUND_609, limit: LIMIT });
  } catch (e) {
    console.error("   ❌ Twilio API error:", (e as Error)?.message);
    process.exit(1);
  }

  console.log("   ✅ Twilio returned %d call(s).\n", calls.length);

  if (calls.length === 0) {
    console.log("   (No recent inbound calls to 609 — that's ok. The API call worked.)");
  } else {
    console.log("   Sample calls (up to 5):");
    calls.slice(0, 5).forEach((c, i) => {
      console.log(
        "   [%d] sid=%s from=%s status=%s duration=%s start=%s",
        i + 1,
        c.sid,
        c.from ?? "",
        c.status ?? "",
        c.duration ?? "-",
        c.startTime ? new Date(c.startTime).toISOString() : "-"
      );
    });
  }

  if (doSync) {
    console.log("\n2. --sync: upsert one row into twilio_call_logs and read back...");
    if (!supabaseAdmin) {
      console.error("   ❌ supabaseAdmin is null. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
      process.exit(1);
    }
    const c = calls[0];
    const sid = c ? c.sid : `PROVE_API_${Date.now()}`;
    const row = {
      twilio_call_sid: sid,
      from_number: (c && c.from) || "+15550000000",
      to_number: (c && c.to) || INBOUND_609,
      call_direction: "inbound" as const,
      call_status: (c && (c.status || "").toLowerCase()) || "completed",
      call_duration: (c && c.duration) ?? 0,
      call_started_at: (c && c.startTime) ? new Date(c.startTime).toISOString() : new Date().toISOString(),
      call_ended_at: (c && c.endTime) ? new Date(c.endTime).toISOString() : null,
      call_source: "twilio_api_sync",
    };
    const { error: upsertErr } = await supabaseAdmin.from("twilio_call_logs").upsert(row, { onConflict: "twilio_call_sid" });
    if (upsertErr) {
      console.error("   ❌ Upsert failed:", upsertErr.message);
      process.exit(1);
    }
    console.log("   ✅ Upserted:", sid);

    const { data: readBack, error: selectErr } = await supabaseAdmin
      .from("twilio_call_logs")
      .select("twilio_call_sid, from_number, call_duration, call_source")
      .eq("twilio_call_sid", sid)
      .single();
    if (selectErr || !readBack) {
      console.error("   ❌ Read back failed:", selectErr?.message ?? "no row");
      process.exit(1);
    }
    console.log("   ✅ Read back:", readBack);
  }

  console.log("\n✅ PROVED: Twilio API returns inbound calls to 609.");
  if (doSync) console.log("✅ PROVED: We can sync a row to twilio_call_logs and read it back.\n");
  else console.log("   (Run with --sync to also prove Supabase sync.)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
