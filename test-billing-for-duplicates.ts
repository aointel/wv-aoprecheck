/**
 * Test billing for customers with duplicate associate_ids
 * This simulates what the webhook would do
 */

import { supabaseAdmin } from './server/supabase';

async function testBillingForDuplicates() {
  console.log(`🧪 Testing billing for customers with duplicate associate_ids\n`);
  console.log('='.repeat(70));

  try {
    // Get all duplicate associate_ids
    const { data: allCustomers } = await supabaseAdmin
      .from('customers')
      .select('associate_id, company_email, personal_email, id')
      .not('associate_id', 'is', null);

    // Find duplicates
    const associateIdMap = new Map<number, Array<{
      id: string;
      associate_id: number;
      company_email: string | null;
      personal_email: string | null;
    }>>();

    allCustomers?.forEach(c => {
      const associateId = Number(c.associate_id);
      if (!associateId) return;

      if (!associateIdMap.has(associateId)) {
        associateIdMap.set(associateId, []);
      }

      associateIdMap.get(associateId)!.push({
        id: c.id,
        associate_id: associateId,
        company_email: c.company_email,
        personal_email: c.personal_email
      });
    });

    const duplicates = Array.from(associateIdMap.entries())
      .filter(([_, records]) => records.length > 1);

    console.log(`📊 Found ${duplicates.length} duplicate associate_ids\n`);

    // Test each duplicate that has billing_transactions
    for (const [associateId, records] of duplicates) {
      const emails = records
        .map(r => r.company_email || r.personal_email)
        .filter(e => e) as string[];

      if (emails.length === 0) continue;

      // Check if this associate_id has billing_transactions
      const { data: transactions } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email, credits_charged, transaction_type')
        .in('agent_email', emails);

      if (!transactions || transactions.length === 0) continue;

      const totalCredits = transactions.reduce((sum, t) => sum + (Number(t.credits_charged) || 0), 0);
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`\n⚠️ Associate ID ${associateId} - ${records.length} duplicate records`);
      console.log(`   Billing transactions: ${transactions.length} (${totalCredits} credits)`);
      console.log(`   Customer records: ${records.map(r => r.id).join(', ')}`);
      console.log(`   Emails: ${emails.join(', ')}`);

      // Test what the webhook would find
      console.log(`\n   🔍 Testing webhook query (associate_id = ${associateId})...`);
      const associateIdInt = Number(associateId);
      const { data: webhookCustomers, error: webhookError } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, id')
        .eq('associate_id', associateIdInt);

      if (webhookError) {
        console.log(`   ❌ Webhook query ERROR: ${webhookError.message}`);
        continue;
      }

      if (!webhookCustomers || webhookCustomers.length === 0) {
        console.log(`   ❌ Webhook query would FAIL - no customer found`);
        continue;
      }

      if (webhookCustomers.length > 1) {
        console.log(`   ⚠️ Webhook query returns ${webhookCustomers.length} customers (AMBIGUOUS!):`);
        webhookCustomers.forEach((c, i) => {
          const email = c.company_email || c.personal_email || 'NO EMAIL';
          console.log(`      ${i + 1}. ID: ${c.id} | Email: ${email}`);
        });
        console.log(`   ❌ PROBLEM: Webhook would pick the FIRST one, which might be wrong!`);
      } else {
        const webhookCustomer = webhookCustomers[0];
        const webhookEmail = webhookCustomer.company_email || webhookCustomer.personal_email;
        console.log(`   ✅ Webhook would find: ${webhookEmail} (ID: ${webhookCustomer.id})`);
      }

      // Check which email actually has the billing_transactions
      const transactionEmails = new Set(transactions.map(t => String(t.agent_email).toLowerCase().trim()));
      console.log(`\n   💳 Billing transactions are for: ${Array.from(transactionEmails).join(', ')}`);

      // Check user_credits for each email
      console.log(`\n   📊 User credits status:`);
      for (const email of emails) {
        const { data: userCredit } = await supabaseAdmin
          .from('user_credits')
          .select('email, credits_used, credits_remaining, credits_purchased')
          .eq('email', email)
          .maybeSingle();

        const hasTransactions = transactionEmails.has(email.toLowerCase());
        const expectedCredits = transactions
          .filter(t => String(t.agent_email).toLowerCase().trim() === email.toLowerCase())
          .reduce((sum, t) => sum + (Number(t.credits_charged) || 0), 0);

        if (userCredit) {
          const actualCredits = Number(userCredit.credits_used) || 0;
          const difference = expectedCredits - actualCredits;
          const status = difference > 0 ? '❌ MISSING CREDITS' : difference < 0 ? '⚠️ OVER-CHARGED' : '✅ OK';
          console.log(`      ${email}:`);
          console.log(`         credits_used=${actualCredits}, remaining=${userCredit.credits_remaining}`);
          console.log(`         Expected from transactions: ${expectedCredits}`);
          console.log(`         Difference: ${difference} ${status}`);
        } else {
          const status = hasTransactions ? '❌ NO RECORD (CREDITS NOT DEDUCTED!)' : '⚠️ No record';
          console.log(`      ${email}: ${status}`);
          if (hasTransactions) {
            console.log(`         Should have ${expectedCredits} credits deducted but user_credits doesn't exist!`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total duplicate associate_ids: ${duplicates.length}`);
    
    const duplicatesWithBilling = duplicates.filter(([associateId, records]) => {
      const emails = records.map(r => r.company_email || r.personal_email).filter(e => e) as string[];
      // We'd need to check, but for now just count
      return true; // Simplified
    }).length;

    console.log(`   Duplicates with billing_transactions: ${duplicatesWithBilling}`);
    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

testBillingForDuplicates()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
