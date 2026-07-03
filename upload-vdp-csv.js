import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

// Configuration
const WEBHOOK_URL = 'https://7bca9330-8d56-4d64-a5d4-a459b57b16a3-00-2imcowqw6vcjz.picard.replit.dev/api/webhook/vdp-events';
const CSV_FILE = 'attached_assets/d0d9d3a8-6890-4796-9ca2-86d03d41108b_1757128871040.csv';
const BATCH_SIZE = 50; // Process in larger batches for speed
const DELAY_MS = 50; // Reduced delay between requests

let processedCount = 0;
let errorCount = 0;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWebhook(row) {
  try {
    // Parse the Params JSON string to extract Leadid
    let params = {};
    let leadid = null;
    
    try {
      params = JSON.parse(row.Params);
      leadid = params.Leadid;
    } catch (e) {
      console.log('Warning: Could not parse params for row:', row.Phone);
    }

    // Create webhook payload in the format our endpoint expects
    const payload = {
      Date: row.Date,
      Time: row.Time,
      Event: row.Event,
      Phone: row.Phone,
      Agent: row.Agent,
      Params: row.Params,
      // Include parsed leadid for easier extraction
      leadid: leadid
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      processedCount++;
      if (processedCount % 100 === 0) {
        console.log(`✅ Processed ${processedCount} records...`);
      }
      return true;
    } else {
      console.error(`❌ Failed to upload row ${processedCount + errorCount + 1}: ${response.status} ${response.statusText}`);
      errorCount++;
      return false;
    }
  } catch (error) {
    console.error(`❌ Error uploading row ${processedCount + errorCount + 1}:`, error.message);
    errorCount++;
    return false;
  }
}

async function uploadCSV() {
  console.log(`🚀 Starting CSV upload from: ${CSV_FILE}`);
  console.log(`🎯 Target webhook: ${WEBHOOK_URL}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms\n`);

  const rows = [];

  // First, read all rows into memory
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        console.log(`📊 Loaded ${rows.length} records from CSV`);
        resolve();
      })
      .on('error', reject);
  });

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(row => sendWebhook(row));
    
    await Promise.all(batchPromises);
    
    // Small delay between batches
    if (i + BATCH_SIZE < rows.length) {
      await delay(DELAY_MS);
    }
  }

  console.log(`\n✅ Upload complete!`);
  console.log(`📊 Processed: ${processedCount} records`);
  console.log(`❌ Errors: ${errorCount} records`);
  console.log(`📈 Success rate: ${((processedCount / (processedCount + errorCount)) * 100).toFixed(1)}%`);
}

// Run the upload
uploadCSV().catch(console.error);