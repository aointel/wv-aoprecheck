/**
 * Get one Twilio call recording URL so you can listen.
 * Run: npx tsx server/scripts/get-one-recording-url.ts
 *
 * Recordings are stored in twilio_call_logs.recording_url (or metadata.recording_url).
 * Play via: your app's /api/call-analytics/recording/<twilio_call_sid> (streams audio).
 */

import { supabaseAdmin } from "../supabase";

async function main() {
  if (!supabaseAdmin) {
    console.error("❌ Supabase not configured.");
    process.exit(1);
  }

  const { data: rows, error } = await supabaseAdmin
    .from("twilio_call_logs")
    .select("twilio_call_sid, to_number, owner_email, call_started_at, call_duration, recording_url, metadata")
    .not("recording_url", "is", null)
    .neq("recording_url", "")
    .order("call_started_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log("No calls with a saved recording_url in twilio_call_logs.");
    console.log("Recordings appear after the recording-status webhook runs (after call ends).");
    process.exit(0);
  }

  const row = rows[0];
  const recordingUrl = row.recording_url ?? (row.metadata && typeof row.metadata === "object" && (row.metadata as any).recording_url);

  console.log("--- One call with recording ---\n");
  console.log("twilio_call_sid:", row.twilio_call_sid);
  console.log("to_number:     ", row.to_number ?? "—");
  console.log("owner_email:   ", row.owner_email ?? "—");
  console.log("call_started:  ", row.call_started_at ?? "—");
  console.log("duration:      ", row.call_duration != null ? `${row.call_duration}s` : "—");
  console.log("");
  console.log("To listen:");
  console.log("  1. If your app is running (e.g. dev or production), open in browser:");
  console.log(`     /api/call-analytics/recording/${row.twilio_call_sid}`);
  console.log("     Full URL example: https://<your-host>/api/call-analytics/recording/" + row.twilio_call_sid);
  console.log("");
  if (recordingUrl && typeof recordingUrl === "string") {
    const isDirect = recordingUrl.startsWith("https://") && (recordingUrl.includes("supabase") || recordingUrl.includes("twilio"));
    console.log("  2. Direct recording_url (Supabase signed URLs open in browser; Twilio URLs need auth):");
    console.log("     " + recordingUrl.substring(0, 100) + (recordingUrl.length > 100 ? "..." : ""));
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
