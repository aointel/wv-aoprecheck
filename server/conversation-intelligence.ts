/**
 * Conversation Intelligence System (Chorus-style)
 * Analyzes virtual meeting recordings for coaching and insights
 */

import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import { OpenAI } from 'openai';
import { HARDCODED_CONFIG } from './hardcoded-config';

const router = Router();

// DISABLED: Conversation intelligence disabled - OpenAI not used here
function getOpenAI(): never {
  throw new Error('OpenAI API disabled for conversation intelligence');
  // const apiKey = HARDCODED_CONFIG.OPENAI_API_KEY;
  // if (!apiKey || apiKey === 'your-openai-api-key-here') {
  //   throw new Error('OpenAI API key not configured');
  // }
  // return new OpenAI({ apiKey });
}

/**
 * POST /api/conversation-intelligence/whereby-webhook
 * Webhook from Whereby when recording is ready
 */
router.post('/whereby-webhook', async (req, res) => {
  try {
    console.log('🎥 Whereby webhook received:', JSON.stringify(req.body, null, 2));
    
    const { meetingId, recording } = req.body;
    
    if (!meetingId || !recording) {
      console.log('⚠️ Webhook missing data');
      return res.status(200).json({ received: true });
    }

    const recordingUrl = recording.url;
    const duration = recording.duration;
    
    console.log(`📹 Recording ready for meeting ${meetingId}`);
    console.log(`   URL: ${recordingUrl}`);
    console.log(`   Duration: ${duration}s`);
    
    // Find the meet associated with this Whereby meeting
    const { data: meet } = await supabaseAdmin
      .from('meets')
      .select('*')
      .contains('whereby_room_url', meetingId)
      .single();
    
    if (!meet) {
      console.log(`⚠️ No meet found for meeting ${meetingId}`);
      return res.status(200).json({ received: true });
    }
    
    console.log(`✅ Found meet: ${meet.id} - Agent: ${meet.agent_email}`);
    
    // Download the recording
    console.log('📥 Downloading recording...');
    const recordingResponse = await fetch(recordingUrl);
    const recordingBuffer = Buffer.from(await recordingResponse.arrayBuffer());
    
    // Upload to Supabase storage
    const filename = `meet-${meet.id}-${Date.now()}.mp4`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('meet-recordings')
      .upload(filename, recordingBuffer, {
        contentType: 'video/mp4'
      });
    
    if (uploadError) {
      console.error('❌ Failed to upload recording:', uploadError);
      return res.status(500).json({ error: 'Upload failed' });
    }
    
    const { data: publicUrl } = supabaseAdmin.storage
      .from('meet-recordings')
      .getPublicUrl(filename);
    
    console.log(`✅ Recording uploaded: ${publicUrl.publicUrl}`);
    
    // Update meet with recording URL
    await supabaseAdmin
      .from('meets')
      .update({ 
        recording_url: publicUrl.publicUrl,
        recording_duration: duration
      })
      .eq('id', meet.id);
    
    // ALSO update the linked presentation session with the recording
    if (meet.presentation_session_id) {
      console.log(`🔗 Updating presentation session ${meet.presentation_session_id} with recording`);
      await supabaseAdmin
        .from('presentation_sessions')
        .update({
          video_url: publicUrl.publicUrl,
          status: 'completed'
        })
        .eq('id', meet.presentation_session_id);
      console.log(`✅ Presentation session updated with recording URL`);
    }
    
    // Trigger async transcription + AI analysis
    processRecording(meet.id, publicUrl.publicUrl).catch(err => {
      console.error('❌ Background processing failed:', err);
    });
    
    res.status(200).json({ received: true, meetId: meet.id });
    
  } catch (error: any) {
    console.error('❌ Whereby webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process recording: transcribe + AI analysis
 */
async function processRecording(meetId: string, recordingUrl: string) {
  try {
    console.log(`🤖 Starting AI processing for meet ${meetId}...`);
    
    // Step 1: Transcribe audio using Whisper
    console.log('🎤 Transcribing audio...');
    
    // Download the recording again
    const response = await fetch(recordingUrl);
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // Create a file-like object for OpenAI
    const audioFile = new File([audioBuffer], 'recording.mp4', { type: 'video/mp4' });
    
    const openai = getOpenAI();
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment']
    });
    
    console.log(`✅ Transcription complete: ${transcription.text.length} characters`);
    
    // Step 2: AI Analysis of conversation
    console.log('🧠 Running AI conversation analysis...');
    
    const analysisPrompt = `Analyze this sales conversation and extract key insights:

TRANSCRIPT:
${transcription.text}

Extract and return JSON with:
{
  "summary": "Brief summary of the meeting",
  "outcome": "SOLD | NOT_INTERESTED | CALLBACK | THINK | NO_SHOW",
  "client_objections": ["objection1", "objection2"],
  "agent_talk_time_percentage": 45,
  "questions_asked_by_agent": 12,
  "client_engagement_level": "HIGH | MEDIUM | LOW",
  "key_topics_discussed": ["topic1", "topic2"],
  "alp_mentioned": "$1234",
  "next_steps": "What should happen next",
  "coaching_notes": "Specific feedback for agent improvement"
}`;

    const analysis = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a sales coach analyzing insurance sales conversations.' },
        { role: 'user', content: analysisPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });
    
    const conversationAnalysis = JSON.parse(analysis.choices[0].message.content || '{}');
    
    console.log('✅ AI analysis complete:', conversationAnalysis.outcome);
    
    // Step 3: Store transcript and analysis
    await supabaseAdmin
      .from('meets')
      .update({
        transcript: transcription.text,
        transcript_segments: transcription.segments,
        conversation_analysis: conversationAnalysis,
        disposition: conversationAnalysis.outcome,
        status: conversationAnalysis.outcome === 'SOLD' ? 'completed' : 
                conversationAnalysis.outcome === 'CALLBACK' || conversationAnalysis.outcome === 'THINK' ? 'scheduled' : 
                'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', meetId);
    
    console.log(`✅ Meet ${meetId} processed and updated`);
    
    // Step 4: If outcome is THINK or CALLBACK, create a follow-up meet
    if (conversationAnalysis.outcome === 'THINK' || conversationAnalysis.outcome === 'CALLBACK') {
      const { data: originalMeet } = await supabaseAdmin
        .from('meets')
        .select('*')
        .eq('id', meetId)
        .single();
      
      if (originalMeet) {
        const callbackDate = new Date();
        callbackDate.setDate(callbackDate.getDate() + 3); // 3 days from now
        
        await supabaseAdmin
          .from('meets')
          .insert({
            agent_email: originalMeet.agent_email,
            agent_name: originalMeet.agent_name,
            client_first_name: originalMeet.client_first_name,
            client_last_name: originalMeet.client_last_name,
            client_phone: originalMeet.client_phone,
            client_email: originalMeet.client_email,
            scheduled_date: callbackDate.toISOString(),
            scheduled_time: originalMeet.scheduled_time,
            market_type: originalMeet.market_type,
            meet_type: 'callback',
            status: 'scheduled',
            is_callback: true,
            parent_meet_id: originalMeet.id,
            callback_reason: conversationAnalysis.outcome,
            notes: `Auto-scheduled callback from ${conversationAnalysis.outcome} disposition`,
            created_from: 'auto_callback'
          });
        
        console.log(`✅ Auto-created callback meet for 3 days from now`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Recording processing failed:', error);
    // Store error in meet record
    await supabaseAdmin
      .from('meets')
      .update({ 
        internal_notes: `Processing error: ${error.message}` 
      })
      .eq('id', meetId);
  }
}

/**
 * GET /api/conversation-intelligence/meet/:meetId
 * Get conversation analysis for a specific meet
 */
router.get('/meet/:meetId', async (req, res) => {
  try {
    const { meetId } = req.params;
    
    const { data: meet, error } = await supabaseAdmin
      .from('meets')
      .select('*')
      .eq('id', meetId)
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      meet,
      hasRecording: !!meet.recording_url,
      hasTranscript: !!meet.transcript,
      hasAnalysis: !!meet.conversation_analysis
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching meet:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

