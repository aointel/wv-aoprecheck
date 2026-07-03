/**
 * Cross-reference transfers CSV with Twilio API: match each row to a Twilio call by phone + time,
 * then get who took the call from twilio_call_logs (owner_email).
 *
 * Run: npx tsx server/scripts/transfers-csv-twilio-crossref.ts [path-to-list.csv]
 * Default: electron/transfers-over-10sec-list.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { supabaseAdmin } from '../supabase';

const TO_609 = '+16096048379';

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

function escapeCsv(field: string): string {
  const s = String(field ?? '').trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function normalizePhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function easternOffsetHours(year: number, month: number, day: number): number {
  const m = month;
  if (m >= 4 && m <= 10) return 4;
  if (m === 3 && day >= 8) return 4;
  if (m === 11 && day <= 7) return 4;
  return 5;
}

/** Parse CSV date+time as US/Eastern, return UTC Date. */
function parseEastern(dateStr: string, timeStr: string): Date | null {
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
  const offset = easternOffsetHours(year, month + 1, day);
  const utcMs = Date.UTC(year, month, day, hour + offset, min, sec, 0);
  return new Date(utcMs);
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
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Twilio credentials missing');
    process.exit(1);
  }
  if (!supabaseAdmin) {
    console.error('Supabase not configured');
    process.exit(1);
  }

  let raw = fs.readFileSync(csvPath, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  raw = raw.replace(/\u0000/g, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCSVLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const idxName = col('Name (lead)') >= 0 ? col('Name (lead)') : col('Name');
  const idxPhone = col('Phone');
  const idxDate = col('Date');
  const idxTime = col('Time');
  const idxDurationStr = col('Duration (after transfer)');
  const idxDurationSec = col('Duration (sec)');
  const idxPersona = col('Persona');

  const rows: Array<{ name: string; phone: string; date: string; time: string; durationStr: string; durationSec: number; persona: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    rows.push({
      name: (row[idxName] ?? '').trim() || '—',
      phone: (row[idxPhone] ?? '').trim(),
      date: (row[idxDate] ?? '').trim(),
      time: (row[idxTime] ?? '').trim(),
      durationStr: (row[idxDurationStr] ?? '').trim(),
      durationSec: parseInt(String(row[idxDurationSec] ?? '0'), 10) || 0,
      persona: (row[idxPersona] ?? '').trim(),
    });
  }
  rows.sort((a, b) => b.durationSec - a.durationSec);

  const dates = rows.map((r) => parseEastern(r.date, r.time)).filter((d): d is Date => d != null);
  if (dates.length === 0) {
    console.error('No valid date/time in CSV');
    process.exit(1);
  }
  const minT = new Date(Math.min(...dates.map((d) => d.getTime())) - 60 * 60 * 1000);
  const maxT = new Date(Math.max(...dates.map((d) => d.getTime())) + 60 * 60 * 1000);

  console.error(`Fetching Twilio calls ${minT.toISOString()} .. ${maxT.toISOString()} (to=${TO_609})...`);
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const allCalls: Array<{ sid: string; from: string; startTime: Date }> = [];
  const page = await client.calls.list({
    to: TO_609,
    startTimeAfter: minT,
    startTimeBefore: maxT,
    limit: 1000,
  });
  for (const c of page) {
    const st = c.startTime ? new Date(c.startTime) : null;
    if (st && st.getTime() >= minT.getTime() && st.getTime() <= maxT.getTime()) {
      allCalls.push({
        sid: c.sid,
        from: String(c.from ?? '').replace(/\D/g, ''),
        startTime: st,
      });
    }
  }

  console.error(`Twilio returned ${allCalls.length} calls. Looking up owner_email from twilio_call_logs...`);
  const sids = [...new Set(allCalls.map((c) => c.sid))];
  const ownerBySid = new Map<string, string>();
  for (let i = 0; i < sids.length; i += 100) {
    const chunk = sids.slice(i, i + 100);
    const { data } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, owner_email')
      .in('twilio_call_sid', chunk);
    for (const r of data || []) {
      const email = (r as any).owner_email?.trim();
      if (email && email.includes('@')) {
        ownerBySid.set((r as any).twilio_call_sid, email);
      }
    }
  }

  const fromToCalls = new Map<string, Array<{ sid: string; startTime: number }>>();
  for (const c of allCalls) {
    const last10 = c.from.length >= 10 ? c.from.slice(-10) : c.from;
    if (last10.length < 10) continue;
    if (!fromToCalls.has(last10)) fromToCalls.set(last10, []);
    fromToCalls.get(last10)!.push({ sid: c.sid, startTime: c.startTime.getTime() });
  }

  const outRows: string[][] = [
    ['Name (lead)', 'Phone', 'Date', 'Time', 'Duration (after transfer)', 'Duration (sec)', 'Persona', 'Agent (who took call)'],
  ];
  let matched = 0;
  for (const r of rows) {
    const last10 = normalizePhone(r.phone);
    const at = parseEastern(r.date, r.time)?.getTime();
    let agent = '';
    if (last10.length >= 10 && at != null) {
      const candidates = fromToCalls.get(last10) || [];
      if (candidates.length > 0) {
        const best = candidates.reduce((a, b) =>
          Math.abs(b.startTime - at!) < Math.abs(a.startTime - at!) ? b : a
        );
        if (Math.abs(best.startTime - at) <= 10 * 60 * 1000) {
          agent = ownerBySid.get(best.sid) || '';
          if (agent) matched++;
        }
      }
    }
    outRows.push([
      r.name,
      r.phone,
      r.date,
      r.time,
      r.durationStr,
      String(r.durationSec),
      r.persona,
      agent,
    ]);
  }

  console.error(`Matched ${matched} of ${rows.length} rows to an agent.`);
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
