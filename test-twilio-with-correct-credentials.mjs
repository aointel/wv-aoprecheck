/**
 * Test Twilio API with CORRECT credentials from hardcoded-config.ts
 */

import twilio from 'twilio';

// CORRECT credentials from hardcoded-config.ts
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

console.log('\n📱 TESTING WITH CORRECT TWILIO CREDENTIALS...\n');

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

try {
  console.log('🔍 Fetching ALL phone numbers from Twilio account AC25d37aa41aed0df4fddd81ecf7abf00d...\n');
  
  const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 100 });
  
  console.log(`✅ Found ${phoneNumbers.length} phone numbers!\n`);
  
  if (phoneNumbers.length === 0) {
    console.log('❌ NO PHONE NUMBERS FOUND!');
    console.log('   Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active');
  } else {
    console.log('📞 ALL AVAILABLE PHONE NUMBERS:');
    console.log('━'.repeat(80));
    
    phoneNumbers.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.phoneNumber}`);
      console.log(`   Friendly Name: ${p.friendlyName || '(none)'}`);
      console.log(`   SID: ${p.sid}`);
      console.log(`   Capabilities:`);
      console.log(`      Voice: ${p.capabilities.voice ? '✅' : '❌'}`);
      console.log(`      SMS: ${p.capabilities.sms ? '✅' : '❌'}`);
      console.log(`      MMS: ${p.capabilities.mms ? '✅' : '❌'}`);
      
      // Check if this is the hardcoded number
      if (p.phoneNumber === '+19142289324') {
        console.log(`   ⚠️  THIS IS THE HARDCODED NUMBER IN CONFIG!`);
      }
    });
    
    console.log('\n' + '━'.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Numbers: ${phoneNumbers.length}`);
    console.log(`   Voice Capable: ${phoneNumbers.filter(n => n.capabilities.voice).length}`);
    console.log(`   SMS Capable: ${phoneNumbers.filter(n => n.capabilities.sms).length}`);
    console.log(`   MMS Capable: ${phoneNumbers.filter(n => n.capabilities.mms).length}`);
  }
  
} catch (error) {
  console.error('\n❌ Twilio API Error:', error.message);
  console.error('   Code:', error.code);
  console.error('   Status:', error.status);
  console.error('\n   This means either:');
  console.error('   1. Credentials are wrong');
  console.error('   2. Account is suspended');
  console.error('   3. Network issue');
}

