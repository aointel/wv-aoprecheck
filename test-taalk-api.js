import fetch from 'node-fetch';

// Test script to verify Taalk API with working payload structure
async function testTaalkAPI() {
  const payload = {
    name: "John Smith",
    phone: "5032018470", // Phone without + prefix (per API docs)
    agent: "68a5ff0fc8f1520e59acf3e6", // agent (not agentId per docs)
    campaign: "6747819a86c131c2cb203719", // campaign (not campaignId per docs)
    retryMethod: 0 // Required per API docs
  };

  console.log('Testing Taalk API with payload:');
  console.log(JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch('https://lets.taalk.ai/api/call?db=michaelmandella', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'curl/8.0',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4'
      },
      body: JSON.stringify(payload)
    });

    console.log('\nResponse Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('\nResponse Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ SUCCESS: Taalk API call worked!');
    } else {
      console.log('\n❌ FAILED: Taalk API call failed');
    }
    
  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
  }
}

// Run the test
testTaalkAPI();