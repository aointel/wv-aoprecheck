/**
 * Bulk analyze all existing verification sessions
 * Applies AI analysis to screenshots and audio recordings
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Supabase
const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

// OpenAI API key
const OPENAI_API_KEY = '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';

async function analyzeScreenshot(screenshotUrl, verificationMethod) {
  try {
    console.log('  🤖 Analyzing screenshot...');
    
    // Download screenshot
    const response = await fetch(screenshotUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    
    const buffer = await response.buffer();
    const base64Image = buffer.toString('base64');
    
    // Analyze with AI
    const prompt = verificationMethod === 'zoom' 
      ? `Analyze this Zoom verification screenshot. Must show: Zoom interface + 2+ people visible. Respond with JSON: {"isValid":true/false,"confidence":0-1,"validationType":"zoom_meeting|invalid","detectedElements":{"hasMultiplePeople":true/false,"peopleCount":0,"hasZoomUI":true/false,"hasVideoCallInterface":true/false},"reason":"explanation","issues":[]}`
      : `Analyze this video call verification screenshot. Must show: Video call interface + 2+ people OR video call in progress. Respond with JSON: {"isValid":true/false,"confidence":0-1,"validationType":"video_call|invalid","detectedElements":{"hasMultiplePeople":true/false,"peopleCount":0,"hasFaceTimeUI":true/false,"hasWhatsAppUI":true/false,"hasVideoCallInterface":true/false},"reason":"explanation","issues":[]}`;
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });
    
    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }
    
    const data = await aiResponse.json();
    const aiText = data.choices[0]?.message?.content || '{}';
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      isValid: analysis.isValid || false,
      confidence: analysis.confidence || 0,
      validationType: analysis.validationType || 'unclear',
      reason: analysis.reason || 'No reason provided',
      detectedElements: analysis.detectedElements || {},
      issues: analysis.issues || [],
      validatedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`  ❌ Screenshot analysis error: ${error.message}`);
    return null;
  }
}

async function analyzeAudio(audioUrl, verificationMethod) {
  try {
    console.log('  🎤 Transcribing and analyzing audio...');
    
    // Check if URL is valid
    if (!audioUrl || !audioUrl.startsWith('http')) {
      throw new Error('Invalid audio URL');
    }
    
    // Download audio
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    
    const buffer = await response.buffer();
    
    // Save to temp file
    const tempFile = path.join(__dirname, `temp-audio-${Date.now()}.mp3`);
    fs.writeFileSync(tempFile, buffer);
    
    // Transcribe with Whisper
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFile));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!whisperResponse.ok) {
      fs.unlinkSync(tempFile);
      throw new Error(`Whisper API error: ${whisperResponse.status}`);
    }
    
    const transcription = await whisperResponse.json();
    const transcript = transcription.text;
    const duration = transcription.duration || 0;
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    // Analyze with GPT
    const prompt = `Analyze this insurance verification call transcript. The call may be in ENGLISH or SPANISH - analyze it in whichever language it's in, but respond in English JSON.

Respond with JSON: {"summary":"2-3 sentence summary in English","validation":{"isValid":true/false,"confidence":0-1,"reason":"explanation in English","detectedIssues":["issues in English"]},"keyMoments":[{"timestamp":"0:00","description":"description in English"}],"sentiment":"Positive|Neutral|Negative"}

TRANSCRIPT (may be English or Spanish): ${transcript}`;
    
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing insurance verification calls. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });
    
    if (!gptResponse.ok) {
      throw new Error(`GPT API error: ${gptResponse.status}`);
    }
    
    const gptData = await gptResponse.json();
    const aiText = gptData.choices[0]?.message?.content || '{}';
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      transcript,
      summary: analysis.summary || 'No summary available',
      validation: {
        isValid: analysis.validation?.isValid || false,
        confidence: analysis.validation?.confidence || 0,
        reason: analysis.validation?.reason || 'Unable to validate',
        detectedIssues: analysis.validation?.detectedIssues || []
      },
      keyMoments: analysis.keyMoments || [],
      sentiment: analysis.sentiment || 'Neutral',
      duration,
      analyzedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`  ❌ Audio analysis error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🚀 BULK ANALYSIS OF EXISTING VERIFICATION SESSIONS');
  console.log('═'.repeat(70));
  
  // Fetch all verification sessions with screenshots or recordings
  console.log('\n📥 Fetching sessions from database...');
  
  const START_DATE = process.env.START_DATE || null;

  let query = supabase
    .from('verification_sessions')
    .select('*')
    .or('screenshot_url.not.is.null,recording_url.not.is.null')
    .order('created_at', { ascending: false });

  if (START_DATE) {
    console.log(`   ➕ Filtering sessions created on/after ${START_DATE}`);
    query = query.gte('created_at', START_DATE);
  }

  const { data: sessions, error } = await query;
  
  if (error) {
    console.error('❌ Database error:', error);
    process.exit(1);
  }
  
  if (!sessions || sessions.length === 0) {
    console.log('⚠️  No sessions found with screenshots or recordings');
    return;
  }
  
  console.log(`✅ Found ${sessions.length} sessions to analyze`);
  console.log('═'.repeat(70));
  
  let screenshotCount = 0;
  let audioCount = 0;
  let screenshotSuccess = 0;
  let audioSuccess = 0;
  
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const sessionNum = i + 1;
    
    console.log(`\n[$sessionNum/${sessions.length}] 📋 ${session.first_name} ${session.last_name} (${session.verification_method})`);
    console.log(`    ID: ${session.id}`);
    console.log(`    Created: ${new Date(session.created_at).toLocaleString()}`);
    
    const updates = {};
    
    // Analyze screenshot if exists and not already analyzed
    if (session.screenshot_path && !session.screenshot_validation) {
      screenshotCount++;
      console.log(`  📸 Screenshot found: ${session.screenshot_path.substring(0, 80)}...`);
      
      const screenshotAnalysis = await analyzeScreenshot(
        session.screenshot_path,
        session.verification_method || 'zoom'
      );
      
      if (screenshotAnalysis) {
        updates.screenshot_validation = screenshotAnalysis;
        screenshotSuccess++;
        console.log(`  ✅ Screenshot: ${screenshotAnalysis.isValid ? 'VALID' : 'FLAGGED'} (${(screenshotAnalysis.confidence * 100).toFixed(0)}%)`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else if (session.screenshot_validation) {
      console.log(`  ⏭️  Screenshot already analyzed`);
    }
    
    // Analyze audio if exists and not already analyzed
    if (session.recording_url && session.recording_url !== 'PENDING' && session.recording_url.startsWith('http') && !session.audio_analysis) {
      audioCount++;
      console.log(`  🎙️  Recording found: ${session.recording_url.substring(0, 80)}...`);
      
      const audioAnalysis = await analyzeAudio(
        session.recording_url,
        session.verification_method || 'phone'
      );
      
      if (audioAnalysis) {
        updates.audio_analysis = audioAnalysis;
        audioSuccess++;
        console.log(`  ✅ Audio: ${audioAnalysis.validation.isValid ? 'VALID' : 'FLAGGED'} (${(audioAnalysis.validation.confidence * 100).toFixed(0)}%) - ${audioAnalysis.sentiment}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else if (session.audio_analysis) {
      console.log(`  ⏭️  Audio already analyzed`);
    }
    
    // Update database if we have new analysis
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('verification_sessions')
        .update(updates)
        .eq('id', session.id);
      
      if (updateError) {
        console.error(`  ❌ Database update error:`, updateError);
      } else {
        console.log(`  💾 Updated database`);
      }
    }
    
    // Progress indicator
    if (sessionNum % 5 === 0) {
      console.log(`\n📊 Progress: ${sessionNum}/${sessions.length} sessions processed`);
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 BULK ANALYSIS COMPLETE');
  console.log('═'.repeat(70));
  console.log(`\n📸 Screenshots:`);
  console.log(`   Found: ${screenshotCount}`);
  console.log(`   Analyzed: ${screenshotSuccess}`);
  console.log(`   Success Rate: ${screenshotCount > 0 ? ((screenshotSuccess/screenshotCount)*100).toFixed(0) : 0}%`);
  
  console.log(`\n🎙️  Audio Recordings:`);
  console.log(`   Found: ${audioCount}`);
  console.log(`   Analyzed: ${audioSuccess}`);
  console.log(`   Success Rate: ${audioCount > 0 ? ((audioSuccess/audioCount)*100).toFixed(0) : 0}%`);
  
  console.log(`\n🎯 Total Sessions Processed: ${sessions.length}`);
  console.log(`✅ Total Successful Analyses: ${screenshotSuccess + audioSuccess}`);
  console.log('═'.repeat(70) + '\n');
}

// Run
main().then(() => {
  console.log('✅ Bulk analysis complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

