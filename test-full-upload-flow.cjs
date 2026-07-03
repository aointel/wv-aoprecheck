const fs = require('fs');
const path = require('path');

async function testFullUploadFlow() {
  console.log('🧪 TESTING FULL SCREENSHOT UPLOAD FLOW\n');
  
  // Read one actual screenshot
  const sessionDir = 'C:\\Users\\mmand\\AppData\\Local\\Programs\\AO Intelligence\\recordings\\screenshots\\session_1761365284921_kly3z0hxr';
  const filepath = path.join(sessionDir, 'screenshot-0001.png');
  
  if (!fs.existsSync(filepath)) {
    console.error('❌ Screenshot not found:', filepath);
    return;
  }
  
  const fileBuffer = fs.readFileSync(filepath);
  const base64 = fileBuffer.toString('base64');
  const screenshot_data = `data:image/png;base64,${base64}`;
  
  console.log(`📸 Screenshot size: ${(fileBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`📤 Sending to server...\n`);
  
  // Send to production server
  const response = await fetch('https://aoirail-production.up.railway.app/api/presentations/screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: 'session_1761365284921_kly3z0hxr',
      screenshot_data: screenshot_data
    })
  });
  
  console.log(`📥 Response status: ${response.status}`);
  
  if (response.ok) {
    const result = await response.json();
    console.log('✅ Server response:', result);
  } else {
    const error = await response.text();
    console.log('❌ Server error:', error);
  }
  
  console.log('\n💡 Now check Railway logs to see if it uploaded to Supabase Storage');
}

testFullUploadFlow().catch(console.error);

