import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Counting unique sessions with scraped data...\n');

// Get all scraped data session IDs
const { data: scrapedRecords } = await supabase
  .from('scraped_presentation_data')
  .select('session_id');

const uniqueScrapedSessions = [...new Set(scrapedRecords?.map(r => r.session_id))];

console.log(`📋 SCRAPED DATA:`);
console.log(`   Total records: ${scrapedRecords?.length}`);
console.log(`   Unique sessions: ${uniqueScrapedSessions.length}\n`);

// Get all screenshot session IDs
const { data: screenshots } = await supabase
  .from('presentation_screenshots')
  .select('session_id');

const uniqueScreenshotSessions = [...new Set(screenshots?.map(s => s.session_id))];

console.log(`📸 SCREENSHOTS:`);
console.log(`   Total screenshots: ${screenshots?.length}`);
console.log(`   Unique sessions: ${uniqueScreenshotSessions.length}\n`);

// Show the unique session IDs
console.log(`📊 UNIQUE SESSIONS WITH SCRAPED DATA (${uniqueScrapedSessions.length}):`);
uniqueScrapedSessions.forEach(id => {
  const count = scrapedRecords.filter(r => r.session_id === id).length;
  console.log(`   ${id} (${count} records)`);
});

console.log(`\n📊 UNIQUE SESSIONS WITH SCREENSHOTS (${uniqueScreenshotSessions.length}):`);
uniqueScreenshotSessions.forEach(id => {
  const count = screenshots.filter(s => s.session_id === id).length;
  console.log(`   ${id} (${count} screenshots)`);
});

// Check overlap
const hasData = new Set([...uniqueScrapedSessions, ...uniqueScreenshotSessions]);
console.log(`\n🎯 TOTAL UNIQUE SESSIONS WITH ANY DATA: ${hasData.size}`);

