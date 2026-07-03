const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function populateMgaRgaDirectory() {
  console.log('📊 Building MGA/RGA Directory from Producer List...');
  
  try {
    // Read and parse the CSV file
    const csvContent = fs.readFileSync('Producer List 10.24.25.csv', 'utf-8');
    const lines = csvContent.split('\n');
    
    // Skip header row
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    console.log(`📋 Found ${dataLines.length} rows in Producer List`);
    
    // Step 1: Build a lookup map of Agent Name -> Agent Data
    const nameToAgentData = new Map();
    
    console.log('🔍 Building agent lookup map...');
    
    dataLines.forEach(line => {
      const columns = parseCSVLine(line);
      const associateId = parseInt(columns[0]);
      const agentName = columns[9]?.trim().toUpperCase();
      const email = columns[3]?.trim().toLowerCase();
      const mgaName = columns[1]?.trim().toUpperCase();
      const rgaName = columns[2]?.trim().toUpperCase();
      const aoiMarket = columns[6]?.trim();
      const aoMarket2 = columns[7]?.trim();
      const designatedMarket = columns[8]?.trim();
      
      if (associateId && agentName) {
        nameToAgentData.set(agentName, {
          associateId,
          name: agentName,
          email,
          mgaName: mgaName !== '0' ? mgaName : null,
          rgaName: rgaName !== '0' ? rgaName : null,
          aoiMarket,
          aoMarket2,
          designatedMarket
        });
      }
    });
    
    console.log(`✅ Built lookup map with ${nameToAgentData.size} agents`);
    
    // Step 2: Collect all unique MGAs and RGAs
    const mgaSet = new Set();
    const rgaSet = new Set();
    
    console.log('🔄 Identifying all MGAs and RGAs...');
    
    dataLines.forEach(line => {
      const columns = parseCSVLine(line);
      const mgaName = columns[1]?.trim().toUpperCase();
      const rgaName = columns[2]?.trim().toUpperCase();
      
      if (mgaName && mgaName !== '0') {
        mgaSet.add(mgaName);
      }
      if (rgaName && rgaName !== '0') {
        rgaSet.add(rgaName);
      }
    });
    
    console.log(`📋 Found ${mgaSet.size} unique MGAs`);
    console.log(`📋 Found ${rgaSet.size} unique RGAs`);
    
    // Step 3: Build MGA/RGA directory records
    const mgaRgaRecords = [];
    const notFoundLeaders = [];
    
    // Combine MGAs and RGAs, determining role
    const allLeaders = new Set([...mgaSet, ...rgaSet]);
    
    console.log(`🔄 Processing ${allLeaders.size} total leaders...`);
    
    for (const leaderName of allLeaders) {
      const isMGA = mgaSet.has(leaderName);
      const isRGA = rgaSet.has(leaderName);
      
      // Look up this leader's data from producer list first
      let leaderData = nameToAgentData.get(leaderName);
      
      // If not found in producer list, try looking up by name in customers table
      if (!leaderData) {
        console.log(`🔍 Leader "${leaderName}" not in Producer List, checking customers table...`);
        
        // Try to match by name in customers table
        const nameParts = leaderName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;
        
        const { data: customerMatch } = await supabase
          .from('customers')
          .select('associate_id, company_email, first_name, last_name')
          .or(`first_name.ilike.${firstName},last_name.ilike.${lastName}`)
          .limit(5);
        
        // Find best match
        if (customerMatch && customerMatch.length > 0) {
          const exactMatch = customerMatch.find(c => 
            `${c.first_name} ${c.last_name}`.toUpperCase() === leaderName
          );
          
          if (exactMatch) {
            console.log(`✅ Found "${leaderName}" in customers: ${exactMatch.company_email} (${exactMatch.associate_id})`);
            leaderData = {
              associateId: exactMatch.associate_id,
              name: leaderName,
              email: exactMatch.company_email,
              mgaName: null,
              rgaName: null,
              aoiMarket: null,
              aoMarket2: null,
              designatedMarket: null
            };
          }
        }
      }
      
      if (!leaderData) {
        notFoundLeaders.push(leaderName);
        console.log(`❌ Leader "${leaderName}" not found anywhere`);
        continue;
      }
      
      // Determine role
      let role = 'MGA';
      if (isMGA && isRGA) {
        role = 'BOTH';
      } else if (isRGA) {
        role = 'RGA';
      }
      
      mgaRgaRecords.push({
        associate_id: leaderData.associateId,
        name: leaderData.name,
        email: leaderData.email || null,
        role: role,
        aoi_market: leaderData.aoiMarket || null,
        ao_market_2: leaderData.aoMarket2 || null,
        designated_market: leaderData.designatedMarket || null,
        reports_to_rga_id: null, // Will populate in second pass if needed
        reports_to_rga_name: leaderData.rgaName || null
      });
    });
    
    console.log(`✅ Built ${mgaRgaRecords.length} MGA/RGA records`);
    console.log(`⚠️  ${notFoundLeaders.length} leaders not found in agent data`);
    
    if (notFoundLeaders.length > 0) {
      console.log('❌ Missing leaders:', notFoundLeaders);
    }
    
    // Step 4: Second pass - resolve reports_to_rga_id
    console.log('🔄 Resolving RGA reporting relationships...');
    
    const nameToRecord = new Map(mgaRgaRecords.map(r => [r.name, r]));
    
    mgaRgaRecords.forEach(record => {
      if (record.reports_to_rga_name) {
        const rgaRecord = nameToRecord.get(record.reports_to_rga_name);
        if (rgaRecord) {
          record.reports_to_rga_id = rgaRecord.associate_id;
        }
      }
    });
    
    // Step 5: Upsert to Supabase
    console.log('💾 Upserting MGA/RGA directory to Supabase...');
    
    // First, let's check if the table exists by trying to create it
    console.log('🔧 Ensuring table exists...');
    
    const createTableSQL = fs.readFileSync('create-mga-rga-directory.sql', 'utf-8');
    console.log('📝 Please run create-mga-rga-directory.sql in Supabase SQL editor first');
    
    // Batch upsert in chunks of 500
    const chunkSize = 500;
    let upsertedCount = 0;
    
    for (let i = 0; i < mgaRgaRecords.length; i += chunkSize) {
      const chunk = mgaRgaRecords.slice(i, i + chunkSize);
      
      const { data, error } = await supabase
        .from('mga_rga_directory')
        .upsert(chunk, {
          onConflict: 'associate_id',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`❌ Error upserting chunk ${Math.floor(i / chunkSize) + 1}:`, error);
        continue;
      }
      
      upsertedCount += chunk.length;
      console.log(`✅ Upserted ${upsertedCount}/${mgaRgaRecords.length} records`);
    }
    
    console.log('✅ MGA/RGA Directory population complete!');
    console.log(`📊 Final stats:`);
    console.log(`   - Total leaders: ${mgaRgaRecords.length}`);
    console.log(`   - MGAs only: ${mgaRgaRecords.filter(r => r.role === 'MGA').length}`);
    console.log(`   - RGAs only: ${mgaRgaRecords.filter(r => r.role === 'RGA').length}`);
    console.log(`   - BOTH (MGA & RGA): ${mgaRgaRecords.filter(r => r.role === 'BOTH').length}`);
    
  } catch (error) {
    console.error('❌ Error populating MGA/RGA directory:', error);
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
populateMgaRgaDirectory();

