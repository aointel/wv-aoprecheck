/**
 * Enrich transfers-over-10sec list with Agent (who took the call).
 * Reads the Taalk export CSV, filters to Transferred=YES and duration > 10s,
 * looks up agent_email from taalk_call_analytics or twilio_call_logs using
 * the call ID extracted from the Recording URL, and outputs CSV with Agent column.
 *
 * Run: npx tsx server/scripts/enrich-transfers-with-agent.ts [path-to-taalk-export.csv]
 * Default CSV path: electron/fb6b429c-ac6d-4590-86c1-dde40e3c77a7.csv (relative to project root)
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from '../supabase';

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function durationAfterTransferToSeconds(str: string): number {
  if (!str || typeof str !== 'string') return 0;
  const m = str.trim().match(/^(\d+):(\d+)$/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Extract Taalk call ID from Recording URL e.g. https://api.taalk.ai/api/calls/69b2ba2e357d249fc298c6a3/recording?db=... */
function callIdFromRecordingUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(/\/calls\/([^\/\?]+)/);
  return match ? match[1] : null;
}

function escapeCsv(field: string): string {
  const s = String(field ?? '').trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const BATCH_SIZE = 200;

/** Normalize phone to last 10 digits for matching. */
function normalizePhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Parse CSV date (e.g. 3/12/2026) and time (e.g. 11:10:56 AM) as server local → Date. */
function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const d = String(dateStr ?? '').trim();
  const t = String(timeStr ?? '').trim();
  if (!d || !t) return null;
  const dParts = d.split('/');
  if (dParts.length !== 3) return null;
  const month = parseInt(dParts[0], 10) - 1;
  const day = parseInt(dParts[1], 10);
  const year = parseInt(dParts[2], 10);
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
  const tMatch = t.match(/(\d+):(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (!tMatch) return null;
  let hour = parseInt(tMatch[1], 10);
  const min = parseInt(tMatch[2], 10);
  const sec = parseInt(tMatch[3] ?? '0', 10);
  if (tMatch[4]) {
    if (tMatch[4].toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (tMatch[4].toLowerCase() === 'am' && hour === 12) hour = 0;
  }
  const date = new Date(year, month, day, hour, min, sec, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** US/Eastern offset in hours (add to Eastern time to get UTC). EDT=4, EST=5. */
function easternOffsetHours(year: number, month: number, day: number): number {
  const m = month + 1; // 1-12
  if (m >= 4 && m <= 10) return 4; // EDT
  if (m === 3 && day >= 8) return 4;
  if (m === 11 && day <= 7) return 4;
  return 5; // EST
}

/** Parse CSV date+time as US/Eastern and return UTC Date (so DB comparison is correct). */
function parseDateTimeEastern(dateStr: string, timeStr: string): Date | null {
  const d = String(dateStr ?? '').trim();
  const t = String(timeStr ?? '').trim();
  if (!d || !t) return null;
  const dParts = d.split('/');
  if (dParts.length !== 3) return null;
  const month = parseInt(dParts[0], 10) - 1; // 0-indexed for Date
  const day = parseInt(dParts[1], 10);
  const year = parseInt(dParts[2], 10);
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
  const tMatch = t.match(/(\d+):(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (!tMatch) return null;
  let hour = parseInt(tMatch[1], 10);
  const min = parseInt(tMatch[2], 10);
  const sec = parseInt(tMatch[3] ?? '0', 10);
  if (tMatch[4]) {
    if (tMatch[4].toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (tMatch[4].toLowerCase() === 'am' && hour === 12) hour = 0;
  }
  const offset = easternOffsetHours(year, month + 1, day);
  const utcMs = Date.UTC(year, month, day, hour + offset, min, sec, 0);
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Batch lookup: fetch agent for all call IDs in 2 bulk queries (tca then tcl), return Map<callId, agentEmail>. */
async function lookupAgentsBatch(callIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabaseAdmin || callIds.length === 0) return map;
  const unique = [...new Set(callIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    const { data: tcaRows } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('taalk_call_id, agent_email')
      .in('taalk_call_id', chunk);
    (tcaRows || []).forEach((r: any) => {
      const email = (r?.agent_email || '').trim();
      if (email && email.includes('@')) map.set(String(r.taalk_call_id), email);
    });
  }
  const missing = unique.filter((id) => !map.has(id));
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const { data: tclRows } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, owner_email')
      .in('twilio_call_sid', chunk);
    (tclRows || []).forEach((r: any) => {
      const owner = (r?.owner_email || '').trim();
      if (owner && owner.includes('@')) map.set(String(r.twilio_call_sid), owner);
    });
  }
  return map;
}

const BAD_OWNER = ['unknown@aoglobelife.com', 'system@aoglobelife.com', 'cnsysop@aoglobelife.com', ''];

/**
 * Resolve who took each transfer by matching lead phone + date/time to twilio_call_logs
 * (609 inbounds set owner_email when agent accepts). Uses Eastern timezone so CSV times match DB UTC.
 */
async function lookupAgentsByPhoneAndDateTime(
  rows: Array<{ phone: string; date: string; time: string }>,
  useEastern = true
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabaseAdmin || rows.length === 0) return map;
  const parse = useEastern ? parseDateTimeEastern : parseDateTime;
  const dates = rows.map((r) => parse(r.date, r.time)).filter((d): d is Date => d != null);
  if (dates.length === 0) return map;
  const minT = new Date(Math.min(...dates.map((d) => d.getTime())) - 10 * 60 * 1000); // 10 min buffer
  const maxT = new Date(Math.max(...dates.map((d) => d.getTime())) + 10 * 60 * 1000);
  const { data: logs, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('owner_email, call_started_at, from_number, to_number')
    .gte('call_started_at', minT.toISOString())
    .lte('call_started_at', maxT.toISOString())
    .not('owner_email', 'is', null)
    .order('call_started_at', { ascending: true });
  if (error) {
    console.error('twilio_call_logs query error:', error.message);
    return map;
  }
  const byPhoneTime = new Map<string, Array<{ email: string; at: number }>>();
  for (const r of logs || []) {
    const email = (r as any).owner_email?.trim();
    if (!email || !email.includes('@') || BAD_OWNER.includes(email.toLowerCase())) continue;
    const at = new Date((r as any).call_started_at).getTime();
    const from = String((r as any).from_number ?? '').replace(/\D/g, '');
    const to = String((r as any).to_number ?? '').replace(/\D/g, '');
    const from10 = from.length >= 10 ? from.slice(-10) : '';
    const to10 = to.length >= 10 ? to.slice(-10) : '';
    if (from10.length >= 10) {
      if (!byPhoneTime.has(from10)) byPhoneTime.set(from10, []);
      byPhoneTime.get(from10)!.push({ email, at });
    }
    if (to10.length >= 10 && to10 !== from10) {
      if (!byPhoneTime.has(to10)) byPhoneTime.set(to10, []);
      byPhoneTime.get(to10)!.push({ email, at });
    }
  }
  if (logs?.length !== undefined && logs.length > 0) {
    console.error(`twilio_call_logs: ${logs.length} rows in range ${minT.toISOString()} .. ${maxT.toISOString()}`);
  }
  for (const r of rows) {
    const last10 = normalizePhone(r.phone);
    if (last10.length < 10) continue;
    const at = parse(r.date, r.time)?.getTime();
    if (at == null) continue;
    const candidates = byPhoneTime.get(last10);
    if (!candidates?.length) continue;
    const best = candidates.reduce((a, b) => (Math.abs(b.at - at) < Math.abs(a.at - at) ? b : a));
    if (Math.abs(best.at - at) > 5 * 60 * 1000) continue; // max 5 min skew
    const key = `${last10}|${r.date}|${r.time}`;
    map.set(key, best.email);
  }
  return map;
}

async function main() {
  const projectRoot = process.cwd();
  const csvArg = process.argv[2];
  const csvPath = csvArg
    ? path.isAbsolute(csvArg)
      ? csvArg
      : path.join(projectRoot, csvArg)
    : path.join(projectRoot, 'electron', 'transfers-over-10sec-list.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  if (!supabaseAdmin) {
    console.error('Supabase not configured');
    process.exit(1);
  }

  let raw = fs.readFileSync(csvPath, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  // Strip UTF-16 null bytes if present (Excel sometimes saves CSV with them)
  raw = raw.replace(/\u0000/g, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCSVLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  // List format: "Name (lead)", "Phone", "Date", "Time", "Duration (after transfer)", "Duration (sec)", "Persona" (no Transferred, no Recording)
  const hasNameOrPhone = col('Name (lead)') >= 0 || col('Name') >= 0 || col('Phone') >= 0;
  const hasDurationSec = col('Duration (sec)') >= 0;
  const hasTransferred = col('Transferred') >= 0;
  const isListFormat = hasNameOrPhone && hasDurationSec && !hasTransferred;

  type Row = { name: string; phone: string; date: string; time: string; durationStr: string; durationSec: number; persona: string; recording: string };
  const rows: Row[] = [];

  if (isListFormat) {
    const idxName = col('Name (lead)') >= 0 ? col('Name (lead)') : col('Name');
    const idxPhone = col('Phone');
    const idxDate = col('Date');
    const idxTime = col('Time');
    const idxDurationStr = col('Duration (after transfer)');
    const idxDurationSec = col('Duration (sec)');
    const idxPersona = col('Persona');
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const durationSec = parseInt(String(row[idxDurationSec] ?? '0'), 10) || 0;
      rows.push({
        name: (row[idxName] ?? '').trim() || '—',
        phone: (row[idxPhone] ?? '').trim(),
        date: (row[idxDate] ?? '').trim(),
        time: (row[idxTime] ?? '').trim(),
        durationStr: (row[idxDurationStr] ?? '').trim(),
        durationSec,
        persona: (row[idxPersona] ?? '').trim(),
        recording: '',
      });
    }
    rows.sort((a, b) => b.durationSec - a.durationSec);
    console.error(`List format: ${rows.length} rows from ${path.basename(csvPath)}. Looking up agents by phone + date/time (US/Eastern → UTC)...`);
  } else {
    const idxTransferred = col('Transferred');
    const idxDurationAfter = col('Duration After Transfer');
    const idxName = col('Name');
    const idxPhone = col('Phone');
    const idxDate = col('Date');
    const idxTime = col('Time');
    const idxPersona = col('Persona');
    const idxRecording = col('Recording');
    const MIN_DURATION_SEC = 10;
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if ((row[idxTransferred] || '').toUpperCase().trim() !== 'YES') continue;
      const durationStr = row[idxDurationAfter] || '';
      const durationSec = durationAfterTransferToSeconds(durationStr);
      if (durationSec <= MIN_DURATION_SEC) continue;
      rows.push({
        name: (row[idxName] || '').trim() || '—',
        phone: row[idxPhone] || '',
        date: row[idxDate] || '',
        time: row[idxTime] || '',
        durationStr,
        durationSec,
        persona: row[idxPersona] || '',
        recording: idxRecording >= 0 ? (row[idxRecording] || '').trim() : '',
      });
    }
    rows.sort((a, b) => b.durationSec - a.durationSec);
    console.error(`Taalk export format: ${rows.length} transfers.`);
  }

  if (rows.length === 0) {
    console.error('No rows to process.');
    process.exit(1);
  }

  let agentByCallId = new Map<string, string>();
  if (!isListFormat) {
    const allCallIds = rows.map((r) => callIdFromRecordingUrl(r.recording)).filter((id): id is string => id != null);
    console.error(`Looking up by call ID: ${allCallIds.length}...`);
    agentByCallId = await lookupAgentsBatch(allCallIds);
    console.error(`Resolved by call ID: ${agentByCallId.size}.`);
  }

  const agentByPhoneTime = await lookupAgentsByPhoneAndDateTime(rows, true);
  console.error(`Resolved by phone+time: ${agentByPhoneTime.size}.`);

  const cacheKey = (p: string, d: string, t: string) => `${normalizePhone(p)}|${d}|${t}`;

  const outRows: string[][] = [
    ['Name (lead)', 'Phone', 'Date', 'Time', 'Duration (after transfer)', 'Duration (sec)', 'Persona', 'Agent (who took call)'],
  ];

  for (const r of rows) {
    const callId = callIdFromRecordingUrl(r.recording);
    let agent = callId ? agentByCallId.get(callId) ?? null : null;
    if (!agent && r.phone && r.date && r.time) {
      agent = agentByPhoneTime.get(cacheKey(r.phone, r.date, r.time)) ?? null;
    }
    outRows.push([
      r.name,
      r.phone,
      r.date,
      r.time,
      r.durationStr,
      String(r.durationSec),
      r.persona,
      agent || '',
    ]);
  }

  const totalResolved = outRows.filter((row, i) => i > 0 && (row[7] ?? '').trim().length > 0).length;
  console.error(`Total with agent: ${totalResolved} of ${rows.length}.`);

  const csv = outRows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const outPath = path.join(path.dirname(csvPath), 'transfers-over-10sec-with-agent.csv');
  fs.writeFileSync(outPath, csv, 'utf8');
  console.error('Wrote:', outPath);
  console.log(csv);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
