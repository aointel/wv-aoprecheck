/**
 * Test AOIntel PICK_UP Event
 * 
 * This script simulates an AOIntel PICK_UP event for cnsysop@aoglobelife.com
 * to test the AOIntel lead creation and dialer pausing flow.
 * 
 * Usage: node scripts/test-aointel-pickup.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load Supabase credentials
let SUPABASE_URL, SUPABASE_SERVICE_KEY;

// Try to load from hardcoded-config.ts
const hardcodedConfigPath = path.join(__dirname, '..', 'server', 'hardcoded-config.ts');
if (fs.existsSync(hardcodedConfigPath)) {
  const configContent = fs.readFileSync(hardcodedConfigPath, 'utf-8');
  
  const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
  if (urlMatch) SUPABASE_URL = urlMatch[1];
  
  const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
  if (keyMatch) SUPABASE_SERVICE_KEY = keyMatch[1];
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Could not load Supabase credentials from hardcoded-config.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test data for cnsysop
const TEST_AGENT_EMAIL = 'cnsysop@aoglobelife.com';
const TEST_AGENT_ASSOCIATE_ID = '999'; // Placeholder - will be looked up

async function getAssociateId(email) {
  // Try to get real associate_id
  const { data: user } = await supabase
    .from('user_credits')
    .select('associate_id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  
  if (user?.associate_id) {
    return String(user.associate_id);
  }
  
  // Try customers table
  const { data: customer } = await supabase
    .from('customers')
    .select('associate_id')
    .ilike('company_email', email)
    .maybeSingle();
  
  if (customer?.associate_id) {
    return String(customer.associate_id);
  }
  
  return '999'; // Fallback
}

async function createTestPickup() {
  console.log('🧪 Creating test AOIntel PICK_UP event for cnsysop@aoglobelife.com\n');
  
  // Get associate ID
  const associateId = await getAssociateId(TEST_AGENT_EMAIL);
  console.log(`📋 Using associate_id: ${associateId}`);
  
  // Generate unique test lead ID (must be numeric for vdp_calls table)
  const testLeadId = Math.floor(900000000 + Math.random() * 99999999); // Random 9-digit test ID
  const testPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`; // Random test phone
  
  // Test lead data - using "Veteran" market to trigger AOIntel
  const vdpCallData = {
    agent: associateId,
    event: 'PICK_UP',
    leadid: testLeadId,
    company_email: TEST_AGENT_EMAIL,
    phone: testPhone,
    firstName: 'Test',
    lastName: 'AOIntel Lead',
    market: 'Veteran', // AOIntel market - triggers the poller
    duration: null,
    mga: null,
    rga: null,
    time: new Date().toISOString()
  };
  
  console.log('\n📝 VDP Call Data:');
  console.log(JSON.stringify(vdpCallData, null, 2));
  
  // Insert into vdp_calls
  console.log('\n⏳ Inserting into vdp_calls table...');
  const { data: insertedCall, error: insertError } = await supabase
    .from('vdp_calls')
    .insert(vdpCallData)
    .select()
    .single();
  
  if (insertError) {
    console.error('❌ Failed to insert vdp_call:', insertError);
    return;
  }
  
  console.log('✅ VDP call inserted successfully!');
  console.log(`   ID: ${insertedCall.id}`);
  console.log(`   Lead ID: ${testLeadId}`);
  console.log(`   Phone: ${testPhone}`);
  console.log(`   Market: Veteran (AOIntel)`);
  
  console.log('\n⏳ Waiting for AOIntel VDP Poller to process (5-10 seconds)...');
  
  // Wait for poller to pick it up
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check if masterlead was created
  console.log('\n🔍 Checking masterlead table for created lead...');
  const { data: createdLead, error: leadError } = await supabase
    .from('masterlead')
    .select('*')
    .eq('taalk_lead_id', testLeadId)
    .maybeSingle();
  
  if (leadError) {
    console.error('❌ Error checking masterlead:', leadError);
  } else if (createdLead) {
    console.log('✅ Lead created in masterlead!');
    console.log(`   ID: ${createdLead.id}`);
    console.log(`   taalk_lead_id: ${createdLead.taalk_lead_id}`);
    console.log(`   cn_email: ${createdLead.cn_email}`);
    console.log(`   cnresolution: ${createdLead.cnresolution}`);
    console.log(`   aointel: ${createdLead.aointel}`);
    console.log(`   source_table: ${createdLead.source_table}`);
  } else {
    console.log('⚠️ Lead not found in masterlead yet - poller may not have run yet');
    console.log('   Check server logs for AOIntel poller activity');
  }
  
  // Check agent status
  console.log('\n🔍 Checking agent_live_call_status...');
  const { data: agentStatus, error: statusError } = await supabase
    .from('agent_live_call_status')
    .select('*')
    .eq('agent_email', TEST_AGENT_EMAIL.toLowerCase())
    .maybeSingle();
  
  if (statusError) {
    console.error('❌ Error checking agent status:', statusError);
  } else if (agentStatus) {
    console.log(`✅ Agent status: ${agentStatus.status}`);
    console.log(`   (Should be 'in_call' to pause outbound dialer)`);
  }
  
  // Check live_call_board
  console.log('\n🔍 Checking live_call_board...');
  const { data: boardStatus, error: boardError } = await supabase
    .from('live_call_board')
    .select('status, current_call')
    .eq('agent_email', TEST_AGENT_EMAIL.toLowerCase())
    .maybeSingle();
  
  if (boardError) {
    console.error('❌ Error checking live_call_board:', boardError);
  } else if (boardStatus) {
    console.log(`✅ Live call board status: ${boardStatus.status}`);
    if (boardStatus.current_call) {
      console.log(`   Current call: ${JSON.stringify(boardStatus.current_call)}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Lead ID: ${testLeadId}`);
  console.log(`Agent: ${TEST_AGENT_EMAIL}`);
  console.log(`Phone: ${testPhone}`);
  console.log(`Market: Veteran (AOIntel)`);
  console.log('\n🎯 EXPECTED BEHAVIOR:');
  console.log('   1. Lead should appear in AOIntel queue in Call Connector Pro');
  console.log('   2. Outbound dialer should pause (agent status = "in_call")');
  console.log('   3. Lead should have cnresolution = "pending"');
  console.log('   4. Once resolved, lead should leave the AOIntel queue');
  console.log('='.repeat(60));
}

// Run the test
createTestPickup().catch(console.error);

