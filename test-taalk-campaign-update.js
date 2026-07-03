/**
 * Test Taalk Campaign Dial Rate Update - Full Test
 */

const campaignApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay5hZWQ1MDJlMi0wY2YxLTQ3NGQtYjQ2My0wNzczYzJiNWRhNDgiLCJuYW1lIjoiQU8yVGFhbGtMZWFkQVBJIiwiZXhwIjoyMDgyNzc0NDEzfQ.Mzq--wKhEjvegwmK9pFydl7SXclJOIODU0uEdEhMRyQ";
const campaignId = "677abb8027b78ac01f4c2908";
const dialPerHour = 500;

async function testCampaignUpdate() {
  console.log('🧪 Testing Taalk Campaign Dial Rate Update\n');
  console.log(`Campaign ID: ${campaignId}`);
  console.log(`Dial Per Hour: ${dialPerHour}\n`);

  try {
    // First, get current state
    console.log('📥 Step 1: Getting current campaign state...');
    const getUrl = `https://lets.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`;
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${campaignApiKey}`,
        'Accept': 'application/json'
      }
    });

    let currentLimit = null;
    if (getResponse.ok) {
      const currentData = await getResponse.json();
      currentLimit = currentData.payload?.limitPerHour;
      console.log(`   Current limitPerHour: ${currentLimit}\n`);
    }

    // Now try the update - try both endpoints and parameter names
    console.log('📤 Step 2: Updating campaign dial rate...');
    
    const attempts = [
      { url: `https://lets.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`, param: 'limitPerHour', value: dialPerHour, method: 'POST' },
      { url: `https://api.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`, param: 'limitPerHour', value: dialPerHour, method: 'POST' },
      { url: `https://lets.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`, param: 'limitPerHour', value: dialPerHour, method: 'PUT' },
      { url: `https://api.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`, param: 'limitPerHour', value: dialPerHour, method: 'PUT' }
    ];
    
    let putResponse = null;
    let putResponseText = '';
    
    for (const attempt of attempts) {
      console.log(`   Trying ${attempt.method}: ${attempt.url} with ${attempt.param}=${attempt.value}`);
      putResponse = await fetch(attempt.url, {
        method: attempt.method,
        headers: {
          'Authorization': `Bearer ${campaignApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ [attempt.param]: attempt.value })
      });
      
      putResponseText = await putResponse.text();
      console.log(`   Status: ${putResponse.status}, Content-Type: ${putResponse.headers.get('content-type')}`);
      
      // If we got JSON, break
      if (putResponse.ok && putResponse.headers.get('content-type')?.includes('application/json')) {
        break;
      }
    }

    if (!putResponse) {
      console.error('❌ All update attempts failed');
      return;
    }
    
    console.log(`   Response Status: ${putResponse.status} ${putResponse.statusText}`);
    console.log(`   Content-Type: ${putResponse.headers.get('content-type')}`);
    
    if (putResponse.ok) {
      try {
        const data = JSON.parse(putResponseText);
        const newLimit = data.payload?.limitPerHour;
        console.log(`\n📊 Response limitPerHour: ${newLimit} (was ${currentLimit}, requested ${dialPerHour})`);
        
        // Wait a moment then verify with GET
        console.log('   Waiting 2 seconds then verifying...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Double-check with GET
        const verifyResponse = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${campaignApiKey}`,
            'Accept': 'application/json'
          }
        });
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          const verifiedLimit = verifyData.payload?.limitPerHour;
          console.log(`   Verified limitPerHour: ${verifiedLimit}`);
          if (verifiedLimit === dialPerHour) {
            console.log('\n✅ SUCCESS! Update confirmed - limitPerHour matches requested value!');
            console.log(JSON.stringify(data, null, 2));
          } else {
            console.log(`\n⚠️ Update did not persist - still showing ${verifiedLimit}, expected ${dialPerHour}`);
            console.log('   Response data:', JSON.stringify(data.payload, null, 2));
          }
        }
      } catch (parseError) {
        console.log('\n⚠️ Response is HTML (not JSON), but status is 200');
        console.log('   Checking if update actually worked...\n');
        
        // Check again with GET to see if it updated
        const verifyResponse = await fetch(getUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${campaignApiKey}`,
            'Accept': 'application/json'
          }
        });
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          const newLimit = verifyData.payload?.limitPerHour;
          console.log(`   Verified limitPerHour after update: ${newLimit}`);
          if (newLimit === dialPerHour) {
            console.log('\n✅ Update was successful! (Even though response was HTML)');
          } else {
            console.log(`\n⚠️ Update may have failed - limit is still ${newLimit}, expected ${dialPerHour}`);
          }
        }
      }
    } else {
      console.error('\n❌ Error updating campaign:');
      console.error(`Status: ${putResponse.status}`);
      console.error(`Response: ${putResponseText.substring(0, 500)}`);
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
    console.error(error);
  }
}

testCampaignUpdate()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

