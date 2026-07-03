/**
 * CSV-only: extract Taalk_Session from Params, download each recording from Taalk, save as MP3.
 * No Taalk search, no lookups — session IDs come only from the CSV.
 *
 * Usage: npx tsx fetch-recordings-from-csv.ts <path-to-csv>
 */

import * as fs from 'fs';
import * as path from 'path';

const TAALK_API_KEY = process.env.TAALK_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
const TAALK_DB = 'michaelmandella';

interface Row {
  sessionId: string;
  date: string;
  time: string;
  phone: string;
  leadName?: string;
}

function extractTaalkSessionIds(csvPath: string): Row[] {
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0];
  if (!header.toLowerCase().includes('params') || !header.toLowerCase().includes('agent')) {
    throw new Error('Expected CSV with columns Date,Time,Event,Phone,Agent,Params');
  }

  const sessionRe = /"Taalk_Session"\s*:\s*"([a-f0-9]+)"/i;
  const firstRe = /"First Name"\s*:\s*"([^"]*)"/;
  const lastRe = /"Last Name"\s*:\s*"([^"]*)"/;
  const phoneRe = /(\+\d{10,15})/;
  const dateRe = /^(\d{1,2}\/\d{1,2}\/\d{4})/;
  const timeRe = /"(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))"/i;

  const rows: Row[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(sessionRe);
    if (!m) continue;
    const sessionId = m[1];
    if (seen.has(sessionId)) continue;
    seen.add(sessionId);

    const first = firstRe.exec(line)?.[1] ?? '';
    const last = lastRe.exec(line)?.[1] ?? '';
    const leadName = [first, last].filter(Boolean).join(' ').trim() || undefined;
    const date = dateRe.exec(line)?.[1] ?? '';
    const time = timeRe.exec(line)?.[1] ?? '';
    const phone = phoneRe.exec(line)?.[1] ?? '';

    rows.push({ sessionId, date, time, phone, leadName });
  }

  return rows;
}

async function fetchRecording(sessionId: string): Promise<Buffer | null> {
  const url = `https://api.taalk.ai/api/calls/${sessionId}/recording?db=${TAALK_DB}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TAALK_API_KEY}`,
      Accept: 'audio/mpeg, audio/mp3, audio/*, */*',
    },
  });
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('audio') && !ct.includes('octet-stream')) {
    const buf = Buffer.from(await res.arrayBuffer());
    const preview = buf.toString('utf-8', 0, 200);
    if (preview.includes('error') || preview.includes('redirect') || preview.includes('<!')) {
      return null;
    }
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const csvPath = process.argv[2] || path.join(process.cwd(), '2f38de93-c56e-40da-bfc2-fe936a71f2c0.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const csvId = path.basename(csvPath, path.extname(csvPath));
  const outDir = path.join(process.cwd(), `recordings-csv-${csvId}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log('Output directory:', outDir);

  const rows = extractTaalkSessionIds(csvPath);
  const byPhone = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.phone || r.sessionId;
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key)!.push(r);
  }
  console.log('Unique Taalk sessions:', rows.length);
  console.log('Unique phone numbers:', byPhone.size);
  for (const [ph, sess] of byPhone) {
    if (sess.length > 1) console.log(`  ${ph}: ${sess.length} sessions (downloading all)`);
  }

  const results: { sessionId: string; phone?: string; ok: boolean; path?: string; error?: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const phoneKey = r.phone || r.sessionId;
    const safePhone = (phoneKey || 'unknown').replace(/[<>:"/\\|?*]/g, '_').slice(0, 40);
    const safeLead = (r.leadName || 'unknown').replace(/[<>:"/\\|?*]/g, '_').slice(0, 60);
    const phoneDir = path.join(outDir, `${safePhone}_${safeLead}`);
    fs.mkdirSync(phoneDir, { recursive: true });

    process.stdout.write(`[${i + 1}/${rows.length}] ${r.phone || '?'} ${r.sessionId} ... `);
    try {
      const buf = await fetchRecording(r.sessionId);
      if (!buf || buf.length < 1000) {
        console.log('skip (no audio)');
        results.push({ sessionId: r.sessionId, phone: r.phone, ok: false, error: 'no audio or tiny' });
        continue;
      }
      const fname = `${r.sessionId}.mp3`;
      const outPath = path.join(phoneDir, fname);
      fs.writeFileSync(outPath, buf);
      const rel = path.relative(outDir, outPath);
      console.log(`saved ${(buf.length / 1024).toFixed(1)} KB -> ${rel}`);
      results.push({ sessionId: r.sessionId, phone: r.phone, ok: true, path: outPath });
    } catch (e: any) {
      console.log('err:', e.message);
      results.push({ sessionId: r.sessionId, phone: r.phone, ok: false, error: e.message });
    }
  }

  const ok = results.filter((x) => x.ok).length;
  const failed = results.filter((x) => !x.ok);
  console.log('\n--- Summary ---');
  console.log(`Saved: ${ok}/${rows.length}`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => `${f.sessionId} (${f.error})`).join(', '));
  }
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      { csvPath, total: rows.length, saved: ok, failed: failed.length, results },
      null,
      2
    )
  );
  console.log('Manifest:', manifestPath);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
