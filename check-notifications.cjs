/**
 * Check Notifications Script
 * Verifies notifications exist in database for cnsysop@aoglobelife.com
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const TEST_AGENT_EMAIL = 'cnsysop@aoglobelife.com';

async function checkNotifications() {
  console.log('🔍 Checking notifications for', TEST_AGENT_EMAIL);
  console.log('');

  try {
    // Check all notifications
    const { data: allNotifications, error: allError } = await supabase
      .from('agent_notifications')
      .select('*')
      .eq('agent_email', TEST_AGENT_EMAIL.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(20);

    if (allError) {
      console.error('❌ Error fetching notifications:', allError);
      return;
    }

    console.log(`📊 Found ${allNotifications?.length || 0} total notifications`);
    console.log('');

    // Check unread notifications
    const { data: unreadNotifications, error: unreadError } = await supabase
      .from('agent_notifications')
      .select('*')
      .eq('agent_email', TEST_AGENT_EMAIL.toLowerCase())
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (unreadError) {
      console.error('❌ Error fetching unread notifications:', unreadError);
      return;
    }

    console.log(`🔔 Found ${unreadNotifications?.length || 0} unread notifications`);
    console.log('');

    if (unreadNotifications && unreadNotifications.length > 0) {
      console.log('📋 Unread Notifications:');
      unreadNotifications.forEach((notif, index) => {
        console.log(`   ${index + 1}. [${notif.notification_type}] ${notif.title}`);
        console.log(`      ${notif.message}`);
        console.log(`      Created: ${new Date(notif.created_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('⚠️ No unread notifications found');
      console.log('');
      
      if (allNotifications && allNotifications.length > 0) {
        console.log('📋 Recent Notifications (all read):');
        allNotifications.slice(0, 5).forEach((notif, index) => {
          console.log(`   ${index + 1}. [${notif.notification_type}] ${notif.title} ${notif.read ? '(READ)' : '(UNREAD)'}`);
          console.log(`      Created: ${new Date(notif.created_at).toLocaleString()}`);
        });
      }
    }

    // Test the API endpoint format
    console.log('');
    console.log('🧪 Testing API endpoint format...');
    console.log('   Email used in query:', TEST_AGENT_EMAIL.toLowerCase());
    console.log('   Expected format: agent_email =', TEST_AGENT_EMAIL.toLowerCase());

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkNotifications()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

































