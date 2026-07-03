import fetch from 'node-fetch';

/**
 * Test script to verify the /api/twilio/token endpoint works
 * This tests the actual endpoint that the WebRTC page uses
 */

const TEST_EMAIL = 'test@example.com';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function testTokenEndpoint() {
  console.log('='.repeat(60));
  console.log('🧪 TESTING WEBRTC TOKEN ENDPOINT');
  console.log('='.repeat(60));
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`Test Identity: ${TEST_EMAIL}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('📡 Fetching token from /api/twilio/token...');
    
    const response = await fetch(`${SERVER_URL}/api/twilio/token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Note: In a real scenario, you'd need session cookies here
      // For testing, the endpoint might require authentication
    });

    console.log(`   Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   Error response: ${errorText}`);
      
      if (response.status === 401) {
        console.log('\n⚠️  Authentication required - this is expected if not logged in');
        console.log('   The endpoint requires a valid session cookie');
        console.log('   Try opening the test page in a browser where you are logged in');
      } else if (response.status === 429) {
        console.log('\n⚠️  Rate limited - you may have an active token already');
      } else {
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return;
    }

    const data = await response.json();
    
    console.log('\n✅ TOKEN RECEIVED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`Token: ${data.token?.substring(0, 50)}...`);
    console.log(`Token length: ${data.token?.length || 0} characters`);
    console.log(`Identity: ${data.identity || 'N/A'}`);
    console.log(`App SID: ${data.appSid || 'N/A'}`);
    console.log('');
    
    // Decode token to verify
    if (data.token) {
      try {
        const parts = data.token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          console.log('📋 Token Payload (decoded):');
          console.log(`   Identity: ${payload.sub || payload.identity || 'N/A'}`);
          console.log(`   Issuer: ${payload.iss || 'N/A'}`);
          console.log(`   Expires: ${new Date((payload.exp || 0) * 1000).toISOString()}`);
          console.log(`   Issued: ${new Date((payload.iat || 0) * 1000).toISOString()}`);
          if (payload.grants) {
            console.log(`   Grants: ${JSON.stringify(payload.grants, null, 2)}`);
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Could not decode token: ${e}`);
      }
    }
    
    console.log('\n✅ Token endpoint is working correctly!');
    console.log('   You can now use this token with the Twilio Device SDK');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ TOKEN ENDPOINT TEST FAILED');
    console.error('='.repeat(60));
    console.error('Error:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Could not connect to server');
      console.error('   Make sure the server is running on', SERVER_URL);
      console.error('   Start it with: npm run dev');
    }
    
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Run the test
testTokenEndpoint();
