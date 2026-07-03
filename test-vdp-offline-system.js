#!/usr/bin/env node

/**
 * VDP Offline System Test
 * Tests the automatic agent offline switching based on activity
 */

const BASE_URL = 'http://localhost:5000';
const TEST_AGENT = 'cnsysop@aoglobelife.com';

// Test scenarios
const tests = [
  {
    name: 'Check Agent VDP Status',
    endpoint: '/api/vdp/check-status/' + TEST_AGENT,
    method: 'POST',
    description: 'Check if agent should be taken offline based on current activity'
  },
  {
    name: 'Force Agent Offline',
    endpoint: '/api/vdp/force-offline/' + TEST_AGENT,
    method: 'POST',
    body: { reason: 'Manual test - agent busy' },
    description: 'Manually take agent offline (triggers TaalkVDP.close())'
  },
  {
    name: 'Force Agent Online', 
    endpoint: '/api/vdp/force-online/' + TEST_AGENT,
    method: 'POST',
    body: { agentId: 'cnsysop', params: { states: ['NC', 'CA'] } },
    description: 'Manually bring agent online (triggers TaalkVDP.open())'
  },
  {
    name: 'Create Active Call (Should Trigger Offline)',
    endpoint: '/api/webrtc-connect',
    method: 'POST',
    body: { 
      To: '+15551234567',
      agentEmail: TEST_AGENT,
      leadName: 'Test Lead',
      leadId: 'test-123'
    },
    description: 'Start a call (should trigger VDP offline after 10 seconds)'
  }
];

async function runTest(test) {
  console.log(`\n🧪 ${test.name}`);
  console.log(`📝 ${test.description}`);
  
  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (test.body) {
      options.body = JSON.stringify(test.body);
    }
    
    const response = await fetch(BASE_URL + test.endpoint, options);
    const result = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(result, null, 2));
    
    // Special handling for VDP commands
    if (result.vdpCommand) {
      console.log(`🎯 VDP Command: ${result.vdpCommand}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return { error: error.message };
  }
}

async function main() {
  console.log('🎯 VDP Offline System Test Suite');
  console.log('================================\n');
  
  console.log('📋 Test Agent:', TEST_AGENT);
  console.log('🌐 Base URL:', BASE_URL);
  
  // Run tests sequentially
  for (const test of tests) {
    await runTest(test);
    
    // Wait between tests
    if (test !== tests[tests.length - 1]) {
      console.log('\n⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n🎉 VDP Test Suite Complete!');
  console.log('\n📋 Expected Behavior:');
  console.log('• Agent status checks should determine if offline needed');
  console.log('• Force offline should execute TaalkVDP.close()');
  console.log('• Force online should execute TaalkVDP.open(agentId, params)');
  console.log('• Active calls >10 seconds should trigger automatic offline');
  console.log('• VDP Controller in frontend will execute the commands automatically');
}

if (require.main === module) {
  main().catch(console.error);
}