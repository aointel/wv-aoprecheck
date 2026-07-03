#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Configuration
const WEBHOOK_URL = 'https://7bca9330-8d56-4d64-a5d4-a459b57b16a3-00-2imcowqw6vcjz.picard.replit.dev/api/webhook/credit-adjustment';
const CREDITS_TO_DEDUCT = -8; // Negative number means deduct credits
const CSV_FILE = 'attached_assets/vdp_calls_rows (3)_1757875686295.csv';
const LINES_TO_PROCESS = null; // Process ALL lines for full catch-up

// Function to make webhook call
async function adjustCredits(associateId, creditsAmount) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        associate_id: associateId,
        credits_amount: creditsAmount
      })
    });

    const result = await response.json();
    console.log(`✅ Associate ${associateId}: ${result.message}`);
    return result;
  } catch (error) {
    console.error(`❌ Error adjusting credits for associate ${associateId}:`, error.message);
    return null;
  }
}

// Main function
async function processCSVCredits() {
  console.log('🚀 Starting credit adjustment script...');
  console.log(`📄 Reading CSV file: ${CSV_FILE}`);
  console.log(`💳 Credits to deduct per associate: ${Math.abs(CREDITS_TO_DEDUCT)}`);
  console.log(`📊 Processing ALL lines for full billing catch-up\n`);

  try {
    // Read CSV file
    const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
    const lines = csvContent.split('\n');
    
    // Skip header line and get ALL data lines
    const dataLines = lines.slice(1).filter(line => line.trim() !== '');
    
    console.log(`📋 Found ${dataLines.length} data lines to process`);
    console.log('📊 Sample data (first 5 lines):');
    dataLines.slice(0, 5).forEach((line, index) => {
      const columns = line.split(',');
      const agent = columns[4]; // agent column
      const firstName = columns[7]; // firstName column  
      const lastName = columns[8]; // lastName column
      const companyEmail = columns[21]; // company_email column
      console.log(`   ${index + 1}. Agent: ${agent}, Name: ${firstName} ${lastName}, Email: ${companyEmail}`);
    });
    console.log('');

    // Process each line
    const results = [];
    let processed = 0;
    let skipped = 0;
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const columns = line.split(',');
      const associateId = columns[4]; // agent column is associate_id
      
      // Progress logging every 100 items
      if ((i + 1) % 100 === 0) {
        console.log(`📊 Progress: ${i + 1}/${dataLines.length} lines processed (${Math.round(((i + 1) / dataLines.length) * 100)}%)`);
      }
      
      if (associateId && associateId !== '1' && associateId.trim() !== '') { // Skip invalid IDs
        console.log(`🔄 [${i + 1}/${dataLines.length}] Processing associate ${associateId}...`);
        const result = await adjustCredits(associateId, CREDITS_TO_DEDUCT);
        results.push({ associateId, result });
        processed++;
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 250));
      } else {
        console.log(`⚠️ [${i + 1}/${dataLines.length}] Skipping invalid associate ID: ${associateId}`);
        skipped++;
      }
    }

    // Summary
    console.log('\n🎉 BILLING CATCH-UP COMPLETE!');
    console.log('\n📊 FINAL SUMMARY:');
    console.log(`📋 Total lines in CSV: ${dataLines.length}`);
    console.log(`✅ Successfully billed: ${results.filter(r => r.result).length}`);
    console.log(`❌ Failed to bill: ${results.filter(r => !r.result).length}`);
    console.log(`⚠️ Skipped (invalid IDs): ${skipped}`);
    console.log(`💳 Total credits deducted: ${results.filter(r => r.result).length * Math.abs(CREDITS_TO_DEDUCT)}`);
    
    console.log('\n🔍 DETAILED RESULTS:');
    results.slice(0, 10).forEach(({ associateId, result }) => {
      if (result) {
        console.log(`   ✅ ${associateId}: ${result.message}`);
      } else {
        console.log(`   ❌ ${associateId}: Failed to process`);
      }
    });
    
    if (results.length > 10) {
      console.log(`   ... and ${results.length - 10} more entries`);
    }

  } catch (error) {
    console.error('❌ Error reading CSV file:', error.message);
    process.exit(1);
  }
}

// Run the script
processCSVCredits().then(() => {
  console.log('\n🎉 Credit adjustment script completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

export { processCSVCredits, adjustCredits };