/**
 * Download last 100 calls over 25 seconds from Twilio and POST for download/storage
 * No analysis - just downloads and stores
 * 
 * Usage: npx tsx download-and-post-calls.ts
 */

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './server/hardcoded-config';
import { supabaseAdmin } from './server/supabase';
import { callAnalyticsAnalyzer } from './server/call-analytics-analyzer';

const TAALK_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4';

interface TwilioCall {
  sid: string;
  from: string;
  to: string;
  status: string;
  start_time?: string;
  startTime?: string;
  duration: string;
  direction: string;
}

interface CallData {
  twilioCallSid: string;
  taalkCallId?: string;
  agentEmail: string;
  agentPhone: string;
  clientPhone: string;
  callDate: string;
  duration: number;
  transcript?: string;
  recordingUrl?: string;
}

// Fetch calls from Twilio - last 100 calls over 25 seconds
async function fetchTwilioCalls(): Promise<TwilioCall[]> {
  console.log(`📞 Fetching last 100 Twilio calls over 25 seconds...`);
  
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json?PageSize=1000&Status=completed`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Twilio API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const calls = (data.calls || [])
    .filter((c: TwilioCall) => 
      c.status === 'completed' && 
      parseInt(c.duration) >= 25 // At least 25 seconds
    )
    .sort((a: TwilioCall, b: TwilioCall) => {
      const aTime = a.start_time || a.startTime || '';
      const bTime = b.start_time || b.startTime || '';
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
    .slice(0, 100); // Get last 100
  
  console.log(`✅ Found ${calls.length} completed calls over 25 seconds`);
  return calls;
}

// Fetch transcript from Taalk
async function fetchTaalkTranscript(taalkCallId: string): Promise<string | null> {
  try {
    const url = `https://api.taalk.ai/api/calls/${taalkCallId}/transcript?db=michaelmandella`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TAALK_API_KEY}`
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.error(`❌ Error fetching transcript for ${taalkCallId}:`, error);
    return null;
  }
}

// Get agent email from phone number
// You can modify this to lookup from your database or use a mapping
async function getAgentEmailFromPhone(phone: string): Promise<string> {
  // Extract numbers only
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  // TODO: Implement phone-to-email mapping from your database
  // For now, return placeholder - you should fetch from agent_profiles or similar
  return `agent_${phoneDigits}@aoglobelife.com`;
}

// Prepare call data for POST
async function prepareCallData(twilioCall: TwilioCall): Promise<CallData> {
  const agentEmail = await getAgentEmailFromPhone(twilioCall.from);
  const callDate = twilioCall.start_time || twilioCall.startTime || new Date().toISOString();
  
  const callData: CallData = {
    twilioCallSid: twilioCall.sid,
    agentEmail: agentEmail,
    agentPhone: twilioCall.from,
    clientPhone: twilioCall.to,
    callDate: callDate,
    duration: parseInt(twilioCall.duration) || 0
  };
  
  // Try to find Taalk call ID from your database if you have a mapping
  // For now, we'll skip - you can add logic to lookup taalk_call_id from vdp_calls or similar
  // If you have taalk_call_id, uncomment below:
  /*
  const taalkCallId = await findTaalkCallIdFromDatabase(twilioCall.sid);
  if (taalkCallId) {
    callData.taalkCallId = taalkCallId;
    const transcript = await fetchTaalkTranscript(taalkCallId);
    if (transcript) {
      callData.transcript = transcript;
      callData.recordingUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
    }
  }
  */
  
  return callData;
}

// Download recording from Twilio
async function downloadTwilioRecording(callSid: string): Promise<string | null> {
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const recordingsUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}/Recordings.json`;
    
    const recordingsResponse = await fetch(recordingsUrl, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    if (!recordingsResponse.ok) {
      return null;
    }

    const recordingsData = await recordingsResponse.json();
    if (!recordingsData.recordings || recordingsData.recordings.length === 0) {
      return null;
    }

    const recording = recordingsData.recordings[0];
    return `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recording.sid}.mp3`;
  } catch (error) {
    return null;
  }
}

// Store call data directly in database (no analysis)
async function storeCallData(callData: CallData): Promise<void> {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin not initialized');
    }

    console.log(`💾 Storing call ${callData.twilioCallSid}...`);
    
    const transactionId = `twilio_${callData.twilioCallSid}`;
    
    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id')
      .eq('billing_transaction_id', transactionId)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️ Call ${callData.twilioCallSid} already exists, skipping`);
      return;
    }

    // Download recording if we have call SID
    let recordingUrl = callData.recordingUrl;
    if (!recordingUrl && callData.twilioCallSid) {
      recordingUrl = await downloadTwilioRecording(callData.twilioCallSid);
    }

    // Fetch transcript from Taalk if we have taalk_call_id
    let transcript = callData.transcript;
    if (!transcript && callData.taalkCallId) {
      transcript = await fetchTaalkTranscript(callData.taalkCallId);
    }

    // Transcribe recording if we have recording URL but no transcript
    if (!transcript && recordingUrl) {
      console.log(`  🎤 Transcribing recording from Twilio...`);
      try {
        const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(recordingUrl);
        transcript = analysis.transcript;
        console.log(`  ✅ Transcribed ${transcript?.length || 0} characters`);
      } catch (error: any) {
        console.error(`  ⚠️  Transcription failed: ${error.message}`);
        // Continue without transcript
      }
    }

    // Insert into database
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .insert({
        billing_transaction_id: transactionId,
        agent_email: callData.agentEmail,
        call_date: callData.callDate,
        taalk_call_id: callData.taalkCallId || null,
        recording_url: recordingUrl || null,
        transcript: transcript || null,
        transcript_source: transcript ? (callData.taalkCallId ? 'taalk_api' : (recordingUrl ? 'ai_transcription' : null)) : null,
        analysis_status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ Stored call ${callData.twilioCallSid} with ID: ${inserted.id}`);
  } catch (error: any) {
    console.error(`❌ Error storing call ${callData.twilioCallSid}:`, error.message);
    throw error;
  }
}

// Main function
async function downloadAndPostCalls() {
  console.log('🚀 Starting call download and POST process...\n');
  
  try {
    // Fetch last 100 calls over 25 seconds from Twilio
    const twilioCalls = await fetchTwilioCalls();
    
    if (twilioCalls.length === 0) {
      console.log('⚠️ No calls found');
      return;
    }
    
    console.log(`\n📋 Processing ${twilioCalls.length} calls...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each call
    for (let i = 0; i < twilioCalls.length; i++) {
      const call = twilioCalls[i];
      console.log(`\n[${i + 1}/${twilioCalls.length}] Processing ${call.sid}...`);
      
      try {
        // Prepare call data
        const callData = await prepareCallData(call);
        
        // Store directly in database
        await storeCallData(callData);
        
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`❌ Failed to process ${call.sid}:`, error.message);
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
downloadAndPostCalls()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

export { downloadAndPostCalls };
