/**
 * Ensure triggers are enabled and SQL functions are correct
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function ensureTriggersEnabled() {
  try {
    console.log('🔧 Ensuring triggers are enabled and functions are correct...\n');

    // Read the SQL file
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const sqlFile = path.join(__dirname, 'fix-reached-calculation-now.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Execute SQL via REST API (Supabase doesn't support DDL via client)
    console.log('⚠️ Cannot execute DDL via Supabase client');
    console.log('📄 Please run fix-reached-calculation-now.sql in Supabase SQL Editor');
    console.log('\nAfter running the SQL, the triggers will automatically update stats when:');
    console.log('  - New agent_dial_metrics are inserted');
    console.log('  - agent_dial_metrics are updated (event_type, call_status, disposition changes)');
    console.log('\nThe function update_live_call_boardt_stats_for_agent() will be called automatically.');

    // But we can verify triggers exist by checking if we can call the function
    console.log('\n🧪 Testing if function exists by calling it for a test agent...');
    const { error: testError } = await supabaseAdmin.rpc('update_live_call_boardt_stats_for_agent', {
      p_agent_email: 'system@aoglobelife.com'
    });

    if (testError) {
      console.error('❌ Function test failed:', testError);
      console.log('\n⚠️ The SQL function may not exist. Please run fix-reached-calculation-now.sql');
    } else {
      console.log('✅ Function exists and can be called');
    }

    // Run the main update function to sync all stats
    console.log('\n🔄 Running update_live_call_boardt_stats_from_metrics() to sync all stats...');
    const { error: updateError } = await supabaseAdmin.rpc('update_live_call_boardt_stats_from_metrics');

    if (updateError) {
      console.error('❌ Failed to run update function:', updateError);
      console.log('\n⚠️ The SQL function may not exist. Please run fix-reached-calculation-now.sql');
    } else {
      console.log('✅ Successfully ran update function - all stats should now be synced');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

ensureTriggersEnabled();
