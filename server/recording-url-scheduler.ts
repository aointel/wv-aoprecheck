import { supabaseAdmin } from './supabase.js';

async function populateRecordingUrls() {
  console.log(`\n🔑 [${new Date().toLocaleTimeString()}] Populating missing recording URLs...`);
  
  try {
    // Get all sessions with Supabase recordings but no recording_url
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, taalk_call_url, recording_url, first_name, last_name')
      .like('taalk_call_url', 'recordings/%')
      .or('recording_url.is.null,recording_url.eq.')
      .limit(200);
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ All recording URLs are up to date');
      return;
    }
    
    console.log(`📥 Found ${sessions.length} sessions needing recording URLs`);
    
    let successCount = 0;
    
    for (const session of sessions) {
      try {
        // Generate 2-year signed URL
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .createSignedUrl(session.taalk_call_url, 63072000); // 2 years
        
        if (signedError || !signedData?.signedUrl) {
          console.error(`  ❌ Failed to generate URL for session ${session.id}`);
          continue;
        }
        
        // Update recording_url
        await supabaseAdmin
          .from('verification_sessions')
          .update({ recording_url: signedData.signedUrl })
          .eq('id', session.id);
        
        successCount++;
        
      } catch (error: any) {
        console.error(`  ❌ Error processing session ${session.id}:`, error.message);
      }
    }
    
    console.log(`✅ Updated ${successCount} recording URLs`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run immediately on startup
console.log('🔑 Recording URL Scheduler Started');
populateRecordingUrls();

// Run every 10 minutes
setInterval(populateRecordingUrls, 600000); // 10 minutes
