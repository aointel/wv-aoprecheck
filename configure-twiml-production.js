import twilio from 'twilio';

// Use API Keys instead of auth token
const accountSid = 'AC28f46293058c3feca9ae4a6c95ff3342';
const apiKey = 'SKde9a1210b47c3d775817e788d2416db5';
const apiSecret = 'QlWG22VNBS6uYu2b8OSGkx0CPyt0ne9n';

// TwiML App and Phone configurations
const twimlAppSid = 'APc81e4f11b22b891d912ce31b51784d1b';
const phoneNumberSid = 'PNa1d67508986206fa137ef97f239314d7';
const productionUrl = 'https://aointelligence.replit.app';

// Initialize Twilio client with API keys
const client = twilio(apiKey, apiSecret, { accountSid });

async function configureTwiMLApp() {
  try {
    console.log('🔧 Configuring TwiML App for production...');
    
    // Update TwiML App webhooks
    const application = await client.applications(twimlAppSid).update({
      voiceUrl: `${productionUrl}/webrtc-agent-connect`,
      voiceMethod: 'POST',
      statusCallback: `${productionUrl}/api/twilio/call-status`,
      statusCallbackMethod: 'POST'
    });
    
    console.log('✅ TwiML App configured successfully!');
    console.log('📞 Voice URL:', application.voiceUrl);
    console.log('📊 Status Callback:', application.statusCallback);
    
    // Update phone number webhooks
    const phoneNumber = await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: `${productionUrl}/api/twilio/incoming-call`,
      voiceMethod: 'POST',
      statusCallback: `${productionUrl}/api/twilio/call-status`,
      statusCallbackMethod: 'POST'
    });
    
    console.log('✅ Phone number webhooks configured!');
    console.log('📱 Phone:', phoneNumber.phoneNumber);
    console.log('🔗 Incoming URL:', phoneNumber.voiceUrl);
    
    console.log('\n🎉 TwiML App is now properly configured for production!');
    
  } catch (error) {
    console.error('❌ Configuration failed:', error.message);
    throw error;
  }
}

configureTwiMLApp()
  .then(() => {
    console.log('✅ Configuration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Configuration failed:', error);
    process.exit(1);
  });