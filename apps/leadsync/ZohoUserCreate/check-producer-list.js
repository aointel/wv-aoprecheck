import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read files
const producers = parse(readFileSync('ProducerList.csv'), { columns: true });
const zohoAgentsRaw = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Check a few specific agents
const agentsToCheck = [
    '117239', // Leyna T [1]
    '162574', // Aja L [3]
    '106210'  // Firat U [2]
];

agentsToCheck.forEach(id => {
    console.log(`\nChecking agent ID ${id}:`);
    console.log('In ProducerList:', producers.find(p => p.AgentID === id));
}); 