/**
 * Verify Notifications Table Structure
 * Checks if table exists and has correct schema
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const TEST_AGENT_EMAIL = 'cnsysop@aoglobelife.com';

async function verifyTable() {
  console.log('🔍 Verifying agent_notifications table...');
  console.log('');

  try {
    // Try to query the table
    const { data, error, count } = await supabase
      .from('agent_notifications')
      .select('*', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      console.error('❌ Table query error:', error);
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      
      if (error.code === '42P01') {
        console.error('');
        console.error('🚨 TABLE DOES NOT EXIST!');
        console.error('   Run: create-agent-notifications-table.sql');
        return;
      }
      return;
    }

    console.log('✅ Table exists');
    console.log('   Total rows:', count || 0);
    console.log('');

    // Get a sample notification to see structure
    const { data: sample, error: sampleError } = await supabase
      .from('agent_notifications')
      .select('*')
      .eq('agent_email', TEST_AGENT_EMAIL.toLowerCase())
      .limit(1)
      .single();

    if (sampleError && sampleError.code !== 'PGRST116') {
      console.error('❌ Error fetching sample:', sampleError);
    } else if (sample) {
      console.log('📋 Sample notification structure:');
      console.log(JSON.stringify(sample, null, 2));
      console.log('');
    }

    // Check for cnsysop notifications specifically
    const { data: cnsysopNotifications, error: cnsysopError, count: cnsysopCount } = await supabase
      .from('agent_notifications')
      .select('*', { count: 'exact' })
      .eq('agent_email', TEST_AGENT_EMAIL.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(5);

    if (cnsysopError) {
      console.error('❌ Error fetching cnsysop notifications:', cnsysopError);
    } else {
      console.log(`📊 Notifications for ${TEST_AGENT_EMAIL}:`);
      console.log(`   Total: ${cnsysopCount || 0}`);
      console.log(`   Recent (last 5):`);
      if (cnsysopNotifications && cnsysopNotifications.length > 0) {
        cnsysopNotifications.forEach((n, i) => {
          console.log(`   ${i + 1}. [${n.notification_type}] ${n.title} (read: ${n.read})`);
        });
      } else {
        console.log('   No notifications found');
      }
      console.log('');
    }

    // Test the exact query the API uses
    console.log('🧪 Testing API query format:');
    const { data: apiTest, error: apiTestError, count: apiTestCount } = await supabase
      .from('agent_notifications')
      .select('*', { count: 'exact' })
      .eq('agent_email', TEST_AGENT_EMAIL.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(20);

    if (apiTestError) {
      console.error('❌ API query test failed:', apiTestError);
    } else {
      console.log(`   ✅ Query works - Found ${apiTestCount || 0} notifications`);
      console.log(`   ✅ Returned ${apiTest?.length || 0} rows`);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

verifyTable()
  .then(() => {
    console.log('✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });

































