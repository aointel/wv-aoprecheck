#!/usr/bin/env tsx
/**
 * Test script to show what webhook payload would be sent for the first CSV line
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.join(__dirname, '../dist/fxdghdfgh.csv');

function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const dataLines = lines.slice(1);
  
  const records: any[] = [];
  
  for (const line of dataLines) {
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
    parts.push(current.trim());
    
    if (parts.length >= 6) {
      const event = parts[2]?.trim().toUpperCase() || '';
      if (event === 'MISSED') {
        records.push({
          date: parts[0] || '',
          time: parts[1] || '',
          event: event,
          phone: parts[3] || '',
          agent: parts[4] || '',
          params: parts.slice(5).join(',').trim()
        });
      }
    }
  }
  
  return records;
}

function parseDateTime(dateStr: string, timeStr: string): string {
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
    return new Date().toISOString();
  }
}

function extractServerNumber(params: string): string | null {
  const serverNumberMatch = params.match(/Server Number[":\s]+([+\d]+)/i);
  if (serverNumberMatch) {
    return serverNumberMatch[1].trim();
  }
  return null;
}

function extractWaitingDuration(params: string): string | null {
  const waitingMatch = params.match(/Waiting Duration[":\s]+(\d+)/i);
  if (waitingMatch) {
    return waitingMatch[1].trim();
  }
  return null;
}

async function main() {
  const records = parseCSV(CSV_FILE_PATH);
  
  if (records.length === 0) {
    console.log('No MISSED records found');
    return;
  }
  
  const firstRecord = records[0];
  console.log('\n📋 First CSV Record:');
  console.log('='.repeat(60));
  console.log(`Date: ${firstRecord.date}`);
  console.log(`Time: ${firstRecord.time}`);
  console.log(`Event: ${firstRecord.event}`);
  console.log(`Phone: ${firstRecord.phone}`);
  console.log(`Agent (Blastered): ${firstRecord.agent}`);
  console.log(`Params (first 200 chars): ${firstRecord.params.substring(0, 200)}...`);
  
  const taskCreatedAt = parseDateTime(firstRecord.date, firstRecord.time);
  const serverNumber = extractServerNumber(firstRecord.params) || null;
  const waitingDuration = extractWaitingDuration(firstRecord.params) || null;
  
  const payload = {
    Event: 'MISSED',
    Blastered: firstRecord.agent,
    task: {
      'Task Phone': firstRecord.phone,
      'Task Server Number': serverNumber,
      'Task Created At': taskCreatedAt,
      'Task Waiting Duration': waitingDuration
    }
  };
  
  console.log('\n📤 Webhook Payload That Would Be Sent:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(payload, null, 2));
  const webhookUrl = 'https://aoirail-production.up.railway.app';
  const webhookEndpoint = `${webhookUrl}/api/ccpro/missed-call-billing`;
  
  console.log('\n');
  console.log(`🌐 Webhook URL: ${webhookEndpoint}`);
  console.log('💰 Billing Amount: $4.00 per transaction');
}

main().catch(console.error);
