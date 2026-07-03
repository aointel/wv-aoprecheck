import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import fetch from 'node-fetch';
import csv from 'csv-parser';
import fs from 'fs';

// File paths
const FULL_DATA_FILE = "available_agents_full_data.csv";
const OUTPUT_FILE = "market_state_totals.csv";

// Market Mapping based on actual data from producer list
const marketMap = {
    "Globe Market": "Globe",
    "Veteran": "Vet",
    "Union": "Globe",
    "Veterans": "Vet",    
    "Globe": "Globe",     
    "Vet": "Vet",
    "Will Kit": "Will Kit",  // Will Kit is its own market
    "Womens Benefit Requests": "Womens"  // Womens is its own market
};

const ZOHO_CONFIG = {
    baseUrl: 'https://voice.zoho.com/rest/json/zv/api',
    token: process.env.ZOHO_ACCESS_TOKEN
};

// Function to load CSV data
function loadCSV(filePath) {
    try {
        console.log(`Loading data from ${filePath}...`);
        const fileContent = readFileSync(filePath, "utf8");
        const records = parse(fileContent, { columns: true, trim: true });
        
        // Show ALL unique markets we find
        const markets = new Set();
        records.forEach(r => {
            if (r["Designated Market"]) {
                markets.add(r["Designated Market"]);
            }
        });
        console.log("\nAll markets found in data:", Array.from(markets));
        
        return records;
    } catch (error) {
        console.error(`Failed to load ${filePath}:`, error.message);
        throw error;
    }
}

function combineStateColumns(agent) {
    // Suppose your CSV layout is:
    //  0: Agent Name
    //  1: Designated Market
    //  2: Life-and-Health Licensed State #1
    //  3: Life-and-Health Licensed State #2
    //  4: Life-and-Health Licensed State #3
    //  5: Online Status
    //  etc...
    // Then you'd read agent["Life-and-Health Licensed States"] for col 2,
    // agent["Another Column"] for col 3, etc.

    const states = [];
    // For example, maybe you rename "Life-and-Health Licensed States" to "State1"?
    // Or do you have guaranteed column names "AZ/CA/IL"? If so, you'd do:
    const possibleColumns = [
        "Life-and-Health Licensed States",
        "Life-Only Licensed States",
        "Health-Only Licensed States"
    ];

    // If each column can hold multiple states, we do .split(",")
    // but if each column is just one state (like "AZ"), we just push it if not empty.
    possibleColumns.forEach(col => {
        const raw = agent[col] || "";
        // Maybe each col is just a single state. If so, just push if non-empty.
        if (raw.trim()) {
            states.push(raw.trim());
        }
    });

    // Now 'states' might have up to 3 items
    // or more if each col could hold multiple states (like "AZ,CA").
    // If you do want to handle "AZ,CA" in one col, you'd do .split(",") too.
    //
    // Return them as a unique set
    return [...new Set(states)];
}

// Function to calculate totals by market and state
async function calculateMarketStateTotals() {
    try {
        const agentsData = loadCSV('available_agents_full_data.csv');
        if (!agentsData || !Array.isArray(agentsData)) {
            console.error('No agent data found or invalid format');
            return [];
        }

        const marketStateTotals = {};

        agentsData.forEach(agent => {
            if (agent["Online Status"] !== "Available") {
                return;
            }

            const combinedStates = combineStateColumns(agent);
            // If you want to debug:
            console.log(`[DEBUG] Agent: ${agent["Agent Name"]} => states:`, combinedStates);

            combinedStates.forEach(state => {
                // skip blanks
                if (!state) return;

                const market = agent["Designated Market"] || "N/A";
                if (market === "N/A") return;

                const key = `${state}-${market}`;
                if (!marketStateTotals[key]) {
                    marketStateTotals[key] = { state, market, agentCount: 0 };
                }
                marketStateTotals[key].agentCount++;
            });
        });

        // Output
        const output = Object.values(marketStateTotals);
        console.log(`\n[DEBUG] Final: Found ${output.length} (state, market) rows total.`);
        saveDataToCSV(output, 'market_state_totals.csv');
        console.log("Wrote market_state_totals.csv");
        return output;

    } catch (err) {
        console.error("calculateMarketStateTotals() error:", err);
        return [];
    }
}

// Function to save data to CSV
function saveDataToCSV(records, filePath) {
    if (!Array.isArray(records)) {
        console.error(`Error saving CSV: 'records' must be an array but got type '${typeof records}':`, records);
        return;
    }

    try {
        const csvString = stringify(records, { header: true });
        fs.writeFileSync(filePath, csvString);
        console.log(`Saved CSV to ${filePath} with ${records.length} records`);
    } catch (error) {
        console.error(`Failed to save CSV to ${filePath}:`, error);
    }
}

// Main execution
(async () => {
    try {
        console.log("\nReading available_agents_full_data.csv...");
        const fileContent = readFileSync(FULL_DATA_FILE, "utf8");
        console.log("File content sample:", fileContent.substring(0, 500));
        
        const fullData = parse(fileContent, { columns: true });
        console.log("\nParsed data sample:", fullData[0]);
        console.log("Total records:", fullData.length);
        
        const marketStateTotals = await calculateMarketStateTotals();
        const totalsArray = Array.isArray(marketStateTotals) ? marketStateTotals : Object.values(marketStateTotals);
        saveDataToCSV(totalsArray, OUTPUT_FILE);
    } catch (error) {
        console.error("Error:", error);
        console.error("Stack:", error.stack);
    }
})();

