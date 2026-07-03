import fetch from 'node-fetch';

// Session with 563 screenshots - likely has real data
const sessionId = '552e3897-398c-435a-a900-05bb45500ef0';

console.log('🖼️  Analyzing session with 563 screenshots using Vision AI...\n');
console.log(`Session ID: ${sessionId}\n`);

try {
  const response = await fetch(`https://aoirail-production.up.railway.app/api/presentations/analyze-screenshots/${sessionId}`, {
    method: 'POST'
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('✅ VISION ANALYSIS COMPLETE!\n');
    console.log('Extracted from screenshots:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(data.extractedData, null, 2));
    console.log(`\n📸 Analyzed ${data.screenshotsAnalyzed} screenshots`);
  } else {
    console.error('❌ ANALYSIS FAILED');
    console.error('Error:', data.error);
  }
  
} catch (error) {
  console.error('❌ Request failed:', error.message);
}

