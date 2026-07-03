import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Read the mappings file
console.log('Reading queue_mappings.csv...');
const mappings = parse(readFileSync('queue_mappings.csv'), {
    columns: true,
    skip_empty_lines: true
});

// Show first few mappings to debug
console.log('\nFirst 3 raw mappings:');
console.log(JSON.stringify(mappings.slice(0, 3), null, 2));

// Group by queue to show summary
const queueSummary = {};
mappings.forEach((mapping, index) => {
    console.log(`\nMapping ${index}:`, mapping);  // Debug each mapping
    const { QueueName, QueueID, AgentEmail, Markets } = mapping;
    if (!queueSummary[QueueName]) {
        queueSummary[QueueName] = {
            id: QueueID,
            markets: Markets,
            agents: new Set()
        };
    }
    if (AgentEmail) {
        queueSummary[QueueName].agents.add(AgentEmail);
    }
});

// Display summary
console.log('\nQueue Update Summary:');
console.log('===================');
Object.entries(queueSummary).forEach(([queueName, data]) => {
    if (!queueName || queueName === 'undefined') {
        console.log('\nWARNING: Invalid queue name found!');
        return;
    }
    console.log(`\nQueue: ${queueName}`);
    console.log(`ID: ${data.id}`);
    console.log(`Markets: ${data.markets}`);
    console.log(`Agents Assigned: ${data.agents.size}`);
    console.log('Agents:', Array.from(data.agents));
    console.log('-------------------');
});

console.log(`\nTotal Valid Queues: ${Object.keys(queueSummary).filter(name => name && name !== 'undefined').length}`); 