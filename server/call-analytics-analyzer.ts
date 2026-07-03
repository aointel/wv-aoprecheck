/**
 * Call Analytics Analyzer
 * Uses OpenAI Whisper API to transcribe and GPT to analyze Taalk transfer calls
 * Implements Chorus/Gong-style call scoring and evaluation
 */

import { File } from 'node:buffer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { supabaseAdmin } from './supabase';
import {
  getDispositionFromCallOutcome,
  buildDispositionPromptSection,
  applyDispositionRules,
  INSTANT_PRESENTATION_MIN_DURATION_SEC as MODEL_INSTANT_PRES_MIN,
} from './call-analytics-disposition-model.js';

// Polyfill global File for OpenAI Whisper file uploads on Node < 20
if (typeof globalThis.File === 'undefined') {
  (globalThis as any).File = File;
}

/** Parse Supabase storage URL to bucket + object path (for admin download). */
function parseSupabaseStorageUrl(url: string): { bucket: string; object: string } | null {
  const trimmed = url.trim();
  if (!trimmed || !trimmed.includes('supabase')) return null;
  try {
    const u = new URL(trimmed);
    const segments = u.pathname.split('/').filter(Boolean);
    const objectIndex = segments.indexOf('object');
    if (objectIndex === -1 || objectIndex + 1 >= segments.length) return null;
    let idx = objectIndex + 1;
    if (['sign', 'public', 'render'].includes(segments[idx])) idx += 1;
    if (idx >= segments.length) return null;
    const bucket = segments[idx];
    const object = segments.slice(idx + 1).join('/');
    return bucket && object ? { bucket, object: decodeURIComponent(object) } : null;
  } catch {
    return null;
  }
}

// DISABLED - OpenAI not used for call analytics (was: hardcoded-config)
const openAIClient: OpenAI | null = null;

export interface CallScorecard {
  disclosure: { score: number; notes: string; passed: boolean };
  agendaBuyIn: { score: number; notes: string; passed: boolean };
  objectionHandling: { score: number; notes: string; objections: string[]; passed: boolean };
  needsAssessment: { score: number; notes: string; passed: boolean };
  nextSteps: { score: number; notes: string; clarity: 'CLEAR' | 'UNCLEAR' | 'NONE'; passed: boolean };
  closingAbility: { score: number; notes: string; passed: boolean };
  overallScore: number;
}

export interface CallAnalysis {
  transcript: string;
  summary: string;
  scorecard: CallScorecard;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentimentScore: number; // -1.0 to 1.0
  agentTalkTimePct: number; // Percentage of call agent talked
  clientEngagementLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  callOutcome: 'SOLD' | 'BOOKED' | 'CALLBACK' | 'THINK' | 'NO_SHOW' | 'OBJECTION' | 'OTHER';
  callOutcomeConfidence: number; // 0.0 to 1.0
  /** CCPRO disposition - matches Call Connector Pro disposition values (booked, sale, call_back, etc.) */
  outcome: string;
  keyTopics: string[];
  objectionsDetected: string[];
  coachingNotes: string[];
  keyMoments: Array<{ timestamp: string; description: string }>;
  complianceFlags: {
    disclosureRecorded: boolean;
    properIntroduction: boolean;
    needsAssessed: boolean;
    objectionsAddressed: boolean;
    nextStepsSet: boolean;
    professionalTone: boolean;
  };
  analyzedAt: string;
}

/** Whisper API limit: 25MB. Use 24MB to leave margin. */
const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

/** Errors that warrant a retry (transient) */
function isRetryableError(e: unknown): boolean {
  const msg = String((e as any)?.message ?? e).toLowerCase();
  const code = (e as any)?.code;
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ENETUNREACH') return true;
  if (msg.includes('429') || msg.includes('rate limit')) return true;
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('timeout')) return true;
  if (msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('fetch failed')) return true;
  return false;
}

