const fs = require('fs');
const path = require('path');

async function uploadCurrentSession() {
  const sessionId = 'session_1761365284921_kly3z0hxr';
  const sessionDir = `C:\\Users\\mmand\\AppData\\Local\\Programs\\AO Intelligence\\recordings\\screenshots\\${sessionId}`;
  
  console.log('📁 Reading screenshots from:', sessionDir);
  
  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.png'))
    .sort();
  
  console.log(`📸 Found ${files.length} screenshots to upload`);
  console.log('🚀 Uploading to production...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filepath = path.join(sessionDir, file);
    
    try {
      // Read file as base64
      const fileBuffer = fs.readFileSync(filepath);
      const base64 = fileBuffer.toString('base64');
      const screenshot_data = `data:image/png;base64,${base64}`;
      
      // Upload to PRODUCTION server
      const response = await fetch('https://aoirail-production.up.railway.app/api/presentations/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          screenshot_data: screenshot_data
        })
      });
      
      if (response.ok) {
        successCount++;
        console.log(`✅ [${i+1}/${files.length}] ${file} uploaded successfully`);
      } else {
        failCount++;
        const error = await response.text();
        console.error(`❌ [${i+1}/${files.length}] ${file} failed:`, error.substring(0, 200));
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      failCount++;
      console.error(`❌ [${i+1}/${files.length}] ${file} error:`, error.message);
    }
  }
  
  console.log('\n📊 UPLOAD COMPLETE:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   Session ID: ${sessionId}`);
}

uploadCurrentSession().catch(console.error);

