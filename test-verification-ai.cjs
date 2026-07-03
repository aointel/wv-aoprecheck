/**
 * Test script for AI verification screenshot validation
 * Tests the AI's ability to validate screenshots for zoom/phone verifications
 */

const fs = require('fs');
const path = require('path');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

async function testScreenshotValidation(imagePath, verificationMethod = 'zoom') {
  console.log(`\n🧪 Testing AI validation for ${verificationMethod.toUpperCase()} verification`);
  console.log(`📸 Image: ${imagePath}`);
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image file not found: ${imagePath}`);
    return null;
  }
  
  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64Image}`;
  
  console.log(`📊 Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
  
  try {
    const response = await fetch(`${SERVER_URL}/api/test-verification-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screenshotData: dataUri,
        verificationMethod: verificationMethod
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      return null;
    }
    
    const result = await response.json();
    
    // Display results
    console.log('\n' + '='.repeat(60));
    console.log(`🤖 AI VALIDATION RESULT`);
    console.log('='.repeat(60));
    
    const statusEmoji = result.isValid ? '✅' : '❌';
    const statusText = result.isValid ? 'VALID' : 'INVALID';
    console.log(`\n${statusEmoji} Status: ${statusText}`);
    console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`🏷️  Type: ${result.validationType}`);
    
    console.log(`\n💭 Reason:`);
    console.log(`   ${result.reason}`);
    
    if (result.detectedElements) {
      console.log(`\n🔍 Detected Elements:`);
      console.log(`   • Multiple People: ${result.detectedElements.hasMultiplePeople ? 'YES' : 'NO'}`);
      console.log(`   • People Count: ${result.detectedElements.peopleCount || 'Unknown'}`);
      console.log(`   • Video Call Interface: ${result.detectedElements.hasVideoCallInterface ? 'YES' : 'NO'}`);
      console.log(`   • Zoom UI: ${result.detectedElements.hasZoomUI ? 'YES' : 'NO'}`);
      console.log(`   • FaceTime UI: ${result.detectedElements.hasFaceTimeUI ? 'YES' : 'NO'}`);
      console.log(`   • WhatsApp UI: ${result.detectedElements.hasWhatsAppUI ? 'YES' : 'NO'}`);
      console.log(`   • Other Video Call UI: ${result.detectedElements.hasOtherVideoCallUI ? 'YES' : 'NO'}`);
    }
    
    if (result.issues && result.issues.length > 0) {
      console.log(`\n⚠️  Issues Found:`);
      result.issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    return result;
    
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log('\n🚀 Starting AI Verification Screenshot Validation Tests');
  console.log(`🌐 Server URL: ${SERVER_URL}`);
  console.log('='.repeat(60));
  
  // Test cases - add your test images here
  const testCases = [
    {
      name: 'Valid Zoom Screenshot',
      path: path.join(__dirname, 'test-images', 'valid-zoom.png'),
      method: 'zoom',
      expectedValid: true
    },
    {
      name: 'Valid FaceTime Screenshot',
      path: path.join(__dirname, 'test-images', 'valid-facetime.png'),
      method: 'phone',
      expectedValid: true
    },
    {
      name: 'Invalid Random Photo',
      path: path.join(__dirname, 'test-images', 'invalid-random.png'),
      method: 'zoom',
      expectedValid: false
    },
    {
      name: 'Invalid Single Person',
      path: path.join(__dirname, 'test-images', 'invalid-single-person.png'),
      method: 'zoom',
      expectedValid: false
    }
  ];
  
  // Filter to only existing images
  const existingTests = testCases.filter(test => fs.existsSync(test.path));
  
  if (existingTests.length === 0) {
    console.log('\n⚠️  No test images found!');
    console.log('\n📝 To test the AI validation:');
    console.log('   1. Create a "test-images" folder in the project root');
    console.log('   2. Add test screenshot images (valid-zoom.png, valid-facetime.png, etc.)');
    console.log('   3. Run this script again');
    console.log('\nOR test with a specific image:');
    console.log('   node test-verification-ai.cjs path/to/your/image.png zoom');
    return;
  }
  
  // Run all test cases
  const results = [];
  for (const test of existingTests) {
    console.log(`\n📋 Test Case: ${test.name}`);
    const result = await testScreenshotValidation(test.path, test.method);
    
    if (result) {
      results.push({
        name: test.name,
        passed: result.isValid === test.expectedValid,
        expected: test.expectedValid,
        actual: result.isValid,
        confidence: result.confidence
      });
    }
    
    // Wait between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   Expected: ${r.expected ? 'VALID' : 'INVALID'}, Got: ${r.actual ? 'VALID' : 'INVALID'} (${(r.confidence * 100).toFixed(1)}% confidence)`);
  });
  
  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
  console.log('='.repeat(60) + '\n');
}

// Command line usage
const args = process.argv.slice(2);

if (args.length >= 1) {
  // Single image test mode
  const imagePath = args[0];
  const method = args[1] || 'zoom';
  
  testScreenshotValidation(imagePath, method).then(() => {
    console.log('✅ Test complete!');
  }).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
} else {
  // Run all tests
  runTests().then(() => {
    console.log('✅ All tests complete!');
  }).catch(error => {
    console.error('❌ Tests failed:', error);
    process.exit(1);
  });
}

