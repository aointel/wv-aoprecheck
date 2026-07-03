require('dotenv').config();
const fetch = require('node-fetch');

async function testSingle() {
  console.log('🧪 Testing single lead to Planet ALTIG...\n');

  const payload = [
    {
      "lead_id": "18542072",
      "associate_id": "409"
    }
  ];

  console.log('📤 Sending:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await fetch('https://webhook.planetaltig.com/v1/lead/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    console.log(`📥 Response Status: ${response.status}`);
    console.log(`📥 Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`📥 Response Body:\n${responseText}\n`);

    if (response.ok) {
      console.log('✅ SUCCESS');
    } else {
      console.log('❌ FAILED');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSingle();

