const fs = require('fs');
const path = require('path');
const { sendLeadsToTaalk } = require('./sendToZohoFirst');

if (process.argv[2]) {
    // Local CSV file provided
    process.env.LEADS_FILE = process.argv[2];
}

async function runFullProcess() {
    try {
        console.log('\n=== Starting Lead Processing ===\n');

        // 1. Verify files exist
        const requiredFiles = [
            'CampaignList.csv',
            'C:/Users/mmand/Downloads/AO Intel Leads - 2.10.25 - Assigned and Available.csv'
        ];

        console.log('Checking required files:');
        for (const file of requiredFiles) {
            if (fs.existsSync(file)) {
                console.log(`✓ Found ${path.basename(file)}`);
            } else {
                throw new Error(`Missing required file: ${file}`);
            }
        }

        // 2. Send leads to Taalk
        console.log('\nSending leads to Taalk...');
        await sendLeadsToTaalk();

        console.log('\n=== Lead Processing Complete ===');

    } catch (error) {
        console.error('\nERROR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runFullProcess();
} 