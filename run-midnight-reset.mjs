/**
 * Manually trigger the midnight reset for live call board stats
 * This resets all stats to 0 and immediately recalculates from scratch
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetAllStats() {
  try {
    console.log('🔄 Starting midnight reset: Resetting all stats to 0 and recalculating...\n');

    // Step 1: Reset all outbound stats to 0
    console.log('📊 Step 1: Resetting all outbound stats to 0...');
    const { error: resetError } = await supabaseAdmin
      .from('live_call_boardt')
      .update({
        today_dialed: 0,
        today_reached: 0,
        today_booked: 0,
        today_instant_presentation: 0,
        today_presentations: 0,
        today_sales: 0,
        updated_at: new Date().toISOString()
      })
      .neq('agent_email', '');

    if (resetError) {
      throw new Error(`Failed to reset outbound stats: ${resetError.message}`);
    }
    console.log('✅ All outbound stats reset to 0\n');

    // Step 2: Reset recruit stats to 0
    console.log('📊 Step 2: Resetting all recruit stats to 0...');
    const { error: recruitResetError } = await supabaseAdmin
      .from('live_call_boardt_recruit')
      .update({
        today_dialed: 0,
        today_reached: 0,
        today_booked: 0,
        today_connects: 0,
        updated_at: new Date().toISOString()
      })
      .neq('agent_email', '');

    if (recruitResetError) {
      throw new Error(`Failed to reset recruit stats: ${recruitResetError.message}`);
    }
    console.log('✅ All recruit stats reset to 0\n');

    // Step 3: Recalculate stats using SQL functions
    console.log('📊 Step 3: Recalculating stats from agent_dial_metrics and twilio_call_logs...');
    
    // Call the SQL function to recalculate outbound stats
    const { error: rpcError } = await supabaseAdmin
      .rpc('update_live_call_boardt_stats_from_metrics');

    if (rpcError) {
      throw new Error(`SQL function failed: ${rpcError.message}`);
    }
    console.log('✅ Outbound stats recalculated\n');

    // Recalculate recruit stats
    const { error: recruitRpcError } = await supabaseAdmin
      .rpc('update_live_call_boardt_recruit_stats_all');

    if (recruitRpcError) {
      console.error('⚠️ Recruit stats recalculation failed:', recruitRpcError);
    } else {
      console.log('✅ Recruit stats recalculated\n');
    }

    // Recalculate recruit connects
    const { error: connectsRpcError } = await supabaseAdmin
      .rpc('update_live_call_boardt_recruit_connects');

    if (connectsRpcError) {
      console.error('⚠️ Recruit connects recalculation failed:', connectsRpcError);
    } else {
      console.log('✅ Recruit connects recalculated\n');
    }

    console.log('✅ Midnight reset complete! All stats have been reset and recalculated from scratch.');

  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }
}

// Run it
resetAllStats();
