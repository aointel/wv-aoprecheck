/**
 * Verification Screenshot Validator
 * Uses OpenAI Vision API to validate that submitted screenshots show:
 * - For ZOOM track: Agent + Client visible in Zoom gallery or meeting
 * - For PHONE track: Video call screenshot (FaceTime, WhatsApp, Zoom, etc.)
 */

import OpenAI from 'openai';
import { OPENAI_API_KEY } from './hardcoded-config.js';

// SCREENSHOT VALIDATION ONLY - Uses dedicated OpenAI API key from hardcoded-config
const openAIClient = new OpenAI({ 
  apiKey: OPENAI_API_KEY
});

export interface VerificationScreenshotAnalysis {
  isValid: boolean;
  confidence: number; // 0-1
  validationType: 'zoom_meeting' | 'video_call' | 'invalid' | 'unclear';
  
  // Details about what was detected
  detectedElements: {
    hasMultiplePeople: boolean;
    hasVideoCallInterface: boolean;
    hasZoomUI: boolean;
    hasFaceTimeUI: boolean;
    hasWhatsAppUI: boolean;
    hasOtherVideoCallUI: boolean;
    peopleCount: number;
  };
  
  // Explanation of why it's valid or invalid
  reason: string;
  
  // Specific issues if invalid
  issues: string[];
}

class VerificationScreenshotValidator {
  
