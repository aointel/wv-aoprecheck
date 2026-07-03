/**
 * IMMEDIATE FIX: Process all "PENDING" recording URLs right now
 * This script downloads recordings from Taalk API and updates recording_url
 * 
 * Run with: node fix-pending-recordings-immediate.cjs
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TAALK_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function fixPendingRecordings() {
  console.log('\n🚨 IMMEDIATE FIX: Processing all PENDING recording URLs\n');
  console.log('='.repeat(80));

  try {
    // Find all sessions with PENDING recording_url that have taalk_call_id
    const { data: sessions, error } = await supabase
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, taalk_call_url, recording_url, first_name, last_name, created_at')
      .not('taalk_call_id', 'is', null)
      .eq('recording_url', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(500); // Process up to 500 at a time

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions with PENDING recording_url found!');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions with PENDING recording_url\n`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const callId = session.taalk_call_id;

      try {
        console.log(`[${i + 1}/${sessions.length}] Processing: ${session.first_name} ${session.last_name} (Call ID: ${callId})`);

        // Try to download recording from Taalk API
        const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
        
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

        if (!response.ok) {
          console.log(`   ⚠️ Recording not available yet (${response.status}) - skipping`);
          skipCount++;
          continue;
        }

        // Download the recording
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
          console.log(`   ⚠️ Empty recording - skipping`);
          skipCount++;
          continue;
        }

        // Upload to Supabase Storage
        const fileName = `recordings/${callId}.mp3`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('verify_agent_screenshot')
          .upload(fileName, buffer, {
            contentType: 'audio/mpeg',
            upsert: true
          });

        if (uploadError) {
          console.error(`   ❌ Upload failed: ${uploadError.message}`);
          failCount++;
          continue;
        }

        // Generate 2-year signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('verify_agent_screenshot')
          .createSignedUrl(fileName, 63072000); // 2 years in seconds

        if (signedError || !signedData?.signedUrl) {
          console.error(`   ❌ Failed to generate signed URL: ${signedError?.message || 'Unknown error'}`);
          failCount++;
          continue;
        }

        // Update the session with the new URLs
        const { error: updateError } = await supabase
          .from('verification_sessions')
          .update({
            taalk_call_url: fileName, // Store Supabase storage path
            recording_url: signedData.signedUrl, // Store 2-year signed URL
            taalk_call_status: 'completed',
            taalk_call_completed_at: new Date().toISOString()
          })
          .eq('id', session.id);

        if (updateError) {
          console.error(`   ❌ Database update failed: ${updateError.message}`);
          failCount++;
          continue;
        }

        console.log(`   ✅ Success! Downloaded ${Math.round(buffer.length / 1024)}KB and updated recording_url`);
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   ❌ Error processing session ${session.id}:`, error.message);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Sessions: ${sessions.length}`);
    console.log(`   ✅ Successfully Processed: ${successCount}`);
    console.log(`   ⚠️ Skipped (not available): ${skipCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

fixPendingRecordings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


