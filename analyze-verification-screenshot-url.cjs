/**
 * Analyze a verification screenshot from a URL using ChatGPT
 */

const https = require('https');
const http = require('http');

// OpenAI API key
const OPENAI_API_KEY = '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';

// Get URL from command line
const imageUrl = process.argv[2];
const verificationMethod = process.argv[3] || 'zoom';

if (!imageUrl) {
  console.error('Usage: node analyze-verification-screenshot-url.cjs <image_url> [verification_method]');
  console.error('Example: node analyze-verification-screenshot-url.cjs "https://..." zoom');
  process.exit(1);
}

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function analyzeScreenshotWithAI(base64Image, verificationMethod = 'zoom') {
  const prompt = verificationMethod === 'zoom' 
    ? `You are analyzing a screenshot submitted by an insurance agent for verification.

**REQUIREMENTS FOR ZOOM VERIFICATION:**
- Must show a Zoom meeting interface (look for Zoom UI elements like gallery view, toolbar, participant names)
- Must show AT LEAST 2 people visible in the video (the agent AND the client)
- Both people should be clearly visible with their cameras on
- Valid examples: Zoom gallery view with multiple participants, Zoom meeting with speaker view showing multiple people

**INVALID submissions include:**
- Random screenshots or photos
- Screenshots showing only 1 person
- Screenshots with no Zoom interface visible
- Screenshots of other applications
- Blurry or unclear images where people/UI cannot be identified

**YOUR RESPONSE MUST BE VALID JSON with this exact structure:**
{
  "isValid": true or false,
  "confidence": 0.0 to 1.0,
  "validationType": "zoom_meeting" | "video_call" | "invalid" | "unclear",
  "detectedElements": {
    "hasMultiplePeople": true/false,
    "hasVideoCallInterface": true/false,
    "hasZoomUI": true/false,
    "hasFaceTimeUI": true/false,
    "hasWhatsAppUI": true/false,
    "hasOtherVideoCallUI": true/false,
    "peopleCount": number (0 if unclear)
  },
  "reason": "Clear explanation of why this is valid or invalid",
  "issues": ["Array of specific issues if invalid, empty array if valid"]
}

Be strict but fair in validation. If the screenshot clearly shows the required elements, mark as valid.`
    : `You are analyzing a screenshot submitted by an insurance agent for phone/video call verification.

**REQUIREMENTS FOR PHONE/VIDEO CALL VERIFICATION:**
- Must show a video call interface (FaceTime, WhatsApp Video, Zoom, Google Meet, etc.)
- Must show AT LEAST 2 people visible (the agent AND the client) OR show a video call in progress with clear indicators
- Valid examples: FaceTime call screen, WhatsApp video call, Zoom mobile call, any video conferencing app showing a call in progress

**INVALID submissions include:**
- Random screenshots or photos
- Regular phone calls (voice only, no video)
- Screenshots showing only 1 person with no video call interface
- Screenshots that are clearly not from a video call

**YOUR RESPONSE MUST BE VALID JSON with this exact structure:**
{
  "isValid": true or false,
  "confidence": 0.0 to 1.0,
  "validationType": "zoom_meeting" | "video_call" | "invalid" | "unclear",
  "detectedElements": {
    "hasMultiplePeople": true/false,
    "hasVideoCallInterface": true/false,
    "hasZoomUI": true/false,
    "hasFaceTimeUI": true/false,
    "hasWhatsAppUI": true/false,
    "hasOtherVideoCallUI": true/false,
    "peopleCount": number (0 if unclear)
  },
  "reason": "Clear explanation of why this is valid or invalid",
  "issues": ["Array of specific issues if invalid, empty array if valid"]
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

async function main() {
  console.log('\n🚀 VERIFICATION SCREENSHOT ANALYSIS');
  console.log('═'.repeat(70));
  console.log(`📸 URL: ${imageUrl}`);
  console.log(`🔍 Method: ${verificationMethod.toUpperCase()}`);
  console.log('═'.repeat(70));
  
  try {
    console.log('\n📥 Downloading image from URL...');
    const imageBuffer = await downloadImage(imageUrl);
    const fileSizeKB = (imageBuffer.length / 1024).toFixed(2);
    console.log(`✅ Downloaded: ${fileSizeKB} KB`);
    
    const base64Image = imageBuffer.toString('base64');
    
    console.log('\n🤖 Sending to ChatGPT for AI validation...');
    const result = await analyzeScreenshotWithAI(base64Image, verificationMethod);
    
    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('🤖 AI VALIDATION RESULT');
    console.log('='.repeat(70));
    
    const statusEmoji = result.isValid ? '✅' : '❌';
    const statusColor = result.isValid ? '\x1b[32m' : '\x1b[31m';
    const resetColor = '\x1b[0m';
    
    console.log(`\n${statusColor}${statusEmoji} STATUS: ${result.isValid ? 'VALID' : 'INVALID'}${resetColor}`);
    console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`🏷️  Type: ${result.validationType}`);
    
    console.log(`\n💭 AI REASONING:`);
    console.log(`   ${result.reason}`);
    
    if (result.detectedElements) {
      console.log(`\n🔍 DETECTED ELEMENTS:`);
      console.log(`   • Multiple People: ${result.detectedElements.hasMultiplePeople ? 'YES ✓' : 'NO ✗'}`);
      console.log(`   • People Count: ${result.detectedElements.peopleCount || 'Unknown'}`);
      console.log(`   • Video Call Interface: ${result.detectedElements.hasVideoCallInterface ? 'YES ✓' : 'NO ✗'}`);
      console.log(`   • Zoom UI: ${result.detectedElements.hasZoomUI ? 'YES ✓' : 'NO ✗'}`);
      console.log(`   • FaceTime UI: ${result.detectedElements.hasFaceTimeUI ? 'YES ✓' : 'NO ✗'}`);
      console.log(`   • WhatsApp UI: ${result.detectedElements.hasWhatsAppUI ? 'YES ✓' : 'NO ✗'}`);
      console.log(`   • Other Video Call UI: ${result.detectedElements.hasOtherVideoCallUI ? 'YES ✓' : 'NO ✗'}`);
    }
    
    if (result.issues && result.issues.length > 0) {
      console.log(`\n⚠️  ISSUES FOUND:`);
      result.issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
    }
    
    console.log('\n' + '='.repeat(70));
    
    // Decision summary
    console.log('\n📋 DECISION SUMMARY:');
    if (result.isValid) {
      console.log(`   ${statusColor}✅ This screenshot would be ACCEPTED${resetColor}`);
      console.log(`   Agent can proceed with verification.`);
    } else if (result.confidence > 0.7) {
      console.log(`   ${statusColor}❌ This screenshot would be REJECTED${resetColor}`);
      console.log(`   Agent would need to submit a different screenshot.`);
    } else {
      console.log(`   ⚠️  This screenshot is UNCLEAR (low confidence)`);
      console.log(`   It would be accepted but flagged for admin review.`);
    }
    
    console.log('\n═'.repeat(70));
    console.log('✅ Analysis complete!\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

main();

