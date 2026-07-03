/**
 * Check which verification sessions are missing AI summaries
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './server/hardcoded-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkMissingSummaries() {
  console.log('\n🔍 CHECKING VERIFICATION SESSIONS MISSING AI SUMMARIES\n');
  console.log('='.repeat(60));

  try {
    // Get all completed sessions
    const { data: allSessions, error: allError } = await supabase
      .from('verification_sessions')
      .select('id, session_id, status, taalk_call_id, call_transcript, taalk_ai_summary, ai_quick_recap, created_at, completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1000);

    if (allError) {
      console.error('❌ Error fetching sessions:', allError);
      return;
    }

    if (!allSessions || allSessions.length === 0) {
      console.log('⚠️ No completed sessions found');
      return;
    }

    console.log(`📊 Total completed sessions: ${allSessions.length}\n`);

    // Check which ones have taalk_call_id
    const withCallId = allSessions.filter(s => s.taalk_call_id);
    console.log(`📞 Sessions with taalk_call_id: ${withCallId.length}`);
    console.log(`📞 Sessions without taalk_call_id: ${allSessions.length - withCallId.length}\n`);

    // Check which ones are missing summaries
    const missingSummary = allSessions.filter(session => {
      const hasSummary = session.taalk_ai_summary && 
                        (Array.isArray(session.taalk_ai_summary) ? session.taalk_ai_summary.length > 0 :
                         typeof session.taalk_ai_summary === 'string' ? session.taalk_ai_summary.trim() !== '' && session.taalk_ai_summary.trim() !== '[]' :
                         !!session.taalk_ai_summary);
      return !hasSummary;
    });

    const missingSummaryWithCallId = missingSummary.filter(s => s.taalk_call_id);
    const missingSummaryWithoutCallId = missingSummary.filter(s => !s.taalk_call_id);

    console.log(`🔴 Sessions missing AI summary: ${missingSummary.length}`);
    console.log(`   - With taalk_call_id (can fetch): ${missingSummaryWithCallId.length}`);
    console.log(`   - Without taalk_call_id (cannot fetch): ${missingSummaryWithoutCallId.length}\n`);

    // Check which ones are missing transcripts
    const missingTranscript = allSessions.filter(session => {
      const hasTranscript = session.call_transcript && 
                           session.call_transcript.trim() !== '' && 
                           session.call_transcript.trim() !== '[]';
      return !hasTranscript;
    });

    const missingTranscriptWithCallId = missingTranscript.filter(s => s.taalk_call_id);
    const missingTranscriptWithoutCallId = missingTranscript.filter(s => !s.taalk_call_id);

    console.log(`🔴 Sessions missing transcript: ${missingTranscript.length}`);
    console.log(`   - With taalk_call_id (can fetch): ${missingTranscriptWithCallId.length}`);
    console.log(`   - Without taalk_call_id (cannot fetch): ${missingTranscriptWithoutCallId.length}\n`);

    // Show breakdown by date
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const missingLast24h = missingSummary.filter(s => new Date(s.completed_at || s.created_at) >= last24h);
    const missingLast7d = missingSummary.filter(s => new Date(s.completed_at || s.created_at) >= last7d);
    const missingLast30d = missingSummary.filter(s => new Date(s.completed_at || s.created_at) >= last30d);

    console.log(`📅 Missing summaries by timeframe:`);
    console.log(`   - Last 24 hours: ${missingLast24h.length}`);
    console.log(`   - Last 7 days: ${missingLast7d.length}`);
    console.log(`   - Last 30 days: ${missingLast30d.length}\n`);

    // Show sample of missing summaries with call IDs (can be fetched)
    if (missingSummaryWithCallId.length > 0) {
      console.log(`\n📋 Sample of sessions missing summaries (with taalk_call_id - can be fetched):`);
      missingSummaryWithCallId.slice(0, 10).forEach(session => {
        const age = Math.round((Date.now() - new Date(session.completed_at || session.created_at).getTime()) / (1000 * 60 * 60));
        console.log(`   - ${session.session_id} (${age} hours ago, call_id: ${session.taalk_call_id})`);
      });
      if (missingSummaryWithCallId.length > 10) {
        console.log(`   ... and ${missingSummaryWithCallId.length - 10} more`);
      }
    }

    // Show sample of missing summaries without call IDs (cannot be fetched)
    if (missingSummaryWithoutCallId.length > 0) {
      console.log(`\n⚠️ Sample of sessions missing summaries (NO taalk_call_id - cannot fetch):`);
      missingSummaryWithoutCallId.slice(0, 10).forEach(session => {
        const age = Math.round((Date.now() - new Date(session.completed_at || session.created_at).getTime()) / (1000 * 60 * 60));
        console.log(`   - ${session.session_id} (${age} hours ago, NO call_id)`);
      });
      if (missingSummaryWithoutCallId.length > 10) {
        console.log(`   ... and ${missingSummaryWithoutCallId.length - 10} more`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('💡 RECOMMENDATION:');
    if (missingSummaryWithCallId.length > 0) {
      console.log(`   Run backfill script to fetch ${missingSummaryWithCallId.length} missing summaries:`);
      console.log(`   npx tsx server/backfill-all-transcripts.ts`);
    }
    if (missingSummaryWithoutCallId.length > 0) {
      console.log(`   ⚠️ ${missingSummaryWithoutCallId.length} sessions have no taalk_call_id - these cannot be fetched`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMissingSummaries()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });

