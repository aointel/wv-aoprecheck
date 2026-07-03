import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const electronId = 'session_1761450648520_v9c799qvv';
const uuidId = '595a226a-f136-46ab-94cd-6d43acb1c35d';

console.log('\n🔍 CHECKING SCRAPED DATA FOR DIANKA SESSION...\n');

// Check with electron ID
const { count: electronCount } = await supabase
  .from('scraped_presentation_data')
  .select('*', { count: 'exact', head: true })
  .eq('session_id', electronId);

console.log(`📊 Scraped data with electron ID (${electronId}):`, electronCount);

// Check with UUID
const { count: uuidCount } = await supabase
  .from('scraped_presentation_data')
  .select('*', { count: 'exact', head: true })
  .eq('session_id', uuidId);

console.log(`📊 Scraped data with UUID (${uuidId}):`, uuidCount);

// Get samples
const { data: samples } = await supabase
  .from('scraped_presentation_data')
  .select('url, text_content, timestamp')
  .eq('session_id', electronId)
  .order('timestamp', { ascending: false })
  .limit(10);

console.log('\n🔍 LAST 10 SCRAPED URLS:');
samples?.forEach((d, i) => {
  console.log(`\n${i+1}. ${d.url}`);
  console.log(`   Time: ${d.timestamp}`);
  const text = d.text_content?.slice(0, 150).replace(/\n/g, ' ');
  if (text) console.log(`   Text: ${text}...`);
});

console.log('\n✅ Done');

