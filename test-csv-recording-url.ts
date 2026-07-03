/**
 * Test the actual recording URL from CSV
 */

async function testCSVRecordingUrl() {
  const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

  // Use the exact URL from CSV
  const csvRecordingUrl = "https://api.taalk.ai/api/calls/6979854ef44cd3df56c01740/recording?db=michaelmandella";
  
  console.log(`🔍 Testing CSV recording URL directly...\n`);
  console.log(`URL: ${csvRecordingUrl}\n`);

  try {
    const response = await fetch(csvRecordingUrl, {
      headers: {
        'Authorization': `Bearer ${taalkApiKey}`,
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`Content-Length: ${response.headers.get('content-length') || 'Unknown (chunked)'}\n`);

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const sizeKB = Math.round(buffer.length / 1024);
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

      console.log(`Downloaded: ${buffer.length} bytes (${sizeKB}KB / ${sizeMB}MB)`);

      if (buffer.length < 50000) {
        console.log(`\n⚠️ WARNING: Recording is too small (${sizeKB}KB) - likely not a real recording`);
        console.log(`This might be an error response or the recording doesn't exist.\n`);
        
        // Check if it's an error message
        const text = buffer.toString('utf-8', 0, 1000);
        if (text.includes('error') || text.includes('not found') || text.includes('404')) {
          console.log(`❌ This appears to be an error message:`);
          console.log(text);
        } else {
          console.log(`First 200 bytes: ${text.substring(0, 200)}`);
        }
      } else {
        console.log(`✅ Recording size looks reasonable`);
      }
    } else {
      const errorText = await response.text().catch(() => '');
      console.log(`❌ Failed: ${errorText.substring(0, 500)}`);
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }

  process.exit(0);
}

testCSVRecordingUrl();
