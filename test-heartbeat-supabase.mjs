#!/usr/bin/env node

/**
 * Test script to verify heartbeat endpoint updates Supabase correctly
 * Run: node test-heartbeat-supabase.mjs <email>
 */

const testEmail = process.argv[2] || 'toddpalmer@aoglobelife.com';
const baseUrl = process.env.API_URL || 'http://localhost:5000';

console.log(`🧪 Testing heartbeat for: ${testEmail}`);
console.log(`📍 API URL: ${baseUrl}\n`);

async function testHeartbeat() {
  try {
    // Step 1: Send heartbeat
    console.log('📤 Step 1: Sending heartbeat...');
    const heartbeatResponse = await fetch(`${baseUrl}/api/call-connector-pro/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentEmail: testEmail,
        userEmail: testEmail,
        isActive: true,
        timestamp: new Date().toISOString()
      })
    });

    const heartbeatData = await heartbeatResponse.json();
    console.log('✅ Heartbeat Response:', JSON.stringify(heartbeatData, null, 2));

    if (!heartbeatResponse.ok) {
      console.error('❌ Heartbeat failed:', heartbeatData);
      return;
    }

    // Step 2: Wait a moment for Supabase to update
    console.log('\n⏳ Waiting 1 second for Supabase to update...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Check Supabase directly
    console.log('\n📥 Step 2: Checking Supabase...');
    const checkResponse = await fetch(`${baseUrl}/api/debug/agent-live-status?agent_email=${encodeURIComponent(testEmail)}`);
    const checkData = await checkResponse.json();
    
    console.log('✅ Supabase Data:', JSON.stringify(checkData, null, 2));

    if (checkData.records && checkData.records.length > 0) {
      const record = checkData.records[0];
      const now = new Date();
      const lastHeartbeat = new Date(record.last_heartbeat_at);
      const secondsAgo = Math.floor((now - lastHeartbeat) / 1000);
      
      console.log(`\n📊 Results:`);
      console.log(`   Email: ${record.agent_email}`);
      console.log(`   Status: ${record.status}`);
      console.log(`   Last Heartbeat: ${record.last_heartbeat_at}`);
      console.log(`   Updated At: ${record.updated_at}`);
      console.log(`   Seconds Ago: ${secondsAgo}s`);
      
      if (secondsAgo < 5) {
        console.log(`\n✅ SUCCESS: Heartbeat is updating Supabase correctly!`);
      } else {
        console.log(`\n⚠️ WARNING: Last heartbeat is ${secondsAgo} seconds old (might be stale)`);
      }
    } else {
      console.error('\n❌ ERROR: No record found in Supabase!');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

// Run test every 5 seconds
console.log('🔄 Running test every 5 seconds. Press Ctrl+C to stop.\n');
testHeartbeat();
setInterval(testHeartbeat, 5000);

