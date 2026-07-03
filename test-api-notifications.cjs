/**
 * Test API Notifications Endpoint
 * Simulates what the frontend does to fetch notifications
 */

const fetch = require('node-fetch');

async function testNotificationsAPI() {
  console.log('🧪 Testing /api/notifications endpoint');
  console.log('');

  try {
    // Test without session (should fail)
    console.log('1. Testing without session (should fail):');
    const response1 = await fetch('http://localhost:5000/api/notifications?limit=20', {
      credentials: 'include',
    });
    const data1 = await response1.json();
    console.log('   Status:', response1.status);
    console.log('   Response:', JSON.stringify(data1, null, 2));
    console.log('');

    // Check if server is running
    console.log('2. Testing server health:');
    const healthResponse = await fetch('http://localhost:5000/health');
    const healthData = await healthResponse.json();
    console.log('   Status:', healthResponse.status);
    console.log('   Response:', JSON.stringify(healthData, null, 2));
    console.log('');

    console.log('💡 To test with authentication:');
    console.log('   1. Open http://localhost:5000 in browser');
    console.log('   2. Log in as cnsysop@aoglobelife.com');
    console.log('   3. Open browser DevTools (F12)');
    console.log('   4. Go to Console tab');
    console.log('   5. Run: fetch("/api/notifications?limit=20", {credentials: "include"}).then(r => r.json()).then(console.log)');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Server is not running! Start it with: npm run dev');
    }
  }
}

testNotificationsAPI()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

































