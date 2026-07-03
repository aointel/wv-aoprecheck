import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const webhookUrl = 'https://aointelligence.replit.app/voice';

console.log('🎯 Creating NEW TwiML Application via API...');
console.log(`Account SID: ${accountSid?.substring(0, 8)}...`);
console.log(`Webhook URL: ${webhookUrl}`);

async function createTwiMLApp() {
  try {
    const application = await client.applications.create({
      friendlyName: 'ConnectNow WebRTC App',
      voiceUrl: webhookUrl,
      voiceMethod: 'POST'
    });

    console.log('✅ TwiML Application created successfully!');
    console.log(`App SID: ${application.sid}`);
    console.log(`Friendly Name: ${application.friendlyName}`);
    console.log(`Voice URL: ${application.voiceUrl}`);
    
    console.log('\n🔧 Add this to your .env file:');
    console.log(`TWILIO_TWIML_APP_SID=${application.sid}`);
    
    return application.sid;
  } catch (error) {
    console.error('❌ Failed to create TwiML Application:', error.message);
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    process.exit(1);
  }
}

createTwiMLApp();