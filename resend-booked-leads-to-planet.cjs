/**
 * Resend all booked leads to Planet ALTIG webhook and generate CSV report
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

// Agent email to associate_id fallback mapping (used if database lookup fails)
const AGENT_ASSOCIATE_MAP = {
  'martintoma@aoglobelife.com': '1253',
  'cnsysop@aoglobelife.com': '1253',
  'davidfulfer@aoglobelife.com': '124235'
};

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/';

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
    
    // Fallback to hardcoded map
    if (AGENT_ASSOCIATE_MAP[agentEmail]) {
      return AGENT_ASSOCIATE_MAP[agentEmail];
    }
    
    return '999'; // Default fallback
  } catch (error) {
    console.error(`⚠️  Error looking up associate_id for ${agentEmail}:`, error.message);
    // Try fallback map
    if (AGENT_ASSOCIATE_MAP[agentEmail]) {
      return AGENT_ASSOCIATE_MAP[agentEmail];
    }
    return '999';
  }
}

async function resendBookedLeadsToPlanet() {
  console.log('\n🚀 RESENDING ALL BOOKED LEADS TO ZAPIER WEBHOOK\n');
  console.log('='.repeat(60));

  const results = [];
  let successCount = 0;
  let failCount = 0;

  try {
    // Get all booked leads from masterlead
    const { data: bookedLeads, error } = await supabase
      .from('masterlead')
      .select('id, taalk_lead_id, first_name, last_name, phone, cn_email, cnresolution, last_contacted, created_at')
      .eq('cnresolution', 'booked')
      .order('last_contacted', { ascending: false });

    if (error) {
      console.error('❌ Error fetching booked leads:', error);
      return;
    }

    console.log(`\n📋 Found ${bookedLeads?.length || 0} booked leads\n`);

    if (!bookedLeads || bookedLeads.length === 0) {
      console.log('✅ No booked leads to send!');
      return;
    }

    // Process each lead
    for (let i = 0; i < bookedLeads.length; i++) {
      const lead = bookedLeads[i];
      const agentEmail = lead.cn_email || 'unknown@aoglobelife.com';
      
      // Get associate ID - try to get from existing data first, then lookup
      let associateId = lead.cn_email ? await getAssociateIdFromEmail(agentEmail) : '999';
      
      // If we got 999, try finding the lead in the CSV to get the correct associate_id
      if (associateId === '999' && !lead.cn_email) {
        // Try to find similar lead in another table or use default
        console.log(`⚠️  Lead ${lead.id} has no agent email, using default 999`);
      }
      
      // Use taalk_lead_id if available, otherwise use database id
      const leadId = lead.taalk_lead_id || lead.id.toString();
      
      const webhookPayload = {
        lead_id: leadId,
        associate_id: associateId
      };

      const result = {
        lead_id: leadId,
        associate_id: associateId,
        agent_email: agentEmail,
        lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        lead_phone: lead.phone || 'N/A',
        booked_date: lead.last_contacted || lead.created_at || 'N/A',
        status: 'pending',
        http_status: '',
        response: '',
        error: ''
      };

      try {
        console.log(`[${i + 1}/${bookedLeads.length}] 📤 Sending: ${result.lead_name} (${leadId}) → Agent: ${agentEmail} (Associate ID: ${associateId})`);

        const webhookResponse = await fetch(WEBHOOK_URL, {
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

        // Small delay to avoid overwhelming the webhook
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (webhookError) {
        console.error(`   ❌ Error sending webhook:`, webhookError.message);
        result.status = 'error';
        result.error = webhookError.message;
        failCount++;
      }

      results.push(result);
    }

    // Generate CSV
    const csvHeader = 'lead_id,associate_id,agent_email,lead_name,lead_phone,booked_date,status,http_status,response,error\n';
    const csvRows = results.map(r => {
      const escapeCsv = (str) => {
        if (!str) return '';
        const s = String(str);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      
      return [
        escapeCsv(r.lead_id),
        escapeCsv(r.associate_id),
        escapeCsv(r.agent_email),
        escapeCsv(r.lead_name),
        escapeCsv(r.lead_phone),
        escapeCsv(r.booked_date),
        escapeCsv(r.status),
        escapeCsv(r.http_status),
        escapeCsv(r.response),
        escapeCsv(r.error)
      ].join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const csvFilename = `planet-webhooks-${timestamp}.csv`;
    const csvPath = path.join(process.cwd(), csvFilename);

    fs.writeFileSync(csvPath, csvContent, 'utf8');

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Booked Leads: ${bookedLeads.length}`);
    console.log(`   ✅ Successfully Sent: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`\n📄 CSV Report saved to: ${csvFilename}`);
    console.log(`   Full path: ${csvPath}`);
    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  }
}

resendBookedLeadsToPlanet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

