const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

// Try to load from hardcoded-config.ts
let SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  const hardcodedConfigPath = path.join(__dirname, '..', 'server', 'hardcoded-config.ts');
  if (fs.existsSync(hardcodedConfigPath)) {
    try {
      const configContent = fs.readFileSync(hardcodedConfigPath, 'utf-8');
      const urlMatch = configContent.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
      if (urlMatch && !SUPABASE_URL) SUPABASE_URL = urlMatch[1];
      const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY:\s*['"]([^'"]+)['"]/);
      if (keyMatch && !SUPABASE_SERVICE_KEY) SUPABASE_SERVICE_KEY = keyMatch[1];
    } catch (e) {}
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkKingsleyLeads() {
  const userEmail = 'kingsleyibeh@aoglobelife.com';
  
  console.log(`\n🔍 Checking leads for: ${userEmail}\n`);
  
  // Get ALL leads assigned to this user
  const { data: allLeads, error: allError } = await supabase
    .from('masterlead')
    .select('id, first_name, last_name, phone, cn_email, cnresolution, is_hot_lead, taalk_market, priority_score, assigned_date, created_at')
    .eq('cn_email', userEmail)
    .limit(1000);
  
  if (allError) {
    console.error('❌ Error fetching all leads:', allError);
    return;
  }
  
  console.log(`📊 TOTAL LEADS ASSIGNED: ${allLeads?.length || 0}\n`);
  
  // Get pending leads (what API queries)
  const { data: pendingLeads, error: pendingError } = await supabase
    .from('masterlead')
    .select('id, first_name, last_name, phone, cn_email, cnresolution, is_hot_lead, taalk_market, priority_score, assigned_date')
    .eq('cn_email', userEmail)
    .eq('cnresolution', 'pending')
    .limit(1000);
  
  if (pendingError) {
    console.error('❌ Error fetching pending leads:', pendingError);
    return;
  }
  
  console.log(`📊 PENDING LEADS (cnresolution='pending'): ${pendingLeads?.length || 0}\n`);
  
  // Filter for hotleads (what API does)
  const hotleads = (pendingLeads || []).filter(lead => {
    const isHotlead = lead.is_hot_lead === true || lead.is_hot_lead === 1;
    const taalkMarket = (lead.taalk_market || '').toLowerCase();
    const isPlusLead = taalkMarket.includes('plus');
    
    return isHotlead && !isPlusLead;
  });
  
  console.log(`🔥 PENDING HOTLEADS (after API filter): ${hotleads.length}\n`);
  
  // Show breakdown by resolution
  console.log('📊 LEADS BY RESOLUTION:');
  const byResolution = {};
  (allLeads || []).forEach(lead => {
    const res = lead.cnresolution || 'null';
    if (!byResolution[res]) byResolution[res] = [];
    byResolution[res].push(lead);
  });
  
  Object.entries(byResolution).forEach(([res, leads]) => {
    console.log(`   ${res}: ${leads.length} leads`);
  });
  
  console.log('\n🔥 PENDING HOTLEADS DETAILS:');
  if (hotleads.length === 0) {
    console.log('   ❌ NO PENDING HOTLEADS FOUND!\n');
    
    // Check why - show pending leads that aren't hotleads
    const nonHotleads = (pendingLeads || []).filter(lead => {
      const isHotlead = lead.is_hot_lead === true || lead.is_hot_lead === 1;
      const taalkMarket = (lead.taalk_market || '').toLowerCase();
      const market = (lead.market || '').toLowerCase();
      const isPlusLead = taalkMarket.includes('plus') || market.includes('plus');
      return !isHotlead && !isPlusLead;
    });
    
    if (nonHotleads.length > 0) {
      console.log(`\n   ⚠️ Found ${nonHotleads.length} pending leads that are NOT hotleads:`);
      nonHotleads.slice(0, 5).forEach((lead, idx) => {
        console.log(`   ${idx + 1}. ID: ${lead.id} | ${lead.first_name} ${lead.last_name}`);
        console.log(`      is_hot_lead: ${lead.is_hot_lead}`);
        console.log(`      Market: ${lead.taalk_market || 'null'}`);
        console.log('');
      });
    }
    
    // Check if there are hotleads with wrong resolution
    const hotleadsWrongResolution = (allLeads || []).filter(lead => {
      const isHotlead = lead.is_hot_lead === true || lead.is_hot_lead === 1;
      const taalkMarket = (lead.taalk_market || '').toLowerCase();
      const isPlusLead = taalkMarket.includes('plus');
      return isHotlead && !isPlusLead && lead.cnresolution !== 'pending';
    });
    
    if (hotleadsWrongResolution.length > 0) {
      console.log(`\n   ⚠️ Found ${hotleadsWrongResolution.length} HOTLEADS with WRONG resolution (not 'pending'):`);
      hotleadsWrongResolution.slice(0, 5).forEach((lead, idx) => {
        console.log(`   ${idx + 1}. ID: ${lead.id} | ${lead.first_name} ${lead.last_name}`);
        console.log(`      Resolution: ${lead.cnresolution || 'null'} | is_hot_lead: ${lead.is_hot_lead}`);
        console.log(`      Market: ${lead.taalk_market || 'null'}`);
        console.log('');
      });
    }
  } else {
    hotleads.slice(0, 10).forEach((lead, idx) => {
      console.log(`   ${idx + 1}. ID: ${lead.id} | ${lead.first_name} ${lead.last_name} | ${lead.phone}`);
      console.log(`      Resolution: ${lead.cnresolution} | is_hot_lead: ${lead.is_hot_lead}`);
      console.log(`      Market: ${lead.taalk_market || lead.market || 'null'}`);
      console.log('');
    });
  }
  
  // Check what columns API would return
  console.log('\n🔍 API RESPONSE CHECK:');
  const pendingLeadsColumns = 'id,first_name,last_name,phone,email,city,state,zip,address,taalk_market,taalk_lead_source,taalk_state,taalk_lead_id,taalk_group_code,taalk_groupname,groupcode,group_name,taalk_email,taalk_city,taalk_zip,taalk_address,taalk_beneficiary,taalk_relationship,taalk_reffered,taalk_referred,taalk_sponsor_org,cnresolution,status,last_contacted,created_at,updated_at,cn_email,is_hot_lead,priority_score,assigned_date';
  const { data: apiLeads, error: apiError } = await supabase
    .from('masterlead')
    .select(pendingLeadsColumns)
    .eq('cn_email', userEmail)
    .eq('cnresolution', 'pending')
    .limit(200);
  
  if (apiError) {
    console.error('❌ Error in API query:', apiError);
  } else {
    const apiHotleads = (apiLeads || []).filter(lead => {
      const isHotlead = lead.is_hot_lead === true || lead.is_hot_lead === 1;
      const taalkMarket = (lead.taalk_market || '').toLowerCase();
      const isPlusLead = taalkMarket.includes('plus');
      return isHotlead || isPlusLead;
    });
    
    console.log(`   API would return: ${apiLeads?.length || 0} pending leads`);
    console.log(`   After hotlead filter: ${apiHotleads.length} hotleads`);
    
    // Check frontend filter requirements
    if (apiHotleads && apiHotleads.length > 0) {
      console.log(`\n   Frontend filter check for first hotlead:`);
      const sample = apiHotleads[0];
      const isHotlead = sample.taalk_market === 'Hot Lead' ||
                        sample.is_hot_lead === true;
      console.log(`      taalk_market === 'Hot Lead': ${sample.taalk_market === 'Hot Lead'} (value: ${sample.taalk_market || 'null'})`);
      console.log(`      is_hot_lead === true: ${sample.is_hot_lead === true} (value: ${sample.is_hot_lead})`);
      console.log(`      Would pass frontend filter: ${isHotlead && sample.cnresolution === 'pending'}`);
    }
  }
}

checkKingsleyLeads().catch(console.error);
