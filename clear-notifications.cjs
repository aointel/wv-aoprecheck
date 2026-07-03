const { createClient } = require('@supabase/supabase-js');

// Supabase configuration (hardcoded, same as test-notifications.cjs)
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function clearNotifications() {
  const agentEmail = 'cnsysop@aoglobelife.com';
  
  console.log(`🗑️  Clearing all notifications for ${agentEmail}...`);
  
  const { data, error } = await supabase
    .from('agent_notifications')
    .delete()
    .eq('agent_email', agentEmail);
  
  if (error) {
    console.error('❌ Error clearing notifications:', error);
    process.exit(1);
  }
  
  console.log(`✅ Cleared all notifications for ${agentEmail}`);
  console.log(`   Deleted ${data?.length || 0} notifications`);
}

clearNotifications();

