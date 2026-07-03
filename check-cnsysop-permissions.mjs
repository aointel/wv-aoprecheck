import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

console.log('\n🔍 CHECKING CNSYSOP PERMISSIONS...\n');

const { data: permissions, error } = await supabase
  .from('user_permissions')
  .select('*')
  .eq('user_email', 'cnsysop@aoglobelife.com')
  .single();

if (error) {
  console.error('❌ Error:', error.message);
  if (error.message.includes('0 rows')) {
    console.log('\n⚠️  NO PERMISSIONS RECORD FOR CNSYSOP!');
    console.log('   This means they have no role assigned.');
  }
} else {
  console.log('✅ Found permissions:');
  console.log(JSON.stringify(permissions, null, 2));
}

