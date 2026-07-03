import twilio from 'twilio';

// Use API Keys - no auth token needed
const accountSid = 'AC28f46293058c3feca9ae4a6c95ff3342';
const apiKey = 'SKde9a1210b47c3d775817e788d2416db5';
const apiSecret = 'QlWG22VNBS6uYu2b8OSGkx0CPyt0ne9n';
const twimlAppSid = 'APc81e4f11b22b891d912ce31b51784d1b';
const productionUrl = 'https://aointelligence.replit.app';

const client = twilio(apiKey, apiSecret, { accountSid });

async function configureTwiMLApp() {
  try {
    console.log('🎯 Configuring TwiML App for production calls...');
    
    const application = await client.applications(twimlAppSid).update({
      voiceUrl: `${productionUrl}/webrtc-agent-connect`,
      voiceMethod: 'POST',
      statusCallback: `${productionUrl}/api/twilio/call-status`,
      statusCallbackMethod: 'POST'
    });
    
    console.log('✅ TwiML App is now configured!');
    console.log('📞 Voice URL:', application.voiceUrl);
    console.log('📊 Status Callback:', application.statusCallback);
    console.log('🎉 WebRTC calls will now work properly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

configureTwiMLApp();