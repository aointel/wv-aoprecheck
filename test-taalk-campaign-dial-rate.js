/**
 * Test Taalk Campaign Dial Rate Update
 */

// Our existing API key (for transcripts/summaries)
const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

// API key from curl example (AO2TaalkLeadAPI - has campaign permissions)
const campaignApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay5hZWQ1MDJlMi0wY2YxLTQ3NGQtYjQ2My0wNzczYzJiNWRhNDgiLCJuYW1lIjoiQU8yVGFhbGtMZWFkQVBJIiwiZXhwIjoyMDgyNzc0NDEzfQ.Mzq--wKhEjvegwmK9pFydl7SXclJOIODU0uEdEhMRyQ";

const campaignId = "677abb8027b78ac01f4c2908";
const limitPerHour = 500;

async function testCampaignUpdate() {
  console.log('🧪 Testing Taalk Campaign Dial Rate Update\n');
  console.log(`Campaign ID: ${campaignId}`);
  console.log(`Limit Per Hour: ${limitPerHour}\n`);

  // Try the exact endpoint from curl example first
  const endpoints = [
    { url: `https://lets.taalk.ai/api/campaign2s/${campaignId}?db=michaelmandella`, param: 'dialPerHour', key: campaignApiKey, keyName: 'AO2TaalkLeadAPI' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📤 Testing: ${endpoint.url}`);
      console.log(`🔑 Using API key: ${endpoint.keyName}`);
      console.log(`📦 Payload: {"${endpoint.param}": ${limitPerHour}}\n`);

      const response = await fetch(endpoint.url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${endpoint.key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json' // Explicitly request JSON
        },
        body: JSON.stringify({ [endpoint.param]: limitPerHour }),
        redirect: 'follow' // Follow redirects
      });

      console.log(`📥 Response Status: ${response.status} ${response.statusText}`);

      const responseText = await response.text();
      console.log(`📄 Response Body (first 500 chars): ${responseText.substring(0, 500)}`);

      if (response.ok) {
        // Try to parse as JSON
        try {
          const data = JSON.parse(responseText);
          console.log('\n✅ SUCCESS! Campaign updated:');
          console.log(JSON.stringify(data, null, 2));
          return; // Success, exit
        } catch (parseError) {
          // Response is not JSON (might be HTML or plain text)
          if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            console.log('\n⚠️ Response is HTML (not JSON) - trying next endpoint...');
          } else {
            console.log('\n✅ Success! (Response is not JSON, but status is 200)');
            console.log(`   Response: ${responseText.substring(0, 200)}`);
            return; // Success, exit
          }
        }
      } else {
        console.error(`\n❌ Error (${response.status}): ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      console.error(`❌ Exception: ${error.message}`);
    }
  }
  
  console.log('\n⚠️ All endpoints failed - campaign update may require different API key or endpoint');
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

