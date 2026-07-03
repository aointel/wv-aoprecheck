require('dotenv').config();
const fetch = require('node-fetch');

async function sendToZapier() {
  try {
    console.log('🚀 SENDING ONE BOOKED LEAD TO ZAPIER\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const payload = {
      lead_id: "18542072",
      associate_id: "409"
    };

    console.log('📤 Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');

    console.log('🌐 URL: https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/');
    console.log('🔑 Headers: Content-Type: application/json, x-api-key: gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23\n');

    const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    console.log(`📥 Response Status: ${response.status}`);
    console.log(`📥 Response Body:\n${responseText}\n`);

    if (response.ok) {
      console.log('✅ SUCCESS - Lead sent to Zapier!');
      console.log('\nPayload sent:');
      console.log(`   Lead ID: ${payload.lead_id}`);
      console.log(`   Associate ID: ${payload.associate_id}`);
    } else {
      console.log('❌ FAILED');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendToZapier();

