/**
 * Backfill call analytics: Download recordings from Twilio, transcribe, and analyze
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

async function backfillRecordings() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Twilio credentials not configured');
    process.exit(1);
  }

  console.log('\n🚀 BACKFILLING CALL ANALYTICS: Recordings, Transcripts, Analysis\n');
  console.log('═'.repeat(70));

  // Get all records without recordings/transcripts/analysis
  const { data: records, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, agent_email, call_date, taalk_call_id, recording_url, transcript, analysis_status')
    .or('recording_url.is.null,transcript.is.null,analysis_status.neq.completed')
    .order('call_date', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Found ${records?.length || 0} records needing backfill\n`);

  if (!records || records.length === 0) {
    console.log('✅ All records already have recordings/transcripts/analysis');
    return;
  }

  const stats = {
    processed: 0,
    recordingsDownloaded: 0,
    transcriptsFetched: 0,
    analyzed: 0,
    errors: 0
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    stats.processed++;

    console.log(`\n[${i + 1}/${records.length}] Processing ${record.billing_transaction_id}...`);
    console.log(`   Agent: ${record.agent_email}`);
    console.log(`   Twilio SID: ${record.taalk_call_id || 'N/A'}`);

    try {
      let recordingUrl = record.recording_url;
      let transcript = record.transcript;

      // 1. Download recording from Twilio if missing
      if (!recordingUrl && record.taalk_call_id) {
        console.log(`   📥 Downloading recording from Twilio...`);
        try {
          const twilioUrl = `https://${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}@api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${record.taalk_call_id}/Recordings.json`;
          const recordingsResponse = await fetch(twilioUrl);

          if (recordingsResponse.ok) {
            const recordingsData = await recordingsResponse.json();
            if (recordingsData.recordings && recordingsData.recordings.length > 0) {
              const recording = recordingsData.recordings[0];
              const recordingSid = recording.sid;

              // Download the actual recording file
              const recordingDownloadUrl = `https://${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}@api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`;
              const downloadResponse = await fetch(recordingDownloadUrl);

              if (downloadResponse.ok) {
                const arrayBuffer = await downloadResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // Upload to Supabase Storage
                const fileName = `call-analysis/twilio-${record.taalk_call_id}.mp3`;
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                  .from('verify_agent_screenshot')
                  .upload(fileName, buffer, {
                    contentType: 'audio/mpeg',
                    upsert: true
                  });

                if (!uploadError) {
                  // Generate signed URL (2 years)
                  const { data: signedData } = await supabaseAdmin.storage
                    .from('verify_agent_screenshot')
                    .createSignedUrl(fileName, 63072000);

                  recordingUrl = signedData?.signedUrl || null;
                  console.log(`   ✅ Downloaded and stored recording (${Math.round(buffer.length / 1024)}KB)`);
                  stats.recordingsDownloaded++;
                } else {
                  console.error(`   ❌ Upload failed:`, uploadError);
                }
              } else {
                console.log(`   ⚠️  Recording download failed: ${downloadResponse.status}`);
              }
            } else {
              console.log(`   ⚠️  No recordings found for Twilio call`);
            }
          } else {
            console.log(`   ⚠️  Twilio API error: ${recordingsResponse.status}`);
          }
        } catch (error: any) {
          console.error(`   ❌ Error downloading recording:`, error.message);
        }
      } else if (recordingUrl) {
        console.log(`   ✅ Recording already exists`);
      }

      // 2. Transcribe if we have recording but no transcript
      if (!transcript && recordingUrl) {
        console.log(`   🎤 Transcribing recording...`);
        try {
          const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(recordingUrl);
          transcript = analysis.transcript;
          console.log(`   ✅ Transcribed ${transcript?.length || 0} characters`);
          stats.transcriptsFetched++;
        } catch (error: any) {
          console.error(`   ❌ Transcription failed:`, error.message);
        }
      } else if (transcript) {
        console.log(`   ✅ Transcript already exists`);
      }

      // 3. Analyze if we have transcript but no analysis
      if (transcript && transcript.trim().length > 0 && record.analysis_status !== 'completed') {
        console.log(`   🧠 Analyzing transcript...`);
        try {
          const analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
          console.log(`   ✅ Analysis complete - Score: ${analysis.scorecard.overallScore.toFixed(1)}/100`);

          // Update database
          await supabaseAdmin
            .from('taalk_call_analytics')
            .update({
              recording_url: recordingUrl || record.recording_url,
              transcript: transcript,
              transcript_source: transcript ? 'ai_transcription' : null,
              call_score: analysis.scorecard.overallScore,
              scorecard_results: analysis.scorecard,
              coaching_notes: analysis.coachingNotes?.join('\n') || null,
              key_topics: analysis.keyTopics || null,
              objections_detected: analysis.objections || null,
              sentiment_score: analysis.sentimentScore || null,
              sentiment_label: analysis.sentiment || null,
              agent_talk_time_pct: analysis.agentTalkTimePct || null,
              client_engagement_level: analysis.clientEngagementLevel || null,
              call_outcome: analysis.callOutcome || null,
              call_outcome_confidence: analysis.callOutcomeConfidence || null,
              compliance_flags: analysis.complianceFlags || null,
              key_moments: analysis.keyMoments || null,
              ai_analysis: analysis.aiAnalysis || null,
              analysis_status: 'completed',
              analyzed_at: new Date().toISOString()
            })
            .eq('id', record.id);

          stats.analyzed++;
        } catch (error: any) {
          console.error(`   ❌ Analysis failed:`, error.message);
        }
      } else if (record.analysis_status === 'completed') {
        console.log(`   ✅ Analysis already complete`);
      }

      // Update recording_url and transcript if we got them
      if (recordingUrl !== record.recording_url || transcript !== record.transcript) {
        await supabaseAdmin
          .from('taalk_call_analytics')
          .update({
            recording_url: recordingUrl || record.recording_url,
            transcript: transcript || record.transcript,
            transcript_source: transcript ? (record.transcript_source || 'ai_transcription') : null
          })
          .eq('id', record.id);
      }

    } catch (error: any) {
      console.error(`   ❌ Error processing record:`, error.message);
      stats.errors++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BACKFILL COMPLETE');
  console.log('═'.repeat(70));
  console.log(`   Processed: ${stats.processed}`);
  console.log(`   Recordings downloaded: ${stats.recordingsDownloaded}`);
  console.log(`   Transcripts fetched: ${stats.transcriptsFetched}`);
  console.log(`   Analyzed: ${stats.analyzed}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log('═'.repeat(70));
}

backfillRecordings()
  .then(() => {
    console.log('\n✅ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
