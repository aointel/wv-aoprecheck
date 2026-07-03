import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sessionId = 'session_1761450648520_v9c799qvv'; // Dianka - 880 points!

console.log(`🔍 Checking big session: ${sessionId} (880 data points)\n`);

const { data: records } = await supabase
  .from('scraped_presentation_data')
  .select('*')
  .eq('session_id', sessionId)
  .order('created_at', { ascending: true });

console.log(`📊 Total records: ${records?.length}\n`);

// Show sample records with actual content
console.log('Sample data points:\n');

[0, Math.floor(records.length / 2), records.length - 1].forEach(i => {
  const record = records[i];
  console.log(`[${i + 1}/${records.length}] ${record.created_at}`);
  console.log(`  URL: ${record.scraped_data?.url}`);
  console.log(`  Text: ${record.scraped_data?.textContent?.substring(0, 300)}`);
  console.log(`  Forms: ${record.scraped_data?.forms?.length}`);
  if (record.scraped_data?.forms?.length > 0) {
    console.log(`  Form 1 fields: ${record.scraped_data.forms[0].fields?.length}`);
  }
  console.log('');
});

// Check URL distribution
const urls = {};
records?.forEach(r => {
  const url = r.scraped_data?.url || 'unknown';
  urls[url] = (urls[url] || 0) + 1;
});

console.log('📍 URL distribution:');
Object.entries(urls).sort((a, b) => b[1] - a[1]).forEach(([url, count]) => {
  console.log(`  ${count}x - ${url}`);
});

