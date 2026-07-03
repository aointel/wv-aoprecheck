/**
 * Report missing billing transactions for customers who had duplicate associate_ids
 * These are CHARGES - credits_used should match sum of credits_charged from billing_transactions
 */

import { supabaseAdmin } from './server/supabase';

async function reportMissingTransactions() {
  console.log(`📊 Reporting missing billing transactions for duplicate associate_id customers\n`);
  console.log('='.repeat(70));

  try {
    // Associate IDs that had duplicates (from the cleanup we just did)
    const duplicateAssociateIds = [
      221714, 130233, 8675309, 223530, 210752, 135590, 152809, 163622,
      181869, 202699, 167595, 197812, 150459, 191941, 106210, 214019
    ];

    console.log(`📋 Checking ${duplicateAssociateIds.length} associate_ids that had duplicates\n`);

    const issues: Array<{
      associate_id: number;
      email: string;
      expectedCredits: number;
      actualCredits: number;
      missingCredits: number;
      transactionCount: number;
      hasUserCredits: boolean;
    }> = [];

    for (const associateId of duplicateAssociateIds) {
      // Get the customer record (should only be one now)
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id, associate_id, company_email, personal_email')
        .eq('associate_id', associateId)
        .limit(1);

      if (!customers || customers.length === 0) {
        console.log(`⚠️ No customer found for associate_id ${associateId}`);
        continue;
      }

      const customer = customers[0];
      const email = customer.company_email || customer.personal_email;

      if (!email) {
        console.log(`⚠️ No email for associate_id ${associateId}`);
        continue;
      }

      // Get all billing_transactions for this email
      const { data: transactions } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email, credits_charged, transaction_type, transaction_date')
        .eq('agent_email', email)
        .order('transaction_date', { ascending: false });

      if (!transactions || transactions.length === 0) {
        console.log(`⚠️ No billing_transactions for ${email} (associate_id: ${associateId})`);
        continue;
      }

      // Calculate expected credits_used (sum of all credits_charged)
      const expectedCredits = transactions.reduce((sum, t) => {
        return sum + (Number(t.credits_charged) || 0);
      }, 0);

      // Get actual credits_used from user_credits
      const { data: userCredit } = await supabaseAdmin
        .from('user_credits')
        .select('email, credits_used, credits_remaining, credits_purchased')
        .eq('email', email)
        .maybeSingle();

      const actualCredits = userCredit ? (Number(userCredit.credits_used) || 0) : 0;
      const missingCredits = expectedCredits - actualCredits;

      if (missingCredits > 0) {
        issues.push({
          associate_id: associateId,
          email,
          expectedCredits,
          actualCredits,
          missingCredits,
          transactionCount: transactions.length,
          hasUserCredits: !!userCredit
        });
      }
    }

    // Sort by missing credits (most missing first)
    issues.sort((a, b) => b.missingCredits - a.missingCredits);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n❌ FOUND ${issues.length} CUSTOMERS WITH MISSING BILLING TRANSACTIONS:\n`);

    if (issues.length === 0) {
      console.log('✅ All customers have correct billing!');
    } else {
      let totalMissing = 0;
      let totalTransactions = 0;

      issues.forEach((issue, idx) => {
        console.log(`${(idx + 1).toString().padStart(3)}. Associate ID: ${issue.associate_id}`);
        console.log(`     Email: ${issue.email}`);
        console.log(`     Billing Transactions: ${issue.transactionCount}`);
        console.log(`     Expected credits_used: ${issue.expectedCredits}`);
        console.log(`     Actual credits_used: ${issue.actualCredits}`);
        console.log(`     ❌ MISSING: ${issue.missingCredits} credits`);
        console.log(`     Has user_credits record: ${issue.hasUserCredits ? 'YES' : 'NO'}`);
        console.log('');

        totalMissing += issue.missingCredits;
        totalTransactions += issue.transactionCount;
      });

      console.log(`${'='.repeat(70)}`);
      console.log(`\n📊 SUMMARY:`);
      console.log(`   Customers with missing billing: ${issues.length}`);
      console.log(`   Total missing credits: ${totalMissing}`);
      console.log(`   Total billing transactions: ${totalTransactions}`);
      console.log(`   Average missing per customer: ${Math.round(totalMissing / issues.length)}`);
      console.log(`\n${'='.repeat(70)}`);

      // Detailed breakdown by transaction type
      console.log(`\n📋 DETAILED BREAKDOWN BY TRANSACTION TYPE:\n`);

      for (const issue of issues) {
        const { data: transactions } = await supabaseAdmin
          .from('billing_transactions')
          .select('transaction_type, credits_charged')
          .eq('agent_email', issue.email);

        if (transactions) {
          const byType = new Map<string, number>();
          transactions.forEach(t => {
            const type = t.transaction_type || 'unknown';
            const credits = Number(t.credits_charged) || 0;
            byType.set(type, (byType.get(type) || 0) + credits);
          });

          console.log(`\n${issue.email} (associate_id: ${issue.associate_id}):`);
          byType.forEach((credits, type) => {
            console.log(`   ${type}: ${credits} credits`);
          });
        }
      }
    }

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

reportMissingTransactions()
  .then(() => {
    console.log('\n✅ Report complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Report failed:', error);
    process.exit(1);
  });
