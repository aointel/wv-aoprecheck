import twilio from 'twilio';

// Use the working credentials from hardcoded config
const accountSid = 'AC28f46293058c3feca9ae4a6c95ff3342';
const twimlAppSid = 'APc81e4f11b22b891d912ce31b51784d1b';

// Auth token not available - manual TwiML configuration required

async function updateTwiMLApp() {
  try {
    console.log('🔧 Updating TwiML App to use correct /webhook/webrtc endpoint...');
    
    const application = await client.applications(twimlAppSid).update({
      voiceUrl: 'https://aointelligence.replit.app/webhook/webrtc',
      voiceMethod: 'POST',
      statusCallback: 'https://aointelligence.replit.app/api/twilio/call-status',
      statusCallbackMethod: 'POST'
    });
    
    console.log('✅ TwiML App updated successfully!');
    console.log(`App SID: ${application.sid}`);
    console.log(`Voice URL: ${application.voiceUrl}`);
    console.log(`Status Callback: ${application.statusCallback}`);
    
  } catch (error) {
    console.error('❌ Failed to update TwiML App:', error);
  }
}

updateTwiMLApp();