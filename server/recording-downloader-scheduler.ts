import { supabaseAdmin } from './supabase.js';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function downloadNewRecordings() {
  console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Recording Downloader: Checking for new recordings...`);
  
  try {
    // Get all sessions with taalk_call_id but no stored recording (any status)
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, taalk_call_url, recording_url, status')
      .not('taalk_call_id', 'is', null)
      .or('recording_url.is.null,recording_url.eq.,recording_url.eq.PENDING,recording_url.eq.PROCESSING,recording_url.like.%api.taalk.ai%')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .limit(100);
    
    if (error) {
      console.error('❌ Recording Downloader: Database query error:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ Recording Downloader: No new recordings to download');
      return;
    }
    
    console.log(`📥 Recording Downloader: Found ${sessions.length} sessions to download`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        
        // Try to download recording from Taalk
        let response = await fetch(taalkRecordingUrl, {
          headers: {
            'Authorization': `Bearer ${TAALK_API_KEY}`,
            'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
          }
        });
        
        // Try basic auth if bearer fails
        if (!response.ok) {
          const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
          response = await fetch(taalkRecordingUrl, {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Accept': 'audio/mpeg'
            }
          });
        }
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Upload to Supabase Storage
          const fileName = `recordings/${callId}.mp3`;
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .upload(fileName, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
          
          if (uploadError) {
            console.error(`  ❌ Recording Downloader: Upload failed for ${session.session_id}:`, uploadError.message);
            failCount++;
            continue;
          }
          
          // Generate 2-year signed URL
          const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(fileName, 63072000); // 2 years in seconds
          
          const signedUrl = signedData?.signedUrl || null;
          
          // Store both the path and the signed URL
          await supabaseAdmin
            .from('verification_sessions')
            .update({ 
              taalk_call_url: fileName, // Store Supabase storage path
              recording_url: signedUrl, // Store 2-year signed URL
              taalk_call_status: 'completed',
              taalk_call_completed_at: new Date().toISOString()
            })
            .eq('id', session.id);
          
          console.log(`  ✅ Recording Downloader: Downloaded ${session.session_id} (${Math.round(buffer.length / 1024)}KB)`);
          successCount++;
        } else {
          console.log(`  ⚠️ Recording Downloader: Taalk returned ${response.status} for ${session.session_id}`);
          failCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`  ❌ Recording Downloader: Error processing ${session.session_id}:`, error.message);
        failCount++;
      }
    }
    
    if (successCount > 0 || failCount > 0) {
      console.log(`📊 Recording Downloader Summary: ✅ ${successCount} downloaded, ❌ ${failCount} failed`);
    }
    
  } catch (error) {
    console.error('❌ Recording Downloader: Fatal error:', error);
  }
}

// Export scheduler with start method for index.ts
export const recordingDownloaderScheduler = {
  start: () => {
    console.log('🎵 Recording Downloader Scheduler Started');
    console.log('⏰ Downloading new PreCheck recordings every 5 minutes');
    
    // Run immediately on startup
    downloadNewRecordings();
    
    // Schedule to run every 5 minutes (300000ms)
    setInterval(() => {
      downloadNewRecordings();
    }, 5 * 60 * 1000);
  }
};

