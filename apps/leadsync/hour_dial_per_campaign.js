const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// File paths
const MARKET_STATE_TOTALS_FILE = "market_state_totals.csv";
const CAMPAIGN_LIST_FILE = "CampaignList.csv";
const AVAILABLE_AGENTS_FILE = "available_agents_full_data.csv";
const OUTPUT_FILE = "hour_dial_per_campaign.csv";

// Configuration
const MIN_AGENT_REQ = 333; // Lower this to a reasonable number
const MAX_DIALS_PER_AGENT = 95;
const TAALK_API_CONFIG = {
    base_url: "https://lets.taalk.ai/api/campaign2s",
    api_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4"
};

const staticCampaignData = {
    campaignId: "CAMP123",
    hourlyRate: 50,
    maxDials: 100
};

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

function getHourDialRate() {
    // Return static campaign data instead of calculating
    return staticCampaignData;
}

// Function to load CSV data
function loadCSV(filePath, isHourDial) {
    const fileContent = fs.readFileSync(filePath, "utf8");

    if (isHourDial) {
        // Unchanged logic for hour_dial_per_campaign.csv
        return parse(fileContent, {
            columns: ["State", "Market", "TotalAgents", "CampaignID", "HourDial"],
            skip_empty_lines: true,
            delimiter: ",",
        });
    } else {
        // NEW: If it's market_state_totals.csv, parse using the exact columns you actually have
        if (filePath.endsWith("market_state_totals.csv")) {
            return parse(fileContent, {
                columns: ["state", "market", "agentCount"],
                skip_empty_lines: true,
                delimiter: ",",
            });
        } else {
            // Unchanged logic for other CSVs
            return parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                delimiter: ",",
            });
        }
    }
}

