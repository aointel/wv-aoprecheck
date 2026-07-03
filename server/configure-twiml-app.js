// Configure TwiML Application for WebRTC
import https from 'https';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const appSid = process.env.TWILIO_TWIML_APP_SID;
const webhookUrl = 'https://aointelligence.replit.app/voice';

console.log('🎯 Configuring TwiML Application...');
console.log(`Account SID: ${accountSid?.substring(0, 8)}...`);
console.log(`App SID: ${appSid}`);
console.log(`Webhook URL: ${webhookUrl}`);

const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
const postData = new URLSearchParams({
  VoiceUrl: webhookUrl,
  VoiceMethod: 'POST',
  StatusCallback: 'https://aointelligence.replit.app/api/twilio/call-status',
  StatusCallbackMethod: 'POST'
}).toString();

const options = {
  hostname: 'api.twilio.com',
  path: `/2010-04-01/Accounts/${accountSid}/Applications/${appSid}.json`,
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': postData.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      const response = JSON.parse(data);
      console.log('✅ TwiML Application configured successfully!');
      console.log(`   App SID: ${response.sid}`);
      console.log(`   Voice URL: ${response.voice_url}`);
      console.log(`   Status Callback: ${response.status_callback}`);
    } else {
      console.error('❌ Failed to configure TwiML Application');
      console.error(`Status: ${res.statusCode}`);
      console.error('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(postData);
req.end();