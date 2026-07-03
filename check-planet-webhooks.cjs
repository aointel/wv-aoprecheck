const { createClient } = require('@supabase/supabase-js');

// Use hardcoded config (same as server)
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastPlanetWebhooks() {
  try {
    console.log('🔍 Checking last 10 Planet ALTIG webhook sends...\n');
    
    // Query the hotlead_webhooks table for recent entries
    const { data: webhooks, error } = await supabase
      .from('hotlead_webhooks')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(10);
    
    let hasWebhooks = webhooks && webhooks.length > 0;
    
    if (error) {
      console.log(`⚠️  hotlead_webhooks table: ${error.message}\n`);
      hasWebhooks = false;
    }
    
    // Also check vdp_webhook_events for any Planet webhook entries
    const { data: vdpEvents } = await supabase
      .from('vdp_webhook_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(result => {
        if (result.error) {
          console.log(`⚠️  vdp_webhook_events table: ${result.error.message}\n`);
          return { data: null };
        }
        return result;
      });
    
    // Check masterlead table for recent "booked" resolutions that would trigger webhooks
    const { data: bookedLeads, error: bookedError } = await supabase
      .from('masterlead')
      .select('id, taalk_lead_id, cn_email, cnresolution, last_contacted, created_at, first_name, last_name, phone')
      .eq('cnresolution', 'booked')
      .order('last_contacted', { ascending: false })
      .limit(10);
    
    if (bookedError) {
      console.log(`⚠️  masterlead table: ${bookedError.message}\n`);
    }
    
    // Check for recent booked/Met dispositions that would trigger webhooks
    const { data: bookedCalls } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .order('call_started_at', { ascending: false })
      .limit(20)
      .then(result => {
        if (result.error) {
          // Table might not exist, that's okay
          return { data: null };
        }
        return result;
      });
    
    // Display results
    if (hasWebhooks) {
      console.log(`📋 Found ${webhooks.length} webhooks in hotlead_webhooks table:\n`);
      console.log('='.repeat(60));
      
      webhooks.forEach((webhook, index) => {
        console.log(`\n${index + 1}. ⏰ Sent at: ${webhook.sent_at || webhook.created_at || 'N/A'}`);
        console.log(`   👤 Agent: ${webhook.agent_email || 'N/A'}`);
        console.log(`   📞 Call SID: ${webhook.call_sid || 'N/A'}`);
        console.log(`   🆔 Lead ID: ${webhook.hotlead_id || webhook.lead_id || 'N/A'}`);
        console.log(`   ✅ Status: ${webhook.webhook_status || 'N/A'}`);
        
        if (webhook.webhook_payload) {
          const payload = typeof webhook.webhook_payload === 'string' 
            ? JSON.parse(webhook.webhook_payload) 
            : webhook.webhook_payload;
          console.log(`   📦 Payload:`);
          console.log(`      - lead_id: ${payload.lead_id || 'N/A'}`);
          console.log(`      - associate_id: ${payload.associate_id || 'N/A'}`);
        }
        
        if (webhook.webhook_response) {
          const response = typeof webhook.webhook_response === 'string' 
            ? (webhook.webhook_response.length > 100 
                ? webhook.webhook_response.substring(0, 100) + '...' 
                : webhook.webhook_response)
            : JSON.stringify(webhook.webhook_response);
          console.log(`   📥 Response: ${response}`);
        }
      });
      
      console.log('\n' + '='.repeat(60) + '\n');
    } else {
      console.log('⚠️  No webhooks found in hotlead_webhooks table');
      console.log('💡 Note: Webhooks may be sent but not logged to this table yet.\n');
    }
    
    // Show recent booked leads that would have triggered webhooks
    if (bookedLeads && bookedLeads.length > 0) {
      console.log(`\n📋 Recent "booked" leads (would trigger Planet webhooks):\n`);
      bookedLeads.slice(0, 10).forEach((lead, index) => {
        console.log(`${index + 1}. ⏰ Booked at: ${lead.last_contacted || lead.created_at || 'N/A'}`);
        console.log(`   👤 Agent: ${lead.cn_email || 'N/A'}`);
        console.log(`   🆔 Lead ID: ${lead.taalk_lead_id || lead.id || 'N/A'}`);
        const leadName = lead.first_name || lead.last_name ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : 'N/A';
        console.log(`   📞 Lead: ${leadName} (${lead.phone || 'N/A'})`);
        console.log(`   ✅ Resolution: ${lead.cnresolution || 'N/A'}`);
        console.log('');
      });
      console.log('='.repeat(60) + '\n');
    }
    
    // Show additional context - recent activity that might have triggered webhooks
    if (vdpEvents && vdpEvents.length > 0) {
      console.log(`📋 Found ${vdpEvents.length} recent VDP webhook events:\n`);
      vdpEvents.slice(0, 5).forEach((event, index) => {
        console.log(`${index + 1}. Event: ${event.event_type || 'N/A'} - ${event.created_at || 'N/A'}`);
        if (event.lead_id) console.log(`   Lead ID: ${event.lead_id}`);
        if (event.agent_id) console.log(`   Agent: ${event.agent_id}`);
      });
      console.log('');
    }
    
    // Show summary
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   • Webhooks logged in hotlead_webhooks: ${webhooks?.length || 0}`);
    console.log(`   • Recent "booked" leads found: ${bookedLeads?.length || 0}`);
    console.log(`   • VDP webhook events: ${vdpEvents?.length || 0}`);
    console.log(`   • Recent calls checked: ${bookedCalls?.length || 0}`);
    console.log('\n💡 Tip: Webhooks are sent when leads are marked as "booked" (cnresolution=booked) or when calls exceed 60 seconds.');
    if ((bookedLeads?.length || 0) > 0 && (webhooks?.length || 0) === 0) {
      console.log('⚠️  Note: Found booked leads but no webhooks logged. Webhooks may still have been sent but not logged.');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLastPlanetWebhooks();

