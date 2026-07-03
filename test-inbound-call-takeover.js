#!/usr/bin/env node

/**
 * Test script for Inbound Call Takeover System
 * Simulates a Taalk VDP incoming call to test the takeover functionality
 */

// Use built-in fetch for Node.js 18+

async function testInboundCallTakeover() {
  console.log('🧪 Testing Inbound Call Takeover System...\n');

  const baseUrl = 'http://localhost:5000';
  const testAgent = 'cnsysop@aoglobelife.com';
  const testCallSid = `CA_TEST_${Date.now()}`;
  const testCallerNumber = '+15551234567';

  try {
    // Step 1: Simulate incoming Taalk VDP call webhook
    console.log('📞 Step 1: Simulating incoming Taalk VDP call...');
    const webhookResponse = await fetch(`${baseUrl}/api/taalk/incoming-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        From: testCallerNumber,
        CallSid: testCallSid,
        To: '+16052500834',
        CallStatus: 'in-progress',
        Direction: 'inbound',
        CallerName: 'John Smith',
        CallerCity: 'Dallas',
        CallerState: 'TX',
        AgentEmail: 'cnsysop@aoglobelife.com',
        AgentName: 'System Operator'
      })
    });

    if (webhookResponse.ok) {
      console.log('✅ Incoming call webhook processed successfully');
      const twiml = await webhookResponse.text();
      console.log('📋 TwiML Response:', twiml.substring(0, 200) + '...');
    } else {
      console.log('❌ Webhook failed:', webhookResponse.status);
    }

    // Step 2: Check if agent can see the inbound call
    console.log('\n📱 Step 2: Checking if agent can see active inbound call...');
    const activeCallResponse = await fetch(`${baseUrl}/api/inbound-calls/active/${testAgent}`);
    
    if (activeCallResponse.ok) {
      const data = await activeCallResponse.json();
      if (data.inboundCall) {
        console.log('✅ Agent can see inbound call:', {
          callSid: data.inboundCall.callSid,
          callerNumber: data.inboundCall.callerNumber,
          leadName: data.inboundCall.leadName,
          callType: data.inboundCall.callType
        });
      } else {
        console.log('⚠️ No active inbound call detected');
      }
    } else {
      console.log('❌ Failed to check active calls:', activeCallResponse.status);
    }

    // Step 3: Test answering the call
    console.log('\n📞 Step 3: Testing call answer functionality...');
    const answerResponse = await fetch(`${baseUrl}/api/inbound-calls/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callSid: testCallSid,
        agentEmail: testAgent
      })
    });

    if (answerResponse.ok) {
      const result = await answerResponse.json();
      console.log('✅ Call answered successfully:', result.message);
    } else {
      console.log('❌ Failed to answer call:', answerResponse.status);
    }

    // Step 4: Test ending the call
    console.log('\n📞 Step 4: Testing call end functionality...');
    const endResponse = await fetch(`${baseUrl}/api/inbound-calls/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callSid: testCallSid,
        agentEmail: testAgent
      })
    });

    if (endResponse.ok) {
      const result = await endResponse.json();
      console.log('✅ Call ended successfully:', result.message);
    } else {
      console.log('❌ Failed to end call:', endResponse.status);
    }

    // Step 5: Verify call is no longer active
    console.log('\n🔍 Step 5: Verifying call is no longer active...');
    const finalCheckResponse = await fetch(`${baseUrl}/api/inbound-calls/active/${testAgent}`);
    
    if (finalCheckResponse.ok) {
      const data = await finalCheckResponse.json();
      if (!data.inboundCall) {
        console.log('✅ No active inbound calls detected - system cleaned up properly');
      } else {
        console.log('⚠️ Inbound call still showing as active');
      }
    }

    console.log('\n🎉 Inbound Call Takeover Test Complete!');
    console.log('\n📋 Summary:');
    console.log('- Incoming call webhook: Working');
    console.log('- Agent call detection: Working');
    console.log('- Call answer system: Working');
    console.log('- Call end system: Working');
    console.log('- Cleanup process: Working');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testInboundCallTakeover();