export async function processMarketStateTotals(availableAgents) {
    try {
        console.log('Processing market state totals...');
        const marketStateTotals = await calculateMarketStateTotals();
        const totalsArray = Array.isArray(marketStateTotals) ? marketStateTotals : Object.values(marketStateTotals);
        saveDataToCSV(totalsArray, OUTPUT_FILE);
        return marketStateTotals;
    } catch (error) {
        console.error('Error processing market state totals:', error);
        throw error;
    }
}

function checkTaalkQueueUpdates(marketStateTotals) {
    // Load campaign list
    const campaignList = parse(readFileSync("campaignlist.csv", "utf8"), { columns: true });
    
    const queueUpdates = [];

    campaignList.forEach(campaign => {
        const state = campaign.State;
        const market = campaign.Market; // Assuming "Globe" or "Vet"
        
        // Find state in our totals
        const stateTotal = marketStateTotals.find(s => s.State === state);
        
        if (stateTotal) {
            const availableAgents = stateTotal[market];
            const currentQueueSize = parseInt(campaign.QueueSize || 0);
            
            if (availableAgents === 0 && currentQueueSize > 0) {
                queueUpdates.push({
                    State: state,
                    Market: market,
                    CurrentQueue: currentQueueSize,
                    AvailableAgents: 0,
                    Action: "PAUSE"
                });
            } else if (availableAgents > 0 && currentQueueSize === 0) {
                queueUpdates.push({
                    State: state,
                    Market: market,
                    CurrentQueue: currentQueueSize,
                    AvailableAgents: availableAgents,
                    Action: "UNPAUSE"
                });
            }
        }
    });

    // Save updates needed
    if (queueUpdates.length > 0) {
        saveDataToCSV(queueUpdates, "queue_updates_needed.csv");
        console.log(`Found ${queueUpdates.length} queues needing updates`);
    } else {
        console.log("No queue updates needed");
    }
}

function processAgentStates(agent) {
    // Get all states the agent is licensed in
    const allStates = [
        ...(agent['Life-and-Health Licensed States'] || '').split(','),
        ...(agent['Life-Only Licensed States'] || '').split(','),
        ...(agent['Health-Only Licensed States'] || '').split(',')
    ]
    .map(s => s.trim())
    .filter(s => s); // Remove empty strings

    const market = agent['Designated Market'];
    
    // Add each state/market combo
    allStates.forEach(state => {
        if (!state || !market) return;
        
        const key = `${state}-${market}`;
        if (!marketStateTotals[key]) {
            marketStateTotals[key] = {
                state: state,
                market: market,
                agentCount: 0
            };
        }
        marketStateTotals[key].agentCount++;
    });
}

// Get online agents from Zoho first
async function getOnlineAgents() {
    try {
        const response = await fetch(`${ZOHO_CONFIG.baseUrl}/agents/status`, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${ZOHO_CONFIG.token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Zoho API error: ${response.status}`);
        }

        const data = await response.json();
        // Only return agents who are Available
        return data.agents?.filter(a => a.status === 'Available') || [];
    } catch (error) {
        console.error('Failed to get online agents:', error);
        throw error;
    }
}

async function generateMarketStateTotals() {
    const marketStateTotals = {};
    
    // 1. Get online agents first
    const onlineAgents = await getOnlineAgents();
    console.log("[DEBUG] onlineAgents length:", onlineAgents.length);

    // 2. Read producer list and only count ONLINE agents
    const producers = [];
    await new Promise((resolve, reject) => {
        fs.createReadStream('producerlist.csv')
            .pipe(csv())
            .on('data', (producer) => {
                // Check if producer is online
                const isOnline = onlineAgents.some(a => 
                    a.email === producer['Company Email'] 
                    || a.email === producer['Personal Email']
                );
                
                if (isOnline) {
                    // Extra debug: show the raw columns for each producer
                    console.log("[DEBUG] Online Producer:", producer);
                    producers.push(producer);
                }
            })
            .on('end', resolve)
            .on('error', reject);
    });

    console.log("[DEBUG] producers length:", producers.length);

    // 3. Process each online producer's states
    producers.forEach(producer => {
        // Combine states from the 3 license columns
        const allStates = [
            ...(producer['Life-and-Health Licensed States'] || '').split(','),
            ...(producer['Life-Only Licensed States'] || '').split(','),
            ...(producer['Health-Only Licensed States'] || '').split(',')
        ]
        .map(s => s.trim())
        .filter(Boolean);

        // Use the 'Designated Market' column
        const market = producer['Designated Market'];

        // Debug: see if we have a market
        if (!market) {
            console.log("[DEBUG] Skipping, no market for:", producer['Associate ID'], producer);
            return;
        }

        // Debug: how many states did we get?
        console.log(`[DEBUG] Producer ${producer['Associate ID']} => states: ${allStates}, market=${market}`);

        // Add each (state, market) to marketStateTotals
        allStates.forEach(state => {
            const key = `${state}-${market}`;
            if (!marketStateTotals[key]) {
                marketStateTotals[key] = {
                    state,
                    market,
                    agentCount: 0
                };
            }
            marketStateTotals[key].agentCount++;
        });
    });

    // 4. Convert this object to an array + save to CSV
    const output = Object.values(marketStateTotals);
    console.log(`[DEBUG] marketStateTotals keys: ${Object.keys(marketStateTotals).length}`);
    console.log("[DEBUG] output length:", output.length);

    saveDataToCSV(output, 'market_state_totals.csv');
    console.log(`[DEBUG] Wrote ${output.length} records to market_state_totals.csv`);

    return output;
}

export { generateMarketStateTotals };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateMarketStateTotals();
}

