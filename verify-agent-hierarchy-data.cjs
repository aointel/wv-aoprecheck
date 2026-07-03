const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyData() {
  console.log('🔍 Verifying agent_hierarchy data...\n');
  
  try {
    // Count total records
    const { count, error: countError } = await supabase
      .from('agent_hierarchy')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total records: ${count || 0}\n`);
    
    // Get sample records
    const { data: sample, error: sampleError } = await supabase
      .from('agent_hierarchy')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (sample && sample.length > 0) {
      console.log('✅ Sample records (most recent):');
      console.table(sample.map(s => ({
        name: s.agent_name,
        email: s.agent_email,
        mga: s.mga_name,
        rga: s.rga_name
      })));
    } else {
      console.log('❌ NO DATA in agent_hierarchy!\n');
    }
    
    // Check Chris Lafond specifically
    const { data: chrisAgents, error: chrisError } = await supabase
      .from('agent_hierarchy')
      .select('agent_name, agent_email')
      .eq('mga_associate_id', 409);
    
    console.log(`\n👤 Chris Lafond's team: ${chrisAgents?.length || 0} agents`);
    
    if (chrisAgents && chrisAgents.length > 0) {
      chrisAgents.slice(0, 5).forEach(a => {
        console.log(`   - ${a.agent_name} (${a.agent_email})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyData();






