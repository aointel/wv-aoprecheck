/**
 * Check all available Twilio phone numbers for WebRTC
 */

const RAILWAY_URL = 'https://aoirail-production.up.railway.app';

console.log('\n📱 CHECKING TWILIO PHONE NUMBERS...\n');

try {
  const response = await fetch(`${RAILWAY_URL}/api/twilio-numbers`);
  
  if (!response.ok) {
    console.error(`❌ API Error: ${response.status} ${response.statusText}`);
    const error = await response.json();
    console.error('Error details:', error);
    process.exit(1);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    console.error('❌ Failed to fetch phone numbers');
    console.error(data);
    process.exit(1);
  }
  
  console.log(`✅ Found ${data.count} phone numbers:\n`);
  console.log('━'.repeat(80));
  
  data.numbers.forEach((number, index) => {
    console.log(`\n📞 ${index + 1}. ${number.phoneNumber}`);
    console.log(`   Friendly Name: ${number.friendlyName}`);
    console.log(`   SID: ${number.sid}`);
    console.log(`   Capabilities:`);
    console.log(`      Voice: ${number.capabilities.voice ? '✅' : '❌'}`);
    console.log(`      SMS: ${number.capabilities.sms ? '✅' : '❌'}`);
    console.log(`      MMS: ${number.capabilities.mms ? '✅' : '❌'}`);
  });
  
  console.log('\n' + '━'.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Numbers: ${data.count}`);
  console.log(`   Voice Capable: ${data.numbers.filter(n => n.capabilities.voice).length}`);
  console.log(`   SMS Capable: ${data.numbers.filter(n => n.capabilities.sms).length}`);
  console.log(`   MMS Capable: ${data.numbers.filter(n => n.capabilities.mms).length}`);
  console.log('');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

