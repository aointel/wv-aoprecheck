const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'fb6b429c-ac6d-4590-86c1-dde40e3c77a7.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && c === ',') { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function durationAfterTransferToSeconds(str) {
  if (!str || typeof str !== 'string') return 0;
  const m = String(str).trim().match(/^(\d+):(\d+)$/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
}

function getBucket(persona) {
  const p = (persona || '').toLowerCase();
  if (p.includes('vetdirect')) return 'VET Direct';
  if (p.includes('globeautotransfer')) return 'GlobeAuto';
  if (p.includes('pavet new')) return 'PAVET New';
  if (p.includes('vn125')) return 'Vn125';
  return 'Other';
}

const header = parseCSVLine(lines[0]);
const col = (name) => header.indexOf(name);
const idxTransferred = col('Transferred');
const idxDurationAfter = col('Duration After Transfer');
const idxName = col('Name');
const idxPhone = col('Phone');
const idxDate = col('Date');
const idxTime = col('Time');
const idxPersona = col('Persona');

const MIN_DURATION_SEC = 10;
const results = [];

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  const transferred = (row[idxTransferred] || '').toUpperCase().trim();
  const durationStr = row[idxDurationAfter] || '';
  const name = (row[idxName] || '').trim() || '—';
  const phone = row[idxPhone] || '';
  const date = row[idxDate] || '';
  const time = row[idxTime] || '';
  const persona = row[idxPersona] || '';

  if (transferred !== 'YES') continue;
  const durationSec = durationAfterTransferToSeconds(durationStr);
  if (durationSec <= MIN_DURATION_SEC) continue;

  results.push({
    name,
    phone,
    date,
    time,
    durationAfterTransfer: durationStr,
    durationSeconds: durationSec,
    persona,
    bucket: getBucket(persona),
  });
}

// Sort by bucket then duration desc
const order = ['VET Direct', 'GlobeAuto', 'PAVET New', 'Vn125', 'Other'];
results.sort((a, b) => {
  const ai = order.indexOf(a.bucket);
  const bi = order.indexOf(b.bucket);
  if (ai !== bi) return ai - bi;
  return b.durationSeconds - a.durationSeconds;
});

// Group by bucket
const byBucket = {};
results.forEach((r) => {
  if (!byBucket[r.bucket]) byBucket[r.bucket] = [];
  byBucket[r.bucket].push(r);
});

// Summary
console.log('=== BREAKDOWN BY PERSONA (transfers > 10 sec) ===\n');
let total = 0;
order.forEach((bucket) => {
  const list = byBucket[bucket] || [];
  const count = list.length;
  const totalSec = list.reduce((s, r) => s + r.durationSeconds, 0);
  total += count;
  console.log(bucket + ':');
  console.log('  Count: ' + count);
  console.log('  Total duration: ' + Math.floor(totalSec / 60) + ' min ' + (totalSec % 60) + ' sec');
  console.log('');
});
console.log('TOTAL: ' + total + ' calls\n');

// Per-bucket lists
const outDir = __dirname;
order.forEach((bucket) => {
  const list = byBucket[bucket] || [];
  if (list.length === 0) return;
  const lines = [
    bucket + ' – Transfers > 10 sec (count: ' + list.length + ')',
    '',
    'Name (lead)\tPhone\tDate\tTime\tDuration (after transfer)\tDuration (sec)\tPersona',
    '-'.repeat(100),
    ...list.map((r) => [r.name, r.phone, r.date, r.time, r.durationAfterTransfer, r.durationSeconds, r.persona].join('\t')),
  ];
  const file = path.join(outDir, 'transfers-over-10sec-' + bucket.replace(/\s+/g, '-') + '.txt');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('Written: ' + file);
});
