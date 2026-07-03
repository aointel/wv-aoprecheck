import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPresentations() {
  console.log('🔍 Checking for presentation sessions...\n');
  
  // Check presentation_sessions table
  const { data: sessions, error: sessionsError } = await supabase
    .from('presentation_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);
  
  if (sessionsError) {
    console.error('❌ Error fetching sessions:', sessionsError);
  } else {
    console.log(`📊 Found ${sessions?.length || 0} presentation sessions:`);
    sessions?.forEach(session => {
      console.log(`\n  ID: ${session.id}`);
      console.log(`  Agent: ${session.agent_email}`);
      console.log(`  Started: ${session.started_at}`);
      console.log(`  Status: ${session.status || 'unknown'}`);
      console.log(`  Type: ${session.presentation_type}`);
    });
  }
  
  console.log('\n---\n');
  
  // Check scraped_presentation_data table
  const { data: scrapedData, error: scrapedError } = await supabase
    .from('scraped_presentation_data')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (scrapedError) {
    console.error('❌ Error fetching scraped data:', scrapedError);
  } else {
    console.log(`📋 Found ${scrapedData?.length || 0} scraped data records:`);
    scrapedData?.forEach(data => {
      console.log(`\n  ID: ${data.id}`);
      console.log(`  Session: ${data.session_id}`);
      console.log(`  Timestamp: ${data.timestamp}`);
      console.log(`  URL: ${data.scraped_data?.url || 'N/A'}`);
    });
  }
  
  console.log('\n---\n');
  
  // Check presentation_screenshots table
  const { data: screenshots, error: screenshotsError } = await supabase
    .from('presentation_screenshots')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(10);
  
  if (screenshotsError) {
    console.error('❌ Error fetching screenshots:', screenshotsError);
  } else {
    console.log(`📸 Found ${screenshots?.length || 0} screenshots:`);
    screenshots?.forEach(shot => {
      console.log(`\n  ID: ${shot.id}`);
      console.log(`  Session: ${shot.session_id}`);
      console.log(`  Sequence: ${shot.sequence_number}`);
      console.log(`  Captured: ${shot.captured_at}`);
    });
  }
}

checkPresentations().catch(console.error);

