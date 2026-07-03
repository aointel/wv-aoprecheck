/**
 * Test that POSTing to /api/twilio/call-status and /api/twilio/recording-status
 * updates twilio_call_logs. Verifies by GETting /api/twilio/call-log-debug.
 *
 * Run: npx tsx server/scripts/test-twilio-call-log-webhooks.ts [BASE_URL]
 *
 * Example (server on localhost:5000):
 *   npx tsx server/scripts/test-twilio-call-log-webhooks.ts
 *
 * Example (deployed):
 *   npx tsx server/scripts/test-twilio-call-log-webhooks.ts https://aoirail-production.up.railway.app
 *
 * Server must have Supabase configured (SUPABASE_URL, SUPABASE_SERVICE_KEY) for twilio_call_logs to be updated.
 */

const BASE_URL = process.argv[2] || process.env.BASE_URL || "http://localhost:5000";

function formBody(params: Record<string, string | number>): string {
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    )
  ).toString();
}

async function main() {
  const testCallSid = `TEST_CALL_LOG_${Date.now()}`;
  let passed = 0;
  let failed = 0;

  console.log("\n🧪 Twilio call log webhook test");
  console.log("   BASE_URL:", BASE_URL);
  console.log("   CallSid:", testCallSid);
  console.log("");

  // --- 1. Call status webhook (outbound completed with duration) ---
  console.log("1. POST /api/twilio/call-status (outbound completed, duration=120)...");
  const callStatusBody = formBody({
    CallSid: testCallSid,
    CallStatus: "completed",
    CallDuration: "120",
    From: "client:test-webhook@aoglobelife.com",
    To: "+15551234567",
    Direction: "outbound",
  });
  const callStatusRes = await fetch(`${BASE_URL}/api/twilio/call-status`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: callStatusBody,
  });
  if (callStatusRes.status < 200 || callStatusRes.status > 299) {
    console.error("   ❌ call-status returned", callStatusRes.status, await callStatusRes.text());
    failed++;
  } else {
    console.log("   ✅ call-status returned 200");
    passed++;
  }

  await new Promise((r) => setTimeout(r, 400));

  console.log("2. GET /api/twilio/call-log-debug?callSid=...");
  const debugRes = await fetch(
    `${BASE_URL}/api/twilio/call-log-debug?callSid=${encodeURIComponent(testCallSid)}`
  );
  if (debugRes.status === 503) {
    console.warn("   ⚠️ call-log-debug returned 503 (no db) — set SUPABASE_URL and SUPABASE_SERVICE_KEY so the server can write to twilio_call_logs");
    failed++;
  } else if (debugRes.status === 404) {
    console.error("   ❌ Row not found in twilio_call_logs — webhook did not create/update row (is Supabase configured on the server?)");
    failed++;
  } else if (debugRes.status !== 200) {
    console.error("   ❌ call-log-debug returned", debugRes.status, await debugRes.text());
    failed++;
  } else {
    const row = (await debugRes.json()) as {
      twilio_call_sid: string;
      call_duration: number | null;
      call_status: string;
      recording_url?: string | null;
    };
    const durationOk = row.call_duration === 120;
    const statusOk = (row.call_status || "").toLowerCase() === "completed";
    if (!durationOk || !statusOk) {
      console.error("   ❌ twilio_call_logs row wrong: call_duration=", row.call_duration, "call_status=", row.call_status, "(expected 120, completed)");
      failed++;
    } else {
      console.log("   ✅ twilio_call_logs has call_duration=120, call_status=completed");
      passed++;
    }
  }

  // --- 3. Recording status webhook (fallback upsert when no row existed would have run; here row exists so UPDATE) ---
  console.log("3. POST /api/twilio/recording-status (completed, RecordingUrl)...");
  const recordingBody = formBody({
    CallSid: testCallSid,
    RecordingStatus: "completed",
    RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/ACxx/Recordings/RExx",
    RecordingSid: "RExx",
    RecordingDuration: "118",
  });
  const recRes = await fetch(`${BASE_URL}/api/twilio/recording-status`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: recordingBody,
  });
  if (recRes.status < 200 || recRes.status > 299) {
    console.error("   ❌ recording-status returned", recRes.status, await recRes.text());
    failed++;
  } else {
    console.log("   ✅ recording-status returned 200");
    passed++;
  }

  await new Promise((r) => setTimeout(r, 300));

  console.log("4. GET /api/twilio/call-log-debug again (recording_url should be set)...");
  const debugRes2 = await fetch(
    `${BASE_URL}/api/twilio/call-log-debug?callSid=${encodeURIComponent(testCallSid)}`
  );
  if (debugRes2.status !== 200) {
    console.error("   ❌ call-log-debug returned", debugRes2.status);
    failed++;
  } else {
    const row2 = (await debugRes2.json()) as { recording_url?: string | null };
    if (row2.recording_url) {
      console.log("   ✅ twilio_call_logs has recording_url set");
      passed++;
    } else {
      console.error("   ❌ recording_url not set in twilio_call_logs");
      failed++;
    }
  }

  console.log("");
  if (failed > 0) {
    console.log("❌ Result:", passed, "passed,", failed, "failed");
    process.exit(1);
  }
  console.log("✅ All checks passed. Twilio call-status and recording-status correctly update twilio_call_logs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
