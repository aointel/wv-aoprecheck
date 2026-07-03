import { exec } from 'child_process';
import { promisify } from 'util';
import { sendLeadsToTaalk } from './sendToZohoFirst.js';

const execAsync = promisify(exec);
const TEN_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds

// Use availableagents.js instead of app.js to avoid Zoho rate limit
const scripts = [
    "node --experimental-json-modules app.js",
    "node market_state_totals.js",
    "node hour_dial_per_campaign.js",
];

async function runScript(script) {
    console.log(`[DEBUG] Running ${script}...`);
    try {
        const { stdout, stderr } = await execAsync(script);
        console.log(`[DEBUG] Output from ${script}:`, stdout);
        if (stderr) console.error(`[DEBUG] Errors from ${script}:`, stderr);
    } catch (error) {
        console.error(`Error running ${script}:`, error);
        throw error;
    }
}

async function runScripts() {
    while (true) {
        try {
            console.log("\n=== Starting sync at", new Date().toLocaleString(), "===");
            
            for (const script of scripts) {
                await runScript(script);
            }
            
            console.log("=== Sync completed, waiting 10 minutes... ===");
            await new Promise(resolve => setTimeout(resolve, TEN_MINUTES));
            
        } catch (error) {
            console.error("Error in sync:", error);
            console.log("Retrying in 10 minutes...");
            await new Promise(resolve => setTimeout(resolve, TEN_MINUTES));
        }
    }
}

async function runSync() {
    console.log('\n=== Starting Full Sync ===');
    
    // ONLY send to Taalk
    console.log('Sending leads to Taalk...');
    await sendLeadsToTaalk();
}

runSync();