// Function to send campaign updates to Taalk API
async function sendCampaignUpdate(campaignId, dialRate) {
    const url = `${TAALK_API_CONFIG.base_url}/${campaignId}`;
    const payload = { limitPerHour: dialRate };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TAALK_API_CONFIG.api_key}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Failed to update campaign ${campaignId}. Status: ${response.status}`);
            return;
        }

        // Just show success, no response data
        console.log(`✓ Updated ${campaignId} to ${dialRate} dials/hour`);

    } catch (error) {
        console.error(`Error updating ${campaignId}:`, error.message);
    }
}

// Function to merge Market-State Totals with CampaignList
function mergeMarketStateWithCampaigns(marketStateTotals, campaignList) {
    // REPLACED: No more pivot from "State" and the rest
    const merged = marketStateTotals.map(row => {
        // Convert your actual CSV fields
        const State = row.state;            // we match your lowercase "state"
        const Market = row.market;          // your lowercase "market"
        const parsedCount = parseInt(row.agentCount, 10) || 0;

        // Look up the CampaignID that matches (State, Market) in your CampaignList
        const CampaignID = campaignList.find(
            record => record.State === State && record.Market === Market
        )?.Campaign || "N/A";

        return {
            State,
            Market,
            TotalAgents: parsedCount,
            CampaignID
        };
    });

    console.log("[DEBUG] Post-merge results:");
    merged.forEach((m, idx) => {
        console.log(` ${idx+1}) State=${m.State}, Market=${m.Market}, TotalAgents=${m.TotalAgents}`);
    });

    return merged;
}

// Function to calculate HourDial for campaigns
function calculateHourDial(campaignData) {
    const totals = [];

    campaignData.forEach(campaign => {
        if (campaign.CampaignID === "N/A") {
            totals.push(campaign);
            return;
        }

        // If you want the script to compute the dial:
        const totalAgents = campaign.TotalAgents || 0;
        if (totalAgents < MIN_AGENT_REQ) {
            // If not enough agents, set a minimum dial
            campaign.HourDial = 1;
            console.log(
                `Campaign: ${campaign.CampaignID}, Agents: ${totalAgents} => HourDial=1 (below min agent req)`
            );
        } else {
            // Multiply agent count by MAX_DIALS_PER_AGENT
            campaign.HourDial = totalAgents * MAX_DIALS_PER_AGENT;
            console.log(
                `Campaign: ${campaign.CampaignID}, Agents: ${totalAgents} => HourDial=${campaign.HourDial}`
            );
        }

        totals.push(campaign);
    });

    return totals;
}

// Function to save data to CSV
function saveDataToCSV(data, filename) {
    if (data.length === 0) {
        console.warn("No data to save. The output file will be empty.");
    } else {
        stringify(data, { header: true }, (err, output) => {
            if (err) {
                console.error(`Failed to save data to ${filename}:`, err.message);
                return;
            }
            fs.writeFileSync(filename, output);
            console.log(`Data successfully saved to ${filename}`);
        });
    }
}

// Add this function to get agent count
function getAvailableAgentCount() {
    try {
        const agents = loadCSV(AVAILABLE_AGENTS_FILE);
        return agents.length;
    } catch (error) {
        console.error('Failed to get agent count:', error);
        return 0;
    }
}

// Use the same Taalk API configuration as sendLeads.js
const taalkApi = axios.create({
    baseURL: 'https://api.taalk.com',
    headers: {
        'Authorization': 'Bearer 6c1a63be-f87d-4c3d-a35d-c2c73d49a06d',
        'Content-Type': 'application/json'
    }
});

function loadCampaignList() {
    // Load real campaigns from the CSV
    const campaignList = loadCSV(CAMPAIGN_LIST_FILE);
    // Example: Suppose each record has { Campaign: "TAALK_123", SomeOtherCol: "..." }
    // Just return that array or transform it as needed
    return campaignList;
}

// STEP 1: Check for CSVs
console.log("STEP 1: Checking for CSVs...");

// After CSV check, we load CSVs below
async function getHourlyDialsPerCampaign() {
    const fullPathMst = path.resolve(MARKET_STATE_TOTALS_FILE);
    console.log("[DEBUG] Reading market_state_totals from:", fullPathMst);

    const marketStateTotals = loadCSV(MARKET_STATE_TOTALS_FILE, false);

    // Log each row from market_state_totals
    console.log("[DEBUG] market_state_totals rows:");
    marketStateTotals.forEach((row, idx) => {
        console.log(` Row #${idx+1}: `, row);
    });

    console.log("STEP 2: Merging CSV data...");
    const campaignList = loadCSV(CAMPAIGN_LIST_FILE, false);

    const merged = mergeMarketStateWithCampaigns(marketStateTotals, campaignList);

    console.log("STEP 3: Calculating hour-dials...");
    const withHourDial = calculateHourDial(merged);

    // ▼ ADD THIS CALL to overwrite hour_dial_per_campaign.csv with 1's
    // so the next function "sendHourDialCSVToTaalk()" sees only forced=1 rates.
    saveDataToCSV(withHourDial, OUTPUT_FILE);

    // Log everything in withHourDial, so you see what's missing or "N/A"
    console.log("DEBUG: Detailed records (all campaigns):");
    withHourDial.forEach(c => {
        console.log(
            ` - State=${c.State}, Market=${c.Market}, Agents=${c.TotalAgents}, ` +
            `HourDial=${c.HourDial}, CampaignID=${c.CampaignID}`
        );
    });

    // newDials is the subset with real CampaignIDs
    const newDials = withHourDial
        .filter(c => c.CampaignID !== "N/A")
        .map(c => ({
            campaignId: c.CampaignID,
            hour: 1,
            dialCount: c.HourDial
        }));

    return {
        newDials,
        detailedRecords: withHourDial
    };
}

async function trackLeadSent(leadId, campaignId) {
    // existing code, unchanged...
    // ...
}

// === NEW FUNCTION BELOW ===
async function processHourDial() {
    try {
        const { newDials, detailedRecords } = await getHourlyDialsPerCampaign();

        if (newDials.length === 0) {
            console.log("No campaigns found to update (newDials is empty).");
        } else {
            console.log(`Found ${newDials.length} campaigns to update:\n`);
        }

        // STEP 4: Compare old vs. new, then update Taalk...
        console.log("STEP 4: Compare old vs. new, then update Taalk...");

        // Use detailedRecords for a full list
        const campaignsToUpdate = detailedRecords.filter(c => c.CampaignID !== "N/A");
        campaignsToUpdate.forEach(c => {
            console.log(
                `Updating => CampaignID=${c.CampaignID}, State=${c.State}, Market=${c.Market}, ` +
                `Agents=${c.TotalAgents}, HourDial=${c.HourDial}`
            );
        });

        // Compare old vs. new...
        // ...
        // Send to Taalk
        for (const campaign of newDials) {
            console.log(`SEND to Taalk => CampaignID=${campaign.campaignId}, Dial=${campaign.dialCount}`);
            await sendCampaignUpdate(campaign.campaignId, campaign.dialCount);
        }

        // STEP 5: Final list
        console.log("STEP 5: Final list of updated campaigns and dials:");
        newDials.forEach(d => {
            console.log(` - ID: ${d.campaignId}, Dial Count: ${d.dialCount}`);
        });

        // ▼▼▼ Add these lines to log CampaignID and HourDial ▼▼▼
        console.log("\n=== Detailed Hour Dial Info Per Campaign ===");
        newDials.forEach(dial => {
            console.log(`CampaignID: ${dial.campaignId}, HourDial: ${dial.dialCount}`);
        });
        console.log("============================================\n");
        // ▲▲▲ End added lines ▲▲▲

    } catch (error) {
        console.error('Error in processHourDial:', error);
        throw error;
    }
}

