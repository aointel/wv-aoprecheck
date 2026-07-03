/**
 * Check for email case/normalization mismatches
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const agentEmail = 'stevenpenawhalen@aoglobelife.com';

async function checkEmailMismatch() {
  try {
    console.log(`🔍 Checking email variations for: ${agentEmail}\n`);

    // Check all variations
    const variations = [
      agentEmail,
      agentEmail.toLowerCase(),
      agentEmail.toUpperCase(),
      agentEmail.trim(),
      agentEmail.toLowerCase().trim()
    ];

    for (const email of variations) {
      console.log(`\n📧 Checking: "${email}"`);
      
      // Check hierarchy
      const { data: hierarchy } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email')
        .eq('agent_email', email)
        .maybeSingle();
      console.log(`   Hierarchy: ${hierarchy ? '✅ Found' : '❌ Not found'}`);
      
      // Check live_call_boardt
      const { data: board } = await supabaseAdmin
        .from('live_call_boardt')
        .select('agent_email, today_dialed, today_reached, today_booked')
        .eq('agent_email', email)
        .maybeSingle();
      if (board) {
        console.log(`   Live Board: ✅ Found - dialed: ${board.today_dialed}, reached: ${board.today_reached}, booked: ${board.today_booked}`);
      } else {
        console.log(`   Live Board: ❌ Not found`);
      }
      
      // Check with ilike (case insensitive)
      const { data: boardIlike } = await supabaseAdmin
        .from('live_call_boardt')
        .select('agent_email, today_dialed')
        .ilike('agent_email', email)
        .maybeSingle();
      if (boardIlike) {
        console.log(`   Live Board (ilike): ✅ Found - dialed: ${boardIlike.today_dialed}, actual email: ${boardIlike.agent_email}`);
      }
    }

    // Check what emails actually exist in live_call_boardt that are similar
    console.log('\n🔍 Searching for similar emails in live_call_boardt...');
    const { data: similar } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_dialed, today_reached, today_booked')
      .ilike('agent_email', `%stevenpenawhalen%`)
      .limit(5);
    
    if (similar && similar.length > 0) {
      console.log(`   Found ${similar.length} similar emails:`);
      similar.forEach(row => {
        console.log(`      "${row.agent_email}" - dialed: ${row.today_dialed}, reached: ${row.today_reached}, booked: ${row.today_booked}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkEmailMismatch();
