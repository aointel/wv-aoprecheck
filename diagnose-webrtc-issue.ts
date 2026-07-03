import twilio from 'twilio';
import fetch from 'node-fetch';

/**
 * Diagnostic script to find why WebRTC calls aren't working
 */

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_API_KEY = 'SK80ce6ceab1eb9df4a14c9a646f01304f';
const TWILIO_API_SECRET = 'FbjtNK2OHaGAfoHkerTzE0har8KzsNLm';
const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';
const TEST_PHONE = '5032018470';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

console.log('='.repeat(70));
console.log('🔍 WEBRTC DIAGNOSTIC - Finding the Real Problem');
console.log('='.repeat(70));
console.log('');

// Test 1: Token Generation
console.log('1️⃣ TESTING TOKEN GENERATION...');
try {
  const testIdentity = 'test@example.com';
  const token = new twilio.jwt.AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { identity: testIdentity, ttl: 3600 }
  );
  
  const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true,
  });
  
  token.addGrant(voiceGrant);
  const jwtToken = token.toJwt();
  
  // Decode to check identity
  const parts = jwtToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  
  console.log('   ✅ Token generated');
  console.log(`   Identity in token: ${payload.grants?.identity || payload.sub}`);
  console.log(`   Token length: ${jwtToken.length}`);
  console.log(`   Voice grant: ${payload.grants?.voice ? '✅' : '❌'}`);
  console.log(`   Outgoing App SID: ${payload.grants?.voice?.outgoing?.application_sid || 'MISSING'}`);
  
  if (payload.grants?.voice?.outgoing?.application_sid !== TWILIO_TWIML_APP_SID) {
    console.log('   ❌ PROBLEM: App SID mismatch!');
  }
  
} catch (error) {
  console.log(`   ❌ Token generation failed: ${error}`);
  process.exit(1);
}

console.log('');

// Test 2: Check TwiML App Configuration
console.log('2️⃣ CHECKING TWIML APP CONFIGURATION...');
try {
  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_API_SECRET);
  const app = await client.applications(TWILIO_TWIML_APP_SID).fetch();
  
  console.log(`   App SID: ${app.sid}`);
  console.log(`   Voice URL: ${app.voiceUrl || 'MISSING'}`);
  console.log(`   Voice Method: ${app.voiceMethod || 'MISSING'}`);
  console.log(`   Status Callback: ${app.statusCallbackUrl || 'MISSING'}`);
  
  const expectedUrl = 'https://aoirail-production-baa2.up.railway.app/webhook/webrtc';
  if (app.voiceUrl !== expectedUrl) {
    console.log(`   ❌ PROBLEM: Voice URL is wrong!`);
    console.log(`      Expected: ${expectedUrl}`);
    console.log(`      Got: ${app.voiceUrl}`);
    console.log(`   🔧 Fix: Update TwiML App to point to ${expectedUrl}`);
  } else {
    console.log(`   ✅ Voice URL is correct`);
  }
  
} catch (error) {
  console.log(`   ❌ Failed to check TwiML App: ${error}`);
  if (error instanceof Error && error.message.includes('not found')) {
    console.log(`   ❌ PROBLEM: TwiML App ${TWILIO_TWIML_APP_SID} doesn't exist!`);
  }
}

console.log('');

// Test 3: Check Webhook Endpoint
console.log('3️⃣ TESTING WEBHOOK ENDPOINT...');
try {
  // Simulate what Twilio sends when a WebRTC call is made
  const testBody = {
    Caller: 'client:test@example.com', // This is what Twilio sends from the token identity
    To: TEST_PHONE,
    From: 'client:test@example.com',
    CallSid: 'CA_TEST_' + Date.now(),
    conference: 'Test-Conference-123',
    agentEmail: 'test@example.com',
    leadName: 'Test Lead',
    leadState: 'OR'
  };
  
  const response = await fetch(`${SERVER_URL}/webhook/webrtc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(testBody as any).toString()
  });
  
  console.log(`   Status: ${response.status}`);
  const responseText = await response.text();
  
  if (response.status === 200 && responseText.includes('<?xml')) {
    console.log('   ✅ Webhook endpoint responds with TwiML');
    console.log(`   Response length: ${responseText.length} chars`);
    
    // Check if it's a Dial or Conference
    if (responseText.includes('<Dial>')) {
      console.log('   ✅ Contains <Dial> instruction');
      if (responseText.includes(`<Number>${TEST_PHONE}</Number>`)) {
        console.log(`   ✅ Dialing correct number: ${TEST_PHONE}`);
      } else if (responseText.includes('<Conference>')) {
        console.log('   ✅ Contains <Conference> instruction');
      }
    } else {
      console.log('   ⚠️  Response doesn\'t contain <Dial> or <Conference>');
    }
  } else if (response.status === 403) {
    console.log('   ❌ PROBLEM: Webhook rejected the call (403)');
    console.log(`   Response: ${responseText}`);
    console.log('   This means handleWebRTC is rejecting the call');
    console.log('   Check: Is Caller/From in format "client:email@domain.com"?');
  } else {
    console.log(`   ❌ PROBLEM: Webhook returned ${response.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}`);
  }
  
} catch (error) {
  console.log(`   ❌ Failed to test webhook: ${error}`);
  if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
    console.log(`   ❌ PROBLEM: Server not running on ${SERVER_URL}`);
    console.log(`   Start server with: npm run dev`);
  }
}

console.log('');

// Test 4: Check Token Identity Format
console.log('4️⃣ CHECKING TOKEN IDENTITY FORMAT...');
try {
  const testIdentity = 'test@example.com';
  const token = new twilio.jwt.AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { identity: testIdentity, ttl: 3600 }
  );
  
  const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true,
  });
  
  token.addGrant(voiceGrant);
  const jwtToken = token.toJwt();
  
  const parts = jwtToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  const tokenIdentity = payload.grants?.identity || payload.sub;
  
  console.log(`   Token identity: ${tokenIdentity}`);
  console.log(`   Expected format: client:${testIdentity}`);
  console.log(`   When device connects, Twilio will send: Caller=client:${tokenIdentity}`);
  
  // Check what handleWebRTC expects
  console.log(`   handleWebRTC expects: Caller or From = "client:email@domain.com"`);
  
  if (tokenIdentity === testIdentity) {
    console.log(`   ✅ Identity format is correct`);
    console.log(`   Twilio will send: Caller=client:${tokenIdentity}`);
  } else {
    console.log(`   ⚠️  Identity mismatch: token has ${tokenIdentity}, expected ${testIdentity}`);
  }
  
} catch (error) {
  console.log(`   ❌ Failed: ${error}`);
}

console.log('');

// Summary
console.log('='.repeat(70));
console.log('📋 DIAGNOSTIC SUMMARY');
console.log('='.repeat(70));
console.log('');
console.log('Common WebRTC issues:');
console.log('1. Token identity must be email format (user@domain.com)');
console.log('2. TwiML App must point to /webhook/webrtc');
console.log('3. handleWebRTC expects Caller=client:email@domain.com');
console.log('4. Device.connect() must send To parameter for direct calls');
console.log('5. Server must be running and accessible');
console.log('');
console.log('='.repeat(70));
