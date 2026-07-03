// Test script to verify AOIntel calls show up in /connect call history
const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'https://aoirail-production.up.railway.app';
const TEST_EMAIL = process.env.TEST_EMAIL || 'cnsysop@aoglobelife.com';

async function testAOICallsInConnect() {
  console.log('🧪 Testing AOIntel calls in /connect call history...\n');
  console.log(`📧 Testing for user: ${TEST_EMAIL}\n`);

  try {
    // Test 1: Check if there are AOIntel calls in masterlead
    console.log('📋 Test 1: Checking for AOIntel calls in masterlead...');
    const aoiCheckResponse = await fetch(`${API_BASE}/api/test-aoi-calls?email=${encodeURIComponent(TEST_EMAIL)}`);
    
    if (aoiCheckResponse.ok) {
      const aoiData = await aoiCheckResponse.json();
      console.log(`✅ Found ${aoiData.count || 0} AOIntel calls in masterlead`);
      if (aoiData.calls && aoiData.calls.length > 0) {
        console.log(`   Sample call: ${aoiData.calls[0].first_name} ${aoiData.calls[0].last_name} - ${aoiData.calls[0].phone}`);
      }
    } else {
      console.log('⚠️  Could not check AOIntel calls (endpoint might not exist)');
    }
    console.log('');

    // Test 2: Test the recent-calls endpoint
    console.log('📋 Test 2: Testing /api/dashboard/recent-calls endpoint...');
    console.log('⚠️  Note: This endpoint requires authentication, so it might fail without proper session');
    
    const recentCallsResponse = await fetch(`${API_BASE}/api/dashboard/recent-calls?range=today`, {
      headers: {
        'Cookie': `session=test` // This won't work, but shows what's needed
      }
    });

    console.log(`📡 Response status: ${recentCallsResponse.status} ${recentCallsResponse.statusText}`);
    
    if (recentCallsResponse.ok) {
      const calls = await recentCallsResponse.json();
      console.log(`✅ Received ${Array.isArray(calls) ? calls.length : 0} calls`);
      
      if (Array.isArray(calls) && calls.length > 0) {
        console.log('\n📞 Sample calls:');
        calls.slice(0, 5).forEach((call, index) => {
          console.log(`   ${index + 1}. ${call.notes || 'Unknown'} - ${call.phoneNumber || 'N/A'}`);
          console.log(`      Status: ${call.status}, Market: ${call.market || 'N/A'}, Created: ${call.createdAt}`);
          if (call.id && call.id.toString().startsWith('aoi-')) {
            console.log(`      ✅ This is an AOIntel call! (ID: ${call.id})`);
          }
        });
        
        // Check if any are AOIntel calls
        const aoiCalls = calls.filter(call => call.id && call.id.toString().startsWith('aoi-'));
        if (aoiCalls.length > 0) {
          console.log(`\n🎉 SUCCESS! Found ${aoiCalls.length} AOIntel calls in the results!`);
        } else {
          console.log(`\n⚠️  No AOIntel calls found (they might not have the 'aoi-' prefix or there are none for this user)`);
        }
      } else {
        console.log('⚠️  No calls returned or invalid response format');
      }
    } else {
      const errorText = await recentCallsResponse.text();
      console.log(`❌ Request failed: ${errorText.substring(0, 200)}`);
      console.log('\n💡 To test properly, you need to:');
      console.log('   1. Log in to the app');
      console.log('   2. Navigate to /connect');
      console.log('   3. Check the Call History tab');
      console.log('   4. Look for calls with AOIntel market or calls from masterlead');
    }

    console.log('\n✅ Test completed!');
    console.log('\n💡 Manual testing steps:');
    console.log('   1. Log in to the app at /connect');
    console.log('   2. Go to Call History tab');
    console.log('   3. Check if AOIntel calls appear (they should have market="AOIntel" or similar)');
    console.log('   4. Check browser console for logs showing AOIntel calls being fetched');

  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testAOICallsInConnect();

