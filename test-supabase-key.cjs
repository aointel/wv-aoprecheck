const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

async function test() {
  console.log('Testing Supabase connection...');
  console.log('URL:', SUPABASE_URL);
  console.log('Key:', SUPABASE_SERVICE_KEY.substring(0, 50) + '...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const { data, error } = await supabase
    .from('producerlist')
    .select('associate_id, agent_name')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Success! Data:', data);
  }
}

test().then(() => process.exit(0));

