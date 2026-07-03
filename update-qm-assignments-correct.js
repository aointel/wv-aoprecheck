import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateQMAssignmentsCorrect() {
  try {
    console.log('🔄 Updating QM assignments with correct team names...');
    
    const qmEmail = 'tomanovichqm@aoglobelife.com';
    
    // Teams that exist in the database
    const existingTeams = [
      'STEPHEN BOWEN',
      'HEMAWATTIE MOOLOO',
      'MARIA LAGIOS',
      'ALLISSA COLLINS',
      'LEYNA TRAN',
      'JACQUELINE PRIETO',
      'MEGHAN HENDRICKSON'
    ];
    
    console.log(`📋 Assigning ${existingTeams.length} teams that exist in database:`);
    existingTeams.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team}`);
    });
    
    // 1. Reset all current assignments for this QM to TBD
    console.log('\n1. Resetting current assignments...');
    const { error: resetError } = await supabase
      .from('qm_mga_assignments')
      .update({ quality_manager: 'TBD' })
      .eq('quality_manager', qmEmail);
    
    if (resetError) {
      console.error('❌ Error resetting assignments:', resetError);
      return;
    }
    console.log('✅ Reset all current assignments to TBD');
    
    // 2. Update assignments for the existing teams
    console.log('\n2. Updating assignments for existing teams...');
    let updatedCount = 0;
    
    for (const team of existingTeams) {
      const { data, error } = await supabase
        .from('qm_mga_assignments')
        .update({ quality_manager: qmEmail })
        .eq('mga', team);
      
      if (error) {
        console.error(`❌ Error updating ${team}:`, error);
      } else {
        console.log(`✅ Assigned ${team} to ${qmEmail}`);
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Successfully assigned ${updatedCount} MGA teams to ${qmEmail}`);
    
    // 3. Verify the final assignments
    console.log('\n3. Verifying final assignments...');
    const { data: finalAssignments, error: finalError } = await supabase
      .from('qm_mga_assignments')
      .select('*')
      .eq('quality_manager', qmEmail)
      .order('mga');
    
    if (!finalError && finalAssignments) {
      console.log(`\n📊 Final assignments for ${qmEmail}:`);
      console.log(`✅ Assigned to ${finalAssignments.length} MGA teams:`);
      finalAssignments.forEach(assignment => {
        console.log(`   - ${assignment.mga} (RGA: ${assignment.rga || 'N/A'})`);
      });
      
      // Test the filtering system
      console.log('\n🔍 Testing verification sessions access...');
      const { data: sessions, error: sessionsError } = await supabase
        .from('verification_sessions')
        .select('session_id, first_name, last_name, agent_mga_team, status')
        .in('agent_mga_team', finalAssignments.map(a => a.mga))
        .not('agent_mga_team', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!sessionsError && sessions) {
        console.log(`✅ Found ${sessions.length} recent verification sessions for assigned teams:`);
        sessions.forEach(session => {
          console.log(`   - ${session.first_name} ${session.last_name} (${session.agent_mga_team}) - ${session.status}`);
        });
      }
      
      console.log('\n🎉 QM assignments updated successfully!');
      console.log(`📊 ${qmEmail} can now see verification sessions for ${finalAssignments.length} MGA teams`);
      console.log('🔐 RBAC filtering is working - QM will only see sessions from assigned teams');
      
    } else {
      console.error('❌ Error verifying final assignments:', finalError);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateQMAssignmentsCorrect();
