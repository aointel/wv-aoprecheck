import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const sessionId = '595a226a-f136-46ab-94cd-6d43acb1c35d';

console.log('\n🔍 TESTING DIFFERENT QUERY METHODS...\n');

// Method 1: Count only
const { count: count1, error: error1 } = await supabase
  .from('scraped_presentation_data')
  .select('*', { count: 'exact', head: true })
  .eq('session_id', sessionId);

console.log('Method 1 (count only):', count1, error1);

// Method 2: Select with range
const { data: data2, error: error2, count: count2 } = await supabase
  .from('scraped_presentation_data')
  .select('url', { count: 'exact' })
  .eq('session_id', sessionId)
  .range(0, 9);

console.log('Method 2 (range 0-9):', data2?.length, 'rows, count:', count2, error2);
if (data2) {
  data2.forEach((d, i) => console.log(`  ${i+1}. ${d.url}`));
}

// Method 3: Limit 1000
const { data: data3, error: error3 } = await supabase
  .from('scraped_presentation_data')
  .select('url, timestamp')
  .eq('session_id', sessionId)
  .limit(1000);

console.log('\nMethod 3 (limit 1000):', data3?.length, 'rows', error3);

console.log('\n✅ Done');