/** Spanish language indicators - when present, call is in Spanish; do NOT classify as call_back */
const SPANISH_INDICATOR_PATTERNS = [
  /\bspanish\b/i,
  /\bespa[ñn]ol\b/i,
  /\bspeak\s+(a\s+da\s+)?spanish\b/i,
  /\bhabla\s+espa[ñn]ol\b/i,
  /\bspeak\s+espa[ñn]ol\b/i,
  /\bspanish\s+(speak|speaker|agent|line)\b/i,
  /\bnecesito\s+espa[ñn]ol\b/i,
];

function transcriptIndicatesSpanish(transcript: string): boolean {
  if (!transcript || typeof transcript !== 'string') return false;
  const t = transcript.toLowerCase().trim();
  return SPANISH_INDICATOR_PATTERNS.some((p) => p.test(t));
}

/** Re-export for scheduler; rules live in disposition model. */
export const INSTANT_PRESENTATION_MIN_DURATION_SEC = MODEL_INSTANT_PRES_MIN;

/** Apply disposition rules (duration, etc.). Uses call-analytics-disposition-model. */
export function applyInstantPresentationDurationRule(outcome: string, callDurationSec: number | null | undefined): string {
  return applyDispositionRules(outcome, callDurationSec);
}

class CallAnalyticsAnalyzer {
  
  /**
   * Download audio file from URL (with Taalk API authentication).
   * For Supabase URLs, uses admin storage download so private buckets and expired signed URLs still work.
   */
  private async downloadAudio(url: string, apiKey?: string): Promise<Buffer> {
    try {
      console.log(`📥 Downloading audio from: ${url.substring(0, 100)}...`);

      // Prefer Supabase admin download when URL is Supabase storage (avoids expired signed URL / private bucket 403)
      const ref = parseSupabaseStorageUrl(url);
      if (ref && supabaseAdmin) {
        try {
          const { data, error } = await supabaseAdmin.storage.from(ref.bucket).download(ref.object);
          if (!error && data) {
            const arrayBuffer = data instanceof ArrayBuffer ? data : await (data as Blob).arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            console.log(`✅ Downloaded audio (Supabase): ${(buffer.length / 1024).toFixed(2)} KB`);
            if (buffer.length > WHISPER_MAX_BYTES) {
              const mb = (buffer.length / 1024 / 1024).toFixed(1);
              throw new Error(`Audio file too large (${mb} MB). Whisper limit is 25 MB. Call may be too long to transcribe.`);
            }
            return buffer;
          }
          if (error) console.warn(`⚠️ Supabase storage download failed, falling back to fetch:`, error.message);
        } catch (supabaseErr: any) {
          console.warn(`⚠️ Supabase storage download error, falling back to fetch:`, supabaseErr?.message);
        }
      }

      const headers: Record<string, string> = {
        'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
      };
      if (apiKey && (url.includes('taalk') || url.includes('api.taalk'))) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, { headers, method: 'GET' });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`❌ Download failed: ${response.status} ${response.statusText}`);
        console.error(`   Error details: ${errorText.substring(0, 500)}`);
        throw new Error(`Failed to download audio: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`✅ Downloaded audio: ${(buffer.length / 1024).toFixed(2)} KB (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      if (buffer.length > WHISPER_MAX_BYTES) {
        const mb = (buffer.length / 1024 / 1024).toFixed(1);
        throw new Error(`Audio file too large (${mb} MB). Whisper limit is 25 MB. Call may be too long to transcribe.`);
      }
      return buffer;
    } catch (error: any) {
      console.error(`❌ Error downloading audio: ${error.message}`);
      console.error(`   URL: ${url.substring(0, 100)}...`);
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }
  
  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(audioData: Buffer, filename: string = 'audio.mp3'): Promise<string> {
    if (!openAIClient) {
      throw new Error('OpenAI disabled for call analytics - transcription unavailable');
    }
    try {
      console.log('🎤 Transcribing call audio with Whisper API...');
      
      // Create a temporary file for the audio
      const tempFilePath = path.join(os.tmpdir(), `temp-${Date.now()}-${filename}`);
      fs.writeFileSync(tempFilePath, audioData);
      
      try {
        const transcription = await openAIClient.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          response_format: 'verbose_json'
        });
        
        console.log('✅ Audio transcribed successfully');
        
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        
        return transcription.text;
      } catch (transcriptionError) {
        // Clean up temp file on error
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw transcriptionError;
      }
      
    } catch (error: any) {
      console.error('❌ Transcription error:', error.message);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }
  
