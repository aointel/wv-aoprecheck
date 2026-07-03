/**
 * Test billing for jesserusso@aoglobelife.com
 * Checks why credits aren't being charged
 */

import { supabaseAdmin } from './server/supabase';

async function testJesserussoBilling() {
  const email = 'jesserusso@aoglobelife.com';
  console.log(`🧪 Testing billing for ${email}\n`);
  console.log('='.repeat(70));

  try {
    // Step 1: Get agent info from customers table
    console.log('\n📋 Step 1: Getting agent info from customers table...');
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('associate_id, company_email, personal_email, first_name, last_name')
      .or(`company_email.eq.${email},personal_email.eq.${email}`)
      .maybeSingle();

    if (customerError) {
      console.error('❌ Error fetching customer:', customerError);
      return;
    }

    if (!customer) {
      console.error(`❌ Customer not found for ${email}`);
      return;
    }

    console.log(`✅ Found customer:`, {
      associate_id: customer.associate_id,
      company_email: customer.company_email,
      personal_email: customer.personal_email,
      name: `${customer.first_name} ${customer.last_name}`
    });

    // Step 2: Check user_credits table
    console.log('\n💰 Step 2: Checking user_credits table...');
    const { data: userCredit, error: creditError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .or(`email.eq.${email},associate_id.eq.${customer.associate_id}`)
      .maybeSingle();

    if (creditError) {
      console.error('❌ Error fetching user_credits:', creditError);
    } else if (userCredit) {
      console.log(`✅ Found user_credits record:`, {
        email: userCredit.email,
        associate_id: userCredit.associate_id,
        credits_remaining: userCredit.credits_remaining,
        credits_used: userCredit.credits_used,
        credits_purchased: userCredit.credits_purchased,
        updated_at: userCredit.updated_at
      });
    } else {
      console.log(`⚠️ No user_credits record found for ${email}`);
    }

    // Step 3: Check recent billing_transactions
    console.log('\n📊 Step 3: Checking recent billing_transactions...');
    const { data: transactions, error: txnError } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('agent_email', email)
      .order('transaction_date', { ascending: false })
      .limit(20);

    if (txnError) {
      console.error('❌ Error fetching billing_transactions:', txnError);
    } else {
      console.log(`✅ Found ${transactions?.length || 0} recent billing transactions`);
      
      if (transactions && transactions.length > 0) {
        const byType = new Map<string, number>();
        transactions.forEach(t => {
          const type = t.transaction_type || 'unknown';
          byType.set(type, (byType.get(type) || 0) + 1);
        });
        
        console.log(`\n📊 Transaction breakdown:`);
        byType.forEach((count, type) => {
          console.log(`   ${type}: ${count}`);
        });

        console.log(`\n📋 Recent transactions:`);
        transactions.slice(0, 10).forEach((t, i) => {
          console.log(`   ${i + 1}. ${t.transaction_type} | $${t.amount_usd} | ${t.credits_charged} credits | ${t.transaction_date} | ${t.lead_name || 'N/A'}`);
        });
      } else {
        console.log(`⚠️ No billing transactions found for ${email}`);
      }
    }

    // Step 4: Check vdp_calls for recent connects
    console.log('\n📞 Step 4: Checking vdp_calls for recent connects...');
    const { data: vdpCalls, error: vdpError } = await supabaseAdmin
      .from('vdp_calls')
      .select('id, company_email, phone, first_name, last_name, updated_at, time')
      .eq('company_email', email)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (vdpError) {
      console.error('❌ Error fetching vdp_calls:', vdpError);
    } else {
      console.log(`✅ Found ${vdpCalls?.length || 0} recent vdp_calls`);
      
      if (vdpCalls && vdpCalls.length > 0) {
        console.log(`\n📋 Recent vdp_calls:`);
        vdpCalls.slice(0, 10).forEach((call, i) => {
          console.log(`   ${i + 1}. ID: ${call.id} | ${call.updated_at || call.time} | ${call.first_name || ''} ${call.last_name || ''} | ${call.phone || 'N/A'}`);
        });

        // Check if these have corresponding billing_transactions
        console.log(`\n🔍 Checking if vdp_calls have billing_transactions...`);
        const vdpCallIds = vdpCalls.map(c => c.id).filter(id => id != null);
        if (vdpCallIds.length > 0) {
          const { data: correspondingTxns } = await supabaseAdmin
            .from('billing_transactions')
            .select('transaction_id, source_id, transaction_type, transaction_date')
            .in('source_id', vdpCallIds)
            .eq('source_table', 'vdp_calls');

          const vdpCallIdsWithTxns = new Set(correspondingTxns?.map(t => t.source_id) || []);
          const missingTxns = vdpCallIds.filter(id => !vdpCallIdsWithTxns.has(id));
          
          console.log(`   ✅ ${vdpCallIdsWithTxns.size} vdp_calls have billing_transactions`);
          if (missingTxns.length > 0) {
            console.log(`   ❌ ${missingTxns.length} vdp_calls are MISSING billing_transactions:`);
            missingTxns.slice(0, 10).forEach(id => {
              const call = vdpCalls.find(c => c.id === id);
              console.log(`      - vdp_calls.id=${id} | ${call?.updated_at || call?.time || 'N/A'}`);
            });
          }
        }
      }
    }

    // Step 5: Check credit_service agent_credits table (PostgreSQL)
    console.log('\n💳 Step 5: Checking agent_credits in PostgreSQL...');
    // This would require direct DB access, but we can check if there's a way to query it

    // Step 6: Check if there are any errors in the logs or issues
    console.log('\n🔍 Step 6: Summary...');
    console.log(`\n📊 BILLING STATUS FOR ${email}:`);
    console.log(`   Associate ID: ${customer.associate_id}`);
    console.log(`   User Credits Record: ${userCredit ? 'EXISTS' : 'MISSING'}`);
    console.log(`   Credits Remaining: ${userCredit?.credits_remaining || 'N/A'}`);
    console.log(`   Recent Billing Transactions: ${transactions?.length || 0}`);
    console.log(`   Recent VDP Calls: ${vdpCalls?.length || 0}`);
    
    if (vdpCalls && vdpCalls.length > 0 && transactions && transactions.length === 0) {
      console.log(`\n❌ PROBLEM DETECTED: Has vdp_calls but NO billing_transactions!`);
      console.log(`   This means connects are happening but credits aren't being charged.`);
    }

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run the test
testJesserussoBilling()
  .then(() => {
    console.log('\n✅ Billing test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Billing test failed:', error);
    process.exit(1);
  });
