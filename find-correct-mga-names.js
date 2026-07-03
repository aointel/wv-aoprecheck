import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findCorrectMgaNames() {
  try {
    console.log('Finding correct MGA team names in database...');
    
    // The MGA teams you want to assign
    const requestedMgaTeams = [
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
    
    console.log('\n--- Searching for MGA teams in database ---');
    
    for (const requestedMga of requestedMgaTeams) {
      console.log(`\nSearching for: "${requestedMga}"`);
      
      // Try exact match first
      const { data: exactMatch, error: exactError } = await supabase
        .from('qm_mga_assignments')
        .select('*')
        .eq('mga', requestedMga);
      
      if (!exactError && exactMatch && exactMatch.length > 0) {
        console.log(`✅ Found exact match: "${requestedMga}"`);
        continue;
      }
      
      // Try partial matches
      const { data: partialMatches, error: partialError } = await supabase
        .from('qm_mga_assignments')
        .select('*')
        .ilike('mga', `%${requestedMga.split(' ')[0]}%`);
      
      if (!partialError && partialMatches && partialMatches.length > 0) {
        console.log(`🔍 Found partial matches for "${requestedMga}":`);
        partialMatches.forEach(match => {
          console.log(`  - "${match.mga}"`);
        });
      } else {
        console.log(`❌ No matches found for "${requestedMga}"`);
      }
    }
    
    // Also search for some variations
    console.log('\n--- Searching for similar names ---');
    const variations = [
      'JESSICA', 'GABRIELLE', 'GABRIELA', 'KALEN', 'GEORGE', 'ROGER'
    ];
    
    for (const variation of variations) {
      const { data: similarMatches, error: similarError } = await supabase
        .from('qm_mga_assignments')
        .select('*')
        .ilike('mga', `%${variation}%`)
        .limit(5);
      
      if (!similarError && similarMatches && similarMatches.length > 0) {
        console.log(`\nSimilar to "${variation}":`);
        similarMatches.forEach(match => {
          console.log(`  - "${match.mga}"`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findCorrectMgaNames();

