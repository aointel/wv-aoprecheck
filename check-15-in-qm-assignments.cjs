const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const requestedNames = [
  'JOSEPH TOMANOVICH',
  'MARIA LAGIOS',
  'GEORGE OSHEA',
  'ALLISSA COLLINS',
  'JENNIFER JANTZEN',
  'KALEN DUGAN',
  'ROGER FREDERICKS',
  'STEPHEN BOWEN',
  'HEMAWATTIE MOOLOO',
  'VICTORIA MARTINEZ',
  'GABRIELLE GARCIA',
  'JESSICA OLANDRIA',
  'JACQUELINE PRIETO',
  'LEYNA TRAN',
  'MEGHAN HENDRICKSON'
];

async function checkQMAssignments() {
  console.log('🔍 Checking which of the 15 MGAs are in qm_mga_assignments...\n');
  console.log('='.repeat(80));
  
  try {
    const { data: allAssignments, error } = await supabase
      .from('qm_mga_assignments')
      .select('mga, rga, quality_manager');
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`📊 Total qm_mga_assignments: ${allAssignments.length}\n`);
    
    const found = [];
    const missing = [];
    
    for (const requestedName of requestedNames) {
      const normalized = requestedName.toUpperCase().trim();
      
      const match = allAssignments.find(a => {
        const mgaName = (a.mga || '').toUpperCase().trim();
        return mgaName === normalized || 
               mgaName.includes(normalized) || 
               normalized.includes(mgaName);
      });
      
      if (match) {
        found.push({
          name: requestedName,
          mga: match.mga,
          rga: match.rga,
          qm: match.quality_manager
        });
        console.log(`✅ ${requestedName}`);
        console.log(`   QM: ${match.quality_manager}`);
        console.log(`   RGA: ${match.rga}`);
      } else {
        missing.push(requestedName);
        console.log(`❌ ${requestedName} - NOT IN qm_mga_assignments`);
      }
      console.log();
    }
    
    console.log('='.repeat(80));
    console.log(`\n📊 SUMMARY:\n`);
    console.log(`✅ In qm_mga_assignments: ${found.length}/15`);
    console.log(`❌ Missing from qm_mga_assignments: ${missing.length}/15\n`);
    
    if (missing.length > 0) {
      console.log('❌ THESE MGAs NEED TO BE ADDED TO qm_mga_assignments:');
      missing.forEach((name, i) => console.log(`   ${i+1}. ${name}`));
      console.log('\n💡 This is why they are not showing in the MGA dropdown!\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkQMAssignments();






