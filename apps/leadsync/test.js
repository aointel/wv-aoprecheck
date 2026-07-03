console.log("=== TEST START ===");

import fs from 'fs';

// 1. Check if files exist
const files = [
    "market_state_totals.csv",
    "CampaignList.csv", 
    "available_agents_full_data.csv"
];

console.log("\nChecking files:");
files.forEach(file => {
    try {
        const exists = fs.existsSync(file);
        console.log(`${file}: ${exists ? 'EXISTS' : 'MISSING'}`);
        if (exists) {
            const content = fs.readFileSync(file, 'utf8');
            console.log("Content:", content.substring(0, 100));
        }
    } catch (error) {
        console.error(`Error with ${file}:`, error);
    }
});

console.log("=== TEST END ==="); 