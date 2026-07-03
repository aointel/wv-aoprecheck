require('dotenv').config();
const fetch = require('node-fetch');

async function testWebhook() {
  console.log('🧪 Testing webhook payload format...\n');

  // Test payload 1 - current format
  const payload1 = {
    lead_id: "17197411",
    associate_id: "130786"
  };

  console.log('📤 Test Payload 1 (current format):');
  console.log(JSON.stringify(payload1, null, 2));
  console.log('');

  try {
    const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(payload1)
    });

    const responseText = await response.text();
    console.log(`Response Status: ${response.status}`);
    console.log(`Response Body: ${responseText}\n`);

    // Test payload 2 - alternative format
    const payload2 = {
      taalk_lead_id: "17197411",
      associate_id: "130786"
    };

    console.log('📤 Test Payload 2 (taalk_lead_id):');
    console.log(JSON.stringify(payload2, null, 2));
    console.log('');

    const response2 = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(payload2)
    });

    const responseText2 = await response2.text();
    console.log(`Response Status: ${response2.status}`);
    console.log(`Response Body: ${responseText2}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWebhook();

