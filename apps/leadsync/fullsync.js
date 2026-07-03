const DriveSync = require('./DriveSync.js');
const { processDispositions } = require('./processDispositions.js');
const { sendLeadsToZohoCRM, sendLeadsToTaalk } = require('./sendToZohoFirst.js');
const { sendToTaalk } = require('./sendToTaalkOnly.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Add directory constants
const UPLOADS_DIR = './uploads';
const PROCESSED_DIR = './processed';
const ARCHIVED_DIR = './archived';
const EXPORTS_DIR = './exports';

// Create directories if they don't exist
[UPLOADS_DIR, PROCESSED_DIR, ARCHIVED_DIR, EXPORTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds

// Check if --continuous flag is passed
const continuousMode = process.argv.includes('--continuous');

// Add Zapier webhook URL
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/2fxhzfp/';

const FILE_PATTERNS = {
  leads: /Mandella 1 Hour Report/i,
  dispositions: /Mandella 1 Hour Report Dispositions \(\d+\)\.csv$/i
};

async function runFullSync() {
    try {
        console.log("\n=== Starting Full Sync ===");
        
        console.log('\n1. Syncing from Google Drive...');
        // Store the return value from processAllFiles()
        const { dispositions, leads } = await DriveSync.processAllFiles();

        const totalProcessed = (dispositions.length + leads.length);
        console.log(`Drive sync complete - processed ${totalProcessed} file(s)`);
        
        // 2. Process dispositions
        console.log('\n2. Processing dispositions...');
        await processDispositions();
        
        // 3. Send to Zoho CRM first
        console.log('\n3. Sending to Zoho CRM...');
        await sendLeadsToZohoCRM();

        // 4. Send to Zapier webhook
        console.log('\n4. Sending to Zapier webhook...');
        const latestExport = fs.readdirSync(EXPORTS_DIR)
            .filter(f => f.startsWith('airtable_export_'))
            .sort()
            .pop();
            
        if (latestExport) {
            const exportPath = path.join(EXPORTS_DIR, latestExport);
            console.log(`Using latest export: ${latestExport}`);

            // Send to Zapier
            const fileContent = fs.readFileSync(exportPath, 'utf8');
            const response = await fetch(ZAPIER_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: fileContent // Send raw CSV content
            });

            if (!response.ok) {
                throw new Error(`Zapier webhook failed: ${response.status} ${response.statusText}`);
            }

            // 5. Then send to Taalk
            console.log('\n5. Sending to Taalk...');
            await sendToTaalk();
        } else {
            console.log('No export file found to send');
        }
        
        console.log(`\n=== Full Sync Complete at ${new Date().toISOString()} ===\n`);
    } catch (error) {
        console.error('Error in full sync:', error);
        throw error;
    }

    // Now that the sync is done, wait 15 minutes and run again
    console.log("Waiting 15 minutes before next run...");
    setTimeout(runFullSync, FIFTEEN_MINUTES);
}

// Instead, start immediately
runFullSync();

console.log("Starting indefinite 15-minute sync loop...");
setInterval(() => {
    runFullSync().catch(error => {
        console.error("Error during scheduled run:", error);
    });
}, FIFTEEN_MINUTES);

module.exports = { runFullSync }; 