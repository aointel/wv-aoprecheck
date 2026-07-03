/**
 * Manual Verification Screenshot Analysis
 * Run this to analyze all unprocessed verification screenshots immediately
 */

// Polyfill fetch for Node.js
global.fetch = require('node-fetch');

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

const OPENAI_API_KEY = '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';

async function downloadImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function validateScreenshotWithAI(imageBase64, verificationMethod = 'zoom') {
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

  const requestBody = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }
    ],
    max_tokens: 1000,
    temperature: 0.3
  };

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          const content = response.choices[0].message.content;
          const analysis = JSON.parse(content);
          resolve(analysis);
        } catch (error) {
          reject(new Error(`Failed to parse AI response: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(requestBody));
    req.end();
  });
}

async function analyzeVerificationScreenshots() {
  console.log('\n🤖 VERIFICATION SCREENSHOT ANALYSIS - MANUAL RUN\n');
  console.log('='.repeat(60));
  
  try {
    // Get all sessions with screenshots but no validation
    const { data: sessions, error } = await supabase
      .from('verification_sessions')
      .select('*')
      .not('screenshot_url', 'is', null)
      .is('screenshot_validation', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error fetching sessions:', error);
      return;
    }

    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions needing screenshot analysis!');
      return;
    }

    console.log(`\n📸 Found ${sessions.length} sessions needing screenshot analysis`);
    console.log('='.repeat(60));
    
    let processed = 0;
    let valid = 0;
    let invalid = 0;
    let errors = 0;

    for (const session of sessions) {
      try {
        processed++;
        console.log(`\n[${processed}/${sessions.length}] Processing: ${session.agent_email}`);
        console.log(`  Session ID: ${session.id}`);
        console.log(`  Method: ${session.verification_method || 'zoom'}`);
        console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
        
        // Download and convert image to base64
        const imageBase64 = await downloadImageAsBase64(session.screenshot_url);
        
        // Validate with AI
        const validation = await validateScreenshotWithAI(
          imageBase64,
          session.verification_method || 'zoom'
        );

        // Update database
        await supabase
          .from('verification_sessions')
          .update({ screenshot_validation: validation })
          .eq('id', session.id);

        if (validation.isValid) {
          valid++;
          console.log(`  ✅ VALID (confidence: ${(validation.confidence * 100).toFixed(0)}%)`);
        } else {
          invalid++;
          console.log(`  ❌ INVALID (confidence: ${(validation.confidence * 100).toFixed(0)}%)`);
          console.log(`  Reason: ${validation.reason}`);
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        errors++;
        console.error(`  ❌ Error: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 ANALYSIS SUMMARY:');
    console.log(`  Processed: ${processed}`);
    console.log(`  ✅ Valid: ${valid}`);
    console.log(`  ❌ Invalid: ${invalid}`);
    console.log(`  ⚠️  Errors: ${errors}`);
    console.log('\n✅ Analysis complete!\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the analysis
analyzeVerificationScreenshots()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

