/**
 * Direct analysis of screenshots using OpenAI API (no server needed)
 */

const fs = require('fs');
const path = require('path');

// OpenAI API key (using the one from your config)
const OPENAI_API_KEY = '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';

// Screenshot directories to analyze
const SCREENSHOT_DIRS = [
  'recordings/screenshots/38ce5ab6-6200-47a9-bb47-aea5ce73eb9f',
  'recordings/screenshots/68b659df-6f55-492d-a570-b18abb83059a',
  'recordings/screenshots/session_1760815246680_exa8ai6rs'
];

async function analyzeScreenshotWithAI(base64Image, verificationMethod = 'zoom') {
  const prompt = verificationMethod === 'zoom' 
    ? `You are analyzing a screenshot from an insurance agent verification session.

**REQUIREMENTS FOR ZOOM VERIFICATION:**
- Must show a Zoom meeting interface (look for Zoom UI elements like gallery view, toolbar, participant names)
- Must show AT LEAST 2 people visible in the video (the agent AND the client)
- Both people should be clearly visible with their cameras on

**YOUR RESPONSE MUST BE VALID JSON:**
{
  "isValid": true or false,
  "confidence": 0.0 to 1.0,
  "validationType": "zoom_meeting" | "video_call" | "invalid" | "unclear",
  "detectedElements": {
    "hasMultiplePeople": true/false,
    "peopleCount": number,
    "hasZoomUI": true/false,
    "hasVideoCallInterface": true/false
  },
  "reason": "Clear explanation",
  "issues": ["Array of issues if invalid"]
}`
    : `You are analyzing a screenshot from an insurance agent verification session.

**REQUIREMENTS FOR PHONE/VIDEO CALL VERIFICATION:**
- Must show a video call interface (FaceTime, WhatsApp Video, Zoom, etc.)
- Must show AT LEAST 2 people visible OR clear video call indicators

**YOUR RESPONSE MUST BE VALID JSON:**
{
  "isValid": true or false,
  "confidence": 0.0 to 1.0,
  "validationType": "zoom_meeting" | "video_call" | "invalid" | "unclear",
  "detectedElements": {
    "hasMultiplePeople": true/false,
    "peopleCount": number,
    "hasFaceTimeUI": true/false,
    "hasWhatsAppUI": true/false,
    "hasVideoCallInterface": true/false
  },
  "reason": "Clear explanation",
  "issues": ["Array of issues if invalid"]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '{}';
    
    // Parse JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    
    return JSON.parse(jsonMatch[0]);
    
  } catch (error) {
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

async function analyzeScreenshot(imagePath, sessionFolder, screenshotNumber, verificationMethod = 'zoom') {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📸 Screenshot #${screenshotNumber}`);
  console.log(`📁 Session: ${sessionFolder}`);
  console.log(`📄 File: ${path.basename(imagePath)}`);
  console.log('='.repeat(70));
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ File not found: ${imagePath}`);
    return null;
  }
  
  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  const fileSizeKB = (imageBuffer.length / 1024).toFixed(2);
  console.log(`📊 Size: ${fileSizeKB} KB`);
  
  try {
    console.log(`🤖 Sending to ChatGPT for analysis...`);
    
    const result = await analyzeScreenshotWithAI(base64Image, verificationMethod);
    
    // Display results
    const statusEmoji = result.isValid ? '✅' : '❌';
    const statusColor = result.isValid ? '\x1b[32m' : '\x1b[31m';
    const resetColor = '\x1b[0m';
    
    console.log(`\n${statusColor}${statusEmoji} VALIDATION: ${result.isValid ? 'VALID' : 'INVALID'}${resetColor}`);
    console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`🏷️  Type: ${result.validationType}`);
    
    console.log(`\n💭 AI Reasoning:`);
    console.log(`   ${result.reason}`);
    
    if (result.detectedElements) {
      console.log(`\n🔍 Detected:`);
      if (result.detectedElements.hasMultiplePeople) {
        console.log(`   ✓ Multiple people (${result.detectedElements.peopleCount || '2+'} detected)`);
      } else {
        console.log(`   ✗ Only ${result.detectedElements.peopleCount || 0} person(s) detected`);
      }
      if (result.detectedElements.hasZoomUI) console.log(`   ✓ Zoom interface`);
      if (result.detectedElements.hasFaceTimeUI) console.log(`   ✓ FaceTime interface`);
      if (result.detectedElements.hasWhatsAppUI) console.log(`   ✓ WhatsApp interface`);
      if (result.detectedElements.hasVideoCallInterface) console.log(`   ✓ Video call interface`);
    }
    
    if (result.issues && result.issues.length > 0) {
      console.log(`\n⚠️  Issues:`);
      result.issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Analysis failed:`, error.message);
    return null;
  }
}

