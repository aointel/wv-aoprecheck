require('dotenv').config();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function sendWebhooks() {
  try {
    console.log('🚀 FETCHING TWILIO API CALLS & SENDING WEBHOOKS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get calls from Twilio API
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const startDate = threeDaysAgo.toISOString().split('T')[0];

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?StartTime>=${startDate}&PageSize=1000`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    const data = await response.json();
    const calls = data.calls || [];

    // Filter for outbound-dial calls over 60 seconds
    const outboundLongCalls = calls.filter(c => 
      c.direction === 'outbound-dial' &&
      c.status === 'completed' &&
      parseInt(c.duration) >= 60
    );

    console.log(`📊 Outbound calls over 60s: ${outboundLongCalls.length}\n`);

    // Get caller ID mappings from twilio_call_logs
    const callerIds = [...new Set(outboundLongCalls.map(c => c.from))];
    const { data: callLogs } = await supabase
      .from('twilio_call_logs')
      .select('from_number, owner_email')
      .in('from_number', callerIds)
      .not('owner_email', 'is', null);

    const callerIdToEmail = {};
    (callLogs || []).forEach(log => {
      callerIdToEmail[log.from_number] = log.owner_email;
    });

    // Get associate_ids
    const emails = [...new Set(Object.values(callerIdToEmail))];
    const { data: producers } = await supabase
      .from('producerlist')
      .select('company_email, associate_id')
      .in('company_email', emails);

    const emailToAssociateId = {};
    (producers || []).forEach(p => {
      emailToAssociateId[p.company_email] = p.associate_id;
    });

    // Get leads
    const phones = [...new Set(outboundLongCalls.map(c => c.to.replace(/^\+1/, '')))];
    const { data: leads } = await supabase
      .from('masterlead')
      .select('taalk_lead_id, first_name, last_name, phone')
      .in('phone', phones)
      .not('taalk_lead_id', 'is', null);

    const phoneToLead = {};
    (leads || []).forEach(l => {
      phoneToLead[l.phone] = l;
    });

    // Process webhooks
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 SENDING WEBHOOKS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const call of outboundLongCalls) {
      const phone = call.to.replace(/^\+1/, '');
      const lead = phoneToLead[phone];
      const email = callerIdToEmail[call.from];
      const associateId = email ? emailToAssociateId[email] : null;

      if (!lead || !lead.taalk_lead_id) {
        skippedCount++;
        continue;
      }

      if (!associateId || associateId === '999') {
        console.log(`⚠️  ${lead.first_name} ${lead.last_name} - SKIPPED (${call.from} → ${email || 'NO EMAIL'} → no associate_id)\n`);
        skippedCount++;
        continue;
      }

      const webhookPayload = {
        lead_id: lead.taalk_lead_id,
        associate_id: associateId
      };

      console.log(`📤 ${lead.first_name} ${lead.last_name}`);
      console.log(`   Lead ID: ${lead.taalk_lead_id}`);
      console.log(`   Agent: ${email} (${associateId})`);
      console.log(`   Duration: ${call.duration}s`);

      try {
        const webhookResponse = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
          },
          body: JSON.stringify(webhookPayload)
        });

        if (webhookResponse.ok) {
          console.log(`   ✅ SUCCESS\n`);
          successCount++;
        } else {
          const errorText = await webhookResponse.text();
          console.log(`   ❌ FAILED: ${webhookResponse.status} - ${errorText}\n`);
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}\n`);
        failCount++;
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 BACKFILL COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`📈 Total: ${outboundLongCalls.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
  }
}

sendWebhooks();

