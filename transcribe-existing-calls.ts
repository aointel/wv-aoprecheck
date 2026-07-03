/**
 * Transcribe existing calls that have recordings but no transcripts
 * 
 * Usage: npx tsx transcribe-existing-calls.ts
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

async function transcribeExistingCalls() {
  console.log('🚀 Starting transcription of existing calls...\n');
  
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin not initialized');
    }

    // Get all calls
    const { data: allCalls, error: fetchError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('*')
      .order('call_date', { ascending: false })
      .limit(1000);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 Total calls in database: ${allCalls?.length || 0}`);
    
    // First, try to download recordings for calls that don't have them
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = await import('./server/hardcoded-config');
    
    const callsWithoutRecordings = (allCalls || []).filter(call => {
      const billingId = call.billing_transaction_id;
      return billingId && billingId.startsWith('twilio_') && (!call.recording_url || call.recording_url.trim() === '');
    });

    console.log(`📊 Calls without recordings: ${callsWithoutRecordings.length}`);
    
    // Download recordings for calls that don't have them
    for (const call of callsWithoutRecordings.slice(0, 100)) {
      const twilioCallSid = call.billing_transaction_id.replace('twilio_', '');
      console.log(`  📥 Downloading recording for ${twilioCallSid}...`);
      
      try {
        const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        const recordingsUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${twilioCallSid}/Recordings.json`;
        
        const recordingsResponse = await fetch(recordingsUrl, {
          headers: { 'Authorization': `Basic ${auth}` }
        });

        if (recordingsResponse.ok) {
          const recordingsData = await recordingsResponse.json();
          if (recordingsData.recordings && recordingsData.recordings.length > 0) {
            const recording = recordingsData.recordings[0];
            const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recording.sid}.mp3`;
            
            await supabaseAdmin
              .from('taalk_call_analytics')
              .update({ recording_url: recordingUrl })
              .eq('id', call.id);
            
            console.log(`  ✅ Downloaded recording URL`);
          } else {
            console.log(`  ⚠️  No recordings found for this call`);
          }
        }
      } catch (error: any) {
        console.error(`  ❌ Error downloading recording: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Now get calls with recordings but without transcripts
    const { data: updatedCalls } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('*')
      .not('recording_url', 'is', null)
      .order('call_date', { ascending: false })
      .limit(1000);
    
    const callsToTranscribe = (updatedCalls || []).filter(call => {
      const hasRecording = call.recording_url && call.recording_url.trim() !== '';
      const hasNoTranscript = !call.transcript || call.transcript.trim() === '';
      return hasRecording && hasNoTranscript;
    });

    console.log(`📊 Calls with recordings but no transcripts: ${callsToTranscribe.length}`);

    if (fetchError) {
      throw fetchError;
    }

    if (!callsToTranscribe || callsToTranscribe.length === 0) {
      console.log('✅ No calls need transcription');
      return;
    }

    console.log(`📊 Found ${callsToTranscribe.length} calls to transcribe\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < callsToTranscribe.length; i++) {
      const call = callsToTranscribe[i];
      console.log(`\n[${i + 1}/${callsToTranscribe.length}] Transcribing call ${call.billing_transaction_id}...`);

      try {
        if (!call.recording_url) {
          console.log(`  ⚠️  No recording URL, skipping`);
          errorCount++;
          continue;
        }

        console.log(`  🎤 Transcribing recording...`);
        const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(call.recording_url);
        
        if (!analysis.transcript) {
          console.log(`  ⚠️  No transcript generated, skipping`);
          errorCount++;
          continue;
        }

        // Update with transcript
        const { error: updateError } = await supabaseAdmin
          .from('taalk_call_analytics')
          .update({
            transcript: analysis.transcript,
            transcript_source: 'ai_transcription'
          })
          .eq('id', call.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`  ✅ Transcribed ${analysis.transcript.length} characters`);
        successCount++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`  ❌ Error transcribing call:`, error.message);
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
transcribeExistingCalls()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

export { transcribeExistingCalls };
