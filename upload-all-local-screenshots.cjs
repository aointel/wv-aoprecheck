const fs = require('fs');
const path = require('path');

async function uploadAllLocalScreenshots() {
  const baseDir = 'C:\\Users\\mmand\\AppData\\Local\\Programs\\AO Intelligence\\recordings\\screenshots';
  
  console.log('📁 Scanning for screenshot sessions...');
  
  // Get all session directories
  const sessions = fs.readdirSync(baseDir)
    .filter(item => {
      const fullPath = path.join(baseDir, item);
      return fs.statSync(fullPath).isDirectory();
    });
  
  console.log(`📊 Found ${sessions.length} session directories\n`);
  
  for (const sessionId of sessions) {
    const sessionDir = path.join(baseDir, sessionId);
    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('.png'))
      .sort();
    
    if (files.length === 0) {
      console.log(`⏭️  Skipping ${sessionId} - no screenshots`);
      continue;
    }
    
    console.log(`\n🚀 Uploading ${files.length} screenshots from session: ${sessionId}`);
    
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
          process.stdout.write(`✅ [${i+1}/${files.length}]\r`);
        } else {
          failCount++;
          const error = await response.text();
          console.log(`\n❌ [${i+1}/${files.length}] ${file} failed: ${error.substring(0, 100)}`);
        }
        
        // Small delay to avoid overwhelming server
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        failCount++;
        console.log(`\n❌ [${i+1}/${files.length}] ${file} error: ${error.message}`);
      }
    }
    
    console.log(`\n   ✅ Success: ${successCount}  ❌ Failed: ${failCount}`);
  }
  
  console.log('\n🎉 ALL SESSIONS PROCESSED');
}

uploadAllLocalScreenshots().catch(console.error);

