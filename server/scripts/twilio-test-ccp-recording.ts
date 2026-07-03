/**
 * Test that Call Connector Pro outbound path records: same flow as twilio-dial
 * (url=conference-connect), then verify Twilio creates a recording.
 *
 * Run: npx tsx server/scripts/twilio-test-ccp-recording.ts [--to +1XXXXXXXXXX] [--wait 90]
 *
 * Requires: app deployed so Twilio can fetch conference-connect TwiML when the call is answered.
 */

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from "../hardcoded-config";

const BASE = "https://api.twilio.com/2010-04-01";

function authHeader(): string {
  return "Basic " + Buffer.from(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN).toString("base64");
}

function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
    process.exit(1);
  }

  const fromNumber = TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    console.error("Set TWILIO_PHONE_NUMBER.");
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

  const baseUrl = process.env.BASE_URL || "https://aoirail-production.up.railway.app";
  const testAgentEmail = "test-recording@aoglobelife.com";
  const conferenceConnectUrl =
    baseUrl + "/api/twilio/conference-connect?agentEmail=" + encodeURIComponent(testAgentEmail);
  const recordingCallback = baseUrl + "/api/twilio/recording-status";
  const statusCallback = baseUrl + "/api/twilio/call-status?agentEmail=" + encodeURIComponent(testAgentEmail);

  console.log("Call Connector Pro recording test (conference-connect flow)");
  console.log("  From:", fromNumber);
  console.log("  To:  ", toNumber);
  console.log("  TwiML URL (when lead answers):", conferenceConnectUrl);
  console.log("  Recording: REST record=true + TwiML Dial record-from-answer\n");

  const body = formBody({
    From: fromNumber,
    To: toNumber,
    Url: conferenceConnectUrl,
    Method: "POST",
    Record: "true",
    RecordingStatusCallback: recordingCallback,
    RecordingStatusCallbackMethod: "POST",
    StatusCallback: statusCallback,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "initiated,ringing,answered,completed",
  });

  const createUrl = BASE + "/Accounts/" + TWILIO_ACCOUNT_SID + "/Calls.json";
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!createRes.ok) {
    console.error("Twilio create call failed:", createRes.status, await createRes.text());
    process.exit(1);
  }

  const call = (await createRes.json()) as { sid: string; status: string };
  const callSid = call.sid;
  console.log("Call created:", callSid);
  console.log("Answer the phone; you will hear hold music and join Call-Connector-Pro-Conference. Hang up when done.\n");

  const recordingsUrl = BASE + "/Accounts/" + TWILIO_ACCOUNT_SID + "/Calls/" + callSid + "/Recordings.json";
  const start = Date.now();
  let recordingSid: string | null = null;
  let recordingStatus: string | null = null;

  while ((Date.now() - start) / 1000 < waitSec) {
    await new Promise((r) => setTimeout(r, 5000));
    const recRes = await fetch(recordingsUrl, { headers: { Authorization: authHeader() } });
    if (!recRes.ok) continue;
    const recData = (await recRes.json()) as { recordings?: Array<{ sid: string; status: string }> };
    const list = recData.recordings ?? [];
    const completed = list.filter((r: { status?: string }) => (r.status || "") === "completed");

    if (list.length > 0) {
      const r = list[0];
      recordingSid = r.sid;
      recordingStatus = r.status;
    }
    if (completed.length > 0) {
      recordingSid = (completed[0] as { sid: string }).sid;
      recordingStatus = "completed";
      break;
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log("  [" + elapsed + "s] Recording status: " + (recordingStatus || "none yet"));
  }

  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log("");

  if (recordingStatus === "completed" && recordingSid) {
    console.log("CCP RECORDING TEST PASSED");
    console.log("  Call SID:     ", callSid);
    console.log("  Recording SID:", recordingSid);
    console.log("  Listen: " + baseUrl + "/api/twilio/play-recording/" + callSid);
    process.exit(0);
  }

  console.log("CCP RECORDING TEST FAILED (waited " + elapsed + "s)");
  console.log("  Call SID:", callSid);
  if (recordingSid) console.log("  Recording SID:", recordingSid, "status:", recordingStatus);
  else console.log("  No recording created. Ensure app is deployed so Twilio can reach " + conferenceConnectUrl);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
