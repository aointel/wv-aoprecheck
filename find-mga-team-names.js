import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMgaTeamNames() {
  try {
    console.log('🔍 Finding MGA team names in the database...');
    
    // Get all unique MGA team names from qm_mga_assignments table
    const { data: allMgaTeams, error } = await supabase
      .from('qm_mga_assignments')
      .select('mga')
      .not('mga', 'eq', '0')
      .order('mga');
    
    if (error) {
      console.error('❌ Error fetching MGA teams:', error);
      return;
    }
    
    const uniqueTeams = [...new Set(allMgaTeams?.map(t => t.mga))].filter(Boolean);
    
    console.log(`✅ Found ${uniqueTeams.length} unique MGA teams in database:`);
    uniqueTeams.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team}`);
    });
    
    // Check which of the requested teams exist
    const requestedTeams = [
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
    
    console.log('\n🔍 Checking which requested teams exist:');
    const existingTeams = [];
    const missingTeams = [];
    
    requestedTeams.forEach(requestedTeam => {
      const found = uniqueTeams.find(dbTeam => 
        dbTeam.toLowerCase() === requestedTeam.toLowerCase()
      );
      
      if (found) {
        console.log(`✅ ${requestedTeam} -> Found as "${found}"`);
        existingTeams.push(found);
      } else {
        console.log(`❌ ${requestedTeam} -> Not found`);
        missingTeams.push(requestedTeam);
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ ${existingTeams.length} teams found in database`);
    console.log(`❌ ${missingTeams.length} teams not found`);
    
    if (existingTeams.length > 0) {
      console.log('\n🎯 Teams that can be assigned:');
      existingTeams.forEach(team => console.log(`   - ${team}`));
    }
    
    if (missingTeams.length > 0) {
      console.log('\n⚠️ Teams not found (may need different spelling):');
      missingTeams.forEach(team => console.log(`   - ${team}`));
      
      // Try to find similar names
      console.log('\n🔍 Looking for similar names...');
      missingTeams.forEach(missingTeam => {
        const similar = uniqueTeams.filter(dbTeam => 
          dbTeam.toLowerCase().includes(missingTeam.split(' ')[0].toLowerCase()) ||
          missingTeam.split(' ')[0].toLowerCase().includes(dbTeam.toLowerCase().split(' ')[0])
        );
        
        if (similar.length > 0) {
          console.log(`   "${missingTeam}" might be: ${similar.join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findMgaTeamNames();