// After processHourDial completes, rerun after 15 minutes
setTimeout(() => {
    console.log("\nRe-running processHourDial after 15 minutes...");
    processHourDial();
}, 15 * 60 * 1000);

// Add an immediate call so the script "does something" right away:
(async () => {
    await processHourDial();
})();

function calculateMarketStateTotals(fullData) {
    console.log("\nTotal agents before filtering:", fullData.length);
    const totals = {};

    // Debug: Show market mapping being used
    console.log("\nMarket mapping:", marketMap);

    // Process each agent
    fullData.forEach(record => {
        // Get both types of licensed states
        const lifeAndHealthStates = record["Life-and-Health Licensed States"]?.split(",").map(s => s.trim()).filter(s => s) || [];
        const lifeOnlyStates = record["Life-Only Licensed States"]?.split(",").map(s => s.trim()).filter(s => s) || [];
        const rawMarket = record["Designated Market"];

        // Map the market (Union -> Globe etc)
        const market = marketMap[rawMarket] || rawMarket;

        // Debug each agent
        console.log(`\nProcessing ${record["Agent Name"]}:`);
        console.log(`Market: ${rawMarket} -> ${market}`);
        console.log(`Life & Health States: ${lifeAndHealthStates.length}`);
        console.log(`Life Only States: ${lifeOnlyStates.length}`);

        // Get all unique states this agent is licensed for
        const allStates = [...new Set([...lifeAndHealthStates, ...lifeOnlyStates])];

        // Count this agent for each state they're licensed in
        allStates.forEach(state => {
            if (!totals[state]) {
                totals[state] = {
                    Globe: 0,
                    Vet: 0,
                    "Will Kit": 0,
                    Womens: 0
                };
            }
            totals[state][market]++;
        });
    });

    // Convert to array format and sort by state
    const results = Object.entries(totals).map(([state, markets]) => ({
        State: state,
        ...markets
    })).sort((a, b) => a.State.localeCompare(b.State));

    // Debug final totals
    console.log("\nFinal state/market totals:");
    results.forEach(row => {
        console.log(`${row.State}:`, 
            `Globe=${row.Globe}`,
            `Vet=${row.Vet}`,
            `Will Kit=${row["Will Kit"]}`,
            `Womens=${row.Womens}`
        );
    });

    return results;
}

// Add check at start
if (!fs.existsSync("available_agents_full_data.csv")) {
    console.error("ERROR: available_agents_full_data.csv not found!");
    console.error("Please run availableagents.js first to get available agents");
    process.exit(1);
}

module.exports = {
    getHourlyDialsPerCampaign,
    trackLeadSent,
    processHourDial
};

async function sendHourDialCSVToTaalk() {
    // 1. Load the hour_dial_per_campaign.csv
    const hourDialRecords = loadCSV("hour_dial_per_campaign.csv", true);

    // 2. Loop each row
    for (const row of hourDialRecords) {
        const campaignId = row.CampaignID;
        const hourDial = parseInt(row.HourDial, 10) || 0;
        
        // Skip if no real campaign
        if (!campaignId || campaignId === "N/A") {
            continue;
        }

        // 3. Log the data we're sending
        console.log(`Sending to Taalk => CampaignID=${campaignId}, HourDial=${hourDial}`);

        // 4. Actually send to Taalk
        await sendCampaignUpdate(campaignId, hourDial);
    }
}

(async () => {
    console.log("Reading hour_dial_per_campaign.csv and sending to Taalk...");
    await sendHourDialCSVToTaalk();
})();
