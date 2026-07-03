/**
 * Test the new /api/agent/associate-id endpoint
 */

const fetch = require('node-fetch');

async function testEndpoint() {
  console.log('\n🧪 TESTING /api/agent/associate-id ENDPOINT');
  console.log('═'.repeat(70));
  
  // Test with a few different emails
  const testEmails = [
    'chrislafond@aoglobelife.com',  // Should return real associate_id
    'martintoma@aoglobelife.com',   // Should return real associate_id
    'invalid@test.com'               // Should return 999 (not found)
  ];
  
  for (const email of testEmails) {
    console.log(`\n📧 Testing: ${email}`);
    
    try {
      // Update this to your server URL - use localhost if testing locally
      const serverUrl = 'http://localhost:5000'; // Change to your Railway URL if deployed
      const response = await fetch(`${serverUrl}/api/agent/associate-id?email=${encodeURIComponent(email)}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Response:`, data);
        console.log(`  📊 associate_id: ${data.associate_id}`);
        console.log(`  🔍 Found in database: ${data.found}`);
      } else {
        console.log(`  ❌ Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`  ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('✅ TEST COMPLETE');
  console.log('═'.repeat(70) + '\n');
  console.log('💡 TIP: If you get connection errors, make sure your server is running!');
  console.log('   Run: npm run dev');
  console.log('');
}

testEndpoint();

