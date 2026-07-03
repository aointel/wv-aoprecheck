/**
 * Test the /api/live-call-board/agents endpoint to see what it returns
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const agentEmail = 'stevenpenawhalen@aoglobelife.com';

async function testAPI() {
  try {
    console.log(`🔍 Testing what the API would return for: ${agentEmail}\n`);

    // Simulate what the agents endpoint does
    // Check if agent is in hierarchy
    const { data: hierarchy } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('agent_email, mga_associate_id, rga_associate_id')
      .eq('agent_email', agentEmail)
      .maybeSingle();

    if (!hierarchy) {
      console.log('❌ Agent not in hierarchy - won\'t show in API response');
      return;
    }

    console.log('✅ Agent in hierarchy');
    console.log(`   MGA ID: ${hierarchy.mga_associate_id || 'null'}`);
    console.log(`   RGA ID: ${hierarchy.rga_associate_id || 'null'}\n`);

    // Check live_call_boardt
    const { data: boardStats } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_dialed, today_reached, today_booked, today_instant_presentation')
      .eq('agent_email', agentEmail)
      .maybeSingle();

    if (boardStats) {
      console.log('✅ Stats from live_call_boardt:');
      console.log(`   Dialed: ${boardStats.today_dialed || 0}`);
      console.log(`   Reached: ${boardStats.today_reached || 0}`);
      console.log(`   Booked: ${boardStats.today_booked || 0}`);
      console.log(`   Instant Pres: ${boardStats.today_instant_presentation || 0}\n`);
      
      console.log('📊 This is what the API should return:');
      console.log(`   todayStats: {`);
      console.log(`     dialed: ${boardStats.today_dialed || 0},`);
      console.log(`     reached: ${boardStats.today_reached || 0},`);
      console.log(`     booked: ${boardStats.today_booked || 0}`);
      console.log(`   }`);
      
      if (boardStats.today_dialed === 0 && boardStats.today_reached > 0) {
        console.log('\n⚠️ PROBLEM: Dialed is 0 but reached is > 0!');
        console.log('   This means the SQL function might not be counting dials correctly.');
        console.log('   Or the agent has reached/booked events but no valid dial events in twilio_call_logs.');
      }
    } else {
      console.log('❌ Agent not in live_call_boardt');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAPI();
