/**
 * Backfill script to download missing recordings for 12/1 VERIFICATION SESSIONS ONLY
 * 
 * ⚠️ THIS SCRIPT ONLY PROCESSES VERIFICATION SESSIONS - NOT RECRUIT OR CONNECT CALLS
 * 
 * This script:
 * 1. Finds all VERIFICATION SESSIONS from 12/1 that have taalk_call_id but no recording_url
 * 2. Downloads the recording from Taalk API (only for verification sessions)
 * 3. Uploads to Supabase Storage
 * 4. Generates a 2-year signed URL
 * 5. Updates the verification_sessions table with recording_url
 */

import { supabaseAdmin } from './supabase';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function backfillRecordings() {
  try {
    console.log('🔍 Finding 12/1 verification sessions with missing recordings...\n');
    
    // Find VERIFICATION SESSIONS ONLY from 12/1/2025 that have taalk_call_id but no recording_url
    // This ONLY queries verification_sessions table - NOT recruit or connect calls
    const targetDate = '2025-12-01';
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')  // ⚠️ VERIFICATION SESSIONS ONLY
      .select('id, session_id, first_name, last_name, taalk_call_id, taalk_call_url, recording_url, created_at')
      .gte('created_at', `${targetDate}T00:00:00.000Z`)
      .lt('created_at', `${targetDate}T23:59:59.999Z`)
      .not('taalk_call_id', 'is', null)  // Must have a Taalk call ID
      .or('recording_url.is.null,taalk_call_url.is.null');  // Missing recording URL
    
    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found that need recordings backfilled');
      process.exit(0);
    }
    
    console.log(`📊 Found ${sessions.length} sessions from ${targetDate} that need recordings\n`);
    
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        console.log(`\n📞 Processing: ${session.first_name} ${session.last_name} (${session.session_id})`);
        console.log(`   Call ID: ${callId}`);
        
        // Check if recording already exists in storage
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
            recording_url: signedData.signedUrl,
            taalk_call_status: 'completed',
            taalk_call_completed_at: new Date().toISOString()
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
    console.log(`⏭️ Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

backfillRecordings();

