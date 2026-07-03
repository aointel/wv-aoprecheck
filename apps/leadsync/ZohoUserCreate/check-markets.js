import { readFileSync } from 'fs';

// Read ProducerList.csv
const producers = readFileSync('ProducerList.csv', 'utf8').split('\n');

// Get all unique values from AOI MARKET (field 7) and AOI Market 2 (field 8)
const markets = new Set();
const market2s = new Set();

producers.forEach(line => {
    const fields = line.split(',');
    if (fields[6]) markets.add(fields[6]);
    if (fields[7]) market2s.add(fields[7]);
});

console.log('All unique values in AOI MARKET:');
console.log([...markets].sort().join('\n'));

console.log('\nAll unique values in AOI Market 2:');
console.log([...market2s].sort().join('\n'));

// Show our current mapping
console.log('\nCurrent mapping in compare-agents.js:');
console.log('market === "Veteran" -> PAVET-');
console.log('market === "Globe" -> GLOBE-');
console.log('market === "Will Kit" -> WILLKIT-'); 