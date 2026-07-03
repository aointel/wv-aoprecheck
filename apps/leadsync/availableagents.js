import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fetch from 'node-fetch';

// File paths
const ALL_AGENTS_FILE = "all_agents_full_data.csv";    // Input file - already exists
const OUTPUT_FILE = "available_agents_full_data.csv";   // Output file - available only

// Zoho API config
const ZOHO_CONFIG = {
    baseUrl: 'https://voice.zoho.com/rest/json/zv/api',
    auth: process.env.ZOHO_ACCESS_TOKEN
};

// Add check at start
if (!fs.existsSync("all_agents_full_data.csv")) {
    console.error("ERROR: all_agents_full_data.csv not found!");
    console.error("Please run app.js first to get all agents from Zoho");
    process.exit(1);
}

// Get current agent status from Zoho
async function getZohoAgentStatus() {
    try {
        console.log('Getting agent status from Zoho...');
        
        const response = await fetch(`${ZOHO_CONFIG.baseUrl}/agents/status`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_CONFIG.auth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Zoho API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Got status for ${data.agents?.length || 0} agents`);
        
        return data.agents || [];
    } catch (error) {
        console.error('Failed to get Zoho agent status:', error);
        throw error;
    }
}

// Main function to process available agents
async function processAvailableAgents() {
    try {
        // 1. Load existing all_agents_full_data.csv
        const allAgentsData = fs.readFileSync(ALL_AGENTS_FILE, "utf8");
        const allAgents = parse(allAgentsData, { columns: true });
        console.log(`Loaded ${allAgents.length} agents from ${ALL_AGENTS_FILE}`);

        // 2. Get current status from Zoho
        const zohoAgents = await getZohoAgentStatus();
        console.log(`Got status for ${zohoAgents.length} agents`);

        // 3. Filter for available agents
        const availableAgents = allAgents.filter(agent => {
            const status = zohoAgents.find(z => 
                z.email === agent["Company Email"] ||
                z.email === agent["Personal Email"]
            );
            return status && status.status === 'Available';
        });

        console.log(`Found ${availableAgents.length} available agents`);

        // 4. Save available agents
        const output = stringify(availableAgents, { header: true });
        fs.writeFileSync(OUTPUT_FILE, output);
        console.log(`Saved available agents to ${OUTPUT_FILE}`);

        return availableAgents;
    } catch (error) {
        console.error('Error processing available agents:', error);
        throw error;
    }
}

export { processAvailableAgents };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    processAvailableAgents();
}

function buildCombinedStates(agentRecord) {
  // Suppose you originally had these columns separately.
  // Now you combine them into one string with commas:
  const states = [];
  if (agentRecord.lifeHealth1) states.push(agentRecord.lifeHealth1);
  if (agentRecord.lifeHealth2) states.push(agentRecord.lifeHealth2);
  if (agentRecord.lifeHealth3) states.push(agentRecord.lifeHealth3);

  // Turn it into "AZ,CA,IL" format
  return states.join(",");
}

// Then, when writing the CSV:
records.push({
  "Agent Name": agentRecord.agentName,
  "Designated Market": agentRecord.market,
  "Life-and-Health Licensed States": buildCombinedStates(agentRecord),
  // etc...
});
