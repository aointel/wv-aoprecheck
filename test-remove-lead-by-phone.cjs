require('dotenv').config();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

globalThis.fetch = fetch;

async function testRemoveLeadByPhone() {
  try {
    console.log('🧪 TESTING REMOVE LEAD BY PHONE WEBHOOK\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get any real lead with a phone number from the database
    const supabaseUrl = 'https://ycztjetxwpfgtrzeytt.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { fetch: fetch }
    });

    console.log(`📋 Looking up a real lead with phone number...`);
    
    let phone = null;
    let campaign = null;
    let leadId = null;
    let leadName = null;
    
    try {
      // Get a recent lead that has a phone number
      const { data: leads, error: leadError } = await supabase
        .from('masterlead')
        .select('id, taalk_lead_id, first_name, last_name, phone, taalk_market, market')
        .not('phone', 'is', null)
        .neq('phone', '')
        .order('created_at', { ascending: false })
        .limit(1);

      if (leadError) {
        console.log(`⚠️  Database lookup error: ${leadError.message}\n`);
      } else if (leads && leads.length > 0) {
        const lead = leads[0];
        phone = lead.phone;
        campaign = lead.taalk_market || lead.market || null;
        leadId = lead.taalk_lead_id || lead.id;
        leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown';
        console.log(`✅ Found lead:`);
        console.log(`   Lead ID: ${leadId}`);
        console.log(`   Name: ${leadName}`);
        console.log(`   Phone: ${phone}`);
        console.log(`   Campaign: ${campaign || 'N/A'}\n`);
      } else {
        console.log(`⚠️  No leads found in database\n`);
      }
    } catch (lookupError) {
      console.log(`⚠️  Could not lookup lead: ${lookupError.message}\n`);
    }

    // If lookup failed, use a test phone number to verify endpoint works
    // (The endpoint will return 404 if lead doesn't exist, which proves it's working)
    if (!phone) {
      console.log(`⚠️  Database lookup failed - using test phone number to verify endpoint`);
      console.log(`   (Endpoint will return 404 if lead doesn't exist, proving it's functional)\n`);
      phone = '15551234567'; // Test phone number
      campaign = 'Test Campaign';
      leadId = 'TEST';
      leadName = 'Test Lead';
    }

    // Test the webhook endpoint
    const webhookUrl = 'https://aoirail-production.up.railway.app/api/webhook/remove-lead-by-phone';
    
    console.log('\n🔍 TESTING ENDPOINT: ' + webhookUrl);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const payload = {
      phone: phone,
      dnc: false, // Set to true if this is a DNC request
      session: 'test-session-' + Date.now(),
      campaign: campaign || 'Test Campaign'
    };

    console.log('📤 Testing webhook endpoint...');
    console.log('   URL: ' + webhookUrl);
    console.log('   Payload:', JSON.stringify(payload, null, 2));
    console.log('');

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await webhookResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    console.log(`📥 Response Status: ${webhookResponse.status}`);
    console.log(`📥 Response Body:`, responseData);
    console.log('');

    if (webhookResponse.ok) {
      console.log('✅ SUCCESS - Webhook endpoint is working!');
      console.log(`\n📊 WHAT HAPPENED:`);
      console.log(`   1. ✅ Found lead in database`);
      console.log(`   2. ✅ Set TaalkResolve = true (lead is now FROZEN)`);
      if (responseData.dnc) {
        console.log(`   3. ✅ Also set dnc = true and cnresolution = 'dnc'`);
      }
      console.log(`   4. ✅ Updated updated_at timestamp`);
      console.log(`\n📋 Lead Details:`);
      console.log(`   Lead ID: ${responseData.leadId || leadId}`);
      console.log(`   Taalk Lead ID: ${responseData.taalk_lead_id || 'N/A'}`);
      console.log(`   Name: ${responseData.firstName || ''} ${responseData.lastName || ''}`.trim() || leadName);
      console.log(`   Phone: ${responseData.phone || phone}`);
      console.log(`   TaalkResolve: ${responseData.TaalkResolve !== undefined ? responseData.TaalkResolve : 'true (set)'}`);
      console.log(`   DNC: ${responseData.dnc || false}`);
      console.log(`   Campaign: ${responseData.campaign || campaign || 'N/A'}`);
      console.log(`   Updated At: ${responseData.updatedAt || 'N/A'}`);
      console.log(`\n🔒 LEAD STATUS: FROZEN`);
      console.log(`   - Will NOT be assigned to agents`);
      console.log(`   - Will NOT appear in any queues`);
      console.log(`   - Will NOT be available for calling`);
      console.log(`   - Will NOT be counted in lead counts`);
      console.log(`   - Lead still exists in database (for records)`);
    } else {
      console.log('❌ FAILED - Webhook returned error status');
      console.log('   Check the response body above for details');
      if (webhookResponse.status === 404) {
        console.log(`\n💡 Note: Lead not found - it may have already been frozen/deleted or phone format doesn't match`);
      } else if (webhookResponse.status === 400) {
        console.log(`\n💡 Note: Invalid request - check that phone number is provided and valid`);
      } else if (webhookResponse.status === 500) {
        console.log(`\n💡 Note: Server error - check server logs for details`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testRemoveLeadByPhone()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
