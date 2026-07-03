import { readFileSync } from 'fs';

const csvLines = readFileSync('ProducerList.csv', 'utf8').split('\n');
const zohoAgents = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Check one agent
const agentId = '106210'; // Firat U
console.log('Looking for agent ID:', agentId);

// Find in ProducerList
const producerLine = csvLines.find(line => line.split(',')[0] === agentId);
console.log('\nProducer record:', producerLine);

// Find in zoho_agents
const zohoAgent = zohoAgents.find(line => {
    const match = line.match(/\{(\d+)\}/);
    return match && match[1] === agentId;
});
console.log('\nZoho agent record:', zohoAgent); 