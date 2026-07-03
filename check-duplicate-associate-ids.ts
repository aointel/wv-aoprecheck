/**
 * Check customers table for duplicate associate_ids
 * This is likely the root cause of billing issues
 */

import { supabaseAdmin } from './server/supabase';

async function checkDuplicateAssociateIds() {
  console.log(`🔍 Checking customers table for duplicate associate_ids\n`);
  console.log('='.repeat(70));

  try {
    // Get all customers with associate_id
    console.log('\n📊 Fetching all customers with associate_id...');
    
    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('associate_id, company_email, personal_email, id')
      .not('associate_id', 'is', null);

    if (error) {
      console.error('❌ Error fetching customers:', error);
      return;
    }

    console.log(`✅ Found ${customers?.length || 0} customers with associate_id`);

    // Find duplicates
    const associateIdMap = new Map<number, Array<{
      id: number;
      associate_id: number;
      company_email: string | null;
      personal_email: string | null;
    }>>();

    customers?.forEach(c => {
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

    // Filter to only duplicates
    const duplicates = Array.from(associateIdMap.entries())
      .filter(([_, records]) => records.length > 1)
      .sort((a, b) => b[1].length - a[1].length); // Sort by count

    console.log(`\n❌ Found ${duplicates.length} duplicate associate_ids:\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    // Show all duplicates
    duplicates.forEach(([associateId, records], idx) => {
      console.log(`\n${(idx + 1).toString().padStart(3)}. Associate ID: ${associateId} (${records.length} records)`);
      records.forEach((r, i) => {
        const email = r.company_email || r.personal_email || 'NO EMAIL';
        console.log(`     ${i + 1}. ID: ${r.id} | Email: ${email}`);
      });
    });

    // Check which ones have billing_transactions
    console.log(`\n\n💳 Checking which duplicates have billing_transactions...\n`);
    console.log('='.repeat(70));

    for (const [associateId, records] of duplicates.slice(0, 20)) {
      const emails = records
        .map(r => r.company_email || r.personal_email)
        .filter(e => e) as string[];

      if (emails.length === 0) continue;

      const { data: transactions } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email, credits_charged, transaction_type')
        .in('agent_email', emails);

      if (transactions && transactions.length > 0) {
        const totalCredits = transactions.reduce((sum, t) => sum + (Number(t.credits_charged) || 0), 0);
        console.log(`\n⚠️ Associate ID ${associateId} has ${transactions.length} billing transactions (${totalCredits} credits)`);
        console.log(`   Records: ${records.map(r => r.id).join(', ')}`);
        console.log(`   Emails: ${emails.join(', ')}`);
        
        // Check user_credits for each email
        for (const email of emails) {
          const { data: userCredit } = await supabaseAdmin
            .from('user_credits')
            .select('email, credits_used, credits_remaining')
            .eq('email', email)
            .maybeSingle();

          if (userCredit) {
            console.log(`   ${email}: credits_used=${userCredit.credits_used}, remaining=${userCredit.credits_remaining}`);
          } else {
            console.log(`   ${email}: NO user_credits record`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total customers with associate_id: ${customers?.length || 0}`);
    console.log(`   Unique associate_ids: ${associateIdMap.size}`);
    console.log(`   Duplicate associate_ids: ${duplicates.length}`);
    console.log(`   Total duplicate records: ${duplicates.reduce((sum, [_, records]) => sum + records.length, 0)}`);

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

checkDuplicateAssociateIds()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
