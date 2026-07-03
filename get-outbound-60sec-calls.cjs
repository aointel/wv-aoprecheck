require('dotenv').config();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = '974557c999ed53ada16c4a784af2a7d3';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getOutboundCalls() {
  try {
    console.log('✅ Fetching Twilio outbound calls...\n');

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const startDate = threeDaysAgo.toISOString().split('T')[0];

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?StartTime>=${startDate}&PageSize=1000`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    const data = await response.json();
    const calls = data.calls || [];

    // Filter for OUTBOUND-DIAL calls over 60 seconds
    const outboundLongCalls = calls.filter(c => 
      c.direction === 'outbound-dial' &&
      c.status === 'completed' &&
      parseInt(c.duration) >= 60
    );

    console.log(`📊 Outbound-dial calls over 60s: ${outboundLongCalls.length}\n`);

    if (outboundLongCalls.length === 0) {
      console.log('❌ No outbound calls over 60 seconds found');
      return;
    }

    console.log('🔥 OUTBOUND CALLS OVER 60 SECONDS:\n');
    outboundLongCalls.forEach((call, i) => {
      console.log(`${i + 1}. ${call.sid}`);
      console.log(`   ${call.from} → ${call.to}`);
      console.log(`   Duration: ${call.duration}s`);
      console.log(`   Started: ${call.start_time}\n`);
    });

    // Now match with leads and agents
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 PROCESSING FOR WEBHOOKS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Strip +1 from "to" numbers
    const phones = [...new Set(outboundLongCalls.map(c => c.to.replace(/^\+1/, '')))];
    console.log(`📞 Unique phone numbers called: ${phones.length}`);

    // Get leads with taalk_lead_id
    const { data: leads } = await supabase
      .from('masterlead')
      .select('taalk_lead_id, first_name, last_name, phone')
      .in('phone', phones)
      .not('taalk_lead_id', 'is', null);

    console.log(`🔥 Leads with taalk_lead_id: ${leads?.length || 0}`);

    // Get "from" numbers (agent caller IDs)
    const fromNumbers = [...new Set(outboundLongCalls.map(c => c.from))];
    console.log(`📞 Unique caller IDs: ${fromNumbers.length}\n`);

    // We need to map from numbers to agent emails somehow...
    // For now, show what we have
    console.log('📋 CALLS THAT WOULD GET WEBHOOKS:\n');

    const leadMap = {};
    (leads || []).forEach(l => {
      leadMap[l.phone] = l;
    });

    let potentialWebhooks = 0;
    outboundLongCalls.forEach(call => {
      const phone = call.to.replace(/^\+1/, '');
      const lead = leadMap[phone];
      
      if (lead && lead.taalk_lead_id) {
        potentialWebhooks++;
        console.log(`✅ ${lead.first_name} ${lead.last_name} (${lead.taalk_lead_id})`);
        console.log(`   From: ${call.from} → To: ${call.to}`);
        console.log(`   Duration: ${call.duration}s`);
        console.log(`   ⚠️  Need to map ${call.from} to agent email\n`);
      }
    });

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Potential webhooks: ${potentialWebhooks}`);
    console.log(`⚠️  Need agent email mapping for caller IDs`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getOutboundCalls();

