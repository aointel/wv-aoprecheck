import { supabaseAdmin } from './supabase.js';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function fixPendingRecordingUrls() {
  console.log('🔧 Fixing PENDING recording_url for verification sessions...\n');
  
  try {
    // Get ALL sessions with "PENDING" recording_url that have taalk_call_id
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, taalk_call_url, recording_url, first_name, last_name, created_at')
      .eq('recording_url', 'PENDING')
      .not('taalk_call_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500); // Process up to 500 at a time
    
    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions with PENDING recording_url found');
      process.exit(0);
    }
    
    console.log(`📊 Found ${sessions.length} sessions with PENDING recording_url\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        console.log(`📞 Processing: ${session.first_name} ${session.last_name} (${session.session_id})`);
        console.log(`   Call ID: ${callId}`);
        
        // CASE 1: Already in Supabase storage - just generate fresh URL
        if (session.taalk_call_url && session.taalk_call_url.startsWith('recordings/')) {
          console.log(`   ✓ Already in storage: ${session.taalk_call_url}`);
          
          // Generate fresh 2-year signed URL
          const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(session.taalk_call_url, 63072000); // 2 years
          
          if (!signedError && signedData?.signedUrl) {
            await supabaseAdmin
              .from('verification_sessions')
              .update({ recording_url: signedData.signedUrl })
              .eq('id', session.id);
            
            console.log(`   ✅ Generated fresh 2-year Supabase URL`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          } else {
            console.log(`   ⚠️ Failed to generate signed URL, will try to re-download`);
          }
        }
        
        // CASE 2: Need to download from Taalk API
        console.log(`   📡 Downloading from Taalk API...`);
        
        const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        
        // Try Bearer token first
        let response = await fetch(taalkUrl, {
          headers: {
            'Authorization': `Bearer ${TAALK_API_KEY}`,
            'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
          }
        });
        
        // Try basic auth if bearer fails
        if (!response.ok) {
          const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
          response = await fetch(taalkUrl, {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Accept': 'audio/mpeg'
            }
          });
        }
        
        if (!response.ok) {
          console.error(`   ❌ Failed to download recording: ${response.status} ${response.statusText}`);
          failCount++;
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length === 0) {
          console.error(`   ❌ Empty recording file`);
          failCount++;
          continue;
        }
        
        console.log(`   📥 Downloaded ${Math.round(buffer.length / 1024)}KB`);
        
        // Upload to Supabase Storage
        const fileName = `recordings/${callId}.mp3`;
        
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .upload(fileName, buffer, {
            contentType: 'audio/mpeg',
            upsert: true
          });
        
        if (uploadError) {
          console.error(`   ❌ Upload failed:`, uploadError.message);
          failCount++;
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }
        
        console.log(`   ✅ Uploaded to Supabase storage`);
        
        // Generate 2-year signed URL
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .createSignedUrl(fileName, 63072000); // 2 years
        
        if (signedError || !signedData?.signedUrl) {
          console.error(`   ❌ Failed to generate signed URL:`, signedError);
          failCount++;
          continue;
        }
        
        console.log(`   🔑 Generated 2-year Supabase URL`);
        
        // Update database with BOTH storage path AND signed URL
        await supabaseAdmin
          .from('verification_sessions')
          .update({
            taalk_call_url: fileName,
            recording_url: signedData.signedUrl,
            taalk_call_status: 'completed',
            taalk_call_completed_at: new Date().toISOString()
          })
          .eq('id', session.id);
        
        console.log(`   ✅ Database updated with Supabase URL\n`);
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error: any) {
        console.error(`   ❌ Error processing session ${session.id}:`, error.message);
        failCount++;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`📊 FIX SUMMARY:`);
    console.log(`✅ Successfully fixed: ${successCount}`);
    console.log(`⏭️ Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixPendingRecordingUrls();

