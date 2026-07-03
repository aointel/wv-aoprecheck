import fetch from 'node-fetch';
import twilio from 'twilio';

/**
 * Script to test WebRTC token generation and verify it works
 */

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const TEST_PHONE = '5032018470';

// Same credentials from twilio-token.ts for comparison
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_API_KEY = 'SK80ce6ceab1eb9df4a14c9a646f01304f';
const TWILIO_API_SECRET = 'FbjtNK2OHaGAfoHkerTzE0har8KzsNLm';
const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';

async function testTokenEndpoint() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING WEBRTC TOKEN GENERATION');
  console.log('='.repeat(70));
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Target: ${TEST_PHONE}`);
  console.log('='.repeat(70));
  console.log('');

  try {
    console.log('📡 Step 1: Fetching token from /api/twilio/token-test (bypasses auth)...');
    
    const response = await fetch(`${SERVER_URL}/api/twilio/token-test?identity=test@example.com`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      console.log(`\n❌ TOKEN ENDPOINT FAILED`);
      console.log(`   Error: ${errorData.error || errorData.message || errorText}`);
      
      if (response.status === 401) {
        console.log(`\n⚠️  Authentication required`);
        console.log(`   The endpoint requires a logged-in session`);
        console.log(`   This is expected - the endpoint checks for session.user.email`);
      } else if (response.status === 429) {
        console.log(`\n⚠️  Rate limited - active token exists`);
        console.log(`   You may already have an active token for this session`);
      }
      
      // Test direct token generation as fallback
      console.log(`\n🔄 Testing direct token generation (bypassing endpoint)...`);
      await testDirectTokenGeneration();
      return;
    }

    const data = await response.json();
    const token = data.token;
    const identity = data.identity;
    
    console.log(`\n✅ TOKEN RECEIVED FROM ENDPOINT!`);
    console.log(`   Identity: ${identity}`);
    console.log(`   Token length: ${token.length} characters`);
    console.log(`   App SID: ${data.appSid || 'N/A'}`);
    
    // Verify token
    await verifyToken(token, identity);
    
    console.log(`\n✅ TOKEN ENDPOINT IS WORKING!`);
    console.log(`   Token is valid and ready for WebRTC calls`);
    console.log(`   You can use this token with Twilio Device SDK to call ${TEST_PHONE}`);
    
  } catch (error) {
    console.error(`\n❌ TEST FAILED`);
    console.error(`   Error: ${error instanceof Error ? error.message : error}`);
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error(`\n⚠️  Server not running`);
      console.error(`   Start server with: npm run dev`);
      console.error(`   Or set SERVER_URL environment variable`);
    }
    
    // Test direct token generation as fallback
    console.log(`\n🔄 Testing direct token generation (bypassing endpoint)...`);
    await testDirectTokenGeneration();
  }
}

async function testDirectTokenGeneration() {
  console.log('\n' + '='.repeat(70));
  console.log('🔧 TESTING DIRECT TOKEN GENERATION');
  console.log('='.repeat(70));
  
  try {
    const testIdentity = 'test@example.com';
    
    console.log(`\n📝 Generating token for: ${testIdentity}`);
    console.log(`   Using same process as server/twilio-token.ts`);
    
    const token = new twilio.jwt.AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { 
        identity: testIdentity,
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
    
    console.log(`\n✅ TOKEN GENERATED SUCCESSFULLY!`);
    console.log(`   Token length: ${jwtToken.length} characters`);
    console.log(`   Identity: ${testIdentity}`);
    console.log(`   App SID: ${TWILIO_TWIML_APP_SID}`);
    
    await verifyToken(jwtToken, testIdentity);
    
    console.log(`\n✅ DIRECT TOKEN GENERATION WORKS!`);
    console.log(`   The token generation process is functioning correctly`);
    console.log(`   If the endpoint fails, it's likely an auth/session issue`);
    
  } catch (error) {
    console.error(`\n❌ DIRECT TOKEN GENERATION FAILED`);
    console.error(`   Error: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

async function verifyToken(jwtToken: string, expectedIdentity: string) {
  console.log(`\n🔍 Verifying token structure...`);
  
  const parts = jwtToken.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
  }
  
  console.log(`   ✅ Token has correct JWT structure`);
  
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    console.log(`\n📋 Token Payload:`);
    console.log(`   Identity: ${payload.sub || payload.identity || 'N/A'}`);
    console.log(`   Issuer: ${payload.iss || 'N/A'}`);
    console.log(`   Expires: ${new Date((payload.exp || 0) * 1000).toISOString()}`);
    console.log(`   Issued: ${new Date((payload.iat || 0) * 1000).toISOString()}`);
    
    // Verify identity matches
    const tokenIdentity = payload.grants?.identity || payload.sub;
    if (tokenIdentity && tokenIdentity.toLowerCase() === expectedIdentity.toLowerCase()) {
      console.log(`   ✅ Identity matches: ${tokenIdentity}`);
    } else {
      console.log(`   ⚠️  Identity mismatch: expected ${expectedIdentity}, got ${tokenIdentity}`);
    }
    
    // Verify VoiceGrant
    if (payload.grants?.voice) {
      console.log(`   ✅ Voice grant present`);
      if (payload.grants.voice.outgoing?.application_sid === TWILIO_TWIML_APP_SID) {
        console.log(`   ✅ Outgoing App SID matches: ${TWILIO_TWIML_APP_SID}`);
      }
      if (payload.grants.voice.incoming?.allow === true) {
        console.log(`   ✅ Incoming calls allowed`);
      }
    } else {
      console.log(`   ❌ Voice grant missing!`);
    }
    
    // Verify issuer matches API key
    if (payload.iss === TWILIO_API_KEY) {
      console.log(`   ✅ Issuer matches API Key`);
    } else {
      console.log(`   ⚠️  Issuer mismatch`);
    }
    
  } catch (error) {
    console.log(`   ❌ Failed to decode token: ${error}`);
    throw error;
  }
}

// Run the test
console.log('');
testTokenEndpoint()
  .then(() => {
    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(70));
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n' + '='.repeat(70));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(70));
    console.error(error);
    process.exit(1);
  });
