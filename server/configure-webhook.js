// Quick script to configure Twilio webhook
import https from 'https';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
// Phone number will be selected dynamically from available numbers
const webhookUrl = `https://${process.env.REPLIT_DEV_DOMAIN || 'aointelligence.replit.app'}/api/twilio/incoming-call`;

console.log('🎯 Configuring Twilio webhook...');
console.log(`Account SID: ${accountSid?.substring(0, 8)}...`);
console.log(`Webhook: ${webhookUrl}`);

// Find the first available phone number and configure it
const findPhoneNumber = () => {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  
  const options = {
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.incoming_phone_numbers && response.incoming_phone_numbers.length > 0) {
          // Use the first available phone number
          const target = response.incoming_phone_numbers[0];
          const selectedPhoneNumber = target.phone_number;
          console.log(`📱 Using first available phone number: ${selectedPhoneNumber} (${target.friendly_name})`);
          console.log(`✅ Found phone number SID: ${target.sid}`);
          updateWebhook(target.sid, selectedPhoneNumber);
        } else {
          console.log('❌ No phone numbers found in account');
          console.log('Response:', response);
        }
      } catch (error) {
        console.error('❌ Error parsing response:', error);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request failed:', error);
  });

  req.end();
};

// Update the webhook URL
const updateWebhook = (phoneSid, phoneNumber) => {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const postData = new URLSearchParams({
    VoiceUrl: webhookUrl,
    VoiceMethod: 'POST',
    StatusCallback: `https://${process.env.REPLIT_DEV_DOMAIN || 'aointelligence.replit.app'}/api/twilio/call-status`,
    StatusCallbackMethod: 'POST'
  }).toString();

  const options = {
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneSid}.json`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.voice_url) {
          console.log('🎉 WEBHOOK CONFIGURED SUCCESSFULLY!');
          console.log(`   Phone: ${response.phone_number}`);
          console.log(`   Voice URL: ${response.voice_url}`);
          console.log(`   Status Callback: ${response.status_callback}`);
          console.log('\n✅ Auto-answer system is now active!');
          console.log(`When Taalk calls ${phoneNumber}, it will automatically join the conference.`);
        } else {
          console.log('❌ Failed to update webhook:', response);
        }
      } catch (error) {
        console.error('❌ Error parsing update response:', error);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Update request failed:', error);
  });

  req.write(postData);
  req.end();
};

// Run the configuration
findPhoneNumber();