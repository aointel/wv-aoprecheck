import { readFileSync } from 'fs';

// Read files
const producers = readFileSync('ProducerList.csv', 'utf8').split('\n');
const zohoAgents = readFileSync('zoho_agents.csv', 'utf8').split('\n');

// Map market codes to names
const marketMap = {
    '1': 'Veteran',
    '2': 'Globe',
    '3': 'Will Kit',
    '4': 'Other'
};

// Check each Zoho agent
console.log('Agents missing from ProducerList:');
zohoAgents.forEach(line => {
    const [_, name, zohoId] = line.split(',');
    if (!name) return;

    // Get their ID from name
    const idMatch = name.match(/\{(\d+)\}/);
    if (!idMatch) return;
    
    const id = idMatch[1];
    
    // Check if in ProducerList
    const inProducerList = producers.some(p => p.startsWith(id + ','));
    
    if (!inProducerList) {
        // Get their market code
        const marketMatch = name.match(/\[([\d:]+)\]/);
        const markets = marketMatch ? 
            marketMatch[1].split(':').map(code => marketMap[code]).filter(m => m).join(', ') :
            'No market code';
            
        console.log(`\nID ${id} - ${name}`);
        console.log(`Should be in market(s): ${markets}`);
        console.log(`Zoho ID: ${zohoId}`);
    }
}); 