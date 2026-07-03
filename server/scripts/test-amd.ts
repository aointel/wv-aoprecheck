/**
 * Test script to verify AMD (Answering Machine Detection) is working
 * Calls 5032018470 and checks if answered_by is captured
 */

import twilio from 'twilio';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from '../hardcoded-config';
import { supabaseAdmin } from '../supabase';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const TEST_NUMBER = '+15032018470';
const BASE_URL = 'https://aoirail-production.up.railway.app';

async function testAMD() {
  console.log('🧪 Starting AMD test...');
  console.log(`📞 Calling ${TEST_NUMBER} to test AMD`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  
  try {
    // Make a test call with AMD enabled
    const call = await client.calls.create({
      to: TEST_NUMBER,
      from: '+19142289324', // Your Twilio number
      url: `${BASE_URL}/api/twilio/test-amd-voice`,
      method: 'POST',
      statusCallback: `${BASE_URL}/api/twilio/call-status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });
    
    console.log(`✅ Call created: ${call.sid}`);
    console.log(`📊 Call status: ${call.status}`);
    console.log(`⏳ Waiting for call to complete and AMD result...`);
    
    // Wait for call to complete (max 60 seconds)
    let callCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds
    
    while (!callCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
      
      // Check call status
      const callStatus = await client.calls(call.sid).fetch();
      console.log(`   Attempt ${attempts}: Call status = ${callStatus.status}, Duration = ${callStatus.duration || 0}s`);
      
      if (callStatus.status === 'completed' || callStatus.status === 'failed' || callStatus.status === 'busy' || callStatus.status === 'no-answer') {
        callCompleted = true;
        
        // Wait a bit more for AMD result to be processed
        console.log(`   ⏳ Call ended, waiting 5 seconds for status callback and AMD result to be processed...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check database for answered_by (check both parent and child calls)
        if (supabaseAdmin) {
          // First try parent call
          let { data: callLog, error } = await supabaseAdmin
            .from('twilio_call_logs')
            .select('twilio_call_sid, answered_by, call_duration, call_status, to_number, from_number, parent_call_sid')
            .eq('twilio_call_sid', call.sid)
            .maybeSingle();
          
          // If not found, check for child calls
          if (!callLog) {
            console.log(`   🔍 Parent call not found, checking for child calls...`);
            const { data: childCalls, error: childError } = await supabaseAdmin
              .from('twilio_call_logs')
              .select('twilio_call_sid, answered_by, call_duration, call_status, to_number, from_number, parent_call_sid')
              .eq('parent_call_sid', call.sid)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (childError) {
              console.error(`❌ Error querying child calls:`, childError);
            } else if (childCalls && childCalls.length > 0) {
              callLog = childCalls[0];
              console.log(`   ✅ Found child call: ${callLog.twilio_call_sid}`);
            }
          }
          
          if (error) {
            console.error(`❌ Error querying database:`, error);
          } else if (callLog) {
            console.log(`\n📊 CALL LOG RESULTS:`);
            console.log(`   Call SID: ${callLog.twilio_call_sid}`);
            console.log(`   Parent SID: ${callLog.parent_call_sid || 'N/A'}`);
            console.log(`   From: ${callLog.from_number}`);
            console.log(`   To: ${callLog.to_number}`);
            console.log(`   Status: ${callLog.call_status}`);
            console.log(`   Duration: ${callLog.call_duration || 0}s`);
            console.log(`   ✅ answered_by: ${callLog.answered_by || '❌ NULL/MISSING'}`);
            
            if (callLog.answered_by) {
              console.log(`\n✅ SUCCESS: AMD is working! answered_by = "${callLog.answered_by}"`);
            } else {
              console.log(`\n❌ FAILURE: AMD is NOT working - answered_by is NULL or missing`);
              console.log(`   This means the AMD result was not captured.`);
              console.log(`   Check if /api/twilio/amd-result endpoint is being called.`);
            }
          } else {
            console.log(`\n⚠️  Call log not found in database for ${call.sid}`);
            console.log(`   Checking all recent calls...`);
            
            // Check last 5 calls to see if any match
            const { data: recentCalls } = await supabaseAdmin
              .from('twilio_call_logs')
              .select('twilio_call_sid, to_number, created_at')
              .order('created_at', { ascending: false })
              .limit(5);
            
            if (recentCalls && recentCalls.length > 0) {
              console.log(`   Recent calls in database:`);
              recentCalls.forEach((c: any) => {
                console.log(`     - ${c.twilio_call_sid} to ${c.to_number} at ${c.created_at}`);
              });
            }
          }
        } else {
          console.error(`❌ supabaseAdmin is not available`);
        }
      }
    }
    
    if (!callCompleted) {
      console.log(`\n⏰ Timeout: Call did not complete within ${maxAttempts} seconds`);
    }
    
  } catch (error) {
    console.error(`❌ Test failed:`, error);
    if (error instanceof Error) {
      console.error(`   Error message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
  }
}

// Run the test
testAMD().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});
