const { readFileSync, writeFileSync } = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const fetch = require('node-fetch');

// File paths
const MARKET_STATE_TOTALS_FILE = "market_state_totals.csv";
const CAMPAIGN_LIST_FILE = "CampaignList.csv";
const AVAILABLE_AGENTS_FILE = "available_agents_full_data.csv";
const OUTPUT_FILE = "hour_dial_per_campaign.csv";

// Configuration
const MIN_AGENT_REQ =555; // Minimum agents required for a campaign to be eligible
const MAX_DIALS_PER_AGENT =170; // Maximum dials per agent per hour
const TAALK_API_CONFIG = {
    base_url: "https://lets.taalk.ai/api/campaign2s",
    api_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay43NWVlNDkzMy0yZGVkLTRkOGUtYWE4ZC1iNThkMDAxNDNhMmEiLCJleHAiOjIwMjE3NzcyMTd9.hFSckjPzzfWm1PKnheHHwfUQwi-L9VEytvStRXgLvRk"
};

const staticCampaignData = {
    campaignId: "CAMP123",
    hourlyRate: 50,
    maxDials: 100
};

function getHourDialRate() {
    // Return static campaign data instead of calculating
    return staticCampaignData;
}

// Function to load CSV data
function loadCSV(filePath) {
    try {
        console.log(`Loading data from ${filePath}...`);
        const fileContent = readFileSync(filePath, "utf8");
        const records = parse(fileContent, { columns: true });
        console.log(`Loaded ${records.length} records from ${filePath}.`);
        return records;
    } catch (error) {
        console.error(`Failed to load ${filePath}:`, error.message);
        throw error;
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
            throw new Error(`Failed to update campaign ${campaignId}`);
        }
    } catch (error) {
        console.error(`Error: Campaign ${campaignId} - ${error.message}`);
    }
}

// Function to merge Market-State Totals with CampaignList
function mergeMarketStateWithCampaigns(marketStateTotals, campaignList) {
    return marketStateTotals.flatMap(row => {
        const { State, ...markets } = row;

        return Object.entries(markets).map(([market, count]) => {
            const campaignRecord = campaignList.find(
                record => record.State === State && record.Market === market
            );

            if (!campaignRecord) {
                console.warn(`No match found for State: ${State}, Market: ${market}`);
            }

            return {
                State,
                Market: market,
                TotalAgents: parseInt(count, 10) || 0,
                CampaignID: campaignRecord ? campaignRecord.Campaign : "N/A",
            };
        });
    });
}

// Function to calculate HourDial for campaigns
function calculateHourDial(campaignData, uniqueAgentCount) {
    console.log(`Calculating hour dial with ${uniqueAgentCount} agents`);
    
    if (!uniqueAgentCount || isNaN(uniqueAgentCount)) {
        throw new Error("Invalid uniqueAgentCount provided");
    }

    const maxAgentDial = uniqueAgentCount * MAX_DIALS_PER_AGENT; // Total possible dials
    const totals = [];

    // Filter campaigns based on MinAgentReq
    const eligibleCampaigns = campaignData.filter(
        campaign => campaign.TotalAgents >= MIN_AGENT_REQ && campaign.CampaignID !== "N/A"
    );

    const ineligibleCampaigns = campaignData.filter(
        campaign => campaign.TotalAgents < MIN_AGENT_REQ || campaign.CampaignID === "N/A"
    );

    // Assign HourDial = 1 for all ineligible campaigns
    ineligibleCampaigns.forEach(campaign => {
        campaign.HourDial = 1;
        totals.push(campaign);
    });

    console.log(`Total eligible campaigns: ${eligibleCampaigns.length}`);
    console.log(`MaxAgentDial: ${maxAgentDial}`);

    if (eligibleCampaigns.length === 0) {
        console.warn("No eligible campaigns found. All campaigns will have HourDial = 1.");
        return totals;
    }

    // Calculate remaining dials
    const baseDials = ineligibleCampaigns.length; // Each ineligible campaign gets 1 dial
    const remainingDials = maxAgentDial - baseDials;

    console.log(`Base Dials: ${baseDials}, Remaining Dials: ${remainingDials}`);

    // Calculate total agents in eligible campaigns
    const totalEligibleAgents = eligibleCampaigns.reduce((sum, campaign) => sum + campaign.TotalAgents, 0);

    // Assign HourDial proportionally to eligible campaigns
    eligibleCampaigns.forEach(campaign => {
        const weight = campaign.TotalAgents / totalEligibleAgents;
        campaign.Weight = weight;
        campaign.HourDial = Math.max(1, Math.round(weight * remainingDials));
        totals.push(campaign);

        console.log(
            `Campaign: ${campaign.CampaignID}, TotalAgents: ${campaign.TotalAgents}, Weight: ${weight.toFixed(4)}, HourDial: ${campaign.HourDial}`
        );
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
            writeFileSync(filename, output);
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

// Add the processHourDial function BEFORE exporting it
async function processHourDial() {
    try {
        console.log('Starting campaign updates...');
        
        const agentCount = getAvailableAgentCount();
        const marketStateTotals = loadCSV(MARKET_STATE_TOTALS_FILE);
        const campaignList = loadCSV(CAMPAIGN_LIST_FILE);
        const mergedData = mergeMarketStateWithCampaigns(marketStateTotals, campaignList);
        const results = calculateHourDial(mergedData, agentCount);
        
        console.log('\nUpdating campaigns:');
        for (const campaign of results) {
            if (campaign.CampaignID !== "N/A") {
                await sendCampaignUpdate(campaign.CampaignID, campaign.HourDial);
                console.log(`✓ ${campaign.State}: ${campaign.HourDial} dials/hour`);
            }
        }
        
        console.log('\nAll campaigns updated successfully');
        
    } catch (error) {
        console.error('Failed:', error);
        throw error;
    }
}

// Then export it
module.exports = {
    processHourDial
};

// Run if this is the main module
if (require.main === module) {
    processHourDial()
        .then(() => console.log('Done'))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}
