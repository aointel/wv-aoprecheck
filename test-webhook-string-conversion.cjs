require('dotenv').config();
const fetch = require('node-fetch');

async function testStringConversion() {
  console.log('🧪 Testing webhook with string conversion...\n');

  // Test with associate_id as NUMBER
  const payloadNumber = {
    lead_id: "18542072",
    associate_id: 409
  };

  console.log('📤 Payload with NUMBER associate_id:');
  console.log(JSON.stringify(payloadNumber, null, 2));
  
  const response1 = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
    },
    body: JSON.stringify(payloadNumber)
  });

  console.log(`Response: ${response1.status} - ${await response1.text()}\n\n`);

  // Test with associate_id as STRING
  const payloadString = {
    lead_id: "18542072",
    associate_id: "409"
  };

  console.log('📤 Payload with STRING associate_id:');
  console.log(JSON.stringify(payloadString, null, 2));
  
  const response2 = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
    },
    body: JSON.stringify(payloadString)
  });

  console.log(`Response: ${response2.status} - ${await response2.text()}\n`);
}

testStringConversion();

