const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnoseLiveCallBoard() {
  console.log('🔍 DIAGNOSING LIVE CALL BOARD MAINTENANCE...\n');
  console.log('='.repeat(80));
  
  try {
    // 1. Check if sync function exists by trying to call it
    console.log('\n1️⃣ Testing if sync function exists...');
    const { data: syncTest, error: syncTestError } = await supabase.rpc('update_live_call_board_stats_from_metrics');
    
    if (syncTestError) {
      console.log('   ❌ Sync function does NOT exist or has errors!');
      console.log('   Error:', syncTestError.message);
      console.log('   ⚠️  Need to run update-live-call-board-from-agent-dial-metrics.sql in Supabase SQL editor');
    } else {
      console.log('   ✅ Sync function exists and can be called');
    }
    
    // 2. Note about triggers and cron (need SQL access to check)
    console.log('\n2️⃣ SQL Objects Status:');
    console.log('   ⚠️  Cannot check triggers/functions/cron via API (need direct SQL access)');
    console.log('   Expected triggers:');
    console.log('     - trigger_update_live_call_board_on_metric_insert');
    console.log('     - trigger_update_live_call_board_on_metric_update');
    console.log('   Expected functions:');
    console.log('     - update_live_call_board_stats_from_metrics()');
    console.log('     - update_live_call_board_stats_for_agent(text)');
    console.log('   Expected cron job:');
    console.log('     - Running every minute: SELECT update_live_call_board_stats_from_metrics()');
    console.log('   ⚠️  Check Supabase Dashboard > Database > SQL Editor to verify these exist');
    
    // 4. Get sample of agents and check their stats
    console.log('\n4️⃣ Checking sample agents\' stats...');
    
    // Get a few agents from live_call_board
    const { data: sampleAgents, error: sampleError } = await supabase
      .from('live_call_board')
      .select('agent_email, today_dialed, today_reached, today_booked, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (sampleError) {
      console.error('   ❌ Error:', sampleError);
    } else {
      console.log(`   📊 Sample of ${sampleAgents.length} agents from live_call_board:`);
      sampleAgents.forEach(agent => {
        const age = Math.round((Date.now() - new Date(agent.updated_at).getTime()) / 1000 / 60);
        console.log(`      ${agent.agent_email}:`);
        console.log(`         Dialed: ${agent.today_dialed}, Reached: ${agent.today_reached}, Booked: ${agent.today_booked}`);
        console.log(`         Last updated: ${age} minutes ago`);
      });
    }
    
    // 5. Check recent agent_dial_metrics activity
    console.log('\n5️⃣ Checking recent agent_dial_metrics activity...');
    const { data: recentMetrics, error: metricsError } = await supabase
      .from('agent_dial_metrics')
      .select('agent_email, event_type, event_timestamp')
      .order('event_timestamp', { ascending: false })
      .limit(10);
    
    if (metricsError) {
      console.error('   ❌ Error:', metricsError);
    } else {
      console.log(`   📊 Last ${recentMetrics.length} metrics logged:`);
      recentMetrics.forEach(metric => {
        const age = Math.round((Date.now() - new Date(metric.event_timestamp).getTime()) / 1000 / 60);
        console.log(`      ${metric.agent_email}: ${metric.event_type} (${age} minutes ago)`);
      });
    }
    
    // 6. Manual sync recommendation
    console.log('\n6️⃣ Manual Sync Recommendation:');
    if (syncTestError) {
      console.log('   ❌ Cannot run sync - function does not exist');
      console.log('   ⚠️  First install functions from update-live-call-board-from-agent-dial-metrics.sql');
    } else {
      console.log('   ✅ Sync function is available');
      console.log('   💡 You can manually trigger sync via:');
      console.log('      POST /api/live-call-board/sync-today-stats');
      console.log('   Or in SQL: SELECT update_live_call_board_stats_from_metrics();');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SUMMARY:');
    console.log('   The live_call_board should be maintained by:');
    console.log('   1. SQL triggers on agent_dial_metrics (real-time updates)');
    console.log('   2. Periodic cron job running update_live_call_board_stats_from_metrics() every minute');
    console.log('   3. Manual sync via POST /api/live-call-board/sync-today-stats');
    console.log('\n   If triggers/functions are missing, run update-live-call-board-from-agent-dial-metrics.sql');
    console.log('   If cron job is missing, set it up in Supabase Dashboard > Database > Cron Jobs\n');
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
}

diagnoseLiveCallBoard();

