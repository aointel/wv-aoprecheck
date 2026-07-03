/**
 * Query Twilio directly for recent outbound calls and find ones with recordings.
 * No DB — uses only Twilio REST API.
 * Run: npx tsx server/scripts/twilio-list-calls-with-recordings.ts
 *
 * Options:
 *   --days 7       (default) last N days
 *   --download     download first recording to twilio-outbound-recording.mp3
 */

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config";
import * as fs from "fs";
import * as path from "path";

const OUT_FILE = path.join(process.cwd(), "twilio-outbound-recording.mp3");

function authHeader(): string {
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("❌ Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let days = 7;
  let doDownload = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10) || 7;
      i++;
    } else if (args[i] === "--download") {
      doDownload = true;
    }
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startMs = start.getTime();

  console.log("Querying Twilio directly for recent calls (last", days, "days)...\n");

  const base = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;
  const listUrl = `${base}/Calls.json?PageSize=100`;
  const res = await fetch(listUrl, { headers: { Authorization: authHeader() } });

  if (!res.ok) {
    console.error("❌ Twilio API error:", res.status, await res.text());
    process.exit(1);
  }

  const data = (await res.json()) as { calls?: Array<{ sid: string; to: string; from: string; direction: string; status: string; duration: string | null; date_created: string }> };
  let calls = data.calls ?? [];
  calls = calls.filter((c: any) => {
    const t = new Date(c.date_created || 0).getTime();
    return t >= startMs;
  });
  const outbound = calls.filter(
    (c: any) => (c.direction === "outbound-api" || c.direction === "outbound-dial") && (c.status === "completed" || c.status === "in-progress")
  );

  console.log("Total calls in range:", calls.length, "| Outbound (completed):", outbound.length);

  if (outbound.length === 0) {
    console.log("No outbound completed calls in that range.");
    process.exit(0);
  }

  const withRecording: Array<{ sid: string; to: string; from: string; duration: string; date_created: string; recording_sid: string }> = [];

  for (const call of outbound) {
    const recUrl = `${base}/Calls/${call.sid}/Recordings.json`;
    const recRes = await fetch(recUrl, { headers: { Authorization: authHeader() } });
    if (!recRes.ok) continue;
    const recData = (await recRes.json()) as { recordings?: Array<{ sid: string; status: string }> };
    const list = recData.recordings ?? [];
    const completed = list.filter((r: any) => (r.status ?? r.Status) === "completed");
    if (completed.length > 0) {
      withRecording.push({
        sid: call.sid,
        to: call.to ?? "—",
        from: call.from ?? "—",
        duration: call.duration ?? "—",
        date_created: call.date_created ?? "—",
        recording_sid: completed[0].sid ?? (completed[0] as any).Sid,
      });
    }
  }

  console.log("Calls with a completed recording:", withRecording.length, "\n");

  if (withRecording.length === 0) {
    console.log("None of those calls have a completed recording in Twilio yet.");
    process.exit(0);
  }

  withRecording.slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. ${c.sid}  to=${c.to}  from=${c.from}  duration=${c.duration}s  ${c.date_created}`);
  });
  if (withRecording.length > 10) console.log("... and", withRecording.length - 10, "more");

  console.log("\nListen in browser: GET /api/twilio/play-recording/" + withRecording[0].sid);

  if (doDownload && withRecording.length > 0) {
    const first = withRecording[0];
    const mp3Url = `${base}/Recordings/${first.recording_sid}.mp3`;
    const mp3Res = await fetch(mp3Url, { headers: { Authorization: authHeader() } });
    if (mp3Res.ok) {
      fs.writeFileSync(OUT_FILE, Buffer.from(await mp3Res.arrayBuffer()));
      console.log("\nDownloaded first recording to:", OUT_FILE);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
