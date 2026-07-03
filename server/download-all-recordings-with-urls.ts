import { supabaseAdmin } from './supabase.js';
import fetch from 'node-fetch';

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function downloadAllRecordings() {
  console.log('🎵 Downloading ALL missing recordings and storing Supabase URLs...\n');
  
  try {
    // Get all sessions with taalk_call_id but no Supabase recording stored
    // OR sessions with old HTTP URLs that might have expired
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, taalk_call_id, taalk_call_url, taalk_call_status, created_at, first_name, last_name')
      .not('taalk_call_id', 'is', null)
      .or('taalk_call_url.is.null,taalk_call_url.like.http%')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error);
      process.exit(1);
    }
    
    console.log(`Found ${sessions.length} sessions to process\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const session of sessions) {
      try {
        const callId = session.taalk_call_id;
        console.log(`\n📞 Processing session ${session.id} - ${session.first_name} ${session.last_name}`);
        console.log(`   Call ID: ${callId}`);
        console.log(`   Current status: ${session.taalk_call_status}`);
        
        // Check if recording already exists in Supabase storage (by path, not URL)
        if (session.taalk_call_url && session.taalk_call_url.startsWith('recordings/')) {
          // Already have the MP3 stored, just need to generate fresh 2-year URL
          console.log(`   ✓ Already in storage: ${session.taalk_call_url}`);
          
          const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(session.taalk_call_url, 63072000); // 2 years
          
          if (!signedError && signedData?.signedUrl) {
            console.log(`   ✅ Generated 2-year URL: ${signedData.signedUrl.substring(0, 80)}...`);
            
            // Store the FULL Supabase signed URL in a new field
            await supabaseAdmin
              .from('verification_sessions')
              .update({ 
                taalk_call_status: 'completed',
                taalk_call_completed_at: new Date().toISOString()
              })
              .eq('id', session.id);
            
            successCount++;
            continue;
          }
        }
        
        // Try to download from Taalk API
        const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        console.log(`   📡 Fetching from Taalk API...`);
        
        let response = await fetch(taalkUrl, {
          headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
        });
        
        // Try basic auth if bearer fails
        if (!response.ok) {
          const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
          response = await fetch(taalkUrl, {
            headers: { 'Authorization': `Basic ${basicAuth}` }
          });
        }
        
        if (!response.ok) {
          console.log(`   ⚠️ Taalk API returned ${response.status}: ${response.statusText}`);
          if (response.status === 425) {
            console.log(`   ℹ️ Recording not ready yet (425 Too Early)`);
          }
          failCount++;
          continue;
        }
        
        const buffer = await response.buffer();
        console.log(`   ✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Upload to Supabase storage
        const fileName = `recordings/${callId}.mp3`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
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
        
        console.log(`   🔑 Generated 2-year URL: ${signedData.signedUrl.substring(0, 80)}...`);
        
        // Update database with STORAGE PATH (we'll generate signed URLs on-demand)
        const { error: updateError } = await supabaseAdmin
          .from('verification_sessions')
          .update({ 
            taalk_call_url: fileName, // Store path
            taalk_call_status: 'completed',
            taalk_call_completed_at: new Date().toISOString()
          })
          .eq('id', session.id);
        
        if (updateError) {
          console.error(`   ❌ Database update error:`, updateError);
          failCount++;
          continue;
        }
        
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

downloadAllRecordings();

