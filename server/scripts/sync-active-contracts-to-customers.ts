/**
 * Sync Active Contracts Excel to customers table
 * Adds missing company emails, associate IDs, and names
 */

import { supabaseAdmin } from '../supabase.js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ContractRow {
  AssocID: number | string;
  Name: string;
  Contract?: string;
  Email: string;
  'Executive Producer'?: string;
}

function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length === 0) return { firstName: 'Agent', lastName: 'User' };
  if (parts.length === 1) return { firstName: parts[0], lastName: 'User' };
  return {
    firstName: parts[0] || 'Agent',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

const QUIET = process.argv.includes('--quiet');

async function syncActiveContractsToCustomers() {
  const excelPath = path.join(__dirname, '../../Active Contracts 1.30.26.xlsx');

  console.log('📊 Reading Active Contracts Excel...');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: ContractRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`✅ Parsed ${rows.length} rows\n`);

  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  for (const row of rows) {
    processed++;
    const associateId = row.AssocID != null ? String(row.AssocID).trim() : '';
    const companyEmail = row.Email?.trim().toLowerCase();
    const name = row.Name?.trim();

    if (!associateId || associateId === '0' || !companyEmail) {
      skipped++;
      continue;
    }

    const { firstName, lastName } = parseName(name || '');
    const agentName = name || `${firstName} ${lastName}`;

    try {
      // Find by company_email first
      let customer = null;
      const { data: byEmail } = await supabaseAdmin
        .from('customers')
        .select('id, company_email, personal_email, associate_id, first_name, last_name, agent_name')
        .eq('company_email', companyEmail)
        .maybeSingle();

      if (byEmail) customer = byEmail;

      // Try personal_email if not found
      if (!customer) {
        const { data: byPersonal } = await supabaseAdmin
          .from('customers')
          .select('id, company_email, personal_email, associate_id, first_name, last_name, agent_name')
          .eq('personal_email', companyEmail)
          .maybeSingle();
        if (byPersonal) customer = byPersonal;
      }

      // Try by associate_id
      if (!customer) {
        const { data: byAssoc } = await supabaseAdmin
          .from('customers')
          .select('id, company_email, personal_email, associate_id, first_name, last_name, agent_name')
          .eq('associate_id', associateId)
          .maybeSingle();
        if (byAssoc) customer = byAssoc;
      }

      if (!customer) {
        // Insert new customer
        const newCustomer = {
          company_email: companyEmail,
          personal_email: companyEmail,
          associate_id: parseInt(associateId) || associateId,
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
          created_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabaseAdmin
          .from('customers')
          .insert(newCustomer);

        if (insertError) {
          if (insertError.code === '23505') {
            // Unique constraint - try update by associate_id
            const { data: existing } = await supabaseAdmin
              .from('customers')
              .select('id')
              .eq('associate_id', associateId)
              .maybeSingle();
            if (existing) {
              const { error: updErr } = await supabaseAdmin
                .from('customers')
                .update({
                  company_email: companyEmail,
                  first_name: firstName,
                  last_name: lastName,
                  agent_name: agentName,
                })
                .eq('id', existing.id);
              if (!updErr) {
                if (!QUIET) console.log(`  ✅ Updated (dup): ${companyEmail} (${agentName})`);
                updated++;
              } else {
                console.error(`  ❌ Update failed ${companyEmail}:`, updErr.message);
                errors++;
              }
            } else {
              console.error(`  ❌ Insert conflict ${companyEmail}:`, insertError.message);
              errors++;
            }
          } else {
            console.error(`  ❌ Insert failed ${companyEmail}:`, insertError.message);
            errors++;
          }
        } else {
          if (!QUIET) console.log(`  ✅ Inserted: ${companyEmail} | ${associateId} | ${agentName}`);
          inserted++;
        }
        continue;
      }

      // Customer exists - update if missing data
      const updates: Record<string, unknown> = {};
      let needsUpdate = false;

      if (!customer.company_email || customer.company_email !== companyEmail) {
        updates.company_email = companyEmail;
        needsUpdate = true;
      }
      if (
        customer.associate_id === null ||
        String(customer.associate_id) !== String(associateId)
      ) {
        updates.associate_id = parseInt(associateId) || associateId;
        needsUpdate = true;
      }
      if (!customer.first_name || !customer.last_name) {
        updates.first_name = firstName;
        updates.last_name = lastName;
        needsUpdate = true;
      }
      if (!customer.agent_name) {
        updates.agent_name = agentName;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('customers')
          .update(updates)
          .eq('id', customer.id);

        if (updateError) {
          console.error(`  ❌ Update failed ${companyEmail}:`, updateError.message);
          errors++;
        } else {
          if (!QUIET) console.log(`  ✅ Updated: ${companyEmail} | ${associateId} | ${agentName}`);
          updated++;
        }
      } else {
        skipped++;
      }
      if (QUIET && processed % 500 === 0) {
        process.stdout.write(`  Progress: ${processed}/${rows.length} | +${inserted} inserted, ~${updated} updated, -${skipped} skipped\r`);
      }
    } catch (err: unknown) {
      console.error(`  ❌ Error ${companyEmail}:`, err);
      errors++;
    }
  }

  console.log('\n📊 SUMMARY:');
  console.log(`  ✅ Inserted: ${inserted}`);
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  Skipped (already complete): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📝 Total rows: ${rows.length}`);
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('sync-active-contracts-to-customers.ts');

if (isMain) {
  syncActiveContractsToCustomers()
    .then(() => {
      console.log('\n✅ Sync completed!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Sync failed:', err);
      process.exit(1);
    });
}

export { syncActiveContractsToCustomers };
