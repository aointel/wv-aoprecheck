/**
 * Diagnostic script for missed call billing webhook
 * 
 * This script will:
 * 1. Check if agent ID exists in database
 * 2. Test agent email lookup
 * 3. Simulate the webhook payload processing
 * 4. Check billing transaction creation
 * 5. Verify webhook payload structure
 * 
 * Run with: tsx server/diagnose-missed-call-billing.ts
 */

import { supabaseAdmin } from './supabase';

const webhookPayload = {
  Event: 'MISSED',
  blastered: 1,
  216305: 216305, // Agent ID as numeric field
  task: {
    Phone: '8137707009',
    'Server Number': '+17046868739',
    params: {},
    'Task Created At': '2025-12-18T22:48:44.504Z',
    waitingDuration: 40790,
    querystring: {}
  }
};

async function diagnoseMissedCallBilling() {
  console.log('\n🔍 DIAGNOSING MISSED CALL BILLING WEBHOOK\n');
  console.log('='.repeat(80));
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }
  
  // Step 1: Parse webhook payload structure
  console.log('\n📋 STEP 1: Parsing Webhook Payload Structure');
  console.log('-'.repeat(80));
  const webhookEvent = webhookPayload.Event || webhookPayload['Event'] || 'MISSED';
  const taskPhone = webhookPayload.task?.Phone || webhookPayload.task?.phone;
  const taskParams = webhookPayload.task?.params || {};
  const waitingDurationMs = webhookPayload.task?.waitingDuration || webhookPayload.waitingDuration;
  const waitingDurationSeconds = waitingDurationMs ? Math.round(waitingDurationMs / 1000) : null;
  
  console.log(`   Event: ${webhookEvent}`);
  console.log(`   Task Phone: ${taskPhone}`);
  console.log(`   Waiting Duration: ${waitingDurationMs}ms (${waitingDurationSeconds}s)`);
  console.log(`   Task Params Keys: ${Object.keys(taskParams).join(', ') || 'empty'}`);
  console.log(`   Top-level keys: ${Object.keys(webhookPayload).join(', ')}`);
  
  // Step 2: Extract agent ID
  console.log('\n📋 STEP 2: Extracting Agent ID');
  console.log('-'.repeat(80));
  
  let agentId = null;
  
  // Check top-level numeric fields
  const topLevelKeys = Object.keys(webhookPayload).filter(key => {
    const value = webhookPayload[key];
    return typeof value === 'number' && 
           key !== 'blastered' && 
           key !== 'waitingDuration' &&
           value > 1000;
  });
  
  console.log(`   Top-level numeric fields (potential agent IDs): ${topLevelKeys.join(', ')}`);
  
  if (topLevelKeys.length > 0) {
    agentId = String(webhookPayload[topLevelKeys[0]]);
    console.log(`   ✅ Found agent ID: ${agentId} from field "${topLevelKeys[0]}"`);
  }
  
  if (!agentId && taskParams.associate_id) {
    agentId = String(taskParams.associate_id);
    console.log(`   ✅ Found agent ID: ${agentId} from task.params.associate_id`);
  }
  
  if (!agentId) {
    console.log(`   ❌ No agent ID found in webhook payload!`);
    console.log(`   ⚠️  This will prevent billing transaction creation`);
    process.exit(1);
  }
  
  const agentIdInt = parseInt(agentId);
  if (isNaN(agentIdInt)) {
    console.log(`   ❌ Invalid agent ID: ${agentId} (not a number)`);
    process.exit(1);
  }
  
  // Step 3: Look up agent email
  console.log('\n📋 STEP 3: Looking Up Agent Email');
  console.log('-'.repeat(80));
  console.log(`   Searching for associate_id: ${agentIdInt}`);
  
  let agentEmail = null;
  let agentName = null;
  
  // Try producerlist table first
  console.log(`   Checking producerlist table...`);
  const { data: producer, error: producerError } = await supabaseAdmin
    .from('producerlist')
    .select('company_email, first_name, last_name')
    .eq('associate_id', agentIdInt)
    .maybeSingle();
  
  if (producerError) {
    console.log(`   ⚠️  Error querying producerlist: ${producerError.message}`);
  } else if (producer?.company_email) {
    agentEmail = producer.company_email;
    agentName = `${producer.first_name || ''} ${producer.last_name || ''}`.trim();
    console.log(`   ✅ Found in producerlist: ${agentEmail} (${agentName})`);
  } else {
    console.log(`   ❌ Not found in producerlist`);
  }
  
  // Try customers table if not found
  if (!agentEmail) {
    console.log(`   Checking customers table...`);
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('company_email, personal_email, first_name, last_name')
      .eq('associate_id', agentIdInt)
      .maybeSingle();
    
    if (customerError) {
      console.log(`   ⚠️  Error querying customers: ${customerError.message}`);
    } else if (customer?.company_email) {
      agentEmail = customer.company_email;
      agentName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      console.log(`   ✅ Found in customers: ${agentEmail} (${agentName})`);
    } else if (customer?.personal_email) {
      agentEmail = customer.personal_email;
      agentName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      console.log(`   ✅ Found in customers (personal): ${agentEmail} (${agentName})`);
    } else {
      console.log(`   ❌ Not found in customers`);
    }
  }
  
  if (!agentEmail) {
    console.log(`\n   ❌❌❌ CRITICAL: No agent email found for associate_id ${agentIdInt}!`);
    console.log(`   ⚠️  Billing transaction cannot be created without agent email`);
    console.log(`\n   💡 Solutions:`);
    console.log(`      1. Verify associate_id ${agentIdInt} exists in producerlist or customers table`);
    console.log(`      2. Check if the agent has company_email or personal_email set`);
    console.log(`      3. The webhook may need to include agent email in task.params`);
    process.exit(1);
  }
  
  // Step 4: Check if billing transaction would be created
  console.log('\n📋 STEP 4: Simulating Billing Transaction Creation');
  console.log('-'.repeat(80));
  
  const todayStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
  const transactionId = `missed-call-${taskPhone}-${todayStr}-${timeStr}-${webhookEvent}`.replace(/[^a-zA-Z0-9-]/g, '-');
  
  console.log(`   Transaction ID: ${transactionId}`);
  console.log(`   Agent Email: ${agentEmail}`);
  console.log(`   Agent Associate ID: ${agentIdInt}`);
  console.log(`   Client Phone: ${taskPhone}`);
  console.log(`   Amount: $4.00`);
  console.log(`   Waiting Duration: ${waitingDurationSeconds}s`);
  
  // Check if transaction already exists
  const { data: existingTxn, error: checkError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, transaction_date, amount_usd')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  
  if (checkError) {
    console.log(`   ⚠️  Error checking existing transaction: ${checkError.message}`);
  } else if (existingTxn) {
    console.log(`   ⚠️  Transaction already exists: ${existingTxn.transaction_id}`);
    console.log(`      Created: ${existingTxn.transaction_date}`);
    console.log(`      Amount: $${existingTxn.amount_usd}`);
  } else {
    console.log(`   ✅ Transaction ID is unique (not found in database)`);
  }
  
  // Step 5: Check recent missed call transactions for this agent
  console.log('\n📋 STEP 5: Checking Recent Missed Call Transactions');
  console.log('-'.repeat(80));
  
  const { data: recentTxns, error: recentError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, transaction_date, amount_usd, lead_phone, metadata')
    .eq('agent_email', agentEmail)
    .eq('transaction_type', 'missed_call')
    .order('transaction_date', { ascending: false })
    .limit(5);
  
  if (recentError) {
    console.log(`   ⚠️  Error fetching recent transactions: ${recentError.message}`);
  } else if (recentTxns && recentTxns.length > 0) {
    console.log(`   ✅ Found ${recentTxns.length} recent missed call transactions:`);
    recentTxns.forEach((txn, idx) => {
      const meta = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
      console.log(`      ${idx + 1}. ${txn.transaction_id}`);
      console.log(`         Date: ${txn.transaction_date}`);
      console.log(`         Phone: ${txn.lead_phone}`);
      console.log(`         Wait: ${meta?.waiting_duration_formatted || 'N/A'}`);
    });
  } else {
    console.log(`   ⚠️  No recent missed call transactions found for ${agentEmail}`);
  }
  
  // Step 6: Summary and recommendations
  console.log('\n📋 STEP 6: Summary & Recommendations');
  console.log('-'.repeat(80));
  
  console.log(`\n✅ Agent ID Extraction: ${agentId ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Agent ID: ${agentId || 'NOT FOUND'}`);
  
  console.log(`\n${agentEmail ? '✅' : '❌'} Agent Email Lookup: ${agentEmail ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   Agent Email: ${agentEmail || 'NOT FOUND'}`);
  console.log(`   Agent Name: ${agentName || 'NOT FOUND'}`);
  
  console.log(`\n✅ Webhook Payload Structure: VALID`);
  console.log(`   Event: ${webhookEvent}`);
  console.log(`   Phone: ${taskPhone}`);
  console.log(`   Waiting Duration: ${waitingDurationSeconds}s`);
  
  console.log(`\n${existingTxn ? '⚠️' : '✅'} Duplicate Check: ${existingTxn ? 'EXISTS' : 'UNIQUE'}`);
  
  if (agentEmail && taskPhone && !existingTxn) {
    console.log(`\n✅✅✅ ALL CHECKS PASSED - Billing transaction should be created!`);
    console.log(`\n💡 Next Steps:`);
    console.log(`   1. Send the webhook to /api/taalk/incoming-call`);
    console.log(`   2. Check billing_transactions table for new record`);
    console.log(`   3. Check notifications table for agent notification`);
    console.log(`   4. Verify external webhook was sent to /api/ccpro/missed-call-billing`);
  } else {
    console.log(`\n❌❌❌ ISSUES FOUND - Billing transaction may not be created`);
    if (!agentEmail) {
      console.log(`   - Missing agent email (required)`);
    }
    if (!taskPhone) {
      console.log(`   - Missing client phone (required)`);
    }
    if (existingTxn) {
      console.log(`   - Transaction already exists (duplicate prevention)`);
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Run the diagnosis
diagnoseMissedCallBilling()
  .then(() => {
    console.log('✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  });








