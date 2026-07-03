/**
 * Check Twilio configuration and test connection
 */

const RAILWAY_URL = 'https://aoirail-production.up.railway.app';

console.log('\n🔧 CHECKING TWILIO CONFIGURATION...\n');

// Test if we can reach the endpoint
try {
  const response = await fetch(`${RAILWAY_URL}/api/twilio-numbers`);
  const data = await response.json();
  
  console.log('📡 API Response:');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.error) {
    console.log('\n❌ ERROR:', data.error);
    if (data.message) {
      console.log('   Message:', data.message);
    }
  }
  
} catch (error) {
  console.error('❌ Failed to connect:', error.message);
}

console.log('\n💡 NEXT STEPS:');
console.log('   1. Check if TWILIO_ACCOUNT_SID is set in Railway env vars');
console.log('   2. Check if TWILIO_AUTH_TOKEN is set in Railway env vars');
console.log('   3. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/active');
console.log('   4. See if any phone numbers are purchased');
console.log('   5. If no numbers, need to buy/provision phone numbers in Twilio');
console.log('');

