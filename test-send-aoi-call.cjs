// Test script to send a test AOIntel call to cnsysop@aoglobelife.com
const fetch = require('node-fetch');

// Use local server
const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const TARGET_EMAIL = 'cnsysop@aoglobelife.com';

async function sendTestAOICall() {
  console.log('🧪 Sending test AOIntel call to', TARGET_EMAIL, '...\n');

  try {
    // Step 1: Look up associate_id for cnsysop
    console.log('📋 Step 1: Looking up associate_id for', TARGET_EMAIL, '...');
    
    // Try to get associate_id from user_credits endpoint
    let associateId = null;
    try {
      // Try the credits endpoint which should return associate_id
      const creditsResponse = await fetch(`${API_BASE}/api/credits?email=${encodeURIComponent(TARGET_EMAIL)}`);
      if (creditsResponse.ok) {
        const creditsData = await creditsResponse.json();
        associateId = creditsData.associate_id || creditsData.associateId;
        if (associateId) {
          console.log(`✅ Found associate_id from credits endpoint: ${associateId}`);
        }
      }
    } catch (error) {
      console.log('⚠️  Credits endpoint lookup failed:', error.message);
    }

    // If still no associate_id, try a known test value or use a default
    if (!associateId) {
      // For cnsysop, try common test IDs or use a placeholder
      // The backend will look up the email from associate_id in user_credits table
      console.log('⚠️  Could not lookup associate_id, using test ID 1 (backend will map to email)');
      associateId = '1'; // Common test ID, backend should handle email lookup
    }

    // Step 2: Create test AOIntel PICK_UP webhook payload
    const testLeadId = `TEST-AOI-${Date.now()}`;
    const testPhone = '5551234567';
    
    const webhookPayload = {
      event: 'PICK_UP',
      agent: associateId, // Associate ID (backend will look up email from user_credits)
      task: {
        phone: testPhone,
        params: {
          Leadid: testLeadId,
          LeadId: testLeadId
        }
      },
      // AOIntel specific fields - these are what the backend looks for
      firstName: 'Test',
      lastName: 'AOIntel',
      firstname: 'Test',
      lastname: 'AOIntel',
      phone: testPhone,
      phoneNumber: testPhone,
      state: 'CA',
      market: 'Veteran Market', // Must contain "veteran" or "globe market" to be processed
      leadId: testLeadId,
      LeadId: testLeadId,
      // Additional VDP fields that might help with routing
      associate_id: associateId,
      company_email: TARGET_EMAIL, // Include email directly in case associate_id lookup fails
      // Agent params structure (VDP format)
      agent: {
        id: associateId,
        params: {
          Leadid: testLeadId,
          LeadId: testLeadId,
          company_email: TARGET_EMAIL
        }
      }
    };

    console.log('\n📋 Step 2: Sending PICK_UP webhook...');
    console.log('Payload:', JSON.stringify(webhookPayload, null, 2));

    // Step 3: Send webhook to VDP events endpoint
    const webhookResponse = await fetch(`${API_BASE}/api/webhook/vdp-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log(`\n📡 Response status: ${webhookResponse.status} ${webhookResponse.statusText}`);
    
    let responseBody;
    try {
      responseBody = await webhookResponse.json();
      console.log('📄 Response body:', JSON.stringify(responseBody, null, 2));
    } catch (parseError) {
      const textBody = await webhookResponse.text();
      console.log('📄 Response body (text):', textBody.substring(0, 500));
      responseBody = { error: 'Failed to parse JSON response', text: textBody.substring(0, 200) };
    }

    if (webhookResponse.ok) {
      console.log('\n✅ SUCCESS! Test AOIntel call sent!');
      
      // Step 3: Verify the lead was created in masterlead
      console.log('\n📋 Step 3: Verifying lead was created...');
      try {
        const verifyResponse = await fetch(`${API_BASE}/api/debug/masterlead?leadId=${testLeadId}&email=${encodeURIComponent(TARGET_EMAIL)}`);
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          console.log('✅ Lead verification:', JSON.stringify(verifyData, null, 2));
          if (verifyData.lead) {
            console.log(`\n✅ Lead found in masterlead:`);
            console.log(`   - ID: ${verifyData.lead.id}`);
            console.log(`   - Name: ${verifyData.lead.first_name} ${verifyData.lead.last_name}`);
            console.log(`   - Phone: ${verifyData.lead.phone}`);
            console.log(`   - cn_email: ${verifyData.lead.cn_email}`);
            console.log(`   - cnresolution: ${verifyData.lead.cnresolution}`);
            if (verifyData.lead.cn_email?.toLowerCase() === TARGET_EMAIL.toLowerCase()) {
              console.log(`\n✅ Lead has correct cn_email! It should appear in Call Connector Pro.`);
              console.log(`\n💡 If it doesn't show up, try:`);
              console.log(`   1. Refresh the page`);
              console.log(`   2. Click "Load Queue" or refresh leads`);
              console.log(`   3. Check both Hot Leads and Plus Leads tabs`);
            } else {
              console.log(`\n⚠️  Lead has wrong cn_email: ${verifyData.lead.cn_email} (expected: ${TARGET_EMAIL})`);
            }
          } else {
            console.log('⚠️  Lead not found in masterlead');
          }
        } else {
          console.log('⚠️  Could not verify lead (endpoint might not exist)');
        }
      } catch (verifyError) {
        console.log('⚠️  Verification error:', verifyError.message);
      }
      
      console.log(`\n📞 Expected behavior:`);
      console.log(`   1. Agent ${TARGET_EMAIL} should be marked as 'in_call'`);
      console.log(`   2. Outbound dialer should pause automatically`);
      console.log(`   3. Lead should appear in Call Connector Pro with cnresolution='AOIntel'`);
      console.log(`   4. Live call board should show the incoming call`);
      console.log(`\n🔍 Check:`);
      console.log(`   - /connect page should show the call`);
      console.log(`   - Outbound dialer should be paused`);
      console.log(`   - Agent status should be 'in_call'`);
      console.log(`   - Refresh Call Connector Pro to see the lead`);
    } else {
      console.error('\n❌ FAILED to send test AOIntel call');
      console.error('   Error:', responseBody.error || 'Unknown error');
      console.error('   Details:', responseBody.details || 'No details');
      if (responseBody.stack) {
        console.error('\n   Stack trace:');
        console.error('   ' + responseBody.stack.split('\n').join('\n   '));
      }
    }

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
sendTestAOICall();

