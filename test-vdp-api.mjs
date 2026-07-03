// Test VDP API endpoints
import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_EMAIL = 'cnsysop@aoglobelife.com';
const EXPECTED_ASSOCIATE_ID = '1253';

console.log('🧪 Testing VDP API endpoints...\n');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Test Email: ${TEST_EMAIL}`);
console.log(`Expected Associate ID: ${EXPECTED_ASSOCIATE_ID}\n`);

// Test /api/vdp/set-online
async function testSetOnline() {
  console.log('📡 Testing /api/vdp/set-online...');
  try {
    const response = await fetch(`${BASE_URL}/api/vdp/set-online`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL })
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error body: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('✅ Response received:');
    console.log(JSON.stringify(data, null, 2));
    
    // Validate response
    if (data.success && data.command === 'open') {
      console.log('\n✅ API Response Valid:');
      console.log(`   - Command: ${data.command}`);
      console.log(`   - Agent ID: ${data.agentId}`);
      console.log(`   - Associate ID: ${data.associate_id}`);
      console.log(`   - States: ${JSON.stringify(data.params.states)}`);
      console.log(`   - Market: ${data.params.market}`);
      
      if (String(data.associate_id) === EXPECTED_ASSOCIATE_ID) {
        console.log(`\n✅ Associate ID matches expected: ${EXPECTED_ASSOCIATE_ID}`);
      } else {
        console.log(`\n⚠️ Associate ID mismatch! Expected: ${EXPECTED_ASSOCIATE_ID}, Got: ${data.associate_id}`);
      }
    } else {
      console.log('\n❌ Invalid response format');
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Server is not running. Start the server first.');
    }
  }
}

// Test /api/vdp/set-offline
async function testSetOffline() {
  console.log('\n📡 Testing /api/vdp/set-offline...');
  try {
    const response = await fetch(`${BASE_URL}/api/vdp/set-offline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL })
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error body: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log('✅ Response received:');
    console.log(JSON.stringify(data, null, 2));
    
    // Validate response
    if (data.success && data.command === 'disconnect') {
      console.log('\n✅ API Response Valid:');
      console.log(`   - Command: ${data.command}`);
      console.log(`   - Message: ${data.message}`);
    } else {
      console.log('\n❌ Invalid response format');
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Server is not running. Start the server first.');
    }
  }
}

// Run tests
async function runTests() {
  await testSetOnline();
  await testSetOffline();
  console.log('\n✅ Tests completed');
}

runTests().catch(console.error);
