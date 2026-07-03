import { supabaseAdmin } from './supabase.js';
import fetch from 'node-fetch';

async function downloadSession906() {
  const sessionId = 906;
  const callId = '68f42efa2a4767590863e90c';
  
  console.log(`🎵 Downloading recording for session ${sessionId}...`);
  console.log(`Call ID: ${callId}`);
  
  const taalkUrl = `https://api.taalk.ai/api/calls/${callId}/recording?db=michaelmandella`;
  console.log(`\n📡 Fetching from: ${taalkUrl}`);
  
  // Use the EXACT API key from routes.ts that works
  const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";
  
  try {
    const response = await fetch(taalkUrl, {
      headers: { 
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
      }
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Failed: ${text}`);
      process.exit(1);
    }
    
    const buffer = await response.buffer();
    console.log(`✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Upload to Supabase
    const fileName = `recordings/${callId}.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('verify_agent_screenshot')
      .upload(fileName, buffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });
    
    if (uploadError) {
      console.error(`❌ Upload error:`, uploadError);
      process.exit(1);
    }
    
    console.log(`☁️ Uploaded: ${fileName}`);
    
    // Generate 2-year signed URL
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('verify_agent_screenshot')
      .createSignedUrl(fileName, 63072000);
    
    if (signedError || !signedData?.signedUrl) {
      console.error(`❌ Failed to generate URL:`, signedError);
      process.exit(1);
    }
    
    console.log(`🔑 2-year URL: ${signedData.signedUrl}`);
    
    // Update database
    await supabaseAdmin
      .from('verification_sessions')
      .update({ 
        taalk_call_url: fileName,
        recording_url: signedData.signedUrl,
        taalk_call_status: 'completed',
        taalk_call_completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    
    console.log(`✅ Database updated`);
    
  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
  
  process.exit(0);
}

downloadSession906();

