// Test script to verify agent_live_call_status updates in Supabase
// Usage: node test-agent-status-api.mjs <agent_email> <status>
// Example: node test-agent-status-api.mjs test@example.com ready

import fetch from 'node-fetch';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_EMAIL = process.argv[2] || 'test@aoglobelife.com';
const STATUS = process.argv[3] || 'ready';

console.log('🧪 Testing agent_live_call_status updates\n');
console.log(`Server: ${SERVER_URL}`);
console.log(`Agent Email: ${AGENT_EMAIL}`);
console.log(`Status: ${STATUS}\n`);

// Test 1: Presence endpoint
async function testPresenceEndpoint() {
  console.log('📡 Test 1: POST /agent/presence');
  try {
    const response = await fetch(`${SERVER_URL}/agent/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_email: AGENT_EMAIL,
        status: STATUS
      })
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('   ✅ SUCCESS\n');
      return true;
    } else {
      console.log('   ❌ FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ ERROR:', error.message);
    console.log('');
    return false;
  }
}

// Test 2: Heartbeat endpoint
async function testHeartbeatEndpoint() {
  console.log('💓 Test 2: POST /api/call-connector-pro/heartbeat');
  try {
    const response = await fetch(`${SERVER_URL}/api/call-connector-pro/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentEmail: AGENT_EMAIL,
        status: STATUS,
        sessionId: 'test-session-' + Date.now()
      })
    });

    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('   ✅ SUCCESS\n');
      return true;
    } else {
      console.log('   ❌ FAILED\n');
      return false;
    }
  } catch (error) {
    console.error('   ❌ ERROR:', error.message);
    console.log('');
    return false;
  }
}

// Test 3: Check Supabase directly (requires Supabase client)
async function checkSupabaseDirectly() {
  console.log('🔍 Test 3: Check Supabase directly');
  console.log('   ⚠️  Run the SQL query in test-agent-live-status-updates.sql');
  console.log('   Query: SELECT * FROM agent_live_call_status WHERE agent_email = \'' + AGENT_EMAIL + '\';\n');
}

// Main test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('Starting Tests...\n');
  
  const test1 = await testPresenceEndpoint();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  const test2 = await testHeartbeatEndpoint();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  checkSupabaseDirectly();
  
  console.log('='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`   Presence Endpoint: ${test1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Heartbeat Endpoint: ${test2 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Check server logs for update confirmations');
  console.log('   2. Run SQL query in Supabase to verify record exists');
  console.log('   3. Check that agent has CCPRO = true in customers table');
  console.log('\n');
}

runTests().catch(console.error);

