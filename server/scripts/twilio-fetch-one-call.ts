/**
 * Fetch one Twilio call by SID: details + recordings. If this is a parent (agent leg), also fetch child (dial) calls and their recordings.
 * Run: npx tsx server/scripts/twilio-fetch-one-call.ts <CallSid>
 */
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config";

const CallSid = process.argv[2] || "CA7bb2f7330acd6e765aad740a24e6076e";

function authHeader(): string {
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function main() {
  const base = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
  const callUrl = `${base}/Calls/${CallSid}.json`;
  const recUrl = `${base}/Calls/${CallSid}/Recordings.json`;

  const [callRes, recRes] = await Promise.all([
    fetch(callUrl, { headers: { Authorization: authHeader() } }),
    fetch(recUrl, { headers: { Authorization: authHeader() } }),
  ]);

  if (!callRes.ok) {
    console.error("Call fetch failed:", callRes.status, await callRes.text());
    process.exit(1);
  }

  const call = (await callRes.json()) as any;
  const recData = recRes.ok ? ((await recRes.json()) as { recordings?: any[] }) : { recordings: [] };
  const recordings = recData.recordings ?? [];

  console.log("--- Call (this SID) ---");
  console.log("sid:        ", call.sid);
  console.log("from:       ", call.from);
  console.log("to:         ", call.to);
  console.log("direction:  ", call.direction);
  console.log("status:     ", call.status);
  console.log("duration:   ", call.duration);
  console.log("date_created:", call.date_created);
  console.log("parent_call_sid:", call.parent_call_sid ?? "(none)");
  console.log("");
  console.log("--- Recordings on THIS call leg ---");
  console.log("count:", recordings.length);
  recordings.forEach((r: any, i: number) => {
    console.log(`  [${i}] sid=${r.sid} status=${r.status} duration=${r.duration ?? "—"} date_created=${r.date_created ?? "—"}`);
  });
  if (recordings.length === 0) {
    console.log("  (None — recording was never started for this leg.)");
  }

  // If this looks like the parent (inbound client leg), list child calls (dial legs) and their recordings
  const isInboundClient = (call.direction === "inbound" || call.direction === "inbound-api") && String(call.from || "").startsWith("client:");
  if (isInboundClient) {
    const childListUrl = `${base}/Calls.json?ParentCallSid=${CallSid}`;
    const childRes = await fetch(childListUrl, { headers: { Authorization: authHeader() } });
    if (childRes.ok) {
      const childData = (await childRes.json()) as { calls?: any[] };
      const children = childData.calls ?? [];
      console.log("");
      console.log("--- Child calls (Dial legs; we store these in twilio_call_logs) ---");
      console.log("count:", children.length);
      for (const ch of children) {
        console.log("");
        console.log("  Child sid:  ", ch.sid);
        console.log("  to:         ", ch.to);
        console.log("  direction:  ", ch.direction);
        console.log("  status:     ", ch.status);
        console.log("  duration:   ", ch.duration);
        const chRecUrl = `${base}/Calls/${ch.sid}/Recordings.json`;
        const chRecRes = await fetch(chRecUrl, { headers: { Authorization: authHeader() } });
        const chRecData = chRecRes.ok ? ((await chRecRes.json()) as { recordings?: any[] }) : { recordings: [] };
        const chRecs = chRecData.recordings ?? [];
        console.log("  recordings: ", chRecs.length, chRecs.length ? chRecs.map((r: any) => r.status).join(", ") : "(none)");
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
