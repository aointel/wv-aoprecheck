/**
 * Test audio analysis on local MP3 files
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// OpenAI API key
const OPENAI_API_KEY = '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';

async function analyzeLocalAudio(audioPath) {
  console.log('\n' + '═'.repeat(70));
  console.log('🎙️  AUDIO ANALYSIS TEST');
  console.log('═'.repeat(70));
  console.log(`📁 File: ${audioPath}`);
  console.log('═'.repeat(70));
  
  try {
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error(`File not found: ${audioPath}`);
    }
    
    const stats = fs.statSync(audioPath);
    console.log(`\n📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Transcribe with Whisper
    console.log('\n🎤 Transcribing with OpenAI Whisper...');
    console.log('⏳ This may take 20-40 seconds...');
    
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
      const error = await whisperResponse.text();
      throw new Error(`Whisper API error (${whisperResponse.status}): ${error}`);
    }
    
    const transcription = await whisperResponse.json();
    const transcript = transcription.text;
    const duration = transcription.duration || 0;
    
    console.log(`✅ Transcribed ${transcript.length} characters (${duration.toFixed(1)}s)`);
    
    // Analyze with GPT
    console.log('\n🤖 Analyzing with GPT...');
    
    const prompt = `You are analyzing a transcript from an insurance verification call. The call may be in ENGLISH or SPANISH.

**ANALYSIS REQUIREMENTS:**
1. **Validation** - Is this a legitimate verification call with agent and client discussing policy?
2. **Summary** - Brief 2-3 sentence summary (in English, even if call was in Spanish)
3. **Key Moments** - Identify 3-5 key moments with timestamps (estimate based on conversation flow)
4. **Sentiment** - Positive, Neutral, or Negative
5. **Issues** - Any problems detected

**TRANSCRIPT (may be English or Spanish):**
${transcript}

**RESPONSE FORMAT (MUST BE VALID JSON IN ENGLISH):**
{
  "summary": "Brief summary in English",
  "validation": {
    "isValid": true/false,
    "confidence": 0.0-1.0,
    "reason": "Explanation in English",
    "detectedIssues": ["array in English"]
  },
  "keyMoments": [
    {"timestamp": "0:15", "description": "description in English"}
  ],
  "sentiment": "Positive|Neutral|Negative"
}`;

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing insurance verification calls. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });
    
    if (!gptResponse.ok) {
      const error = await gptResponse.text();
      throw new Error(`GPT API error (${gptResponse.status}): ${error}`);
    }
    
    const gptData = await gptResponse.json();
    const aiResponse = gptData.choices[0]?.message?.content || '{}';
    
    // Parse JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    console.log('✅ Analysis complete!\n');
    
    // Display results
    console.log('='.repeat(70));
    console.log('🤖 AI ANALYSIS RESULTS');
    console.log('='.repeat(70));
    
    const statusEmoji = analysis.validation.isValid ? '✅' : '❌';
    const statusColor = analysis.validation.isValid ? '\x1b[32m' : '\x1b[31m';
    const resetColor = '\x1b[0m';
    
    console.log(`\n${statusColor}${statusEmoji} STATUS: ${analysis.validation.isValid ? 'VALID CALL' : 'INVALID CALL'}${resetColor}`);
    console.log(`📊 Confidence: ${(analysis.validation.confidence * 100).toFixed(0)}%`);
    console.log(`😊 Sentiment: ${analysis.sentiment}`);
    console.log(`⏱️  Duration: ${duration.toFixed(1)}s`);
    
    console.log(`\n📝 SUMMARY:`);
    console.log(`   ${analysis.summary}`);
    
    console.log(`\n💭 REASONING:`);
    console.log(`   ${analysis.validation.reason}`);
    
    if (analysis.keyMoments && analysis.keyMoments.length > 0) {
      console.log(`\n🎯 KEY MOMENTS:`);
      analysis.keyMoments.forEach((m, i) => {
        console.log(`   ${i + 1}. [${m.timestamp}] ${m.description}`);
      });
    }
    
    if (analysis.validation.detectedIssues && analysis.validation.detectedIssues.length > 0) {
      console.log(`\n⚠️  DETECTED ISSUES:`);
      analysis.validation.detectedIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    
    console.log(`\n📄 TRANSCRIPT (${transcript.length} chars):`);
    console.log('─'.repeat(70));
    const preview = transcript.length > 500 ? transcript.substring(0, 500) + '...' : transcript;
    console.log(preview);
    console.log('─'.repeat(70));
    
    console.log('\n═'.repeat(70) + '\n');
    
    return { ...analysis, transcript, duration };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return null;
  }
}

async function main() {
  const audioFiles = [
    'recordings/68eedf5948db301243d8d9b4.mp3',
    'recordings/68eedfc47143cbaaf7becad1.mp3',
    'recordings/68eee02ac000b7779bd48a24.mp3'
  ];
  
  console.log('\n🚀 TESTING AUDIO ANALYSIS');
  console.log(`📊 Analyzing ${audioFiles.length} recordings`);
  console.log('⏳ Each takes ~30-60 seconds\n');
  
  const results = [];
  
  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    
    console.log(`\n${'█'.repeat(70)}`);
    console.log(`TEST ${i + 1}/${audioFiles.length}: ${path.basename(file)}`);
    console.log('█'.repeat(70));
    
    const result = await analyzeLocalAudio(file);
    
    if (result) {
      results.push({
        file: path.basename(file),
        isValid: result.validation.isValid,
        confidence: result.validation.confidence,
        sentiment: result.sentiment,
        duration: result.duration
      });
    }
    
    if (i < audioFiles.length - 1) {
      console.log('\n⏳ Waiting 2 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n' + '█'.repeat(70));
  console.log('📊 SUMMARY');
  console.log('█'.repeat(70));
  
  const validCount = results.filter(r => r.isValid).length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  results.forEach(r => {
    const icon = r.isValid ? '✅' : '❌';
    console.log(`${icon} ${r.file}: ${r.isValid ? 'VALID' : 'INVALID'} (${(r.confidence * 100).toFixed(0)}% conf, ${r.sentiment}, ${r.duration.toFixed(1)}s)`);
  });
  
  console.log(`\n🎯 Valid Calls: ${validCount}/${results.length}`);
  console.log(`📊 Avg Confidence: ${(avgConfidence * 100).toFixed(0)}%`);
  console.log(`⏱️  Total Audio: ${totalDuration.toFixed(1)}s`);
  console.log('█'.repeat(70) + '\n');
}

// Command line usage
const args = process.argv.slice(2);

if (args.length >= 1) {
  // Single file
  analyzeLocalAudio(args[0]).then(() => {
    console.log('✅ Complete!');
  }).catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
} else {
  // Run all
  main().then(() => {
    console.log('✅ All complete!');
  }).catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
}

