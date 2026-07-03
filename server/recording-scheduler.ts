import { supabaseAdmin } from './supabase.js';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function downloadNewRecordings() {
  console.log(`\n🔄 [${new Date().toLocaleTimeString()}] Checking for new recordings...`);
  
  try {
    // CRITICAL: Process ALL PENDING recordings regardless of age
    // Also process recent recordings with null/empty recording_url
    // Prioritize PENDING recordings first, then recent null/empty ones
    
    // First, get ALL PENDING recordings (no date limit - these MUST be fixed)
    const { data: pendingSessions, error: pendingError } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, taalk_call_url, recording_url, status')
      .not('taalk_call_id', 'is', null)
      .eq('recording_url', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(200); // Process up to 200 PENDING recordings per run
    
    // Then get recent recordings with null/empty recording_url (last 30 days)
    const { data: recentSessions, error: recentError } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, taalk_call_url, recording_url, status')
      .not('taalk_call_id', 'is', null)
      .or('recording_url.is.null,recording_url.eq.')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .limit(100);
    
    if (pendingError) {
      console.error('❌ Database query error (pending):', pendingError);
    }
    if (recentError) {
      console.error('❌ Database query error (recent):', recentError);
    }
    
    // Combine sessions, prioritizing PENDING ones
    const sessions = [
      ...(pendingSessions || []),
      ...(recentSessions || []).filter(s => !pendingSessions?.some(p => p.id === s.id))
    ];
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No new recordings to download');
      return;
    }
    
    const pendingCount = pendingSessions?.length || 0;
    const recentCount = recentSessions?.length || 0;
    console.log(`📥 Found ${sessions.length} sessions to process (${pendingCount} PENDING, ${recentCount} recent)`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        
        // FIRST: Check if already in Supabase storage (skip download if already there)
        if (session.taalk_call_url && session.taalk_call_url.startsWith('recordings/')) {
          console.log(`  ✓ Already in storage: ${session.taalk_call_url}, generating fresh URL...`);
          
          // Generate fresh 2-year signed URL
          const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(session.taalk_call_url, 63072000); // 2 years
          
          if (!signedError && signedData?.signedUrl) {
            await supabaseAdmin
              .from('verification_sessions')
              .update({ recording_url: signedData.signedUrl })
              .eq('id', session.id);
            
            console.log(`  ✅ Generated fresh 2-year Supabase URL`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          } else {
            console.log(`  ⚠️ Failed to generate signed URL, will try to re-download`);
          }
        }
        
        // SECOND: Download from Taalk API if not in storage
        const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        
        // Try to download recording from Taalk
        let response = await fetch(taalkRecordingUrl, {
          headers: {
            'Authorization': `Bearer ${TAALK_API_KEY}`,
            'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
          }
        });
        
        // Try basic auth if bearer fails
        if (!response.ok && response.status === 401) {
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
            console.error(`  ❌ Upload failed for ${session.session_id}:`, uploadError.message);
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
          
          console.log(`  ✅ Downloaded ${session.session_id} (${Math.round(buffer.length / 1024)}KB)`);
          successCount++;
        } else {
          console.error(`  ❌ Failed to download recording: ${response.status} ${response.statusText} (Call ID: ${callId})`);
          failCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`  ❌ Error processing ${session.session_id}:`, error.message);
        failCount++;
      }
    }
    
    if (successCount > 0 || failCount > 0) {
      console.log(`📊 Summary: ✅ ${successCount} downloaded, ❌ ${failCount} failed`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run immediately on startup
console.log('🎵 Recording Scheduler Started');
console.log('⏰ Checking for new recordings every 5 minutes');
downloadNewRecordings();

// Schedule to run every 5 minutes (300000ms)
setInterval(() => {
  downloadNewRecordings();
}, 5 * 60 * 1000);

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Recording scheduler stopped');
  process.exit(0);
});

