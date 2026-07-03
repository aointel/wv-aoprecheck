import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Checking Dianka\'s sessions...\n');

const { data: sessions } = await supabase
  .from('presentation_sessions')
  .select('*')
  .eq('agent_email', 'diankablash@aoglobelife.com')
  .order('started_at', { ascending: false })
  .limit(2);

for (const session of sessions || []) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Session: ${session.id}`);
  console.log(`Started: ${session.started_at}`);
  console.log(`Electron ID: ${session.electron_session_id}`);
  console.log(`Duration: ${session.ended_at ? Math.floor((new Date(session.ended_at) - new Date(session.started_at)) / 1000) : 'N/A'}s`);

  // Check scraped data
  const { data: scraped, count: scrapedCount } = await supabase
    .from('scraped_presentation_data')
    .select('scraped_data', { count: 'exact' })
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });

  console.log(`\n📋 Scraped data: ${scrapedCount || 0} records`);
  
  if (scraped && scraped.length > 0) {
    // Show unique URLs visited
    const urls = [...new Set(scraped.map(s => s.scraped_data?.url))];
    console.log(`   URLs visited: ${urls.length} unique pages`);
    urls.forEach(url => console.log(`     - ${url}`));
    
    // Check for client data in text
    const allText = scraped.map(s => s.scraped_data?.textContent || '').join(' ');
    const hasPhonePattern = allText.match(/\d{3}-\d{3}-\d{4}/);
    const hasNamePattern = allText.match(/CLIENT NAME:/i);
    const hasDollarAmounts = allText.match(/\$[\d,]+\.?\d*/g);
    
    console.log(`\n   Patterns found in text:`);
    console.log(`     Phone numbers: ${hasPhonePattern ? 'YES' : 'NO'}`);
    console.log(`     "CLIENT NAME:": ${hasNamePattern ? 'YES' : 'NO'}`);
    console.log(`     Dollar amounts: ${hasDollarAmounts ? hasDollarAmounts.length : 0}`);
  }

  // Check screenshots
  const { count: screenshotCount } = await supabase
    .from('presentation_screenshots')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id);

  console.log(`\n📸 Screenshots: ${screenshotCount || 0}\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

