/**
 * Link database/fulful.csv to fulful-twilio-matches.csv by phone.
 * Output: fulful-linked.csv = every fulful row with Twilio columns appended (one row per Twilio match; fulful rows with no match appear once with empty Twilio cols).
 *
 * Run from repo root: npx tsx server/scripts/link-fulful-to-twilio.ts
 * Reads: database/fulful.csv, fulful-twilio-matches.csv
 * Writes: database/fulful-linked.csv
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const FULFUL_CSV = path.join(ROOT, 'database', 'fulful.csv');
const TWILIO_CSV_PLAIN = path.join(ROOT, 'fulful-twilio-matches.csv');
const TWILIO_CSV_WITH_AGENT = path.join(ROOT, 'fulful-twilio-matches-with-agent.csv');
const OUT_CSV = path.join(ROOT, 'database', 'fulful-linked.csv');

function getTwilioCsvPath(): string {
  if (fs.existsSync(TWILIO_CSV_WITH_AGENT)) return TWILIO_CSV_WITH_AGENT;
  return TWILIO_CSV_PLAIN;
}

function last10(phone: string): string {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

function parseCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
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

function main() {
  if (!fs.existsSync(FULFUL_CSV)) {
    console.error('Missing:', FULFUL_CSV);
    process.exit(1);
  }
  const twilioCsvPath = getTwilioCsvPath();
  if (!fs.existsSync(twilioCsvPath)) {
    console.error('Missing:', TWILIO_CSV_PLAIN, '(run twilio-calls-for-fulful-csv.ts first)');
    process.exit(1);
  }

  const fulful = parseCsv(fs.readFileSync(FULFUL_CSV, 'utf-8'));
  const twilioBuf = fs.readFileSync(twilioCsvPath);
  const twilioRaw = twilioBuf[0] === 0xff && twilioBuf[1] === 0xfe ? twilioBuf.toString('utf16le') : twilioBuf.toString('utf-8');
  const twilio = parseCsv(twilioRaw);

  const hasTakenBy = twilio.headers.includes('taken_by');

  // Index Twilio matches by last-10 phone (multiple matches per phone)
  const byPhone = new Map<string, Record<string, string>[]>();
  for (const r of twilio.rows) {
    const p = (r['phone'] ?? '').replace(/\D/g, '').slice(-10);
    if (!p) continue;
    if (!byPhone.has(p)) byPhone.set(p, []);
    byPhone.get(p)!.push(r);
  }

  const fulfulHeaders = fulful.headers;
  const twilioHeaders = ['Twilio_call_sid', 'Twilio_direction', 'Twilio_agent_or_to', 'Twilio_duration_sec', 'Twilio_status', 'Twilio_start_time', ...(hasTakenBy ? ['Twilio_taken_by'] : [])];
  const outHeaders = [...fulfulHeaders, ...twilioHeaders];

  const outLines: string[] = [outHeaders.map(escapeCsv).join(',')];

  for (const row of fulful.rows) {
    const phone = (row['Phone'] ?? '').trim();
    const p10 = last10(phone);
    const matches = byPhone.get(p10) ?? [];

    if (matches.length === 0) {
      const fulfulVals = fulfulHeaders.map((h) => escapeCsv(row[h] ?? ''));
      const emptyTwilio = twilioHeaders.map(() => '');
      outLines.push([...fulfulVals, ...emptyTwilio].join(','));
    } else {
      for (const m of matches) {
        const fulfulVals = fulfulHeaders.map((h) => escapeCsv(row[h] ?? ''));
        const twilioVals = [
          m['call_sid'] ?? '',
          m['direction'] ?? '',
          m['agent_or_to'] ?? '',
          m['duration_sec'] ?? '',
          m['status'] ?? '',
          m['start_time'] ?? '',
          ...(hasTakenBy ? [(m['taken_by'] ?? '')] : []),
        ].map(escapeCsv);
        outLines.push([...fulfulVals, ...twilioVals].join(','));
      }
    }
  }

  fs.writeFileSync(OUT_CSV, outLines.join('\n'), 'utf-8');
  console.log('Wrote', OUT_CSV, '(', outLines.length - 1, 'data rows)');
}

main();
