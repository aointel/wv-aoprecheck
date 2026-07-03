import fetch from 'node-fetch';

/**
 * Test what the webhook actually returns
 */

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const TEST_PHONE = '5032018470';

async function testWebhookResponse() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING WEBHOOK RESPONSE');
  console.log('='.repeat(70));
  console.log('');

  // Test 1: Direct call (To parameter)
  console.log('1️⃣ Testing DIRECT CALL (To parameter)...');
  try {
    const testBody = {
      Caller: 'client:test@example.com',
      To: TEST_PHONE,
      From: 'client:test@example.com',
      CallSid: 'CA_TEST_DIRECT_' + Date.now(),
      agentEmail: 'test@example.com',
      leadName: 'Test Lead',
      leadState: 'OR'
    };
    
    const response = await fetch(`${SERVER_URL}/webhook/webrtc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(testBody as any).toString()
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response (first 500 chars):`);
    console.log(responseText.substring(0, 500));
    console.log('');
    
    if (responseText.includes(`<Number>${TEST_PHONE}</Number>`)) {
      console.log('   ✅ Contains <Number> with correct phone');
    } else if (responseText.includes('<Dial>')) {
      console.log('   ⚠️  Contains <Dial> but wrong number or missing <Number>');
    } else if (responseText.includes('<Reject')) {
      console.log('   ❌ PROBLEM: Call was REJECTED');
    } else {
      console.log('   ❌ PROBLEM: No valid TwiML response');
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('');

  // Test 2: Conference call
  console.log('2️⃣ Testing CONFERENCE CALL (conference parameter)...');
  try {
    const testBody = {
      Caller: 'client:test@example.com',
      From: 'client:test@example.com',
      CallSid: 'CA_TEST_CONF_' + Date.now(),
      conference: 'Test-Conference-123',
      agentEmail: 'test@example.com',
      agentName: 'Test Agent'
    };
    
    const response = await fetch(`${SERVER_URL}/webhook/webrtc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(testBody as any).toString()
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response (first 500 chars):`);
    console.log(responseText.substring(0, 500));
    console.log('');
    
    if (responseText.includes('<Conference>')) {
      console.log('   ✅ Contains <Conference>');
      if (responseText.includes('Test-Conference-123')) {
        console.log('   ✅ Conference name matches');
      }
    } else if (responseText.includes('<Reject')) {
      console.log('   ❌ PROBLEM: Call was REJECTED');
    } else {
      console.log('   ❌ PROBLEM: No valid TwiML response');
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('');

  // Test 3: Missing Caller (should be rejected)
  console.log('3️⃣ Testing MISSING CALLER (should be rejected)...');
  try {
    const testBody = {
      To: TEST_PHONE,
      CallSid: 'CA_TEST_NO_CALLER_' + Date.now()
    };
    
    const response = await fetch(`${SERVER_URL}/webhook/webrtc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(testBody as any).toString()
    });
    
    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}`);
    
    if (response.status === 403 && responseText.includes('<Reject')) {
      console.log('   ✅ Correctly rejected (expected)');
    } else {
      console.log('   ⚠️  Should have been rejected but wasn\'t');
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('✅ DIAGNOSTIC COMPLETE');
  console.log('='.repeat(70));
}

testWebhookResponse();
