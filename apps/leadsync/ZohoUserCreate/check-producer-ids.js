import { readFileSync } from 'fs';

// Read ProducerList.csv
const producers = readFileSync('ProducerList.csv', 'utf8').split('\n');

// Check a few missing IDs
const idsToCheck = ['162574', '117239', '179877'];

console.log('Checking ProducerList.csv for missing agents:');
idsToCheck.forEach(id => {
    const found = producers.find(line => line.startsWith(id + ','));
    console.log(`\nID ${id}:`);
    console.log(found || 'Not found in ProducerList.csv');
}); 