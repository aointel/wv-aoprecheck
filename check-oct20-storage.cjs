const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkOct20Storage() {
  console.log('\n📦 CHECKING SUPABASE STORAGE FOR OCT 20 FILES\n');
  
  const { data: files } = await supabase.storage
    .from('verify_agent_screenshot')
    .list('', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' }
    });
  
  const oct20Files = files?.filter(f => {
    if (!f.created_at || !f.name.startsWith('PRES-')) return false;
    const fileDate = new Date(f.created_at);
    const oct20Start = new Date('2025-10-20T00:00:00Z');
    const oct21Start = new Date('2025-10-21T00:00:00Z');
    return fileDate >= oct20Start && fileDate < oct21Start;
  });
  
  console.log(`Found ${oct20Files?.length || 0} PRES files from Oct 20\n`);
  
  if (oct20Files && oct20Files.length > 0) {
    console.log('Sample files:');
    for (let i = 0; i < Math.min(5, oct20Files.length); i++) {
      const f = oct20Files[i];
      console.log(`  ${new Date(f.created_at).toLocaleString()}: ${f.name}`);
    }
  }
}

checkOct20Storage().catch(console.error);

