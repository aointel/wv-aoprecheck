import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test uploading screenshots from the captured presentation
async function testUpload() {
  const sessionId = '38ce5ab6-6200-47a9-bb47-aea5ce73eb9f';
  const screenshotDir = path.join(__dirname, 'recordings', 'screenshots', sessionId);
  
  const files = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png')).sort();
  
  console.log(`📤 Found ${files.length} screenshots to upload`);
  console.log('🎯 Session ID:', sessionId);
  
  // Upload first 5 screenshots as a test
  for (let i = 0; i < Math.min(5, files.length); i++) {
    const file = files[i];
    const filepath = path.join(screenshotDir, file);
    const screenshot = fs.readFileSync(filepath);
    const base64 = `data:image/png;base64,${screenshot.toString('base64')}`;
    
    console.log(`\n📸 Uploading ${file}...`);
    
    try {
      const response = await fetch('http://localhost:5000/api/presentations/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          screenshot_data: base64
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Uploaded and analyzing: ${file}`);
      } else {
        console.error(`❌ Failed:`, response.statusText);
      }
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
    
    // Delay between uploads
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Test upload complete! Check server logs for AI analysis results.');
}

testUpload();

