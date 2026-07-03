import { readFileSync, writeFileSync } from 'fs';

// Read both CSVs
const csvLines = readFileSync('ProducerList.csv', 'utf8').split('\n');
const zohoAgentsRaw = readFileSync('zoho_agents.csv', 'utf8')
    .split('\n')
    .map(line => line.split(','));

// Just show me what's in zoho_agents.csv
console.log('First few zoho agents:');
zohoAgentsRaw.slice(0,5).forEach(agent => {
    console.log(agent);
});

// Create assignments array with header
const assignments = ['AgentID,AgentName,Email,Market,QueueName,ZohoAgentID'];

// For each line
csvLines.forEach(line => {
    const fields = line.split(',');
    const id = fields[0];
    const name = fields[9];
    const email = fields[3];
    const market1 = fields[6];  // AOI MARKET
    const market2 = fields[7];  // AOI Market 2
    const states = fields.slice(10, -3);
    
    // Find matching Zoho agent by ID in curly braces
    const zohoAgents = zohoAgentsRaw.filter(agent => {
        const match = agent[1]?.match(/\{(\d+)\}/);
        return match && match[1] === id;
    });

    // Create assignments for each market
    [market1, market2].forEach(market => {
        if (!market) return;  // Skip empty markets
        
        // Normalize market names
        const normalizedMarket = 
            market.toLowerCase().includes('womens benefit') ? 'Will Kit' :
            market.toLowerCase().includes('smb veteran') ? 'Veteran' : 
            market;
        
        const prefix = 
            normalizedMarket === 'Veteran' ? 'PAVET-' :
            normalizedMarket === 'Globe' ? 'GLOBE-' :
            normalizedMarket === 'Will Kit' ? 'WILLKIT-' : null;

        if (prefix) {
            zohoAgents.forEach(zohoAgent => {
                const zohoAgentId = zohoAgent[2];
                states.forEach(state => {
                    if (state.trim()) {
                        assignments.push(`${id},${name},${email},${normalizedMarket},${prefix}${state.trim()},${zohoAgentId}`);
                    }
                });
            });
        }
    });
});

// Write to file
writeFileSync('queue_assignments.csv', assignments.join('\n'));