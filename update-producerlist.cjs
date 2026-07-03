/**
 * Update producerlist in Supabase from CSV
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Using credentials from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljeno3amV0eHdwZmd0cnpleXl0dCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function updateProducerList() {
  console.log('\n🔄 UPDATING PRODUCERLIST FROM CSV\n');
  console.log('='.repeat(80));

  const csvPath = 'C:\\Users\\mmand\\OneDrive\\Desktop\\AOI\\Producer List 10.24.25.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());

  console.log(`📄 Read ${lines.length} lines from CSV`);
  
  // Parse header (remove BOM if present)
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const header = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
  console.log(`📋 Headers:`, header);

  let updatedCount = 0;
  let insertedCount = 0;
  let errorCount = 0;

  // Process each line (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      // Parse CSV line
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let char of line) {
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

      // Map values to object
      const row = {};
      header.forEach((col, idx) => {
        row[col] = values[idx] || null;
      });

      // Skip if no associate_id
      if (!row['Associate ID'] || row['Associate ID'] === 'NULL' || row['Associate ID'] === '') {
        console.log(`⏭️ Skipping row ${i} - no associate_id`);
        continue;
      }

      // Prepare data for upsert based on actual CSV columns
      const producerData = {
        associate_id: parseInt(row['Associate ID']),
        mga: row['MGA'] || null,
        rga: row['RGA'] || null,
        company_email: row['Company Email'] || null,
        personal_email: row['Personal Email'] || null,
        phone: row['Phone'] || null,
        market: row['AOI MARKET'] || null,
        market2: row['AO Market 2'] || null,
        designated_market: row['Designated Market'] || null,
        agent_name: row['Agent'] || null,
        life_health_states: row['Life-and-Health Licensed States'] || null,
        life_only_states: row['Life-Only Licensed States'] || null,
        health_only_states: row['Health-Only Licensed States'] || null
      };

      // Remove null/undefined fields
      Object.keys(producerData).forEach(key => {
        if (producerData[key] === null || producerData[key] === undefined || producerData[key] === '') {
          delete producerData[key];
        }
      });

      // Upsert to Supabase
      const { data, error } = await supabase
        .from('producerlist')
        .upsert(producerData, { 
          onConflict: 'associate_id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error(`❌ Error upserting row ${i} (${row.agent_name}):`, error.message);
        errorCount++;
      } else {
        if (data && data.length > 0) {
          console.log(`✅ [${i}/${lines.length - 1}] Upserted: ${row.agent_name} (${row.associate_id})`);
          updatedCount++;
        } else {
          insertedCount++;
        }
      }

      // Throttle to avoid rate limits
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (error) {
      console.error(`❌ Error processing row ${i}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Rows Processed: ${lines.length - 1}`);
  console.log(`   ✅ Updated/Inserted: ${updatedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('\n✨ Done!\n');
}

updateProducerList()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

