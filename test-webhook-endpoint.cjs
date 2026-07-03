/**
 * Test the Twilio webhook endpoint to see if it's working
 */

const https = require('https');

const url = 'https://aoirail-production.up.railway.app/api/twilio/call-status';

console.log('\n🧪 TESTING TWILIO WEBHOOK ENDPOINT\n');
console.log('='.repeat(60));

// Simulate a Twilio webhook payload
const testPayload = {
  CallSid: 'TEST_CALL_' + Date.now(),
  CallStatus: 'completed',
  CallDuration: '45',
  From: 'client:test@aoglobelife.com',
  To: '+15555551234'
};

const body = new URLSearchParams(testPayload).toString();

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': body.length
  }
};

console.log('📤 Sending test webhook...\n');
console.log('Payload:', testPayload);

const req = https.request(url, options, (res) => {
  console.log('\n📥 Response Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response Body:', data || '(empty)');
    
    if (res.statusCode === 200) {
      console.log('\n✅ Webhook endpoint is responding!');
      console.log('   Now check the database to see if the call was saved...');
    } else {
      console.log('\n❌ Webhook returned error status:', res.statusCode);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
  console.log('\nPossible issues:');
  console.log('  - Server is down');
  console.log('  - Network connectivity issue');
  console.log('  - Endpoint is not accessible');
});

req.write(body);
req.end();

