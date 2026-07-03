import { supabaseAdmin } from './supabase.js';

async function getRecordingUrls() {
  console.log('🎵 Getting recording URLs from Supabase...\n');
  
  // Get 10 sessions that have downloaded recordings
  const { data: sessions, error } = await supabaseAdmin
    .from('verification_sessions')
    .select('id, session_id, first_name, last_name, taalk_call_url')
    .like('taalk_call_url', 'recordings/%')
    .limit(10);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`Found ${sessions.length} sessions with downloaded recordings:\n`);
  
  for (const session of sessions) {
    // Generate 2-year signed URL
    const { data, error: urlError } = await supabaseAdmin.storage
      .from('verify_agent_screenshot')
      .createSignedUrl(session.taalk_call_url, 63072000); // 2 years
    
    if (!urlError && data?.signedUrl) {
      console.log(`✅ Session ${session.id} - ${session.first_name} ${session.last_name}`);
      console.log(`   Storage Path: ${session.taalk_call_url}`);
      console.log(`   2-YEAR URL: ${data.signedUrl}\n`);
    }
  }
  
  process.exit(0);
}

getRecordingUrls();

