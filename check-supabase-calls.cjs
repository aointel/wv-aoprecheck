require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCalls() {
  try {
    console.log('✅ Connected to Supabase\n');

    // Check for outbound calls over 60 seconds
    console.log('🔍 Searching for 60+ second calls...\n');
    
    const { data: calls, error } = await supabase
      .from('outbound_call_history')
      .select('*')
      .gte('duration', 60)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error querying calls:', error);
      return;
    }

    console.log(`📊 Found ${calls?.length || 0} calls over 60 seconds`);

    if (!calls || calls.length === 0) {
      console.log('No calls found');
      return;
    }

    // Get lead IDs
    const leadPhones = [...new Set(calls.map(c => c.lead_phone).filter(Boolean))];
    console.log(`📞 Unique lead phones: ${leadPhones.length}`);

    // Get leads
    const { data: leads, error: leadError } = await supabase
      .from('masterlead')
      .select('taalk_lead_id, first_name, last_name, lead_number, source_table')
      .in('lead_number', leadPhones)
      .eq('source_table', 'hotleads');

    if (leadError) {
      console.error('❌ Error getting leads:', leadError);
    }

    console.log(`🔥 Found ${leads?.length || 0} hotleads\n`);

    // Create lead map
    const leadMap = {};
    (leads || []).forEach(l => {
      leadMap[l.lead_number] = l;
    });

    // Filter calls to only hotleads
    const hotleadCalls = calls.filter(c => leadMap[c.lead_phone]);
    console.log(`✅ ${hotleadCalls.length} calls are to hotleads\n`);

    if (hotleadCalls.length === 0) {
      console.log('No hotlead calls found');
      return;
    }

    // Get associate_ids for all agents
    const agentEmails = [...new Set(hotleadCalls.map(c => c.agent_email).filter(Boolean))];
    console.log(`👥 Unique agents: ${agentEmails.length}\n`);

    const { data: producers, error: prodError } = await supabase
      .from('producerlist')
      .select('company_email, associate_id')
      .in('company_email', agentEmails);

    if (prodError) {
      console.error('❌ Error getting producers:', prodError);
    }

    console.log(`👔 Found ${producers?.length || 0} producers\n`);

    const associateMap = {};
    (producers || []).forEach(p => {
      associateMap[p.company_email] = p.associate_id;
    });

    console.log('📋 CALLS READY TO PROCESS:\n');
    hotleadCalls.forEach((call, i) => {
      const lead = leadMap[call.lead_phone];
      const associateId = associateMap[call.agent_email] || '999';
      
      if (lead && lead.taalk_lead_id && associateId !== '999') {
        console.log(`${i + 1}. ${lead.first_name} ${lead.last_name}`);
        console.log(`   Lead ID: ${lead.taalk_lead_id}`);
        console.log(`   Agent: ${call.agent_email} → ${associateId}`);
        console.log(`   Duration: ${call.duration}s`);
        console.log(`   Date: ${call.created_at}\n`);
      }
    });

    const validCalls = hotleadCalls.filter(c => {
      const lead = leadMap[c.lead_phone];
      const associateId = associateMap[c.agent_email];
      return lead && lead.taalk_lead_id && associateId && associateId !== '999';
    });

    console.log(`\n✅ Total valid calls: ${validCalls.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCalls();