async function analyzeSessionScreenshots(sessionDir, sampleSize = 3, verificationMethod = 'zoom') {
  const fullPath = path.join(__dirname, sessionDir);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`\n⚠️  Directory not found: ${sessionDir}`);
    return;
  }
  
  // Get all screenshots
  const screenshots = fs.readdirSync(fullPath)
    .filter(f => f.endsWith('.png'))
    .sort();
  
  console.log(`\n\n${'█'.repeat(70)}`);
  console.log(`📁 SESSION: ${path.basename(sessionDir)}`);
  console.log(`📸 Total Screenshots: ${screenshots.length}`);
  console.log('█'.repeat(70));
  
  if (screenshots.length === 0) {
    console.log(`⚠️  No screenshots found in this session`);
    return;
  }
  
  // Sample screenshots evenly distributed
  const step = Math.max(1, Math.floor(screenshots.length / sampleSize));
  const samplesToAnalyze = [];
  
  for (let i = 0; i < screenshots.length && samplesToAnalyze.length < sampleSize; i += step) {
    samplesToAnalyze.push(screenshots[i]);
  }
  
  console.log(`🎯 Analyzing ${samplesToAnalyze.length} sample screenshots...`);
  
  const results = [];
  for (let i = 0; i < samplesToAnalyze.length; i++) {
    const screenshot = samplesToAnalyze[i];
    const screenshotPath = path.join(fullPath, screenshot);
    
    const result = await analyzeScreenshot(
      screenshotPath, 
      path.basename(sessionDir),
      i + 1,
      verificationMethod
    );
    
    if (result) {
      results.push({
        file: screenshot,
        isValid: result.isValid,
        confidence: result.confidence,
        validationType: result.validationType
      });
    }
    
    // Wait between requests to avoid rate limiting
    if (i < samplesToAnalyze.length - 1) {
      console.log(`\n⏳ Waiting 2 seconds before next analysis...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Session summary
  if (results.length > 0) {
    const validCount = results.filter(r => r.isValid).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📊 SESSION SUMMARY:`);
    console.log(`   Valid: ${validCount}/${results.length} (${(validCount/results.length*100).toFixed(0)}%)`);
    console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log('─'.repeat(70));
  }
  
  return results;
}

async function main() {
  console.log('\n🚀 DIRECT CHATGPT SCREENSHOT ANALYSIS');
  console.log('🤖 Using OpenAI API directly (no server needed)');
  console.log('═'.repeat(70));
  
  const allResults = [];
  
  // NOTE: These are HPPRO presentation screenshots, not verification screenshots
  // So we'll analyze them but they're expected to be "invalid" for verification purposes
  console.log('\n⚠️  NOTE: These appear to be HPPRO presentation screenshots');
  console.log('   They will likely be marked "invalid" for verification purposes');
  console.log('   (since they show insurance presentations, not video calls)\n');
  
  for (let i = 0; i < SCREENSHOT_DIRS.length; i++) {
    const sessionDir = SCREENSHOT_DIRS[i];
    const results = await analyzeSessionScreenshots(sessionDir, 2); // Analyze 2 samples per session
    
    if (results) {
      allResults.push({
        session: path.basename(sessionDir),
        results
      });
    }
    
    if (i < SCREENSHOT_DIRS.length - 1) {
      console.log(`\n\n⏳ Waiting 3 seconds before next session...\n`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Final summary
  console.log(`\n\n${'█'.repeat(70)}`);
  console.log(`🎯 OVERALL ANALYSIS SUMMARY`);
  console.log('█'.repeat(70));
  
  allResults.forEach(sessionData => {
    const validCount = sessionData.results.filter(r => r.isValid).length;
    const totalCount = sessionData.results.length;
    const avgConf = sessionData.results.reduce((sum, r) => sum + r.confidence, 0) / totalCount;
    
    console.log(`\n📁 ${sessionData.session}`);
    console.log(`   ✅ Valid: ${validCount}/${totalCount} (${(validCount/totalCount*100).toFixed(0)}%)`);
    console.log(`   ❌ Invalid: ${totalCount-validCount}/${totalCount} (${((totalCount-validCount)/totalCount*100).toFixed(0)}%)`);
    console.log(`   📊 Avg Confidence: ${(avgConf * 100).toFixed(1)}%`);
  });
  
  const totalAnalyzed = allResults.reduce((sum, s) => sum + s.results.length, 0);
  const totalValid = allResults.reduce((sum, s) => sum + s.results.filter(r => r.isValid).length, 0);
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🎯 GRAND TOTAL:`);
  console.log(`   Screenshots Analyzed: ${totalAnalyzed}`);
  console.log(`   Valid: ${totalValid}/${totalAnalyzed} (${(totalValid/totalAnalyzed*100).toFixed(0)}%)`);
  console.log(`   Invalid: ${totalAnalyzed - totalValid}/${totalAnalyzed} (${((totalAnalyzed-totalValid)/totalAnalyzed*100).toFixed(0)}%)`);
  console.log('═'.repeat(70));
  
  console.log(`\n✅ Analysis complete!`);
  console.log(`\n💡 Tip: These screenshots are from HPPRO presentations, not verification calls.`);
  console.log(`   For real verification screenshots, look for images showing Zoom/video calls.`);
}

// Run the analysis
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

