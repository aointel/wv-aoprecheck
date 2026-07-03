/**
 * Debug AOIntel VDP Poller
 * Checks if PICK_UP events are being found and if the poller conditions are met
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

async function debug() {
  console.log('🔍 DEBUGGING AOINTEL VDP POLLER\n');
  
  // Check for recent PICK_UP events (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  console.log('📋 Looking for PICK_UP events since:', fiveMinutesAgo);
  
  const { data: pickups, error } = await supabase
    .from('vdp_calls')
    .select('*')
    .eq('event', 'PICK_UP')
    .gte('time', fiveMinutesAgo)
    .order('time', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error('❌ Query error:', error);
    return;
  }
  
  console.log(`\n📞 Found ${pickups?.length || 0} PICK_UP events in last 5 minutes\n`);
  
  if (pickups && pickups.length > 0) {
    for (const p of pickups) {
      const market = (p.market || '').toLowerCase();
      const isAOIntel = market.includes('veteran') || market.includes('globe market');
      
      console.log(`ID: ${p.id} | LeadID: ${p.leadid}`);
      console.log(`   Market: "${p.market}" | Is AOIntel: ${isAOIntel ? '✅ YES' : '❌ NO'}`);
      console.log(`   Email: ${p.company_email}`);
      console.log(`   Time: ${p.time}`);
      console.log('');
      
      // Check if masterlead exists for this lead
      const { data: lead } = await supabase
        .from('masterlead')
        .select('id, taalk_lead_id, cn_email, cnresolution, aointel')
        .eq('taalk_lead_id', String(p.leadid))
        .maybeSingle();
        
      if (lead) {
        console.log(`   ✅ MASTERLEAD EXISTS:`);
        console.log(`      ID: ${lead.id}`);
        console.log(`      cn_email: ${lead.cn_email}`);
        console.log(`      cnresolution: ${lead.cnresolution}`);
        console.log(`      aointel: ${lead.aointel}`);
      } else {
        console.log(`   ⚠️ NO MASTERLEAD FOUND for taalk_lead_id: ${p.leadid}`);
      }
      console.log('-'.repeat(60));
    }
  }
  
  // Check agent status
  console.log('\n🔍 Checking agent status for cnsysop@aoglobelife.com...');
  const { data: status } = await supabase
    .from('agent_live_call_status')
    .select('*')
    .eq('agent_email', 'cnsysop@aoglobelife.com')
    .maybeSingle();
    
  if (status) {
    console.log(`   Status: ${status.status}`);
    console.log(`   Last heartbeat: ${status.last_heartbeat_at}`);
  } else {
    console.log('   No status found');
  }
}

debug().catch(console.error);

