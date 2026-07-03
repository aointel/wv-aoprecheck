const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTableStructure() {
  console.log('🔍 Checking qm_mga_assignments table structure...\n');
  
  try {
    // Try to get first row to see column names
    const { data, error } = await supabase
      .from('qm_mga_assignments')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ Table exists! Sample data:');
      console.log('Columns:', Object.keys(data[0]));
      console.log('\nFirst few rows:');
      console.table(data);
    } else {
      console.log('⚠️  Table exists but is empty');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTableStructure();






