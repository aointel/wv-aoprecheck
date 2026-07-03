#!/usr/bin/env node

/**
 * Automated Twilio Number Purchase Script
 * 
 * This script will purchase 1000 phone numbers based on your lead distribution
 * 
 * Usage: node purchase-twilio-numbers.js [--dry-run] [--batch-size=50]
 */

const https = require('https');

const BASE_URL = 'https://aoirail-production.up.railway.app';
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50');

// Purchase plan based on REAL lead analysis (29,135 leads)
const PURCHASE_PLAN = [
  // Tier 1: Highest Priority (300+ leads)
  { areaCode: '757', count: 30, state: 'VA', priority: 1 },
  { areaCode: '423', count: 30, state: 'TN', priority: 1 },
  { areaCode: '717', count: 25, state: 'PA', priority: 1 },
  { areaCode: '540', count: 25, state: 'VA', priority: 1 },
  { areaCode: '804', count: 25, state: 'VA', priority: 1 },
  
  // Tier 2: High Priority (200-299 leads)
  { areaCode: '865', count: 20, state: 'TN', priority: 2 },
  { areaCode: '304', count: 20, state: 'WV', priority: 2 },
  { areaCode: '215', count: 20, state: 'PA', priority: 2 },
  { areaCode: '267', count: 20, state: 'PA', priority: 2 },
  { areaCode: '610', count: 20, state: 'PA', priority: 2 },
  { areaCode: '434', count: 20, state: 'VA', priority: 2 },
  { areaCode: '703', count: 20, state: 'VA', priority: 2 },
  { areaCode: '571', count: 20, state: 'VA', priority: 2 },
  
  // Tier 3: Medium-High Priority (100-199 leads)
  { areaCode: '615', count: 15, state: 'TN', priority: 3 },
  { areaCode: '931', count: 15, state: 'TN', priority: 3 },
  { areaCode: '731', count: 15, state: 'TN', priority: 3 },
  { areaCode: '901', count: 15, state: 'TN', priority: 3 },
  { areaCode: '423', count: 15, state: 'TN', priority: 3 },
  { areaCode: '609', count: 15, state: 'NJ', priority: 3 },
  { areaCode: '856', count: 15, state: 'NJ', priority: 3 },
  { areaCode: '201', count: 15, state: 'NJ', priority: 3 },
  { areaCode: '302', count: 15, state: 'DE', priority: 3 },
  { areaCode: '843', count: 15, state: 'SC', priority: 3 },
  { areaCode: '803', count: 15, state: 'SC', priority: 3 },
  { areaCode: '410', count: 15, state: 'MD', priority: 3 },
  { areaCode: '443', count: 15, state: 'MD', priority: 3 },
  { areaCode: '202', count: 15, state: 'DC', priority: 3 },
  { areaCode: '301', count: 15, state: 'MD', priority: 3 },
  
  // Tier 4: Medium Priority (50-99 leads) - 1 number each
  { areaCode: '704', count: 10, state: 'NC', priority: 4 },
  { areaCode: '910', count: 10, state: 'NC', priority: 4 },
  { areaCode: '336', count: 10, state: 'NC', priority: 4 },
  { areaCode: '252', count: 10, state: 'NC', priority: 4 },
  { areaCode: '828', count: 10, state: 'NC', priority: 4 },
  { areaCode: '980', count: 10, state: 'NC', priority: 4 },
  { areaCode: '502', count: 10, state: 'KY', priority: 4 },
  { areaCode: '859', count: 10, state: 'KY', priority: 4 },
  { areaCode: '270', count: 10, state: 'KY', priority: 4 },
  { areaCode: '606', count: 10, state: 'KY', priority: 4 },
  { areaCode: '317', count: 10, state: 'IN', priority: 4 },
  { areaCode: '765', count: 10, state: 'IN', priority: 4 },
  { areaCode: '574', count: 10, state: 'IN', priority: 4 },
  { areaCode: '812', count: 10, state: 'IN', priority: 4 },
  { areaCode: '219', count: 10, state: 'IN', priority: 4 },
  { areaCode: '260', count: 10, state: 'IN', priority: 4 },
  { areaCode: '937', count: 10, state: 'OH', priority: 4 },
  { areaCode: '513', count: 10, state: 'OH', priority: 4 },
  { areaCode: '614', count: 10, state: 'OH', priority: 4 },
  { areaCode: '330', count: 10, state: 'OH', priority: 4 },
  { areaCode: '440', count: 10, state: 'OH', priority: 4 },
  { areaCode: '419', count: 10, state: 'OH', priority: 4 },
  { areaCode: '740', count: 10, state: 'OH', priority: 4 },
  { areaCode: '216', count: 10, state: 'OH', priority: 4 },
  { areaCode: '234', count: 10, state: 'OH', priority: 4 },
  { areaCode: '567', count: 10, state: 'OH', priority: 4 },
  
  // Tier 5: Coverage Priority (25-49 leads) - 1 number each
  { areaCode: '304', count: 5, state: 'WV', priority: 5 },
  { areaCode: '681', count: 5, state: 'WV', priority: 5 },
  { areaCode: '603', count: 5, state: 'NH', priority: 5 },
  { areaCode: '802', count: 5, state: 'VT', priority: 5 },
  { areaCode: '207', count: 5, state: 'ME', priority: 5 },
  { areaCode: '401', count: 5, state: 'RI', priority: 5 },
  { areaCode: '508', count: 5, state: 'MA', priority: 5 },
  { areaCode: '617', count: 5, state: 'MA', priority: 5 },
  { areaCode: '781', count: 5, state: 'MA', priority: 5 },
  { areaCode: '857', count: 5, state: 'MA', priority: 5 },
  { areaCode: '978', count: 5, state: 'MA', priority: 5 },
  { areaCode: '413', count: 5, state: 'MA', priority: 5 },
  { areaCode: '774', count: 5, state: 'MA', priority: 5 },
  { areaCode: '339', count: 5, state: 'MA', priority: 5 },
  { areaCode: '351', count: 5, state: 'MA', priority: 5 },
  { areaCode: '413', count: 5, state: 'MA', priority: 5 },
  { areaCode: '860', count: 5, state: 'CT', priority: 5 },
  { areaCode: '203', count: 5, state: 'CT', priority: 5 },
  { areaCode: '959', count: 5, state: 'CT', priority: 5 },
  { areaCode: '475', count: 5, state: 'CT', priority: 5 },
  
  // Add more area codes to reach 1000 total
  // This covers the top 100+ area codes with proportional distribution
];

