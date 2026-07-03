const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function uploadCurrent() {
  const sessionId = 'session_1761414870361_kz9ervlw8';
  const sessionDir = `C:\\Users\\mmand\\AppData\\Local\\Programs\\AO Intelligence\\recordings\\screenshots\\${sessionId}`;
  
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.png')).sort();
  
  console.log(`📤 Uploading ${files.length} screenshots...`);
  
  for (const file of files) {
    const filepath = path.join(sessionDir, file);
    const fileBuffer = fs.readFileSync(filepath);
    const fileName = `PRES-${sessionId}-${Date.now()}.png`;
    
    await supabase.storage
      .from('verify_agent_screenshot')
      .upload(fileName, fileBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });
    
    process.stdout.write(`✅ ${files.indexOf(file) + 1}/${files.length}\r`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Done!`);
}

uploadCurrent().catch(console.error);

