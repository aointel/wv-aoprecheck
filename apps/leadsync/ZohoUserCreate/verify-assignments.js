import { readFileSync } from 'fs';

// Read the generated assignments
const assignments = readFileSync('queue_assignments.csv', 'utf8').split('\n');

// Check assignments for agent 106210 (Firat)
console.log('Assignments for agent 106210:');
assignments.forEach(line => {
    if (line.startsWith('106210,')) {
        console.log(line);
    }
});

// Count how many queues each Zoho ID is assigned to
const zohoIdCounts = new Map();
assignments.forEach(line => {
    if (line === assignments[0]) return; // Skip header
    const zohoId = line.split(',')[5];
    zohoIdCounts.set(zohoId, (zohoIdCounts.get(zohoId) || 0) + 1);
});

console.log('\nZoho ID assignment counts:');
zohoIdCounts.forEach((count, id) => {
    if (id) console.log(`${id}: ${count} queues`);
}); 