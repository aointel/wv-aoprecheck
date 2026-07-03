/**
 * Backfill AI Call Summaries
 * Extracts summary, transcript, and result fields from audio_analysis JSONB
 * to individual columns for existing verification sessions
 */

import { supabaseAdmin } from './supabase';

async function backfillAICallSummaries() {
  console.log('\n🔄 BACKFILLING AI CALL SUMMARIES\n');
  console.log('='.repeat(60));

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    return;
  }

  try {
    // Find all sessions with audio_analysis but missing extracted fields
    // Include sessions where fields are "PENDING" or empty - these need to be fixed
    const { data: sessions, error: fetchError } = await supabaseAdmin
      .from('verification_sessions')
      .select('id, session_id, audio_analysis, call_transcript, taalk_ai_summary, ai_quick_recap, ai_result, ai_result_passed, call_analysis_complete')
      .not('audio_analysis', 'is', null)
      .limit(10000);
    
    console.log(`📊 Fetched ${sessions?.length || 0} sessions with audio_analysis`);

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found that need backfilling');
      return;
    }

    console.log(`📊 Found ${sessions.length} sessions with audio_analysis\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const session of sessions) {
      try {
        const audioAnalysis = session.audio_analysis;
        if (!audioAnalysis || typeof audioAnalysis !== 'object') {
          skipped++;
          continue;
        }

        // Check if fields are already populated - EXCLUDE "PENDING" as valid data
        const transcriptValue = session.call_transcript ? String(session.call_transcript).trim() : '';
        const summaryValue = session.taalk_ai_summary 
          ? (typeof session.taalk_ai_summary === 'string' ? session.taalk_ai_summary.trim() : String(session.taalk_ai_summary))
          : '';
        
        const isValidTranscript = transcriptValue !== '' && transcriptValue.toUpperCase() !== 'PENDING';
        const isValidSummary = summaryValue !== '' && summaryValue.toUpperCase() !== 'PENDING' && summaryValue !== '[]';
        
        // Only skip if BOTH fields are valid (not PENDING, not empty, not "[]")
        if (isValidTranscript && isValidSummary) {
          skipped++;
          continue;
        }

        // Extract fields from audio_analysis - ALWAYS extract if audio_analysis has the data
        const updateData: any = {};

        // Extract transcript - REPLACE even if it's "PENDING" or empty
        if (audioAnalysis.transcript && (!isValidTranscript || transcriptValue.toUpperCase() === 'PENDING')) {
          updateData.call_transcript = audioAnalysis.transcript;
          console.log(`  📝 Extracting transcript for session ${session.session_id}`);
        }

        // Extract summary - REPLACE even if it's "PENDING" or empty
        if (audioAnalysis.summary && (!isValidSummary || summaryValue.toUpperCase() === 'PENDING')) {
          updateData.taalk_ai_summary = audioAnalysis.summary;
          updateData.ai_quick_recap = audioAnalysis.summary; // Use summary as quick recap
          console.log(`  📝 Extracting summary for session ${session.session_id}`);
        }

        // Extract result fields
        if (audioAnalysis.validation) {
          if (!session.ai_result && audioAnalysis.validation.reason) {
            updateData.ai_result = audioAnalysis.validation.reason;
          }
          if (session.ai_result_passed === null || session.ai_result_passed === undefined) {
            updateData.ai_result_passed = audioAnalysis.validation.isValid ?? null;
          }
        }

        // Only update if there's something to update
        if (Object.keys(updateData).length === 0) {
          skipped++;
          continue;
        }

        // Update the session
        const { error: updateError } = await supabaseAdmin
          .from('verification_sessions')
          .update(updateData)
          .eq('id', session.id);

        if (updateError) {
          console.error(`❌ Failed to update session ${session.session_id}:`, updateError.message);
          errors++;
        } else {
          updated++;
          if (updated % 10 === 0) {
            console.log(`  ✅ Updated ${updated}/${sessions.length} sessions...`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing session ${session.session_id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 BACKFILL SUMMARY:');
    console.log(`   ✅ Updated: ${updated} sessions`);
    console.log(`   ⏭️  Skipped: ${skipped} sessions (already have data)`);
    console.log(`   ❌ Errors: ${errors} sessions`);
    console.log(`\n✅ Backfill complete!\n`);

  } catch (error: any) {
    console.error('❌ Fatal error during backfill:', error);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('backfill-ai-call-summaries.ts') ||
                     process.argv[1]?.endsWith('backfill-ai-call-summaries.js');

if (isMainModule || process.argv[1]?.includes('backfill-ai-call-summaries')) {
  backfillAICallSummaries()
    .then(() => {
      console.log('✅ Backfill script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { backfillAICallSummaries };
