import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTomanovichQmCorrectAssignments() {
  try {
    console.log('Updating tomanovichqm@aoglobelife.com with correct MGA team assignments...');
    
    // First, reset all assignments to TBD
    console.log('\n--- Resetting all assignments to TBD ---');
    const { error: resetError } = await supabase
      .from('qm_mga_assignments')
      .update({ quality_manager: 'TBD' })
      .neq('id', 0);
    
    if (resetError) {
      console.error('Error resetting assignments:', resetError);
    } else {
      console.log('✅ Reset all assignments to TBD');
    }
    
    // The correct MGA teams for tomanovichqm
    const correctMgaTeams = [
      'ALLISSA COLLINS',
      'LEYNA TRAN', 
      'JACQUELINE PRIETO',
      'KALEN DUGAN',
      'JESSICA OLANDRIA',
      'GABRIELLE GARCIA',
      'MEGHAN HENDRICKSON',
      'STEPHEN BOWEN',
      'GEORGE OSHEA',
      'HEMAWATTIE MOOLOO',
      'ROGER FREDERICKS',
      'MARIA LAGIOS'
    ];
    
    console.log(`\n--- Assigning ${correctMgaTeams.length} correct MGA teams to tomanovichqm ---`);
    
    // Update the assignments
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const mga of correctMgaTeams) {
      const { data, error } = await supabase
        .from('qm_mga_assignments')
        .update({ quality_manager: 'tomanovichqm@aoglobelife.com' })
        .eq('mga', mga);
      
      if (error) {
        console.error(`Error updating ${mga}:`, error);
      } else {
        // Check if any rows were actually updated
        if (data && data.length > 0) {
          console.log(`✅ Assigned ${mga} to tomanovichqm`);
          updatedCount++;
        } else {
          console.log(`❌ MGA team "${mga}" not found in database`);
          notFoundCount++;
        }
      }
    }
    
    console.log(`\n✅ Successfully assigned ${updatedCount} MGA teams to tomanovichqm`);
    if (notFoundCount > 0) {
      console.log(`❌ ${notFoundCount} MGA teams not found in database`);
    }
    
    // Show the final assignments
    console.log('\n--- Final tomanovichqm@aoglobelife.com assignments ---');
    const { data: tomanovichAssignments, error: tomanovichError } = await supabase
      .from('qm_mga_assignments')
      .select('*')
      .eq('quality_manager', 'tomanovichqm@aoglobelife.com')
      .order('mga');
    
    if (!tomanovichError && tomanovichAssignments) {
      console.log(`tomanovichqm@aoglobelife.com is now assigned to ${tomanovichAssignments.length} MGA teams:`);
      tomanovichAssignments.forEach(assignment => {
        console.log(`- ${assignment.mga} (RGA: ${assignment.rga || 'N/A'})`);
      });
    }
    
    // Show summary
    console.log('\n--- Assignment Summary ---');
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
    
    console.log('\n✅ Correct assignments completed!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateTomanovichQmCorrectAssignments();

