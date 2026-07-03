const fs = require('fs');
const path = require('path');

// Test the AI on ONE screenshot to see what it returns
async function testAI() {
  const screenshotPath = path.join(__dirname, 'recordings', 'screenshots', 'session_1760815246680_exa8ai6rs', 'screenshot-0020.png');
  const screenshotData = fs.readFileSync(screenshotPath, 'base64');
  
  console.log('🤖 Testing AI on HPPRO screenshot (Introduction Benefits with client data)...\n');
  
  try {
    const response = await fetch('http://localhost:5000/api/test-hppro-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshotData: `data:image/png;base64,${screenshotData}`
      })
    });
    
    const result = await response.json();
    console.log('✅ AI Response:\n');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n📊 Extracted Fields:');
    const fields = Object.keys(result).filter(k => k !== 'milestone' && k !== 'milestoneName' && k !== 'confidence');
    console.log(`   Total: ${fields.length}`);
    console.log(`   Fields: ${fields.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAI();

