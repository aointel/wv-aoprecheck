require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getRecentCalls() {
  try {
    console.log('✅ Connected to Supabase\n');

    // Get calls from last 30 days  
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log(`🔍 Fetching Twilio calls from last 30 days (since ${thirtyDaysAgo.toISOString()})...\n`);

    const { data: calls, error, count } = await supabase
      .from('twilio_call_logs')
      .select('*', { count: 'exact' })
      .gte('call_started_at', thirtyDaysAgo.toISOString())
      .order('call_started_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`📊 Total calls in last 30 days: ${count}\n`);

    if (!calls || calls.length === 0) {
      console.log('No calls found');
      return;
    }

    // Group by agent
    const byAgent = {};
    calls.forEach(call => {
      if (!byAgent[call.owner_email]) {
        byAgent[call.owner_email] = [];
      }
      byAgent[call.owner_email].push(call);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CALLS BY AGENT (Last 30 Days)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const [email, agentCalls] of Object.entries(byAgent)) {
      const over60 = agentCalls.filter(c => c.call_duration >= 60);
      const completed = agentCalls.filter(c => c.call_status === 'completed');
      
      console.log(`👤 ${email}`);
      console.log(`   Total: ${agentCalls.length} calls`);
      console.log(`   Completed: ${completed.length}`);
      console.log(`   Over 60 sec: ${over60.length}`);
      
      if (over60.length > 0) {
        console.log(`   60+ sec calls:`);
        over60.slice(0, 5).forEach(c => {
          console.log(`     - ${c.to_number} (${c.call_duration}s) ${c.call_started_at}`);
        });
        if (over60.length > 5) {
          console.log(`     ... and ${over60.length - 5} more`);
        }
      }
      console.log('');
    }

    // Show calls over 60 seconds
    const longCalls = calls.filter(c => c.call_duration >= 60);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔥 ALL CALLS OVER 60 SECONDS (${longCalls.length} total)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    longCalls.forEach((call, i) => {
      console.log(`${i + 1}. ${call.twilio_call_sid}`);
      console.log(`   To: ${call.to_number}`);
      console.log(`   Duration: ${call.call_duration}s`);
      console.log(`   Agent: ${call.owner_email}`);
      console.log(`   Started: ${call.call_started_at}`);
      console.log(`   Status: ${call.call_status}\n`);
    });

    // Now process these for webhooks
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 PROCESSING FOR WEBHOOKS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Strip +1 and get unique phones
    const phones = [...new Set(longCalls.map(c => {
      if (!c.to_number) return null;
      return c.to_number.replace(/^\+1/, '');
    }).filter(Boolean))];

    console.log(`📞 Unique phone numbers: ${phones.length}`);

    // Get leads with taalk_lead_id
    const { data: leads } = await supabase
      .from('masterlead')
      .select('taalk_lead_id, first_name, last_name, phone')
      .in('phone', phones)
      .not('taalk_lead_id', 'is', null);

    console.log(`🔥 Leads with taalk_lead_id: ${leads?.length || 0}`);

    // Get producers
    const emails = [...new Set(longCalls.map(c => c.owner_email).filter(Boolean))];
    const { data: producers } = await supabase
      .from('producerlist')
      .select('company_email, associate_id')
      .in('company_email', emails);

    console.log(`👔 Producers found: ${producers?.length || 0}\n`);

    if (producers && producers.length > 0) {
      producers.forEach(p => {
        console.log(`   ${p.company_email} → ${p.associate_id}`);
      });
    }

    // Count how many would be sent
    const leadMap = {};
    (leads || []).forEach(l => {
      leadMap[l.phone] = l;
    });

    const associateMap = {};
    (producers || []).forEach(p => {
      associateMap[p.company_email] = p.associate_id;
    });

    let validCount = 0;
    longCalls.forEach(call => {
      const phone = call.to_number?.replace(/^\+1/, '');
      const lead = leadMap[phone];
      const associateId = associateMap[call.owner_email];
      
      if (lead && lead.taalk_lead_id && associateId && associateId !== '999') {
        validCount++;
      }
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ VALID WEBHOOKS TO SEND: ${validCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getRecentCalls();

