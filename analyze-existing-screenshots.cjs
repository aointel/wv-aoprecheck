const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://pscpjfkhvdozqzhglxyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzY3BqZmtodmRvenF6aGdseHlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTU2NzU2OSwiZXhwIjoyMDQxMTQzNTY5fQ.u4VY3K2BoOnixHBPPLXZ-nD0CBlE5kpH0LIOhvDfwFo'
);

async function analyzeSession(sessionId) {
  console.log(`\n🎯 Analyzing session: ${sessionId}`);
  
  // Get all screenshots for this session
  const screenshotDir = path.join(__dirname, 'recordings', 'screenshots', sessionId);
  
  if (!fs.existsSync(screenshotDir)) {
    console.log(`❌ Directory not found: ${screenshotDir}`);
    return;
  }
  
  const screenshots = fs.readdirSync(screenshotDir)
    .filter(f => f.endsWith('.png'))
    .sort();
  
  console.log(`📸 Found ${screenshots.length} screenshots`);
  
  // Send each screenshot to the analyzer
  for (let i = 0; i < screenshots.length; i++) {
    const screenshotPath = path.join(screenshotDir, screenshots[i]);
    const screenshotData = fs.readFileSync(screenshotPath, 'base64');
    
    console.log(`\n🤖 Analyzing screenshot ${i + 1}/${screenshots.length}: ${screenshots[i]}`);
    
    try {
      const response = await fetch('http://localhost:5000/api/presentations/screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          screenshotData: `data:image/png;base64,${screenshotData}`
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`   ✅ Screenshot analyzed and saved`);
      } else {
        console.log(`   ⚠️ Analysis completed but may have issues`);
      }
    } catch (error) {
      console.error(`   ❌ Error analyzing screenshot:`, error.message);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n✅ Session analysis complete!`);
  
  // Fetch the updated session data
  const { data: session, error } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  if (error) {
    console.log('❌ Error fetching session:', error);
    return;
  }
  
  console.log('\n📊 EXTRACTED DATA:');
  console.log('==================');
  
  // Show all non-null fields
  const extractedFields = {};
  for (const [key, value] of Object.entries(session)) {
    if (value !== null && !['id', 'session_id', 'created_at', 'updated_at', 'ended_at'].includes(key)) {
      extractedFields[key] = value;
    }
  }
  
  console.log(JSON.stringify(extractedFields, null, 2));
}

// Analyze the session with the actual HPPRO screenshots
const sessionId = 'session_1760815246680_exa8ai6rs';
analyzeSession(sessionId).catch(console.error);

