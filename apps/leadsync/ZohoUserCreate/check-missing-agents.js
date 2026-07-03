import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read files
const assignments = parse(readFileSync('queue_assignments.csv'), { columns: true });
const zohoAgentsRaw = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Get all unique agent IDs from assignments
const assignmentIds = new Set(assignments.map(a => a.ZohoAgentID));

// Process zoho agents
console.log('Agents in zoho_agents.csv but missing from assignments:');
let count = 0;

zohoAgentsRaw.forEach(line => {
    const [_, name, zohoId] = line.split(',');
    if (zohoId && !assignmentIds.has(zohoId)) {
        console.log(`${name} (ID: ${zohoId})`);
        count++;
    }
});

console.log(`\nTotal missing agents: ${count}`);

// Also show some stats
console.log('\nStats:');
console.log('Total assignments:', assignments.length);
console.log('Total zoho agents:', zohoAgentsRaw.length);
console.log('Unique assignment IDs:', assignmentIds.size); 