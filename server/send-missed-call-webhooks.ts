#!/usr/bin/env tsx
/**
 * Script to send missed call billing webhooks one at a time from CSV data
 * Each transaction is billed $4.00
 */

import * as fs from 'fs';
import * as path from 'path';
import { PRODUCTION_URL } from './hardcoded-config';

interface MissedCallRecord {
  date: string;
  time: string;
  event: string;
  phone: string;
  agent: string; // This is the Blastered/agent ID
  params: string;
}

interface WebhookPayload {
  Event: string;
  Blastered: string;
  task: {
    'Task Phone': string;
    'Task Server Number': string | null;
    'Task Created At': string;
    'Task Waiting Duration': string | null;
  };
}

// Send to the missed call billing endpoint
const WEBHOOK_URL = PRODUCTION_URL;
const WEBHOOK_ENDPOINT = `${WEBHOOK_URL}/api/ccpro/missed-call-billing`;
const CSV_FILE_PATH = path.join(__dirname, '../dist/fxdghdfgh.csv');
const DELAY_BETWEEN_REQUESTS_MS = 500; // 500ms delay between webhook calls

function parseCSV(filePath: string): MissedCallRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const records: MissedCallRecord[] = [];
  
  for (const line of dataLines) {
    // CSV parsing - handle quoted fields
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim()); // Add last part
    
    if (parts.length >= 6) {
      const event = parts[2]?.trim().toUpperCase() || '';
      if (event === 'MISSED') {
        records.push({
          date: parts[0] || '',
          time: parts[1] || '',
          event: event,
          phone: parts[3] || '',
          agent: parts[4] || '', // This is the Blastered/agent ID
          params: parts.slice(5).join(',').trim() // Join remaining parts as params
        });
      }
    }
  }
  
  return records;
}

function parseDateTime(dateStr: string, timeStr: string): string {
  // Format: "12/18/2025" and "12:09:37 AM"
  try {
    const [month, day, year] = dateStr.split('/');
    const [time, period] = timeStr.split(' ');
    const [hours, minutes, seconds] = time.split(':');
    
    let hour24 = parseInt(hours);
    if (period?.toUpperCase() === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period?.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${minutes}:${seconds}.000Z`;
    return new Date(isoString).toISOString();
  } catch (error) {
    console.warn(`⚠️ Failed to parse date/time: ${dateStr} ${timeStr}, using current time`);
    return new Date().toISOString();
  }
}

function extractServerNumber(params: string): string | null {
  // Try to extract server number from params if available
  // This is a best-effort extraction from the complex params string
  const serverNumberMatch = params.match(/Server Number[":\s]+([+\d]+)/i);
  if (serverNumberMatch) {
    return serverNumberMatch[1].trim();
  }
  return null;
}

function extractWaitingDuration(params: string): string | null {
  // Try to extract waiting duration from params if available
  const waitingMatch = params.match(/Waiting Duration[":\s]+(\d+)/i);
  if (waitingMatch) {
    return waitingMatch[1].trim();
  }
  return null;
}

async function sendWebhook(payload: WebhookPayload, index: number, total: number): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`\n[${index + 1}/${total}] Sending webhook for agent ${payload.Blastered}, phone ${payload.task['Task Phone']}...`);
    
    const response = await fetch(WEBHOOK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (response.ok) {
      const responseText = await response.text();
      console.log(`✅ Success: ${response.status} ${response.statusText}`);
      if (responseText) {
        try {
          const responseJson = JSON.parse(responseText);
          console.log(`   Response:`, JSON.stringify(responseJson, null, 2));
        } catch {
          console.log(`   Response: ${responseText.substring(0, 200)}`);
        }
      }
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error(`❌ Failed: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting missed call webhook sender...\n');
  console.log(`📁 Reading CSV from: ${CSV_FILE_PATH}`);
  
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
    process.exit(1);
  }
  
  // Parse CSV
  const allRecords = parseCSV(CSV_FILE_PATH);
  console.log(`📊 Found ${allRecords.length} MISSED call records in CSV\n`);
  
  if (allRecords.length === 0) {
    console.log('⚠️ No MISSED call records found. Exiting.');
    process.exit(0);
  }
  
  // Process each record
  const results = {
    total: allRecords.length,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ index: number; agent: string; phone: string; error: string }>
  };
  
  for (let i = 0; i < allRecords.length; i++) {
    const record = allRecords[i];
    
    // Build webhook payload
    const taskCreatedAt = parseDateTime(record.date, record.time);
    const serverNumber = extractServerNumber(record.params) || null;
    const waitingDuration = extractWaitingDuration(record.params) || null;
    
    const payload: WebhookPayload = {
      Event: 'MISSED',
      Blastered: record.agent, // Agent ID from CSV
      task: {
        'Task Phone': record.phone,
        'Task Server Number': serverNumber,
        'Task Created At': taskCreatedAt,
        'Task Waiting Duration': waitingDuration
      }
    };
    
    // Send webhook
    const result = await sendWebhook(payload, i, allRecords.length);
    
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        index: i + 1,
        agent: record.agent,
        phone: record.phone,
        error: result.error || 'Unknown error'
      });
    }
    
    // Delay between requests (except for the last one)
    if (i < allRecords.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total transactions: ${results.total}`);
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`💰 Total billed: $${(results.successful * 4.00).toFixed(2)}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Failed transactions:');
    results.errors.forEach(err => {
      console.log(`   [${err.index}] Agent ${err.agent}, Phone ${err.phone}: ${err.error}`);
    });
  }
  
  console.log('\n✅ Processing complete!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
