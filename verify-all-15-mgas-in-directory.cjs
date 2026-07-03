const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// All 15 requested names
const requestedNames = [
  'Joseph Tomanovich',
  'Maria Lagios',
  'George Oshea',
  'Allissa Collins',
  'Jennifer Jantzen',
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

async function verifyAllMGAs() {
  console.log('🔍 Checking ALL 15 requested MGAs in mga_rga_directory...\n');
  console.log('='.repeat(80));
  
  try {
    // Get all MGAs from directory
    const { data: allMgas, error } = await supabase
      .from('mga_rga_directory')
      .select('associate_id, name, role, email')
      .or('role.eq.MGA,role.eq.BOTH')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching MGAs:', error);
      return;
    }
    
    console.log(`📊 Total MGAs in directory: ${allMgas.length}\n`);
    
    const found = [];
    const missing = [];
    
    // Check each requested name
    for (const requestedName of requestedNames) {
      const normalized = requestedName.toUpperCase().trim();
      
      // Try to find in directory
      const match = allMgas.find(mga => {
        const mgaName = mga.name.toUpperCase().trim();
        
        // Exact match
        if (mgaName === normalized) return true;
        
        // Check last name + first name match
        const requestedParts = normalized.split(/\s+/);
        const mgaParts = mgaName.split(/\s+/);
        
        if (requestedParts.length >= 2 && mgaParts.length >= 2) {
          const requestedLast = requestedParts[requestedParts.length - 1];
          const mgaLast = mgaParts[mgaParts.length - 1];
          const requestedFirst = requestedParts[0];
          const mgaFirst = mgaParts[0];
          
          if (requestedLast === mgaLast && 
              (requestedFirst === mgaFirst || 
               requestedFirst.startsWith(mgaFirst) || 
               mgaFirst.startsWith(requestedFirst))) {
            return true;
          }
        }
        
        return false;
      });
      
      if (match) {
        found.push({
          requested: requestedName,
          found: match.name,
          associate_id: match.associate_id,
          role: match.role,
          email: match.email
        });
        console.log(`✅ FOUND: "${requestedName}"`);
        console.log(`   Directory: "${match.name}" (ID: ${match.associate_id}, Role: ${match.role})`);
      } else {
        missing.push(requestedName);
        console.log(`❌ MISSING: "${requestedName}"`);
      }
      console.log();
    }
    
    console.log('='.repeat(80));
    console.log(`\n📊 FINAL COUNT:\n`);
    console.log(`✅ Found: ${found.length}/15`);
    console.log(`❌ Missing: ${missing.length}/15\n`);
    
    if (missing.length > 0) {
      console.log('❌ MISSING MGAs:');
      missing.forEach((name, i) => console.log(`   ${i+1}. ${name}`));
      console.log();
    }
    
    if (found.length > 0) {
      console.log('✅ FOUND MGAs:');
      found.forEach(({ requested, found: foundName, associate_id }, i) => {
        console.log(`   ${i+1}. ${requested} → ${foundName} (ID: ${associate_id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyAllMGAs();






