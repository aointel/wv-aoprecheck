/**
 * Test audio analysis on verification call recordings
 */

async function analyzeAudio(audioUrl, verificationMethod = 'phone') {
  console.log('\n' + '═'.repeat(70));
  console.log('🎙️  VERIFICATION CALL AUDIO ANALYSIS');
  console.log('═'.repeat(70));
  console.log(`📥 URL: ${audioUrl.substring(0, 100)}...`);
  console.log(`🔍 Method: ${verificationMethod.toUpperCase()}`);
  console.log('═'.repeat(70));
  
  try {
    console.log('\n🤖 Sending to AI for transcription and analysis...');
    console.log('⏳ This may take 30-60 seconds...\n');
    
    const startTime = Date.now();
    
    const response = await fetch('http://localhost:5000/api/test-audio-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioUrl: audioUrl,
        verificationMethod: verificationMethod
      })
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      return null;
    }
    
    const result = await response.json();
    
    console.log(`✅ Analysis complete in ${duration}s\n`);
    
    // Display results
    console.log('='.repeat(70));
    console.log('🤖 AI AUDIO ANALYSIS RESULTS');
    console.log('='.repeat(70));
    
    // Overall Status
    const statusEmoji = result.validation.isValid ? '✅' : '❌';
    const statusColor = result.validation.isValid ? '\x1b[32m' : '\x1b[31m';
    const resetColor = '\x1b[0m';
    
    console.log(`\n${statusColor}${statusEmoji} STATUS: ${result.validation.isValid ? 'VALID CALL' : 'INVALID CALL'}${resetColor}`);
    console.log(`📊 Confidence: ${(result.validation.confidence * 100).toFixed(0)}%`);
    console.log(`😊 Sentiment: ${result.sentiment}`);
    
    // Summary
    console.log(`\n📝 CALL SUMMARY:`);
    console.log(`   ${result.summary}`);
    
    // AI Reasoning
    console.log(`\n💭 VALIDATION REASONING:`);
    console.log(`   ${result.validation.reason}`);
    
    // Key Moments
    if (result.keyMoments && result.keyMoments.length > 0) {
      console.log(`\n🎯 KEY MOMENTS:`);
      result.keyMoments.forEach((moment, idx) => {
        console.log(`   ${idx + 1}. [${moment.timestamp}] ${moment.description}`);
      });
    }
    
    // Issues
    if (result.validation.detectedIssues && result.validation.detectedIssues.length > 0) {
      console.log(`\n⚠️  DETECTED ISSUES:`);
      result.validation.detectedIssues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
    }
    
    // Transcript
    console.log(`\n📄 FULL TRANSCRIPT:`);
    console.log('─'.repeat(70));
    console.log(result.transcript);
    console.log('─'.repeat(70));
    
    console.log(`\n⏱️  Analysis Duration: ${duration}s`);
    console.log('═'.repeat(70) + '\n');
    
    return result;
    
  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    return null;
  }
}

async function main() {
  // Test recordings
  const testRecordings = [
    {
      name: 'Recording 1',
      url: 'https://recordings.taalk.ai/rec_68eedf5948db301243d8d9b4.mp3',
      method: 'phone'
    },
    {
      name: 'Recording 2',
      url: 'https://recordings.taalk.ai/rec_68eedfc47143cbaaf7becad1.mp3',
      method: 'phone'
    },
    {
      name: 'Recording 3',
      url: 'https://recordings.taalk.ai/rec_68eee02ac000b7779bd48a24.mp3',
      method: 'phone'
    }
  ];
  
  console.log('\n🚀 STARTING AUDIO ANALYSIS TESTS');
  console.log(`📊 Testing ${testRecordings.length} recordings`);
  console.log('⏳ Each recording takes ~30-60 seconds to process\n');
  
  const results = [];
  
  for (let i = 0; i < testRecordings.length; i++) {
    const recording = testRecordings[i];
    console.log(`\n${'█'.repeat(70)}`);
    console.log(`TEST ${i + 1}/${testRecordings.length}: ${recording.name}`);
    console.log('█'.repeat(70));
    
    const result = await analyzeAudio(recording.url, recording.method);
    
    if (result) {
      results.push({
        name: recording.name,
        isValid: result.validation.isValid,
        confidence: result.validation.confidence,
        sentiment: result.sentiment
      });
    }
    
    // Wait between tests
    if (i < testRecordings.length - 1) {
      console.log('\n⏳ Waiting 3 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Summary
  console.log('\n' + '█'.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('█'.repeat(70));
  
  const validCount = results.filter(r => r.isValid).length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  
  results.forEach((r, idx) => {
    const icon = r.isValid ? '✅' : '❌';
    console.log(`${icon} ${r.name}: ${r.isValid ? 'VALID' : 'INVALID'} (${(r.confidence * 100).toFixed(0)}% confidence, ${r.sentiment} sentiment)`);
  });
  
  console.log(`\n🎯 Results: ${validCount}/${results.length} valid calls`);
  console.log(`📊 Average Confidence: ${(avgConfidence * 100).toFixed(0)}%`);
  console.log('█'.repeat(70) + '\n');
  
  console.log('✅ All tests complete!\n');
}

// Command line usage
const args = process.argv.slice(2);

if (args.length >= 1) {
  // Single audio test mode
  const audioUrl = args[0];
  const method = args[1] || 'phone';
  
  analyzeAudio(audioUrl, method).then(() => {
    console.log('✅ Test complete!');
  }).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
} else {
  // Run all tests
  main().then(() => {
    console.log('✅ All tests complete!');
  }).catch(error => {
    console.error('❌ Tests failed:', error);
    process.exit(1);
  });
}

