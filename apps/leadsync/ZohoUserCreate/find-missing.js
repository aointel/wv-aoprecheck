import { readFileSync } from 'fs';

// Read files
const assignments = readFileSync('queue_assignments.csv', 'utf8').split('\n');
const zohoAgents = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Get all assigned Zoho IDs
const assignedIds = new Set();
assignments.forEach(line => {
    const zohoId = line.split(',')[5];  // ZohoAgentID is 6th column
    if (zohoId) assignedIds.add(zohoId);
});

// Find agents in zoho_agents.csv who aren't assigned to any queues
console.log('Agents with no queue assignments:');
zohoAgents.forEach(line => {
    const [_, name, zohoId] = line.split(',');
    if (zohoId && !assignedIds.has(zohoId)) {
        // Also show their market code from the name (e.g. [1], [2], [3], [4])
        const marketMatch = name?.match(/\[([\d:]+)\]/);
        const markets = marketMatch ? marketMatch[1] : 'No market code';
        console.log(`${name} - Markets: ${markets}`);
        console.log(`ID: ${zohoId}`);
        console.log('---');
    }
}); 