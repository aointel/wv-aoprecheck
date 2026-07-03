/**
 * Comprehensive WebRTC Registration Test Script
 * 
 * This script tests the full WebRTC registration flow:
 * 1. Fetches/generates Twilio token
 * 2. Creates Twilio Device
 * 3. Attempts registration
 * 4. Monitors registration state with full diagnostics
 * 5. Tests retry logic if registration fails
 * 
 * Usage:
 *   npm run test:webrtc-registration
 *   OR
 *   tsx test-webrtc-registration.ts
 */

import twilio from 'twilio';
import fetch from 'node-fetch';

// Twilio credentials (from your existing test file)
const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_API_KEY = 'SK80ce6ceab1eb9df4a14c9a646f01304f';
const TWILIO_API_SECRET = 'FbjtNK2OHaGAfoHkerTzE0har8KzsNLm';
const TWILIO_TWIML_APP_SID = 'AP958ebb1810e2315e9ff008cc06e91c1d';

// Test configuration
const TEST_IDENTITY = process.env.TEST_IDENTITY || 'test@example.com';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const USE_ENDPOINT = process.env.USE_ENDPOINT === 'true'; // Set to true to test endpoint instead of direct generation
const MAX_RETRIES = 3;
const REGISTER_TIMEOUT_MS = 8000;

interface RegistrationResult {
  success: boolean;
  attempt: number;
  elapsedMs: number;
  finalState?: string;
  error?: string;
  diagnostics?: any;
}

/**
 * Generate token directly (bypasses endpoint)
 */
function generateTokenDirect(identity: string): string {
  console.log('🔧 Generating WebRTC token directly...');
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
    
    if (!payload.grants?.voice) {
      throw new Error('Token missing VoiceGrant - registration will fail!');
    }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired!');
    }
  }
  
  return jwtToken;
}

/**
 * Fetch token from endpoint
 */
async function fetchTokenFromEndpoint(identity: string): Promise<string> {
  console.log('📡 Fetching token from /api/twilio/token endpoint...');
  console.log(`   Server: ${SERVER_URL}`);
  console.log(`   Identity: ${identity}`);
  
  const response = await fetch(`${SERVER_URL}/api/twilio/token`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': identity,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.token) {
    throw new Error('No token in response');
  }
  
  console.log(`✅ Token received: ${data.token.length} chars`);
  console.log(`   Identity: ${data.identity || 'N/A'}`);
  
  return data.token;
}

/**
 * Test WebSocket connectivity to Twilio
 */
async function testWebSocketConnectivity(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('🔍 Testing WebSocket connectivity to Twilio...');
    
    // Note: In Node.js, we'd need ws package, but this is mainly for browser testing
    // For Node.js, we'll skip this and just log
    if (typeof WebSocket === 'undefined') {
      console.log('   ⚠️  WebSocket not available (Node.js environment)');
      console.log('   This test requires a browser environment');
      resolve(false);
      return;
    }
    
    const testWs = new WebSocket('wss://chunderw-gll.twilio.com');
    const timeout = setTimeout(() => {
      testWs.close();
      console.log('   ❌ WebSocket test timed out after 5s');
      resolve(false);
    }, 5000);
    
    testWs.onopen = () => {
      clearTimeout(timeout);
      console.log('   ✅ WebSocket test: CONNECTED to Twilio signaling');
      testWs.close();
      resolve(true);
    };
    
    testWs.onerror = (err) => {
      clearTimeout(timeout);
      console.log('   ❌ WebSocket test: FAILED to connect');
      console.log('   This likely means firewall/VPN is blocking WSS connections');
      resolve(false);
    };
  });
}

/**
 * Test registration in browser environment
 * This would be called from a browser context with Twilio SDK loaded
 */
