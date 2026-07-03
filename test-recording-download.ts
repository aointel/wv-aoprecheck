/**
 * Test downloading a recording from Taalk API to see actual size
 */

import { supabaseAdmin } from './server/supabase';

async function testRecordingDownload() {
  console.log('🔍 Testing recording download from Taalk API...\n');

  const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

  // Get one of the imported calls
  const { data: analytics } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('taalk_call_id, recording_url, billing_transaction_id')
    .like('billing_transaction_id', 'csv-%')
    .limit(1)
    .maybeSingle();

  if (!analytics || !analytics.taalk_call_id) {
    console.error('❌ No analytics found');
    return;
  }

  const taalkCallId = analytics.taalk_call_id;
  console.log(`📞 Testing call: ${taalkCallId}`);
  console.log(`   Current recording_url: ${analytics.recording_url?.substring(0, 100)}...\n`);

  // Test direct download from Taalk API
  const recordingUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
  console.log(`🔍 Fetching from Taalk API: ${recordingUrl}\n`);

  try {
    const response = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
      }
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📊 Content-Type: ${response.headers.get('content-type')}`);
    console.log(`📊 Content-Length: ${response.headers.get('content-length') || 'Unknown'}`);
    console.log(`📊 Content-Disposition: ${response.headers.get('content-disposition') || 'N/A'}\n`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Failed: ${response.status} - ${errorText.substring(0, 500)}`);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeKB = Math.round(buffer.length / 1024);
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

    console.log(`✅ Downloaded recording:`);
    console.log(`   Size: ${buffer.length} bytes (${sizeKB}KB / ${sizeMB}MB)`);

    if (buffer.length < 10000) {
      console.log(`\n⚠️ WARNING: Recording is suspiciously small (${sizeKB}KB)`);
      console.log(`   First 500 bytes: ${buffer.toString('utf-8', 0, 500)}`);
    } else {
      console.log(`   ✅ Recording size looks reasonable`);
    }

    // Check if it's actually an MP3 file
    const header = buffer.toString('hex', 0, 4);
    console.log(`   File header (hex): ${header}`);
    
    // MP3 files typically start with ID3 tag (49 44 33) or FF FB/FF F3 (MPEG frame sync)
    if (header.startsWith('494433') || header.startsWith('fffb') || header.startsWith('fff3')) {
      console.log(`   ✅ Appears to be valid MP3 file`);
    } else {
      console.log(`   ⚠️ May not be a valid MP3 file`);
      console.log(`   First 100 chars as text: ${buffer.toString('utf-8', 0, 100)}`);
    }

    // Now upload it properly
    console.log(`\n📤 Uploading to Supabase Storage...`);
    const fileName = `call-analysis/${taalkCallId}.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('verify_agent_screenshot')
      .upload(fileName, buffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      console.error(`❌ Upload failed:`, uploadError);
      return;
    }

    console.log(`✅ Uploaded to: ${fileName}`);

    // Generate signed URL
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from('verify_agent_screenshot')
      .createSignedUrl(fileName, 63072000); // 2 years

    if (urlError || !urlData?.signedUrl) {
      console.error(`❌ Failed to generate signed URL:`, urlError);
      return;
    }

    console.log(`✅ Generated signed URL: ${urlData.signedUrl.substring(0, 100)}...`);

    // Update the analytics record
    const { error: updateError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .update({ recording_url: urlData.signedUrl })
      .eq('billing_transaction_id', analytics.billing_transaction_id);

    if (updateError) {
      console.error(`❌ Failed to update analytics:`, updateError);
    } else {
      console.log(`✅ Updated analytics record with new recording URL`);
    }

    // Test the new URL
    console.log(`\n🔍 Testing new recording URL...`);
    const testResponse = await fetch(urlData.signedUrl);
    console.log(`   Status: ${testResponse.status}`);
    console.log(`   Content-Type: ${testResponse.headers.get('content-type')}`);
    console.log(`   Content-Length: ${testResponse.headers.get('content-length') || 'Unknown'}`);

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    console.error(`   Stack:`, error.stack);
  }

  process.exit(0);
}

testRecordingDownload();
