import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAssignments() {
  try {
    console.log('🔍 Checking current QM assignments...');
    
    const { data, error } = await supabase
      .from('qm_mga_assignments')
      .select('*')
      .eq('is_active', true)
      .order('qm_email, mga_name');
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ Found ${data.length} active QM assignments:`);
    console.log('');
    
    const groupedByQM = {};
    data.forEach(assignment => {
      if (!groupedByQM[assignment.qm_email]) {
        groupedByQM[assignment.qm_email] = [];
      }
      groupedByQM[assignment.qm_email].push(assignment.mga_name);
    });
    
    Object.entries(groupedByQM).forEach(([qmEmail, teams]) => {
      console.log(`📧 ${qmEmail}:`);
      teams.forEach(team => console.log(`   - ${team}`));
      console.log('');
    });
    
    console.log(`📊 Summary: ${Object.keys(groupedByQM).length} QMs assigned to ${data.length} total team assignments`);
    
    // Also check available MGA teams
    console.log('\n🔍 Checking available MGA teams...');
    const { data: mgaTeams, error: mgaError } = await supabase
      .from('mga_teams_from_producerlist')
      .select('mga_name')
      .order('mga_name');
    
    if (!mgaError && mgaTeams) {
      console.log(`✅ Found ${mgaTeams.length} MGA teams in the system:`);
      mgaTeams.slice(0, 10).forEach(team => console.log(`   - ${team.mga_name}`));
      if (mgaTeams.length > 10) {
        console.log(`   ... and ${mgaTeams.length - 10} more`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAssignments();
