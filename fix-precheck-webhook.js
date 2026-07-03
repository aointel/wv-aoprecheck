// Using Node.js built-in fetch

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const APP_SID = 'AP415df22db91ee77801dacc5a8a81937f';

async function fixPrecheckWebhook() {
  try {
    console.log('🔧 Updating Twilio precheck application webhook URLs...');
    
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Applications/${APP_SID}.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'VoiceUrl': 'https://aointelligence.replit.app/api/twilio/webrtc-voice',
        'StatusCallback': 'https://aointelligence.replit.app/api/twilio/call-status'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Precheck webhook updated successfully!');
      console.log(`   Voice URL: ${data.voice_url}`);
      console.log(`   Status Callback: ${data.status_callback}`);
    } else {
      const error = await response.text();
      console.error('❌ Failed to update webhook:', error);
    }
    
  } catch (error) {
    console.error('❌ Error updating webhook:', error);
  }
}

fixPrecheckWebhook();