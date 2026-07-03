/**
 * Test the 60-second hotlead webhook
 */

const fetch = require('node-fetch');

async function testWebhook() {
  console.log('\n🧪 TESTING 60-SECOND WEBHOOK');
  console.log('═'.repeat(70));
  
  const testPayload = {
    lead_id: "TEST-12345",
    associate_id: "409"
  };
  
  console.log('📤 Sending test payload:', testPayload);
  console.log('🎯 Target: https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/');
  console.log('');
  
  try {
    const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log('📥 Response Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ TEST SUCCESSFUL - Webhook received!');
      console.log('═'.repeat(70) + '\n');
    } else {
      console.log('\n❌ TEST FAILED - Check response above');
      console.log('═'.repeat(70) + '\n');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('═'.repeat(70) + '\n');
  }
}

testWebhook();

