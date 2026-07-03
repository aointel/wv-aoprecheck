/**
 * Test Notification Script
 * Sends all notification types to cnsysop@aoglobelife.com for testing
 * 
 * Usage: node test-notifications.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from hardcoded-config
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_AGENT_EMAIL = 'cnsysop@aoglobelife.com';

async function sendTestNotifications() {
  console.log('🧪 Starting notification test for', TEST_AGENT_EMAIL);
  console.log('');

  const notifications = [
    // 1. AO Connect Billing Transaction
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'billing_transaction',
      title: 'AO Connect Charge',
      message: 'You were charged $2.50 (2 credits) for John Smith',
      read: false,
      metadata: {
        transaction_type: 'connect',
        transaction_id: `test-connect-${Date.now()}`,
        amount_usd: 2.50,
        credits_charged: 2,
        lead_name: 'John Smith',
      },
    },
    // 2. AO PreCheck Billing Transaction
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'billing_transaction',
      title: 'AO PreCheck Charge',
      message: 'You were charged $5.00 (5 credits) for Jane Doe',
      read: false,
      metadata: {
        transaction_type: 'precheck',
        transaction_id: `test-precheck-${Date.now()}`,
        amount_usd: 5.00,
        credits_charged: 5,
        lead_name: 'Jane Doe',
      },
    },
    // 3. AO Recruit Billing Transaction
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'billing_transaction',
      title: 'AO Recruit Charge',
      message: 'You were charged $5.00 (5 credits) for Mike Johnson',
      read: false,
      metadata: {
        transaction_type: 'recruit',
        transaction_id: `test-recruit-${Date.now()}`,
        amount_usd: 5.00,
        credits_charged: 5,
        lead_name: 'Mike Johnson',
      },
    },
    // 4. Low Credits Warning
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'credit_low',
      title: 'Low Credit Balance',
      message: 'Your credit balance is $8.50. Consider adding more credits to continue using AOI services.',
      read: false,
      metadata: {
        current_balance: 8.50,
        threshold: 10.00,
      },
    },
    // 5. Missed Call Notification
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'missed_call',
      title: 'Missed Call Alert',
      message: 'You missed a call from Sarah Williams (+15551234567)',
      read: false,
      metadata: {
        phone: '+15551234567',
        lead_name: 'Sarah Williams',
        timestamp: new Date().toISOString(),
      },
    },
    // 6. System Notification
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'system',
      title: 'System Update',
      message: 'New features have been added to Call Connector Pro. Check out the latest updates!',
      read: false,
      metadata: {
        update_version: '1.0.5',
      },
    },
    // 7. Appointment Reminder
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'appointment',
      title: 'Upcoming Appointment',
      message: 'You have an appointment with Robert Brown in 30 minutes',
      read: false,
      metadata: {
        appointment_id: `test-appt-${Date.now()}`,
        client_name: 'Robert Brown',
        scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    },
    // 8. Waiting Room Notification
    {
      agent_email: TEST_AGENT_EMAIL.toLowerCase(),
      notification_type: 'waiting_room',
      title: 'Client in Waiting Room',
      message: 'Emily Davis is waiting in your virtual waiting room',
      read: false,
      metadata: {
        room_id: `test-room-${Date.now()}`,
        client_name: 'Emily Davis',
      },
    },
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const notification of notifications) {
    try {
      const { data, error } = await supabase
        .from('agent_notifications')
        .insert(notification)
        .select();

      if (error) {
        console.error(`❌ Failed to send ${notification.notification_type}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Sent ${notification.notification_type}: "${notification.title}"`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Error sending ${notification.notification_type}:`, error.message);
      errorCount++;
    }
  }

  console.log('');
  console.log('📊 Test Results:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📧 Total: ${notifications.length}`);
  console.log('');
  console.log('🎯 Check the notification bell in the app to see these notifications!');
  console.log('   URL: http://localhost:5000');
}

// Run the test
sendTestNotifications()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

































