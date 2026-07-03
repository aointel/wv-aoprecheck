/**
 * Analyze all pending calls in taalk_call_analytics
 * 
 * Usage: npx tsx analyze-pending-calls.ts
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

async function analyzePendingCalls() {
  console.log('🚀 Starting analysis of pending calls...\n');
  
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin not initialized');
    }

    // Get all pending calls
    const { data: pendingCalls, error: fetchError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('*')
      .eq('analysis_status', 'pending')
      .order('call_date', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingCalls || pendingCalls.length === 0) {
      console.log('✅ No pending calls to analyze');
      return;
    }

    console.log(`📊 Found ${pendingCalls.length} pending calls to analyze\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pendingCalls.length; i++) {
      const call = pendingCalls[i];
      console.log(`\n[${i + 1}/${pendingCalls.length}] Analyzing call ${call.billing_transaction_id}...`);

      try {
        // Update status to analyzing
        await supabaseAdmin
          .from('taalk_call_analytics')
          .update({ analysis_status: 'analyzing' })
          .eq('id', call.id);

        // Analyze the call
        let analysis;
        if (call.transcript && call.transcript.trim().length > 0) {
          console.log(`  📝 Using existing transcript (${call.transcript.length} chars)`);
          analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(call.transcript);
        } else if (call.recording_url) {
          console.log(`  🎤 Transcribing and analyzing recording...`);
          analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(call.recording_url);
        } else {
          console.log(`  ⚠️  No transcript or recording available, skipping`);
          await supabaseAdmin
            .from('taalk_call_analytics')
            .update({ analysis_status: 'failed', coaching_notes: 'No transcript or recording available' })
            .eq('id', call.id);
          errorCount++;
          continue;
        }

        // Save analysis results
        const analysisData = {
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
          ai_analysis: analysis.aiAnalysis,
          analysis_status: 'completed',
          analyzed_at: new Date().toISOString()
        };

        // Update transcript if we generated one
        if (!call.transcript && analysis.transcript) {
          analysisData.transcript = analysis.transcript;
          analysisData.transcript_source = 'ai_transcription';
        }

        const { error: updateError } = await supabaseAdmin
          .from('taalk_call_analytics')
          .update(analysisData)
          .eq('id', call.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`  ✅ Analysis complete - Score: ${analysis.scorecard.overallScore.toFixed(1)}/100`);
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`  ❌ Error analyzing call:`, error.message);
        await supabaseAdmin
          .from('taalk_call_analytics')
          .update({ 
            analysis_status: 'failed',
            coaching_notes: `Analysis failed: ${error.message}` 
          })
          .eq('id', call.id);
        errorCount++;
      }
    }

    console.log(`\n✨ Done!`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
analyzePendingCalls()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

export { analyzePendingCalls };
