/**
 * Backfill twilio_call_logs.owner_email (and agent_identity) from the enriched fulful CSV.
 * Reads fulful-twilio-matches-with-agent.csv or fulful-twilio-matches-with-agent-filled.csv;
 * for each row with call_sid + taken_by, upserts twilio_call_logs so owner_email shows in the app.
 *
 * Run: npx tsx server/scripts/backfill-twilio-call-logs-owner-from-fulful.ts
 */

import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '../supabase';

const ROOT = process.cwd();
const WITH_AGENT = path.join(ROOT, 'fulful-twilio-matches-with-agent.csv');
const WITH_AGENT_FILLED = path.join(ROOT, 'fulful-twilio-matches-with-agent-filled.csv');

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^\uFEFF/, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && c === ',') {
        values.push(cur.trim());
        cur = '';
        continue;
      }
      cur += c;
    }
    values.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, k) => {
      row[h] = values[k] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

async function main() {
  if (!supabaseAdmin) {
    console.error('Supabase not configured');
    process.exit(1);
  }

  const pathToUse = fs.existsSync(WITH_AGENT_FILLED) ? WITH_AGENT_FILLED : WITH_AGENT;
  if (!fs.existsSync(pathToUse)) {
    console.error('Missing CSV:', pathToUse);
    process.exit(1);
  }

  const raw = fs.readFileSync(pathToUse, 'utf-8');
  const { rows } = parseCsv(raw);

  function toIso(s: string): string {
    if (!s || !s.trim()) return new Date().toISOString();
    const d = new Date(s.trim());
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  type Row = { sid: string; email: string; from_number: string; to_number: string; direction: string; status: string; started_at: string };
  const bySid = new Map<string, Row>();
  for (const row of rows) {
    const sid = (row['call_sid'] ?? '').trim();
    const taken = (row['taken_by'] ?? '').trim();
    if (!sid || !taken || !taken.includes('@')) continue;
    if (bySid.has(sid)) continue;
    bySid.set(sid, {
      sid,
      email: taken,
      from_number: (row['from'] ?? '').trim() || 'unknown',
      to_number: (row['to'] ?? '').trim() || 'unknown',
      direction: (row['direction'] ?? 'outbound').trim() || 'outbound',
      status: (row['status'] ?? 'completed').trim() || 'completed',
      started_at: toIso(row['start_time'] ?? ''),
    });
  }

  const entries = [...bySid.values()];
  console.error('Upserting twilio_call_logs for', entries.length, 'calls (with owner_email)...');

  const BATCH = 50;
  let ok = 0;
  let errCount = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const payload = batch.map((r) => ({
      twilio_call_sid: r.sid,
      owner_email: r.email,
      agent_identity: `client:${r.email}`,
      from_number: r.from_number,
      to_number: r.to_number,
      call_direction: r.direction,
      call_status: r.status,
      call_started_at: toIso(r.started_at),
      call_source: 'fulful_backfill',
      call_duration: 0,
    }));

    const { error } = await supabaseAdmin
      .from('twilio_call_logs')
      .upsert(payload, { onConflict: 'twilio_call_sid' });

    if (error) {
      console.error('Batch error:', error.message);
      errCount += batch.length;
    } else {
      ok += batch.length;
    }
    if ((i + BATCH) % 200 === 0 || i + BATCH >= entries.length) {
      console.error('Progress:', Math.min(i + BATCH, entries.length), '/', entries.length);
    }
  }

  console.error('Done. Upserted:', ok, '| errors:', errCount);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
