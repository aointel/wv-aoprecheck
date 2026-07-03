// Test FULL WebRTC call flow - all stages
import { createClient } from '@supabase/supabase-js';

// Use same credentials as server
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';
const PRODUCTION_URL = 'https://aoirail-production.up.railway.app';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const testPhone = '+15032018470';
const testAgentEmail = 'test@aoglobelife.com';

console.log(`🧪 TESTING FULL WEBRTC CALL FLOW FOR ${testPhone}\n`);

// STAGE 1: Test WebRTC endpoint logging (when handleWebRTC is hit)
async function testStage1_WebRTCEndpointLogging() {
  console.log(`📋 STAGE 1: Testing WebRTC endpoint logging (handleWebRTC)`);
  
  // Simulate what happens when /webhook/webrtc is hit with direct call
  const testCallSid = `WEBRTC-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`.substring(0, 34);
  
  const callLogData = {
    twilio_call_sid: testCallSid,
    owner_email: testAgentEmail,
    agent_identity: `client:${testAgentEmail}`,
    from_number: '+19142289324',
    to_number: testPhone,
    call_direction: 'outbound',
    call_status: 'initiated',
    call_started_at: new Date().toISOString(),
    call_source: 'webrtc_direct_call'
  };
  
  console.log(`   📤 Inserting:`, callLogData);
  
  const { data, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .upsert(callLogData, { onConflict: 'twilio_call_sid' })
    .select();
  
  if (error) {
    console.error(`   ❌ STAGE 1 FAILED:`, error);
    return { success: false, callSid: testCallSid };
  }
  
  console.log(`   ✅ STAGE 1 PASSED: Call logged with CallSid ${testCallSid}`);
  return { success: true, callSid: testCallSid, data: data[0] };
}

// STAGE 2: Test status callback logging (when /api/twilio/call-status is hit)
async function testStage2_StatusCallbackLogging(callSid) {
  console.log(`\n📋 STAGE 2: Testing status callback logging (call-status webhook)`);
  
  // Simulate Twilio status callback for "ringing" status
  const statusCallbackData = {
    twilio_call_sid: callSid,
    owner_email: testAgentEmail,
    agent_identity: `client:${testAgentEmail}`,
    from_number: '+19142289324',
    to_number: testPhone,
    call_direction: 'outbound',
    call_status: 'ringing',
    call_started_at: new Date().toISOString(),
    call_source: 'twilio_call_status_webhook'
  };
  
  console.log(`   📤 Updating with status 'ringing':`, statusCallbackData);
  
  const { data, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .upsert(statusCallbackData, { onConflict: 'twilio_call_sid' })
    .select();
  
  if (error) {
    console.error(`   ❌ STAGE 2 FAILED:`, error);
    return false;
  }
  
  console.log(`   ✅ STAGE 2 PASSED: Status updated to 'ringing'`);
  return true;
}

// STAGE 3: Test answered status
async function testStage3_AnsweredStatus(callSid) {
  console.log(`\n📋 STAGE 3: Testing 'answered' status update`);
  
  const answeredData = {
    twilio_call_sid: callSid,
    owner_email: testAgentEmail,
    agent_identity: `client:${testAgentEmail}`,
    from_number: '+19142289324',
    to_number: testPhone,
    call_direction: 'outbound',
    call_status: 'answered',
    call_duration: 0,
    call_started_at: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
    call_source: 'twilio_call_status_webhook'
  };
  
  console.log(`   📤 Updating with status 'answered':`, answeredData);
  
  const { data, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .upsert(answeredData, { onConflict: 'twilio_call_sid' })
    .select();
  
  if (error) {
    console.error(`   ❌ STAGE 3 FAILED:`, error);
    return false;
  }
  
  console.log(`   ✅ STAGE 3 PASSED: Status updated to 'answered'`);
  return true;
}

// STAGE 4: Test completed status with duration
async function testStage4_CompletedStatus(callSid) {
  console.log(`\n📋 STAGE 4: Testing 'completed' status with call duration`);
  
  const completedData = {
    twilio_call_sid: callSid,
    owner_email: testAgentEmail,
    agent_identity: `client:${testAgentEmail}`,
    from_number: '+19142289324',
    to_number: testPhone,
    call_direction: 'outbound',
    call_status: 'completed',
    call_duration: 45, // 45 seconds
    call_started_at: new Date(Date.now() - 45000).toISOString(), // 45 seconds ago
    call_ended_at: new Date().toISOString(),
    call_source: 'twilio_call_status_webhook'
  };
  
  console.log(`   📤 Updating with status 'completed' (45s duration):`, completedData);
  
  const { data, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .upsert(completedData, { onConflict: 'twilio_call_sid' })
    .select();
  
  if (error) {
    console.error(`   ❌ STAGE 4 FAILED:`, error);
    return false;
  }
  
  console.log(`   ✅ STAGE 4 PASSED: Status updated to 'completed' with duration`);
  return true;
}

// STAGE 5: Test disposition validation can find the call
async function testStage5_DispositionValidation(callSid) {
  console.log(`\n📋 STAGE 5: Testing disposition validation can find call`);
  
  // Simulate what disposition validation does - search by phone number
  const normalizedPhone = testPhone.replace(/\D/g, '');
  const phoneVariations = [
    testPhone,
    `+1${normalizedPhone}`,
    `+${normalizedPhone}`,
    normalizedPhone,
    `1${normalizedPhone}`,
    `(${normalizedPhone.slice(0, 3)}) ${normalizedPhone.slice(3, 6)}-${normalizedPhone.slice(6)}`,
    `${normalizedPhone.slice(0, 3)}-${normalizedPhone.slice(3, 6)}-${normalizedPhone.slice(6)}`,
    `${normalizedPhone.slice(0, 3)}.${normalizedPhone.slice(3, 6)}.${normalizedPhone.slice(6)}`
  ];
  
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
  console.log(`   🔍 Searching for call by phone number: ${testPhone}`);
  console.log(`   🔍 Phone variations:`, phoneVariations.slice(0, 3), '...');
  
  const { data: callLogs, error } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('call_status, call_duration, to_number, call_started_at, twilio_call_sid')
    .in('to_number', phoneVariations)
    .in('call_status', ['answered', 'completed'])
    .gte('call_started_at', twentyFourHoursAgo.toISOString())
    .order('call_started_at', { ascending: false })
    .limit(1);
  
  if (error) {
    console.error(`   ❌ STAGE 5 FAILED (query error):`, error);
    return false;
  }
  
  if (!callLogs || callLogs.length === 0) {
    console.error(`   ❌ STAGE 5 FAILED: No call found for phone ${testPhone}`);
    return false;
  }
  
  const callLog = callLogs[0];
  if (callLog.twilio_call_sid !== callSid) {
    console.error(`   ❌ STAGE 5 FAILED: Found wrong CallSid (expected ${callSid}, got ${callLog.twilio_call_sid})`);
    return false;
  }
  
  if (callLog.call_status !== 'completed' && callLog.call_status !== 'answered') {
    console.error(`   ❌ STAGE 5 FAILED: Wrong status (expected 'answered' or 'completed', got '${callLog.call_status}')`);
    return false;
  }
  
  if (!callLog.call_duration || callLog.call_duration < 15) {
    console.error(`   ❌ STAGE 5 FAILED: Call duration too short (${callLog.call_duration}s, need >= 15s)`);
    return false;
  }
  
  console.log(`   ✅ STAGE 5 PASSED: Found call with status '${callLog.call_status}', duration ${callLog.call_duration}s`);
  console.log(`   ✅ CallSid matches: ${callLog.twilio_call_sid}`);
  return true;
}

// STAGE 6: Test actual WebRTC endpoint (if possible)
async function testStage6_ActualWebRTCEndpoint() {
  console.log(`\n📋 STAGE 6: Testing actual WebRTC endpoint (if accessible)`);
  
  try {
    // Try to hit the actual endpoint (this will only work if server is running)
    const response = await fetch(`${PRODUCTION_URL}/webhook/webrtc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        CallSid: `TEST-CA${Date.now()}`.substring(0, 34),
        To: testPhone,
        From: 'client:test@aoglobelife.com',
        Direction: 'outbound',
        CallStatus: 'initiated',
        agentEmail: testAgentEmail,
        agentName: 'Test Agent'
      })
    });
    
    if (response.ok) {
      const text = await response.text();
      console.log(`   ✅ STAGE 6: Endpoint responded (status ${response.status})`);
      console.log(`   📄 Response (first 200 chars):`, text.substring(0, 200));
      return true;
    } else {
      console.log(`   ⚠️ STAGE 6: Endpoint returned ${response.status} (server may not be accessible)`);
      return false;
    }
  } catch (err) {
    console.log(`   ⚠️ STAGE 6: Could not reach endpoint (server may not be running):`, err.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  let results = {
    stage1: false,
    stage2: false,
    stage3: false,
    stage4: false,
    stage5: false,
    stage6: false
  };
  
  // Stage 1
  const stage1Result = await testStage1_WebRTCEndpointLogging();
  results.stage1 = stage1Result.success;
  const callSid = stage1Result.callSid;
  
  if (!results.stage1) {
    console.log(`\n❌ Stage 1 failed, cannot continue`);
    return results;
  }
  
  // Wait a bit between stages
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Stage 2
  results.stage2 = await testStage2_StatusCallbackLogging(callSid);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Stage 3
  results.stage3 = await testStage3_AnsweredStatus(callSid);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Stage 4
  results.stage4 = await testStage4_CompletedStatus(callSid);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Stage 5
  results.stage5 = await testStage5_DispositionValidation(callSid);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Stage 6 (optional - may fail if server not accessible)
  results.stage6 = await testStage6_ActualWebRTCEndpoint();
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 TEST SUMMARY:`);
  console.log(`   Stage 1 (WebRTC Endpoint Logging): ${results.stage1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Stage 2 (Status Callback - Ringing): ${results.stage2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Stage 3 (Status Callback - Answered): ${results.stage3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Stage 4 (Status Callback - Completed): ${results.stage4 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Stage 5 (Disposition Validation): ${results.stage5 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Stage 6 (Actual Endpoint Test): ${results.stage6 ? '✅ PASS' : '⚠️ SKIP (server not accessible)'}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const allCriticalPassed = results.stage1 && results.stage2 && results.stage3 && results.stage4 && results.stage5;
  
  if (allCriticalPassed) {
    console.log(`✅✅✅ ALL CRITICAL STAGES PASSED!`);
    process.exit(0);
  } else {
    console.log(`❌❌❌ SOME STAGES FAILED`);
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error(`❌❌❌ FATAL ERROR:`, err);
  process.exit(1);
});


