const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkStorageBucket() {
  console.log('\n📦 CHECKING SUPABASE STORAGE BUCKET\n');
  console.log('============================================================');
  
  // List files in bucket
  const { data: files, error } = await supabase.storage
    .from('verify_agent_screenshot')
    .list('', {
      limit: 10,
      sortBy: { column: 'created_at', order: 'desc' }
    });
  
  if (error) {
    console.error('❌ Error accessing bucket:', error);
    console.error('   This means the bucket might not exist or is not accessible');
    return;
  }
  
  console.log(`✅ Bucket exists: verify_agent_screenshot`);
  console.log(`📸 Files in bucket: ${files.length} (showing first 10)\n`);
  
  if (files.length > 0) {
    console.log('Recent files:');
    for (const file of files) {
      const size = (file.metadata?.size / 1024).toFixed(1);
      const created = new Date(file.created_at).toLocaleString();
      console.log(`  - ${file.name}`);
      console.log(`    Size: ${size} KB, Created: ${created}`);
    }
  } else {
    console.log('⚠️  No files found in bucket!');
    console.log('   This means screenshots are NOT being uploaded to Supabase Storage');
  }
}

checkStorageBucket().catch(console.error);

