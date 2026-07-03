/**
 * Find customers with billing_transactions but credits not deducted
 * Then test billing for them
 */

import { supabaseAdmin } from './server/supabase';

async function findAndTestBillingIssues() {
  console.log(`🔍 Finding customers with billing_transactions but credits not deducted\n`);
  console.log('='.repeat(70));

  try {
    // Step 1: Get all customers with billing_transactions (PAGINATE to get ALL)
    console.log('\n📊 Step 1: Finding customers with billing_transactions...');
    
    const allTransactions: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: txnError } = await supabaseAdmin
        .from('billing_transactions')
        .select('agent_email, transaction_type, credits_charged')
        .not('agent_email', 'is', null)
        .neq('agent_email', '')
        .order('transaction_date', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (txnError) {
        console.error('❌ Error fetching billing_transactions:', txnError);
        break;
      }

      if (batch && batch.length > 0) {
        allTransactions.push(...batch);
        offset += batchSize;
        
        if (batch.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    if (txnError) {
      console.error('❌ Error fetching billing_transactions:', txnError);
      return;
    }

    console.log(`✅ Found ${allTransactions?.length || 0} total billing transactions`);

    // Step 2: Calculate expected credits_used per email
    const expectedCreditsByEmail = new Map<string, {
      totalCredits: number;
      connectCredits: number;
      missedCallCredits: number;
      recruitCredits: number;
      precheckCredits: number;
      transactionCount: number;
    }>();

    allTransactions.forEach(t => {
      const email = String(t.agent_email).toLowerCase().trim();
      if (!email) return;

      const credits = Number(t.credits_charged) || 0;
      
      if (!expectedCreditsByEmail.has(email)) {
        expectedCreditsByEmail.set(email, {
          totalCredits: 0,
          connectCredits: 0,
          missedCallCredits: 0,
          recruitCredits: 0,
          precheckCredits: 0,
          transactionCount: 0
        });
      }

      const stats = expectedCreditsByEmail.get(email)!;
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

    console.log(`📊 Found ${expectedCreditsByEmail.size} unique agents with billing transactions`);
    
    if (allTransactions.length === 0) {
      console.log('⚠️ No billing transactions found');
      return;
    }

    // Step 3: Get actual credits_used from user_credits
    console.log('\n📊 Step 2: Comparing with user_credits...');
    
    const emails = Array.from(expectedCreditsByEmail.keys());
    const emailBatchSize = 100;
    const issues: Array<{
      email: string;
      expectedCredits: number;
      actualCredits: number;
      difference: number;
      transactionCount: number;
    }> = [];

    for (let i = 0; i < emails.length; i += emailBatchSize) {
      const batch = emails.slice(i, i + emailBatchSize);
      
      const { data: userCredits } = await supabaseAdmin
        .from('user_credits')
        .select('email, credits_used, credits_purchased, credits_remaining')
        .in('email', batch);

      if (userCredits) {
        userCredits.forEach(uc => {
          const email = String(uc.email).toLowerCase().trim();
          const expected = expectedCreditsByEmail.get(email);
          if (!expected) return;

          const actualCredits = Number(uc.credits_used) || 0;
          const difference = expected.totalCredits - actualCredits;

          if (difference > 0) {
            issues.push({
              email,
              expectedCredits: expected.totalCredits,
              actualCredits,
              difference,
              transactionCount: expected.transactionCount
            });
          }
        });
      }
    }

    console.log(`\n❌ Found ${issues.length} customers with billing discrepancies:\n`);

    // Sort by difference (biggest issues first)
    issues.sort((a, b) => b.difference - a.difference);

    // Show top 20
    issues.slice(0, 20).forEach((issue, i) => {
      console.log(`${(i + 1).toString().padStart(3)}. ${issue.email.padEnd(40)} | Expected: ${issue.expectedCredits.toString().padStart(5)} | Actual: ${issue.actualCredits.toString().padStart(5)} | Missing: ${issue.difference.toString().padStart(5)} credits | ${issue.transactionCount} transactions`);
    });

    if (issues.length > 20) {
      console.log(`\n... and ${issues.length - 20} more customers with issues`);
    }

    // Step 4: Test billing for the top 5
    console.log(`\n\n🧪 Testing billing for top 5 customers...\n`);
    console.log('='.repeat(70));

    for (const issue of issues.slice(0, 5)) {
      console.log(`\n💳 Testing billing for ${issue.email}...`);
      
      const expected = expectedCreditsByEmail.get(issue.email);
      if (!expected) continue;

      // Get customer to find associate_id
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('associate_id, company_email, personal_email')
        .or(`company_email.eq.${issue.email},personal_email.eq.${issue.email}`)
        .maybeSingle();

      if (!customer) {
        console.log(`   ⚠️ Customer not found in customers table`);
        continue;
      }

      const associateId = customer.associate_id;
      if (!associateId) {
        console.log(`   ⚠️ No associate_id found`);
        continue;
      }

      console.log(`   ✅ Found: associate_id=${associateId}`);

      // Test the webhook query
      const associateIdInt = Number(associateId);
      const { data: testCustomer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id')
        .eq('associate_id', associateIdInt);

      if (testCustomer && testCustomer.length > 0) {
        const testCustomerData = testCustomer.find(c => c.company_email) || testCustomer.find(c => c.personal_email) || testCustomer[0];
        console.log(`   ✅ Webhook query would find: ${testCustomerData.company_email || testCustomerData.personal_email}`);
      } else {
        console.log(`   ❌ Webhook query would FAIL (no customer found)`);
      }

      // Check user_credits
      const { data: testCredits } = await supabaseAdmin
        .from('user_credits')
        .select('email, credits_used, credits_remaining')
        .eq('email', issue.email)
        .maybeSingle();

      if (testCredits) {
        console.log(`   📊 Current credits_used: ${testCredits.credits_used}, remaining: ${testCredits.credits_remaining}`);
        console.log(`   📊 Should be: credits_used=${expected.totalCredits}, remaining=${(testCredits.credits_remaining || 0) + (expected.totalCredits - (testCredits.credits_used || 0))}`);
      } else {
        console.log(`   ⚠️ No user_credits record found`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total customers with billing_transactions: ${expectedCreditsByEmail.size}`);
    console.log(`   Customers with credit discrepancies: ${issues.length}`);
    console.log(`   Total missing credits: ${issues.reduce((sum, i) => sum + i.difference, 0)}`);

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

findAndTestBillingIssues()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });
