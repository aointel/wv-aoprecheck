import { readFileSync } from 'fs';

// Read files raw
const producers = readFileSync('ProducerList.csv', 'utf8').split('\n');
const zohoAgents = readFileSync('zoho_agents.csv', 'utf8').split('\n');
const queueMappings = readFileSync('queue_mappings.csv', 'utf8').split('\n');

// Let's check one specific agent in detail
const agentId = '106210'; // Firat U

// Find producer record
const producerLine = producers.find(line => line.split(',')[0] === agentId);
const fields = producerLine?.split(',');

console.log('Producer fields:', fields);
console.log('\nMarket:', fields?.[6]);  // Market is field 7
console.log('States:', fields?.slice(10, -3));  // States start at field 11

// Show what queues they should be assigned to
const states = fields?.slice(10, -3).filter(s => s.trim());
console.log('\nShould be assigned to these queues:');
states?.forEach(state => {
    if (fields[6] === 'Globe') {
        console.log(`GLOBE-${state.trim()}`);
    }
});

// Check if these queues exist in mappings
console.log('\nChecking if these queues exist:');
states?.forEach(state => {
    if (fields[6] === 'Globe') {
        const queueName = `GLOBE-${state.trim()}`;
        const queueExists = queueMappings.some(line => line.startsWith(queueName + ','));
        console.log(`${queueName}: ${queueExists ? 'Found' : 'Missing'}`);
    }
}); 