/**
 * Diagnose a specific verification session
 */

import { supabaseAdmin } from './supabase';

async function diagnoseSession(phoneNumber: string, clientName?: string) {
  console.log('\n🔍 DIAGNOSING VERIFICATION SESSION\n');
  console.log('='.repeat(60));
  console.log(`📞 Phone: ${phoneNumber}`);
  if (clientName) console.log(`👤 Client: ${clientName}`);
  console.log('='.repeat(60) + '\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not configured');
    return;
  }

  try {
    // Find the session
    let query = supabaseAdmin
      .from('verification_sessions')
      .select('*')
      .eq('phone', phoneNumber)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: sessions, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Error fetching sessions:', fetchError);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('❌ No sessions found with that phone number');
      return;
    }

    // If client name provided, filter by it
    let targetSession = sessions[0];
    if (clientName) {
      const nameMatch = sessions.find(s => 
        s.first_name?.toLowerCase().includes(clientName.toLowerCase()) ||
        s.last_name?.toLowerCase().includes(clientName.toLowerCase())
      );
      if (nameMatch) {
        targetSession = nameMatch;
      }
    }

    console.log(`✅ Found session: ${targetSession.session_id}\n`);

    // Diagnose the session
    console.log('📊 SESSION DATA:');
    console.log(`   ID: ${targetSession.id}`);
    console.log(`   Session ID: ${targetSession.session_id}`);
    console.log(`   Client: ${targetSession.first_name} ${targetSession.last_name}`);
    console.log(`   Phone: ${targetSession.phone}`);
    console.log(`   Status: ${targetSession.status}`);
    console.log(`   Method: ${targetSession.verification_method}`);
    console.log(`   Created: ${targetSession.created_at}`);
    console.log(`   Completed: ${targetSession.completed_at || 'Not completed'}`);
    console.log('');

    console.log('📝 TRANSCRIPT DATA:');
    const hasTranscript = targetSession.call_transcript && 
      targetSession.call_transcript.trim() !== '' && 
      targetSession.call_transcript.trim() !== '[]' &&
      targetSession.call_transcript.trim().toUpperCase() !== 'PENDING';
    console.log(`   Has transcript: ${hasTranscript ? 'YES' : 'NO'}`);
    if (hasTranscript) {
      const transcriptPreview = targetSession.call_transcript.substring(0, 200);
      console.log(`   Preview: ${transcriptPreview}...`);
      console.log(`   Length: ${targetSession.call_transcript.length} characters`);
    } else {
      console.log(`   Value: ${targetSession.call_transcript || 'NULL'}`);
    }
    console.log('');

    console.log('🤖 AI ANALYSIS DATA:');
    console.log(`   call_analysis_complete: ${targetSession.call_analysis_complete || 'false'}`);
    console.log(`   audio_analysis: ${targetSession.audio_analysis ? 'EXISTS' : 'NULL'}`);
    console.log(`   taalk_ai_summary: ${targetSession.taalk_ai_summary || 'NULL'}`);
    if (targetSession.taalk_ai_summary) {
      const summaryPreview = String(targetSession.taalk_ai_summary).substring(0, 200);
      console.log(`   Summary preview: ${summaryPreview}...`);
    }
    console.log(`   ai_quick_recap: ${targetSession.ai_quick_recap || 'NULL'}`);
    console.log(`   ai_result: ${targetSession.ai_result || 'NULL'}`);
    console.log(`   ai_result_passed: ${targetSession.ai_result_passed ?? 'NULL'}`);
    console.log('');

    console.log('📹 RECORDING DATA:');
    console.log(`   recording_url: ${targetSession.recording_url || 'NULL'}`);
    console.log(`   taalk_call_id: ${targetSession.taalk_call_id || 'NULL'}`);
    console.log(`   taalk_call_status: ${targetSession.taalk_call_status || 'NULL'}`);
    console.log('');

    console.log('🔧 DIAGNOSIS:');
    const issues: string[] = [];

    if (!hasTranscript) {
      issues.push('❌ No transcript available - cannot analyze');
    } else if (targetSession.call_analysis_complete === false || !targetSession.audio_analysis) {
      issues.push('⚠️  Has transcript but no AI analysis - needs to be analyzed');
      if (!targetSession.audio_analysis_retry_count || targetSession.audio_analysis_retry_count < 1) {
        issues.push('   → This session should be picked up by the scheduler or backfill');
      } else {
        issues.push(`   → Retry count: ${targetSession.audio_analysis_retry_count} (may be maxed out)`);
      }
    } else if (!targetSession.taalk_ai_summary || 
               targetSession.taalk_ai_summary === '[]' || 
               targetSession.taalk_ai_summary === 'PENDING') {
      issues.push('⚠️  Has audio_analysis but summary field is empty/PENDING - needs extraction from JSONB');
    } else {
      issues.push('✅ Session appears to have valid AI summary');
    }

    if (issues.length === 0) {
      console.log('✅ No issues detected');
    } else {
      issues.forEach(issue => console.log(issue));
    }

    console.log('');

    // Try to fix it if there's an issue
    if (hasTranscript && (!targetSession.audio_analysis || targetSession.call_analysis_complete === false)) {
      console.log('🔧 FIXING SESSION...');
      const { verificationAudioAnalyzer } = await import('./verification-audio-analyzer');
      
      const transcript = targetSession.call_transcript.trim();
      console.log(`   Analyzing transcript (${transcript.length} chars)...`);
      
      const transcriptAnalysis = await verificationAudioAnalyzer.analyzeTranscript(
        transcript,
        (targetSession.verification_method || 'phone') as 'zoom' | 'phone' | 'conference'
      );

      const analysis = {
        transcript: transcript,
        ...transcriptAnalysis,
        confidence: transcriptAnalysis.validation?.confidence ?? 0,
        isLegitimate: transcriptAnalysis.validation?.isValid ?? false,
        analyzedAt: new Date().toISOString()
      };

      const updateData: any = {
        audio_analysis: analysis,
        call_analysis_complete: true,
        verification_result: analysis.isLegitimate ? 'COMPLETED' : 'FAILED',
        audio_analysis_retry_count: 0,
        call_transcript: transcript,
        taalk_ai_summary: analysis.summary || null,
        ai_quick_recap: analysis.summary || null,
        ai_result: analysis.validation?.reason || null,
        ai_result_passed: analysis.validation?.isValid ?? null
      };

      const { error: updateError } = await supabaseAdmin
        .from('verification_sessions')
        .update(updateData)
        .eq('id', targetSession.id);

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ FIXED! Session ${targetSession.session_id} now has AI summary`);
        console.log(`   Summary: ${analysis.summary?.substring(0, 100)}...`);
      }
    } else if (targetSession.audio_analysis && (!targetSession.taalk_ai_summary || targetSession.taalk_ai_summary === '[]' || targetSession.taalk_ai_summary === 'PENDING')) {
      console.log('🔧 EXTRACTING SUMMARY FROM audio_analysis JSONB...');
      
      const audioAnalysis = targetSession.audio_analysis;
      const updateData: any = {
        taalk_ai_summary: audioAnalysis.summary || null,
        ai_quick_recap: audioAnalysis.summary || null,
        ai_result: audioAnalysis.validation?.reason || null,
        ai_result_passed: audioAnalysis.validation?.isValid ?? null
      };

      const { error: updateError } = await supabaseAdmin
        .from('verification_sessions')
        .update(updateData)
        .eq('id', targetSession.id);

      if (updateError) {
        console.error(`   ❌ Failed to extract: ${updateError.message}`);
      } else {
        console.log(`   ✅ FIXED! Extracted summary from audio_analysis`);
        console.log(`   Summary: ${audioAnalysis.summary?.substring(0, 100)}...`);
      }
    }

    console.log('\n✅ Diagnosis complete!\n');

  } catch (error: any) {
    console.error('❌ Fatal error during diagnosis:', error);
  }
}

// Get phone number from command line args
const phoneNumber = process.argv[2];
const clientName = process.argv[3];

if (!phoneNumber) {
  console.error('Usage: tsx server/diagnose-session.ts <phone_number> [client_name]');
  console.error('Example: tsx server/diagnose-session.ts 7029045957 "Victoria"');
  process.exit(1);
}

diagnoseSession(phoneNumber, clientName)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
