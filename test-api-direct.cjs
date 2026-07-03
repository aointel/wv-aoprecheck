/**
 * Test API Directly
 * Simulates what the frontend does with proper headers
 */

const fetch = require('node-fetch');

async function testAPIDirect() {
  console.log('🧪 Testing /api/notifications with headers');
  console.log('');

  const testEmail = 'cnsysop@aoglobelife.com';

  try {
    // Test with headers (like frontend does)
    console.log('1. Testing with user-email header:');
    const response = await fetch('http://localhost:5000/api/notifications?limit=20', {
      credentials: 'include',
      headers: {
        'user-email': testEmail,
        'x-user-email': testEmail,
      },
    });

    console.log('   Status:', response.status);
    const data = await response.json();
    console.log('   Response:', JSON.stringify(data, null, 2));
    console.log('');

    if (response.ok && data.notifications) {
      console.log(`✅ SUCCESS! Found ${data.notifications.length} notifications`);
      console.log(`   Unread count: ${data.unreadCount}`);
      console.log('');
      console.log('📋 First 3 notifications:');
      data.notifications.slice(0, 3).forEach((n, i) => {
        console.log(`   ${i + 1}. [${n.notification_type}] ${n.title}`);
        console.log(`      ${n.message}`);
        console.log(`      Read: ${n.read}`);
        console.log('');
      });
    } else {
      console.log('❌ API returned error or no notifications');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Server is not running! Start it with: npm run dev');
    }
  }
}

testAPIDirect()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

































