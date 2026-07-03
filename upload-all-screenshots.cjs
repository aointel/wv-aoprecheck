const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function uploadAllScreenshots() {
  const sessionDir = 'recordings\\screenshots\\38ce5ab6-6200-47a9-bb47-aea5ce73eb9f';
  const oldSessionId = '38ce5ab6-6200-47a9-bb47-aea5ce73eb9f';
  
  console.log('📁 Looking for screenshots in:', sessionDir);
  
  // Check if this session exists in database
  const { data: existingSession } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('id', oldSessionId)
    .single();
  
  let sessionId;
  
  if (existingSession && existingSession.session_id) {
    console.log('✅ Found existing session:', existingSession.session_id);
    sessionId = existingSession.session_id;
  } else {
    console.log('🆕 Creating new session for these screenshots...');
    
    // Create a new session
    const response = await fetch('http://localhost:5000/api/presentations/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_email: 'cnsysop@aoglobelife.com',
        agent_name: 'Michael Mandella',
        presentation_url: 'https://hppro.planetaltig.com',
        presentation_type: 'hppro',
        window_title: 'HPPRO Presentation'
      })
    });
    
    const result = await response.json();
    sessionId = result.sessionId;
    console.log('✅ New session created:', sessionId);
  }
  
  // Get all screenshots
  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.png'))
    .sort();
  
  console.log(`📸 Found ${files.length} screenshots to upload`);
  console.log('🚀 Starting upload with AI analysis...\n');
  
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
      
      // Upload to server for AI analysis
      const response = await fetch('http://localhost:5000/api/presentations/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          screenshot_data: screenshot_data
        })
      });
      
      if (response.ok) {
        successCount++;
        console.log(`✅ [${i+1}/${files.length}] ${file} uploaded & analyzing...`);
      } else {
        failCount++;
        const error = await response.text();
        console.error(`❌ [${i+1}/${files.length}] ${file} failed:`, error);
      }
      
      // Delay to avoid overwhelming server
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      failCount++;
      console.error(`❌ [${i+1}/${files.length}] ${file} error:`, error.message);
    }
  }
  
  console.log('\n📊 UPLOAD COMPLETE:');
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Session ID: ${sessionId}`);
  
  // Wait for AI analysis to complete
  console.log('\n⏳ Waiting 5 seconds for AI analysis to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check the results
  const { data: finalSession } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  console.log('\n🎯 AI ANALYSIS RESULTS:');
  console.log('   Current Phase:', finalSession?.current_phase || 'NOT ANALYZED');
  console.log('   Client Name:', finalSession?.client_full_name || 'NO DATA');
  console.log('   Client Phone:', finalSession?.client_phone || 'NO DATA');
  console.log('   Client City:', finalSession?.client_city || 'NO DATA');
  console.log('   Client State:', finalSession?.client_state || 'NO DATA');
  console.log('   Lead Type:', finalSession?.lead_type || 'NO DATA');
  console.log('   Total Quotes:', finalSession?.total_quotes_generated || 0);
  console.log('   Carriers:', finalSession?.carriers_quoted || []);
  console.log('   Avg Premium:', finalSession?.average_premium ? '$' + finalSession.average_premium.toFixed(2) : 'N/A');
  console.log('   Application Started:', finalSession?.application_started || false);
  console.log('   Sale Made:', finalSession?.sale_made || false);
}

uploadAllScreenshots().catch(console.error);

