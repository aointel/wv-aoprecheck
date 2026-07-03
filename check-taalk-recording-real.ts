/**
 * Check what Taalk API actually returns for recordings
 */

async function checkTaalkRecording() {
  const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

  // Test with one of the session IDs from the CSV
  const sessionId = '6979854ef44cd3df56c01740'; // JACKSON

  console.log(`🔍 Testing Taalk recording for session: ${sessionId}\n`);

  // First, get call info
  const callInfoUrl = `https://api.taalk.ai/api/calls/${sessionId}?db=michaelmandella`;
  console.log(`📞 Getting call info: ${callInfoUrl}\n`);

  try {
    const callInfoResponse = await fetch(callInfoUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });

    if (callInfoResponse.ok) {
      const callInfo = await callInfoResponse.json();
      console.log(`✅ Call Info:`);
      console.log(`   Duration: ${callInfo.duration || 'N/A'}`);
      console.log(`   Status: ${callInfo.status || 'N/A'}`);
      console.log(`   Has Recording: ${callInfo.hasRecording || callInfo.recording_url ? 'Yes' : 'No'}`);
      console.log(`   Recording URL: ${callInfo.recording_url || 'N/A'}\n`);
    } else {
      console.log(`❌ Failed to get call info: ${callInfoResponse.status}`);
    }

    // Now try the recording endpoint
    const recordingUrl = `https://api.taalk.ai/api/calls/${sessionId}/recording?db=michaelmandella`;
    console.log(`🎵 Fetching recording: ${recordingUrl}\n`);

    const recordingResponse = await fetch(recordingUrl, {
      headers: {
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
      }
    });

    console.log(`📊 Response Status: ${recordingResponse.status} ${recordingResponse.statusText}`);
    console.log(`📊 Headers:`);
    recordingResponse.headers.forEach((value, key) => {
      console.log(`   ${key}: ${value}`);
    });

    if (recordingResponse.ok) {
      const arrayBuffer = await recordingResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const sizeKB = Math.round(buffer.length / 1024);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      console.log(`\n📊 Downloaded:`);
      console.log(`   Size: ${buffer.length} bytes (${sizeKB}KB / ${sizeMB}MB)`);

      // Check if it's a redirect or error message
      const text = buffer.toString('utf-8', 0, 500);
      if (text.includes('http') || text.includes('redirect') || text.includes('error')) {
        console.log(`\n⚠️ WARNING: This looks like a redirect or error message, not audio!`);
        console.log(`   Content: ${text}`);
      } else {
        console.log(`   First 100 bytes (hex): ${buffer.toString('hex', 0, 100)}`);
        console.log(`   First 100 bytes (text): ${text.substring(0, 100)}`);
      }

      // Check Content-Type
      const contentType = recordingResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('audio')) {
        console.log(`\n⚠️ WARNING: Content-Type is not audio: ${contentType}`);
      }

    } else {
      const errorText = await recordingResponse.text().catch(() => '');
      console.log(`\n❌ Recording fetch failed:`);
      console.log(`   Status: ${recordingResponse.status}`);
      console.log(`   Error: ${errorText.substring(0, 500)}`);
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }

  process.exit(0);
}

checkTaalkRecording();
