/**
 * Analyze Taalk transfers directly from CSV sessionIDs
 * Bypasses vdp_calls lookup - just uses sessionID directly
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';
import * as fs from 'fs';
import * as path from 'path';

interface CSVRow {
  Date: string;
  Time: string;
  Phone: string;
  Name: string;
  Recording: string;
  [key: string]: string | undefined;
}

function extractSessionID(recordingUrl: string): string | null {
  const match = recordingUrl.match(/\/calls\/([a-f0-9]{24})\//);
  return match ? match[1] : null;
}

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: CSVRow = {} as CSVRow;
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    
    if (row.Recording) {
      rows.push(row);
    }
  }
  
  return rows;
}

async function analyzeDirectly() {
  console.log('🚀 Analyzing Taalk Transfers Directly from CSVs...\n');
  
  const csvFiles = [
    '8c1000c3-93ef-4e96-a701-4ec2a6189cb7.csv',
    '8e01ed9b-54a8-4524-8dd5-bf90673c1bd7.csv',
    '643ba479-0181-4d19-9034-91ef6ecbb589.csv',
    '6660fef8-d882-4fe9-af55-242265fed36b.csv'
  ];
  
  const allTransfers: Array<{ sessionID: string; phone: string; name: string; date: string; time: string }> = [];
  
  // Parse all CSV files
  for (const csvFile of csvFiles) {
    const filePath = path.join(process.cwd(), csvFile);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${csvFile}`);
      continue;
    }
    
    console.log(`📄 Processing ${csvFile}...`);
    const rows = parseCSV(filePath);
    
    for (const row of rows) {
      if (!row.Recording) continue;
      
      const sessionID = extractSessionID(row.Recording);
      if (!sessionID) continue;
      
      allTransfers.push({
        sessionID,
        phone: row.Phone || '',
        name: row.Name || '',
        date: row.Date || '',
        time: row.Time || ''
      });
    }
    
    console.log(`   ✅ Found ${rows.length} transfers`);
  }
  
  console.log(`\n📊 Total transfers: ${allTransfers.length}\n`);
  
  // Check which are already analyzed
  const sessionIDs = allTransfers.map(t => t.sessionID);
  const { data: existing } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('taalk_call_id, analysis_status')
    .in('taalk_call_id', sessionIDs);
  
  const analyzed = new Set(
    (existing || [])
      .filter(a => a.analysis_status === 'completed')
      .map(a => a.taalk_call_id)
  );
  
  const unanalyzed = allTransfers.filter(t => !analyzed.has(t.sessionID));
  
  console.log(`📊 Already analyzed: ${analyzed.size}`);
  console.log(`📊 Need analysis: ${unanalyzed.length}\n`);
  
  // Analyze directly using sessionID (bypass vdp_calls)
  const scheduler = callAnalyticsScheduler as any;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  
  // Process in batches of 10
  for (let i = 0; i < unanalyzed.length; i += 10) {
    const batch = unanalyzed.slice(i, i + 10);
    
    console.log(`\n📦 Processing batch ${Math.floor(i/10) + 1} (${batch.length} calls)...`);
    
    for (const transfer of batch) {
      try {
        console.log(`🔍 ${transfer.name} (${transfer.phone}) - ${transfer.sessionID}`);
        
        // Create transaction with sessionID in metadata - this will be used directly
        const transaction = {
          transaction_id: `csv-${transfer.sessionID}`,
          agent_email: 'unknown@aoglobelife.com',
          agent_name: null,
          transaction_date: new Date().toISOString(),
          source_id: null, // No vdp_call needed
          source_table: 'vdp_calls',
          metadata: {
            sessionID: transfer.sessionID,
            taalk_call_id: transfer.sessionID,
            source: 'csv_import',
            phone: transfer.phone,
            name: transfer.name
          }
        };
        
        // Call analyzeCall but it will use metadata.sessionID
        await scheduler.analyzeCall(transaction);
        succeeded++;
        processed++;
      } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
        failed++;
        processed++;
      }
    }
  }
  
  console.log(`\n✅ Complete: ${succeeded} succeeded, ${failed} failed, ${processed} total`);
}

analyzeDirectly().catch(console.error);
