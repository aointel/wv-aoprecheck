/**
 * Script to make a call to 5032018470 using Twilio REST API
 * This proves the Twilio integration works
 */

import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TWIML_APP_SID, PRODUCTION_URL } from './server/hardcoded-config';

async function makeCall() {
  console.log('📞 Making call to 5032018470...\n');

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    console.log('1️⃣ Creating Twilio call...');
    console.log(`   From: TwiML App ${TWILIO_TWIML_APP_SID}`);
    console.log(`   To: 5032018470`);
    console.log(`   Webhook: ${PRODUCTION_URL}/webhook/webrtc\n`);

    // Make the call using TwiML App
    const call = await client.calls.create({
      to: '+15032018470', // E.164 format
      from: '+19142289324', // Your Twilio number
      url: `${PRODUCTION_URL}/webhook/webrtc?To=5032018470&agentEmail=test@example.com&leadName=Test+Call`,
      statusCallback: `${PRODUCTION_URL}/api/twilio/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    console.log('✅ Call created successfully!');
    console.log(`   Call SID: ${call.sid}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   To: ${call.to}`);
    console.log(`   From: ${call.from}\n`);

    console.log('2️⃣ Monitoring call status...');
    console.log('   (This will update as the call progresses)\n');

    // Poll for call status
    let lastStatus = call.status;
    const maxWait = 60000; // 60 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      try {
        const updatedCall = await client.calls(call.sid).fetch();
        
        if (updatedCall.status !== lastStatus) {
          console.log(`   Status changed: ${lastStatus} → ${updatedCall.status}`);
          lastStatus = updatedCall.status;

          if (updatedCall.status === 'completed') {
            console.log(`\n✅ Call completed!`);
            console.log(`   Duration: ${updatedCall.duration} seconds`);
            console.log(`   Direction: ${updatedCall.direction}`);
            break;
          }

          if (updatedCall.status === 'busy' || updatedCall.status === 'no-answer' || updatedCall.status === 'failed') {
            console.log(`\n⚠️  Call ended with status: ${updatedCall.status}`);
            if (updatedCall.statusMessage) {
              console.log(`   Message: ${updatedCall.statusMessage}`);
            }
            break;
          }
        }
      } catch (error: any) {
        console.error(`   Error checking status: ${error.message}`);
        break;
      }
    }

    if (lastStatus !== 'completed' && lastStatus !== 'busy' && lastStatus !== 'no-answer' && lastStatus !== 'failed') {
      console.log(`\n⏱️  Call still in progress (status: ${lastStatus})`);
      console.log(`   Check Twilio console for final status`);
    }

    console.log(`\n✅ Test complete! Call SID: ${call.sid}`);
    console.log(`   View in Twilio Console: https://console.twilio.com/us1/monitor/logs/calls/${call.sid}`);

  } catch (error: any) {
    console.error('❌ Failed to make call:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.moreInfo) {
      console.error(`   More info: ${error.moreInfo}`);
    }
    throw error;
  }
}

makeCall().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
