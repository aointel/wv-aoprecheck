import twilio from 'twilio';
import fetch from 'node-fetch';

/**
 * Comprehensive diagnostic to find why WebRTC isn't working
 */

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_API_KEY = 'SK80ce6ceab1eb9df4a14c9a646f01304f';
const TWILIO_API_SECRET = 'FbjtNK2OHaGAfoHkerTzE0har8KzsNLm';
const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

console.log('='.repeat(70));
console.log('🔍 FINDING THE REAL WEBRTC PROBLEM');
console.log('='.repeat(70));
console.log('');

const issues: string[] = [];
const fixes: string[] = [];

// Test 1: Token Generation
console.log('1️⃣ TOKEN GENERATION');
try {
  const token = new twilio.jwt.AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    { identity: 'test@example.com', ttl: 3600 }
  );
  
  const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true,
  });
  
  token.addGrant(voiceGrant);
  const jwtToken = token.toJwt();
  
  const parts = jwtToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  
  console.log(`   ✅ Token works`);
  console.log(`   Identity: ${payload.grants?.identity}`);
  console.log(`   App SID: ${payload.grants?.voice?.outgoing?.application_sid}`);
  
  if (payload.grants?.voice?.outgoing?.application_sid !== TWILIO_TWIML_APP_SID) {
    issues.push('Token has wrong App SID');
    fixes.push('Fix: Update token generation to use correct App SID');
  }
  
} catch (error) {
  issues.push(`Token generation failed: ${error}`);
  console.log(`   ❌ FAILED: ${error}`);
}

console.log('');

// Test 2: Webhook Endpoint
console.log('2️⃣ WEBHOOK ENDPOINT');
try {
  const testBody = {
    Caller: 'client:test@example.com',
    To: '5032018470',
    From: 'client:test@example.com',
    CallSid: 'CA_TEST_' + Date.now(),
    agentEmail: 'test@example.com',
    leadName: 'Test',
    leadState: 'OR'
  };
  
  const response = await fetch(`${SERVER_URL}/webhook/webrtc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(testBody as any).toString()
  });
  
  const responseText = await response.text();
  
  if (response.status === 200 && responseText.includes('<Dial>')) {
    console.log(`   ✅ Webhook works - returns TwiML`);
    if (responseText.includes('<Number>5032018470</Number>')) {
      console.log(`   ✅ TwiML contains correct phone number`);
    } else {
      issues.push('Webhook TwiML missing phone number');
      console.log(`   ❌ PROBLEM: TwiML doesn't contain phone number`);
    }
  } else if (response.status === 403) {
    issues.push('Webhook rejecting calls (403)');
    fixes.push('Fix: Check handleWebRTC - it expects Caller=client:email@domain.com');
    console.log(`   ❌ PROBLEM: Webhook rejecting calls`);
  } else {
    issues.push(`Webhook returned ${response.status}`);
    console.log(`   ❌ PROBLEM: Status ${response.status}`);
  }
  
} catch (error: any) {
  if (error.message?.includes('ECONNREFUSED')) {
    issues.push('Server not running');
    fixes.push('Fix: Start server with npm run dev');
    console.log(`   ❌ PROBLEM: Server not running`);
  } else {
    issues.push(`Webhook test failed: ${error.message}`);
    console.log(`   ❌ FAILED: ${error.message}`);
  }
}

console.log('');

// Test 3: Token Endpoint (with auth)
console.log('3️⃣ TOKEN ENDPOINT (requires auth)');
try {
  const response = await fetch(`${SERVER_URL}/api/twilio/token`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (response.status === 401) {
    console.log(`   ⚠️  Returns 401 (auth required - expected)`);
    console.log(`   This is normal - endpoint requires logged-in session`);
    console.log(`   Real users need to be logged in to get tokens`);
  } else if (response.status === 200) {
    console.log(`   ✅ Token endpoint works`);
  } else {
    issues.push(`Token endpoint returned ${response.status}`);
    console.log(`   ❌ PROBLEM: Status ${response.status}`);
  }
  
} catch (error: any) {
  if (error.message?.includes('ECONNREFUSED')) {
    console.log(`   ⚠️  Server not running`);
  } else {
    issues.push(`Token endpoint test failed: ${error.message}`);
  }
}

console.log('');

// Summary
console.log('='.repeat(70));
console.log('📋 DIAGNOSIS SUMMARY');
console.log('='.repeat(70));
console.log('');

if (issues.length === 0) {
  console.log('✅ ALL TESTS PASSED');
  console.log('');
  console.log('Token generation: ✅ WORKING');
  console.log('Webhook endpoint: ✅ WORKING');
  console.log('Token endpoint: ⚠️  Requires auth (expected)');
  console.log('');
  console.log('🔍 IF WEBRTC STILL ISN\'T WORKING:');
  console.log('');
  console.log('The problem is likely:');
  console.log('1. TwiML App Voice URL not configured correctly');
  console.log('   → Check Twilio Console → Voice → TwiML Apps');
  console.log('   → Should point to: https://aoirail-production-baa2.up.railway.app/webhook/webrtc');
  console.log('');
  console.log('2. Users not getting tokens (auth issue)');
  console.log('   → Check browser console for 401 errors');
  console.log('   → Verify users are logged in');
  console.log('');
  console.log('3. Browser blocking WebRTC');
  console.log('   → Check microphone permissions');
  console.log('   → Ensure HTTPS (WebRTC requires secure context)');
  console.log('   → Check browser console for errors');
  console.log('');
  console.log('4. Device.connect() not being called');
  console.log('   → Check browser console for device errors');
  console.log('   → Verify device is ready before calling connect()');
} else {
  console.log('❌ ISSUES FOUND:');
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
  console.log('');
  if (fixes.length > 0) {
    console.log('🔧 FIXES:');
    fixes.forEach((fix, i) => {
      console.log(`   ${i + 1}. ${fix}`);
    });
  }
}

console.log('');
console.log('='.repeat(70));
