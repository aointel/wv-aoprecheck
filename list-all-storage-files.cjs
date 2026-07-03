const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function listAllFiles() {
  console.log('\n📦 LISTING ALL PRES FILES IN STORAGE\n');
  
  let allFiles = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const { data: files } = await supabase.storage
      .from('verify_agent_screenshot')
      .list('', {
        limit: limit,
        offset: offset,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (!files || files.length === 0) break;
    
    allFiles = allFiles.concat(files.filter(f => f.name.startsWith('PRES-')));
    offset += limit;
    
    if (files.length < limit) break;
  }
  
  console.log(`Total PRES files: ${allFiles.length}\n`);
  
  // Group by date
  const byDate = {};
  for (const file of allFiles) {
    if (!file.created_at) continue;
    const date = new Date(file.created_at).toLocaleDateString();
    byDate[date] = (byDate[date] || 0) + 1;
  }
  
  console.log('Files by date:');
  for (const [date, count] of Object.entries(byDate).sort()) {
    console.log(`  ${date}: ${count} files`);
  }
  
  console.log('\nFirst 10 PRES files:');
  for (let i = 0; i < Math.min(10, allFiles.length); i++) {
    const f = allFiles[i];
    console.log(`  ${new Date(f.created_at).toLocaleString()}: ${f.name}`);
  }
}

listAllFiles().catch(console.error);

