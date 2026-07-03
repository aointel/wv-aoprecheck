/**
 * Update associate_id in customers table from CSV file
 * This can be called via API endpoint or run directly
 */

import { supabaseAdmin } from './supabase';
import fs from 'fs';
import path from 'path';

// Parse CSV file - handles quoted fields with commas
function parseCSV(filePath: string): Array<Record<string, string>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return [];
  }
  
  // Parse header
  const headerLine = lines[0];
  const headers: string[] = [];
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
  const data: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
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
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }
  
  return data;
}

/** Always store customer states as JSON array like ["AL","CA"]. */
function normalizeStatesArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const cleaned = String(raw).trim();
  if (!cleaned) return [];

  let items: string[] = [];
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      items = parsed.map((v) => String(v ?? ''));
    } else if (typeof parsed === 'string') {
      items = parsed.split(',');
    }
  } catch {
    items = cleaned.split(',');
  }

  return [...new Set(
    items
      .map((s) => s.trim().replace(/^"+|"+$/g, '').toUpperCase())
      .filter((s) => /^[A-Z]{2}$/.test(s)),
  )];
}

export async function updateAssociateIdsFromCSV(csvPath: string): Promise<{
  updated: number;
  notFound: number;
  errors: number;
  skipped: number;
  total: number;
}> {
  console.log('📊 Parsing CSV file...');
  const csvData = parseCSV(csvPath);
  console.log(`✅ Parsed ${csvData.length} rows from CSV\n`);
  
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  let skipped = 0;
  
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }
  
  for (const row of csvData) {
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
        const { data, error } = await supabaseAdmin
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
        const { data, error } = await supabaseAdmin
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
        const states = normalizeStatesArray(row['Life-and-Health Licensed States']);
        
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
          states,
          VDPACTIVE: 'INACTIVE',
          PLUSACTIVE: 'INACTIVE',
          RECRUITACTIVE: 'INACTIVE',
          AOICONNECT: 'INACTIVE',
          CCPRO: false,
          status: 'offline',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error: insertError } = await supabaseAdmin
          .from('customers')
          .insert(newCustomer);
        
        if (insertError) {
          console.error(`❌ Error inserting ${companyEmail || personalEmail}:`, insertError.message);
          errors++;
        } else {
          console.log(`✅ Inserted new customer: ${companyEmail || personalEmail} with associate_id ${associateId} (${agentName || 'N/A'})`);
          updated++;
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
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({ 
          associate_id: parseInt(associateId),
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);
      
      if (updateError) {
        console.error(`❌ Error updating ${companyEmail || personalEmail}:`, updateError.message);
        errors++;
      } else {
        console.log(`✅ Updated ${companyEmail || personalEmail}: associate_id ${customer.associate_id || 'NULL'} → ${associateId} (${agentName || 'N/A'})`);
        updated++;
      }
      
    } catch (error: any) {
      console.error(`❌ Error processing ${companyEmail || personalEmail}:`, error.message);
      errors++;
    }
  }
  
  const summary = {
    updated,
    inserted: updated - (csvData.length - notFound - skipped - errors), // Rough estimate
    notFound,
    errors,
    skipped,
    total: csvData.length
  };
  
  console.log('\n📊 SUMMARY:');
  console.log(`   ✅ Updated/Inserted: ${updated}`);
  console.log(`   ⚠️  Not Found (skipped): ${notFound}`);
  console.log(`   ⏭️  Skipped (already correct): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📝 Total Processed: ${csvData.length}`);
  
  return summary;
}

// If run directly (not imported)
// Check if this is the main module (ESM way)
if (import.meta.url === `file://${process.argv[1]}`) {
  const csvPath = path.join(process.cwd(), 'client/src/components/connectnow/Copy of Producer List 1.2.26.csv');
  updateAssociateIdsFromCSV(csvPath).catch(console.error);
}

