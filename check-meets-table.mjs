import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 CHECKING IF MEETS TABLE EXISTS...\n');

try {
  // Try to query the meets table
  const { data, error } = await supabase
    .from('meets')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ ERROR:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\n🚨 MEETS TABLE DOES NOT EXIST!');
      console.log('   You need to run: create-meets-table.sql in Supabase');
    }
  } else {
    console.log('✅ MEETS TABLE EXISTS!');
    console.log('   Query result:', data);
  }
} catch (e) {
  console.error('❌ Exception:', e);
}

