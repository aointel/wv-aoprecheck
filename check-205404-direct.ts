/**
 * Check associate_id 205404 directly
 */

import { supabaseAdmin } from './server/supabase';

async function check205404() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  const associateId = 205404;

  console.log(`🔍 Checking associate_id ${associateId} directly...\n`);

  // Query directly for this associate_id
  const { data: customers, error } = await supabaseAdmin
    .from('customers')
    .select('id, associate_id, company_email, personal_email')
    .eq('associate_id', associateId);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`📊 Found ${customers?.length || 0} customer records with associate_id ${associateId}\n`);

  if (customers && customers.length > 0) {
    customers.forEach((c, i) => {
      console.log(`${i + 1}. Customer ID: ${c.id}`);
      console.log(`   Associate ID: ${c.associate_id}`);
      console.log(`   Company Email: ${c.company_email || 'N/A'}`);
      console.log(`   Personal Email: ${c.personal_email || 'N/A'}`);
      console.log('');
    });

    if (customers.length > 1) {
      console.log(`\n❌ DUPLICATE FOUND! ${customers.length} records with associate_id ${associateId}`);
    }
  } else {
    console.log('❌ No records found with associate_id 205404');
    
    // Try searching by email
    const email = 'carlosfarge@aoglobelife.com';
    console.log(`\n🔍 Searching by email ${email}...`);
    
    const { data: emailCustomers, error: emailError } = await supabaseAdmin
      .from('customers')
      .select('id, associate_id, company_email, personal_email')
      .or(`company_email.eq.${email},personal_email.eq.${email}`);

    if (emailError) {
      console.error('❌ Error:', emailError);
    } else {
      console.log(`📊 Found ${emailCustomers?.length || 0} records with email ${email}`);
      if (emailCustomers && emailCustomers.length > 0) {
        emailCustomers.forEach((c, i) => {
          console.log(`${i + 1}. Customer ID: ${c.id}`);
          console.log(`   Associate ID: ${c.associate_id}`);
          console.log(`   Company Email: ${c.company_email || 'N/A'}`);
          console.log(`   Personal Email: ${c.personal_email || 'N/A'}`);
          console.log('');
        });
      }
    }
  }
}

check205404().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
