/**
 * Complete report on missing billing transactions for duplicate associate_id customers
 * Checks ALL emails (including deleted ones) for billing_transactions
 */

import { supabaseAdmin } from './server/supabase';

async function reportMissingTransactionsComplete() {
  console.log(`📊 Complete report on missing billing transactions for duplicate associate_id customers\n`);
  console.log('='.repeat(70));

  try {
    // Associate IDs that had duplicates with their emails (kept and deleted)
    const duplicateData: Array<{
      associate_id: number;
      kept_email: string;
      deleted_emails: string[];
    }> = [
      { associate_id: 221714, kept_email: 'hernanplazola@aoglobelife.com', deleted_emails: ['hernanplazola@aoglobelife.com', 'hernanplazola@aoglobelife.com'] },
      { associate_id: 130233, kept_email: 'andrewboston@aoglobelife.com', deleted_emails: ['andrewboston@aoglobelife.com', 'andrewboston@aoglobelife.com'] },
      { associate_id: 8675309, kept_email: 'barbjay@aoglobelife.com', deleted_emails: ['aointeldemo@aoglobelife.com', 'kassandraholley@aoglobelife.com'] },
      { associate_id: 223530, kept_email: 'julialeroy@aoglobelife.com', deleted_emails: ['juliaaleroy@aoglobelife.com'] },
      { associate_id: 210752, kept_email: 'jenniferbutters@aoglobelife.com', deleted_emails: ['jenniferbutters@aoglobelife.com'] },
      { associate_id: 135590, kept_email: 'brandonpleasant@aoglobelife.com', deleted_emails: ['brandonpleasant@aoglobelife.com'] },
      { associate_id: 152809, kept_email: 'kassandrafavre@aoglobelife.com', deleted_emails: ['kassandrafavre@aoglobelife.com'] },
      { associate_id: 163622, kept_email: 'chrislewis@aoglobelife.com', deleted_emails: ['chrislewis@aoglobelife.com'] },
      { associate_id: 181869, kept_email: 'dominiquewhite@aoglobelife.com', deleted_emails: ['dominiquewhite@aoglobelife.com'] },
      { associate_id: 202699, kept_email: 'garciarenee@aoglobelife.com', deleted_emails: ['garciarenee1@icloud.com'] },
      { associate_id: 167595, kept_email: 'jameshannah@aoglobelife.com', deleted_emails: ['hannahjames@aoglobelife.com'] },
      { associate_id: 197812, kept_email: 'rayespinal@aoglobelife.com', deleted_emails: ['rayespinal@aoglobelife.com'] },
      { associate_id: 150459, kept_email: 'dominiquebarelka@aoglobelife.com', deleted_emails: ['dominiquebarelka@aoglobelife.com'] },
      { associate_id: 191941, kept_email: 'jonathanstell@aoglobelife.com', deleted_emails: ['jonathanstell@aoglobelife.com'] },
      { associate_id: 106210, kept_email: 'firuchar2m@aoglobelife.com', deleted_emails: ['klang5454@yahoo.com'] },
      { associate_id: 214019, kept_email: 'muhammadzohaib@aoglobelife.com', deleted_emails: ['mohammadzohaib@aoglobelife.com'] }
    ];

    console.log(`📋 Checking ${duplicateData.length} associate_ids (all emails)\n`);

    const issues: Array<{
      associate_id: number;
      email: string;
      expectedCredits: number;
      actualCredits: number;
      missingCredits: number;
      transactionCount: number;
      hasUserCredits: boolean;
      isDeletedEmail: boolean;
    }> = [];

    for (const data of duplicateData) {
      // Check kept email
      const allEmails = [data.kept_email, ...data.deleted_emails];
      const uniqueEmails = [...new Set(allEmails)];

      for (const email of uniqueEmails) {
        const isDeletedEmail = data.deleted_emails.includes(email);

        // Get all billing_transactions for this email
        const { data: transactions } = await supabaseAdmin
          .from('billing_transactions')
          .select('agent_email, credits_charged, transaction_type, transaction_date')
          .eq('agent_email', email)
          .order('transaction_date', { ascending: false });

        if (!transactions || transactions.length === 0) {
          continue; // Skip if no transactions
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

        if (missingCredits > 0 || !userCredit) {
          issues.push({
            associate_id: data.associate_id,
            email,
            expectedCredits,
            actualCredits,
            missingCredits: missingCredits > 0 ? missingCredits : expectedCredits, // If no user_credits, all are missing
            transactionCount: transactions.length,
            hasUserCredits: !!userCredit,
            isDeletedEmail
          });
        }
      }
    }

    // Sort by missing credits (most missing first)
    issues.sort((a, b) => b.missingCredits - a.missingCredits);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n❌ FOUND ${issues.length} EMAILS WITH MISSING BILLING TRANSACTIONS:\n`);

    if (issues.length === 0) {
      console.log('✅ All customers have correct billing!');
    } else {
      let totalMissing = 0;
      let totalTransactions = 0;

      issues.forEach((issue, idx) => {
        const status = issue.isDeletedEmail ? '🗑️ DELETED EMAIL' : '✅ KEPT EMAIL';
        console.log(`${(idx + 1).toString().padStart(3)}. Associate ID: ${issue.associate_id} ${status}`);
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
      console.log(`   Emails with missing billing: ${issues.length}`);
      console.log(`   Total missing credits: ${totalMissing}`);
      console.log(`   Total billing transactions: ${totalTransactions}`);
      if (issues.length > 0) {
        console.log(`   Average missing per email: ${Math.round(totalMissing / issues.length)}`);
      }
      console.log(`\n${'='.repeat(70)}`);

      // Group by associate_id
      console.log(`\n📋 GROUPED BY ASSOCIATE_ID:\n`);

      const byAssociateId = new Map<number, typeof issues>();
      issues.forEach(issue => {
        if (!byAssociateId.has(issue.associate_id)) {
          byAssociateId.set(issue.associate_id, []);
        }
        byAssociateId.get(issue.associate_id)!.push(issue);
      });

      byAssociateId.forEach((emailIssues, associateId) => {
        const totalMissing = emailIssues.reduce((sum, i) => sum + i.missingCredits, 0);
        const totalTxn = emailIssues.reduce((sum, i) => sum + i.transactionCount, 0);
        
        console.log(`\nAssociate ID ${associateId}:`);
        console.log(`   Total missing credits: ${totalMissing}`);
        console.log(`   Total transactions: ${totalTxn}`);
        emailIssues.forEach(issue => {
          console.log(`   - ${issue.email} (${issue.isDeletedEmail ? 'DELETED' : 'KEPT'}): ${issue.missingCredits} missing from ${issue.transactionCount} transactions`);
        });
      });
    }

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

reportMissingTransactionsComplete()
  .then(() => {
    console.log('\n✅ Report complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Report failed:', error);
    process.exit(1);
  });
