/**
 * Direct test of audio analysis without needing server running
 * Uses OpenAI API directly
 */

const https = require('https');
const http = require('http');

// OpenAI API key
const OPENAI_API_KEY = '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';

async function downloadAudio(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function analyzeAudio(audioUrl) {
  console.log('\n' + '═'.repeat(70));
  console.log('🎙️  DIRECT AUDIO ANALYSIS TEST');
  console.log('═'.repeat(70));
  console.log(`📥 URL: ${audioUrl}`);
  console.log('═'.repeat(70));
  
  try {
    // Download audio
    console.log('\n📥 Downloading audio...');
    const audioBuffer = await downloadAudio(audioUrl);
    console.log(`✅ Downloaded: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    
    // Transcribe with Whisper
    console.log('\n🎤 Transcribing with OpenAI Whisper...');
    console.log('⏳ This may take 20-40 seconds...');
    
    const fs = require('fs');
    const path = require('path');
    const FormData = require('form-data');
    
    // Save to temp file
    const tempFile = path.join(__dirname, `temp-audio-${Date.now()}.mp3`);
    fs.writeFileSync(tempFile, audioBuffer);
    
    // Create form data for Whisper API
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
      const error = await whisperResponse.text();
      throw new Error(`Whisper API error: ${error}`);
    }
    
    const transcription = await whisperResponse.json();
    const transcript = transcription.text;
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log(`✅ Transcribed ${transcript.length} characters`);
    
    // Analyze with GPT
    console.log('\n🤖 Analyzing with GPT...');
    
    const prompt = `You are analyzing a transcript from an insurance verification call.

**ANALYSIS REQUIREMENTS:**
1. **Validation** - Is this a legitimate verification call with agent and client discussing policy?
2. **Summary** - Brief 2-3 sentence summary
3. **Key Moments** - Identify 3-5 key moments with timestamps
4. **Sentiment** - Positive, Neutral, or Negative
5. **Issues** - Any problems detected

**TRANSCRIPT:**
${transcript}

**RESPONSE FORMAT (MUST BE VALID JSON):**
{
  "summary": "Brief summary",
  "validation": {
    "isValid": true/false,
    "confidence": 0.0-1.0,
    "reason": "Explanation",
    "detectedIssues": ["array"]
  },
  "keyMoments": [
    {"timestamp": "0:15", "description": "..."}
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
      throw new Error(`GPT API error: ${error}`);
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
    console.log('🤖 RESULTS');
    console.log('='.repeat(70));
    
    const statusEmoji = analysis.validation.isValid ? '✅' : '❌';
    const statusColor = analysis.validation.isValid ? '\x1b[32m' : '\x1b[31m';
    const resetColor = '\x1b[0m';
    
    console.log(`\n${statusColor}${statusEmoji} STATUS: ${analysis.validation.isValid ? 'VALID CALL' : 'INVALID CALL'}${resetColor}`);
    console.log(`📊 Confidence: ${(analysis.validation.confidence * 100).toFixed(0)}%`);
    console.log(`😊 Sentiment: ${analysis.sentiment}`);
    
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
      console.log(`\n⚠️  ISSUES:`);
      analysis.validation.detectedIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    
    console.log(`\n📄 TRANSCRIPT:`);
    console.log('─'.repeat(70));
    console.log(transcript);
    console.log('─'.repeat(70));
    
    console.log('\n═'.repeat(70) + '\n');
    
    return { ...analysis, transcript };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return null;
  }
}

// Test with provided URL or default
const audioUrl = process.argv[2] || 'https://recordings.taalk.ai/rec_68eedf5948db301243d8d9b4.mp3';

console.log('\n🚀 STARTING AUDIO ANALYSIS');
console.log('⏳ This will take 30-60 seconds...\n');

analyzeAudio(audioUrl).then((result) => {
  if (result) {
    console.log('✅ Test complete!');
  } else {
    console.log('❌ Test failed');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

