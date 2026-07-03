/**
 * Test what Twilio actually sends in webhook body
 */

const https = require('https');

const url = 'https://aoirail-production.up.railway.app/api/twilio/call-status';

console.log('\n🧪 TESTING TWILIO WEBHOOK WITH METADATA\n');
console.log('='.repeat(60));

// Simulate a Twilio webhook payload with all possible fields
const testPayload = {
  CallSid: 'TEST_WITH_METADATA_' + Date.now(),
  CallStatus: 'completed',
  CallDuration: '75', // Over 60 seconds
  From: '+19142289324',
  To: '+15555551234',
  // Twilio custom parameters (if set in the call)
  'agent_email': 'test@aoglobelife.com',
  'lead_phone': '+15555551234',
  'call_source': 'call_connector_pro'
};

const body = new URLSearchParams(testPayload).toString();

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': body.length
  }
};

console.log('📤 Sending test webhook with metadata...\n');
console.log('Payload:', testPayload);

const req = https.request(url, options, (res) => {
  console.log('\n📥 Response Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response Body:', data || '(empty)');
    console.log('\n✅ Check server logs to see if agent_email was extracted from webhook!');
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
});

req.write(body);
req.end();

