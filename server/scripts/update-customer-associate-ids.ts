import { supabaseAdmin } from '../supabase.js';

interface EmailToAssociateId {
  email: string;
  associateId: string;
  note?: string;
}

// Email mappings from CSV - only the ones we can match
const emailUpdates: EmailToAssociateId[] = [
  { email: 'brendanjones@aoglobelife.com', associateId: '201723', note: 'jonesbrendan@aoglobelife.com in CSV' },
  { email: 'alexandernuaman@aoglobelife.com', associateId: '222493', note: 'alexnuaman@aoglobelife.com in CSV' },
  { email: 'kechatripp@aoglobelife.com', associateId: '224836', note: 'lakechatripp@aoglobelife.com in CSV' },
  { email: 'miaswenson@aoglobelife.com', associateId: '183065', note: 'miaaswenson@aoglobelife.com in CSV' },
  { email: 'terrysteven@aoglobelife.com', associateId: '226180', note: 'steventerry@aoglobelife.com in CSV' },
  { email: 'wilmerfernandez@aoglobelife.com', associateId: '218218', note: 'wilmersfernandez@aoglobelife.com in CSV' },
];

async function updateCustomerAssociateIds() {
  console.log('🚀 Starting customer associate_id updates...\n');

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const { email, associateId, note } of emailUpdates) {
    try {
      console.log(`📧 Updating ${email} -> associate_id: ${associateId}${note ? ` (${note})` : ''}`);
      
      // Try to update by company_email first
      const { data: companyData, error: companyError } = await supabaseAdmin
        .from('customers')
        .update({ associate_id: associateId })
        .or(`company_email.eq.${email},personal_email.eq.${email}`)
        .select('id, company_email, personal_email, associate_id');

      if (companyError) {
        console.error(`  ❌ Error updating ${email}:`, companyError.message);
        errors++;
        continue;
      }

      if (companyData && companyData.length > 0) {
        console.log(`  ✅ Updated ${companyData.length} record(s) for ${email}`);
        companyData.forEach(record => {
          console.log(`     - ID: ${record.id}, Email: ${record.company_email || record.personal_email}, New Associate ID: ${record.associate_id}`);
        });
        updated += companyData.length;
      } else {
        console.log(`  ⚠️  No records found for ${email}`);
        notFound++;
      }
    } catch (error) {
      console.error(`  ❌ Exception updating ${email}:`, error);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Updated: ${updated} records`);
  console.log(`  ⚠️  Not found: ${notFound} emails`);
  console.log(`  ❌ Errors: ${errors} emails`);

  // Show final state
  console.log('\n📋 Final state of updated records:');
  const emails = emailUpdates.map(e => e.email);
  const { data: finalData } = await supabaseAdmin
    .from('customers')
    .select('id, company_email, personal_email, associate_id, first_name, last_name')
    .or(`company_email.in.(${emails.join(',')}),personal_email.in.(${emails.join(',')})`);

  if (finalData && finalData.length > 0) {
    finalData.forEach(record => {
      const email = record.company_email || record.personal_email;
      console.log(`  - ${email}: associate_id = ${record.associate_id} (${record.first_name} ${record.last_name})`);
    });
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('update-customer-associate-ids.ts');
if (isMainModule) {
  updateCustomerAssociateIds()
    .then(() => {
      console.log('\n✅ Update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Update failed:', error);
      process.exit(1);
    });
}

export { updateCustomerAssociateIds };
