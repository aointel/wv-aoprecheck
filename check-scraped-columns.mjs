import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const sessionId = '595a226a-f136-46ab-94cd-6d43acb1c35d';

console.log('\n🔍 CHECKING SCRAPED DATA TABLE STRUCTURE...\n');

// Get sample with all columns
const { data, error } = await supabase
  .from('scraped_presentation_data')
  .select('*')
  .eq('session_id', sessionId)
  .limit(5);

console.log('Error:', error);
console.log('Rows returned:', data?.length || 0);

if (data && data.length > 0) {
  console.log('\nColumn names:', Object.keys(data[0]));
  console.log('\nSample row 1:');
  console.log(JSON.stringify(data[0], null, 2));
}

console.log('\n✅ Done');

