/**
 * Test Single Notification Script
 * Sends ONE notification to test the alert experience
 * 
 * Usage: node test-single-notification.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration (hardcoded, same as test-notifications.cjs)
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_AGENT_EMAIL = 'cnsysop@aoglobelife.com';

async function sendSingleNotification() {
  console.log('🧪 Sending ONE test notification to', TEST_AGENT_EMAIL);
  console.log('');

  // Send one regular notification
  const notification = {
    agent_email: TEST_AGENT_EMAIL.toLowerCase(),
    notification_type: 'billing_transaction',
    title: 'AO Connect Charge',
    message: 'You were charged $2.50 (2 credits) for John Smith',
    read: false,
    urgent: false,
    metadata: {
      transaction_type: 'connect',
      transaction_id: `test-connect-${Date.now()}`,
      amount_usd: 2.50,
      credits_charged: 2,
      lead_name: 'John Smith',
    },
  };

  try {
    const { data, error } = await supabase
      .from('agent_notifications')
      .insert(notification)
      .select();

    if (error) {
      console.error('❌ Failed to send notification:', error.message);
      process.exit(1);
    } else {
      console.log('✅ Sent notification:');
      console.log(`   Type: ${notification.notification_type}`);
      console.log(`   Title: "${notification.title}"`);
      console.log(`   Message: "${notification.message}"`);
      console.log('');
      console.log('🎯 Watch for:');
      console.log('   - Sound alert (single beep)');
      console.log('   - Bell icon pulsing');
      console.log('   - Toast notification popup');
      console.log('   - Notification appears in dropdown');
      console.log('');
      console.log('💡 Click "Got it" in the toast or click the notification to dismiss it!');
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    process.exit(1);
  }
}

// Run the test
sendSingleNotification()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

