  /**
   * Analyze sales call transcript using GPT with Chorus/Gong-style scorecard
   */
  async analyzeTranscript(transcript: string): Promise<Omit<CallAnalysis, 'transcript' | 'analyzedAt'>> {
    if (!openAIClient) {
      throw new Error('OpenAI disabled for call analytics - analysis unavailable');
    }
    try {
      console.log('🤖 Analyzing call transcript with GPT (Chorus/Gong-style scoring)...');
      
      const prompt = `You are analyzing a transcript from a sales call (insurance sales). Evaluate this call using a Chorus/Gong-style scorecard.

**CRITICAL - LANGUAGE:** The transcript may be in ENGLISH or SPANISH. Many calls are in Spanish. You MUST analyze Spanish content the same as English. Do NOT default to NO_SHOW or score 0 just because the transcript is in Spanish. If there is dialogue between agent and prospect (in any language), score it normally and use the appropriate outcome (BOOKED, CALLBACK, SOLD, etc.).

**CRITICAL - SPANISH CALLS:** If the transcript mentions "spanish", "español", "espanol", "speak spanish", "habla español", etc.—the client doesn't speak English and needs a Spanish speaker (we don't have any). These calls are usually under 2 minutes. Use OTHER for such calls—they get resolved as "spanish" disposition. Do NOT use CALLBACK.

**CRITICAL - VOICEMAIL vs REAL CALL:**
- **NO_SHOW** (→ no_answer_vm): Use when the prospect did NOT actually talk. This includes: (1) Voicemail—you hear the message machine/beep, agent leaves a message, no human responses; (2) "Number not in service" or disconnected; (3) Literal no-answer/ring-out. Clues: "leave a message", "after the beep", "not available", one-sided (only agent speaking, no prospect replies), automated greeting.
- **Real conversation**: Use BOOKED, CALLBACK, SOLD, THINK, OBJECTION, or OTHER when there is back-and-forth dialogue between agent and prospect. The prospect must have spoken and participated.
- If it's clearly a voicemail (message machine, beep, agent leaving message, no human on line)—use NO_SHOW and set all scorecard scores to 0 (overallScore 0). If the prospect spoke and had a real exchange—use the appropriate outcome and score normally.

**SCORECARD CRITERIA (Score each 0-100):**

1. **Disclosure** - Did the agent disclose that the call is being recorded? (Required for compliance)
   - 100: Clear disclosure at start of call
   - 50: Mentioned but unclear or late
   - 0: No disclosure

2. **Agenda Buy-In** - Did the agent set a clear agenda and get client buy-in?
   - 100: Clear agenda stated, client acknowledged
   - 50: Agenda mentioned but unclear
   - 0: No agenda set

3. **Objection Handling** - How well did the agent handle objections?
   - 100: Objections addressed thoroughly with empathy
   - 50: Objections acknowledged but not fully addressed
   - 0: Objections ignored or handled poorly
   - List all objections mentioned

4. **Needs Assessment** - Did the agent ask open-ended questions to understand client needs?
   - 100: Multiple open-ended questions, deep understanding shown
   - 50: Some questions asked but surface-level
   - 0: No needs assessment, went straight to pitch

5. **Next Steps** - Were clear next steps established?
   - 100: Clear, specific next steps with timeline
   - 50: Next steps mentioned but vague
   - 0: No next steps discussed
   - Clarity: CLEAR, UNCLEAR, or NONE

6. **Closing Ability** - Did the agent attempt to close appropriately?
   - 100: Multiple closing attempts, handled gracefully
   - 50: One closing attempt
   - 0: No closing attempt

**ADDITIONAL ANALYSIS:**

- **Sentiment**: Overall sentiment (POSITIVE, NEUTRAL, NEGATIVE) and score (-1.0 to 1.0)
- **Agent Talk Time**: Estimate percentage of call agent talked (0-100)
- **Client Engagement**: HIGH, MEDIUM, or LOW based on participation
- **Call Outcome**: SOLD, BOOKED, CALLBACK, THINK, NO_SHOW, OBJECTION, or OTHER (see disposition rules below)
- **Key Topics**: List 3-5 main topics discussed
- **Objections Detected**: List all objections mentioned
- **Coaching Notes**: 3-5 specific coaching points for improvement
- **Key Moments**: 5-7 key moments with approximate timestamps
- **Compliance Flags**: Check each compliance item (true/false)

**TRANSCRIPT (may be English or Spanish):**
${transcript}

**RESPONSE FORMAT (MUST BE VALID JSON IN ENGLISH):**
{
  "summary": "Brief 2-3 sentence summary of the call",
  "scorecard": {
    "disclosure": { "score": 85, "notes": "...", "passed": true },
    "agendaBuyIn": { "score": 90, "notes": "...", "passed": true },
    "objectionHandling": { "score": 75, "notes": "...", "objections": ["price", "timing"], "passed": true },
    "needsAssessment": { "score": 80, "notes": "...", "passed": true },
    "nextSteps": { "score": 88, "notes": "...", "clarity": "CLEAR", "passed": true },
    "closingAbility": { "score": 70, "notes": "...", "passed": true },
    "overallScore": 81.33
  },
  "sentiment": "POSITIVE",
  "sentimentScore": 0.7,
  "agentTalkTimePct": 45,
  "clientEngagementLevel": "HIGH",
  "callOutcome": "BOOKED",
  "callOutcomeConfidence": 0.85,
  "keyTopics": ["insurance coverage", "premium", "beneficiary"],
  "objectionsDetected": ["price concern", "timing"],
  "coachingNotes": ["Could improve objection handling", "Great needs assessment"],
  "keyMoments": [
    {"timestamp": "0:15", "description": "Agent introduces themselves and discloses recording"},
    {"timestamp": "1:30", "description": "Client asks about pricing"}
  ],
  "complianceFlags": {
    "disclosureRecorded": true,
    "properIntroduction": true,
    "needsAssessed": true,
    "objectionsAddressed": true,
    "nextStepsSet": true,
    "professionalTone": true
  }
}

${buildDispositionPromptSection()}`;

      const response = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing sales calls. You accurately distinguish: (1) Voicemails = NO_SHOW—message machine, beep, agent leaving message, no human prospect on line. (2) Real calls = BOOKED/CALLBACK/SOLD/etc—prospect spoke and had dialogue. Do not confuse voicemails with real calls. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });

