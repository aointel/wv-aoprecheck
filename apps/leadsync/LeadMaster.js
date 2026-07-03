const DriveSync = require('./DriveSync');
const { exportLeads } = require('./LeadDBmgmt');
const { processLeads } = require('./sendLeads');

async function runWorkflow() {
    try {
        console.log('=== Starting Lead Processing Workflow ===\n');

        // Step 1: Run DriveSync to get files from Google Drive
        console.log('Step 1: Running DriveSync...');
        await DriveSync.processLatestFile();
        console.log('DriveSync complete\n');

        // Step 2: Process leads with LeadDBmgmt
        console.log('Step 2: Processing leads with LeadDBmgmt...');
        await exportLeads();
        console.log('LeadDBmgmt complete\n');

        // Step 3: Send leads to Taalk and Zapier
        console.log('Step 3: Sending leads...');
        await processLeads();
        console.log('Lead sending complete\n');

        console.log('=== Lead Processing Complete ===');

    } catch (error) {
        console.error('Workflow error:', error);
        process.exit(1);
    }
}

// Run the workflow
runWorkflow();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
}); 