/**
 * Only update twilio_call_logs that already have owner_email and a Taalk recording URL.
 * Match by phone to CSV; set recording_url from CSV, call_direction=inbound, call_source=Persona.
 * Run: npx tsx server/scripts/backfill-twilio-call-logs-from-taalk-csv.ts [path-to-csv]
 */
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { supabaseAdmin } from '../supabase.js';

const DEFAULT_CSV = path.join(process.cwd(), 'server', 'scripts', 'output', 'a6676ea8-2288-41c0-a93c-e16fc2c67877.csv');

function normalizePhone(p: string | null | undefined): string {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      i++;
      let s = '';
      while (i < line.length && line[i] !== '"') {
        s += line[i];
        i++;
      }
      if (line[i] === '"') i++;
      out.push(s);
      if (line[i] === ',') i++;
      continue;
    }
    let s = '';
    while (i < line.length && line[i] !== ',') {
      s += line[i];
      i++;
    }
    out.push(s.trim());
    if (line[i] === ',') i++;
  }
  return out;
}

async function loadCsvMap(filePath: string): Promise<Map<string, { recording: string; persona: string }>> {
  const lines = await new Promise<string[]>((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
    const out: string[] = [];
    rl.on('line', (line) => out.push(line));
    rl.on('close', () => resolve(out));
    rl.on('error', reject);
  });
  const map = new Map<string, { recording: string; persona: string }>();
  if (lines.length < 2) return map;
  const header = parseCsvLine(lines[0]);
  const recIdx = header.length - 1;
  const phoneIdx = header.findIndex((h) => h.toLowerCase() === 'phone');
  const personaIdx = header.findIndex((h) => h.toLowerCase() === 'persona');
  if (phoneIdx < 0 || personaIdx < 0 || recIdx < 0) return map;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const phone = normalizePhone(cols[phoneIdx]);
    const recording = (cols[recIdx] || '').trim();
    if (phone.length < 10 || !recording.startsWith('http')) continue;
    map.set(phone, {
      recording,
      persona: (cols[personaIdx] || '').trim() || 'taalk_csv',
    });
  }
  return map;
}

async function main() {
  const csvPath = process.argv[2] || DEFAULT_CSV;
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }
  if (!supabaseAdmin) {
    console.error('supabaseAdmin not configured.');
    process.exit(1);
  }

  console.log('\n📥 Loading CSV...');
  const csvByPhone = await loadCsvMap(csvPath);
  console.log('   Phones in CSV:', csvByPhone.size);

  console.log('📥 Fetching twilio_call_logs with owner_email + Taalk recording_url...');
  const { data: rows, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('id, from_number, to_number, owner_email, recording_url')
    .not('owner_email', 'is', null)
    .neq('owner_email', '')
    .ilike('recording_url', '%taalk%');

  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const list = (rows || []) as { id: number; from_number: string | null; to_number: string | null; owner_email: string; recording_url: string | null }[];
  console.log('   Rows to consider:', list.length, '\n');

  let updated = 0;
  for (const row of list) {
    const phoneFrom = normalizePhone(row.from_number);
    const phoneTo = normalizePhone(row.to_number);
    const csv = csvByPhone.get(phoneFrom) || csvByPhone.get(phoneTo);
    if (!csv) continue;

    const { error: up } = await supabaseAdmin
      .from('twilio_call_logs')
      .update({
        recording_url: csv.recording,
        call_direction: 'inbound',
        call_source: csv.persona,
      })
      .eq('id', row.id);

    if (!up) {
      updated++;
      if (updated <= 20) console.log('   ✅ id=', row.id, csv.persona.slice(0, 25));
    }
  }
  console.log('\n✅ Updated:', updated, '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