      const aiResponse = response.choices[0]?.message?.content || '{}';
      console.log('🤖 AI Analysis Response:', aiResponse.substring(0, 500) + '...');
      
      // Parse JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Calculate overall score from individual scores
      const scores = [
        analysis.scorecard?.disclosure?.score || 0,
        analysis.scorecard?.agendaBuyIn?.score || 0,
        analysis.scorecard?.objectionHandling?.score || 0,
        analysis.scorecard?.needsAssessment?.score || 0,
        analysis.scorecard?.nextSteps?.score || 0,
        analysis.scorecard?.closingAbility?.score || 0
      ];
      const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      // Ensure overallScore is set
      if (!analysis.scorecard?.overallScore) {
        analysis.scorecard = analysis.scorecard || {};
        analysis.scorecard.overallScore = overallScore;
      }
      
      let callOutcome = analysis.callOutcome || 'OTHER';
      let outcome = getDispositionFromCallOutcome(callOutcome);
      // Spanish: client mentions spanish = doesn't speak English, no Spanish speakers, resolve as spanish (usually <2 min)
      if (transcriptIndicatesSpanish(transcript)) {
        console.log('🔄 Spanish detected in transcript → disposition: spanish');
        outcome = 'spanish';
        callOutcome = 'OTHER';
      }
      console.log('✅ Transcript analyzed successfully');
      console.log(`   Overall Score: ${overallScore.toFixed(1)}/100`);
      console.log(`   Outcome: ${callOutcome}`);
      
