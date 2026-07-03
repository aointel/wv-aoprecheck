import { supabaseAdmin } from './supabase';

/**
 * Downloads all Taalk recordings and stores them in object storage
 * Fixes sessions where recordings are missing due to webhook issues
 */
async function downloadAllRecordings() {
  try {
    console.log('🎵 Starting bulk recording download from Supabase...');
    
    if (!supabaseAdmin) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    // Get COMPLETED sessions older than 10 minutes (Taalk needs processing time)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, taalk_call_url, status, created_at')
      .not('taalk_call_id', 'is', null)
      .or('taalk_call_url.is.null,taalk_call_url.eq.,taalk_call_url.like.http%') // Include HTTP URLs (old signed URLs that expired)
      .eq('status', 'completed')
      .lt('created_at', tenMinutesAgo) // Only sessions older than 10 min
      .limit(100);
    
    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions need recording downloads (all recordings already stored)');
      return;
    }
    
    console.log(`📊 Found ${sessions.length} completed sessions without stored recordings - downloading now...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id || session.session_id;
        const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
        
        console.log(`🎵 [${session.session_id}] taalk_call_id: ${session.taalk_call_id}, URL: ${taalkUrl}`);
        
        const response = await fetch(taalkUrl, {
          headers: {
            'Authorization': `Bearer ${taalkApiKey}`,
            'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
          }
        });
        
        if (!response.ok) {
          // Try basic auth fallback
          const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
          const fallbackResponse = await fetch(taalkUrl, {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
            }
          });
          
          if (!fallbackResponse.ok) {
            console.error(`❌ Failed to download ${session.session_id}: ${response.status}`);
            failCount++;
            continue;
          }
          
          // Use fallback response
          const arrayBuffer = await fallbackResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Upload to Supabase Storage using native API
          const fileName = `recordings/${callId}.mp3`;
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .upload(fileName, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
          
          if (uploadError) {
            console.error(`❌ Supabase Storage upload failed:`, uploadError);
            failCount++;
            continue;
          }
          
          // Update session with storage path (we'll generate signed URLs on-demand)
          await supabaseAdmin
            .from('verification_sessions')
            .update({ taalk_call_url: fileName }) // Store path, not URL
            .eq('id', session.id);
          
          console.log(`✅ Stored recording for ${session.session_id} at ${fileName} (${buffer.length} bytes)`);
          successCount++;
        } else {
          // Primary auth worked
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Upload to Supabase Storage using native API
          const fileName = `recordings/${callId}.mp3`;
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .upload(fileName, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
          
          if (uploadError) {
            console.error(`❌ Supabase Storage upload failed:`, uploadError);
            failCount++;
            continue;
          }
          
          // Update session with storage path (we'll generate signed URLs on-demand)
          await supabaseAdmin
            .from('verification_sessions')
            .update({ taalk_call_url: fileName }) // Store path, not URL
            .eq('id', session.id);
          
          console.log(`✅ Stored recording for ${session.session_id} at ${fileName} (${buffer.length} bytes)`);
          successCount++;
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing ${session.session_id}:`, error);
        failCount++;
      }
    }
    
    console.log(`\n📊 Download Summary:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📦 Total: ${sessions.length}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run if called directly (handle both Unix and Windows paths)
const normalizedMetaUrl = import.meta.url.toLowerCase().replace(/\\/g, '/');
const normalizedArgv = `file:///${process.argv[1]}`.toLowerCase().replace(/\\/g, '/');
const isMainModule = normalizedMetaUrl === normalizedArgv || normalizedMetaUrl.endsWith('download-recordings.ts');

console.log('📋 Running download-recordings script...');

if (isMainModule) {
  downloadAllRecordings().then(() => {
    console.log('✅ Script complete');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { downloadAllRecordings };
