/**
 * Check Twilio webhook configuration on all phone numbers
 */

const twilio = require('twilio');

const accountSid = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const authToken = '974557c999ed53ada16c4a784af2a7d3';

const twilioClient = twilio(accountSid, authToken);

async function checkTwilioWebhooks() {
  console.log('\n🔍 CHECKING TWILIO WEBHOOK CONFIGURATION\n');
  console.log('='.repeat(60));

  try {
    console.log('📞 Fetching all Twilio phone numbers...\n');
    
    const incomingPhoneNumbers = await twilioClient.incomingPhoneNumbers.list();
    
    console.log(`📊 Found ${incomingPhoneNumbers.length} phone numbers\n`);
    console.log('='.repeat(60));

    let withStatusCallback = 0;
    let withoutStatusCallback = 0;
    let correctWebhook = 0;
    let wrongWebhook = 0;

    const expectedWebhookUrl = 'https://aoirail-production.up.railway.app/api/twilio/call-status';

    incomingPhoneNumbers.forEach(number => {
      const statusCallback = number.statusCallback || '';
      const statusCallbackMethod = number.statusCallbackMethod || 'POST';
      const voiceUrl = number.voiceUrl || '';
      
      console.log(`\n📱 ${number.phoneNumber} (${number.friendlyName || 'No name'})`);
      console.log(`   Voice URL: ${voiceUrl || 'NONE'}`);
      console.log(`   Status Callback: ${statusCallback || 'NONE'}`);
      console.log(`   Callback Method: ${statusCallbackMethod}`);
      
      if (statusCallback) {
        withStatusCallback++;
        if (statusCallback.includes('aoirail') && statusCallback.includes('call-status')) {
          correctWebhook++;
          console.log(`   ✅ Webhook configured correctly!`);
        } else {
          wrongWebhook++;
          console.log(`   ⚠️ Webhook configured but NOT pointing to our endpoint!`);
        }
      } else {
        withoutStatusCallback++;
        console.log(`   ❌ NO status callback webhook configured!`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 WEBHOOK CONFIGURATION SUMMARY:\n`);
    console.log(`   Total Numbers: ${incomingPhoneNumbers.length}`);
    console.log(`   ✅ WITH Status Callback: ${withStatusCallback}`);
    console.log(`   ❌ WITHOUT Status Callback: ${withoutStatusCallback}`);
    console.log(`   ✅ Correct Webhook URL: ${correctWebhook}`);
    console.log(`   ⚠️ Wrong Webhook URL: ${wrongWebhook}`);
    
    console.log(`\n💡 EXPECTED WEBHOOK URL:`);
    console.log(`   ${expectedWebhookUrl}\n`);

    if (withoutStatusCallback > 0 || wrongWebhook > 0) {
      console.log(`\n🔧 ACTION NEEDED:`);
      console.log(`   ${withoutStatusCallback} numbers need status callback webhook configured`);
      if (wrongWebhook > 0) {
        console.log(`   ${wrongWebhook} numbers have wrong webhook URL`);
      }
      console.log(`\n   Run update script to fix? (I can create one)`);
    } else {
      console.log(`\n✅ All numbers configured correctly!`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkTwilioWebhooks()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

