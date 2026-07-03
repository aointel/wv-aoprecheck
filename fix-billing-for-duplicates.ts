/**
 * Fix billing for customers with duplicate associate_ids
 * Bills the correct email based on billing_transactions
 */

import { supabaseAdmin } from './server/supabase';

async function fixBillingForDuplicates() {
  console.log(`🔧 Fixing billing for customers with duplicate associate_ids\n`);
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

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    // Fix billing for each duplicate that has billing_transactions
    for (const [associateId, records] of duplicates) {
      const emails = records
        .map(r => r.company_email || r.personal_email)
        .filter(e => e) as string[];

      if (emails.length === 0) continue;

      // Get billing_transactions for these emails
      const { data: transactions } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email, credits_charged, transaction_type')
        .in('agent_email', emails);

      if (!transactions || transactions.length === 0) {
        skipped++;
        continue;
      }

      // Group transactions by email
      const transactionsByEmail = new Map<string, {
        totalCredits: number;
        connectCredits: number;
        missedCallCredits: number;
        recruitCredits: number;
        precheckCredits: number;
        transactionCount: number;
      }>();

      transactions.forEach(t => {
        const email = String(t.agent_email).toLowerCase().trim();
        if (!email) return;

        const credits = Number(t.credits_charged) || 0;

        if (!transactionsByEmail.has(email)) {
          transactionsByEmail.set(email, {
            totalCredits: 0,
            connectCredits: 0,
            missedCallCredits: 0,
            recruitCredits: 0,
            precheckCredits: 0,
            transactionCount: 0
          });
        }

        const stats = transactionsByEmail.get(email)!;
        stats.totalCredits += credits;
        stats.transactionCount++;

        switch (t.transaction_type) {
          case 'connect':
            stats.connectCredits += credits;
            break;
          case 'missed_call':
            stats.missedCallCredits += credits;
            break;
          case 'recruit':
            stats.recruitCredits += credits;
            break;
          case 'precheck':
            stats.precheckCredits += credits;
            break;
        }
      });

      // Fix billing for each email that has transactions
      for (const [email, expected] of transactionsByEmail.entries()) {
        console.log(`\n${'='.repeat(70)}`);
        console.log(`\n💳 Fixing billing for ${email} (associate_id: ${associateId})`);
        console.log(`   Expected credits: ${expected.totalCredits} (${expected.transactionCount} transactions)`);

        // Get current user_credits
        const { data: userCredit } = await supabaseAdmin
          .from('user_credits')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (!userCredit) {
          console.log(`   ⚠️ No user_credits record found - creating one...`);
          
          // Try to get credits_purchased from another email or set to 0
          const { data: anyCredit } = await supabaseAdmin
            .from('user_credits')
            .select('credits_purchased')
            .in('email', emails)
            .limit(1)
            .maybeSingle();

          const creditsPurchased = Number(anyCredit?.credits_purchased) || 0;

          const { data: newCredit, error: createError } = await supabaseAdmin
            .from('user_credits')
            .insert({
              email,
              credits_purchased: creditsPurchased,
              credits_used: expected.totalCredits,
              aoi_connect_credits_used: expected.connectCredits,
              aoi_recruit_credits_used: expected.recruitCredits > 0 ? expected.recruitCredits : undefined,
              aoi_precheck_credits_used: expected.precheckCredits > 0 ? expected.precheckCredits : undefined,
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) {
            console.log(`   ❌ Error creating user_credits: ${createError.message}`);
            errors++;
            continue;
          }

          console.log(`   ✅ Created user_credits: credits_used=${newCredit.credits_used}, remaining=${newCredit.credits_remaining}`);
          fixed++;
          continue;
        }

        const currentCreditsUsed = Number(userCredit.credits_used) || 0;
        const difference = expected.totalCredits - currentCreditsUsed;

        if (difference === 0) {
          console.log(`   ✅ Already correct: credits_used=${currentCreditsUsed}`);
          skipped++;
          continue;
        }

        console.log(`   Current: credits_used=${currentCreditsUsed}, remaining=${userCredit.credits_remaining}`);
        console.log(`   Updating to: credits_used=${expected.totalCredits}`);

        const updateData: any = {
          credits_used: expected.totalCredits,
          aoi_connect_credits_used: expected.connectCredits,
          updated_at: new Date().toISOString()
        };

        if (expected.recruitCredits > 0) {
          updateData.aoi_recruit_credits_used = expected.recruitCredits;
        }
        if (expected.precheckCredits > 0) {
          updateData.aoi_precheck_credits_used = expected.precheckCredits;
        }

        const { data: updated, error: updateError } = await supabaseAdmin
          .from('user_credits')
          .update(updateData)
          .eq('email', email)
          .select()
          .single();

        if (updateError) {
          console.log(`   ❌ Error updating user_credits: ${updateError.message}`);
          errors++;
          continue;
        }

        console.log(`   ✅ Updated: credits_used=${currentCreditsUsed} -> ${updated.credits_used}, remaining=${userCredit.credits_remaining} -> ${updated.credits_remaining}`);
        fixed++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total duplicate associate_ids: ${duplicates.length}`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

fixBillingForDuplicates()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
