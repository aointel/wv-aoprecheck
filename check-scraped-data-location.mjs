import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Checking where scraped data is stored...\n');

// 1. Check scraped_presentation_data table
const { data: scrapedData, error: scrapedError } = await supabase
  .from('scraped_presentation_data')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(3);

console.log('📋 TABLE: scraped_presentation_data');
console.log(`   Records: ${scrapedData?.length || 0}`);
if (scrapedData && scrapedData.length > 0) {
  const latest = scrapedData[0];
  console.log(`\n   Latest record:`);
  console.log(`   - ID: ${latest.id}`);
  console.log(`   - Session ID: ${latest.session_id}`);
  console.log(`   - Created: ${latest.created_at}`);
  console.log(`   - URL: ${latest.scraped_data?.url}`);
  console.log(`   - Title: ${latest.scraped_data?.title}`);
  console.log(`   - Forms: ${latest.scraped_data?.forms?.length || 0}`);
  console.log(`   - Text length: ${latest.scraped_data?.textContent?.length || 0} chars`);
}

console.log('\n---\n');

// 2. Check presentation_analysis table (AI results)
const { data: analysisData, error: analysisError } = await supabase
  .from('presentation_analysis')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(3);

console.log('📋 TABLE: presentation_analysis (AI extraction results)');
console.log(`   Records: ${analysisData?.length || 0}`);
if (analysisData && analysisData.length > 0) {
  const latest = analysisData[0];
  console.log(`\n   Latest analysis:`);
  console.log(`   - ID: ${latest.id}`);
  console.log(`   - Session ID: ${latest.session_id}`);
  console.log(`   - Created: ${latest.created_at}`);
  console.log(`   - Data points analyzed: ${latest.data_points_analyzed}`);
  console.log(`   - Client info: ${JSON.stringify(latest.analysis?.clientInfo)?.substring(0, 100)}`);
  console.log(`   - Disposition: ${latest.analysis?.disposition}`);
  console.log(`   - Furthest milestone: ${latest.analysis?.furthestMilestone}`);
}

console.log('\n---\n');

// 3. Check if it's in presentation_sessions
const { data: sessions, error: sessionsError } = await supabase
  .from('presentation_sessions')
  .select('id, agent_email, started_at, client_data, current_phase, ai_summary')
  .order('started_at', { ascending: false })
  .limit(3);

console.log('📋 TABLE: presentation_sessions (main session data)');
console.log(`   Records: ${sessions?.length || 0}`);
if (sessions && sessions.length > 0) {
  const latest = sessions[0];
  console.log(`\n   Latest session:`);
  console.log(`   - ID: ${latest.id}`);
  console.log(`   - Agent: ${latest.agent_email}`);
  console.log(`   - Started: ${latest.started_at}`);
  console.log(`   - Has client_data: ${!!latest.client_data}`);
  console.log(`   - Has current_phase: ${!!latest.current_phase}`);
  console.log(`   - Has ai_summary: ${!!latest.ai_summary}`);
  if (latest.client_data) {
    console.log(`   - Client data: ${JSON.stringify(latest.client_data)?.substring(0, 150)}`);
  }
}

console.log('\n\n📊 SUMMARY:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. Raw scraped data → scraped_presentation_data table');
console.log('2. AI analyzes scraped data → presentation_analysis table');
console.log('3. AI results copied to → presentation_sessions.client_data');
console.log('4. Displayed on → /dashboard/presentation-review');
console.log('                 /dashboard/presentation-analytics');
console.log('                 /dashboard/live-presentations');

