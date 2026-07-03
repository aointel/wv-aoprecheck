#!/usr/bin/env node

/**
 * Update agent hierarchies from CSV file
 * Maps: Executive Producer → MGA, Chief Executive Producer → RGA
 * Reads from: Producer List 1.2.26.csv
 * Updates: agent_hierarchy table
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use correct Supabase credentials
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse CSV file - handles quoted fields with commas
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return [];
  }
  
  // Parse header
  const headerLine = lines[0];
  const headers = [];
  let currentHeader = '';
  let inQuotes = false;
  
  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(currentHeader.trim());
      currentHeader = '';
    } else {
      currentHeader += char;
    }
  }
  headers.push(currentHeader.trim());
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = [];
    let current = '';
    inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add last value
    
    // Build row object
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    if (row['Associate ID'] && row['Associate ID'] !== '0') {
      data.push(row);
    }
  }
  
  return data;
}

async function updateHierarchies() {
  const csvPath = path.join(__dirname, 'Producer List 1.2.26.csv');
  
  console.log('📊 Parsing CSV file...');
  console.log(`📍 CSV Path: ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at: ${csvPath}`);
    process.exit(1);
  }
  
  const csvData = parseCSV(csvPath);
  console.log(`✅ Parsed ${csvData.length} rows from CSV\n`);
  
  // Test Supabase connection
  console.log('🔌 Testing Supabase connection...');
  const { data: testData, error: testError } = await supabase
    .from('agent_hierarchy')
    .select('agent_associate_id')
    .limit(1);
  
  if (testError) {
    console.error(`❌ Supabase connection failed:`, testError.message);
    console.error(`   URL: ${SUPABASE_URL}`);
    console.error(`   Check your Supabase credentials and network connection.`);
    process.exit(1);
  }
  console.log(`✅ Supabase connection successful\n`);
  
  // Step 1: Build name -> associate_id lookup map from CSV
  console.log('🔍 Building name lookup map from CSV...');
  const nameToAssociateId = new Map();
  
  csvData.forEach(row => {
    const associateId = parseInt(row['Associate ID']);
    const agentName = row['Agent']?.trim().toUpperCase();
    
    if (associateId && agentName && agentName !== '0' && agentName !== '') {
      nameToAssociateId.set(agentName, associateId);
    }
  });
  
  console.log(`✅ Built lookup map with ${nameToAssociateId.size} agents\n`);
  
  // Step 2: Process each row and build hierarchy records
  console.log('🔄 Processing hierarchy relationships...');
  console.log('   Executive Producer → MGA (Managing General Agent)');
  console.log('   Chief Executive Producer → RGA (Regional General Agent)\n');
  
  const hierarchyRecords = [];
  let processedCount = 0;
  let mgaNotFoundCount = 0;
  let rgaNotFoundCount = 0;
  let skippedCount = 0;
  
  for (const row of csvData) {
    const agentAssociateId = parseInt(row['Associate ID']);
    const executiveProducer = row['Executive Producer']?.trim().toUpperCase(); // MGA
    const chiefExecutiveProducer = row['Chief Executive Producer']?.trim().toUpperCase(); // RGA
    const companyEmail = row['Company Email']?.trim().toLowerCase();
    const agentName = row['Agent']?.trim();
    const aoiMarket = row['AOI MARKET']?.trim();
    const aoMarket2 = row['AO Market 2']?.trim();
    const designatedMarket = row['Designated Market']?.trim();
    
    if (!agentAssociateId || !agentName) {
      skippedCount++;
      continue;
    }
    
    // Look up MGA and RGA associate IDs
    let mgaAssociateId = null;
    let mgaName = null;
    let rgaAssociateId = null;
    let rgaName = null;
    
    // Executive Producer → MGA
    if (executiveProducer && executiveProducer !== '0' && executiveProducer !== '') {
      mgaName = executiveProducer;
      mgaAssociateId = nameToAssociateId.get(mgaName);
      if (!mgaAssociateId) {
        mgaNotFoundCount++;
        if (mgaNotFoundCount <= 10) {
          console.log(`⚠️  MGA "${mgaName}" not found for agent ${agentName} (${agentAssociateId})`);
        }
      }
    }
    
    // Chief Executive Producer → RGA
    if (chiefExecutiveProducer && chiefExecutiveProducer !== '0' && chiefExecutiveProducer !== '') {
      rgaName = chiefExecutiveProducer;
      rgaAssociateId = nameToAssociateId.get(rgaName);
      if (!rgaAssociateId) {
        rgaNotFoundCount++;
        if (rgaNotFoundCount <= 10) {
          console.log(`⚠️  RGA "${rgaName}" not found for agent ${agentName} (${agentAssociateId})`);
        }
      }
    }
    
    hierarchyRecords.push({
      agent_associate_id: agentAssociateId,
      agent_name: agentName,
      agent_email: companyEmail || null,
      mga_associate_id: mgaAssociateId,
      mga_name: mgaName || null,
      rga_associate_id: rgaAssociateId,
      rga_name: rgaName || null,
      aoi_market: aoiMarket || null,
      ao_market_2: aoMarket2 || null,
      designated_market: designatedMarket || null
    });
    
    processedCount++;
  }
  
  console.log(`\n✅ Processed ${processedCount} agent hierarchy records`);
  console.log(`   ⚠️  ${mgaNotFoundCount} MGAs not found in lookup`);
  console.log(`   ⚠️  ${rgaNotFoundCount} RGAs not found in lookup`);
  console.log(`   ⏭️  ${skippedCount} rows skipped (invalid data)\n`);
  
  // Step 3: Deduplicate records by agent_associate_id (keep last occurrence)
  console.log('🔍 Deduplicating records by agent_associate_id...');
  const uniqueRecords = new Map();
  let duplicateCount = 0;
  
  hierarchyRecords.forEach(record => {
    const existing = uniqueRecords.get(record.agent_associate_id);
    if (existing) {
      duplicateCount++;
      // Keep the last occurrence (or prefer one with hierarchy data)
      if (record.mga_associate_id || record.rga_associate_id) {
        uniqueRecords.set(record.agent_associate_id, record);
      }
    } else {
      uniqueRecords.set(record.agent_associate_id, record);
    }
  });
  
  const deduplicatedRecords = Array.from(uniqueRecords.values());
  console.log(`✅ Deduplicated: ${hierarchyRecords.length} → ${deduplicatedRecords.length} records`);
  if (duplicateCount > 0) {
    console.log(`   ⚠️  Removed ${duplicateCount} duplicate associate_id entries\n`);
  } else {
    console.log('');
  }
  
  // Step 4: Upsert all records to Supabase
  console.log('💾 Upserting records to agent_hierarchy table...');
  
  const BATCH_SIZE = 500;
  let upsertedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < deduplicatedRecords.length; i += BATCH_SIZE) {
    const batch = deduplicatedRecords.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(deduplicatedRecords.length / BATCH_SIZE);
    
    console.log(`   Processing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);
    
    const { data, error } = await supabase
      .from('agent_hierarchy')
      .upsert(batch, {
        onConflict: 'agent_associate_id',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error(`   ❌ Error upserting batch ${batchNum}:`, error.message);
      errorCount += batch.length;
    } else {
      upsertedCount += batch.length;
      console.log(`   ✅ Upserted ${upsertedCount}/${deduplicatedRecords.length} records`);
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < deduplicatedRecords.length) {
      await setTimeout(100);
    }
  }
  
  console.log('\n📊 SUMMARY:');
  console.log(`   ✅ Processed: ${processedCount} records`);
  console.log(`   ✅ Deduplicated: ${deduplicatedRecords.length} unique records`);
  console.log(`   ✅ Upserted: ${upsertedCount} records`);
  console.log(`   ❌ Errors: ${errorCount} records`);
  console.log(`   📈 With MGA: ${deduplicatedRecords.filter(r => r.mga_associate_id).length}`);
  console.log(`   📈 With RGA: ${deduplicatedRecords.filter(r => r.rga_associate_id).length}`);
  console.log(`   📈 With both MGA and RGA: ${deduplicatedRecords.filter(r => r.mga_associate_id && r.rga_associate_id).length}`);
  
  if (mgaNotFoundCount > 10) {
    console.log(`\n⚠️  ${mgaNotFoundCount} total MGAs not found (showing first 10 above)`);
  }
  if (rgaNotFoundCount > 10) {
    console.log(`⚠️  ${rgaNotFoundCount} total RGAs not found (showing first 10 above)`);
  }
}

updateHierarchies().catch(console.error);

