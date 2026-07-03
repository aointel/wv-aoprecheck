import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read files
const assignments = parse(readFileSync('queue_assignments.csv'), { columns: true });
const zohoAgentsRaw = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Get all assigned IDs
const assignedIds = new Set(assignments.map(a => a.ZohoAgentID));

// Find unassigned agents
console.log('Agents in zoho_agents.csv with no queue assignments:\n');
zohoAgentsRaw.forEach(line => {
    if (!line.trim()) return; // Skip empty lines
    
    const [_, name, zohoId] = line.split(',');
    if (zohoId && !assignedIds.has(zohoId)) {
        console.log(`${name}`);
        console.log(`ID: ${zohoId}`);
        console.log('---');
    }
}); 