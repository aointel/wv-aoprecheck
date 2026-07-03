import { supabaseAdmin } from './supabase.js';
import fetch from 'node-fetch';

async function downloadSession888() {
  const sessionId = 888;
  const callId = '68f3e64a82684f5e6bab4bbd';
  
  console.log(`🎵 Downloading recording for session ${sessionId}...`);
  console.log(`Call ID: ${callId}`);
  
  // Try the Taalk API
  const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
  console.log(`\n📡 Fetching from: ${taalkUrl}`);
  
  try {
    let response = await fetch(taalkUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.TAALK_API_KEY}`
      }
    });
    
    // If bearer token fails, try basic auth
    if (!response.ok) {
      console.log(`⚠️ Bearer auth failed, trying basic auth...`);
      const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
      response = await fetch(taalkUrl, {
        headers: {
          'Authorization': `Basic ${basicAuth}`
        }
      });
    }
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch recording: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`Response body: ${text}`);
      process.exit(1);
    }
    
    const buffer = await response.buffer();
    console.log(`✅ Downloaded ${buffer.length} bytes`);
    
    // Upload to Supabase storage
    const fileName = `recordings/${callId}.mp3`;
    console.log(`\n☁️ Uploading to Supabase: ${fileName}`);
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('verify_agent_screenshot')
      .upload(fileName, buffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      process.exit(1);
    }
    
    console.log('✅ Uploaded successfully:', uploadData);
    
    // Update database with storage path
    console.log(`\n💾 Updating database...`);
    const { error: updateError } = await supabaseAdmin
      .from('verification_sessions')
      .update({ 
        taalk_call_url: fileName,
        taalk_call_status: 'completed',
        taalk_call_completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    if (updateError) {
      console.error('❌ Database update error:', updateError);
      process.exit(1);
    }
    
    console.log('✅ Database updated successfully');
    console.log(`\n🎉 Recording for session ${sessionId} downloaded and stored!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

downloadSession888();