async function testRegistrationInBrowser(token: string): Promise<RegistrationResult> {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(70));
  console.log('🧪 TESTING WEBRTC REGISTRATION');
  console.log('='.repeat(70));
  
  // Check if Twilio SDK is available
  if (typeof (window as any).Twilio === 'undefined') {
    throw new Error('Twilio SDK not loaded. This script must run in a browser with Twilio SDK.');
  }
  
  // Browser WebRTC support check
  const webrtcSupport = {
    hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
    hasRTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
    hasWebSocket: typeof WebSocket !== 'undefined',
    hasAudioContext: typeof AudioContext !== 'undefined',
  };
  console.log('📋 Browser WebRTC support:', webrtcSupport);
  
  // Network info
  const networkInfo = {
    onLine: navigator.onLine,
    connection: (navigator as any).connection ? {
      effectiveType: (navigator as any).connection.effectiveType,
      downlink: (navigator as any).connection.downlink,
      rtt: (navigator as any).connection.rtt,
    } : 'not available',
  };
  console.log('📋 Network info:', networkInfo);
  
  // Test WebSocket connectivity
  await testWebSocketConnectivity();
  
  // Create device
  console.log('\n📱 Creating Twilio Device...');
  const deviceOptions = {
    debug: true,
    codecPreferences: ['opus', 'pcmu'],
    edge: 'roaming',
    enableRingingState: true,
  };
  
  let device: any;
  try {
    device = new (window as any).Twilio.Device(token, deviceOptions);
    console.log('✅ Device created');
    console.log(`   State: ${device.state}`);
    console.log(`   Identity: ${device.identity}`);
  } catch (error: any) {
    throw new Error(`Device creation failed: ${error.message}`);
  }
  
  // Registration with retry logic
  let registered = false;
  let retryCount = 0;
  
  const tryRegister = (attempt: number): Promise<boolean> => {
    return new Promise((resolve) => {
      retryCount = attempt;
      registered = false;
      
      console.log(`\n🔄 Registration attempt #${attempt}/${MAX_RETRIES}`);
      
      // Setup event handlers
      device.off(); // Remove previous handlers
      
      device.on('registering', () => {
        console.log('   📡 Device registering...');
      });
      
      device.on('registered', () => {
        registered = true;
        console.log('   ✅ Device registered successfully!');
        resolve(true);
      });
      
      device.on('ready', () => {
        registered = true;
        console.log('   ✅ Device ready!');
        resolve(true);
      });
      
      device.on('error', (err: any) => {
        console.error(`   ❌ Device error: ${err.code} - ${err.message}`);
      });
      
      device.on('offline', (err: any) => {
        console.error(`   ❌ Device offline: ${err?.message || 'Unknown'}`);
      });
      
      // Monitor WebSocket state
      const monitorWebSocket = () => {
        try {
          const deviceInternal = device as any;
          const signaling = deviceInternal?._signaling;
          const ws = signaling?._ws || signaling?.ws;
          if (ws) {
            const stateText = ws.readyState === 0 ? 'CONNECTING' : 
                             ws.readyState === 1 ? 'OPEN' : 
                             ws.readyState === 2 ? 'CLOSING' : 'CLOSED';
            console.log(`   🔍 WebSocket state: ${stateText} (${ws.readyState})`);
            
            if (ws.readyState === WebSocket.OPEN) {
              console.log('   ✅ WebSocket connection established!');
            } else if (ws.readyState === WebSocket.CLOSED) {
              console.log('   ❌ WebSocket closed - connection failed');
            }
          }
        } catch (e) {
          // Ignore - WebSocket may not be accessible
        }
      };
      
      // Call register
      try {
        device.register();
        console.log('   📡 device.register() called');
        
        // Monitor WebSocket periodically
        setTimeout(monitorWebSocket, 100);
        setTimeout(monitorWebSocket, 500);
        setTimeout(monitorWebSocket, 1000);
        setTimeout(monitorWebSocket, 3000);
      } catch (error: any) {
        console.error(`   ❌ register() call failed: ${error.message}`);
        resolve(false);
        return;
      }
      
      // Timeout
      const timeout = setTimeout(() => {
        if (!registered) {
          console.log(`   ⏱️  Registration attempt #${attempt} timed out after ${REGISTER_TIMEOUT_MS}ms`);
          console.log(`   📋 Device state: ${device.state}`);
          monitorWebSocket();
          resolve(false);
        }
      }, REGISTER_TIMEOUT_MS);
      
      // Clear timeout if registered
      const checkRegistered = () => {
        if (registered || device.state === 'registered' || device.state === 'ready') {
          clearTimeout(timeout);
          registered = true;
          resolve(true);
        }
      };
      
      device.once('registered', checkRegistered);
      device.once('ready', checkRegistered);
    });
  };
  
  // Run retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const success = await tryRegister(attempt);
    
    if (success) {
      const elapsed = Date.now() - startTime;
      console.log(`\n✅ Registration succeeded on attempt #${attempt} (${elapsed}ms)`);
      
      // Cleanup
      device.off();
      
      return {
        success: true,
        attempt,
        elapsedMs: elapsed,
        finalState: device.state,
      };
    }
    
    if (attempt < MAX_RETRIES) {
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`\n⏳ Waiting ${backoffMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
      // Cleanup and recreate device for retry
      console.log('🧹 Cleaning up device for retry...');
      try {
        device.off();
        if (device.state === 'registering' || device.state === 'registered') {
          device.unregister();
        }
        device.destroy();
      } catch (e) {
        console.warn('   ⚠️  Error during cleanup:', e);
      }
      
      // Recreate device
      console.log('🔄 Recreating device...');
      device = new (window as any).Twilio.Device(token, deviceOptions);
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`\n❌ Registration failed after ${MAX_RETRIES} attempts (${elapsed}ms)`);
  
  // Cleanup
  try {
    device.off();
    device.destroy();
  } catch (e) {
    // Ignore
  }
  
  return {
    success: false,
    attempt: MAX_RETRIES,
    elapsedMs: elapsed,
    finalState: device?.state,
    error: 'All registration attempts failed',
  };
}

/**
 * Main test function (Node.js - generates token and provides instructions)
 */
async function main() {
  console.log('='.repeat(70));
  console.log('🧪 WEBRTC REGISTRATION TEST SCRIPT');
  console.log('='.repeat(70));
  console.log(`Test Identity: ${TEST_IDENTITY}`);
  console.log(`Use Endpoint: ${USE_ENDPOINT}`);
  console.log(`Max Retries: ${MAX_RETRIES}`);
  console.log(`Register Timeout: ${REGISTER_TIMEOUT_MS}ms`);
  console.log('='.repeat(70));
  console.log('');
  
  try {
    // Get token
    let token: string;
    if (USE_ENDPOINT) {
      token = await fetchTokenFromEndpoint(TEST_IDENTITY);
    } else {
      token = generateTokenDirect(TEST_IDENTITY);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ TOKEN OBTAINED');
    console.log('='.repeat(70));
    console.log(`Token (first 100 chars): ${token.substring(0, 100)}...`);
    console.log(`Token length: ${token.length} characters`);
    console.log('');
    
    // Check environment
    if (typeof window === 'undefined') {
      console.log('⚠️  Running in Node.js environment');
      console.log('   This script needs to run in a browser to test registration');
      console.log('   The token above is valid and ready to use');
      console.log('');
      console.log('📋 To test registration:');
      console.log('   1. Open test-webrtc-registration.html in a browser');
      console.log('   2. Or use the token in your application');
      console.log('');
      console.log('📋 Token for manual testing:');
      console.log(token);
      return;
    }
    
    // Browser environment - run actual registration test
    const result = await testRegistrationInBrowser(token);
    
    console.log('\n' + '='.repeat(70));
    if (result.success) {
      console.log('✅ REGISTRATION TEST PASSED');
      console.log(`   Attempt: #${result.attempt}`);
      console.log(`   Elapsed: ${result.elapsedMs}ms`);
      console.log(`   Final State: ${result.finalState}`);
    } else {
      console.log('❌ REGISTRATION TEST FAILED');
      console.log(`   Attempts: ${result.attempt}`);
      console.log(`   Elapsed: ${result.elapsedMs}ms`);
      console.log(`   Final State: ${result.finalState}`);
      console.log(`   Error: ${result.error}`);
    }
    console.log('='.repeat(70));
    
  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error('='.repeat(70));
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    console.error('='.repeat(70));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main, generateTokenDirect, fetchTokenFromEndpoint, testRegistrationInBrowser };
