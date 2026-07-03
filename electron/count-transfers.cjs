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

function getBucket(persona) {
  const p = (persona || '').toLowerCase();
  if (p.includes('vetdirect')) return 'VET Direct';
  if (p.includes('globeautotransfer')) return 'GlobeAuto';
  return null;
}

const header = parseCSVLine(lines[0]);
const idxTransferred = header.indexOf('Transferred');
const idxPersona = header.indexOf('Persona');

let globeAuto = 0;
let vetDirect = 0;

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  const transferred = (row[idxTransferred] || '').toUpperCase().trim();
  if (transferred !== 'YES') continue;
  const bucket = getBucket(row[idxPersona] || '');
  if (bucket === 'GlobeAuto') globeAuto++;
  if (bucket === 'VET Direct') vetDirect++;
}

console.log('Total transfers (any duration) in CSV:');
console.log('  GlobeAuto:  ' + globeAuto);
console.log('  VET Direct: ' + vetDirect);
console.log('  Combined:   ' + (globeAuto + vetDirect));