  /**
   * Validate a verification screenshot using AI vision with retry logic for rate limits
   */
  async validateScreenshot(
    screenshotBase64: string, 
    verificationMethod: 'zoom' | 'phone' | 'conference'
  ): Promise<VerificationScreenshotAnalysis> {
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 2000; // 2 seconds
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.log(`🤖 Validating ${verificationMethod} verification screenshot with AI...`);
        
        const prompt = this.buildPrompt(verificationMethod);
        
        // Ensure proper base64 format
        const base64Data = screenshotBase64.includes('base64,') 
          ? screenshotBase64.split('base64,')[1] 
          : screenshotBase64;
        
        const response = await openAIClient.chat.completions.create({
          model: 'gpt-4o-mini', // Using mini for cost-effectiveness, can upgrade to gpt-4o if needed
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
                    url: `data:image/png;base64,${base64Data}`,
                    detail: 'high' // Use high detail for better accuracy
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1 // Low temperature for consistent validation
        });

        const aiResponse = response.choices[0]?.message?.content || '{}';
        console.log('🤖 AI Raw Response:', aiResponse);
        
        // Parse the AI response
        const analysis = this.parseAIResponse(aiResponse, verificationMethod);
        const issues: string[] = [...analysis.issues];

        const hasVideoInterface =
          analysis.detectedElements.hasVideoCallInterface ||
          analysis.detectedElements.hasZoomUI ||
          analysis.detectedElements.hasFaceTimeUI ||
          analysis.detectedElements.hasWhatsAppUI ||
          analysis.detectedElements.hasOtherVideoCallUI;

        const hasTwoParticipants =
          analysis.detectedElements.hasMultiplePeople ||
          analysis.detectedElements.peopleCount >= 2;

        // LENIENT VALIDATION: As long as it shows 2 people and looks like a video call, it's valid
        // If we have 2+ people and it appears to be a video call context, accept it
        if (hasTwoParticipants && (hasVideoInterface || analysis.validationType === 'video_call' || analysis.validationType === 'zoom_meeting')) {
          // Valid - has 2 people and video call context
          // Clear any issues that might have been flagged
          if (analysis.isValid) {
            // Keep it valid, just ensure confidence is reasonable
            if (analysis.confidence < 0.6) {
              analysis.confidence = 0.7; // Boost confidence if it has the key requirements
            }
          } else {
            // Override invalid status if it has 2 people and video call context
            analysis.isValid = true;
            analysis.issues = [];
            analysis.reason = 'Valid screenshot showing 2+ people in a video call (Zoom, FaceTime, etc.)';
            analysis.confidence = Math.max(analysis.confidence, 0.7);
          }
        } else {
          // Only flag as invalid if missing key requirements
          if (!hasTwoParticipants) {
            issues.push(
              'Screenshot must display at least two participants (agent and client) on the call.'
            );
          }
          
          // Only require video interface if we don't have 2 people (to catch edge cases)
          // But if we have 2 people, be more lenient about video interface detection
          if (!hasTwoParticipants && !hasVideoInterface) {
            issues.push(
              'Screenshot must show a video call interface (Zoom, FaceTime, WhatsApp, Google Meet, etc.) or clearly show 2+ people in a video call context.'
            );
          }

          if (issues.length > 0) {
            analysis.isValid = false;
            analysis.issues = issues;
            analysis.reason = issues.join(' ');
            analysis.confidence = Math.min(analysis.confidence, 0.4);
          }
        }
        
        console.log(`✅ Validation complete: ${analysis.isValid ? 'VALID' : 'INVALID'} (${analysis.confidence})`);
        console.log(`   Type: ${analysis.validationType}`);
        console.log(`   Reason: ${analysis.reason}`);
        
        return analysis;
        
      } catch (error: any) {
        // Check for API key errors (401)
        const isApiKeyError = error.status === 401 || 
                             error.statusCode === 401 ||
                             error.message?.includes('401') ||
                             error.message?.toLowerCase().includes('incorrect api key') ||
                             error.message?.toLowerCase().includes('invalid api key') ||
                             error.message?.toLowerCase().includes('authentication');
        
        if (isApiKeyError) {
          console.error(`❌❌❌ OPENAI API KEY ERROR:`, error.message);
          console.error(`   Status: ${error.status || error.statusCode}`);
          console.error(`   API Key (first 20 chars): ${OPENAI_API_KEY?.substring(0, 20)}...`);
          console.error(`   API Key (last 10 chars): ...${OPENAI_API_KEY?.substring(OPENAI_API_KEY.length - 10)}`);
          console.error(`   Full error:`, error);
          
          return {
            isValid: false,
            confidence: 0,
            validationType: 'unclear',
            detectedElements: {
              hasMultiplePeople: false,
              hasVideoCallInterface: false,
              hasZoomUI: false,
              hasFaceTimeUI: false,
              hasWhatsAppUI: false,
              hasOtherVideoCallUI: false,
              peopleCount: 0
            },
            reason: `OpenAI API key is invalid or expired. Please update the API key in hardcoded-config.ts. Error: ${error.message || '401 Unauthorized'}`,
            issues: [`Unable to validate screenshot due to API key error: ${error.message || '401 Unauthorized'}`]
          };
        }
        
        const isRateLimit = error.status === 429 || 
                           error.message?.includes('429') || 
                           error.message?.toLowerCase().includes('rate limit') ||
                           error.message?.toLowerCase().includes('quota') ||
                           error.message?.toLowerCase().includes('exceeded');
        
        if (isRateLimit && attempt < MAX_RETRIES) {
          // Will retry with exponential backoff
          continue;
        }
        
        // If it's a rate limit but we've exhausted retries, or it's a different error
        if (isRateLimit) {
          console.error(`❌ Rate limit error after ${MAX_RETRIES + 1} attempts:`, error.message);
          return {
            isValid: false,
            confidence: 0,
            validationType: 'unclear',
            detectedElements: {
              hasMultiplePeople: false,
              hasVideoCallInterface: false,
              hasZoomUI: false,
              hasFaceTimeUI: false,
              hasWhatsAppUI: false,
              hasOtherVideoCallUI: false,
              peopleCount: 0
            },
            reason: `Rate limit exceeded. Please try again later. If this persists, check your OpenAI API quota.`,
            issues: ['Rate limit error - analysis will be retried automatically']
          };
        }
        
        // For non-rate-limit errors, return immediately
        console.error('❌ AI validation error:', error.message);
        return {
          isValid: false,
          confidence: 0,
          validationType: 'unclear',
          detectedElements: {
            hasMultiplePeople: false,
            hasVideoCallInterface: false,
            hasZoomUI: false,
            hasFaceTimeUI: false,
            hasWhatsAppUI: false,
            hasOtherVideoCallUI: false,
            peopleCount: 0
          },
          reason: `AI validation failed: ${error.message}`,
          issues: ['Unable to validate screenshot due to technical error']
        };
      }
    }
    
    // Should never reach here, but TypeScript needs it
    return {
      isValid: false,
      confidence: 0,
      validationType: 'unclear',
      detectedElements: {
        hasMultiplePeople: false,
        hasVideoCallInterface: false,
        hasZoomUI: false,
        hasFaceTimeUI: false,
        hasWhatsAppUI: false,
        hasOtherVideoCallUI: false,
        peopleCount: 0
      },
      reason: 'Unexpected error during validation',
      issues: ['Technical error']
    };
  }
  
  /**
   * Build the validation prompt based on verification method
   */
  private buildPrompt(verificationMethod: 'zoom' | 'phone' | 'conference'): string {
    const basePrompt = `You are analyzing a verification screenshot submitted by an insurance agent.

Your task is to determine if this screenshot is VALID or INVALID based on these requirements:`;

    const zoomPrompt = `

**REQUIREMENTS FOR ZOOM VERIFICATION:**
- Must show AT LEAST 2 people visible in the video (the agent AND the client)
- Should show a video call interface (Zoom, FaceTime, or similar video call app)
- As long as it shows 2 people and looks like a video call (Zoom, FaceTime, etc.), it's valid
- **IMPORTANT:** It's normal for one person to appear larger than the other (speaker view, gallery view, etc.)
- **IMPORTANT:** You don't need to identify which person is the agent vs client - just count that there are 2+ people
- **IMPORTANT:** Size differences are normal - one person may be in a large main view while the other is in a smaller thumbnail
- Valid examples: Zoom gallery view, Zoom meeting with multiple people (one large, one small), FaceTime with 2 people, any video call showing 2+ participants

**INVALID submissions include:**
- Random screenshots or photos (not a video call)
- Screenshots showing only 1 person
- Screenshots that are clearly not from a video call context

**ACCEPTABLE:**
- Slightly blurry participants are OK - as long as you can identify that there are 2+ people, it's valid
- Minor blurriness or image quality issues are acceptable - only reject if you truly cannot identify if there are 2 people`;

    const phonePrompt = `

**REQUIREMENTS FOR PHONE/VIDEO CALL VERIFICATION:**
- Must show AT LEAST 2 people visible (the agent AND the client)
- Should show a video call interface (FaceTime, WhatsApp Video, Zoom, Google Meet, etc.)
- As long as it shows 2 people and looks like a video call, it's valid
- **IMPORTANT:** It's normal for one person to appear larger than the other (speaker view, main participant view, etc.)
- **IMPORTANT:** You don't need to identify which person is the agent vs client - just count that there are 2+ people
- **IMPORTANT:** Size differences are normal - one person may be in a large main view while the other is in a smaller thumbnail or corner
- Valid examples: FaceTime call screen with 2 people (one large, one small), WhatsApp video call with 2 people, Zoom mobile call, any video call showing 2+ participants

**INVALID submissions include:**
- Random screenshots or photos (not a video call)
- Regular phone calls (voice only, no video, no people visible)
- Screenshots showing only 1 person
- Screenshots that are clearly not from a video call context
- Blurry or unclear images where you cannot identify if there are 2 people`;

    const requirements = verificationMethod === 'zoom' ? zoomPrompt : phonePrompt;

    return `${basePrompt}${requirements}

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

**IMPORTANT:** 
- Be lenient in validation - if it shows 2 people and looks like a video call (Zoom, FaceTime, etc.), mark as valid
- Primary requirement: 2+ people visible in what appears to be a video call context
- **CRITICAL:** Size differences between people are NORMAL and EXPECTED - one person may be large (main view) and the other small (thumbnail/corner)
- **CRITICAL:** You only need to COUNT people, not identify who is who - if you see 2+ faces/people, that's valid
- **CRITICAL:** Don't get confused by size differences - a small person in the corner still counts as a person
- **CRITICAL:** Slightly blurry participants are ACCEPTABLE - as long as you can identify that there are 2+ people, mark as valid
- **CRITICAL:** Minor blurriness or image quality issues should NOT cause rejection - only reject if you truly cannot identify if there are 2 people
- If the screenshot shows 2 people and appears to be from a video call app, mark as valid even if UI elements aren't perfectly clear
- If you're unsure (very blurry, completely unclear), set confidence < 0.7 and explain in reason
- Only mark as invalid if it's obviously wrong (random photo, only 1 person, clearly not a video call, completely unidentifiable) with confidence > 0.8`;
  }
  
  /**
   * Parse the AI response into structured data
   */
  private parseAIResponse(
    aiResponse: string, 
    verificationMethod: 'zoom' | 'phone' | 'conference'
  ): VerificationScreenshotAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and return the parsed response
      return {
        isValid: parsed.isValid === true,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        validationType: parsed.validationType || 'unclear',
        detectedElements: {
          hasMultiplePeople: parsed.detectedElements?.hasMultiplePeople === true,
          hasVideoCallInterface: parsed.detectedElements?.hasVideoCallInterface === true,
          hasZoomUI: parsed.detectedElements?.hasZoomUI === true,
          hasFaceTimeUI: parsed.detectedElements?.hasFaceTimeUI === true,
          hasWhatsAppUI: parsed.detectedElements?.hasWhatsAppUI === true,
          hasOtherVideoCallUI: parsed.detectedElements?.hasOtherVideoCallUI === true,
          peopleCount: typeof parsed.detectedElements?.peopleCount === 'number' 
            ? parsed.detectedElements.peopleCount 
            : 0
        },
        reason: parsed.reason || 'No reason provided',
        issues: Array.isArray(parsed.issues) ? parsed.issues : []
      };
      
    } catch (error: any) {
      console.error('❌ Failed to parse AI response:', error.message);
      console.log('Raw AI response:', aiResponse);
      
      // Return a conservative default
      return {
        isValid: false,
        confidence: 0,
        validationType: 'unclear',
        detectedElements: {
          hasMultiplePeople: false,
          hasVideoCallInterface: false,
          hasZoomUI: false,
          hasFaceTimeUI: false,
          hasWhatsAppUI: false,
          hasOtherVideoCallUI: false,
          peopleCount: 0
        },
        reason: 'Failed to parse AI validation response',
        issues: ['Technical error during validation']
      };
    }
  }
  
  /**
   * Batch validate multiple screenshots
   */
  async validateMultipleScreenshots(
    screenshots: Array<{ data: string, filename?: string }>,
    verificationMethod: 'zoom' | 'phone' | 'conference'
  ): Promise<{
    overallValid: boolean;
    validCount: number;
    invalidCount: number;
    analyses: VerificationScreenshotAnalysis[];
  }> {
    console.log(`📸 Validating ${screenshots.length} screenshots...`);
    
    const analyses: VerificationScreenshotAnalysis[] = [];
    
    for (let i = 0; i < screenshots.length; i++) {
      console.log(`\n📸 Validating screenshot ${i + 1}/${screenshots.length}${screenshots[i].filename ? ': ' + screenshots[i].filename : ''}...`);
      
      const analysis = await this.validateScreenshot(screenshots[i].data, verificationMethod);
      analyses.push(analysis);
      
      // Rate limiting: Wait 2 seconds between API calls to prevent hitting OpenAI rate limits
      // This prevents 429 errors when processing multiple screenshots
      if (i < screenshots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const validCount = analyses.filter(a => a.isValid).length;
    const invalidCount = analyses.filter(a => !a.isValid).length;
    
    // Consider overall valid if at least one screenshot is valid with high confidence
    const overallValid = analyses.some(a => a.isValid && a.confidence >= 0.7);
    
    console.log(`\n✅ Batch validation complete: ${validCount} valid, ${invalidCount} invalid`);
    
    return {
      overallValid,
      validCount,
      invalidCount,
      analyses
    };
  }
}

// Export singleton instance
export const verificationScreenshotValidator = new VerificationScreenshotValidator();

