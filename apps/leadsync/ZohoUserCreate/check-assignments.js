import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read all files
const assignments = parse(readFileSync('queue_assignments.csv'), { columns: true });
const zohoAgents = parse(readFileSync('zoho_agents.csv'), { columns: true });
const producers = parse(readFileSync('ProducerList.csv'), { columns: true });

// Count empty ZohoAgentIDs
const emptyIds = assignments.filter(a => !a.ZohoAgentID).length;
console.log('Assignments with empty ZohoAgentIDs:', emptyIds);

// Sample a few empty ones
console.log('\nSample assignments with empty IDs:');
assignments.filter(a => !a.ZohoAgentID).slice(0, 3).forEach(a => {
    console.log(a);
});

// Check total counts
console.log('\nTotal counts:');
console.log('Producers:', producers.length);
console.log('Zoho Agents:', zohoAgents.length);
console.log('Queue Assignments:', assignments.length); 