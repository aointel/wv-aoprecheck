/**
 * Fix sessions with "PENDING" recording_url by downloading the actual recordings
 */

import { supabaseAdmin } from './supabase';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function fixPendingRecordings() {
  try {
    console.log('🔍 Finding sessions with "PENDING" recording_url...\n');
    
    // Find sessions with "PENDING" or invalid recording_url that have taalk_call_id
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, first_name, last_name, taalk_call_id, taalk_call_url, recording_url, created_at')
      .or('recording_url.eq.PENDING,recording_url.is.null')
      .not('taalk_call_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50); // Start with recent ones
    
    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found with PENDING recording_url');
      process.exit(0);
    }
    
    console.log(`📊 Found ${sessions.length} sessions with PENDING/missing recording_url\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        console.log(`\n📞 Processing: ${session.first_name} ${session.last_name} (${session.session_id})`);
        console.log(`   Call ID: ${callId}`);
        console.log(`   Current recording_url: ${session.recording_url || 'NULL'}`);
        
        // Check if already in storage
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
            
            console.log(`   ✅ Generated 2-year URL`);
            successCount++;
            continue;
          }
        }
        
        // Download from Taalk API
        const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        console.log(`   📡 Fetching from Taalk API...`);
        
        let response = await fetch(taalkUrl, {
          headers: {
            'Authorization': `Bearer ${TAALK_API_KEY}`,
            'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
          }
        });
        
        // Fallback to basic auth
        if (!response.ok) {
          console.log(`   ⚠️ Bearer auth failed (${response.status}), trying basic auth...`);
          const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
          response = await fetch(taalkUrl, {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Accept': 'audio/mpeg'
            }
          });
        }
        
        if (!response.ok) {
          console.log(`   ❌ Taalk returned ${response.status} - recording may not be available`);
          failCount++;
          continue;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`   ✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Upload to Supabase Storage
        const fileName = `recordings/${callId}.mp3`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .upload(fileName, buffer, {
            contentType: 'audio/mpeg',
            upsert: true
          });
        
        if (uploadError) {
          console.error(`   ❌ Upload error:`, uploadError);
          failCount++;
          continue;
        }
        
        console.log(`   ☁️ Uploaded: ${fileName}`);
        
        // Generate 2-year signed URL
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from('verify_agent_screenshot')
          .createSignedUrl(fileName, 63072000); // 2 years
        
        if (signedError || !signedData?.signedUrl) {
          console.error(`   ❌ Failed to generate signed URL:`, signedError);
          failCount++;
          continue;
        }
        
        console.log(`   🔑 Generated 2-year URL`);
        
        // Update database
        await supabaseAdmin
          .from('verification_sessions')
          .update({
            taalk_call_url: fileName,
            recording_url: signedData.signedUrl
          })
          .eq('id', session.id);
        
        console.log(`   ✅ Database updated`);
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`   ❌ Error processing session ${session.id}:`, error);
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixPendingRecordings();

