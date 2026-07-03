/**
 * Backfill: Analyze call_transcript for sessions missing audio_analysis
 * Many sessions have transcripts from Taalk but were never analyzed
 */

import { supabaseAdmin } from './supabase';
import { verificationAudioAnalyzer } from './verification-audio-analyzer';

async function backfillAnalyzeTranscripts() {
  console.log('\n🔄 BACKFILLING: Analyzing call_transcript for sessions missing audio_analysis\n');
  console.log('='.repeat(60));

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    return;
  }

  try {
    // Find NEWEST sessions with call_transcript but no audio_analysis
    // Only process the last 50 newest sessions
    const { data: sessions, error: fetchError } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, call_transcript, audio_analysis, call_analysis_complete, taalk_ai_summary, verification_method')
      .not('call_transcript', 'is', null)
      .neq('call_transcript', '')
      .neq('call_transcript', '[]')
      .neq('call_transcript', 'PENDING')
      .or('audio_analysis.is.null,call_analysis_complete.eq.false')
      .order('created_at', { ascending: false }) // NEWEST FIRST
      .limit(50); // ONLY LAST 50

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found that need transcript analysis');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions with call_transcript but missing audio_analysis\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const session of sessions) {
      try {
        // Skip if already has valid audio_analysis
        if (session.audio_analysis && session.call_analysis_complete === true) {
          skipped++;
          continue;
        }

        // Skip if transcript is invalid
        const transcript = session.call_transcript?.trim();
        if (!transcript || transcript === '' || transcript === '[]' || transcript.toUpperCase() === 'PENDING') {
          skipped++;
          continue;
        }

        console.log(`  📝 Analyzing transcript for session ${session.session_id}...`);

        // Analyze the transcript directly
        const transcriptAnalysis = await verificationAudioAnalyzer.analyzeTranscript(
          transcript,
          (session.verification_method || 'phone') as 'zoom' | 'phone' | 'conference'
        );

        // Convert to full analysis format
        const analysis = {
          transcript: transcript,
          ...transcriptAnalysis,
          confidence: transcriptAnalysis.validation?.confidence ?? 0,
          isLegitimate: transcriptAnalysis.validation?.isValid ?? false,
          analyzedAt: new Date().toISOString()
        };

        const confidence = analysis.validation?.confidence ?? analysis.confidence ?? 0;

        // Update the session with analysis results
        const updateData: any = {
          audio_analysis: analysis,
          call_analysis_complete: true,
          verification_result: analysis.isLegitimate ? 'COMPLETED' : 'FAILED',
          audio_analysis_retry_count: 0,
          // CRITICAL: Extract summary fields for frontend
          call_transcript: transcript, // Keep original transcript
          taalk_ai_summary: analysis.summary || null,
          ai_quick_recap: analysis.summary || null,
          ai_result: analysis.validation?.reason || null,
          ai_result_passed: analysis.validation?.isValid ?? null
        };

        const { error: updateError } = await supabaseAdmin
          .from('verification_sessions')
          .update(updateData)
          .eq('id', session.id);

        if (updateError) {
          console.error(`  ❌ Failed to update session ${session.session_id}:`, updateError.message);
          errors++;
        } else {
          updated++;
          console.log(`  ✅ Analyzed and saved: ${analysis.summary?.substring(0, 50)}...`);
          if (updated % 10 === 0) {
            console.log(`  📊 Progress: ${updated}/${sessions.length} sessions...`);
          }
        }

        // Rate limiting: Wait 2 seconds between API calls
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error: any) {
        console.error(`  ❌ Error processing session ${session.session_id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 BACKFILL SUMMARY:');
    console.log(`   ✅ Updated: ${updated} sessions`);
    console.log(`   ⏭️  Skipped: ${skipped} sessions`);
    console.log(`   ❌ Errors: ${errors} sessions`);
    console.log(`\n✅ Backfill complete!\n`);

  } catch (error: any) {
    console.error('❌ Fatal error during backfill:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('backfill-analyze-transcripts')) {
  backfillAnalyzeTranscripts()
    .then(() => {
      console.log('✅ Backfill script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { backfillAnalyzeTranscripts };
