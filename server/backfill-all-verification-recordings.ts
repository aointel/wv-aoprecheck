/**
 * COMPREHENSIVE BACKFILL: Fix ALL verification session recording URL issues
 * 
 * This script handles:
 * 1. Sessions with "PENDING" recording_url
 * 2. Sessions with null/empty recording_url but have taalk_call_id
 * 3. Sessions with recordings in storage but missing/expired recording_url
 * 4. Sessions with expired api.taalk.ai URLs (need Supabase URLs)
 * 5. Downloads missing recordings from Taalk API
 * 6. Generates fresh 2-year signed URLs for all
 */

import { supabaseAdmin } from './supabase.js';
import fetch from 'node-fetch';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function backfillAllVerificationRecordings() {
  console.log('🔧 COMPREHENSIVE BACKFILL: Fixing ALL verification session recording URLs...\n');
  
  try {
    // Find ALL sessions that need fixing:
    // 1. PENDING recording_url
    // 2. NULL/empty recording_url but have taalk_call_id
    // 3. Have api.taalk.ai URLs (expired, need Supabase URLs)
    // 4. Have recordings in storage but missing/expired recording_url
    
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, first_name, last_name, taalk_call_id, taalk_call_url, recording_url, created_at')
      .not('taalk_call_id', 'is', null) // Must have a Taalk call ID
      .or(`
        recording_url.is.null,
        recording_url.eq.PENDING,
        recording_url.eq.,
        recording_url.like.%api.taalk.ai%,
        taalk_call_url.like.recordings/%
      `)
      .order('created_at', { ascending: false })
      .limit(1000); // Process up to 1000 at a time
    
    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found that need recording URL fixes');
      process.exit(0);
    }
    
    console.log(`📊 Found ${sessions.length} sessions needing recording URL fixes\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    let alreadyFixedCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        console.log(`\n📞 Processing: ${session.first_name} ${session.last_name} (${session.session_id})`);
        console.log(`   Call ID: ${callId}`);
        console.log(`   Current recording_url: ${session.recording_url || 'NULL'}`);
        console.log(`   Current taalk_call_url: ${session.taalk_call_url || 'NULL'}`);
        
        // CASE 1: Already in Supabase storage - just generate fresh URL
        if (session.taalk_call_url && session.taalk_call_url.startsWith('recordings/')) {
          console.log(`   ✓ Already in storage: ${session.taalk_call_url}`);
          
          // Check if recording_url is already a valid Supabase URL
          if (session.recording_url && 
              session.recording_url.includes('supabase') && 
              !session.recording_url.includes('api.taalk.ai')) {
            console.log(`   ✅ Already has valid Supabase URL - skipping`);
            alreadyFixedCount++;
            continue;
          }
          
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
            continue;
          } else {
            console.log(`   ⚠️ Failed to generate signed URL, will try to re-download`);
          }
        }
        
        // CASE 2: Need to download from Taalk API
        console.log(`   📡 Downloading from Taalk API...`);
        
        const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        
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
          console.log(`   ❌ Taalk returned ${response.status} - recording may not be available yet`);
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
        
        console.log(`   ☁️ Uploaded to Supabase: ${fileName}`);
        
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
        
        console.log(`   ✅ Database updated with Supabase URL`);
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`   ❌ Error processing session ${session.id}:`, error.message);
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`📊 BACKFILL SUMMARY:`);
    console.log(`✅ Successfully fixed: ${successCount}`);
    console.log(`⏭️ Already fixed: ${alreadyFixedCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

backfillAllVerificationRecordings();

