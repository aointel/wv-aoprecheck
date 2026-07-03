#!/usr/bin/env node

/**
 * Update associate_id in customers table from CSV file
 * Matches by Company Email or Personal Email
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use correct Supabase credentials from hardcoded-config
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

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
    
    // Only process rows with Associate ID and Company Email
    if (values.length >= 4 && values[0] && values[3]) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return data;
}

async function updateAssociateIds() {
  // Use the CSV file specified by user
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
    .from('customers')
    .select('id')
    .limit(1);
  
  if (testError) {
    console.error(`❌ Supabase connection failed:`, testError.message);
    console.error(`   URL: ${SUPABASE_URL}`);
    console.error(`   Check your Supabase credentials and network connection.`);
    process.exit(1);
  }
  console.log(`✅ Supabase connection successful\n`);
  
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  let skipped = 0;
  let processed = 0;
  
  // Process in batches to avoid overwhelming the database
  const BATCH_SIZE = 50;
  const DELAY_MS = 100; // Small delay between batches
  
  for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
    const batch = csvData.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(csvData.length / BATCH_SIZE)} (${batch.length} rows)...`);
    
    for (const row of batch) {
      processed++;
      const associateId = row['Associate ID']?.trim();
    const companyEmail = row['Company Email']?.trim().toLowerCase();
    const personalEmail = row['Personal Email']?.trim().toLowerCase();
    const agentName = row['Agent']?.trim();
    
    if (!associateId || associateId === '0' || !companyEmail) {
      skipped++;
      continue;
    }
    
    try {
      // Try to find customer by company_email first, then personal_email
      let customer = null;
      
      if (companyEmail) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, company_email, personal_email, associate_id')
          .eq('company_email', companyEmail)
          .maybeSingle();
        
        if (!error && data) {
          customer = data;
        }
      }
      
      // If not found by company_email, try personal_email
      if (!customer && personalEmail) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, company_email, personal_email, associate_id')
          .eq('personal_email', personalEmail)
          .maybeSingle();
        
        if (!error && data) {
          customer = data;
        }
      }
      
      // If customer not found, create new record
      if (!customer) {
        // Parse name from agent name or email
        const nameParts = agentName ? agentName.split(' ') : (companyEmail || personalEmail || '').split('@')[0].split(/[._-]/);
        const firstName = nameParts[0] || 'Agent';
        const lastName = nameParts.slice(1).join(' ') || 'User';
        
        // Parse phone (remove parentheses and spaces, format properly)
        let phone = row['Phone']?.trim() || '+1-555-0000';
        if (phone && phone !== '+1-555-0000') {
          const cleanedPhone = phone.replace(/\D/g, '');
          if (cleanedPhone.length === 10) {
            phone = `+1${cleanedPhone}`;
          } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
            phone = `+${cleanedPhone}`;
          } else if (cleanedPhone.length > 0) {
            phone = `+${cleanedPhone}`;
          } else {
            phone = '+1-555-0000';
          }
        }
        
        // Get markets
        const aoiMarket = row['AOI MARKET']?.trim() || '';
        const aoMarket2 = row['AO Market 2']?.trim() || '';
        const designatedMarket = row['Designated Market']?.trim() || '';
        const states = row['Life-and-Health Licensed States']?.trim() || '';
        
        const newCustomer = {
          company_email: companyEmail || personalEmail,
          personal_email: personalEmail || companyEmail,
          associate_id: parseInt(associateId),
          first_name: firstName,
          last_name: lastName,
          agent_name: agentName || `${firstName} ${lastName}`,
          phone: phone,
          primary_market: aoiMarket,
          secondary_market: aoMarket2,
          designated_market: designatedMarket,
          states: states,
          VDPACTIVE: 'INACTIVE',
          PLUSACTIVE: 'INACTIVE',
          RECRUITACTIVE: 'INACTIVE',
          AOICONNECT: 'INACTIVE',
          CCPRO: false,
          status: 'offline',
          created_at: new Date().toISOString()
        };
        
        const { error: insertError } = await supabase
          .from('customers')
          .insert(newCustomer)
          .select();
        
        if (insertError) {
          console.error(`❌ Error inserting ${companyEmail || personalEmail}:`, insertError.message);
          if (insertError.code === '23505') {
            // Duplicate key error - customer already exists, try to update instead
            console.log(`   → Customer exists, updating associate_id instead...`);
            const { error: updateError } = await supabase
              .from('customers')
              .update({ associate_id: parseInt(associateId) })
              .eq('company_email', companyEmail || personalEmail)
              .or(`personal_email.eq.${personalEmail || companyEmail}`);
            
            if (updateError) {
              console.error(`   ❌ Update also failed:`, updateError.message);
              errors++;
            } else {
              console.log(`   ✅ Updated existing customer: ${companyEmail || personalEmail} with associate_id ${associateId}`);
              updated++;
            }
          } else {
            errors++;
          }
        } else {
          console.log(`✅ Inserted new customer: ${companyEmail || personalEmail} with associate_id ${associateId} (${agentName || 'N/A'})`);
          updated++;
          
          // Also update/create in agent_hierarchy (silently fail if it doesn't exist)
          try {
            const { error: hierarchyError } = await supabase
              .from('agent_hierarchy')
              .upsert({
                agent_associate_id: parseInt(associateId),
                agent_email: companyEmail || personalEmail,
                agent_name: agentName || `${firstName} ${lastName}`,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'agent_associate_id'
              });
            
            if (hierarchyError && !hierarchyError.message.includes('relation') && !hierarchyError.message.includes('does not exist')) {
              console.warn(`⚠️  Could not update agent_hierarchy for ${companyEmail || personalEmail}:`, hierarchyError.message);
            }
          } catch (hierarchyErr) {
            // Ignore hierarchy errors - table might not exist
          }
        }
        continue;
      }
      
      // Check if associate_id already matches
      if (customer.associate_id && String(customer.associate_id) === String(associateId)) {
        console.log(`⏭️  Skipping ${companyEmail || personalEmail} - associate_id already ${associateId}`);
        skipped++;
        continue;
      }
      
      // Update associate_id
      const { error: updateError } = await supabase
        .from('customers')
        .update({ 
          associate_id: parseInt(associateId)
        })
        .eq('id', customer.id);
      
      if (updateError) {
        console.error(`❌ Error updating ${companyEmail || personalEmail}:`, updateError.message);
        errors++;
      } else {
        console.log(`✅ Updated ${companyEmail || personalEmail}: associate_id ${customer.associate_id || 'NULL'} → ${associateId} (${agentName || 'N/A'})`);
        updated++;
        
        // Also update agent_hierarchy (silently fail if it doesn't exist)
        try {
          const { error: hierarchyError } = await supabase
            .from('agent_hierarchy')
            .upsert({
              agent_associate_id: parseInt(associateId),
              agent_email: companyEmail || personalEmail,
              agent_name: agentName || customer.agent_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'agent_associate_id'
            });
          
          if (hierarchyError && !hierarchyError.message.includes('relation') && !hierarchyError.message.includes('does not exist')) {
            console.warn(`⚠️  Could not update agent_hierarchy for ${companyEmail || personalEmail}:`, hierarchyError.message);
          }
        } catch (hierarchyErr) {
          // Ignore hierarchy errors - table might not exist
        }
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${companyEmail || personalEmail}:`, error.message);
      errors++;
    }
    } // End of batch row loop
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < csvData.length) {
      await setTimeout(DELAY_MS);
    }
  } // End of batch loop
  
  console.log('\n📊 SUMMARY:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⚠️  Not Found: ${notFound}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📝 Total Processed: ${csvData.length}`);
}

updateAssociateIds().catch(console.error);

