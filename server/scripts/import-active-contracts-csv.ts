/**
 * Import Active Contracts CSV to customers table
 * Reads CSV file and updates/creates customer records
 * 
 * Run: npx tsx server/scripts/import-active-contracts-csv.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { supabaseAdmin } from '../supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CSVRow {
  AssocID: string;
  Name: string;
  Contract: string;
  Email: string;
  'Executive Producer': string;
}

async function importActiveContracts() {
  console.log('📊 Importing Active Contracts CSV to customers table...\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not available');
    process.exit(1);
  }

  // Read CSV file - use absolute path
  const csvPath = 'c:/Users/mmand/Downloads/Active Contracts 2.20.26.csv';
  
  let csvContent: string;
  try {
    csvContent = fs.readFileSync(csvPath, 'utf-8');
  } catch (e) {
    console.error('❌ Could not read CSV file. Please ensure the file exists at:', csvPath);
    console.error('   Error:', (e as Error).message);
    process.exit(1);
  }

  // Parse CSV manually
  const lines = csvContent.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const records: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length >= headers.length) {
      const record: any = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });
      records.push(record as CSVRow);
    }
  }

  console.log(`📋 Found ${records.length} records in CSV\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (row) => {
      try {
        const associateId = parseInt(row.AssocID);
        if (isNaN(associateId)) {
          console.log(`⏭️  Skipping row with invalid AssocID: ${row.AssocID}`);
          skipped++;
          return;
        }

        const email = (row.Email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) {
          console.log(`⏭️  Skipping row with invalid email: ${row.Email}`);
          skipped++;
          return;
        }

        // Parse name
        const nameParts = (row.Name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const agentName = row.Name || `${firstName} ${lastName}`.trim();

        // Check if customer exists by associate_id or email
        const { data: existingByAssoc } = await supabaseAdmin
          .from('customers')
          .select('id, company_email, personal_email, associate_id')
          .eq('associate_id', associateId)
          .maybeSingle();

        const { data: existingByEmail } = await supabaseAdmin
          .from('customers')
          .select('id, company_email, personal_email, associate_id')
          .or(`company_email.eq.${email},personal_email.eq.${email}`)
          .maybeSingle();

        const existing = existingByAssoc || existingByEmail;

        if (existing) {
          // Update existing customer
          const updateData: any = {
            associate_id: associateId,
            company_email: email,
            personal_email: email,
            first_name: firstName,
            last_name: lastName,
            agent_name: agentName
          };

          // Only update if values are different
          if (existing.associate_id !== associateId || 
              existing.company_email?.toLowerCase() !== email ||
              !existing.first_name || existing.first_name !== firstName) {
            
            const { error: updateError } = await supabaseAdmin
              .from('customers')
              .update(updateData)
              .eq('id', existing.id);

            if (updateError) {
              console.error(`❌ Error updating ${email} (AssocID ${associateId}):`, updateError.message);
              errors++;
            } else {
              console.log(`✅ Updated: ${email} (AssocID ${associateId}) - ${agentName}`);
              updated++;
            }
          } else {
            console.log(`⏭️  Skipped (no changes): ${email} (AssocID ${associateId})`);
            skipped++;
          }
        } else {
          // Create new customer
          const newCustomer = {
            company_email: email,
            personal_email: email,
            associate_id: associateId,
            first_name: firstName,
            last_name: lastName,
            agent_name: agentName,
            phone: '+1-555-0000',
            VDPACTIVE: 'INACTIVE',
            PLUSACTIVE: 'INACTIVE',
            RECRUITACTIVE: 'INACTIVE',
            AOICONNECT: 'INACTIVE',
            CCPRO: false,
            status: 'offline',
            created_at: new Date().toISOString()
          };

          const { error: insertError } = await supabaseAdmin
            .from('customers')
            .insert(newCustomer);

          if (insertError) {
            if (insertError.code === '23505') {
              // Unique constraint violation - try update instead
              const { data: conflictCustomer } = await supabaseAdmin
                .from('customers')
                .select('id')
                .or(`company_email.eq.${email},personal_email.eq.${email}`)
                .maybeSingle();

              if (conflictCustomer) {
                const { error: updateError } = await supabaseAdmin
                  .from('customers')
                  .update({
                    associate_id: associateId,
                    first_name: firstName,
                    last_name: lastName,
                    agent_name: agentName
                  })
                  .eq('id', conflictCustomer.id);

                if (updateError) {
                  console.error(`❌ Error updating conflicted ${email}:`, updateError.message);
                  errors++;
                } else {
                  console.log(`✅ Updated (conflict resolved): ${email} (AssocID ${associateId})`);
                  updated++;
                }
              } else {
                console.error(`❌ Insert conflict but couldn't find existing record for ${email}`);
                errors++;
              }
            } else {
              console.error(`❌ Error inserting ${email} (AssocID ${associateId}):`, insertError.message);
              errors++;
            }
          } else {
            console.log(`✅ Created: ${email} (AssocID ${associateId}) - ${agentName}`);
            created++;
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing row ${row.Email}:`, error.message);
        errors++;
      }
    }));

    // Small delay between batches
    if (i + BATCH_SIZE < records.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📋 Total: ${records.length}`);
}

// Run import
importActiveContracts().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
