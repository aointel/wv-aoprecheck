import { supabaseAdmin } from './supabase.js';
import fetch from 'node-fetch';

const TAALK_API_KEY = process.env.TAALK_API_KEY;

async function downloadAndStoreFullUrls() {
  console.log('🎵 Downloading recordings and storing FULL Supabase URLs in recording_url column...\n');
  
  try {
    // Get all sessions with taalk_call_id but no recording_url stored
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, taalk_call_id, taalk_call_url, recording_url, created_at, first_name, last_name')
      .not('taalk_call_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false })
      .limit(100); // Process 100 at a time
    
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
        console.log(`\n📞 Session ${session.id} - ${session.first_name} ${session.last_name}`);
        
        // Check if already in Supabase storage
        if (session.taalk_call_url && session.taalk_call_url.startsWith('recordings/')) {
          console.log(`   ✓ Already in storage: ${session.taalk_call_url}`);
          
          // Generate 2-year signed URL and store it in recording_url
          const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(session.taalk_call_url, 63072000); // 2 years
          
          if (!signedError && signedData?.signedUrl) {
            console.log(`   🔑 2-year URL: ${signedData.signedUrl.substring(0, 100)}...`);
            
            // Store FULL URL in recording_url column
            await supabaseAdmin
              .from('verification_sessions')
              .update({ recording_url: signedData.signedUrl })
              .eq('id', session.id);
            
            console.log(`   ✅ Stored full URL in recording_url column`);
            successCount++;
            continue;
          }
        }
        
        // Download from Taalk
        const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        console.log(`   📡 Downloading from Taalk...`);
        
        let response = await fetch(taalkUrl, {
          headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
        });
        
        if (!response.ok) {
          const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
          response = await fetch(taalkUrl, {
            headers: { 'Authorization': `Basic ${basicAuth}` }
          });
        }
        
        if (!response.ok) {
          console.log(`   ⚠️ Taalk returned ${response.status}`);
          failCount++;
          continue;
        }
        
        const buffer = await response.buffer();
        console.log(`   ✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Upload to Supabase
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
          .createSignedUrl(fileName, 63072000);
        
        if (signedError || !signedData?.signedUrl) {
          console.error(`   ❌ Failed to generate URL:`, signedError);
          failCount++;
          continue;
        }
        
        console.log(`   🔑 2-year URL: ${signedData.signedUrl.substring(0, 100)}...`);
        
        // Store BOTH the path AND the full URL
        await supabaseAdmin
          .from('verification_sessions')
          .update({ 
            taalk_call_url: fileName,
            recording_url: signedData.signedUrl, // FULL SUPABASE SIGNED URL
            taalk_call_status: 'completed',
            taalk_call_completed_at: new Date().toISOString()
          })
          .eq('id', session.id);
        
        console.log(`   ✅ Stored full URL in recording_url column`);
        successCount++;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`   ❌ Error:`, error);
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

downloadAndStoreFullUrls();

