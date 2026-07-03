const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const baseDir = 'C:\\Users\\mmand\\AppData\\Local\\Programs\\AO Intelligence\\recordings\\screenshots';

// Track which screenshots we've already uploaded
const uploadedFiles = new Set();

async function uploadNewScreenshots() {
  try {
    const sessions = fs.readdirSync(baseDir)
      .filter(item => fs.statSync(path.join(baseDir, item)).isDirectory());
    
    let newUploads = 0;
    
    for (const sessionId of sessions) {
      const sessionDir = path.join(baseDir, sessionId);
      const files = fs.readdirSync(sessionDir)
        .filter(f => f.endsWith('.png'))
        .sort();
      
      for (const file of files) {
        const filepath = path.join(sessionDir, file);
        const key = `${sessionId}/${file}`;
        
        if (uploadedFiles.has(key)) continue;
        
        try {
          const fileBuffer = fs.readFileSync(filepath);
          const base64 = fileBuffer.toString('base64');
          const screenshot_data = `data:image/png;base64,${base64}`;
          
          // Upload via production server API
          const response = await fetch('https://aoirail-production.up.railway.app/api/presentations/screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              screenshot_data: screenshot_data
            })
          });
          
          if (response.ok) {
            uploadedFiles.add(key);
            newUploads++;
            console.log(`✅ Uploaded ${file} from ${sessionId}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.error(`❌ Failed to upload ${file}:`, err.message);
        }
      }
    }
    
    if (newUploads > 0) {
      console.log(`📊 Uploaded ${newUploads} new screenshots this cycle`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run every 60 seconds
console.log('🔄 Starting auto-upload service (every 60 seconds)...');
console.log('Press Ctrl+C to stop\n');

uploadNewScreenshots();
setInterval(uploadNewScreenshots, 60000);

