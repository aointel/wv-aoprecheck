/**
 * Backfill Script: Fetch Transcripts and AI Summaries for All Completed Sessions
 * 
 * This script finds all completed verification sessions with taalk_call_id
 * and fetches their transcripts and AI summaries from Taalk API.
 * 
 * Run with: node server/backfill-transcripts.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Use same credentials as server (from hardcoded-config.ts)
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

console.log('🔧 Supabase URL:', supabaseUrl);
console.log('🔧 Service Key:', supabaseServiceKey.substring(0, 30) + '...\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

async function fetchTranscriptAndSummary(taalkCallId) {
  let callTranscript = null;
  let aiSummaryData = null;
  let parsedSummary = {};

  // Fetch transcript
  try {
    const transcriptUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/transcript?db=michaelmandella`;
    const transcriptResponse = await fetch(transcriptUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });
    
    if (transcriptResponse.ok) {
      callTranscript = await transcriptResponse.text();
      console.log(`  ✅ Transcript: ${callTranscript.length} characters`);
    } else {
      console.log(`  ⚠️ Transcript not available: ${transcriptResponse.status}`);
    }
  } catch (error) {
    console.error(`  ❌ Error fetching transcript:`, error.message);
  }

  // Fetch AI summary
  try {
    const summaryUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/summary?db=michaelmandella`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });
    
    if (summaryResponse.ok) {
      const summaryJson = await summaryResponse.json();
      aiSummaryData = summaryJson.payload?.summary || summaryJson.summary || [];
      console.log(`  ✅ Summary: ${aiSummaryData.length} items`);
      
      // Parse summary array into individual fields
      for (const item of aiSummaryData) {
        const key = item.key?.toLowerCase() || '';
        const value = item.value;
        
        if (key.includes('quick recap')) parsedSummary.quickRecap = value;
        else if (key.includes('next steps')) parsedSummary.nextSteps = value;
        else if (key.includes('key topics') || key.includes('summary of key')) parsedSummary.keyTopics = value;
        else if (key.includes('sentiment')) parsedSummary.sentimentScore = parseInt(value) || null;
        else if (key.includes('refuse')) parsedSummary.userRefused = value?.toLowerCase() === 'true';
        else if (key.includes('preview')) parsedSummary.preview = value;
        else if (key.includes('result')) parsedSummary.result = value;
        else if (key.includes('red flag')) parsedSummary.redFlags = value;
        else if (key.includes('favorite feature')) parsedSummary.favoriteFeature = value;
        // Compliance fields
        else if (key.includes('agent confirmed')) parsedSummary.complianceAgentConfirmed = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('contact verified')) parsedSummary.complianceContactVerified = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('premium ok')) parsedSummary.compliancePremiumOk = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('medical q')) parsedSummary.complianceMedicalAsked = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('meds q')) parsedSummary.complianceMedsAsked = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('legal q')) parsedSummary.complianceLegalAsked = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('needs analysis')) parsedSummary.complianceNeedsAnalysis = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('all medical')) parsedSummary.complianceAllMedical = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('info accurate')) parsedSummary.complianceInfoAccurate = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('ach explained')) parsedSummary.complianceAchExplained = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('client satisfied')) parsedSummary.complianceClientSatisfied = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
      }
      
      // Determine if passed
      if (parsedSummary.result?.toLowerCase().includes('pass') || parsedSummary.preview?.toLowerCase().includes('pass')) {
        parsedSummary.resultPassed = true;
      } else if (parsedSummary.result?.toLowerCase().includes('fail') || parsedSummary.preview?.toLowerCase().includes('fail')) {
        parsedSummary.resultPassed = false;
      }
    } else {
      console.log(`  ⚠️ Summary not available: ${summaryResponse.status}`);
    }
  } catch (error) {
    console.error(`  ❌ Error fetching summary:`, error.message);
  }

  return { transcript: callTranscript, summary: aiSummaryData, parsedSummary };
}

async function backfillTranscripts() {
  console.log('🔄 Starting transcript/summary backfill...\n');
  
  try {
    // Get all completed sessions with taalk_call_id
    console.log('📊 Fetching completed sessions with taalk_call_id...');
    const { data: sessions, error: fetchError } = await supabase
      .from('verification_sessions')
      .select('id, session_id, taalk_call_id, call_transcript, taalk_ai_summary, completed_at')
      .eq('status', 'completed')
      .not('taalk_call_id', 'is', null)
      .order('completed_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('⚠️ No completed sessions with taalk_call_id found');
      return;
    }
    
    console.log(`✅ Found ${sessions.length} completed sessions with taalk_call_id\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`\n[${i + 1}/${sessions.length}] Processing session ${session.session_id}...`);
      console.log(`  Call ID: ${session.taalk_call_id}`);
      console.log(`  Completed: ${session.completed_at}`);
      
      // Check if already has data
      const hasTranscript = !!session.call_transcript;
      const hasSummary = !!session.taalk_ai_summary;
      
      if (hasTranscript && hasSummary) {
        console.log(`  ⏭️  Already has transcript and summary - skipping`);
        skippedCount++;
        continue;
      }
      
      if (hasTranscript) console.log(`  ℹ️  Already has transcript`);
      if (hasSummary) console.log(`  ℹ️  Already has summary`);
      
      // Fetch from Taalk
      const { transcript, summary, parsedSummary } = await fetchTranscriptAndSummary(session.taalk_call_id);
      
      // Build update object
      const updateData = {
        updated_at: new Date().toISOString()
      };
      
      if (transcript && !hasTranscript) {
        updateData.call_transcript = transcript;
        updatedCount++;
      }
      
      if (summary && !hasSummary) {
        updateData.taalk_ai_summary = summary;
        
        // Add parsed fields
        if (parsedSummary.quickRecap) updateData.ai_quick_recap = parsedSummary.quickRecap;
        if (parsedSummary.nextSteps) updateData.ai_next_steps = parsedSummary.nextSteps;
        if (parsedSummary.keyTopics) updateData.ai_key_topics = parsedSummary.keyTopics;
        if (parsedSummary.sentimentScore !== undefined) updateData.ai_sentiment_score = parsedSummary.sentimentScore;
        if (parsedSummary.userRefused !== undefined) updateData.ai_user_refused_call = parsedSummary.userRefused;
        if (parsedSummary.result) updateData.ai_result = parsedSummary.result;
        if (parsedSummary.resultPassed !== undefined) updateData.ai_result_passed = parsedSummary.resultPassed;
        if (parsedSummary.redFlags) updateData.ai_red_flags = parsedSummary.redFlags;
        if (parsedSummary.favoriteFeature) updateData.ai_favorite_feature = parsedSummary.favoriteFeature;
        if (parsedSummary.preview) updateData.ai_preview = parsedSummary.preview;
        
        // Compliance fields
        if (parsedSummary.complianceAgentConfirmed !== undefined) updateData.compliance_agent_confirmed = parsedSummary.complianceAgentConfirmed;
        if (parsedSummary.complianceContactVerified !== undefined) updateData.compliance_contact_verified = parsedSummary.complianceContactVerified;
        if (parsedSummary.compliancePremiumOk !== undefined) updateData.compliance_premium_ok = parsedSummary.compliancePremiumOk;
        if (parsedSummary.complianceMedicalAsked !== undefined) updateData.compliance_medical_asked = parsedSummary.complianceMedicalAsked;
        if (parsedSummary.complianceMedsAsked !== undefined) updateData.compliance_meds_asked = parsedSummary.complianceMedsAsked;
        if (parsedSummary.complianceLegalAsked !== undefined) updateData.compliance_legal_asked = parsedSummary.complianceLegalAsked;
        if (parsedSummary.complianceNeedsAnalysis !== undefined) updateData.compliance_needs_analysis = parsedSummary.complianceNeedsAnalysis;
        if (parsedSummary.complianceAllMedical !== undefined) updateData.compliance_all_medical = parsedSummary.complianceAllMedical;
        if (parsedSummary.complianceInfoAccurate !== undefined) updateData.compliance_info_accurate = parsedSummary.complianceInfoAccurate;
        if (parsedSummary.complianceAchExplained !== undefined) updateData.compliance_ach_explained = parsedSummary.complianceAchExplained;
        if (parsedSummary.complianceClientSatisfied !== undefined) updateData.compliance_client_satisfied = parsedSummary.complianceClientSatisfied;
        
        updatedCount++;
      }
      
      // Only update if we have new data
      if (Object.keys(updateData).length > 1) {
        const { error: updateError } = await supabase
          .from('verification_sessions')
          .update(updateData)
          .eq('session_id', session.session_id);
        
        if (updateError) {
          console.error(`  ❌ Failed to update:`, updateError.message);
          errorCount++;
        } else {
          console.log(`  ✅ Updated successfully`);
          successCount++;
        }
      } else {
        console.log(`  ⏭️  No new data to update`);
        skippedCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 BACKFILL COMPLETE!');
    console.log('='.repeat(70));
    console.log(`✅ Successfully updated: ${successCount} sessions`);
    console.log(`⏭️  Skipped (already had data): ${skippedCount} sessions`);
    console.log(`❌ Errors: ${errorCount} sessions`);
    console.log(`📊 Total processed: ${sessions.length} sessions`);
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('❌ Fatal error in backfill:', error);
  }
}

// Run the backfill
backfillTranscripts()
  .then(() => {
    console.log('✅ Backfill script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill script failed:', error);
    process.exit(1);
  });

