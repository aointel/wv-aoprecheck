/**
 * Test script for missed call billing webhook
 * 
 * Tests the /api/taalk/incoming-call endpoint with a MISSED event
 * 
 * Run with: tsx server/test-missed-call-webhook.ts
 */

const webhookPayload = {
  Event: 'MISSED',
  blastered: 1,
  216305: 216305, // Agent ID as numeric field
  task: {
    Phone: '8137707009',
    'Server Number': '+17046868739',
    params: {},
    'Task Created At': '2025-12-18T22:48:44.504Z',
    waitingDuration: 40790,
    querystring: {}
  }
};

async function testMissedCallWebhook() {
  console.log('\n🧪 TESTING MISSED CALL BILLING WEBHOOK\n');
  console.log('='.repeat(80));
  console.log('\n📋 Webhook Payload:');
  console.log(JSON.stringify(webhookPayload, null, 2));
  console.log('\n' + '='.repeat(80));
  
  try {
    const baseUrl = 'https://aoirail-production.up.railway.app';
    const webhookUrl = `${baseUrl}/api/taalk/incoming-call`;
    
    console.log(`\n📡 Sending webhook to: ${webhookUrl}\n`);
    console.log(`   (If localhost fails, the server may not be running. Try production URL.)\n`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);
    console.log(`\n📦 Response Body:`);
    console.log(JSON.stringify(responseData, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Webhook processed successfully!');
      console.log('\n💡 Check the following:');
      console.log('   1. Billing transaction created in billing_transactions table');
      console.log('   2. Agent notification created in notifications table');
      console.log('   3. External webhook sent to /api/ccpro/missed-call-billing');
      console.log('   4. Waiting duration should be 40s (40790ms)');
    } else {
      console.log('\n❌ Webhook failed!');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error sending webhook:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    console.log('\n' + '='.repeat(80) + '\n');
    process.exit(1);
  }
}

// Run the test
testMissedCallWebhook()
  .then(() => {
    console.log('✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });








