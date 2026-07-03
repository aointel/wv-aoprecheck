import { readFileSync, writeFileSync } from 'fs';

// Read files
const zohoAgents = readFileSync('zoho_agents.csv', 'utf8').split('\n');
const assignments = readFileSync('queue_assignments.csv', 'utf8').split('\n');

// Get all agent IDs that have queue assignments
const assignedIds = new Set();
assignments.forEach(line => {
    if (line === assignments[0]) return; // Skip header
    const agentId = line.split(',')[0];
    assignedIds.add(agentId);
});

// Map market codes to AOI MARKET values
const marketMap = {
    '1': 'Veteran',
    '2': 'Globe',
    '3': 'Will Kit',
    '4': 'Other'
};

// Create template rows
const templateRows = ['Associate ID,MGA,RGA,Company Email,Personal Email,Phone,AOI MARKET,AOI Market 2,Designated Market,Agent,Life-and-Health Licensed States'];

// Track how many agents we find
let missingCount = 0;

zohoAgents.forEach(line => {
    const [_, name, zohoId] = line.split(',');
    if (!name) return;

    // Get ID and market from name
    const idMatch = name.match(/\{(\d+)\}/);
    const marketMatch = name.match(/\[([\d:]+)\]/);
    
    if (idMatch) {
        const id = idMatch[1];
        
        // Skip if agent has queue assignments
        if (assignedIds.has(id)) return;
        
        const markets = marketMatch ? 
            marketMatch[1].split(':').map(code => marketMap[code]).filter(m => m) : 
            [];
            
        // Extract email if present
        const emailMatch = name.match(/\((.*?)\)/);
        const email = emailMatch ? emailMatch[1] : '';
        
        // Clean up name
        const cleanName = name
            .replace(/\{.*?\}/, '')  // Remove ID
            .replace(/\[.*?\]/, '')  // Remove market code
            .replace(/\(.*?\)/, '')  // Remove email
            .replace(/[-:]/g, '')    // Remove dashes and colons
            .trim();
            
        if (markets.length > 0) {
            templateRows.push(`${id},,${cleanName},${email},,,,${markets[0]},,${cleanName},`);
            missingCount++;
        }
    }
});

// Write to file and show summary
writeFileSync('producer_template.csv', templateRows.join('\n'));
console.log(`Found ${missingCount} agents missing from queue assignments`); 