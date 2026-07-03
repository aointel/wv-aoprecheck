/**
 * Process Twilio outbound calls for analysis
 * Downloads recordings, transcribes, and analyzes calls from twilio_call_logs
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './server/hardcoded-config';

async function processTwilioOutboundCalls() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials not configured');
    console.error('   Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables');
    process.exit(1);
  }

  console.log('\n🚀 PROCESSING TWILIO OUTBOUND CALLS FOR ANALYSIS\n');
  console.log('═'.repeat(70));

  // Get Twilio outbound calls that need analysis
  // Only calls that were answered and lasted at least 25 seconds
  const { data: twilioCalls, error: twilioError } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*')
    .eq('call_direction', 'outbound')
    .gte('call_duration', 25)
    .in('call_status', ['answered', 'completed'])
    .order('call_started_at', { ascending: false })
    .limit(100);

  if (twilioError) {
    console.error('❌ Error fetching Twilio calls:', twilioError);
    return;
  }

  if (!twilioCalls || twilioCalls.length === 0) {
    console.log('✅ No Twilio outbound calls found that need processing');
    return;
  }

  console.log(`📊 Found ${twilioCalls.length} Twilio outbound calls to process\n`);

  // Check which ones already have analysis
  const callSids = twilioCalls.map(c => c.twilio_call_sid);
  const { data: existingAnalyses } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('taalk_call_id, analysis_status, recording_url, transcript')
    .in('taalk_call_id', callSids);

  const analyzedSids = new Set(
    (existingAnalyses || [])
      .filter(a => a.analysis_status === 'completed' && a.recording_url && a.transcript)
      .map(a => a.taalk_call_id)
  );

  // Filter to only unanalyzed calls
  const unanalyzedCalls = twilioCalls.filter(
    c => !analyzedSids.has(c.twilio_call_sid)
  );

  console.log(`📊 Processing ${unanalyzedCalls.length} unanalyzed calls (${analyzedSids.size} already analyzed)\n`);

  if (unanalyzedCalls.length === 0) {
    console.log('✅ All calls already analyzed');
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const twilioCall of unanalyzedCalls) {
    processed++;
    const { twilio_call_sid, owner_email, call_started_at, call_duration } = twilioCall;

    console.log(`\n[${processed}/${unanalyzedCalls.length}] Processing: ${twilio_call_sid}`);
    console.log(`   Agent: ${owner_email || 'unknown'}`);
    console.log(`   Date: ${call_started_at}`);
    console.log(`   Duration: ${call_duration}s`);

    try {
      // Download recording from Twilio
      console.log(`   📥 Fetching recording from Twilio...`);
      
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${twilio_call_sid}/Recordings.json`;
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const recordingsResponse = await fetch(twilioUrl, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      
      if (!recordingsResponse.ok) {
        const errorText = await recordingsResponse.text().catch(() => '');
        throw new Error(`Twilio API error: ${recordingsResponse.status} - ${errorText.substring(0, 200)}`);
      }

      const recordingsData = await recordingsResponse.json();
      if (!recordingsData.recordings || recordingsData.recordings.length === 0) {
        console.log(`   ⚠️  No recordings found for this call`);
        failed++;
        continue;
      }

      // Get the first recording
      const recording = recordingsData.recordings[0];
      const recordingSid = recording.sid;
      console.log(`   ✅ Found recording: ${recordingSid}`);

      // Download the actual recording file
      const recordingDownloadUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`;
      console.log(`   📥 Downloading recording...`);
      
      const downloadResponse = await fetch(recordingDownloadUrl, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download recording: ${downloadResponse.status}`);
      }

      const arrayBuffer = await downloadResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`   ✅ Downloaded ${Math.round(buffer.length / 1024)}KB`);

      // Upload to Supabase Storage
      const fileName = `call-analysis/twilio-${twilio_call_sid}.mp3`;
      console.log(`   ☁️  Uploading to Supabase storage...`);
      
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('verify_agent_screenshot')
        .upload(fileName, buffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Generate signed URL
      const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from('verify_agent_screenshot')
        .createSignedUrl(fileName, 63072000); // 2 years

      if (urlError || !urlData?.signedUrl) {
        throw new Error(`Failed to generate signed URL: ${urlError?.message || 'Unknown error'}`);
      }

      const recordingUrl = urlData.signedUrl;
      console.log(`   ✅ Recording uploaded and URL generated`);

      // Transcribe and analyze
      console.log(`   🎤 Transcribing and analyzing...`);
      const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(recordingUrl, null);

      console.log(`   ✅ Analysis complete - Score: ${analysis.scorecard.overallScore.toFixed(1)}/100`);

      // Save to database
      const analysisData = {
        billing_transaction_id: `twilio-${twilio_call_sid}`,
        agent_email: owner_email || 'unknown',
        call_date: call_started_at || new Date().toISOString(),
        taalk_call_id: twilio_call_sid,
        recording_url: recordingUrl,
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
        compliance_flags: analysis.complianceFlags,
        key_moments: analysis.keyMoments,
        analyzed_at: new Date().toISOString(),
        analysis_status: 'completed',
        analysis_model: 'gpt-4o-mini',
        analysis_version: '1.0'
      };

      // Check if record exists
      const { data: existing } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id')
        .eq('taalk_call_id', twilio_call_sid)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabaseAdmin
          .from('taalk_call_analytics')
          .update(analysisData)
          .eq('id', existing.id);
        
        if (updateError) {
          throw new Error(`Database update error: ${updateError.message}`);
        }
        console.log(`   ✅ Updated analysis record: ${existing.id}`);
      } else {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('taalk_call_analytics')
          .insert(analysisData)
          .select()
          .single();
        
        if (insertError) {
          throw new Error(`Database insert error: ${insertError.message}`);
        }
        console.log(`   ✅ Created analysis record: ${inserted?.id}`);
      }

      succeeded++;

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failed++;

      // Mark as failed in database
      try {
        const { data: existing } = await supabaseAdmin
          .from('taalk_call_analytics')
          .select('id')
          .eq('taalk_call_id', twilio_call_sid)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from('taalk_call_analytics')
            .update({
              analysis_status: 'failed',
              analysis_error: error.message?.substring(0, 500)
            })
            .eq('id', existing.id);
        } else {
          await supabaseAdmin
            .from('taalk_call_analytics')
            .insert({
              billing_transaction_id: `twilio-${twilio_call_sid}`,
              agent_email: owner_email || 'unknown',
              call_date: call_started_at || new Date().toISOString(),
              taalk_call_id: twilio_call_sid,
              analysis_status: 'failed',
              analysis_error: error.message?.substring(0, 500)
            });
        }
      } catch (updateError) {
        console.error(`   ❌ Error updating failed status:`, updateError);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`✅ PROCESSING COMPLETE`);
  console.log(`   Succeeded: ${succeeded}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${processed}`);
  console.log(`${'═'.repeat(70)}\n`);
}

processTwilioOutboundCalls().catch(console.error);