// Add more area codes to reach 1000 total
// (You can expand this list based on the full analysis)

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'aoirail-production.up.railway.app',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function searchNumber(areaCode) {
  console.log(`🔍 Searching for available numbers in area code ${areaCode}...`);
  const result = await makeRequest('GET', `/api/twilio/search-numbers?areaCode=${areaCode}`);
  return result;
}

async function purchaseNumber(phoneNumber, friendlyName) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would purchase: ${phoneNumber} (${friendlyName})`);
    return { success: true, dryRun: true };
  }
  
  console.log(`💰 Purchasing: ${phoneNumber} (${friendlyName})`);
  const result = await makeRequest('POST', '/api/twilio/purchase-number', {
    phoneNumber,
    friendlyName
  });
  
  // Log the FULL error response
  if (!result.success) {
    console.log(`❌ FULL ERROR RESPONSE:`, JSON.stringify(result, null, 2));
  }
  
  return result;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Twilio Number Purchase Script');
  console.log('=================================\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no actual purchases)' : 'LIVE PURCHASE'}`);
  console.log(`Batch Size: ${BATCH_SIZE} numbers per area code\n`);
  
  const stats = {
    totalPlanned: 0,
    totalSearched: 0,
    totalPurchased: 0,
    totalFailed: 0,
    byAreaCode: {}
  };
  
  // Calculate total planned
  PURCHASE_PLAN.forEach(plan => {
    stats.totalPlanned += plan.count;
    stats.byAreaCode[plan.areaCode] = { planned: plan.count, purchased: 0, failed: 0 };
  });
  
  console.log(`📊 Total numbers to purchase: ${stats.totalPlanned}\n`);
  
  if (!DRY_RUN) {
    console.log('⚠️  WARNING: This will make REAL purchases!');
    console.log('Press Ctrl+C in the next 5 seconds to cancel...\n');
    await sleep(5000);
  }
  
  // Process each area code
  for (const plan of PURCHASE_PLAN) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing Area Code ${plan.areaCode} (${plan.state})`);
    console.log(`Target: ${plan.count} numbers | Priority: ${plan.priority}`);
    console.log('='.repeat(60));
    
    let purchasedCount = 0;
    let failedCount = 0;
    
    while (purchasedCount < plan.count) {
      try {
        // Search for available numbers
        const searchResult = await searchNumber(plan.areaCode);
        stats.totalSearched++;
        
        if (!searchResult.success || !searchResult.numbers || searchResult.numbers.length === 0) {
          console.log(`❌ No available numbers found for area code ${plan.areaCode}`);
          failedCount++;
          break;
        }
        
        // Purchase numbers in batches
        const batch = searchResult.numbers.slice(0, Math.min(BATCH_SIZE, plan.count - purchasedCount));
        
        for (const number of batch) {
          if (purchasedCount >= plan.count) break;
          
          try {
            const friendlyName = `State ${plan.state}-local ${number.locality || plan.areaCode}`;
            const result = await purchaseNumber(number.phoneNumber, friendlyName);
            
            if (result.success) {
              purchasedCount++;
              stats.totalPurchased++;
              stats.byAreaCode[plan.areaCode].purchased++;
              console.log(`✅ [${purchasedCount}/${plan.count}] ${number.phoneNumber}`);
            } else {
              failedCount++;
              stats.totalFailed++;
              stats.byAreaCode[plan.areaCode].failed++;
              console.log(`❌ Failed to purchase ${number.phoneNumber}: ${result.error}`);
            }
            
            // Rate limiting - wait 500ms between purchases
            await sleep(500);
            
          } catch (error) {
            failedCount++;
            stats.totalFailed++;
            console.log(`❌ Error purchasing number: ${error.message}`);
          }
        }
        
        // If we couldn't get enough numbers in this batch, search again
        if (purchasedCount < plan.count && batch.length === BATCH_SIZE) {
          console.log(`🔄 Need more numbers, searching again...`);
          await sleep(1000);
        } else {
          break;
        }
        
      } catch (error) {
        console.log(`❌ Error processing area code ${plan.areaCode}: ${error.message}`);
        failedCount++;
        break;
      }
    }
    
    console.log(`\n📊 Area Code ${plan.areaCode} Summary:`);
    console.log(`   Target: ${plan.count} | Purchased: ${purchasedCount} | Failed: ${failedCount}`);
  }
  
  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Planned: ${stats.totalPlanned}`);
  console.log(`Total Purchased: ${stats.totalPurchased}`);
  console.log(`Total Failed: ${stats.totalFailed}`);
  console.log(`Success Rate: ${((stats.totalPurchased / stats.totalPlanned) * 100).toFixed(2)}%`);
  
  if (DRY_RUN) {
    console.log(`\n✅ DRY RUN COMPLETE - No actual purchases were made`);
    console.log(`Run without --dry-run to make real purchases`);
  } else {
    console.log(`\n✅ PURCHASE COMPLETE!`);
    console.log(`\nEstimated Monthly Cost: $${stats.totalPurchased.toFixed(2)}`);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

