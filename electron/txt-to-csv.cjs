const fs = require('fs');
const input = fs.readFileSync('transfers-over-10sec-list.txt', 'utf8');
const lines = input.split(/\r?\n/);
const header = lines[3];
const dataLines = lines.slice(5).filter((l) => l.trim());

function escapeCsv(field) {
  const s = String(field).trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

const rows = [header.split('\t').map(escapeCsv).join(',')];
for (const line of dataLines) {
  const fields = line.split('\t');
  rows.push(fields.map(escapeCsv).join(','));
}

fs.writeFileSync('transfers-over-10sec-list.csv', rows.join('\n'), 'utf8');
console.log('Wrote transfers-over-10sec-list.csv with', rows.length - 1, 'data rows');
