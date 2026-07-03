import { readFileSync } from 'fs';

// Read files
const zohoAgents = readFileSync('zoho_agents.csv', 'utf8').split('\n');
const assignments = readFileSync('queue_assignments.csv', 'utf8').split('\n');
const producers = readFileSync('ProducerList.csv', 'utf8').split('\n');

// Get all agent IDs that have queue assignments
const assignedIds = new Set();
assignments.forEach(line => {
    if (line === assignments[0]) return; // Skip header
    const agentId = line.split(',')[0];
    assignedIds.add(agentId);
});

// Check each Zoho agent
console.log('Agents not getting queue assignments:');
zohoAgents.forEach(line => {
    const [_, name, zohoId] = line.split(',');
    if (!name) return;

    // Get ID from name
    const idMatch = name.match(/\{(\d+)\}/);
    if (!idMatch) return;
    
    const id = idMatch[1];
    if (assignedIds.has(id)) return;

    // Find in ProducerList
    const producer = producers.find(p => p.startsWith(id + ','));
    
    // Get their market code from name
    const marketMatch = name.match(/\[([\d:]+)\]/);
    const markets = marketMatch ? marketMatch[1] : 'No market code';

    console.log(`\nID ${id} - ${name}`);
    console.log(`Markets: ${markets}`);
    console.log(`In ProducerList: ${producer ? 'Yes' : 'No'}`);
    if (producer) {
        const fields = producer.split(',');
        console.log(`ProducerList market: ${fields[6]}`);
    }
}); 