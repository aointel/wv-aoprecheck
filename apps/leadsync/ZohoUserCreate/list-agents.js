import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read files
const assignments = parse(readFileSync('queue_assignments.csv'), { columns: true });
const zohoAgentsRaw = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Create map of agent ID to their queues
const agentQueues = new Map();
assignments.forEach(a => {
    if (!agentQueues.has(a.ZohoAgentID)) {
        agentQueues.set(a.ZohoAgentID, {
            name: a.AgentName,
            email: a.Email,
            queues: new Set()
        });
    }
    agentQueues.get(a.ZohoAgentID).queues.add(a.QueueName);
});

// Print all agents and their queues
console.log('All Agents and Their Queue Assignments:\n');
agentQueues.forEach((data, id) => {
    console.log(`${data.name} (${data.email})`);
    console.log(`ID: ${id}`);
    console.log('Queues:', Array.from(data.queues).join(', '));
    console.log('---\n');
});

// Print stats
console.log('\nStats:');
console.log('Total unique agents:', agentQueues.size);
console.log('Total assignments:', assignments.length); 