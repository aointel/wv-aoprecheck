const { createClient } = require('@supabase/supabase-js');

// Hardcoded Supabase credentials
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Names to check (case-insensitive)
const namesToCheck = [
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

async function checkMgaNames() {
  console.log('🔍 Checking which MGA names are in mga_rga_directory...\n');
  
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
    
    console.log(`📊 Found ${allMgas.length} total MGAs in directory\n`);
    
    // Normalize names for comparison (uppercase, trim)
    const normalizedDirectoryNames = new Map();
    allMgas.forEach(mga => {
      const normalized = mga.name.toUpperCase().trim();
      normalizedDirectoryNames.set(normalized, mga);
    });
    
    // Check each requested name
    console.log('✅ CHECKING REQUESTED NAMES:\n');
    console.log('='.repeat(80));
    
    const found = [];
    const missing = [];
    
    namesToCheck.forEach(requestedName => {
      const normalized = requestedName.toUpperCase().trim();
      
      // Try exact match first
      let match = normalizedDirectoryNames.get(normalized);
      
      // If no exact match, try partial match
      if (!match) {
        for (const [dirName, dirData] of normalizedDirectoryNames.entries()) {
          // Check if requested name contains key parts of directory name or vice versa
          const requestedParts = normalized.split(/\s+/);
          const dirParts = dirName.split(/\s+/);
          
          // Check if last name matches and first name matches
          const requestedLastName = requestedParts[requestedParts.length - 1];
          const dirLastName = dirParts[dirParts.length - 1];
          
          if (requestedLastName === dirLastName) {
            // Last names match, check if first name is similar
            const requestedFirstName = requestedParts[0];
            const dirFirstName = dirParts[0];
            
            if (requestedFirstName === dirFirstName || 
                requestedFirstName.startsWith(dirFirstName) || 
                dirFirstName.startsWith(requestedFirstName)) {
              match = dirData;
              break;
            }
          }
        }
      }
      
      if (match) {
        found.push({
          requested: requestedName,
          found: match.name,
          associate_id: match.associate_id,
          role: match.role,
          email: match.email
        });
        console.log(`✅ FOUND: "${requestedName}"`);
        console.log(`   → Directory name: "${match.name}"`);
        console.log(`   → Associate ID: ${match.associate_id}`);
        console.log(`   → Role: ${match.role}`);
        console.log(`   → Email: ${match.email || 'N/A'}\n`);
      } else {
        missing.push(requestedName);
        console.log(`❌ MISSING: "${requestedName}"\n`);
      }
    });
    
    console.log('='.repeat(80));
    console.log(`\n📊 SUMMARY:\n`);
    console.log(`✅ Found: ${found.length}/${namesToCheck.length}`);
    console.log(`❌ Missing: ${missing.length}/${namesToCheck.length}\n`);
    
    if (missing.length > 0) {
      console.log('❌ MISSING NAMES:');
      missing.forEach(name => console.log(`   - ${name}`));
      console.log('\n💡 These names need to be added to mga_rga_directory table.');
      console.log('   They should exist in the Producer List CSV and be populated via populate-mga-rga-directory.cjs\n');
    }
    
    if (found.length > 0) {
      console.log('\n✅ FOUND NAMES:');
      found.forEach(({ requested, found: foundName, associate_id }) => {
        console.log(`   - ${requested} → ${foundName} (ID: ${associate_id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMgaNames();






