const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function uploadLocalScreenshots() {
  const baseDir = 'C:\\Users\\mmand\\AppData\\Local\\Programs\\AO Intelligence\\recordings\\screenshots';
  
  console.log('📁 Scanning for screenshot sessions...');
  
  const sessions = fs.readdirSync(baseDir)
    .filter(item => {
      const fullPath = path.join(baseDir, item);
      return fs.statSync(fullPath).isDirectory();
    });
  
  console.log(`📊 Found ${sessions.length} session directories\n`);
  
  let totalSuccess = 0;
  let totalFail = 0;
  
  for (const sessionId of sessions) {
    const sessionDir = path.join(baseDir, sessionId);
    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('.png'))
      .sort();
    
    if (files.length === 0) continue;
    
    console.log(`\n🚀 Processing session: ${sessionId} (${files.length} screenshots)`);
    
    for (const file of files) {
      const filepath = path.join(sessionDir, file);
      
      try {
        const fileBuffer = fs.readFileSync(filepath);
        const fileName = `PRES-${sessionId}-${Date.now()}.png`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('verify_agent_screenshot')
          .upload(fileName, fileBuffer, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) {
          totalFail++;
          if (totalFail < 5) {
            console.log(`❌ ${file}: ${uploadError.message}`);
          }
        } else {
          totalSuccess++;
          process.stdout.write(`✅ ${totalSuccess} uploaded\r`);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        totalFail++;
        if (totalFail < 5) {
          console.log(`❌ ${file}: ${error.message}`);
        }
      }
    }
  }
  
  console.log(`\n\n📊 UPLOAD COMPLETE:`);
  console.log(`   ✅ Success: ${totalSuccess}`);
  console.log(`   ❌ Failed: ${totalFail}`);
}

uploadLocalScreenshots().catch(console.error);

