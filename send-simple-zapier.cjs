require('dotenv').config();
const fetch = require('node-fetch');

async function sendSimpleToZapier() {
  try {
    console.log('📤 SENDING SIMPLE PAYLOAD TO ZAPIER\n');

    const payload = {
      lead_id: "18542072",
      associate_id: "409"
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('');

    const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${response.status}`);
    const responseText = await response.text();
    console.log('Response:', responseText);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendSimpleToZapier();
