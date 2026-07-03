/**
 * Check if carlosfarge@aoglobelife.com has multiple associate_ids
 */

import { supabaseAdmin } from './server/supabase';

async function checkCarlos() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  const email = 'carlosfarge@aoglobelife.com';

  console.log(`🔍 Checking for duplicate associate_ids for ${email}\n`);

  // Get all customers with this email
  const { data: customers, error } = await supabaseAdmin
    .from('customers')
    .select('id, associate_id, company_email, personal_email')
    .or(`company_email.eq.${email},personal_email.eq.${email}`);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`📊 Found ${customers?.length || 0} customer records with email ${email}\n`);

  if (customers && customers.length > 0) {
    customers.forEach((c, i) => {
      console.log(`${i + 1}. Customer ID: ${c.id}`);
      console.log(`   Associate ID: ${c.associate_id}`);
      console.log(`   Company Email: ${c.company_email || 'N/A'}`);
      console.log(`   Personal Email: ${c.personal_email || 'N/A'}`);
      console.log('');
    });

    // Get unique associate_ids
    const associateIds = [...new Set(customers.map(c => c.associate_id).filter(id => id))];
    
    if (associateIds.length > 1) {
      console.log(`\n❌ DUPLICATE ASSOCIATE IDs FOUND: ${associateIds.join(', ')}\n`);
      
      // Get billing transactions for all associate_ids
      for (const associateId of associateIds) {
        const { data: customersForId } = await supabaseAdmin
          .from('customers')
          .select('company_email, personal_email')
          .eq('associate_id', associateId);

        const emails = customersForId
          ?.map(c => [c.company_email, c.personal_email])
          .flat()
          .filter(e => e) as string[];

        if (emails.length > 0) {
          const { data: transactions } = await supabaseAdmin
            .from('billing_transactions')
            .select('transaction_id, agent_email, transaction_date, credits_charged')
            .in('agent_email', emails)
            .order('transaction_date', { ascending: false })
            .limit(5);

          console.log(`\nAssociate ID ${associateId}:`);
          console.log(`   Emails: ${emails.join(', ')}`);
          console.log(`   Sample transactions: ${transactions?.length || 0} (showing first 5)`);
        }
      }
    } else {
      console.log(`✅ Only one associate_id found: ${associateIds[0]}`);
    }
  }
}

checkCarlos().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
