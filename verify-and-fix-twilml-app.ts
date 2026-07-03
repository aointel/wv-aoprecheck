import twilio from 'twilio';

/**
 * Verify and fix TwiML App configuration
 */

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';
const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';
const EXPECTED_WEBHOOK_URL = 'https://aoirail-production-baa2.up.railway.app/webhook/webrtc';
const EXPECTED_STATUS_CALLBACK = 'https://aoirail-production-baa2.up.railway.app/api/twilio/call-status';

console.log('='.repeat(70));
console.log('🔧 VERIFYING AND FIXING TWIML APP');
console.log('='.repeat(70));
console.log('');

try {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  
  console.log('📡 Fetching TwiML App configuration...');
  const app = await client.applications(TWILIO_TWIML_APP_SID).fetch();
  
  console.log(`   App SID: ${app.sid}`);
  console.log(`   App Name: ${app.friendlyName || 'N/A'}`);
  console.log(`   Current Voice URL: ${app.voiceUrl || 'MISSING'}`);
  console.log(`   Current Status Callback: ${app.statusCallbackUrl || 'MISSING'}`);
  console.log('');
  
  let needsUpdate = false;
  
  if (app.voiceUrl !== EXPECTED_WEBHOOK_URL) {
    console.log(`   ❌ PROBLEM: Voice URL is wrong!`);
    console.log(`      Current: ${app.voiceUrl}`);
    console.log(`      Should be: ${EXPECTED_WEBHOOK_URL}`);
    needsUpdate = true;
  } else {
    console.log(`   ✅ Voice URL is correct`);
  }
  
  if (app.statusCallbackUrl !== EXPECTED_STATUS_CALLBACK) {
    console.log(`   ⚠️  Status Callback URL mismatch`);
    console.log(`      Current: ${app.statusCallbackUrl}`);
    console.log(`      Should be: ${EXPECTED_STATUS_CALLBACK}`);
    needsUpdate = true;
  } else {
    console.log(`   ✅ Status Callback URL is correct`);
  }
  
  if (needsUpdate) {
    console.log('');
    console.log('🔧 FIXING TwiML App configuration...');
    
    const updated = await client.applications(TWILIO_TWIML_APP_SID).update({
      voiceUrl: EXPECTED_WEBHOOK_URL,
      voiceMethod: 'POST',
      statusCallbackUrl: EXPECTED_STATUS_CALLBACK,
      statusCallbackMethod: 'POST'
    });
    
    console.log('');
    console.log('✅ TwiML App updated successfully!');
    console.log(`   New Voice URL: ${updated.voiceUrl}`);
    console.log(`   New Status Callback: ${updated.statusCallbackUrl}`);
    console.log('');
    console.log('🎉 WebRTC should now work!');
  } else {
    console.log('');
    console.log('✅ TwiML App is correctly configured!');
    console.log('');
    console.log('🔍 If WebRTC still isn\'t working, the issue is likely:');
    console.log('   1. Users not getting tokens (check /api/twilio/token endpoint)');
    console.log('   2. Browser blocking WebRTC (check permissions, HTTPS)');
    console.log('   3. Device not initializing (check browser console)');
  }
  
} catch (error: any) {
  console.error('❌ FAILED:', error.message);
  
  if (error.code === 20003 || error.message?.includes('not found')) {
    console.error('');
    console.error('❌ PROBLEM: TwiML App doesn\'t exist!');
    console.error(`   App SID: ${TWILIO_TWIML_APP_SID}`);
    console.error('   You need to create this TwiML App in Twilio Console');
  } else if (error.code === 20003 || error.message?.includes('Authenticate')) {
    console.error('');
    console.error('❌ PROBLEM: Authentication failed');
    console.error('   Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
  }
  
  process.exit(1);
}

console.log('');
console.log('='.repeat(70));
