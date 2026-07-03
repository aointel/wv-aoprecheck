/**
 * Test Script: Test webhook lead assignment for an agent
 * 
 * This script tests the webhook assignment by sending a request to the
 * assignment-trigger endpoint and showing the response.
 * 
 * Run with: tsx server/test-webhook-assignment.ts <agent-email>
 * Example: tsx server/test-webhook-assignment.ts wallacejonathan@aoglobelife.com
 */

import { supabaseAdmin } from './supabase';
import { countCallableLeads } from './timezone-helper';
import { getLeadSyncAssignmentTriggerUrl } from './external-service-urls';

const AGENT_EMAIL = process.argv[2] || 'wallacejonathan@aoglobelife.com';

function parseArrayField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return [parsed].filter(Boolean);
    } catch {
      // If not JSON, treat as comma-separated string
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

async function testWebhookAssignment() {
  console.log(`\n🧪 TESTING WEBHOOK ASSIGNMENT FOR: ${AGENT_EMAIL}\n`);
  console.log('='.repeat(80));
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  // 1. Get agent's customer profile
  console.log('📋 STEP 1: Fetching agent profile...');
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('company_email', AGENT_EMAIL)
    .maybeSingle();
  
  if (customerError) {
    console.error(`❌ Error fetching customer:`, customerError);
    process.exit(1);
  }
  
  if (!customer) {
    console.error(`❌ Agent not found in customers table!`);
    process.exit(1);
  }
  
  console.log(`✅ Agent found:`);
  console.log(`   ID: ${customer.id}`);
  console.log(`   Associate ID: ${customer.associate_id || 'N/A'}`);
  console.log(`   Name: ${customer.first_name || ''} ${customer.last_name || ''}`);
  
  // 2. Parse markets and states
  console.log(`\n📋 STEP 2: Parsing markets and states...`);
  const markets = parseArrayField(customer.market).filter(Boolean);
  let states = parseArrayField(customer.states);
  
  // Handle case where states is stored as a single comma-separated string
  if (states.length === 1 && states[0].includes(',')) {
    console.log(`   ⚠️ States stored as comma-separated string, splitting...`);
    states = states[0].split(',').map(s => s.trim()).filter(Boolean);
  }
  
  states = states.map(s => s.toUpperCase().trim()).filter(Boolean);
  
  console.log(`   Markets: ${JSON.stringify(markets)}`);
  console.log(`   States: ${JSON.stringify(states)}`);
  
  if (markets.length === 0) {
    console.log(`   ⚠️ WARNING: No markets configured!`);
  }
  if (states.length === 0) {
    console.log(`   ⚠️ WARNING: No states configured!`);
  }
  
  // 3. Get current callable lead count
  console.log(`\n📋 STEP 3: Getting current lead count...`);
  let currentCallable = 0;
  try {
    currentCallable = await countCallableLeads(supabaseAdmin, AGENT_EMAIL);
    console.log(`   Current callable leads: ${currentCallable}`);
  } catch (error) {
    console.error(`   ❌ Error counting leads:`, error);
  }
  
  // 4. Calculate requested count
  console.log(`\n📋 STEP 4: Calculating requested count...`);
  const maxToTopOff = 150 - currentCallable;
  const needed = Math.min(150, maxToTopOff);
  
  console.log(`   Current: ${currentCallable}`);
  console.log(`   Target: 150`);
  console.log(`   Needed: ${needed}`);
  
  if (needed <= 0) {
    console.log(`   ⚠️ Agent already has ${currentCallable} leads (>= 150), no assignment needed`);
    process.exit(0);
  }
  
  // 5. Build webhook payload
  console.log(`\n📋 STEP 5: Building webhook payload...`);
  const associateId = customer.associate_id?.toString() || null;
  
  if (!associateId) {
    console.error(`❌ CRITICAL: No associate_id for ${AGENT_EMAIL}. Cannot send webhook (never send 999).`);
    process.exit(1);
  }
  
  const webhookPayload = {
    agentEmail: AGENT_EMAIL,
    associate_id: associateId,
    requestedCount: needed,
    currentCount: currentCallable,
    markets: markets,
    states: states,
    source: 'test_script'
  };
  
  console.log(`   Webhook payload:`);
  console.log(JSON.stringify(webhookPayload, null, 2));
  
  // 6. Send webhook
  console.log(`\n📋 STEP 6: Sending webhook to assignment-trigger...`);
  console.log(`   URL: ${getLeadSyncAssignmentTriggerUrl()}`);
  
  try {
    const startTime = Date.now();
    const webhookResult = await fetch(getLeadSyncAssignmentTriggerUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(30000) // 30 second timeout for testing
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`   Response status: ${webhookResult.status} ${webhookResult.statusText}`);
    console.log(`   Response time: ${duration}ms`);
    
    const responseText = await webhookResult.text();
    console.log(`   Response body: ${responseText}`);
    
    let webhookResponse: any = null;
    try {
      webhookResponse = JSON.parse(responseText);
      console.log(`   Parsed response:`);
      console.log(JSON.stringify(webhookResponse, null, 2));
    } catch (parseError) {
      console.log(`   ⚠️ Response is not valid JSON`);
    }
    
    if (webhookResult.ok) {
      const assignedCount = webhookResponse?.assigned || 0;
      const progress = webhookResponse?.progress || {};
      
      console.log(`\n✅ WEBHOOK SUCCESS!`);
      console.log(`   Leads assigned: ${assignedCount}`);
      
      if (assignedCount === 0) {
        console.log(`\n⚠️ WARNING: Webhook returned success but 0 leads assigned!`);
        console.log(`   Webhook server diagnostics:`);
        console.log(`   - Leads checked: ${progress.leadsChecked || 'N/A'}`);
        console.log(`   - Leads eligible: ${progress.leadsEligible || 0}`);
        console.log(`   - Recently contacted (2hr rule): ${progress.recentlyContacted || 0}`);
        console.log(`   - States count (webhook server): ${progress.statesCount || 'N/A'}`);
        console.log(`   - Reason: ${progress.reason || 'Unknown'}`);
        console.log(`\n   Possible issues:`);
        if (progress.reason?.includes('2-hour contact rule')) {
          console.log(`   ❌ PRIMARY ISSUE: ${progress.recentlyContacted || 0} leads were contacted within last 2 hours`);
          console.log(`      The webhook server has a 2-hour cooldown rule that prevents re-assigning recently contacted leads.`);
          console.log(`      Solution: Wait 2+ hours, or check if the 2-hour rule should be adjusted.`);
        }
        if (progress.statesCount === 1 && states.length > 1) {
          console.log(`   ⚠️ States parsing issue: Webhook server shows ${progress.statesCount} state(s) but we sent ${states.length}`);
          console.log(`      This suggests the webhook server may not be parsing the states array correctly.`);
        }
        if (progress.leadsEligible === 0 && !progress.reason?.includes('2-hour')) {
          console.log(`   - No available leads matching markets: ${JSON.stringify(markets)}`);
          console.log(`   - No available leads matching states: ${JSON.stringify(states)}`);
        }
      } else {
        console.log(`\n✅ ${assignedCount} leads should now be assigned to ${AGENT_EMAIL}`);
        console.log(`   Check the masterlead table to verify assignment.`);
      }
    } else {
      console.log(`\n❌ WEBHOOK FAILED!`);
      console.log(`   Status: ${webhookResult.status}`);
      console.log(`   Response: ${responseText}`);
      
      // Parse response even on error to get diagnostic info
      const progress = webhookResponse?.progress || {};
      
      if (webhookResult.status === 400) {
        console.log(`\n   💡 DIAGNOSTIC INFO FROM WEBHOOK SERVER:`);
        console.log(`   - Message: ${webhookResponse?.message || 'Unknown error'}`);
        console.log(`   - Leads checked: ${progress.leadsChecked || 'N/A'}`);
        console.log(`   - Leads eligible: ${progress.leadsEligible || 0}`);
        console.log(`   - Recently contacted (2hr rule): ${progress.recentlyContacted || 0}`);
        console.log(`   - States count (webhook server): ${progress.statesCount || 'N/A'}`);
        console.log(`   - Reason: ${progress.reason || 'Unknown'}`);
        
        if (progress.reason?.includes('2-hour contact rule')) {
          console.log(`\n   ❌ PRIMARY ISSUE: ${progress.recentlyContacted || 0} leads were contacted within last 2 hours`);
          console.log(`      The webhook server has a 2-hour cooldown rule that prevents re-assigning recently contacted leads.`);
          console.log(`      Solution: Wait 2+ hours, or check if the 2-hour rule should be adjusted on the webhook server.`);
        }
        if (progress.statesCount === 1 && states.length > 1) {
          console.log(`\n   ⚠️ States parsing issue: Webhook server shows ${progress.statesCount} state(s) but we sent ${states.length}`);
          console.log(`      This suggests the webhook server may not be parsing the states array correctly.`);
          console.log(`      Check the webhook server code to see how it parses the 'states' field.`);
        }
      } else if (webhookResult.status === 404) {
        console.log(`\n   💡 Endpoint not found - check the webhook URL`);
      } else if (webhookResult.status === 500) {
        console.log(`\n   💡 Server error - check webhook server logs`);
      }
    }
    
    // 7. Verify assignment (wait a bit then check)
    if (webhookResult.ok && webhookResponse?.assigned > 0) {
      console.log(`\n📋 STEP 7: Verifying assignment (waiting 2 seconds)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const newCallable = await countCallableLeads(supabaseAdmin, AGENT_EMAIL);
        const newLeads = newCallable - currentCallable;
        
        console.log(`   Previous count: ${currentCallable}`);
        console.log(`   New count: ${newCallable}`);
        console.log(`   Difference: ${newLeads}`);
        
        if (newLeads > 0) {
          console.log(`   ✅ Assignment verified! ${newLeads} new leads assigned.`);
        } else {
          console.log(`   ⚠️ No new leads detected yet (may take longer to process)`);
        }
      } catch (error) {
        console.error(`   ❌ Error verifying assignment:`, error);
      }
    }
    
  } catch (webhookError: any) {
    console.error(`\n❌ WEBHOOK ERROR:`);
    console.error(`   Error: ${webhookError.message}`);
    if (webhookError.name === 'AbortError') {
      console.error(`   ⚠️ Request timed out after 30 seconds`);
    }
    console.error(`   Stack:`, webhookError.stack);
  }
  
  console.log(`\n` + '='.repeat(80) + `\n`);
}

// Run the test
testWebhookAssignment()
  .then(() => {
    console.log('✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });








