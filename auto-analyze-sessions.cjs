const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fetch = require('node-fetch');
const FormData = require('form-data');

const supabaseUrl = 'https://zrkzadkgjvzwgupryuha.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya3phZGtnanZ6d2d1cHJ5dWhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDY2MzU4MiwiZXhwIjoyMDQ2MjM5NTgyfQ.hJ9r5_aSKx7TZu91XbA0ZyUdFAU5WcRPU8b8_Y3Vr2A';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyzeScreenshot(imageUrl) {
  console.log(`🖼️ Analyzing screenshot: ${imageUrl}`);
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this verification screenshot. Check if it shows:
1. Multiple people visible (agent + client)
2. Video call interface (Zoom, FaceTime, WhatsApp, etc.)
3. Both parties are clearly visible on camera

Respond in JSON format:
{
  "isValid": boolean,
  "confidence": "high" | "medium" | "low",
  "detectedElements": string[],
  "issues": string[],
  "reasoning": string
}`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ],
    max_tokens: 500
  });

  const content = response.choices[0].message.content;
  return JSON.parse(content);
}

async function analyzeAudio(recordingUrl) {
  console.log(`🎵 Analyzing audio: ${recordingUrl}`);
  
  // Download audio file
  const audioResponse = await fetch(recordingUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
  }
  
  const audioBuffer = await audioResponse.buffer();
  
  // Transcribe with Whisper
  const formData = new FormData();
  formData.append('file', audioBuffer, {
    filename: 'recording.mp3',
    contentType: 'audio/mpeg'
  });
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'json');
  
  const transcription = await openai.audio.transcriptions.create({
    file: await fetch(recordingUrl).then(r => r.blob()),
    model: 'whisper-1',
    language: 'en'
  });
  
  const transcript = transcription.text;
  
  // Analyze transcript
  const analysis = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: `Analyze this verification call transcript. The call may be in ENGLISH or SPANISH. Analyze in the detected language but respond in English JSON.

Check for:
1. Is this a legitimate verification call between an agent and client?
2. Are both parties participating in the conversation?
3. Is there verification of identity/information happening?
4. Any red flags or suspicious behavior?

Transcript:
${transcript}

Respond in JSON format:
{
  "isLegitimate": boolean,
  "confidence": "high" | "medium" | "low",
  "summary": string,
  "sentiment": "positive" | "neutral" | "negative",
  "keyMoments": string[],
  "redFlags": string[],
  "transcript": string
}`
      }
    ],
    max_tokens: 1000
  });

  const content = analysis.choices[0].message.content;
  return JSON.parse(content);
}

async function processUnanalyzedSessions() {
  console.log('\n🤖 Starting automatic verification analysis...\n');
  
  // Get sessions that need screenshot analysis
  const { data: sessionsNeedingScreenshot, error: screenshotError } = await supabase
    .from('verification_sessions')
    .select('*')
    .not('screenshot_url', 'is', null)
    .is('screenshot_validation', null)
    .limit(50);
  
  if (screenshotError) {
    console.error('❌ Error fetching sessions needing screenshot analysis:', screenshotError);
  } else {
    console.log(`📸 Found ${sessionsNeedingScreenshot?.length || 0} sessions needing screenshot analysis`);
    
    for (const session of sessionsNeedingScreenshot || []) {
      try {
        console.log(`\n  Processing session ${session.id} - ${session.agent_email}`);
        const validation = await analyzeScreenshot(session.screenshot_url);
        
        await supabase
          .from('verification_sessions')
          .update({ screenshot_validation: validation })
          .eq('id', session.id);
        
        console.log(`  ✅ Screenshot analyzed: ${validation.isValid ? 'VALID' : 'INVALID'} (${validation.confidence} confidence)`);
      } catch (error) {
        console.error(`  ❌ Failed to analyze screenshot for session ${session.id}:`, error.message);
      }
    }
  }
  
  // Get sessions that need audio analysis
  const { data: sessionsNeedingAudio, error: audioError } = await supabase
    .from('verification_sessions')
    .select('*')
    .not('recording_url', 'is', null)
    .is('audio_analysis', null)
    .limit(50);
  
  if (audioError) {
    console.error('❌ Error fetching sessions needing audio analysis:', audioError);
  } else {
    console.log(`\n🎵 Found ${sessionsNeedingAudio?.length || 0} sessions needing audio analysis`);
    
    for (const session of sessionsNeedingAudio || []) {
      try {
        console.log(`\n  Processing session ${session.id} - ${session.agent_email}`);
        const analysis = await analyzeAudio(session.recording_url);
        
        await supabase
          .from('verification_sessions')
          .update({ audio_analysis: analysis })
          .eq('id', session.id);
        
        console.log(`  ✅ Audio analyzed: ${analysis.isLegitimate ? 'LEGITIMATE' : 'SUSPICIOUS'} (${analysis.confidence} confidence)`);
      } catch (error) {
        console.error(`  ❌ Failed to analyze audio for session ${session.id}:`, error.message);
      }
    }
  }
  
  console.log('\n✅ Automatic analysis complete!\n');
}

// Run the analysis
processUnanalyzedSessions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

