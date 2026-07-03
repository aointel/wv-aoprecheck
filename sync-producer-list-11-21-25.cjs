const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function syncProducerList() {
  console.log('🔄 Syncing Producer List 11.21.25.csv to database...\n');
  console.log('='.repeat(80));
  
  try {
    // Read and parse the CSV file
    const csvPath = path.join(__dirname, 'server', 'Producer List 11.21.25.csv');
    console.log(`📂 Reading CSV from: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found: ${csvPath}`);
      return;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Skip header row
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📋 Found ${dataLines.length} rows in Producer List\n`);
    
    // Step 1: Parse all producer records
    const producerRecords = [];
    const mgaRgaSet = new Set();
    const mgaRgaData = new Map(); // name -> { associateId, email, role }
    
    console.log('📝 Parsing producer records...');
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const columns = parseCSVLine(line);
      
      const associateId = parseInt(columns[0]);
      const mgaName = columns[1]?.trim().toUpperCase();
      const rgaName = columns[2]?.trim().toUpperCase();
      const companyEmail = columns[3]?.trim().toLowerCase();
      const personalEmail = columns[4]?.trim().toLowerCase();
      const phone = columns[5]?.trim();
      const aoiMarket = columns[6]?.trim();
      const aoMarket2 = columns[7]?.trim();
      const designatedMarket = columns[8]?.trim();
      const agentName = columns[9]?.trim().toUpperCase();
      
      if (!associateId || !agentName) {
        continue; // Skip invalid rows
      }
      
      // Build producer record
      const producerRecord = {
        associate_id: associateId,
        agent_name: agentName,
        company_email: companyEmail || null,
        personal_email: personalEmail || null,
        phone: phone || null,
        mga: (mgaName && mgaName !== '0') ? mgaName : null,
        rga: (rgaName && rgaName !== '0') ? rgaName : null,
        aoi_market: aoiMarket || null,
        ao_market_2: aoMarket2 || null,
        designated_market: designatedMarket || null,
      };
      
      producerRecords.push(producerRecord);
      
      // Track MGA/RGA for directory
      if (mgaName && mgaName !== '0') {
        mgaRgaSet.add(mgaName);
        if (!mgaRgaData.has(mgaName)) {
          mgaRgaData.set(mgaName, {
            associateId: null, // Will look up later
            email: null,
            role: 'MGA',
            name: mgaName
          });
        }
      }
      
      if (rgaName && rgaName !== '0') {
        mgaRgaSet.add(rgaName);
        if (!mgaRgaData.has(rgaName)) {
          mgaRgaData.set(rgaName, {
            associateId: null,
            email: null,
            role: 'RGA',
            name: rgaName
          });
        } else {
          // Already exists, might be both MGA and RGA
          const existing = mgaRgaData.get(rgaName);
          if (existing.role === 'MGA') {
            existing.role = 'BOTH';
          }
        }
      }
      
      // If this agent IS an MGA or RGA, store their info
      if (mgaRgaSet.has(agentName)) {
        const leaderData = mgaRgaData.get(agentName);
        if (leaderData) {
          leaderData.associateId = associateId;
          leaderData.email = companyEmail || null;
        }
      }
    }
    
    console.log(`✅ Parsed ${producerRecords.length} producer records`);
    console.log(`📋 Found ${mgaRgaSet.size} unique MGA/RGA leaders\n`);
    
    // Step 2: Upsert producer records to producerlist table
    console.log('💾 Upserting producer records to producerlist table...');
    
    // Remove duplicates by associate_id (keep first occurrence)
    const uniqueRecords = [];
    const seenIds = new Set();
    for (const record of producerRecords) {
      if (!seenIds.has(record.associate_id)) {
        seenIds.add(record.associate_id);
        uniqueRecords.push(record);
      }
    }
    
    console.log(`   Removed ${producerRecords.length - uniqueRecords.length} duplicate associate_ids`);
    
    const chunkSize = 100; // Smaller chunks to avoid timeouts
    let upsertedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < uniqueRecords.length; i += chunkSize) {
      const chunk = uniqueRecords.slice(i, i + chunkSize);
      
      // Process one at a time to avoid duplicate key conflicts
      for (const record of chunk) {
        try {
          const { error } = await supabase
            .from('producerlist')
            .upsert(record, {
              onConflict: 'associate_id',
              ignoreDuplicates: false
            });
          
          if (error) {
            console.error(`   ⚠️  Error upserting associate_id ${record.associate_id}:`, error.message);
            errorCount++;
          } else {
            upsertedCount++;
          }
        } catch (err) {
          console.error(`   ⚠️  Exception upserting associate_id ${record.associate_id}:`, err.message);
          errorCount++;
        }
      }
      
      console.log(`✅ Processed ${Math.min(i + chunkSize, uniqueRecords.length)}/${uniqueRecords.length} records`);
    }
    
    console.log(`\n✅ Producer list sync complete!`);
    console.log(`   - Total records processed: ${upsertedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Unique records: ${uniqueRecords.length}\n`);
    
    // Step 3: Resolve MGA/RGA associate IDs from producerlist
    console.log('🔍 Resolving MGA/RGA associate IDs...');
    
    for (const leaderName of mgaRgaSet) {
      const leaderData = mgaRgaData.get(leaderName);
      if (!leaderData || leaderData.associateId) {
        continue; // Already resolved or doesn't exist
      }
      
      // Look up by agent_name in producerlist
      const { data: producer } = await supabase
        .from('producerlist')
        .select('associate_id, company_email')
        .ilike('agent_name', leaderName)
        .limit(1)
        .maybeSingle();
      
      if (producer) {
        leaderData.associateId = producer.associate_id;
        leaderData.email = producer.company_email || null;
        console.log(`   ✅ Found ${leaderName}: associate_id ${producer.associate_id}`);
      } else {
        console.log(`   ⚠️  ${leaderName} not found in producerlist`);
      }
    }
    
    // Step 4: Build MGA/RGA directory records
    console.log('\n📋 Building MGA/RGA directory records...');
    
    const mgaRgaRecords = [];
    
    for (const leaderName of mgaRgaSet) {
      const leaderData = mgaRgaData.get(leaderName);
      
      if (!leaderData || !leaderData.associateId) {
        console.log(`   ⚠️  Skipping ${leaderName} - no associate_id found`);
        continue;
      }
      
      // Check if this leader is both MGA and RGA
      let role = leaderData.role;
      const isMGA = producerRecords.some(r => r.mga === leaderName);
      const isRGA = producerRecords.some(r => r.rga === leaderName);
      
      if (isMGA && isRGA) {
        role = 'BOTH';
      } else if (isMGA) {
        role = 'MGA';
      } else if (isRGA) {
        role = 'RGA';
      }
      
      // Find market info from producer records
      const leaderProducer = producerRecords.find(r => r.associate_id === leaderData.associateId);
      
      mgaRgaRecords.push({
        associate_id: leaderData.associateId,
        name: leaderName,
        email: leaderData.email || leaderProducer?.company_email || null,
        role: role,
        aoi_market: leaderProducer?.aoi_market || null,
        ao_market_2: leaderProducer?.ao_market_2 || null,
        designated_market: leaderProducer?.designated_market || null,
        reports_to_rga_id: null, // Will resolve in next step
        reports_to_rga_name: null
      });
    }
    
    console.log(`✅ Built ${mgaRgaRecords.length} MGA/RGA directory records\n`);
    
    // Step 5: Resolve reports_to_rga_id relationships
    console.log('🔗 Resolving RGA reporting relationships...');
    
    const nameToRecord = new Map(mgaRgaRecords.map(r => [r.name, r]));
    
    // For each MGA, find their RGA and set reports_to_rga_id
    for (const producer of producerRecords) {
      if (producer.mga && producer.rga) {
        const mgaRecord = nameToRecord.get(producer.mga);
        const rgaRecord = nameToRecord.get(producer.rga);
        
        if (mgaRecord && rgaRecord) {
          mgaRecord.reports_to_rga_id = rgaRecord.associate_id;
          mgaRecord.reports_to_rga_name = producer.rga;
        }
      }
    }
    
    // Step 6: Upsert MGA/RGA directory
    console.log('💾 Upserting MGA/RGA directory...');
    
    let directoryUpserted = 0;
    
    for (let i = 0; i < mgaRgaRecords.length; i += chunkSize) {
      const chunk = mgaRgaRecords.slice(i, i + chunkSize);
      
      const { data, error } = await supabase
        .from('mga_rga_directory')
        .upsert(chunk, {
          onConflict: 'associate_id',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`❌ Error upserting directory chunk ${Math.floor(i / chunkSize) + 1}:`, error);
        continue;
      }
      
      directoryUpserted += chunk.length;
      console.log(`✅ Upserted ${directoryUpserted}/${mgaRgaRecords.length} directory records`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SYNC COMPLETE!\n');
    console.log('📊 Final Statistics:');
    console.log(`   - Producer records: ${upsertedCount} total`);
    console.log(`   - MGA/RGA directory: ${directoryUpserted} records`);
    console.log(`   - MGAs only: ${mgaRgaRecords.filter(r => r.role === 'MGA').length}`);
    console.log(`   - RGAs only: ${mgaRgaRecords.filter(r => r.role === 'RGA').length}`);
    console.log(`   - BOTH (MGA & RGA): ${mgaRgaRecords.filter(r => r.role === 'BOTH').length}`);
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error syncing producer list:', error);
    console.error(error.stack);
  }
}

// Run the sync
syncProducerList();

