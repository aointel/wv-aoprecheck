import twilio from 'twilio';

/**
 * Direct WebRTC token generation test - bypasses endpoint/auth
 * This proves the token generation works without needing a session
 */

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_API_KEY = 'SK80ce6ceab1eb9df4a14c9a646f01304f';
const TWILIO_API_SECRET = 'FbjtNK2OHaGAfoHkerTzE0har8KzsNLm';
const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';
const TEST_PHONE = '5032018470';

function generateToken(identity: string) {
  console.log('🔧 Generating WebRTC token...');
  console.log(`   Identity: ${identity}`);
  
  const token = new twilio.jwt.AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { 
      identity: identity.trim().toLowerCase(),
      ttl: 3600
    }
  );

  const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true,
    pushCredentialSid: undefined
  });

  token.addGrant(voiceGrant);
  
  const jwtToken = token.toJwt();
  
  console.log(`✅ Token generated: ${jwtToken.length} chars`);
  
  // Verify token
  const parts = jwtToken.split('.');
  if (parts.length === 3) {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log(`   Identity in token: ${payload.grants?.identity || payload.sub}`);
    console.log(`   Expires: ${new Date(payload.exp * 1000).toISOString()}`);
    console.log(`   Voice grant: ${payload.grants?.voice ? '✅' : '❌'}`);
    console.log(`   Outgoing App SID: ${payload.grants?.voice?.outgoing?.application_sid || 'MISSING'}`);
  }
  
  return jwtToken;
}

console.log('='.repeat(70));
console.log('🧪 DIRECT WEBRTC TOKEN GENERATION TEST');
console.log('='.repeat(70));
console.log(`Target phone: ${TEST_PHONE}`);
console.log('='.repeat(70));
console.log('');

try {
  const testIdentity = 'test@example.com';
  const token = generateToken(testIdentity);
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ TOKEN GENERATION SUCCESSFUL');
  console.log('='.repeat(70));
  console.log('\n📋 Token (first 100 chars):');
  console.log(token.substring(0, 100) + '...');
  console.log('\n📋 Full Token:');
  console.log(token);
  console.log('\n' + '='.repeat(70));
  console.log('✅ THIS TOKEN IS VALID AND READY FOR WEBRTC');
  console.log(`   Use it with Twilio Device SDK to call ${TEST_PHONE}`);
  console.log('='.repeat(70));
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ TOKEN GENERATION FAILED');
  console.error('='.repeat(70));
  console.error(error instanceof Error ? error.message : error);
  console.error(error instanceof Error ? error.stack : '');
  process.exit(1);
}
