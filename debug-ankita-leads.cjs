const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bvlltvuaslesouzlyzbf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bGx0dnVhc2xlc291emx5emJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTU5OTMxMywiZXhwIjoyMDM1MTc1MzEzfQ.5j5opMn_9FZhMqVPzGwnhX5Q1Kud6sDkLtmGhcVRjAo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugAnkitaLeads() {
  const ankitaEmail = 'ankitasingh@aoglobelife.com';
  
  console.log('🔍 DEBUGGING ANKITA LEADS');
  console.log('========================\n');
  
  // 1. Check total leads assigned to Ankita
  const { data: allLeads, error: allError } = await supabase
    .from('masterlead')
    .select('id, first_name, last_name, phone, cnresolution, status, created_at')
    .eq('cn_email', ankitaEmail)
    .order('created_at', { ascending: false })
    .limit(100);
  
  console.log(`Total leads assigned to ${ankitaEmail}: ${allLeads?.length || 0}`);
  
  if (allLeads && allLeads.length > 0) {
    console.log('\n📊 Resolution breakdown:');
    const resolutionCounts = allLeads.reduce((acc, lead) => {
      const res = lead.cnresolution || 'null';
      acc[res] = (acc[res] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(resolutionCounts).forEach(([resolution, count]) => {
      console.log(`   ${resolution}: ${count}`);
    });
    
    console.log('\n📋 Sample leads:');
    allLeads.slice(0, 10).forEach(lead => {
      console.log(`   ${lead.first_name} ${lead.last_name} - Resolution: ${lead.cnresolution || 'null'} - Status: ${lead.status || 'null'}`);
    });
  }
  
  // 2. Check pending leads specifically
  const { data: pendingLeads, error: pendingError } = await supabase
    .from('masterlead')
    .select('*')
    .eq('cn_email', ankitaEmail)
    .eq('cnresolution', 'pending')
    .limit(10);
  
  console.log(`\n✅ Pending leads for ${ankitaEmail}: ${pendingLeads?.length || 0}`);
  
  if (pendingLeads && pendingLeads.length > 0) {
    console.log('\n📋 Pending leads:');
    pendingLeads.forEach(lead => {
      console.log(`   ${lead.first_name} ${lead.last_name} - ${lead.phone} - Market: ${lead.taalk_market || 'null'}`);
    });
  }
  
  // 3. Check for unassigned leads that match Ankita's territory
  const { data: ankitaProfile } = await supabase
    .from('customers')
    .select('states, market, associate_id')
    .eq('company_email', ankitaEmail)
    .maybeSingle();
  
  console.log(`\n👤 Ankita's profile:`);
  console.log(`   States: ${ankitaProfile?.states || 'null'}`);
  console.log(`   Market: ${ankitaProfile?.market || 'null'}`);
  console.log(`   Associate ID: ${ankitaProfile?.associate_id || 'null'}`);
  
  // 4. Check for available unassigned leads
  const { data: unassignedLeads, count: unassignedCount } = await supabase
    .from('masterlead')
    .select('*', { count: 'exact' })
    .or('cn_email.is.null,cn_email.eq.')
    .eq('cnresolution', 'pending')
    .limit(10);
  
  console.log(`\n📦 Available unassigned leads: ${unassignedCount || 0}`);
  
  if (unassignedLeads && unassignedLeads.length > 0) {
    console.log('\n📋 Sample unassigned leads:');
    unassignedLeads.slice(0, 5).forEach(lead => {
      console.log(`   ${lead.first_name} ${lead.last_name} - ${lead.state || lead.taalk_state} - Market: ${lead.taalk_market || 'null'}`);
    });
  }
  
  console.log('\n========================');
}

debugAnkitaLeads()
  .then(() => {
    console.log('✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });



