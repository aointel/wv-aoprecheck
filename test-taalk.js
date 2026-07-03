// Test without campaign

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

const noCampaignRequest = {
  name: "Test Client",
  phone: "5032018470",
  agent: "68a5ff0fc8f1520e59acf3e6"
};

console.log('🧪 Testing without campaign field');
console.log('📤 Request:', JSON.stringify(noCampaignRequest, null, 2));

fetch('https://api.taalk.ai/api/call?db=michaelmandella', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${taalkApiKey}`
  },
  body: JSON.stringify(noCampaignRequest)
})
.then(async (response) => {
  const text = await response.text();
  console.log(`📥 Status: ${response.status}`);
  console.log(`📥 Response:`, text);
  
  if (response.ok) {
    console.log('✅ SUCCESS');
  } else {
    console.log('❌ FAILED');
  }
})
.catch((error) => {
  console.error('❌ Error:', error.message);
});
