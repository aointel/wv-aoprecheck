require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRealCalls() {
  try {
    console.log('✅ Connected to Supabase\n');
    console.log('🔍 Checking different tables for call data...\n');

    // Check twilio_call_logs
    const { data: twilioLogs, error: twilioError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .limit(5);
    
    if (!twilioError) {
      console.log(`✅ twilio_call_logs: ${twilioLogs?.length || 0} records`);
      if (twilioLogs && twilioLogs.length > 0) {
        console.log('   Sample:', JSON.stringify(twilioLogs[0], null, 2));
      }
    } else {
      console.log(`❌ twilio_call_logs: ${twilioError.message}`);
    }

    console.log('\n');

    // Check masterlead for recent calls
    const { data: leads, error: leadsError } = await supabase
      .from('masterlead')
      .select('*')
      .not('last_contacted', 'is', null)
      .order('last_contacted', { ascending: false })
      .limit(5);
    
    if (!leadsError) {
      console.log(`✅ masterlead (with last_contacted): ${leads?.length || 0} records`);
      if (leads && leads.length > 0) {
        console.log('   Sample lead:', {
          name: `${leads[0].first_name} ${leads[0].last_name}`,
          phone: leads[0].phone,
          taalk_lead_id: leads[0].taalk_lead_id,
          last_contacted: leads[0].last_contacted,
          cnresolution: leads[0].cnresolution
        });
      }
    } else {
      console.log(`❌ masterlead: ${leadsError.message}`);
    }

    console.log('\n');

    // Check for other potential call tracking tables
    const potentialTables = [
      'call_tracking',
      'call_history', 
      'agent_calls',
      'outbound_calls',
      'call_records',
      'taalk2cn',
      'call_connector_calls'
    ];

    for (const table of potentialTables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!error && data) {
        console.log(`✅ ${table}: EXISTS (${data.length} sample)`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findRealCalls();

