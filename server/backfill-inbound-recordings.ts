/**
 * backfill-inbound-recordings.ts
 *
 * Strategy: pull ALL recordings from Twilio (paginated), then for each one
 * try to match it to a taskrouter_inbound row in our DB via:
 *   1. metadata->>worker_call_sid  = recording.callSid  (primary — dequeue recordings)
 *   2. twilio_call_sid             = recording.callSid  (direct / conference legs)
 *   3. Duration + time proximity fallback (within 30s, same duration ± 5s)
 *
 * Run:  npx tsx server/backfill-inbound-recordings.ts
 */

import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const TWILIO_ACCOUNT_SID  = "AC25d37aa41aed0df4fddd81ecf7abf00d";
const TWILIO_AUTH_TOKEN   = "b275d646252457344ff62528e3538ea9";
const SUPABASE_URL        = "https://ycztjetxwpfgtrzeyytt.supabase.co";
const SUPABASE_SERVICE_KEY = "sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd";

const tw = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const DELAY_MS   = 200;
const MIN_DUR    = 10;  // ignore recordings under 10 seconds (noise/test calls)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Load all unmatched inbound calls from DB into a lookup map ──────────────

interface DbRow {
  id: number;
  twilio_call_sid: string;
  call_duration: number;
  call_started_at: string;
  metadata: Record<string, unknown>;
}

async function loadDbRows(): Promise<DbRow[]> {
  console.log("📥  Loading unmatched taskrouter_inbound calls from DB ...");
  const all: DbRow[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("twilio_call_logs")
      .select("id, twilio_call_sid, call_duration, call_started_at, metadata")
      .eq("call_source", "taskrouter_inbound")
      .is("recording_url", null)
      .gt("call_duration", 0)
      .order("call_started_at", { ascending: false })
      .range(offset, offset + 499);
    if (error) { console.error("DB error:", error); break; }
    if (!data || data.length === 0) break;
    for (const r of data) {
      const meta: Record<string, unknown> =
        r.metadata && typeof r.metadata === "object" ? r.metadata :
        typeof r.metadata === "string" ? JSON.parse(r.metadata || "{}") : {};
      all.push({ ...r, metadata: meta });
    }
    if (data.length < 500) break;
    offset += 500;
  }
  console.log(`   → ${all.length} unmatched calls loaded`);
  return all;
}

// Build lookup maps
function buildMaps(rows: DbRow[]) {
  const byWorkerSid = new Map<string, DbRow>();   // metadata.worker_call_sid → row
  const byCallSid   = new Map<string, DbRow>();   // twilio_call_sid → row
  const byTime: DbRow[] = [];                      // all rows with valid timestamps for fuzzy match

  for (const r of rows) {
    const wSid = r.metadata.worker_call_sid as string | undefined;
    if (wSid) byWorkerSid.set(wSid, r);
    byCallSid.set(r.twilio_call_sid, r);
    if (r.call_started_at) byTime.push(r);
  }
  return { byWorkerSid, byCallSid, byTime };
}

function fuzzyMatch(rows: DbRow[], recDate: Date, recDurSec: number): DbRow | null {
  // Match by: recording created within 60s of call start + duration within 10% or 15s
  const recMs = recDate.getTime();
  let best: DbRow | null = null;
  let bestDelta = Infinity;

  for (const r of rows) {
    const callMs = new Date(r.call_started_at).getTime();
    const timeDelta = Math.abs(recMs - callMs);
    if (timeDelta > 120_000) continue;  // more than 2 min apart — skip

    const durDelta = Math.abs(r.call_duration - recDurSec);
    if (durDelta > Math.max(15, r.call_duration * 0.1)) continue;

    const score = timeDelta / 1000 + durDelta;
    if (score < bestDelta) { bestDelta = score; best = r; }
  }
  return best;
}

// ── Update DB row ────────────────────────────────────────────────────────────

async function applyRecording(row: DbRow, recordingUrl: string, recordingSid: string): Promise<void> {
  const updatedMeta = { ...row.metadata, recording_url: recordingUrl, recording_sid: recordingSid };
  const { error } = await sb
    .from("twilio_call_logs")
    .update({ recording_url: recordingUrl, metadata: updatedMeta })
    .eq("twilio_call_sid", row.twilio_call_sid);
  if (error) throw new Error(error.message);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const rows  = await loadDbRows();
  const { byWorkerSid, byCallSid, byTime } = buildMaps(rows);
  const matched = new Set<string>(); // twilio_call_sids already updated this run

  let processed  = 0;
  let updated    = 0;
  let skipped    = 0;
  let noMatch    = 0;

  console.log("\n🔄  Paging through Twilio recordings (newest first) ...\n");

  // Twilio recording list — paginate manually using pageToken / nextPageUri
  let pageUri: string | null = null;
  const PAGE_SIZE = 100;

  while (true) {
    let recs: twilio.RecordingInstance[];

    if (pageUri === null) {
      recs = await tw.recordings.list({ limit: PAGE_SIZE, status: "completed" });
    } else {
      // Use the raw HTTP helper for subsequent pages
      const resp = await tw.request({ method: "GET", uri: pageUri });
      const body = resp.body as { recordings?: unknown[]; next_page_uri?: string };
      pageUri = body.next_page_uri ? `https://api.twilio.com${body.next_page_uri}` : null;
      recs = ((body.recordings ?? []) as twilio.RecordingInstance[]);
    }

    if (!recs || recs.length === 0) break;

    for (const rec of recs) {
      const durSec = parseInt(rec.duration as unknown as string, 10) || 0;
      if (durSec < MIN_DUR) { skipped++; continue; }
      processed++;

      const recCallSid = rec.callSid as string;
      const recUrl = `https://api.twilio.com${(rec.uri as string).replace(".json", ".mp3")}`;
      const recDate = rec.dateCreated as Date;

      // 1. Worker SID match
      let match = byWorkerSid.get(recCallSid);
      // 2. Direct call SID match
      if (!match) match = byCallSid.get(recCallSid);
      // 3. Fuzzy time+duration match
      if (!match) match = fuzzyMatch(byTime, recDate, durSec) ?? undefined;

      if (!match) { noMatch++; continue; }
      if (matched.has(match.twilio_call_sid)) continue;

      process.stdout.write(
        `  REC ${rec.sid}  dur=${durSec}s  → ${match.twilio_call_sid}  `
      );

      try {
        await applyRecording(match, recUrl, rec.sid as string);
        matched.add(match.twilio_call_sid);
        updated++;
        console.log("✅");
      } catch (e) {
        console.log(`❌  ${e instanceof Error ? e.message : e}`);
      }

      await sleep(DELAY_MS);
    }

    // Break if last page had fewer than PAGE_SIZE (no next page available from first list call)
    if (recs.length < PAGE_SIZE) break;
    if (!pageUri) break;
  }

  console.log("\n─────────────────────────────────────");
  console.log(`  Recordings processed : ${processed}`);
  console.log(`  DB rows updated      : ${updated}`);
  console.log(`  No DB match          : ${noMatch}`);
  console.log(`  Skipped (too short)  : ${skipped}`);
  console.log("─────────────────────────────────────");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
