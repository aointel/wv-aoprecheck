const fs = require('fs');
const path = require('path');

async function uploadRealScreenshots() {
  const sessionId = 'session_1760815246680_exa8ai6rs';
  const sessionDir = `recordings\\screenshots\\${sessionId}`;
  
  console.log('📁 Uploading REAL HPPRO screenshots from:', sessionDir);
  
  // Get all screenshots
  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith('.png'))
    .sort();
  
  console.log(`📸 Found ${files.length} REAL HPPRO screenshots\n`);
  
  let successCount = 0;
  let failCount = 0;
  let analysisResults = {
    lead_selection: 0,
    price_quotes: 0,
    product_comparison: 0,
    enrollment: 0,
    analytics_summary: 0,
    other: 0
  };
  
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
        console.log(`✅ [${i+1}/${files.length}] ${file} uploaded & AI analyzing...`);
      } else {
        failCount++;
        const error = await response.text();
        console.error(`❌ [${i+1}/${files.length}] Failed:`, error.substring(0, 100));
      }
      
      // Delay to avoid overwhelming server and allow AI analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      failCount++;
      console.error(`❌ [${i+1}/${files.length}] Error:`, error.message);
    }
  }
  
  console.log('\n📊 UPLOAD COMPLETE:');
  console.log(`   Success: ${successCount}/${files.length}`);
  console.log(`   Failed: ${failCount}`);
  
  // Wait for AI to finish
  console.log('\n⏳ Waiting 10 seconds for AI analysis to complete...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Check results
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    'https://ycztjetxwpfgtrzeyytt.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
  );
  
  const { data: session } = await supabase
    .from('presentation_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  console.log('\n🎯 REAL HPPRO DATA EXTRACTED:');
  console.log('   Current Phase:', session?.current_phase || 'NOT ANALYZED');
  console.log('   Client Name:', session?.client_full_name || 'NOT EXTRACTED');
  console.log('   Client Phone:', session?.client_phone || 'NOT EXTRACTED');
  console.log('   Client City:', session?.client_city || 'NOT EXTRACTED');
  console.log('   Client State:', session?.client_state || 'NOT EXTRACTED');
  console.log('   Lead Type:', session?.lead_type || 'NOT EXTRACTED');
  console.log('   Total Quotes:', session?.total_quotes_generated || 0);
  console.log('   Carriers:', session?.carriers_quoted || []);
  console.log('   Avg Premium:', session?.average_premium ? '$' + session.average_premium.toFixed(2) : 'N/A');
  console.log('   Application Started:', session?.application_started || false);
  console.log('   Sale Made:', session?.sale_made || false);
  
  // Check milestones
  const { data: milestones } = await supabase
    .from('hppro_presentation_milestones')
    .select('milestone_type')
    .eq('session_id', sessionId);
  
  if (milestones) {
    milestones.forEach(m => {
      analysisResults[m.milestone_type] = (analysisResults[m.milestone_type] || 0) + 1;
    });
    
    console.log('\n📊 MILESTONE BREAKDOWN:');
    console.log('   Lead Selection screens:', analysisResults.lead_selection);
    console.log('   Price Quotes screens:', analysisResults.price_quotes);
    console.log('   Product Comparison screens:', analysisResults.product_comparison);
    console.log('   Enrollment screens:', analysisResults.enrollment);
    console.log('   Analytics Summary screens:', analysisResults.analytics_summary);
    console.log('   Other screens:', analysisResults.other);
  }
}

uploadRealScreenshots().catch(console.error);

