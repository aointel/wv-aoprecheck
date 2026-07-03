/**
 * Resend a single lead to Planet ALTIG webhook and get full API response
 */

global.fetch = require('node-fetch');

const WEBHOOK_URL = 'https://webhook.planetaltig.com/v1/lead/assign';
const WEBHOOK_API_KEY = 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23';

// Lead details from line 40
const leadId = '18601489';
const associateId = '155251';
const agentEmail = 'ankitadas@aoglobelife.com';
const leadName = 'PATRICK KASPER';

async function resendLeadToPlanet() {
  console.log('\n🚀 RESENDING LEAD TO PLANET ALTIG\n');
  console.log('='.repeat(60));
  console.log(`Lead ID: ${leadId}`);
  console.log(`Associate ID: ${associateId}`);
  console.log(`Agent: ${agentEmail}`);
  console.log(`Lead Name: ${leadName}`);
  console.log('='.repeat(60) + '\n');

  const webhookPayload = {
    lead_id: leadId,
    associate_id: associateId
  };

  console.log('📤 Payload being sent:');
  console.log(JSON.stringify(webhookPayload, null, 2));
  console.log('\n');

  try {
    console.log('⏳ Sending webhook request...\n');

    const startTime = Date.now();
    
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': WEBHOOK_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'AOI-Webhook-Sender/1.0'
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseTime = Date.now() - startTime;
    const responseText = await webhookResponse.text();

    console.log('📥 FULL API RESPONSE:\n');
    console.log('='.repeat(60));
    console.log(`HTTP Status: ${webhookResponse.status} ${webhookResponse.statusText}`);
    console.log(`Response Time: ${responseTime}ms\n`);

    console.log('Response Headers:');
    console.log('-'.repeat(60));
    webhookResponse.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('-'.repeat(60) + '\n');

    console.log('Response Body (Raw):');
    console.log('-'.repeat(60));
    console.log(responseText);
    console.log('-'.repeat(60) + '\n');

    // Try to parse as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('Response Body (Parsed JSON):');
      console.log('-'.repeat(60));
      console.log(JSON.stringify(responseData, null, 2));
      console.log('-'.repeat(60) + '\n');
    } catch (e) {
      console.log('⚠️  Response is not valid JSON\n');
    }

    console.log('='.repeat(60));
    
    if (webhookResponse.ok) {
      console.log('\n✅ SUCCESS - Webhook sent successfully!');
    } else {
      console.log('\n❌ FAILED - Webhook returned an error status');
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Status: ${webhookResponse.ok ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`   HTTP Code: ${webhookResponse.status}`);
    console.log(`   Response Time: ${responseTime}ms`);
    console.log(`   Response Size: ${responseText.length} bytes`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ ERROR SENDING WEBHOOK:\n');
    console.error('='.repeat(60));
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('='.repeat(60));
    console.log('\n');
  }
}

resendLeadToPlanet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

