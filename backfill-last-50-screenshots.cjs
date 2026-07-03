/**
 * Backfill Last 50 Most Recent Verification Sessions with Screenshot Analysis
 * Tests the screenshot validation and processes the 50 most recent sessions
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillLast50Screenshots() {
  console.log('\n🔍 Fetching last 50 verification sessions with screenshots...\n');
  
  // Get last 50 sessions with screenshots, ordered by most recent first
  const { data: sessions, error: fetchError } = await supabase
    .from('verification_sessions')
    .select('id, session_id, screenshot_url, screenshot_path, screenshot_analysis_complete, verification_method, created_at')
    .not('screenshot_url', 'is', null)
    .neq('screenshot_url', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (fetchError) {
    console.error('❌ Error fetching sessions:', fetchError);
    return;
  }
  
  if (!sessions || sessions.length === 0) {
    console.log('⚠️  No sessions with screenshots found');
    return;
  }
  
  console.log(`✅ Found ${sessions.length} sessions with screenshots\n`);
  
  // Process each session
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    console.log(`\n[${i + 1}/${sessions.length}] Processing session ${session.session_id}...`);
    console.log(`   Created: ${session.created_at}`);
    console.log(`   Screenshot: ${session.screenshot_url || session.screenshot_path || 'N/A'}`);
    console.log(`   Already analyzed: ${session.screenshot_analysis_complete || false}`);
    
    try {
      // Call the validation endpoint
      const screenshotUrl = session.screenshot_url || session.screenshot_path;
      if (!screenshotUrl || screenshotUrl === 'PENDING') {
        console.log('   ⏭️  Skipping - no valid screenshot URL');
        continue;
      }
      
      // Fetch screenshot data
      let screenshotData;
      if (screenshotUrl.startsWith('data:')) {
        screenshotData = screenshotUrl;
      } else if (screenshotUrl.startsWith('http')) {
        // Fetch from URL
        const response = await fetch(screenshotUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        screenshotData = `data:image/png;base64,${base64}`;
      } else {
        // Assume it's a path in Supabase storage
        const { data: fileData, error: fileError } = await supabase.storage
          .from('verify_agent_screenshot')
          .download(screenshotUrl);
        
        if (fileError) {
          console.error(`   ❌ Error fetching screenshot: ${fileError.message}`);
          errorCount++;
          continue;
        }
        
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        screenshotData = `data:image/png;base64,${base64}`;
      }
      
      // Call validation API
      console.log('   🤖 Calling screenshot validation API...');
      const validationResponse = await fetch('http://localhost:5000/api/verification/validate-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: screenshotData,
          verificationMethod: session.verification_method || 'zoom'
        })
      });
      
      if (!validationResponse.ok) {
        const errorText = await validationResponse.text();
        console.error(`   ❌ Validation API error (${validationResponse.status}): ${errorText}`);
        errorCount++;
        continue;
      }
      
      const validation = await validationResponse.json();
      
      // Update session with validation results
      const { error: updateError } = await supabase
        .from('verification_sessions')
        .update({
          screenshot_validation: validation,
          screenshot_analysis_complete: true,
          screenshot_analysis_confidence: validation?.confidence ?? 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);
      
      if (updateError) {
        console.error(`   ❌ Error updating session: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Analyzed: ${validation.isValid ? 'VALID' : 'INVALID'} (${(validation.confidence * 100).toFixed(0)}% confidence)`);
        console.log(`      Type: ${validation.validationType}`);
        console.log(`      Reason: ${validation.reason?.substring(0, 100)}...`);
        successCount++;
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Error processing session: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n\n✅ BACKFILL COMPLETE:`);
  console.log(`   Successfully analyzed: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total processed: ${sessions.length}\n`);
}

// Run the backfill
backfillLast50Screenshots().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

