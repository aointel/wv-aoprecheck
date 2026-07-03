/**
 * Test the new Zapier webhook
 */

global.fetch = require('node-fetch');

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

// Test with the lead from the CSV (line 41)
const testPayload = {
  lead_id: "18601489",
  associate_id: "155251"
};

async function testWebhook() {
  console.log('\n🧪 TESTING NEW ZAPIER WEBHOOK\n');
  console.log('='.repeat(60));
  console.log('Webhook URL:', WEBHOOK_URL);
  console.log('\nPayload:', JSON.stringify(testPayload, null, 2));
  console.log('='.repeat(60) + '\n');

  try {
    const startTime = Date.now();
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();

    console.log('📥 RESPONSE:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Time: ${responseTime}ms`);
    console.log(`   Body: ${responseText}\n`);

    if (response.ok) {
      console.log('✅ SUCCESS - Webhook sent successfully!\n');
    } else {
      console.log('❌ FAILED - Webhook returned error\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }
}

testWebhook()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

