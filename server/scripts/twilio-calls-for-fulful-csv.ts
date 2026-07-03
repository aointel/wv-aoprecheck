/**
 * Find Twilio calls that match phone numbers from database/fulful.csv.
 * Uses Twilio REST API only (no twilio_call_logs).
 * Paginates through ALL calls in the last 2-3 days until every batch is fetched.
 *
 * Run: npx tsx server/scripts/twilio-calls-for-fulful-csv.ts
 * Save: npx tsx server/scripts/twilio-calls-for-fulful-csv.ts > fulful-twilio-matches.csv
 *
 * Output: CSV to stdout with phone, name, call_sid, direction, agent_or_to, duration_sec, start_time
 */

import twilio from 'twilio';
import fs from 'fs';
import path from 'path';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config.js';

const CSV_PATH = path.join(process.cwd(), 'database', 'fulful.csv');

function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+1' + digits.slice(-10);
}

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j]?.trim() ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

async function main() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
    process.exit(1);
  }

  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV not found:', CSV_PATH);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const { rows } = parseCsv(csvContent);

  // Unique phones with a representative name from CSV
  const byPhone = new Map<string, string>();
  for (const row of rows) {
    const phone = (row['Phone'] ?? '').trim();
    if (!phone) continue;
    const e164 = normalizeE164(phone);
    const name = (row['Name'] ?? row['firstName'] ?? '').trim() || (row['lastName'] ?? '').trim() || e164;
    if (!byPhone.has(e164)) byPhone.set(e164, name);
  }

  const phoneSet = new Set(byPhone.keys());
  const phones = Array.from(phoneSet);
  console.error(`Loaded ${phones.length} unique phone numbers from ${CSV_PATH}`);

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  // Normalize any format to last-10 for matching
  function last10(s: string): string {
    const d = (s || '').replace(/\D/g, '').slice(-10);
    return d;
  }
  const phoneLast10 = new Set(phones.map((p) => last10(p)));

  const results: Array<{
    phone: string;
    name: string;
    call_sid: string;
    direction: string;
    from: string;
    to: string;
    agent_or_to: string;
    duration_sec: number | null;
    status: string;
    start_time: string;
  }> = [];

  // Fetch ALL calls in last 3 days (paginate until no more pages)
  const daysBack = 3;
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const startTimeAfter = startDate.toISOString().slice(0, 10);
  const limit = 1000;

  const allCalls: any[] = [];
  let startTimeBefore: string | undefined;
  let pageNum = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      pageNum++;
      const opts: { limit: number; startTimeAfter: string; startTimeBefore?: string } = {
        limit,
        startTimeAfter,
      };
      if (startTimeBefore) opts.startTimeBefore = startTimeBefore;

      const page = await client.calls.list(opts);
      if (page.length === 0) break;

      for (const c of page) allCalls.push(c);
      console.error(`Page ${pageNum}: fetched ${page.length} calls (total so far: ${allCalls.length})`);

      if (page.length < limit) break;

      // Twilio returns newest first; oldest in this page is the last element. Use 1s before to avoid refetching it.
      const last = page[page.length - 1];
      const lastStart = (last as any).startTime ?? (last as any).dateCreated;
      if (!lastStart) break;
      const d = new Date(lastStart);
      if (isNaN(d.getTime())) break;
      d.setSeconds(d.getSeconds() - 1);
      startTimeBefore = d.toISOString().slice(0, 19);
      await new Promise((r) => setTimeout(r, 200)); // slight throttle between pages
    }

    console.error(`Fetched ${allCalls.length} total calls from Twilio (since ${startTimeAfter}, ${daysBack} days back)`);

    for (const c of allCalls) {
      const from = String((c as any).from ?? '');
      const to = String((c as any).to ?? '');
      const from10 = last10(from);
      const to10 = last10(to);
      const matchFrom = phoneLast10.has(from10);
      const matchTo = phoneLast10.has(to10);
      if (!matchFrom && !matchTo) continue;

      const e164From = '+1' + from10;
      const e164To = '+1' + to10;
      const e164 = phoneSet.has(e164From) ? e164From : phoneSet.has(e164To) ? e164To : (matchFrom ? e164From : e164To);
      const name = byPhone.get(e164) ?? byPhone.get(e164From) ?? byPhone.get(e164To) ?? e164;

      if (matchFrom) {
        const agentOrTo = to.startsWith('client:') ? to.replace(/^client:/, '') : to;
        results.push({
          phone: e164,
          name,
          call_sid: (c as any).sid,
          direction: 'inbound',
          from,
          to,
          agent_or_to: agentOrTo,
          duration_sec: (c as any).duration != null ? parseInt(String((c as any).duration), 10) : null,
          status: (c as any).status ?? '',
          start_time: (c as any).startTime ?? (c as any).dateCreated ?? '',
        });
      }
      if (matchTo && !matchFrom) {
        const agentOrTo = from.startsWith('client:') ? from.replace(/^client:/, '') : from;
        results.push({
          phone: e164,
          name,
          call_sid: (c as any).sid,
          direction: 'outbound',
          from,
          to,
          agent_or_to: agentOrTo,
          duration_sec: (c as any).duration != null ? parseInt(String((c as any).duration), 10) : null,
          status: (c as any).status ?? '',
          start_time: (c as any).startTime ?? (c as any).dateCreated ?? '',
        });
      }
    }
  } catch (err) {
    console.error('Twilio API error:', (err as Error).message);
    if (allCalls.length === 0) process.exit(1);
  }

  // Dedupe by call_sid (same call can match from/to)
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.call_sid)) return false;
    seen.add(r.call_sid);
    return true;
  });

  // Output CSV
  const outHeaders = ['phone', 'name', 'call_sid', 'direction', 'agent_or_to', 'duration_sec', 'status', 'start_time', 'from', 'to'];
  console.log(outHeaders.join(','));
  for (const r of unique) {
    const row = [
      r.phone,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      r.call_sid,
      r.direction,
      `"${(r.agent_or_to || '').replace(/"/g, '""')}"`,
      r.duration_sec ?? '',
      r.status,
      r.start_time,
      r.from,
      r.to,
    ];
    console.log(row.join(','));
  }

  console.error(`\nDone. ${unique.length} Twilio calls matched (${results.length} raw, deduped by call_sid).`);
  console.error('Columns: phone, name, call_sid, direction, agent_or_to (who handled: number or client id), duration_sec, status, start_time, from, to');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
