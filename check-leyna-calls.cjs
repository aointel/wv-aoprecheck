require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeynaCalls() {
  try {
    const leynaEmail = 'leynatran@aoglobelife.com';
    console.log(`🔍 Checking calls for ${leynaEmail}...\n`);
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all leads touched by Leyna today
    const { data: calls, error } = await supabase
      .from('masterlead')
      .select('*')
      .eq('cn_email', leynaEmail)
      .gte('last_contacted', today.toISOString())
      .order('last_contacted', { ascending: false });
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`📊 Total calls touched today: ${calls?.length || 0}\n`);
    
    if (!calls || calls.length === 0) {
      console.log('No calls found for Leyna today');
      return;
    }
    
    // Breakdown by cnresolution
    const resolutions = {};
    calls.forEach(call => {
      const res = call.cnresolution || 'null';
      resolutions[res] = (resolutions[res] || 0) + 1;
    });
    
    console.log('📋 Breakdown by cnresolution:');
    Object.entries(resolutions).forEach(([res, count]) => {
      console.log(`   ${res}: ${count}`);
    });
    console.log('');
    
    // Show "reached" calls (not pending, not called, not wrong number)
    const reachedCalls = calls.filter(c => 
      c.cnresolution && 
      c.cnresolution !== 'pending' && 
      c.cnresolution !== 'called' && 
      c.cnresolution !== 'wrong number'
    );
    
    console.log(`✅ "Reached" calls: ${reachedCalls.length}\n`);
    
    // Show recent calls
    console.log('📞 Recent 10 calls:\n');
    calls.slice(0, 10).forEach((call, i) => {
      console.log(`${i + 1}. ${call.first_name} ${call.last_name} - ${call.phone}`);
      console.log(`   Resolution: ${call.cnresolution || 'NULL'}`);
      console.log(`   Contacted: ${call.last_contacted}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLeynaCalls();

