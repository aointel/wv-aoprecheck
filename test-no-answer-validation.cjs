require('dotenv').config();
const fetch = require('node-fetch');

globalThis.fetch = fetch;

async function testNoAnswerValidation() {
  try {
    console.log('🧪 TESTING NO_ANSWER VALIDATION\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Use a known lead ID from the previous conversation (lead 18792580 / ID 542109)
    const testLeadId = 542109;
    const testPhone = '5173583772';
    const testCallSid = 'CA' + Date.now().toString().slice(-17);
    
    console.log('📋 Using test lead:');
    console.log(`   Lead ID: ${testLeadId}`);
    console.log(`   Phone: ${testPhone}`);
    console.log(`   Call SID: ${testCallSid}\n`);

    // Test 1: Try to set no_answer with callDuration > 45 (should be blocked)
    console.log('🧪 TEST 1: Attempting to set "no_answer" with callDuration = 60s (should be BLOCKED)\n');
    
    const testPayload1 = {
      leadId: testLeadId,
      agentEmail: 'test@example.com',
      disposition: 'no_answer',
      notes: 'Test validation - should be blocked because call duration > 45s',
      leadPhone: testPhone,
      callDuration: 60, // > 45 seconds
      callSid: testCallSid
    };

    console.log('📤 Sending request to /api/outbound-dialer/save-disposition');
    console.log('   Payload:', JSON.stringify(testPayload1, null, 2));
    console.log('');

    const response1 = await fetch('https://aoirail-production.up.railway.app/api/outbound-dialer/save-disposition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload1)
    });

    const responseText1 = await response1.text();
    let responseData1;
    try {
      responseData1 = JSON.parse(responseText1);
    } catch (e) {
      responseData1 = responseText1;
    }

    console.log(`📥 Response Status: ${response1.status}`);
    console.log(`📥 Response Body:`, JSON.stringify(responseData1, null, 2));
    console.log('');

    if (response1.status === 400 && responseData1.error && responseData1.error.includes('answered')) {
      console.log('✅ TEST 1 PASSED!');
      console.log('   Validation correctly blocked "no_answer" for call with duration > 45s\n');
    } else if (response1.status === 200) {
      console.log('❌ TEST 1 FAILED!');
      console.log('   Validation should have blocked this but allowed it through\n');
    } else {
      console.log('⚠️  TEST 1: Unexpected response\n');
    }

    // Test 2: Try to set no_answer with callDuration = 30s (should be allowed)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🧪 TEST 2: Attempting to set "no_answer" with callDuration = 30s (should be ALLOWED)\n');
    
    const testPayload2 = {
      leadId: testLeadId,
      agentEmail: 'test@example.com',
      disposition: 'no_answer',
      notes: 'Test validation - should be allowed because duration < 45s',
      leadPhone: testPhone,
      callDuration: 30, // < 45 seconds
      callSid: testCallSid + '-2'
    };

    console.log('📤 Sending request...');
    console.log('   Payload:', JSON.stringify(testPayload2, null, 2));
    console.log('');

    const response2 = await fetch('https://aoirail-production.up.railway.app/api/outbound-dialer/save-disposition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload2)
    });

    const responseText2 = await response2.text();
    let responseData2;
    try {
      responseData2 = JSON.parse(responseText2);
    } catch (e) {
      responseData2 = responseText2;
    }

    console.log(`📥 Response Status: ${response2.status}`);
    console.log(`📥 Response Body:`, JSON.stringify(responseData2, null, 2));
    console.log('');

    if (response2.status === 200) {
      console.log('✅ TEST 2 PASSED!');
      console.log('   Validation correctly allowed "no_answer" for call with duration < 45s\n');
    } else if (response2.status === 400) {
      console.log('⚠️  TEST 2: Validation blocked this (may be due to other validation rules)\n');
    } else {
      console.log('⚠️  TEST 2: Unexpected response\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 SUMMARY:');
    console.log('   Test 1 (duration > 45s): ' + (response1.status === 400 ? '✅ BLOCKED (correct)' : '❌ ALLOWED (incorrect)'));
    console.log('   Test 2 (duration < 45s): ' + (response2.status === 200 ? '✅ ALLOWED (correct)' : '⚠️  BLOCKED'));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testNoAnswerValidation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
