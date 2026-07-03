// Test CSV webhook with exact data format provided by user
const testData = {
  "First Name": "Katherine-elizabeth",
  "Last Name": "Ferguson",
  "Referrer": "Earth",
  "Phone": "4092296117",
  "Email": "salemrose1988@gmail.com",
  "Address 1": "2414 Pecos",
  "City": "La Marque",
  "State": "TX",
  "Postal Code": "77568",
  "Language": "1",
  "Cost": "6.0",
  "Gender": "Female",
  "querystring": ""
};

async function testWebhook() {
  try {
    const response = await fetch('https://aointelligence.replit.app/api/webhook/csv-leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log('✅ Webhook Response:', result);
    
    if (result.success) {
      console.log(`✅ Lead created successfully:
        - Name: ${result.leadDetails.name}
        - Phone: ${result.leadDetails.phone}
        - Location: ${result.leadDetails.location}
        - Cost: $${result.leadDetails.cost}
        - Referrer: ${result.leadDetails.referrer}
        - Lead ID: ${result.leadId}`);
    }

    // Test getting the leads
    const getResponse = await fetch('https://aointelligence.replit.app/api/leads/incoming');
    const getResult = await getResponse.json();
    console.log(`\n📋 Total leads in database: ${getResult.totalLeads}`);
    
    if (getResult.leads && getResult.leads.length > 0) {
      console.log('Latest lead:', getResult.leads[getResult.leads.length - 1]);
    }

  } catch (error) {
    console.error('❌ Webhook test failed:', error);
  }
}

testWebhook();