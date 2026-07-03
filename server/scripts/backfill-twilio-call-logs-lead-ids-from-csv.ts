/**
 * Backfill twilio_call_logs.lead_id and taalk_lead_id for 609 inbound rows using a CSV.
 * Reads CSV with columns: Phone, Date, Time, Persona. Excludes rows where Persona indicates
 * recruiting (e.g. contains "Recruit"). Matches CSV rows to twilio_call_logs by phone + call_started_at,
 * then sets lead_id/taalk_lead_id from masterlead lookup by phone.
 *
 * Run: npx tsx server/scripts/backfill-twilio-call-logs-lead-ids-from-csv.ts [path-to.csv]
 * Default: electron/transfers-over-10sec-list.csv
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

function normalizePhone(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function easternOffsetHours(year: number, month: number, day: number): number {
  const m = month; // 1-12
  if (m >= 4 && m <= 10) return 4;
  if (m === 3 && day >= 8) return 4;
  if (m === 11 && day <= 7) return 4;
  return 5;
}

function parseDateTimeEastern(dateStr: string, timeStr: string): Date | null {
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

/** Exclude recruiting persona (e.g. RecruitRMStest, any Persona containing "Recruit"). */
function isRecruitingPersona(persona: string): boolean {
  const p = String(persona ?? '').trim().toLowerCase();
  return p.includes('recruit');
}

async function main() {
  const projectRoot = process.cwd();
  const csvArg = process.argv[2];
  const limitArg = process.argv[3];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
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
    console.error('Supabase admin not available.');
    process.exit(1);
  }

  let raw = fs.readFileSync(csvPath, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  raw = raw.replace(/\u0000/g, '');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCSVLine(lines[0]).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const idxPhone = col('Phone');
  const idxDate = col('Date');
  const idxTime = col('Time');
  const idxPersona = col('Persona');
  if (idxPhone < 0 || idxDate < 0 || idxTime < 0) {
    console.error('CSV must have Phone, Date, Time columns.');
    process.exit(1);
  }

  type CsvRow = { phone: string; date: string; time: string; persona: string; atUtc: Date };
  const allRows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    const phone = (row[idxPhone] ?? '').trim();
    const date = (row[idxDate] ?? '').trim();
    const time = (row[idxTime] ?? '').trim();
    const persona = idxPersona >= 0 ? (row[idxPersona] ?? '').trim() : '';
    const atUtc = parseDateTimeEastern(date, time);
    if (normalizePhone(phone).length >= 10 && atUtc) {
      allRows.push({ phone, date, time, persona, atUtc });
    }
  }

  let rows = allRows.filter((r) => !isRecruitingPersona(r.persona));
  if (limit != null && !Number.isNaN(limit) && limit > 0) {
    rows = rows.slice(0, limit);
    console.log(`Limiting to first ${limit} rows (non-recruiting).`);
  }
  console.log(`CSV: ${allRows.length} rows with phone+time; ${rows.length} after excluding recruiting persona${limit != null ? ` and limit ${limit}` : ''}.`);

  if (rows.length === 0) {
    console.log('Nothing to backfill.');
    process.exit(0);
  }

  const minT = new Date(Math.min(...rows.map((r) => r.atUtc.getTime())) - 5 * 60 * 1000);
  const maxT = new Date(Math.max(...rows.map((r) => r.atUtc.getTime())) + 5 * 60 * 1000);

  const { data: logs, error: logsErr } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, call_started_at, from_number, to_number, lead_id, taalk_lead_id')
    .eq('call_source', 'incomingcall_609')
    .gte('call_started_at', minT.toISOString())
    .lte('call_started_at', maxT.toISOString())
    .order('call_started_at', { ascending: true });

  if (logsErr) {
    console.error('twilio_call_logs query error:', logsErr.message);
    process.exit(1);
  }

  const WINDOW_MS = 3 * 60 * 1000; // ±3 min
  const byPhoneThenTime: Map<string, Array<{ sid: string; at: number }>> = new Map();
  for (const r of logs || []) {
    const from10 = String((r as any).from_number ?? '').replace(/\D/g, '').slice(-10);
    const to10 = String((r as any).to_number ?? '').replace(/\D/g, '').slice(-10);
    const at = new Date((r as any).call_started_at).getTime();
    const sid = (r as any).twilio_call_sid;
    if (from10.length >= 10) {
      if (!byPhoneThenTime.has(from10)) byPhoneThenTime.set(from10, []);
      byPhoneThenTime.get(from10)!.push({ sid, at });
    }
    if (to10.length >= 10 && to10 !== from10) {
      if (!byPhoneThenTime.has(to10)) byPhoneThenTime.set(to10, []);
      byPhoneThenTime.get(to10)!.push({ sid, at });
    }
  }

  const csvRowToSid = new Map<string, string>();
  for (const r of rows) {
    const last10 = normalizePhone(r.phone);
    const candidates = byPhoneThenTime.get(last10);
    if (!candidates?.length) continue;
    const at = r.atUtc.getTime();
    const best = candidates.reduce((a, b) => (Math.abs(b.at - at) < Math.abs(a.at - at) ? b : a));
    if (Math.abs(best.at - at) > WINDOW_MS) continue;
    csvRowToSid.set(`${last10}|${r.date}|${r.time}`, best.sid);
  }

  const sidsToUpdate = [...new Set(csvRowToSid.values())];
  console.log(`Matched ${csvRowToSid.size} CSV rows to ${sidsToUpdate.length} distinct twilio_call_logs rows.`);

  const last10BySid = new Map<string, string>();
  for (const [key, sid] of csvRowToSid) {
    const last10 = key.split('|')[0];
    if (!last10BySid.has(sid)) last10BySid.set(sid, last10);
  }

  const leadByPhone = new Map<string, { lead_id: string; taalk_lead_id: string }>();
  const phones = [...new Set(last10BySid.values())];
  for (const last10 of phones) {
    try {
      const { data: rpc } = await supabaseAdmin.rpc('get_masterlead_by_phone_last10', { last10 });
      const row = Array.isArray(rpc) && rpc.length ? (rpc[0] as any) : null;
      if (row?.id != null || row?.taalk_lead_id != null) {
        leadByPhone.set(last10, {
          lead_id: String(row.id ?? ''),
          taalk_lead_id: String(row.taalk_lead_id ?? '').trim() || String(row.id ?? ''),
        });
        continue;
      }
    } catch (_) {}
    const { data: one } = await supabaseAdmin
      .from('masterlead')
      .select('id, taalk_lead_id')
      .ilike('phone', `%${last10}%`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (one) {
      leadByPhone.set(last10, {
        lead_id: String((one as any).id ?? ''),
        taalk_lead_id: String((one as any).taalk_lead_id ?? '').trim() || String((one as any).id ?? ''),
      });
    }
  }

  let updated = 0;
  let skipped = 0;
  for (const sid of sidsToUpdate) {
    const last10 = last10BySid.get(sid);
    if (!last10) continue;
    const lead = leadByPhone.get(last10);
    if (!lead || (!lead.lead_id && !lead.taalk_lead_id)) {
      skipped++;
      continue;
    }
    const { error } = await supabaseAdmin
      .from('twilio_call_logs')
      .update({
        lead_id: lead.lead_id || null,
        taalk_lead_id: lead.taalk_lead_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('twilio_call_sid', sid);
    if (error) {
      console.warn('Update failed for', sid, error.message);
    } else {
      updated++;
    }
  }

  console.log(`Backfill complete: ${updated} rows updated, ${skipped} skipped (no masterlead match).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
