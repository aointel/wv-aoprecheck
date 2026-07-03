/**
 * Send booked and appointment_set leads for brittanyvinje@aoglobelife.com to Zapier webhook
 * Uses taalk_lead_id for Planet integration
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const AGENT_EMAIL = 'brittanyvinje@aoglobelife.com';
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

async function getAssociateIdFromEmail(agentEmail) {
  if (!agentEmail) return '999';
  
  try {
    // Look up associate_id from customers table
    const { data: customer, error } = await supabase
      .from('customers')
      .select('associate_id')
      .eq('company_email', agentEmail.toLowerCase().trim())
      .limit(1)
      .single();
    
    if (!error && customer && customer.associate_id) {
      return customer.associate_id.toString();
    }
    
    // Try producerlist as fallback
    const { data: producer } = await supabase
      .from('producerlist')
      .select('associate_id')
      .ilike('company_email', agentEmail)
      .maybeSingle();
    
    if (producer?.associate_id) {
      return producer.associate_id.toString();
    }
    
    return '999'; // Default fallback
  } catch (error) {
    console.error(`⚠️  Error looking up associate_id for ${agentEmail}:`, error.message);
    return '999';
  }
}

async function sendBookedLeadsToZapier() {
  console.log('\n🚀 SENDING BOOKED & APPOINTMENT_SET LEADS TO ZAPIER WEBHOOK\n');
  console.log(`📧 Agent: ${AGENT_EMAIL}`);
  console.log('='.repeat(60));

  const results = [];
  let successCount = 0;
  let failCount = 0;

  try {
    // Get all booked and appointment_set leads for brittanyvinje@aoglobelife.com
    const { data: leads, error } = await supabase
      .from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, phone, cn_email, cnresolution, last_contacted, created_at')
      .eq('cn_email', AGENT_EMAIL)
      .in('cnresolution', ['booked', 'appointment_set'])
      .order('last_contacted', { ascending: false });

    if (error) {
      console.error('❌ Error fetching leads:', error);
      return;
    }

    console.log(`\n📋 Found ${leads?.length || 0} leads (booked or appointment_set)\n`);

    if (!leads || leads.length === 0) {
      console.log('✅ No leads to send!');
      return;
    }

    // Get associate ID for the agent
    const associateId = await getAssociateIdFromEmail(AGENT_EMAIL);
    console.log(`👤 Associate ID: ${associateId}\n`);

    // Process each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      
      // Use taalk_lead_id if available, otherwise use database id
      const leadId = lead.taalk_lead_id || lead.id.toString();
      
      if (!lead.taalk_lead_id) {
        console.log(`⚠️  Lead ${lead.id} (${lead.first_name} ${lead.last_name}) has no taalk_lead_id, using database ID: ${leadId}`);
      }
      
      const webhookPayload = {
        lead_id: leadId,
        associate_id: associateId
      };

      const result = {
        lead_id: leadId,
        taalk_lead_id: lead.taalk_lead_id || 'N/A',
        database_id: lead.id,
        associate_id: associateId,
        agent_email: AGENT_EMAIL,
        lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        lead_phone: lead.phone || 'N/A',
        resolution: lead.cnresolution || 'N/A',
        last_contacted: lead.last_contacted || lead.created_at || 'N/A',
        status: 'pending',
        http_status: '',
        response: '',
        error: ''
      };

      try {
        console.log(`[${i + 1}/${leads.length}] 📤 Sending: ${result.lead_name} (taalk_lead_id: ${lead.taalk_lead_id || 'N/A'}, DB ID: ${lead.id})`);
        console.log(`   Resolution: ${lead.cnresolution} | Associate ID: ${associateId}`);

        const webhookResponse = await fetch(ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhookPayload)
        });

        const responseText = await webhookResponse.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }

        result.http_status = webhookResponse.status;
        result.response = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);

        if (webhookResponse.ok) {
          console.log(`   ✅ Success (${webhookResponse.status})`);
          result.status = 'success';
          successCount++;
        } else {
          console.log(`   ❌ Failed (${webhookResponse.status}): ${responseText.substring(0, 100)}`);
          result.status = 'failed';
          result.error = responseText.substring(0, 200);
          failCount++;
        }

        // Delay to avoid overwhelming Zapier webhook (2 seconds between requests)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (webhookError) {
        console.error(`   ❌ Error sending webhook:`, webhookError.message);
        result.status = 'error';
        result.error = webhookError.message;
        failCount++;
      }

      results.push(result);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Leads: ${leads.length}`);
    console.log(`   ✅ Successfully Sent: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`\n📋 Breakdown by Resolution:`);
    
    const bookedCount = leads.filter(l => l.cnresolution === 'booked').length;
    const appointmentSetCount = leads.filter(l => l.cnresolution === 'appointment_set').length;
    console.log(`   - Booked: ${bookedCount}`);
    console.log(`   - Appointment Set: ${appointmentSetCount}`);
    
    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

sendBookedLeadsToZapier()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

