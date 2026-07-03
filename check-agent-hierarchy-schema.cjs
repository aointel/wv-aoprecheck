const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSchema() {
  try {
    const { data, error } = await supabase
      .from('agent_hierarchy')
      .select('*')
      .limit(1);
    
    if (data && data.length > 0) {
      console.log('agent_hierarchy columns:', Object.keys(data[0]));
      console.log('\nSample record:');
      console.log(data[0]);
    } else {
      console.log('Table is empty');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();






