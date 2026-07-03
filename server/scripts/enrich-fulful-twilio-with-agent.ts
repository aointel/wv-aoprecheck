/**
 * Add "who took the call" (taken_by) to fulful-twilio-matches.csv.
 * 1) Twilio API: inbound = child call to=client:email; outbound = parent from=client:email.
 * 2) Fallback: twilio_call_logs.owner_email (set when call is answered/dequeued).
 *
 * Run: npx tsx server/scripts/enrich-fulful-twilio-with-agent.ts
 * Reads: fulful-twilio-matches.csv
 * Writes: fulful-twilio-matches-with-agent.csv
 */

import fs from 'fs';
import path from 'path';
import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { supabaseAdmin } from '../supabase';

const ROOT = process.cwd();
const IN_CSV = path.join(ROOT, 'fulful-twilio-matches.csv');
const IN_WITH_AGENT = path.join(ROOT, 'fulful-twilio-matches-with-agent.csv');
const OUT_CSV = path.join(ROOT, 'fulful-twilio-matches-with-agent.csv');
const OUT_CSV_DB_ONLY = path.join(ROOT, 'fulful-twilio-matches-with-agent-filled.csv');

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

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

async function main() {
  const dbOnly = process.argv.includes('--db-only');

  if (dbOnly) {
    if (!supabaseAdmin) {
      console.error('Supabase not configured');
      process.exit(1);
    }
    if (!fs.existsSync(IN_WITH_AGENT)) {
      console.error('Missing:', IN_WITH_AGENT, '(run without --db-only first)');
      process.exit(1);
    }
    const buf = fs.readFileSync(IN_WITH_AGENT);
    const raw = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf-8');
    const { headers, rows } = parseCsv(raw);
    const uniqueSids = [...new Set(rows.map((r) => (r['call_sid'] ?? '').trim()).filter(Boolean))];
    const agentByCallSid = new Map<string, string>();
    for (const row of rows) {
      const sid = (row['call_sid'] ?? '').trim();
      const taken = (row['taken_by'] ?? '').trim();
      if (taken && sid) agentByCallSid.set(sid, taken);
    }
    const missingSids = uniqueSids.filter((sid) => !agentByCallSid.get(sid));
    console.error('Filling', missingSids.length, 'missing agents from twilio_call_logs...');
    let fromBySid = 0;
    let fromByParent = 0;
    const BATCH = 500;
    for (let i = 0; i < missingSids.length; i += BATCH) {
      const batch = missingSids.slice(i, i + BATCH);
      const { data: bySid } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, owner_email')
        .in('twilio_call_sid', batch);
      for (const r of bySid ?? []) {
        const email = (r as any)?.owner_email?.trim?.();
        if (email && email.includes('@')) {
          agentByCallSid.set((r as any).twilio_call_sid, email);
          fromBySid++;
        }
      }
      const { data: byParent } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('parent_call_sid, owner_email')
        .in('parent_call_sid', batch)
        .not('owner_email', 'is', null);
      for (const r of byParent ?? []) {
        const email = (r as any)?.owner_email?.trim?.();
        const parentSid = (r as any)?.parent_call_sid?.trim?.();
        if (email && email.includes('@') && parentSid && !agentByCallSid.get(parentSid)) {
          agentByCallSid.set(parentSid, email);
          fromByParent++;
        }
      }
    }
    console.error('DB fallback: matched by twilio_call_sid:', fromBySid, '| by parent_call_sid:', fromByParent);
    const outHeaders = headers.includes('taken_by') ? headers : [...headers, 'taken_by'];
    const outLines = [outHeaders.map(escapeCsv).join(',')];
    for (const row of rows) {
      const sid = (row['call_sid'] ?? '').trim();
      const takenBy = agentByCallSid.get(sid) ?? (row['taken_by'] ?? '');
      const rowVals = outHeaders.map((h) => escapeCsv(h === 'taken_by' ? takenBy : (row[h] ?? '')));
      outLines.push(rowVals.join(','));
    }
    const outPath = OUT_CSV_DB_ONLY;
    fs.writeFileSync(outPath, outLines.join('\n'), 'utf-8');
    console.error('Wrote', outPath, '| with agent:', agentByCallSid.size, '/', uniqueSids.length);
    return;
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    process.exit(1);
  }
  if (!fs.existsSync(IN_CSV)) {
    console.error('Missing:', IN_CSV);
    process.exit(1);
  }

  const buf = fs.readFileSync(IN_CSV);
  const raw = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf-8');
  const { headers, rows } = parseCsv(raw);

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const agentByCallSid = new Map<string, string>();

  const uniqueSids = [...new Set(rows.map((r) => (r['call_sid'] ?? '').trim()).filter(Boolean))];
  console.error('Resolving agent for', uniqueSids.length, 'unique call SIDs...');

  for (let i = 0; i < uniqueSids.length; i++) {
    const sid = uniqueSids[i];
    if ((i + 1) % 100 === 0) console.error('Progress:', i + 1, '/', uniqueSids.length);

    const row = rows.find((r) => (r['call_sid'] ?? '').trim() === sid);
    const agentOrTo = (row?.['agent_or_to'] ?? '').trim();
    const direction = (row?.['direction'] ?? '').toLowerCase();

    if (agentOrTo.toLowerCase().startsWith('client:') && agentOrTo.includes('@')) {
      agentByCallSid.set(sid, agentOrTo.replace(/^client:/i, '').trim());
      continue;
    }

    try {
      const call = await client.calls(sid).fetch();
      const from = String((call as any).from ?? '');
      const to = String((call as any).to ?? '');

      if (from.toLowerCase().startsWith('client:') && from.includes('@')) {
        agentByCallSid.set(sid, from.replace(/^client:/i, '').trim());
        continue;
      }
      if (to.toLowerCase().startsWith('client:') && to.includes('@')) {
        agentByCallSid.set(sid, to.replace(/^client:/i, '').trim());
        continue;
      }

      if (direction === 'inbound') {
        const children = await (client.calls as any).list({ parentCallSid: sid, limit: 10 });
        for (const ch of children) {
          const childTo = String((ch as any).to ?? '');
          if (childTo.toLowerCase().startsWith('client:') && childTo.includes('@')) {
            agentByCallSid.set(sid, childTo.replace(/^client:/i, '').trim());
            break;
          }
        }
      } else {
        const parentSid = (call as any).parentCallSid ?? (call as any).parent_call_sid;
        if (parentSid) {
          const parent = await client.calls(parentSid).fetch();
          const parentFrom = String((parent as any).from ?? '');
          if (parentFrom.toLowerCase().startsWith('client:') && parentFrom.includes('@')) {
            agentByCallSid.set(sid, parentFrom.replace(/^client:/i, '').trim());
          }
        }
      }
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 50));
  }

  const fromTwilio = agentByCallSid.size;
  const missingSids = uniqueSids.filter((sid) => !agentByCallSid.get(sid));

  if (missingSids.length > 0 && supabaseAdmin) {
    console.error('Fallback: looking up owner_email in twilio_call_logs for', missingSids.length, 'calls...');
    const BATCH = 500;
    for (let i = 0; i < missingSids.length; i += BATCH) {
      const batch = missingSids.slice(i, i + BATCH);
      const { data: bySid } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, owner_email')
        .in('twilio_call_sid', batch);
      for (const r of bySid ?? []) {
        const email = (r as any)?.owner_email?.trim?.();
        if (email && email.includes('@')) agentByCallSid.set((r as any).twilio_call_sid, email);
      }
      const { data: byParent } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('parent_call_sid, owner_email')
        .in('parent_call_sid', batch)
        .not('owner_email', 'is', null);
      for (const r of byParent ?? []) {
        const email = (r as any)?.owner_email?.trim?.();
        const parentSid = (r as any)?.parent_call_sid?.trim?.();
        if (email && email.includes('@') && parentSid && !agentByCallSid.get(parentSid))
          agentByCallSid.set(parentSid, email);
      }
    }
  }

  const fromDb = agentByCallSid.size - fromTwilio;
  const stillMissing = uniqueSids.length - agentByCallSid.size;
  console.error('Resolved: Twilio', fromTwilio, '| DB fallback', fromDb, '| still missing', stillMissing);

  const outHeaders = [...headers, 'taken_by'];
  const outLines = [outHeaders.map(escapeCsv).join(',')];
  for (const row of rows) {
    const sid = (row['call_sid'] ?? '').trim();
    const takenBy = agentByCallSid.get(sid) ?? '';
    outLines.push([...headers.map((h) => escapeCsv(row[h] ?? '')), escapeCsv(takenBy)].join(','));
  }

  fs.writeFileSync(OUT_CSV, outLines.join('\n'), 'utf-8');
  console.error('Wrote', OUT_CSV);
  console.error('Calls with agent resolved:', agentByCallSid.size, '/', uniqueSids.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
