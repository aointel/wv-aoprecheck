/**
 * Direct Supabase query test - bypasses API
 * Run: npx tsx test-supabase-direct.ts
 */

import { supabaseAdmin } from './server/supabase';

async function testDirectQuery() {
  const agentEmail = 'cnsysop@aoglobelife.com';
  
  console.log('🧪 Testing direct Supabase query');
  console.log('📧 Agent Email:', agentEmail);
  console.log('');

  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin is null!');
    return;
  }

  // Query ALL connects for this agent
  const { data, error } = await supabaseAdmin
    .from('war_connects')
    .select('*')
    .eq('agent_email', agentEmail);

  console.log('📡 Supabase Response:');
  console.log('  Error:', error ? JSON.stringify(error, null, 2) : 'null');
  console.log('  Data length:', data?.length || 0);
  console.log('  Is array:', Array.isArray(data));
  console.log('');

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No connects found! Checking if table exists...');
    
    // Try to query table structure
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('war_connects')
      .select('id')
      .limit(1);
    
    console.log('  Table exists check:', tableError ? 'NO (error: ' + tableError.message + ')' : 'YES');
    
    // Check if ANY connects exist for ANY agent
    const { data: anyConnects, error: anyError } = await supabaseAdmin
      .from('war_connects')
      .select('agent_email, connect_id, review_status')
      .limit(5);
    
    console.log('  Any connects in table:', anyConnects?.length || 0);
    if (anyConnects && anyConnects.length > 0) {
      console.log('  Sample connects:');
      anyConnects.forEach(c => {
        console.log(`    - ${c.agent_email}: ${c.connect_id} (review_status: ${c.review_status})`);
      });
    }
    return;
  }

  console.log(`✅ Found ${data.length} connects:`);
  data.forEach((connect, i) => {
    console.log(`  ${i + 1}. ${connect.connect_id || connect.id}`);
    console.log(`     Lead: ${connect.lead_name || 'N/A'}`);
    console.log(`     Review Status: ${connect.review_status || 'null'}`);
    console.log(`     Production Status: ${connect.production_status || 'N/A'}`);
    console.log('');
  });
}

testDirectQuery().catch(console.error);
