/**
 * Test Taalk Campaign GET to see current status
 */

const campaignApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay5hZWQ1MDJlMi0wY2YxLTQ3NGQtYjQ2My0wNzczYzJiNWRhNDgiLCJuYW1lIjoiQU8yVGFhbGtMZWFkQVBJIiwiZXhwIjoyMDgyNzc0NDEzfQ.Mzq--wKhEjvegwmK9pFydl7SXclJOIODU0uEdEhMRyQ";
const campaignId = "677abb8027b78ac01f4c2908";

async function testCampaignGet() {
  console.log('🧪 Testing Taalk Campaign GET\n');
  console.log(`Campaign ID: ${campaignId}\n`);

  try {
    const url = `https://lets.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`;
    
    console.log(`📤 Sending GET request to: ${url}\n`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${campaignApiKey}`,
        'Accept': 'application/json'
      }
    });

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Content-Type: ${response.headers.get('content-type')}\n`);

    const responseText = await response.text();
    
    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Success! Campaign data:');
        console.log(JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.log('⚠️ Response is not JSON:');
        console.log(responseText.substring(0, 500));
      }
    } else {
      console.error('❌ Error:', responseText.substring(0, 500));
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

testCampaignGet()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

