/**
 * Run the fix SQL and update stats immediately
 * This calls the update function to refresh all stats
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runFixAndUpdate() {
  try {
    console.log('🔄 Running stats update function...\n');

    // Call the update function directly
    const { data, error } = await supabaseAdmin.rpc('update_live_call_boardt_stats_from_metrics');

    if (error) {
      console.error('❌ Error calling update function:', error);
      console.error('\n⚠️ This means the SQL functions may not have been updated yet.');
      console.error('📄 You MUST run fix-reached-calculation-now.sql in Supabase SQL Editor first!');
      console.error('   1. Go to Supabase Dashboard');
      console.error('   2. Open SQL Editor');
      console.error('   3. Copy/paste the contents of fix-reached-calculation-now.sql');
      console.error('   4. Run it');
      console.error('   5. Then run this script again\n');
      process.exit(1);
    }

    console.log('✅ Stats update function executed successfully!\n');

    // Verify by checking a sample agent's stats
    console.log('📊 Checking sample stats...');
    const { data: sampleStats, error: statsError } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_dialed, today_reached, today_booked, today_instant_presentation')
      .not('agent_email', 'is', null)
      .limit(5);

    if (statsError) {
      console.error('❌ Error fetching stats:', statsError);
    } else if (sampleStats && sampleStats.length > 0) {
      console.log('\n📈 Sample Agent Stats:');
      sampleStats.forEach(stat => {
        console.log(`   ${stat.agent_email}:`);
        console.log(`      Dialed: ${stat.today_dialed || 0}`);
        console.log(`      Reached: ${stat.today_reached || 0}`);
        console.log(`      Booked: ${stat.today_booked || 0}`);
        console.log(`      Instant Pres: ${stat.today_instant_presentation || 0}`);
      });
    } else {
      console.log('⚠️ No agent stats found');
    }

    console.log('\n✅ Done! Stats have been updated.');
    console.log('📊 The live call board should now show correct reached/booked/instant_presentation counts');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run it
runFixAndUpdate();
