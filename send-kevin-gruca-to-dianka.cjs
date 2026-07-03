require('dotenv').config();
const fetch = require('node-fetch');

async function sendLeadToDianka() {
  try {
    const payload = {
      lead_id: "17697008",
      associate_id: "63603" // Dianka Blash
    };
    
    console.log('📤 Sending Kevin Gruca (Lead 17697008) to Dianka Blash...');
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
      console.log('\n✅ SUCCESS: Kevin Gruca assigned to Dianka Blash (63603)!');
    } else {
      console.log('\n❌ FAILED');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendLeadToDianka();

