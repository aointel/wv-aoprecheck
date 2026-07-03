import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sessionId = 'session_1761440606476_lsdsbql0l'; // The one that worked

console.log(`🔍 Inspecting scraped data for: ${sessionId}\n`);

const { data: records } = await supabase
  .from('scraped_presentation_data')
  .select('*')
  .eq('session_id', sessionId)
  .order('created_at', { ascending: true })
  .limit(5);

console.log(`📊 Found ${records?.length} records. Showing first 5:\n`);

records?.forEach((record, i) => {
  console.log(`\n[${i + 1}] ${record.created_at}`);
  console.log(`    URL: ${record.scraped_data?.url}`);
  console.log(`    Title: ${record.scraped_data?.title}`);
  console.log(`    Text (first 200 chars): ${record.scraped_data?.textContent?.substring(0, 200)}`);
  console.log(`    Forms: ${record.scraped_data?.forms?.length || 0}`);
  
  if (record.scraped_data?.forms && record.scraped_data.forms.length > 0) {
    console.log(`    Form fields:`);
    record.scraped_data.forms[0]?.fields?.slice(0, 5).forEach(field => {
      console.log(`      - ${field.name}: "${field.value}"`);
    });
  }
  
  console.log(`    Headings: ${record.scraped_data?.headings?.map(h => h.text).join(', ')}`);
});

console.log(`\n\n💡 This is the data the AI sees. If names/premiums are here, AI should extract them.`);
console.log(`   If data is missing, we need to improve the Electron scraper.`);

