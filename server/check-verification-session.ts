/**
 * Check why a verification session failed
 * 
 * Usage:
 *   tsx server/check-verification-session.ts <session_id_or_phone>
 */

import { supabaseAdmin } from './supabase.js';

async function checkVerificationSession(identifier: string) {
  if (!supabaseAdmin) {
    console.error('❌ Supabase not available');
    process.exit(1);
  }

  try {
    // Try to find session by session_id or phone
    const { data: sessions, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('*')
      .or(`session_id.eq.${identifier},phone.eq.${identifier}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching session:', error);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log(`❌ No session found with identifier: ${identifier}`);
      return;
    }

    const session = sessions[0]; // Get most recent

    console.log('\n🔍 VERIFICATION SESSION ANALYSIS');
    console.log('='.repeat(80));
    console.log(`Session ID: ${session.session_id}`);
    console.log(`Client: ${session.first_name} ${session.last_name}`);
    console.log(`Phone: ${session.phone}`);
    console.log(`Producer: ${session.company_email || session.agent_email}`);
    console.log(`Status: ${session.status}`);
    console.log(`Created: ${new Date(session.created_at).toLocaleString()}`);
    console.log(`\n🎯 VERIFICATION RESULT: ${session.verification_result || 'NOT SET'}`);

    // Check Screenshot
    console.log('\n📸 SCREENSHOT VALIDATION:');
    if (session.screenshot_url && session.screenshot_url !== 'PENDING') {
      console.log(`   URL: ${session.screenshot_url.substring(0, 80)}...`);
      if (session.screenshot_validation) {
        const validation = typeof session.screenshot_validation === 'string' 
          ? JSON.parse(session.screenshot_validation) 
          : session.screenshot_validation;
        console.log(`   ✅ Valid: ${validation.isValid}`);
        console.log(`   Confidence: ${validation.confidence || 0}`);
        console.log(`   Type: ${validation.validationType || 'unknown'}`);
        console.log(`   Reason: ${validation.reason || 'N/A'}`);
        if (validation.issues && validation.issues.length > 0) {
          console.log(`   Issues: ${validation.issues.join(', ')}`);
        }
      } else {
        console.log('   ⚠️ Validation not completed yet');
      }
    } else {
      console.log('   ❌ NO SCREENSHOT - This will cause FAILED status');
    }

    // Check Audio/Call Analysis
    console.log('\n🎵 AUDIO ANALYSIS:');
    if (session.recording_url && session.recording_url !== 'PENDING') {
      console.log(`   Recording URL: ${session.recording_url.substring(0, 80)}...`);
      if (session.audio_analysis) {
        const audio = typeof session.audio_analysis === 'string'
          ? JSON.parse(session.audio_analysis)
          : session.audio_analysis;
        console.log(`   ✅ Legitimate: ${audio.isLegitimate !== false}`);
        console.log(`   Confidence: ${audio.confidence || audio.validation?.confidence || 0}`);
        console.log(`   Summary: ${audio.summary || 'N/A'}`);
        if (audio.validation) {
          console.log(`   Validation Reason: ${audio.validation.reason || 'N/A'}`);
          if (audio.validation.detectedIssues && audio.validation.detectedIssues.length > 0) {
            console.log(`   Issues: ${audio.validation.detectedIssues.join(', ')}`);
          }
        }
      } else {
        console.log('   ⚠️ Analysis not completed yet');
      }
    } else {
      console.log('   ℹ️ No recording URL (may not be required for phone verifications)');
    }

    // Check Taalk AI Summary (the 9/10 score)
    console.log('\n🤖 TALK AI SUMMARY (Taalk Analysis):');
    if (session.taalk_ai_summary) {
      const summary = typeof session.taalk_ai_summary === 'string'
        ? JSON.parse(session.taalk_ai_summary)
        : session.taalk_ai_summary;
      console.log(`   Quick Recap: ${session.ai_quick_recap || summary.quickRecap || 'N/A'}`);
      console.log(`   Sentiment Score: ${session.ai_sentiment_score || summary.sentimentScore || 'N/A'}`);
      console.log(`   Result: ${session.ai_result || summary.result || 'N/A'}`);
      console.log(`   Result Passed: ${session.ai_result_passed}`);
      console.log(`   Key Topics: ${session.ai_key_topics || summary.keyTopics || 'N/A'}`);
      console.log(`   Next Steps: ${session.ai_next_steps || summary.nextSteps || 'N/A'}`);
    } else {
      console.log('   ⚠️ No Taalk AI summary available');
    }

    // Check compliance checklist
    console.log('\n✅ COMPLIANCE CHECKLIST:');
    console.log(`   Agent Confirmed: ${session.compliance_agent_confirmed ?? 'N/A'}`);
    console.log(`   Contact Verified: ${session.compliance_contact_verified ?? 'N/A'}`);
    console.log(`   Premium OK: ${session.compliance_premium_ok ?? 'N/A'}`);
    console.log(`   Client Satisfied: ${session.compliance_client_satisfied ?? 'N/A'}`);
    console.log(`   Info Accurate: ${session.compliance_info_accurate ?? 'N/A'}`);

    // Why did it fail?
    console.log('\n🚩 WHY DID IT FAIL?');
    console.log('='.repeat(80));
    
    const reasons: string[] = [];

    // Check screenshot
    if (!session.screenshot_url || session.screenshot_url === 'PENDING') {
      reasons.push('❌ NO SCREENSHOT - Screenshot is required for verification');
    } else if (session.screenshot_validation) {
      const validation = typeof session.screenshot_validation === 'string'
        ? JSON.parse(session.screenshot_validation)
        : session.screenshot_validation;
      if (!validation.isValid) {
        reasons.push(`❌ SCREENSHOT INVALID - ${validation.reason || 'Screenshot did not meet requirements'}`);
      }
    } else {
      reasons.push('⚠️ SCREENSHOT NOT ANALYZED - Analysis may be pending');
    }

    // Check audio
    if (session.audio_analysis) {
      const audio = typeof session.audio_analysis === 'string'
        ? JSON.parse(session.audio_analysis)
        : session.audio_analysis;
      if (audio.isLegitimate === false) {
        reasons.push(`❌ AUDIO ANALYSIS FAILED - ${audio.validation?.reason || 'Call did not meet verification requirements'}`);
      }
    }

    // Check status
    if (session.status !== 'completed') {
      reasons.push(`⚠️ STATUS IS '${session.status}' - Should be 'completed' for verification to pass`);
    }

    if (reasons.length === 0) {
      console.log('✅ No obvious reasons for failure found. Check verification_result field.');
      if (session.verification_result === 'FAILED') {
        console.log('\n💡 The verification_result is set to FAILED, but all checks passed.');
        console.log('   This may be a bug. The verification_result is set by:');
        console.log('   1. Screenshot validation (validation.isValid)');
        console.log('   2. Audio analysis (analysis.isLegitimate)');
        console.log('\n   The 9/10 score from Taalk AI summary does NOT determine verification_result.');
        console.log('   Taalk AI summary is separate from the verification validation.');
      }
    } else {
      reasons.forEach((reason, i) => {
        console.log(`${i + 1}. ${reason}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n💡 NOTE: The 9/10 score from Taalk AI summary is SEPARATE from verification_result.');
    console.log('   verification_result is determined by:');
    console.log('   - Screenshot validation (must be valid)');
    console.log('   - Audio analysis (must be legitimate)');
    console.log('\n   Even if Taalk AI gives a 9/10, if screenshot is invalid or audio');
    console.log('   analysis fails, verification_result will be FAILED.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage: tsx server/check-verification-session.ts <session_id_or_phone>');
  process.exit(1);
}

checkVerificationSession(identifier).then(() => process.exit(0)).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

