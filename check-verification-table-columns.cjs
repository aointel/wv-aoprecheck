const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkColumns() {
  console.log('🔍 Checking verification_sessions table columns...\n');
  
  try {
    const { data, error } = await supabase
      .from('verification_sessions')
      .select('*')
      .limit(1);
    
    if (data && data.length > 0) {
      console.log('✅ Table columns:');
      Object.keys(data[0]).forEach((col, i) => {
        console.log(`   ${i + 1}. ${col}`);
      });
      
      console.log('\n📊 Sample record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('⚠️  Table is empty');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkColumns();