      return {
        summary: analysis.summary || 'No summary available',
        scorecard: analysis.scorecard || {
          disclosure: { score: 0, notes: 'Analysis incomplete', passed: false },
          agendaBuyIn: { score: 0, notes: 'Analysis incomplete', passed: false },
          objectionHandling: { score: 0, notes: 'Analysis incomplete', objections: [], passed: false },
          needsAssessment: { score: 0, notes: 'Analysis incomplete', passed: false },
          nextSteps: { score: 0, notes: 'Analysis incomplete', clarity: 'NONE', passed: false },
          closingAbility: { score: 0, notes: 'Analysis incomplete', passed: false },
          overallScore: 0
        },
        sentiment: analysis.sentiment || 'NEUTRAL',
        sentimentScore: analysis.sentimentScore || 0,
        agentTalkTimePct: analysis.agentTalkTimePct || 50,
        clientEngagementLevel: analysis.clientEngagementLevel || 'MEDIUM',
        callOutcome,
        callOutcomeConfidence: analysis.callOutcomeConfidence || 0.5,
        outcome,
        keyTopics: analysis.keyTopics || [],
        objectionsDetected: analysis.objectionsDetected || [],
        coachingNotes: analysis.coachingNotes || [],
        keyMoments: analysis.keyMoments || [],
        complianceFlags: analysis.complianceFlags || {
          disclosureRecorded: false,
          properIntroduction: false,
          needsAssessed: false,
          objectionsAddressed: false,
          nextStepsSet: false,
          professionalTone: false
        }
      };
      
    } catch (error: any) {
      console.error('❌ Analysis error:', error.message);
      throw new Error(`Failed to analyze transcript: ${error.message}`);
    }
  }
  
  /**
   * Full analysis: download, transcribe, and analyze audio
   * Retries up to 3 times on transient errors (network, 429, 5xx).
   * Fails fast on permanent errors (e.g. file > 25MB).
   */
  async analyzeAudioFromUrl(audioUrl: string, apiKey?: string): Promise<CallAnalysis> {
    const maxAttempts = 3;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🎙️  Starting call analytics analysis (attempt ${attempt}/${maxAttempts})`);
        console.log(`📥 Audio URL: ${audioUrl.substring(0, 100)}...`);

        // Download audio with authentication if needed
        const audioBuffer = await this.downloadAudio(audioUrl, apiKey);

        // Transcribe audio
        const transcript = await this.transcribeAudio(audioBuffer, 'recording.mp3');

        // Rate limiting: Wait 2 seconds between Whisper and GPT API calls to prevent hammering OpenAI
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Analyze transcript
        const analysis = await this.analyzeTranscript(transcript);

        // Combine results
        const fullAnalysis: CallAnalysis = {
          transcript,
          ...analysis,
          analyzedAt: new Date().toISOString()
        };

        console.log('✅ Call analysis complete!');
        console.log(`   Score: ${fullAnalysis.scorecard.overallScore.toFixed(1)}/100`);
        console.log(`   Outcome: ${fullAnalysis.callOutcome}`);
        console.log(`   Sentiment: ${fullAnalysis.sentiment} (${fullAnalysis.sentimentScore.toFixed(2)})`);

        return fullAnalysis;
      } catch (error: any) {
        lastError = error;
        const isPermanent = !isRetryableError(error);
        if (isPermanent || attempt === maxAttempts) {
          console.error(`❌ Call analysis failed${attempt > 1 ? ` after ${attempt} attempts` : ''}:`, error?.message);
          throw error;
        }
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.warn(`⚠️ Transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`, error?.message);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw lastError;
  }
  
  /**
   * Analyze transcript directly (if transcript already available)
   */
  async analyzeTranscriptOnly(transcript: string): Promise<CallAnalysis> {
    try {
      console.log('🎙️  Starting call analytics analysis from transcript');
      
      // Analyze transcript
      const analysis = await this.analyzeTranscript(transcript);
      
      // Combine results
      const fullAnalysis: CallAnalysis = {
        transcript,
        ...analysis,
        analyzedAt: new Date().toISOString()
      };
      
      console.log('✅ Call analysis complete!');
      
      return fullAnalysis;
      
    } catch (error: any) {
      console.error('❌ Call analysis failed:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const callAnalyticsAnalyzer = new CallAnalyticsAnalyzer();
