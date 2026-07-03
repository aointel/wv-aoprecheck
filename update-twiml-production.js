import twilio from 'twilio';

// ALL HARD CODED TWILIO KEYS - REAL VALUES
const accountSid = 'AC28f46293058c3feca9ae4a6c95ff3342';
const twimlAppSid = 'APc81e4f11b22b891d912ce31b51784d1b';
const phoneNumberSid = 'PNa1d67508986206fa137ef97f239314d7';
const twilioPhone = '+16052500834';

// API Keys for WebRTC tokens
const apiKey = 'SKde9a1210b47c3d775817e788d2416db5';
const apiSecret = 'QlWG22VNBS6uYu2b8OSGkx0CPyt0ne9n';

// Auth token not available - manual configuration required

// Production URL
const productionUrl = 'https://aointelligence.replit.app';

async function updateTwiMLApp() {
  try {
    console.log('🔧 Updating TwiML App for production...');
    console.log('🌐 Production URL:', productionUrl);
    console.log('🎯 TwiML App SID:', twimlAppSid);
    console.log('📞 Phone Number:', twilioPhone);
    
    // Update the TwiML App with production URLs
    const application = await client.applications(twimlAppSid).update({
      voiceUrl: `${productionUrl}/webrtc-agent-connect`,
      voiceMethod: 'POST',
      statusCallback: `${productionUrl}/api/twilio/call-status`,
      statusCallbackMethod: 'POST'
    });
    
    console.log('✅ TwiML App updated successfully!');
    console.log('📞 Voice URL:', application.voiceUrl);
    console.log('📊 Status Callback:', application.statusCallback);
    console.log('🔗 Friendly Name:', application.friendlyName);
    
    // Also update the webhook for the main phone number
    console.log('📱 Updating phone number webhook...');
    const phoneNumber = await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: `${productionUrl}/api/twilio/incoming-call`,
      voiceMethod: 'POST',
      statusCallback: `${productionUrl}/api/twilio/call-status`,
      statusCallbackMethod: 'POST'
    });
    
    console.log('✅ Phone number webhook updated!');
    console.log('📞 Phone:', phoneNumber.phoneNumber);
    console.log('🔗 Voice URL:', phoneNumber.voiceUrl);
    
    console.log('\n🎉 Configuration complete!');
    console.log('🌐 Your app is now pointing to production');
    console.log('📡 WebRTC endpoints will work with production server');
    console.log('\n📋 ALL HARD-CODED KEYS:');
    console.log('Account SID:', accountSid);
    console.log('Auth Token:', authToken);
    console.log('TwiML App SID:', twimlAppSid);
    console.log('Phone Number SID:', phoneNumberSid);
    console.log('Phone Number:', twilioPhone);
    console.log('API Key:', apiKey);
    console.log('API Secret:', apiSecret);
    
  } catch (error) {
    console.error('❌ Error updating TwiML App:', error.message);
    throw error;
  }
}

updateTwiMLApp()
  .then(() => {
    console.log('✅ TwiML App configuration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to update TwiML App:', error);
    process.exit(1);
  }); 