const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'fb6b429c-ac6d-4590-86c1-dde40e3c77a7.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
  const out = [];
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

// Parse "M:SS" or "M:SS" to total seconds
function durationAfterTransferToSeconds(str) {
  if (!str || typeof str !== 'string') return 0;
  const s = str.trim();
  const m = s.match(/^(\d+):(\d+)$/);
  if (!m) return 0;
  const minutes = parseInt(m[1], 10);
  const secs = parseInt(m[2], 10);
  return minutes * 60 + secs;
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
    agent: '',
  });
}

// Sort by duration descending
results.sort((a, b) => b.durationSeconds - a.durationSeconds);

console.log('Transfers where agent answered and call lasted > 10 seconds');
console.log('Total count:', results.length);
console.log('');
console.log('Name (lead)\tPhone\tDate\tTime\tDuration (after transfer)\tDuration (sec)\tPersona\tAgent (who took call)');
console.log('-'.repeat(140));
results.forEach((r) => {
  console.log([r.name, r.phone, r.date, r.time, r.durationAfterTransfer, r.durationSeconds, r.persona, r.agent || ''].join('\t'));
});
