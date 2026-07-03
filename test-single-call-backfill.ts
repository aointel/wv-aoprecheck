/**
 * Test downloading and processing ONE call from taalk_call_analytics
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

async function testSingleCall() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin not initialized');
    process.exit(1);
  }

  console.log('\n🧪 TESTING SINGLE CALL DOWNLOAD & PROCESSING\n');
  console.log('═'.repeat(70));

  // Get ONE call that needs data
  const { data: calls, error } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, agent_email, call_date, taalk_call_id, recording_url, transcript, analysis_status')
    .or('recording_url.is.null,transcript.is.null,analysis_status.eq.failed')
    .order('call_date', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!calls || calls.length === 0) {
    console.log('✅ No calls need processing');
    return;
  }

  const call = calls[0];
  console.log(`\n📞 Testing call ID: ${call.id}`);
  console.log(`   Transaction: ${call.billing_transaction_id}`);
  console.log(`   Agent: ${call.agent_email}`);
  console.log(`   Date: ${call.call_date}`);
  console.log(`   Taalk ID: ${call.taalk_call_id || 'N/A'}`);
  console.log(`   Current recording: ${call.recording_url ? 'YES' : 'NO'}`);
  console.log(`   Current transcript: ${call.transcript ? 'YES' : 'NO'}`);
  console.log(`   Current status: ${call.analysis_status}\n`);

  // Get billing transaction to find real Taalk call ID
  let realTaalkCallId = call.taalk_call_id;
  let twilioCallSid = null;
  
  if (call.billing_transaction_id) {
    const { data: billingTx } = await supabaseAdmin
      .from('billing_transactions')
      .select('metadata, source_table, source_id')
      .eq('transaction_id', call.billing_transaction_id)
      .maybeSingle();
    
    if (billingTx) {
      // Check metadata for Taalk call ID
      if (billingTx.metadata) {
        const meta = typeof billingTx.metadata === 'string' ? JSON.parse(billingTx.metadata) : billingTx.metadata;
        realTaalkCallId = meta.taalk_call_id || meta.call_id || realTaalkCallId;
        twilioCallSid = meta.twilio_call_sid || (call.taalk_call_id?.startsWith('CA') ? call.taalk_call_id : null);
      }
      
      // If source is vdp_calls, try to get Taalk ID from there
      if (billingTx.source_table === 'vdp_calls' && billingTx.source_id) {
        const { data: vdpCall } = await supabaseAdmin
          .from('vdp_calls')
          .select('Params, phone, time')
          .eq('id', billingTx.source_id)
          .maybeSingle();
        
        if (vdpCall?.Params) {
          try {
            const params = typeof vdpCall.Params === 'string' ? JSON.parse(vdpCall.Params) : vdpCall.Params;
            const taalkIdFromParams = params.callId || params.call_id;
            if (taalkIdFromParams) {
              realTaalkCallId = taalkIdFromParams;
              console.log(`   ✅ Found Taalk ID from vdp_calls.Params: ${realTaalkCallId}`);
            }
          } catch (e) {
            // Ignore
          }
        }
        
        // If still no Taalk ID, try searching Taalk API by phone/time
        if (!realTaalkCallId && vdpCall?.phone && vdpCall?.time) {
          console.log(`   🔍 Searching Taalk API for call with phone ${vdpCall.phone} at ${vdpCall.time}...`);
          try {
            const recentCallsUrl = `https://api.taalk.ai/api/calls?db=michaelmandella&limit=100`;
            const recentCallsResponse = await fetch(recentCallsUrl, {
              headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
            });
            
            if (recentCallsResponse.ok) {
              const callsData = await recentCallsResponse.json();
              const calls = Array.isArray(callsData) ? callsData : (callsData.calls || []);
              
              const normalizePhone = (phone: string) => {
                if (!phone) return '';
                return phone.replace(/[\s\-+()]/g, '').slice(-10);
              };
              
              const targetPhone = normalizePhone(vdpCall.phone);
              const callTime = new Date(vdpCall.time).getTime();
              
              const matchingCall = calls.find((c: any) => {
                const callPhone = normalizePhone(c.phone || c.from || c.to || '');
                const callTimeMatch = c.created_at || c.createdAt || c.time || c.date;
                if (!callTimeMatch) return false;
                const callTimeMs = new Date(callTimeMatch).getTime();
                if (isNaN(callTimeMs)) return false;
                const timeDiff = Math.abs(callTimeMs - callTime);
                return callPhone === targetPhone && timeDiff < 10 * 60 * 1000;
              });
              
              if (matchingCall) {
                realTaalkCallId = matchingCall.id || matchingCall._id || matchingCall.callId;
                console.log(`   ✅ Found Taalk ID from API search: ${realTaalkCallId}`);
              }
            }
          } catch (e) {
            console.log(`   ⚠️ Error searching Taalk API:`, (e as Error).message);
          }
        }
      }
    }
  }

  console.log(`   Real Taalk ID: ${realTaalkCallId || 'N/A'}`);
  console.log(`   Twilio SID: ${twilioCallSid || 'N/A'}\n`);

  // Check if taalk_call_id is actually a Twilio call SID
  const isTwilioSid = realTaalkCallId && realTaalkCallId.startsWith('CA');
  
  let recordingUrl = call.recording_url;
  let transcript = call.transcript;

  // Try to get recording - check if it's Twilio or Taalk
  if (!recordingUrl && realTaalkCallId) {
    if (isTwilioSid) {
      // It's a Twilio call SID - download from Twilio
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.log('   ⚠️ Twilio credentials not configured');
      } else {
        console.log('📥 Downloading recording from Twilio...');
        try {
          // Get recordings for this call
          const twilioUrl = `https://${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}@api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${realTaalkCallId}/Recordings.json`;
          const recordingsResponse = await fetch(twilioUrl);
          
          if (recordingsResponse.ok) {
            const recordingsData = await recordingsResponse.json();
            if (recordingsData.recordings && recordingsData.recordings.length > 0) {
              const recording = recordingsData.recordings[0];
              const recordingSid = recording.sid;
              console.log(`   ✅ Found Twilio recording: ${recordingSid}`);
              
              // Download the recording
              const recordingDownloadUrl = `https://${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}@api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`;
              const downloadResponse = await fetch(recordingDownloadUrl);
              
              if (downloadResponse.ok) {
                const arrayBuffer = await downloadResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                console.log(`   ✅ Downloaded ${Math.round(buffer.length / 1024)}KB from Twilio`);
                
                // Upload to Supabase Storage
                const fileName = `call-analysis/twilio-${realTaalkCallId}.mp3`;
                const { error: uploadError } = await supabaseAdmin.storage
                  .from('verify_agent_screenshot')
                  .upload(fileName, buffer, {
                    contentType: 'audio/mpeg',
                    upsert: true
                  });
                
                if (uploadError) {
                  console.error(`   ❌ Upload failed:`, uploadError);
                } else {
                  // Generate signed URL
                  const { data: signedData } = await supabaseAdmin.storage
                    .from('verify_agent_screenshot')
                    .createSignedUrl(fileName, 63072000); // 2 years
                  
                  recordingUrl = signedData?.signedUrl || null;
                  console.log(`   ✅ Uploaded to Supabase: ${fileName}`);
                  console.log(`   ✅ Recording URL: ${recordingUrl?.substring(0, 80)}...`);
                }
              } else {
                console.log(`   ⚠️ Failed to download: ${downloadResponse.status}`);
              }
            } else {
              console.log(`   ⚠️ No recordings found for Twilio call`);
            }
          } else {
            const errorText = await recordingsResponse.text().catch(() => '');
            console.log(`   ⚠️ Twilio API error: ${recordingsResponse.status} - ${errorText.substring(0, 100)}`);
          }
        } catch (error: any) {
          console.error(`   ❌ Error downloading from Twilio:`, error.message);
        }
      }
    } else {
      // It's a Taalk call ID - download from Taalk
      console.log('📥 Trying to get recording from Taalk API...');
      try {
        const taalkUrl = `https://api.taalk.ai/api/calls/${realTaalkCallId}/recording?db=michaelmandella`;
        const response = await fetch(taalkUrl, {
          headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log(`   ✅ Downloaded ${Math.round(buffer.length / 1024)}KB from Taalk`);
          
          // Upload to Supabase
          const fileName = `call-analysis/taalk-${realTaalkCallId}.mp3`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .upload(fileName, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
          
          if (uploadError) {
            console.error(`   ❌ Upload failed:`, uploadError);
          } else {
            const { data: signedData } = await supabaseAdmin.storage
              .from('verify_agent_screenshot')
              .createSignedUrl(fileName, 63072000);
            
            recordingUrl = signedData?.signedUrl || null;
            console.log(`   ✅ Uploaded to Supabase: ${fileName}`);
          }
        } else {
          console.log(`   ⚠️ Taalk API error: ${response.status}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error downloading from Taalk:`, error.message);
      }
    }
  }

  // Try to get transcript - try both Taalk API (if real Taalk ID) and Twilio (if Twilio SID)
  if (!transcript && realTaalkCallId) {
    if (!isTwilioSid) {
      // Real Taalk call ID - fetch from Taalk API
      console.log('\n📝 Fetching transcript from Taalk API...');
      try {
        const transcriptUrl = `https://api.taalk.ai/api/calls/${realTaalkCallId}/transcript?db=michaelmandella`;
        const transcriptResponse = await fetch(transcriptUrl, {
          headers: { 'Authorization': `Bearer ${TAALK_API_KEY}` }
        });
        
        if (transcriptResponse.ok) {
          transcript = await transcriptResponse.text();
          if (transcript && transcript.trim().length > 0) {
            console.log(`   ✅ Fetched transcript: ${transcript.length} characters`);
          } else {
            console.log(`   ⚠️ Transcript is empty`);
            transcript = null;
          }
        } else {
          console.log(`   ⚠️ Could not fetch transcript: ${transcriptResponse.status}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error fetching transcript:`, error.message);
      }
    }
    // If Twilio SID, we'll transcribe from recording below
  }

  // Transcribe from recording if we have recording but no transcript
  if (!transcript && recordingUrl) {
    console.log('\n🎤 Transcribing from recording...');
    try {
      const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(recordingUrl);
      transcript = analysis.transcript;
      console.log(`   ✅ Transcribed: ${transcript?.length || 0} characters`);
    } catch (error: any) {
      console.error(`   ❌ Transcription failed:`, error.message);
    }
  }

  // Analyze if we have transcript
  let analysis = null;
  if (transcript && transcript.trim().length > 0) {
    console.log('\n🧠 Analyzing transcript...');
    try {
      analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
      console.log(`   ✅ Analysis complete - Score: ${analysis.scorecard.overallScore.toFixed(1)}/100`);
    } catch (error: any) {
      console.error(`   ❌ Analysis failed:`, error.message);
    }
  }

  // Update the record
  console.log('\n💾 Updating database...');
  const updateData: any = {};
  
  if (recordingUrl) {
    updateData.recording_url = recordingUrl;
  }
  if (transcript) {
    updateData.transcript = transcript;
    updateData.transcript_source = (realTaalkCallId && !isTwilioSid) ? 'taalk_api' : 'ai_transcription';
  }
  if (realTaalkCallId && realTaalkCallId !== call.taalk_call_id) {
    updateData.taalk_call_id = realTaalkCallId;
  }
  if (analysis) {
    updateData.call_score = analysis.scorecard.overallScore;
    updateData.scorecard_results = analysis.scorecard;
    updateData.coaching_notes = analysis.coachingNotes;
    updateData.key_topics = analysis.keyTopics;
    updateData.objections_detected = analysis.objections;
    updateData.sentiment_score = analysis.sentimentScore;
    updateData.sentiment_label = analysis.sentiment;
    updateData.agent_talk_time_pct = analysis.agentTalkTimePct;
    updateData.client_engagement_level = analysis.clientEngagementLevel;
    updateData.call_outcome = analysis.callOutcome;
    updateData.call_outcome_confidence = analysis.callOutcomeConfidence;
    updateData.compliance_flags = analysis.complianceFlags;
    updateData.key_moments = analysis.keyMoments;
    updateData.ai_analysis = analysis.aiAnalysis;
    updateData.analysis_status = 'completed';
    updateData.analyzed_at = new Date().toISOString();
  }

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .update(updateData)
      .eq('id', call.id);

    if (updateError) {
      console.error(`   ❌ Update failed:`, updateError);
    } else {
      console.log(`   ✅ Updated call ${call.id}`);
      console.log(`      - Recording: ${recordingUrl ? 'YES' : 'NO'}`);
      console.log(`      - Transcript: ${transcript ? 'YES' : 'NO'}`);
      console.log(`      - Analysis: ${analysis ? 'YES' : 'NO'}`);
    }
  } else {
    console.log(`   ⚠️ Nothing to update`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ TEST COMPLETE');
  console.log('═'.repeat(70));
}

testSingleCall()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
