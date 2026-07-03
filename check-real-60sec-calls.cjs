require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCalls() {
  try {
    console.log('✅ Connected to Supabase\n');

    // Check total calls in twilio_call_logs
    const { count: totalCount } = await supabase
      .from('twilio_call_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total calls in twilio_call_logs: ${totalCount}\n`);

    // Check calls over 60 seconds
    const { data: longCalls, count: longCount } = await supabase
      .from('twilio_call_logs')
      .select('*', { count: 'exact' })
      .gte('call_duration', 60)
      .eq('call_status', 'completed')
      .order('call_started_at', { ascending: false })
      .limit(10);
    
    console.log(`🔥 Calls over 60 seconds: ${longCount}\n`);

    if (longCalls && longCalls.length > 0) {
      console.log('Sample 60+ second calls:');
      longCalls.forEach((call, i) => {
        console.log(`\n${i + 1}. ${call.twilio_call_sid}`);
        console.log(`   From: ${call.from_number}`);
        console.log(`   To: ${call.to_number}`);
        console.log(`   Duration: ${call.call_duration}s`);
        console.log(`   Agent: ${call.owner_email}`);
        console.log(`   Started: ${call.call_started_at}`);
      });
    }

    // Check date range
    const { data: newest } = await supabase
      .from('twilio_call_logs')
      .select('call_started_at')
      .order('call_started_at', { ascending: false })
      .limit(1);

    const { data: oldest } = await supabase
      .from('twilio_call_logs')
      .select('call_started_at')
      .order('call_started_at', { ascending: true })
      .limit(1);

    console.log(`\n📅 Date Range:`);
    console.log(`   Oldest: ${oldest?.[0]?.call_started_at}`);
    console.log(`   Newest: ${newest?.[0]?.call_started_at}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCalls();

