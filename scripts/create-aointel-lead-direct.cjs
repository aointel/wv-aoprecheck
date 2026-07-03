/**
 * Create AOIntel Lead Directly
 * 
 * This script directly creates an AOIntel lead in masterlead table
 * and sets up all the necessary status flags for testing.
 * 
 * Usage: node scripts/create-aointel-lead-direct.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load Supabase credentials
let SUPABASE_URL, SUPABASE_SERVICE_KEY;

const hardcodedConfigPath = path.join(__dirname, '..', 'server', 'hardcoded-config.ts');
if (fs.existsSync(hardcodedConfigPath)) {
  const configContent = fs.readFileSync(hardcodedConfigPath, 'utf-8');
  
  const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
  if (urlMatch) SUPABASE_URL = urlMatch[1];
  
  const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
  if (keyMatch) SUPABASE_SERVICE_KEY = keyMatch[1];
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Could not load Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_AGENT_EMAIL = 'cnsysop@aoglobelife.com';

async function createAOIntelLeadDirect() {
  console.log('🧪 Creating AOIntel lead DIRECTLY for cnsysop@aoglobelife.com\n');
  
  const now = new Date();
  const testLeadId = `TEST_AOI_${Date.now()}`;
  const testPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
  
  // 1. Create VDP call record (for tracking)
  console.log('📞 Step 1: Creating vdp_calls record...');
  const { data: vdpCall, error: vdpError } = await supabase
    .from('vdp_calls')
    .insert({
      agent: '1253',
      event: 'PICK_UP',
      leadid: Math.floor(900000000 + Math.random() * 99999999),
      company_email: TEST_AGENT_EMAIL,
      phone: testPhone,
      firstName: 'Test',
      lastName: 'AOIntel Lead',
      market: 'Veteran',
      time: now.toISOString()
    })
    .select()
    .single();
    
  if (vdpError) {
    console.error('❌ VDP call insert failed:', vdpError);
  } else {
    console.log('✅ VDP call created:', vdpCall.id);
  }
  
  // 2. Create masterlead entry with proper AOIntel flags
  console.log('\n📝 Step 2: Creating masterlead entry...');
  
  // First, find an existing lead for cnsysop and update it to be an AOIntel lead
  // This ensures we're working with a lead that's actually being loaded
  const { data: existingLeads, error: findError } = await supabase
    .from('masterlead')
    .select('id, taalk_lead_id, first_name, last_name, phone')
    .eq('cn_email', TEST_AGENT_EMAIL)
    .is('cnresolution', null)
    .limit(1);
    
  let leadId;
  let lead;
  
  if (existingLeads && existingLeads.length > 0) {
    // Update existing lead to be AOIntel
    leadId = existingLeads[0].id;
    console.log(`   Found existing lead ${leadId} - converting to AOIntel`);
    
    const { data: updatedLead, error: updateError } = await supabase
      .from('masterlead')
      .update({
        cnresolution: 'pending',
        aointel: true,
        taalk_market: 'Veteran',
        updated_at: now.toISOString()
      })
      .eq('id', leadId)
      .select()
      .single();
      
    if (updateError) {
      console.error('❌ Lead update failed:', updateError);
      // Try insert instead
    } else {
      lead = updatedLead;
    }
  }
  
  if (!lead) {
    // Insert new lead
    const masterleadPayload = {
      taalk_lead_id: testLeadId,
      first_name: 'Test',
      last_name: 'AOIntel Lead',
      phone: testPhone,
      taalk_market: 'Veteran',
      cn_email: TEST_AGENT_EMAIL,
      cnresolution: 'pending',
      aointel: true,
      taalk_lead_source: 'ao_intel_inbound',
      updated_at: now.toISOString()
    };
    
    console.log('   Inserting new lead...');
    const { data: insertedLead, error: insertError } = await supabase
      .from('masterlead')
      .insert(masterleadPayload)
      .select()
      .single();
      
    if (insertError) {
      console.error('❌ Masterlead insert failed:', insertError);
      
      // Try upsert as fallback
      console.log('   Trying upsert...');
      const { data: upsertedLead, error: upsertError } = await supabase
        .from('masterlead')
        .upsert(masterleadPayload)
        .select()
        .single();
        
      if (upsertError) {
        console.error('❌ Masterlead upsert also failed:', upsertError);
        return;
      }
      lead = upsertedLead;
    } else {
      lead = insertedLead;
    }
  }
  
  // Verify lead exists
  const { data: verifyLead } = await supabase
    .from('masterlead')
    .select('id, taalk_lead_id, cn_email, cnresolution, aointel')
    .eq('id', lead?.id || leadId)
    .single();
    
  if (!verifyLead) {
    console.error('❌ VERIFICATION FAILED - lead not found after insert!');
    return;
  }
  
  lead = verifyLead;
  
  console.log('✅ Masterlead created/updated:');
  console.log(`   ID: ${lead.id}`);
  console.log(`   taalk_lead_id: ${lead.taalk_lead_id}`);
  console.log(`   cn_email: ${lead.cn_email}`);
  console.log(`   cnresolution: ${lead.cnresolution}`);
  console.log(`   aointel: ${lead.aointel}`);
  
  // 3. Update agent status to 'in_call' to pause dialer
  console.log('\n🚨 Step 3: Setting agent status to "in_call" (pauses dialer)...');
  const { error: statusError } = await supabase
    .from('agent_live_call_status')
    .upsert({
      agent_email: TEST_AGENT_EMAIL,
      status: 'in_call',
      last_heartbeat_at: now.toISOString(),
      updated_at: now.toISOString()
    }, { onConflict: 'agent_email' });
    
  if (statusError) {
    console.error('❌ Agent status update failed:', statusError);
  } else {
    console.log('✅ Agent status set to "in_call" - outbound dialer should pause');
  }
  
  // 4. Update live_call_board to show AOIntel call
  console.log('\n📋 Step 4: Updating live_call_board...');
  const { error: boardError } = await supabase
    .from('live_call_board')
    .upsert({
      agent_email: TEST_AGENT_EMAIL,
      status: 'calling',
      current_call: {
        phoneNumber: testPhone,
        clientName: 'Test AOIntel Lead',
        direction: 'inbound',
        callStatus: 'ringing',
        callType: 'AOIntel',
        leadId: testLeadId,
        startedAt: now.toISOString()
      },
      last_activity: now.toISOString(),
      updated_at: now.toISOString()
    }, { onConflict: 'agent_email' });
    
  if (boardError) {
    console.error('❌ Live call board update failed:', boardError);
  } else {
    console.log('✅ Live call board updated with AOIntel call');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ AOIntel Lead Created Successfully!');
  console.log('='.repeat(60));
  console.log(`\n📋 Lead Details:`);
  console.log(`   Lead ID: ${testLeadId}`);
  console.log(`   Phone: ${testPhone}`);
  console.log(`   Agent: ${TEST_AGENT_EMAIL}`);
  console.log(`   taalk_market: Veteran (AOIntel)`);
  console.log(`   cnresolution: pending`);
  console.log(`   aointel: true`);
  console.log(`\n🎯 What should happen now:`);
  console.log(`   1. Open Call Connector Pro in browser as cnsysop`);
  console.log(`   2. Lead should appear in AOIntel queue tab`);
  console.log(`   3. Outbound dialer should be paused`);
  console.log(`   4. Once you resolve the lead, it will leave the queue`);
  console.log('='.repeat(60));
}

createAOIntelLeadDirect().catch(console.error);

