import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateQMAssignments() {
  try {
    console.log('🔄 Updating QM assignments...');
    
    const qmEmail = 'tomanovichqm@aoglobelife.com';
    
    // New complete list of assigned teams
    const newAssignedTeams = [
      'STEPHEN BOWEN',
      'GEORGE OSHEA', 
      'HEMAWATTIE MOOLOO',
      'ROGER FREDERICKS',
      'MARIA LAGIOS',
      'ALLISSA COLLINS',
      'LEYNA TRAN',
      'JACQUELINE PRIETO',
      'KALEN DUGAN',
      'JESSICA OLANDRIA',
      'GABRIELLE GARCIA',
      'MEGHAN HENDRICKSON'
    ];
    
    console.log(`📋 New assignment list (${newAssignedTeams.length} teams):`);
    newAssignedTeams.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team}`);
    });
    
    // 1. First, reset all current assignments for this QM to TBD
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
    
    // 2. Update assignments for the new teams
    console.log('\n2. Updating assignments for new teams...');
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const team of newAssignedTeams) {
      const { data, error } = await supabase
        .from('qm_mga_assignments')
        .update({ quality_manager: qmEmail })
        .eq('mga', team);
      
      if (error) {
        console.error(`❌ Error updating ${team}:`, error);
      } else {
        // Check if any rows were actually updated
        if (data && data.length > 0) {
          console.log(`✅ Assigned ${team} to ${qmEmail}`);
          updatedCount++;
        } else {
          console.log(`❌ MGA team "${team}" not found in database`);
          notFoundCount++;
        }
      }
    }
    
    console.log(`\n✅ Successfully assigned ${updatedCount} MGA teams to ${qmEmail}`);
    if (notFoundCount > 0) {
      console.log(`❌ ${notFoundCount} MGA teams not found in database`);
    }
    
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
      
      // Show summary
      console.log('\n📈 Assignment Summary:');
      const { data: allAssignments, error: allError } = await supabase
        .from('qm_mga_assignments')
        .select('quality_manager')
        .not('quality_manager', 'eq', 'TBD');
      
      if (!allError && allAssignments) {
        const assignmentCounts = {};
        allAssignments.forEach(assignment => {
          assignmentCounts[assignment.quality_manager] = (assignmentCounts[assignment.quality_manager] || 0) + 1;
        });
        
        console.log('Current Quality Manager assignments:');
        Object.entries(assignmentCounts).forEach(([qm, count]) => {
          console.log(`- ${qm}: ${count} MGA teams`);
        });
      }
      
      console.log('\n🎉 QM assignments updated successfully!');
      console.log(`📊 ${qmEmail} can now see verification sessions for ${finalAssignments.length} MGA teams`);
      
    } else {
      console.error('❌ Error verifying final assignments:', finalError);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateQMAssignments();
