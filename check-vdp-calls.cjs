require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVDPCalls() {
  try {
    console.log('🔍 Checking vdp_calls table...\n');
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get today's VDP calls
    const { data: todayCalls, error: todayError, count: todayCount } = await supabase
      .from('vdp_calls')
      .select('*', { count: 'exact' })
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (todayError) {
      console.error('❌ Error:', todayError);
      return;
    }
    
    console.log(`📊 Total VDP calls today: ${todayCount}`);
    console.log('\n📋 Recent VDP calls today:\n');
    
    if (todayCalls && todayCalls.length > 0) {
      todayCalls.forEach((call, i) => {
        console.log(`${i + 1}. ${call.agent_email || 'Unknown'}`);
        console.log(`   Created: ${call.created_at}`);
        console.log(`   Call SID: ${call.call_sid}`);
        console.log('');
      });
    } else {
      console.log('   No VDP calls today\n');
    }
    
    // Get all-time VDP calls
    const { count: allTimeCount } = await supabase
      .from('vdp_calls')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total VDP calls all-time: ${allTimeCount}`);
    
    // Get unique agents with VDP calls
    const { data: agentCalls } = await supabase
      .from('vdp_calls')
      .select('agent_email')
      .gte('created_at', today.toISOString());
    
    const uniqueAgents = [...new Set(agentCalls?.map(c => c.agent_email) || [])];
    console.log(`\n👥 Agents with VDP calls today: ${uniqueAgents.length}`);
    uniqueAgents.forEach(email => console.log(`   - ${email}`));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkVDPCalls();

