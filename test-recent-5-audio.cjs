/**
 * Test audio analysis on 5 most recent verification sessions
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
          { role: 'system', content: 'You are an expert at analyzing insurance verification calls in any language. Always respond with English JSON.' },
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
    const analysis = JSON.parse(jsonMatch[0]);
    
    return {
      transcript,
      summary: analysis.summary || 'No summary available',
      validation: {
        isValid: analysis.validation?.isValid || false,
        confidence: analysis.validation?.confidence || 0,
        reason: analysis.validation?.reason || 'No reason provided',
        detectedIssues: analysis.validation?.detectedIssues || []
      },
      keyMoments: analysis.keyMoments || [],
      sentiment: analysis.sentiment || 'Neutral',
      analyzedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`  ❌ Audio analysis error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n🎯 TESTING AUDIO ANALYSIS ON 5 MOST RECENT SESSIONS');
  console.log('═'.repeat(70));
  
  try {
    // Get 5 most recent sessions with recordings
    const { data: sessions, error } = await supabase
      .from('verification_sessions')
      .select('*')
      .not('recording_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('❌ No sessions with recordings found');
      return;
    }
    
    console.log(`📊 Found ${sessions.length} recent sessions with recordings\n`);
    
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      console.log(`[${i + 1}/5] 📋 ${session.first_name} ${session.last_name} (${session.verification_method})`);
      console.log(`    ID: ${session.id}`);
      console.log(`    Created: ${new Date(session.created_at).toLocaleString()}`);
      
      if (session.recording_url) {
        console.log(`  🎙️  Recording found: ${session.recording_url.substring(0, 100)}...`);
        
        const audioAnalysis = await analyzeAudio(session.recording_url, session.verification_method);
        
        if (audioAnalysis) {
          console.log(`  ✅ Audio: ${audioAnalysis.validation.isValid ? 'VALID' : 'FLAGGED'} (${(audioAnalysis.validation.confidence * 100).toFixed(0)}%)`);
          console.log(`  😊 Sentiment: ${audioAnalysis.sentiment}`);
          console.log(`  📝 Summary: ${audioAnalysis.summary.substring(0, 100)}...`);
          
          // Update database
          const { error: updateError } = await supabase
            .from('verification_sessions')
            .update({ audio_analysis: audioAnalysis })
            .eq('id', session.id);
          
          if (updateError) {
            console.error(`  ❌ Database update error: ${updateError.message}`);
          } else {
            console.log(`  💾 Updated database`);
          }
        } else {
          console.log(`  ❌ Audio analysis failed`);
        }
      } else {
        console.log(`  ℹ️  No recording URL`);
      }
      
      console.log('');
    }
    
    console.log('═'.repeat(70));
    console.log('✅ TEST COMPLETE!');
    console.log('═'.repeat(70) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
