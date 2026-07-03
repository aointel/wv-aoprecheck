import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const sessionId = '595a226a-f136-46ab-94cd-6d43acb1c35d';

// Get all scraped data
const { data: scrapedData } = await supabase
  .from('scraped_presentation_data')
  .select('url, text_content, timestamp')
  .eq('session_id', sessionId)
  .order('timestamp', { ascending: true });

console.log(`\n📊 Total scraped data: ${scrapedData?.length || 0}`);

// Get unique URLs
const uniqueUrls = [...new Set(scrapedData?.map(d => d.url) || [])];
console.log(`\n🌐 Unique URLs visited: ${uniqueUrls.length}`);
uniqueUrls.forEach((url, i) => {
  console.log(`${i+1}. ${url}`);
});

// Check for client names in text
console.log('\n\n🔍 SEARCHING FOR CLIENT DATA...\n');

const clientDataPoints = scrapedData?.filter(d => {
  const text = d.text_content?.toLowerCase() || '';
  return text.includes('first name') || 
         text.includes('last name') ||
         text.includes('phone') ||
         text.includes('email') ||
         text.includes('client');
});

console.log(`Found ${clientDataPoints?.length || 0} data points with potential client info`);

if (clientDataPoints && clientDataPoints.length > 0) {
  console.log('\nSample:');
  clientDataPoints.slice(0, 3).forEach((d, i) => {
    console.log(`\n${i+1}. ${d.url}`);
    console.log(`   Text: ${d.text_content?.slice(0, 200)}...`);
  });
}

console.log('\n✅ Done');

