/**
 * Test call analytics pipeline: MP3 -> analyze -> update
 * Run: npx tsx server/scripts/test-call-analytics-api.ts
 *
 * Fetches one PENDING call with Supabase recording URL, runs full analysis, updates DB.
 * Use this to verify: download works, Whisper works, GPT works, DB update works.
 */

import { supabaseAdmin } from '../supabase';
import { callAnalyticsAnalyzer } from '../call-analytics-analyzer';
import { uploadTranscriptToSupabase } from '../call-analytics-transcript-upload';

async function main() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase not configured');
    process.exit(1);
  }

  console.log('🔍 Step 1: Fetch one PENDING call with Supabase recording URL...\n');
  const { data: rows, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, taalk_call_id, billing_transaction_id, recording_url, agent_email, call_date, analysis_status')
    .eq('analysis_status', 'pending')
    .ilike('recording_url', '%supabase%')
    .order('call_date', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ DB fetch failed:', error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log('⚠️ No PENDING calls with Supabase recording URL found.');
    console.log('   Try a completed one to test the analyzer:');
    const { data: fallback } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id, taalk_call_id, billing_transaction_id, recording_url')
      .not('recording_url', 'is', null)
      .ilike('recording_url', '%supabase%')
      .order('call_date', { ascending: false })
      .limit(1);
    if (fallback?.length) {
      console.log('   Found completed call - will test analyzer only (no DB update)');
      const row = fallback[0];
      const url = (row as any).recording_url;
      console.log('   URL:', url?.substring(0, 80) + '...');
      console.log('\n🔍 Step 2: Running analyzer...\n');
      const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(url, null);
      console.log('\n✅ Analyzer OK! Score:', analysis.scorecard.overallScore, 'Outcome:', analysis.outcome);
    }
    process.exit(0);
  }

  const row = rows[0] as any;
  const url = row.recording_url?.trim();
  if (!url || !url.includes('supabase')) {
    console.error('❌ No valid Supabase recording URL');
    process.exit(1);
  }

  console.log('   Found:', row.billing_transaction_id, '|', row.taalk_call_id);
  console.log('   URL:', url.substring(0, 80) + '...\n');

  console.log('🔍 Step 2: Download + Transcribe + Analyze...\n');
  let analysis;
  try {
    analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(url, null);
    console.log('\n   ✅ Analysis complete. Score:', analysis.scorecard.overallScore, '| Outcome:', analysis.outcome);
  } catch (e: any) {
    console.error('\n❌ Analyzer failed:', e?.message || e);
    console.error('   Check: OpenAI API key, URL validity (signed URLs expire), network.');
    process.exit(1);
  }

  console.log('\n🔍 Step 3: Update DB...\n');
  const analysisData = {
    transcript: analysis.transcript,
    transcript_source: 'ai_transcription',
    ai_analysis: analysis,
    call_score: analysis.scorecard.overallScore,
    scorecard_results: analysis.scorecard,
    coaching_notes: analysis.coachingNotes?.join('\n') || null,
    key_topics: analysis.keyTopics,
    objections_detected: analysis.objectionsDetected,
    sentiment_score: analysis.sentimentScore,
    sentiment_label: analysis.sentiment,
    agent_talk_time_pct: analysis.agentTalkTimePct,
    client_engagement_level: analysis.clientEngagementLevel,
    call_outcome: analysis.callOutcome,
    call_outcome_confidence: analysis.callOutcomeConfidence,
    outcome: analysis.outcome,
    compliance_flags: analysis.complianceFlags,
    key_moments: analysis.keyMoments,
    analyzed_at: new Date().toISOString(),
    analysis_status: 'completed',
    analysis_model: 'gpt-4o-mini',
    analysis_version: '1.0',
  };

  const { error: updateErr } = await supabaseAdmin
    .from('taalk_call_analytics')
    .update(analysisData)
    .eq('id', row.id);

  if (updateErr) {
    console.error('❌ DB update failed:', updateErr.message);
    process.exit(1);
  }

  await uploadTranscriptToSupabase(row.billing_transaction_id || '', analysis.transcript || '');

  console.log('   ✅ DB updated. ID:', row.id);
  console.log('\n✅ Full pipeline OK: MP3 -> analyze -> update');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
