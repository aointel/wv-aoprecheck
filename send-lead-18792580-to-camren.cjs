require('dotenv').config();
const fetch = require('node-fetch');

globalThis.fetch = fetch;

async function sendLeadToCamren() {
  try {
    console.log('🚀 SENDING LEAD 18792580 TO CAMREN MOORE\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const leadId = '18792580';
    const agentEmail = 'camrenmoore@aoglobelife.com';
    
    // Associate ID from CSV: 226424 (from Producer List 1.2.26.csv)
    // If this is wrong, update it in the script
    let associateId = '226424';
    
    try {
      const supabaseUrl = 'https://ycztjetxwpfgtrzeytt.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

      console.log(`👤 Looking up associate_id for ${agentEmail}...`);
      const customerResponse = await fetch(
        `${supabaseUrl}/rest/v1/customers?select=associate_id&or=(company_email.eq.${encodeURIComponent(agentEmail)},personal_email.eq.${encodeURIComponent(agentEmail)})&limit=1`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (customerResponse.ok) {
        const customers = await customerResponse.json();
        if (customers && customers.length > 0 && customers[0].associate_id) {
          associateId = customers[0].associate_id.toString();
          console.log(`✅ Found associate_id: ${associateId}\n`);
        }
      }
    } catch (lookupError) {
      console.log(`⚠️  Could not lookup associate_id (network issue): ${lookupError.message}`);
      console.log(`   You may need to provide the associate_id manually\n`);
    }

    if (!associateId) {
      console.error(`❌ No associate_id found for ${agentEmail}`);
      console.log('   Please provide the associate_id or check network connection');
      console.log('   You can find it in the customers table in Supabase');
      return;
    }

    // Send webhook to Zapier/Planet ALTIG
    const webhookPayload = {
      lead_id: leadId,
      associate_id: associateId
    };

    console.log('📤 Sending webhook to Planet ALTIG...');
    console.log('   URL: https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/');
    console.log('   Payload:', JSON.stringify(webhookPayload, null, 2));
    console.log('');

    const webhookResponse = await fetch('https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    const responseText = await webhookResponse.text();
    console.log(`📥 Response Status: ${webhookResponse.status}`);
    console.log(`📥 Response Body: ${responseText}\n`);

    if (webhookResponse.ok) {
      console.log('✅ SUCCESS - Lead sent to Planet ALTIG!');
      console.log(`\n📊 Summary:`);
      console.log(`   Lead ID: ${leadId}`);
      console.log(`   Assigned To: ${agentEmail}`);
      console.log(`   Associate ID: ${associateId}`);
      console.log(`   Webhook: ✅ Sent`);
    } else {
      console.log('❌ FAILED - Webhook returned error status');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

sendLeadToCamren()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
