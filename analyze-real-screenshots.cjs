/**
 * Analyze real screenshots from the recordings folder using AI validation
 */

const fs = require('fs');
const path = require('path');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

// Screenshot directories to analyze
const SCREENSHOT_DIRS = [
  'recordings/screenshots/38ce5ab6-6200-47a9-bb47-aea5ce73eb9f',
  'recordings/screenshots/68b659df-6f55-492d-a570-b18abb83059a',
  'recordings/screenshots/session_1760815246680_exa8ai6rs'
];

async function analyzeScreenshot(imagePath, sessionFolder, screenshotNumber) {
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
  const dataUri = `data:image/png;base64,${base64Image}`;
  
  const fileSizeKB = (imageBuffer.length / 1024).toFixed(2);
  console.log(`📊 Size: ${fileSizeKB} KB`);
  
  try {
    console.log(`🤖 Sending to AI for analysis...`);
    
    const response = await fetch(`${SERVER_URL}/api/test-verification-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        screenshotData: dataUri,
        verificationMethod: 'zoom' // Assuming zoom for these
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      return null;
    }
    
    const result = await response.json();
    
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
        console.log(`   ✗ Only ${result.detectedElements.peopleCount || 0} person detected`);
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

async function analyzeSessionScreenshots(sessionDir, sampleSize = 3) {
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
      i + 1
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
    console.log(`   Valid: ${validCount}/${results.length}`);
    console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log('─'.repeat(70));
  }
  
  return results;
}

async function main() {
  console.log('\n🚀 REAL SCREENSHOT AI ANALYSIS');
  console.log('🌐 Server:', SERVER_URL);
  console.log('═'.repeat(70));
  
  const allResults = [];
  
  for (let i = 0; i < SCREENSHOT_DIRS.length; i++) {
    const sessionDir = SCREENSHOT_DIRS[i];
    const results = await analyzeSessionScreenshots(sessionDir, 3); // Analyze 3 samples per session
    
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
}

// Run the analysis
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

