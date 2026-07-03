require('dotenv').config();
const fetch = require('node-fetch');

async function sendLeadToKristina() {
  try {
    const payload = {
      lead_id: "17699999",
      associate_id: "197468" // Kristina Pleshakova
    };
    
    console.log('📤 Sending Bryan Watts (Lead 17699999) to Kristina Pleshakova...');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('');
    
    const response = await fetch('https://webhook.planetaltig.com/v1/lead/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Status: ${response.status}`);
    const responseText = await response.text();
    console.log('Response:', responseText);
    
    if (response.ok) {
      console.log('\n✅ SUCCESS: Bryan Watts assigned to Kristina Pleshakova (197468)!');
    } else {
      console.log('\n❌ FAILED');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendLeadToKristina();

