/**
 * Analyze all pending calls in taalk_call_analytics
 * Fetches fresh transcripts and analyzes them
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';

async function analyzePendingCalls() {
  console.log('🚀 Analyzing all pending calls...\n');
  
  if (!supabaseAdmin) {
    throw new Error('Supabase admin not initialized');
  }
  
  // Get all pending calls
  const { data: pendingCalls, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, taalk_call_id, transcript, analysis_status, agent_email, ai_analysis')
    .or('analysis_status.eq.pending,analysis_status.is.null,call_score.is.null')
    .order('call_date', { ascending: false })
    .limit(100);
  
  if (error) {
    throw error;
  }
  
  if (!pendingCalls || pendingCalls.length === 0) {
    console.log('✅ No pending calls found');
    return;
  }
  
  console.log(`📊 Found ${pendingCalls.length} pending calls to analyze\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < pendingCalls.length; i++) {
    const call = pendingCalls[i];
    console.log(`\n[${i + 1}/${pendingCalls.length}] Processing call ${call.id} (taalk_call_id: ${call.taalk_call_id})...`);
    
    try {
      // Fetch fresh transcript from Taalk
      let transcript = call.transcript;
      
      if (call.taalk_call_id) {
        console.log(`  📝 Fetching transcript from Taalk...`);
        try {
          const transcriptUrl = `https://api.taalk.ai/api/calls/${call.taalk_call_id}/transcript?db=michaelmandella`;
          const transcriptResponse = await fetch(transcriptUrl, {
            headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
          });
          
          if (transcriptResponse.ok) {
            const freshTranscript = await transcriptResponse.text();
            if (freshTranscript && freshTranscript.trim().length > 0) {
              transcript = freshTranscript;
              // Update transcript in database
              await supabaseAdmin
                .from('taalk_call_analytics')
                .update({ transcript: freshTranscript, transcript_source: 'taalk_api' })
                .eq('id', call.id);
              console.log(`  ✅ Fetched transcript (${freshTranscript.length} chars)`);
            } else {
              console.log(`  ⚠️  Transcript is empty`);
            }
          } else {
            console.log(`  ⚠️  Could not fetch transcript: ${transcriptResponse.status}`);
          }
        } catch (error: any) {
          console.error(`  ❌ Error fetching transcript: ${error.message}`);
        }
      }
      
      // Analyze if we have transcript
      if (transcript && transcript.trim().length > 0) {
        console.log(`  🎤 Analyzing transcript (${transcript.length} chars)...`);
        try {
          const analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
          console.log(`  ✅ Analysis complete - Score: ${analysis.scorecard.overallScore.toFixed(1)}/100`);
          
          // Preserve lead_info
          const currentAnalysis = call.ai_analysis || {};
          const updatedAnalysis = {
            ...currentAnalysis,
            ...(analysis.aiAnalysis || {}),
            lead_info: currentAnalysis.lead_info
          };
          
          await supabaseAdmin
            .from('taalk_call_analytics')
            .update({
              call_score: analysis.scorecard.overallScore,
              scorecard_results: analysis.scorecard,
              coaching_notes: analysis.coachingNotes,
              key_topics: analysis.keyTopics,
              objections_detected: analysis.objections,
              sentiment_score: analysis.sentimentScore,
              sentiment_label: analysis.sentiment,
              agent_talk_time_pct: analysis.agentTalkTimePct,
              client_engagement_level: analysis.clientEngagementLevel,
              call_outcome: analysis.callOutcome,
              call_outcome_confidence: analysis.callOutcomeConfidence,
              compliance_flags: analysis.complianceFlags,
              key_moments: analysis.keyMoments,
              ai_analysis: updatedAnalysis,
              analysis_status: 'completed',
              analyzed_at: new Date().toISOString()
            })
            .eq('id', call.id);
          
          console.log(`  ✅ Updated call ${call.id} with analysis results`);
          successCount++;
        } catch (analysisError: any) {
          console.error(`  ❌ Analysis failed: ${analysisError.message}`);
          errorCount++;
        }
      } else {
        console.log(`  ⚠️  No transcript available for analysis`);
        errorCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`  ❌ Error processing call ${call.id}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n✨ Done!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

analyzePendingCalls()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
