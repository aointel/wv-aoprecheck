import { supabaseAdmin } from './supabase.js';

async function populateAllRecordingUrls() {
  console.log('🔑 Populating recording_url for ALL sessions with Supabase MP3s...\n');
  
  try {
    // Get ALL sessions that have recordings stored in Supabase (path starts with "recordings/")
    // NO PAGINATION - fetch everything
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, taalk_call_url, recording_url, first_name, last_name')
      .like('taalk_call_url', 'recordings/%')
      .order('id', { ascending: false })
      .limit(10000); // Set explicit high limit to bypass Supabase default
    
    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }
    
    console.log(`Found ${sessions.length} sessions with Supabase recordings\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const session of sessions) {
      try {
        console.log(`📞 Session ${session.id} - ${session.first_name} ${session.last_name}`);
        console.log(`   Storage path: ${session.taalk_call_url}`);
        
        // Generate 2-year signed URL
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .createSignedUrl(session.taalk_call_url, 63072000); // 2 years
        
        if (signedError || !signedData?.signedUrl) {
          console.error(`   ❌ Failed to generate signed URL:`, signedError);
          failCount++;
          continue;
        }
        
        console.log(`   🔑 Generated URL: ${signedData.signedUrl.substring(0, 100)}...`);
        
        // Update recording_url column with FULL Supabase signed URL
        const { error: updateError } = await supabaseAdmin
          .from('verification_sessions')
          .update({ recording_url: signedData.signedUrl })
          .eq('id', session.id);
        
        if (updateError) {
          console.error(`   ❌ Database update error:`, updateError);
          failCount++;
          continue;
        }
        
        console.log(`   ✅ Updated recording_url\n`);
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`   ❌ Error processing session ${session.id}:`, error);
        failCount++;
      }
    }
    
    console.log('='.repeat(80));
    console.log(`✅ Success: ${successCount}`);
    console.log(`⏭️ Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

populateAllRecordingUrls();

