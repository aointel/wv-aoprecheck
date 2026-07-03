const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function fixTable() {
  console.log('🔧 Adding file_path column to presentation_screenshots table...');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE presentation_screenshots 
      ADD COLUMN IF NOT EXISTS file_path TEXT;
    `
  });
  
  if (error) {
    console.error('❌ Error:', error);
    
    // Try direct SQL if RPC doesn't work
    console.log('🔧 Trying direct query...');
    const { error: error2 } = await supabase
      .from('presentation_screenshots')
      .select('file_path')
      .limit(1);
    
    if (error2 && error2.message.includes('file_path')) {
      console.log('✅ Column confirmed missing - needs manual addition via Supabase dashboard');
      console.log('\n📋 Run this SQL in Supabase SQL Editor:');
      console.log('ALTER TABLE presentation_screenshots ADD COLUMN IF NOT EXISTS file_path TEXT;');
    }
  } else {
    console.log('✅ Column added successfully!');
  }
}

fixTable().catch(console.error);

