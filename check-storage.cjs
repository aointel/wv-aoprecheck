const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0',
  { global: { fetch } }
);

(async () => {
  const fileName = 'PRES-session_1761156940902_9tfsj0d4m-1761157558384.png';
  
  console.log(`🔍 Checking for file: ${fileName}\n`);
  
  // List files in verify_agent_screenshot bucket
  const { data: files, error } = await supabase.storage
    .from('verify_agent_screenshot')
    .list('', {
      search: 'PRES-session_1761156940902_9tfsj0d4m'
    });
  
  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }
  
  console.log(`📁 Files found: ${files?.length || 0}`);
  if (files && files.length > 0) {
    files.forEach(f => {
      console.log(`  - ${f.name} (${(f.metadata?.size / 1024).toFixed(0)} KB)`);
    });
  }
})();

