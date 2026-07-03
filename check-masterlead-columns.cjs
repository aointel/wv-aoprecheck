/**
 * Check what columns masterlead actually has
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkMasterleadColumns() {
  console.log('\n🔍 CHECKING MASTERLEAD TABLE COLUMNS\n');
  console.log('='.repeat(60));

  try {
    // Get a single lead to see all columns
    const { data: sample, error } = await supabase
      .from('masterlead')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (sample && sample.length > 0) {
      const lead = sample[0];
      const columns = Object.keys(lead).sort();
      
      console.log(`\n📋 Total Columns: ${columns.length}\n`);
      
      // Look for secret key related columns
      const secretKeyColumns = columns.filter(c => 
        c.toLowerCase().includes('secret') || 
        c.toLowerCase().includes('key')
      );
      
      if (secretKeyColumns.length > 0) {
        console.log(`🔑 SECRET KEY COLUMNS FOUND:\n`);
        secretKeyColumns.forEach(col => {
          console.log(`   ✅ ${col}: ${lead[col]}`);
        });
      } else {
        console.log(`❌ NO SECRET KEY COLUMNS FOUND!\n`);
      }
      
      console.log(`\n📋 All Columns:\n`);
      columns.forEach(col => {
        const value = lead[col];
        const preview = value ? String(value).substring(0, 50) : 'null';
        console.log(`   ${col}: ${preview}`);
      });
    } else {
      console.log('❌ No leads found in masterlead!');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkMasterleadColumns()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
