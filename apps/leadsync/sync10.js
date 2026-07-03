const DriveSync = require('./DriveSync.js');
const { processDispositions } = require('./processDispositions.js');
const { sendLeadsToZohoCRM, sendLeadsToTaalk } = require('./sendToZohoFirst.js');
const fs = require('fs');
const path = require('path');

const SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds

async function runSync() {
    try {
        console.log('\n=== Starting 10-minute sync ===');
        
        // Check exports directory
        const exportFiles = fs.readdirSync('./exports');
        console.log("\nChecking exports directory:");
        console.log(`Found ${exportFiles.length} files:`, exportFiles);

        // Run the sync
        await sendLeadsToZohoCRM();
        await sendLeadsToTaalk();

        console.log('=== Sync complete ===\n');
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// Run immediately first
console.log("Starting 10-minute sync service...");
runSync().then(() => {
    // Then set up interval
    console.log("\nSetting up 10 minute interval...");
    setInterval(runSync, SYNC_INTERVAL);
}); 