import { supabaseAdmin } from './supabase';

/**
 * Downloads recordings from the last 48 hours (before they disappear from Taalk)
 * Run this script daily to rescue recordings that the webhook missed
 */
async function rescueRecentRecordings() {
  try {
    console.log('🚨 RESCUING RECORDINGS FROM LAST 48 HOURS...');
    
    if (!supabaseAdmin) {
      console.error('❌ Supabase client not available');
      return;
    }
    
    // Get sessions from last 48 hours without stored recordings
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
    
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, taalk_call_url, created_at')
      .not('taalk_call_id', 'is', null)
      .is('taalk_call_url', null)
      .gte('created_at', twoDaysAgo.toISOString());
    
    if (error) {
      console.error('❌ Error fetching recent sessions:', error);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No recent sessions need recording downloads');
      return;
    }
    
    console.log(`🎯 Found ${sessions.length} recent sessions (<48hrs) without stored recordings`);
    
    let successCount = 0;
    let failCount = 0;
    let goneCount = 0;
    
    const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id || session.session_id;
        const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        
        const age = Math.floor((Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60));
        console.log(`🎵 [${age}hrs old] Downloading ${session.session_id}...`);
        
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
              'Accept': 'audio/mpeg'
            }
          });
          
          if (!fallbackResponse.ok) {
            if (response.status === 500) {
              console.error(`💀 Recording already gone: ${session.session_id} (${age} hours old)`);
              goneCount++;
            } else {
              console.error(`❌ Download failed ${session.session_id}: ${response.status}`);
              failCount++;
            }
            continue;
          }
          
          // Fallback worked - download and store
          const arrayBuffer = await fallbackResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const filename = `recordings/${callId}-${Date.now()}.mp3`;
          const { objstore } = await import('@replit/object-storage');
          await objstore.write(filename, buffer);
          const storedUrl = `/api/objstore/${filename}`;
          
          await supabaseAdmin
            .from('verification_sessions')
            .update({ taalk_call_url: storedUrl })
            .eq('id', session.id);
          
          console.log(`✅ RESCUED ${session.session_id} at ${storedUrl}`);
          successCount++;
        } else {
          // Primary auth worked - download and store
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          const filename = `recordings/${callId}-${Date.now()}.mp3`;
          const { objstore } = await import('@replit/object-storage');
          await objstore.write(filename, buffer);
          const storedUrl = `/api/objstore/${filename}`;
          
          await supabaseAdmin
            .from('verification_sessions')
            .update({ taalk_call_url: storedUrl })
            .eq('id', session.id);
          
          console.log(`✅ RESCUED ${session.session_id} at ${storedUrl}`);
          successCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing ${session.session_id}:`, error);
        failCount++;
      }
    }
    
    console.log(`\n📊 RESCUE SUMMARY (Last 48 hours):`);
    console.log(`  ✅ Rescued: ${successCount}`);
    console.log(`  💀 Already Gone: ${goneCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📦 Total Checked: ${sessions.length}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  rescueRecentRecordings().then(() => {
    console.log('✅ Rescue complete');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Rescue failed:', error);
    process.exit(1);
  });
}

export { rescueRecentRecordings };
