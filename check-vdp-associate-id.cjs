require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVDPData() {
  try {
    console.log('🔍 Checking vdp_calls with associate_id...\n');
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get recent VDP calls with associate_id
    const { data: calls, error } = await supabase
      .from('vdp_calls')
      .select('associate_id, company_email, agent, mga, updated_at')
      .gte('updated_at', today.toISOString())
      .not('associate_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`📊 VDP calls today with associate_id: ${calls?.length || 0}\n`);
    
    if (calls && calls.length > 0) {
      calls.forEach((call, i) => {
        console.log(`${i + 1}. Associate ID: ${call.associate_id}`);
        console.log(`   MGA: ${call.mga || 'NULL'}`);
        console.log(`   company_email: ${call.company_email || 'NULL'}`);
        console.log(`   agent: ${call.agent || 'NULL'}`);
        console.log(`   Updated: ${call.updated_at}`);
        console.log('');
      });
      
      // Get unique associate IDs
      const uniqueAssocIds = [...new Set(calls.map(c => c.associate_id))];
      console.log(`👥 Unique associate IDs: ${uniqueAssocIds.length}`);
      console.log(uniqueAssocIds);
      
    } else {
      console.log('No VDP calls with associate_id today');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkVDPData();

