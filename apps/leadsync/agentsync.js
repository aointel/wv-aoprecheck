const { getAllAgents } = require('./app.js');
const { processMarketStateTotals } = require('./market_state_totals.js');
const { processHourDial } = require('./hour_dial_per_campaign.js');
const fs = require('fs');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncAgents() {
    try {
        console.log("\n=== Starting Agent Sync ===");
        
        // 1. Get all agents from Zoho
        console.log("\nStep 1: Getting agents from Zoho...");
        await getAllAgents();
        console.log("Agents fetched. Waiting 10 seconds before next step...");
        await sleep(10 * 1000);
        
        // 2. Calculate market state totals
        console.log("\nStep 2: Calculating market state totals...");
        await processMarketStateTotals();
        console.log("Totals calculated. Waiting 10 seconds before next step...");
        await sleep(10 * 1000);
        
        // 3. Update campaign hour dials
        console.log("\nStep 3: Updating campaign hour dials...");
        await processHourDial();
        console.log("Hour dials updated - waiting final 15 minutes...");
        await sleep(15 * 60 * 1000);
        syncAgents(); // Re-run the entire sequence

    } catch (error) {
        console.error("Sync Error:", error);
        // If error, wait 15 minutes, then try again
        await sleep(15 * 60 * 1000);
        syncAgents();
    }
}

// Start immediately
syncAgents(); 