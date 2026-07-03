/**
 * Find one Twilio OUTBOUND call and download its recording so you can listen.
 * Uses twilio_call_logs + Twilio API (not Taalk).
 * Run: npx tsx server/scripts/download-one-twilio-outbound-recording.ts
 *
 * Writes: twilio-outbound-recording.mp3 (in project root)
 */

import { supabaseAdmin } from "../supabase";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "../hardcoded-config";
import * as fs from "fs";
import * as path from "path";

const OUT_FILE = path.join(process.cwd(), "twilio-outbound-recording.mp3");

async function main() {
  if (!supabaseAdmin) {
    console.error("❌ Supabase not configured.");
    process.exit(1);
  }
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("❌ Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN).");
    process.exit(1);
  }

  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - 14);

  const { data: calls, error } = await supabaseAdmin
    .from("twilio_call_logs")
    .select("twilio_call_sid, to_number, owner_email, call_started_at, call_duration, call_status")
    .eq("call_direction", "outbound")
    .gte("call_started_at", dateLimit.toISOString())
    .order("call_started_at", { ascending: false })
    .limit(80);

  if (error) {
    console.error("❌ Error fetching twilio_call_logs:", error.message);
    process.exit(1);
  }
  if (!calls?.length) {
    console.log("No recent outbound Twilio calls in DB (last 14 days).");
    process.exit(0);
  }

  const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  let lastStatus = "";
  let lastListLength = 0;

  for (const call of calls) {
    const listUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${call.twilio_call_sid}/Recordings.json`;
    const res = await fetch(listUrl, { headers: { Authorization: `Basic ${authHeader}` } });
    if (!res.ok) {
      if (res.status === 401) {
        console.error("❌ Twilio returned 401. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN match the account that made these calls.");
        process.exit(1);
      }
      continue;
    }
    const data = (await res.json()) as { recordings?: Array<{ sid?: string; status?: string }>; Recordings?: Array<{ Sid?: string; Status?: string }> };
    const list = data.recordings ?? data.Recordings ?? [];
    lastListLength = list.length;
    if (list.length) lastStatus = (list[0] as any).status ?? (list[0] as any).Status ?? "";
    const completed = list.filter(
      (r: any) => (r.status ?? r.Status) === "completed"
    );
    if (completed.length === 0) continue;

    const rec = completed[0];
    const sid = rec.sid ?? (rec as any).Sid;
    if (!sid) continue;

    const mp3Url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${sid}.mp3`;
    const mp3Res = await fetch(mp3Url, { headers: { Authorization: `Basic ${authHeader}` } });
    if (!mp3Res.ok) {
      console.warn("Failed to download", call.twilio_call_sid, mp3Res.status);
      continue;
    }

    const buf = Buffer.from(await mp3Res.arrayBuffer());
    fs.writeFileSync(OUT_FILE, buf);
    console.log("--- Twilio outbound call recording (saved) ---\n");
    console.log("twilio_call_sid:", call.twilio_call_sid);
    console.log("to_number:     ", call.to_number ?? "—");
    console.log("owner_email:   ", call.owner_email ?? "—");
    console.log("call_started:  ", call.call_started_at ?? "—");
    console.log("duration:      ", call.call_duration != null ? `${call.call_duration}s` : "—");
    console.log("");
    console.log("Saved to:", OUT_FILE);
    console.log("Open that file to listen.");
    process.exit(0);
  }

  console.log("No completed recordings found for the last", calls.length, "outbound calls.");
  if (lastListLength > 0) console.log("(Twilio returned", lastListLength, "recording(s) with status:", lastStatus || "?", "- not 'completed' yet.)");
  else console.log("(Twilio API returned 0 recordings per call. Confirm calls were made with record:true and this Twilio account:", TWILIO_ACCOUNT_SID + ".)");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
