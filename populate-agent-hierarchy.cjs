const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function populateAgentHierarchy() {
  console.log('📊 Starting Agent Hierarchy population from Producer List...');
  
  try {
    // Step 1: Read Producer List and build name -> associate_id map
    console.log('🔍 Building name lookup from Producer List...');
    const csvContent = fs.readFileSync('Producer List 10.24.25.csv', 'utf-8');
    const lines = csvContent.split('\n');
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    // Build lookup map: Name -> Associate ID (from Producer List itself)
    const nameToAssociateId = new Map();
    dataLines.forEach(line => {
      const columns = parseCSVLine(line);
      const associateId = parseInt(columns[0]);
      const agentName = columns[9]?.trim().toUpperCase();
      
      if (associateId && agentName && agentName !== '0') {
        nameToAssociateId.set(agentName, associateId);
      }
    });
    
    console.log(`✅ Built lookup map with ${nameToAssociateId.size} agents from Producer List`);
    console.log(`📋 Found ${dataLines.length} rows in Producer List`);
    
    // Step 3: Process each row and build hierarchy records
    const hierarchyRecords = [];
    let processedCount = 0;
    let mgaNotFoundCount = 0;
    let rgaNotFoundCount = 0;
    
    console.log('🔄 Processing hierarchy relationships...');
    
    dataLines.forEach(line => {
      const columns = parseCSVLine(line);
      
      const agentAssociateId = parseInt(columns[0]);
      const mgaName = columns[1]?.trim().toUpperCase();
      const rgaName = columns[2]?.trim().toUpperCase();
      const companyEmail = columns[3]?.trim().toLowerCase();
      const aoiMarket = columns[6]?.trim();
      const aoMarket2 = columns[7]?.trim();
      const designatedMarket = columns[8]?.trim();
      const agentName = columns[9]?.trim();
      
      if (!agentAssociateId || !agentName) {
        return; // Skip invalid rows
      }
      
      // Look up MGA and RGA associate IDs
      let mgaAssociateId = null;
      let rgaAssociateId = null;
      
      if (mgaName && mgaName !== '0') {
        mgaAssociateId = nameToAssociateId.get(mgaName);
        if (!mgaAssociateId) {
          mgaNotFoundCount++;
          console.log(`⚠️  MGA "${mgaName}" not found for agent ${agentName} (${agentAssociateId})`);
        }
      }
      
      if (rgaName && rgaName !== '0') {
        rgaAssociateId = nameToAssociateId.get(rgaName);
        if (!rgaAssociateId) {
          rgaNotFoundCount++;
          console.log(`⚠️  RGA "${rgaName}" not found for agent ${agentName} (${agentAssociateId})`);
        }
      }
      
      hierarchyRecords.push({
        agent_associate_id: agentAssociateId,
        agent_name: agentName,
        agent_email: companyEmail || null,
        mga_associate_id: mgaAssociateId,
        mga_name: mgaName !== '0' ? mgaName : null,
        rga_associate_id: rgaAssociateId,
        rga_name: rgaName !== '0' ? rgaName : null,
        aoi_market: aoiMarket || null,
        ao_market_2: aoMarket2 || null,
        designated_market: designatedMarket || null
      });
      
      processedCount++;
    });
    
    console.log(`✅ Processed ${processedCount} agent hierarchy records`);
    console.log(`⚠️  ${mgaNotFoundCount} MGAs not found in lookup`);
    console.log(`⚠️  ${rgaNotFoundCount} RGAs not found in lookup`);
    
    // Step 4: Upsert all records to Supabase
    console.log('💾 Upserting records to Supabase...');
    
    // Batch upsert in chunks of 500
    const chunkSize = 500;
    let upsertedCount = 0;
    
    for (let i = 0; i < hierarchyRecords.length; i += chunkSize) {
      const chunk = hierarchyRecords.slice(i, i + chunkSize);
      
      const { data, error } = await supabase
        .from('agent_hierarchy')
        .upsert(chunk, {
          onConflict: 'agent_associate_id',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`❌ Error upserting chunk ${Math.floor(i / chunkSize) + 1}:`, error);
        continue;
      }
      
      upsertedCount += chunk.length;
      console.log(`✅ Upserted ${upsertedCount}/${hierarchyRecords.length} records`);
    }
    
    console.log('✅ Agent Hierarchy population complete!');
    console.log(`📊 Final stats:`);
    console.log(`   - Total agents: ${hierarchyRecords.length}`);
    console.log(`   - With MGA: ${hierarchyRecords.filter(r => r.mga_associate_id).length}`);
    console.log(`   - With RGA: ${hierarchyRecords.filter(r => r.rga_associate_id).length}`);
    
  } catch (error) {
    console.error('❌ Error populating agent hierarchy:', error);
  }
}

// Helper function to parse CSV line handling quoted fields
function parseCSVLine(line) {
  const columns = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      columns.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  columns.push(current); // Add last column
  
  return columns;
}

// Run the population
populateAgentHierarchy();

