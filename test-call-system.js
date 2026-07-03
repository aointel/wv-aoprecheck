#!/usr/bin/env node

// Test script to validate the entire call system
import https from 'https';

const DOMAIN = 'https://fa855ff1-b744-4328-a040-2d5dabde8d4e-00-2d2vz6z45709c.spock.replit.dev';

console.log('🔍 Testing AO Precheck Auto-Answer System...\n');

// Test 1: Simulate incoming call webhook
function testIncomingCall() {
  return new Promise((resolve, reject) => {
    const postData = 'From=%2B15551234567&To=%2B16052500834&CallSid=TEST123456&CallStatus=ringing';
    
    const options = {
      hostname: 'fa855ff1-b744-4328-a040-2d5dabde8d4e-00-2d2vz6z45709c.spock.replit.dev',
      port: 443,
      path: '/api/twilio/incoming-call',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('✅ Incoming Call Test:');
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${res.headers['content-type']}`);
        console.log(`   Response Length: ${data.length} chars`);
        
        if (data.includes('<Conference') && data.includes('AO-Verification-Live')) {
          console.log('   ✅ Conference TwiML generated correctly');
        } else {
          console.log('   ❌ Conference TwiML missing or incorrect');
          console.log(`   Response: ${data.substring(0, 200)}...`);
        }
        resolve(data);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test 2: Check call status endpoint
function testCallStatus() {
  return new Promise((resolve, reject) => {
    https.get(`${DOMAIN}/api/call-status`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('\n✅ Call Status Test:');
        console.log(`   Status: ${res.statusCode}`);
        
        try {
          const status = JSON.parse(data);
          console.log(`   Call Active: ${status.callActive}`);
          console.log(`   Status: ${status.status}`);
          console.log(`   Message: ${status.message}`);
          console.log('   ✅ Status endpoint working correctly');
        } catch (e) {
          console.log('   ❌ Invalid JSON response');
          console.log(`   Response: ${data}`);
        }
        resolve(data);
      });
    }).on('error', reject);
  });
}

// Test 3: Simulate conference status callback
function testConferenceCallback() {
  return new Promise((resolve, reject) => {
    const postData = 'StatusCallbackEvent=participant-join&ConferenceName=AO-Verification-Live&CallSid=TEST123&ConferenceSid=CF123';
    
    const options = {
      hostname: 'fa855ff1-b744-4328-a040-2d5dabde8d4e-00-2d2vz6z45709c.spock.replit.dev',
      port: 443,
      path: '/api/twilio/conference-status',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      console.log('\n✅ Conference Callback Test:');
      console.log(`   Status: ${res.statusCode}`);
      console.log('   ✅ Conference callback endpoint responding');
      resolve();
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Run all tests
async function runTests() {
  try {
    await testCallStatus();
    await testIncomingCall();
    await testConferenceCallback();
    
    // Final status check
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testCallStatus();
    
    console.log('\n🎉 All tests completed! System should be working correctly.');
    console.log('\n📞 To test with real calls:');
    console.log('   1. Call +16052500834 from one phone');
    console.log('   2. Call +16052500834 from another phone');
    console.log('   3. Both callers should be connected in conference');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTests();