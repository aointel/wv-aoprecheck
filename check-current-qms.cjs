const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkQMs() {
  console.log('🔍 Checking current QM assignments...\n');
  
  try {
    // Get all QMs and their assignment counts
    const { data: assignments, error } = await supabase
      .from('qm_mga_assignments')
      .select('qm_email, mga_name')
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    // Group by QM
    const qmMap = new Map();
    assignments.forEach(a => {
      if (!qmMap.has(a.qm_email)) {
        qmMap.set(a.qm_email, []);
      }
      qmMap.get(a.qm_email).push(a.mga_name);
    });
    
    console.log('📊 CURRENT QM ASSIGNMENTS:\n');
    console.log('='.repeat(80));
    
    for (const [qm, mgas] of qmMap.entries()) {
      console.log(`\n👤 ${qm}`);
      console.log(`   Assigned MGAs: ${mgas.length}`);
      console.log(`   MGAs: ${mgas.slice(0, 5).join(', ')}${mgas.length > 5 ? '...' : ''}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 Total QMs: ${qmMap.size}`);
    console.log(`📊 Total Assignments: ${assignments.length}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkQMs();

