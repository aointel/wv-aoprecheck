import twilio from 'twilio';

/**
 * Test script that uses the EXACT same token generation process
 * as the twilio-token.ts endpoint to prove token generation works
 */

function generateTwilioToken(identity: string, agentName: string = 'Test Agent') {
  try {
    // Same credentials from twilio-token.ts
    const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
    const TWILIO_API_KEY = 'SK80ce6ceab1eb9df4a14c9a646f01304f';
    const TWILIO_API_SECRET = 'FbjtNK2OHaGAfoHkerTzE0har8KzsNLm';
    const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';

    console.log('🔧 Using hard-coded Twilio credentials for WebRTC');
    console.log(`✅ API Secret length: ${TWILIO_API_SECRET.length} characters`);
    console.log(`✅ API Secret starts with: ${TWILIO_API_SECRET.slice(0, 4)}...`);

    // Normalize identity (same as in twilio-token.ts)
    const normalizedIdentity = identity.trim().toLowerCase();
    
    if (!normalizedIdentity || !normalizedIdentity.includes('@')) {
      throw new Error('Invalid identity: must be a valid email address');
    }

    console.log(`Generated token for identity: ${normalizedIdentity} (${agentName})`);
    
    // Same token generation process as twilio-token.ts
    const token = new twilio.jwt.AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { 
        identity: normalizedIdentity,
        ttl: 3600 // 1 hour token lifetime
      }
    );

    const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true,
      pushCredentialSid: undefined // Disable push notifications for web
    });

    token.addGrant(voiceGrant);
    
    const jwtToken = token.toJwt();
    
    console.log(`\n✅ Token generated successfully!`);
    console.log(`Token length: ${jwtToken.length} characters`);
    console.log(`TWILIO_TWIML_APP_SID: ${TWILIO_TWIML_APP_SID}`);
    console.log(`AccountSid: ${TWILIO_ACCOUNT_SID.slice(0, 10)}...`);
    console.log(`ApiKey: ${TWILIO_API_KEY.slice(0, 10)}...`);
    console.log(`Identity: ${normalizedIdentity}`);
    
    // Decode and verify token structure (without verifying signature)
    try {
      const parts = jwtToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log(`\n📋 Token Payload (decoded):`);
        console.log(`  - Identity: ${payload.sub || payload.identity || 'N/A'}`);
        console.log(`  - Issuer: ${payload.iss || 'N/A'}`);
        console.log(`  - Expires: ${new Date((payload.exp || 0) * 1000).toISOString()}`);
        console.log(`  - Issued: ${new Date((payload.iat || 0) * 1000).toISOString()}`);
        if (payload.grants) {
          console.log(`  - Grants: ${JSON.stringify(payload.grants, null, 2)}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not decode token payload:', e);
    }
    
    return {
      token: jwtToken,
      identity: normalizedIdentity,
      appSid: TWILIO_TWIML_APP_SID
    };
  } catch (error) {
    console.error('❌ Token generation error:', error);
    throw error;
  }
}

// Test the token generation
const testIdentity = process.argv[2] || 'test@example.com';
const testAgentName = process.argv[3] || 'Test Agent';

console.log('='.repeat(60));
console.log('🧪 TESTING TWILIO TOKEN GENERATION');
console.log('='.repeat(60));
console.log(`Test Identity: ${testIdentity}`);
console.log(`Test Agent Name: ${testAgentName}`);
console.log('='.repeat(60));
console.log('');

try {
  const result = generateTwilioToken(testIdentity, testAgentName);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ TOKEN GENERATION SUCCESSFUL');
  console.log('='.repeat(60));
  console.log('\nToken (first 50 chars):', result.token.substring(0, 50) + '...');
  console.log('Full token:', result.token);
  console.log('\n✅ Token generation process works correctly!');
  
  process.exit(0);
} catch (error) {
  console.error('\n' + '='.repeat(60));
  console.error('❌ TOKEN GENERATION FAILED');
  console.error('='.repeat(60));
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
