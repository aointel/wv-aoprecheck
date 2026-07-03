/**
 * Test that outbound recording works: place one call with record=true, then verify
 * Twilio creates a recording for it. No server required (uses inline TwiML).
 *
 * Run: npx tsx server/scripts/twilio-test-recording.ts [--to +1XXXXXXXXXX] [--wait 90]
 *
 * Options:
 *   --to +1XXXXXXXXXX   Destination number (default: +15032018470)
 *   --wait 90           Max seconds to wait for recording to complete (default: 90)
 */

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from "../hardcoded-config";

const BASE = "https://api.twilio.com/2010-04-01";

function authHeader(): string {
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("❌ Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (e.g. in hardcoded-config).");
    process.exit(1);
  }

  const fromNumber = TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    console.error("❌ Set TWILIO_PHONE_NUMBER or env TWILIO_PHONE_NUMBER (caller id for test call).");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let toNumber = "+15032018470";
  let waitSec = 90;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--to" && args[i + 1]) {
      toNumber = args[i + 1];
      i++;
    } else if (args[i] === "--wait" && args[i + 1]) {
      waitSec = parseInt(args[i + 1], 10) || 90;
      i++;
    }
  }

  const recordingStatusCallback =
    process.env.BASE_URL || "https://aoirail-production.up.railway.app";
  const callbackUrl = `${recordingStatusCallback}/api/twilio/recording-status`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">This is a recording test. The call is being recorded. You can hang up now.</Say><Pause length="1"/><Hangup/></Response>`;

  console.log("Twilio recording test");
  console.log("  From:", fromNumber);
  console.log("  To:  ", toNumber);
  console.log("  Recording: true (REST + inline TwiML)\n");

  // 1) Create the call
  const createUrl = `${BASE}/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
  const body = formBody({
    From: fromNumber,
    To: toNumber,
    Twiml: twiml,
    Record: "true",
    RecordingStatusCallback: callbackUrl,
    RecordingStatusCallbackMethod: "POST",
  });

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    console.error("❌ Twilio create call failed:", createRes.status, text);
    process.exit(1);
  }

  const call = (await createRes.json()) as { sid: string; status: string };
  const callSid = call.sid;
  console.log("✅ Call created:", callSid);
  console.log("   Answer the phone, listen to the message, then hang up.\n");

  // 2) Poll for call completed, then for recording completed
  const recordingsUrl = `${BASE}/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}/Recordings.json`;
  const start = Date.now();
  let lastStatus = call.status;
  let recordingSid: string | null = null;
  let recordingStatus: string | null = null;
  let recordingUrl: string | null = null;

  while ((Date.now() - start) / 1000 < waitSec) {
    await new Promise((r) => setTimeout(r, 5000)); // poll every 5s

    const recRes = await fetch(recordingsUrl, { headers: { Authorization: authHeader() } });
    if (!recRes.ok) continue;
    const recData = (await recRes.json()) as {
      recordings?: Array<{ sid: string; status: string; uri?: string }>;
    };
    const list = recData.recordings ?? [];
    const completed = list.filter((r: any) => (r.status ?? r.Status) === "completed");
    const inProgress = list.filter((r: any) => (r.status ?? r.Status) === "in-progress");

    if (list.length > 0) {
      const r = list[0] as any;
      recordingSid = r.sid ?? r.Sid;
      recordingStatus = r.status ?? r.Status;
      if (r.uri) recordingUrl = r.uri.replace(/\.json$/, ".mp3");
    }

    if (completed.length > 0) {
      recordingSid = (completed[0] as any).sid ?? (completed[0] as any).Sid;
      recordingStatus = "completed";
      const uri = (completed[0] as any).uri;
      if (uri) recordingUrl = uri.replace(/\.json$/, ".mp3");
      break;
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    if (inProgress.length > 0) {
      console.log("   [" + elapsed + "s] Call has recording in progress, waiting for completed...");
    } else if (list.length > 0) {
      console.log("   [" + elapsed + "s] Recording status: " + (recordingStatus || "?"));
    } else {
      console.log("   [" + elapsed + "s] No recordings yet (call may still be in progress).");
    }
  }

  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log("");

  if (recordingStatus === "completed" && recordingSid) {
    console.log("✅ RECORDING TEST PASSED");
    console.log("   Twilio created a completed recording for this call.");
    console.log("   Call SID:    ", callSid);
    console.log("   Recording SID:", recordingSid);
    if (recordingUrl) {
      const mp3Url = BASE + "/Accounts/" + TWILIO_ACCOUNT_SID + "/Recordings/" + recordingSid + ".mp3";
      console.log("   Recording URL (with auth):", mp3Url);
    }
    console.log("\n   To listen: use your app's /api/twilio/play-recording/" + callSid + " or download from Twilio Console.");
    process.exit(0);
  }

  console.log("❌ RECORDING TEST FAILED (waited " + elapsed + "s)");
  console.log("   Call SID:", callSid);
  if (recordingSid) {
    console.log("   Recording SID:", recordingSid, "status:", recordingStatus || "?");
  } else {
    console.log("   No recording was created for this call on the Twilio account.");
  }
  console.log("\n   Check in Twilio Console:");
  console.log("   https://console.twilio.com/us1/monitor/logs/calls?accountSid=" + TWILIO_ACCOUNT_SID);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
