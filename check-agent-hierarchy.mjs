/**
 * Check if agent is in hierarchy and what filters might exclude them
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const agentEmail = 'stevenpenawhalen@aoglobelife.com';

async function checkHierarchy() {
  try {
    console.log(`🔍 Checking hierarchy for: ${agentEmail}\n`);

    // Check if agent is in agent_hierarchy
    const { data: hierarchy, error: hierarchyError } = await supabaseAdmin
      .from('agent_hierarchy')
      .select('*')
      .eq('agent_email', agentEmail)
      .maybeSingle();

    if (hierarchyError) {
      console.error('❌ Error fetching hierarchy:', hierarchyError);
    } else if (hierarchy) {
      console.log('✅ Agent found in agent_hierarchy:');
      console.log(`   MGA: ${hierarchy.mga_name || 'null'} (ID: ${hierarchy.mga_associate_id || 'null'})`);
      console.log(`   RGA: ${hierarchy.rga_name || 'null'} (ID: ${hierarchy.rga_associate_id || 'null'})`);
      console.log(`   Agent Name: ${hierarchy.agent_name || 'null'}`);
    } else {
      console.log('❌ Agent NOT found in agent_hierarchy!');
      console.log('   This means they won\'t show up in the live call board.');
      console.log('   They need to be added to agent_hierarchy table.');
    }

    // Check live_call_boardt
    const { data: boardStats } = await supabaseAdmin
      .from('live_call_boardt')
      .select('*')
      .eq('agent_email', agentEmail)
      .maybeSingle();

    if (boardStats) {
      console.log('\n✅ Agent found in live_call_boardt:');
      console.log(`   Dialed: ${boardStats.today_dialed || 0}`);
      console.log(`   Reached: ${boardStats.today_reached || 0}`);
      console.log(`   Booked: ${boardStats.today_booked || 0}`);
      console.log(`   Instant Pres: ${boardStats.today_instant_presentation || 0}`);
    } else {
      console.log('\n❌ Agent NOT found in live_call_boardt!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkHierarchy();
