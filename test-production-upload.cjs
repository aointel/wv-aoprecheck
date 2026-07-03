const fs = require('fs');
const path = require('path');

async function testProductionUpload() {
  const sessionId = 'session_1761414870361_kz9ervlw8';
  const filepath = `C:\\Users\\mmand\\AppData\\Local\\Programs\\AO Intelligence\\recordings\\screenshots\\${sessionId}\\screenshot-0001.png`;
  
  const fileBuffer = fs.readFileSync(filepath);
  const base64 = fileBuffer.toString('base64');
  const screenshot_data = `data:image/png;base64,${base64}`;
  
  console.log('📤 Sending screenshot to production server...');
  console.log(`   Session: ${sessionId}`);
  console.log(`   Size: ${(fileBuffer.length / 1024).toFixed(1)} KB\n`);
  
  const response = await fetch('https://aoirail-production.up.railway.app/api/presentations/screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      screenshot_data: screenshot_data
    })
  });
  
  console.log(`📥 Response status: ${response.status} ${response.statusText}`);
  
  if (response.ok) {
    const result = await response.json();
    console.log('✅ SUCCESS:', JSON.stringify(result, null, 2));
  } else {
    const error = await response.text();
    console.log('❌ ERROR:', error);
  }
}

testProductionUpload().catch(err => console.error('❌ Exception:', err));

