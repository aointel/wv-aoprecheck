/**
 * Test Twilio API directly to check for phone numbers
 */

import twilio from 'twilio';

// Current credentials from hardcoded-config.ts
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

console.log('\n📱 TESTING TWILIO API DIRECTLY...\n');

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

try {
  console.log('🔍 Fetching ALL phone numbers from Twilio...\n');
  
  const phoneNumbers = await client.incomingPhoneNumbers.list();
  
  console.log(`✅ Found ${phoneNumbers.length} phone numbers:\n`);
  
  if (phoneNumbers.length === 0) {
    console.log('❌ NO PHONE NUMBERS FOUND IN TWILIO ACCOUNT!');
    console.log('   Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active');
    console.log('   Make sure you have phone numbers purchased.');
  } else {
    phoneNumbers.forEach((p, i) => {
      console.log(`${i + 1}. ${p.phoneNumber}`);
      console.log(`   Friendly Name: ${p.friendlyName}`);
      console.log(`   SID: ${p.sid}`);
      console.log(`   Voice: ${p.capabilities.voice ? '✅' : '❌'}`);
      console.log(`   SMS: ${p.capabilities.sms ? '✅' : '❌'}`);
      console.log(`   MMS: ${p.capabilities.mms ? '✅' : '❌'}`);
      console.log('');
    });
  }
  
} catch (error) {
  console.error('❌ Twilio API Error:', error.message);
  console.error('   Code:', error.code);
  console.error('   Status:', error.status);
}

