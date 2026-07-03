require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillWebhooks() {
  try {
    console.log('✅ Connected to Supabase\n');

    // Get calls over 60 seconds
    console.log('🔍 Fetching calls over 60 seconds...\n');
    const { data: calls, error: callsError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('call_duration', 60)
      .eq('call_status', 'completed')
      .order('call_started_at', { ascending: false })
      .limit(200);

    if (callsError) {
      console.error('❌ Error fetching calls:', callsError);
      return;
    }

    console.log(`📊 Found ${calls?.length || 0} calls over 60 seconds`);

    if (!calls || calls.length === 0) {
      console.log('No calls to process');
      return;
    }

    // Get unique phone numbers (strip +1 prefix)
    const phones = [...new Set(calls.map(c => {
      if (!c.to_number) return null;
      return c.to_number.replace(/^\+1/, '');
    }).filter(Boolean))];
    console.log(`📞 Unique phone numbers: ${phones.length}`);

    // Get ALL leads with taalk_lead_id (hotleads have taalk_lead_id)
    const { data: leads, error: leadsError} = await supabase
      .from('masterlead')
      .select('taalk_lead_id, first_name, last_name, phone')
      .in('phone', phones)
      .not('taalk_lead_id', 'is', null);

    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError);
      return;
    }

    console.log(`🔥 Found ${leads?.length || 0} leads with taalk_lead_id\n`);

    // Create lead map
    const leadMap = {};
    (leads || []).forEach(l => {
      leadMap[l.phone] = l;
    });

    // Filter to hotlead calls only (strip +1 for matching)
    const hotleadCalls = calls.filter(c => {
      const phone = c.to_number?.replace(/^\+1/, '');
      return leadMap[phone];
    });
    console.log(`✅ ${hotleadCalls.length} calls to hotleads\n`);

    if (hotleadCalls.length === 0) {
      console.log('No hotlead calls found');
      return;
    }

    // Get agent associate_ids
    const emails = [...new Set(hotleadCalls.map(c => c.owner_email).filter(Boolean))];
    console.log(`👥 Unique agents: ${emails.length}`);

    const { data: producers, error: prodError } = await supabase
      .from('producerlist')
      .select('company_email, associate_id')
      .in('company_email', emails);

    if (prodError) {
      console.error('❌ Error fetching producers:', prodError);
      return;
    }

    console.log(`👔 Found ${producers?.length || 0} producers\n`);

    // Create associate map
    const associateMap = {};
    (producers || []).forEach(p => {
      associateMap[p.company_email] = p.associate_id;
    });

    // Process webhooks
    console.log('🚀 SENDING WEBHOOKS:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const call of hotleadCalls) {
      const phone = call.to_number?.replace(/^\+1/, '');
      const lead = leadMap[phone];
      const associateId = associateMap[call.owner_email];

      if (!lead || !lead.taalk_lead_id) {
        skippedCount++;
        continue;
      }

      if (!associateId || associateId === '999') {
        console.log(`⚠️  ${lead.first_name} ${lead.last_name} - SKIPPED (no associate_id for ${call.owner_email})\n`);
        skippedCount++;
        continue;
      }

      const webhookPayload = {
        lead_id: lead.taalk_lead_id,
        associate_id: associateId
      };

      console.log(`📤 ${lead.first_name} ${lead.last_name}`);
      console.log(`   Lead ID: ${lead.taalk_lead_id}`);
      console.log(`   Agent: ${call.owner_email} → ${associateId}`);
      console.log(`   Duration: ${call.call_duration}s`);

      try {
        const response = await fetch('https://hooks.zapier.com/hooks/catch/2467580/ud6b4rp/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'gGOOgk54VsWvy6zJ2S9t14cFxrzk0485EPiVIb23'
          },
          body: JSON.stringify(webhookPayload)
        });

        if (response.ok) {
          console.log(`   ✅ SUCCESS\n`);
          successCount++;
        } else {
          const errorText = await response.text();
          console.log(`   ❌ FAILED: ${response.status} - ${errorText}\n`);
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
    console.log(`📈 Total: ${hotleadCalls.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
  }
}

backfillWebhooks();

