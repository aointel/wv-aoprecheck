import { readFileSync } from 'fs';

// Read files
const producers = readFileSync('ProducerList.csv', 'utf8').split('\n');
const assignments = readFileSync('queue_assignments.csv', 'utf8').split('\n');
const zohoAgents = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Find agent in ProducerList
const agentId = '153450';
const producer = producers.find(p => p.startsWith(agentId + ','));
console.log('\nIn ProducerList:');
console.log(producer);

// Find in zoho_agents
const zohoAgent = zohoAgents.find(line => line.includes(`{${agentId}}`));
console.log('\nIn zoho_agents:');
console.log(zohoAgent);

// Find any assignments
const agentAssignments = assignments.filter(line => line.includes(agentId));
console.log('\nQueue assignments:');
console.log(agentAssignments.join('\n') || 'No assignments found'); 