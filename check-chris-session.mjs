import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sessionId = '0a806b6a-228c-46b5-9628-53b0d919d79b'; // Chris's session

console.log('🔍 Checking Chris LaFond\'s session...\n');
console.log(`Session ID: ${sessionId}`);
console.log(`Duration: 2223 seconds (37 minutes)\n`);

// Check for scraped data
const { data: scrapedData, count: scrapedCount } = await supabase
  .from('scraped_presentation_data')
  .select('*', { count: 'exact' })
  .eq('session_id', sessionId);

console.log(`📋 SCRAPED DATA: ${scrapedCount || 0} records`);

if (scrapedData && scrapedData.length > 0) {
  console.log('\nSample records:');
  scrapedData.slice(0, 3).forEach((record, i) => {
    console.log(`  [${i + 1}] ${record.created_at}`);
    console.log(`      URL: ${record.scraped_data?.url}`);
    console.log(`      Text: ${record.scraped_data?.textContent?.substring(0, 100)}`);
  });
}

// Check for screenshots
const { data: screenshots, count: screenshotCount } = await supabase
  .from('presentation_screenshots')
  .select('*', { count: 'exact' })
  .eq('session_id', sessionId);

console.log(`\n📸 SCREENSHOTS: ${screenshotCount || 0} screenshots`);

if (screenshots && screenshots.length > 0) {
  console.log(`\nScreenshot sequences: ${screenshots.map(s => s.sequence_number).join(', ')}`);
}

// Check electron_session_id
const { data: session } = await supabase
  .from('presentation_sessions')
  .select('electron_session_id')
  .eq('id', sessionId)
  .single();

console.log(`\n📱 Electron Session ID: ${session?.electron_session_id || 'NULL'}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('RESULT:');
if (scrapedCount === 0 && screenshotCount === 0) {
  console.log('❌ NO DATA - Session was created but no scraping or screenshots happened');
  console.log('   Likely: HPPRO was never opened, or scraping failed');
} else {
  console.log(`✅ HAS DATA - ${scrapedCount} scraped + ${screenshotCount} screenshots`);
  console.log('   Can be analyzed!');
}

