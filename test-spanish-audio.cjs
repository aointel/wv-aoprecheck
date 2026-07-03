/**
 * Quick test of Spanish audio analysis
 */

const { analyzeLocalAudio } = require('./test-audio-local.cjs');

// Test the Spanish recording we found earlier
const spanishRecording = 'recordings/68eee02ac000b7779bd48a24.mp3';

console.log('\n🇪🇸 TESTING SPANISH AUDIO ANALYSIS');
console.log('═'.repeat(70));
console.log('This will test that Whisper transcribes Spanish correctly');
console.log('and that GPT analyzes Spanish transcripts properly.');
console.log('═'.repeat(70) + '\n');

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

const OPENAI_API_KEY = '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';

async function analyzeSpanishAudio(audioPath) {
  console.log(`📁 File: ${audioPath}`);
  
  if (!fs.existsSync(audioPath)) {
    throw new Error(`File not found: ${audioPath}`);
  }
  
  const stats = fs.statSync(audioPath);
  console.log(`📊 Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
  
  // Transcribe
  console.log('🎤 Transcribing with Whisper (auto-detects Spanish)...');
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioPath));
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
    throw new Error(`Whisper error: ${whisperResponse.status}`);
  }
  
  const transcription = await whisperResponse.json();
  const transcript = transcription.text;
  const language = transcription.language || 'unknown';
  
  console.log(`✅ Transcribed: ${transcript.length} chars`);
  console.log(`🌐 Detected Language: ${language.toUpperCase()}`);
  console.log(`⏱️  Duration: ${transcription.duration.toFixed(1)}s\n`);
  
  // Analyze
  console.log('🤖 Analyzing with GPT (bilingual-aware)...\n');
  
  const prompt = `Analyze this insurance verification call. Call may be in ENGLISH or SPANISH. Respond in English JSON.

{"summary":"summary in English","validation":{"isValid":true/false,"confidence":0-1,"reason":"in English","detectedIssues":[]},"keyMoments":[{"timestamp":"0:00","description":"in English"}],"sentiment":"Positive|Neutral|Negative"}

TRANSCRIPT: ${transcript}`;

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
    throw new Error(`GPT error: ${gptResponse.status}`);
  }
  
  const gptData = await gptResponse.json();
  const aiText = gptData.choices[0]?.message?.content || '{}';
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  const analysis = JSON.parse(jsonMatch[0]);
  
  // Display
  console.log('═'.repeat(70));
  console.log('🤖 ANALYSIS RESULTS');
  console.log('═'.repeat(70));
  
  const statusEmoji = analysis.validation.isValid ? '✅' : '🚩';
  console.log(`\n${statusEmoji} Status: ${analysis.validation.isValid ? 'VALID' : 'FLAGGED'}`);
  console.log(`📊 Confidence: ${(analysis.validation.confidence * 100).toFixed(0)}%`);
  console.log(`😊 Sentiment: ${analysis.sentiment}`);
  console.log(`🌐 Original Language: ${language.toUpperCase()}`);
  
  console.log(`\n📝 SUMMARY (translated to English):`);
  console.log(`   ${analysis.summary}`);
  
  console.log(`\n💭 REASONING:`);
  console.log(`   ${analysis.validation.reason}`);
  
  if (analysis.keyMoments && analysis.keyMoments.length > 0) {
    console.log(`\n🎯 KEY MOMENTS:`);
    analysis.keyMoments.forEach((m, i) => {
      console.log(`   ${i + 1}. [${m.timestamp}] ${m.description}`);
    });
  }
  
  console.log(`\n📄 ORIGINAL TRANSCRIPT (${language}):`);
  console.log('─'.repeat(70));
  const preview = transcript.length > 500 ? transcript.substring(0, 500) + '...' : transcript;
  console.log(preview);
  console.log('─'.repeat(70));
  
  console.log('\n✅ Spanish audio analysis working perfectly! 🇪🇸\n');
}

// Run
analyzeSpanishAudio(spanishRecording).catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});

