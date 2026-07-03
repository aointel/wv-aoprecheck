/**
 * Verification Audio Analyzer
 * Uses OpenAI Whisper API to transcribe and GPT to analyze verification call recordings
 */

import { File } from 'node:buffer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { OPENAI_API_KEY } from './hardcoded-config.js';

// Polyfill global File for OpenAI Whisper file uploads on Node < 20
if (typeof globalThis.File === 'undefined') {
  (globalThis as any).File = File;
}

// Audio transcription/analysis - Uses API key from hardcoded-config
const openAIClient = new OpenAI({ 
  apiKey: OPENAI_API_KEY
});

export interface VerificationAudioAnalysis {
  transcript: string;
  summary: string;
  validation: {
    isValid: boolean;
    confidence: number;
    reason: string;
    detectedIssues: string[];
  };
  keyMoments: Array<{
    timestamp: string;
    description: string;
  }>;
  sentiment: string;
  duration?: number;
  confidence?: number;
  isLegitimate?: boolean;
  analyzedAt: string;
}

class VerificationAudioAnalyzer {
  
  /**
   * Download audio file from URL
   */
  private async downloadAudio(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download audio: ${res.statusCode}`));
          return;
        }
        
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
  
  /**
   * Transcribe audio using OpenAI Whisper API
   */
  async transcribeAudio(audioData: Buffer, filename: string = 'audio.mp3'): Promise<string> {
    try {
      console.log('🎤 Transcribing audio with Whisper API...');
      
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
   * Analyze verification call transcript using GPT
   */
  async analyzeTranscript(transcript: string, verificationMethod: 'zoom' | 'phone' | 'conference'): Promise<Omit<VerificationAudioAnalysis, 'transcript' | 'analyzedAt'>> {
    try {
      console.log('🤖 Analyzing transcript with GPT...');
      
      const prompt = `You are analyzing a transcript from an insurance verification call. The agent is verifying a policy with a client.

**IMPORTANT:** This call may be in ENGLISH or SPANISH. Analyze it in whichever language it's in, but respond in English JSON.

**ANALYSIS REQUIREMENTS:**

1. **Validation** - Determine if this is a legitimate verification call:
   - Must include agent introducing themselves (in English or Spanish)
   - Must include client confirmation/participation
   - Must discuss policy details (coverage, premium, beneficiary, etc.)
   - Should NOT be: wrong number, hang-up, voicemail, test call, random conversation

2. **Summary** - Create a brief 2-3 sentence summary of what happened on the call (in English, even if call was in Spanish)

3. **Key Moments** - Identify 3-5 key moments in the conversation with approximate timestamps

4. **Sentiment** - Overall sentiment: Positive, Neutral, or Negative

5. **Issues** - List any problems: incomplete verification, client confusion, technical issues, language barriers, etc.

**TRANSCRIPT (may be English or Spanish):**
${transcript}

**RESPONSE FORMAT (MUST BE VALID JSON IN ENGLISH):**
{
  "summary": "Brief 2-3 sentence summary in English",
  "validation": {
    "isValid": true/false,
    "confidence": 0.0 to 1.0,
    "reason": "Explanation of validation decision in English",
    "detectedIssues": ["array of issues if any, in English"]
  },
  "keyMoments": [
    {"timestamp": "0:15", "description": "Agent introduces themselves (in Spanish/English)"},
    {"timestamp": "1:30", "description": "Client confirms policy details"}
  ],
  "sentiment": "Positive" | "Neutral" | "Negative"
}`;

      const response = await openAIClient.chat.completions.create({
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
      });

      const aiResponse = response.choices[0]?.message?.content || '{}';
      console.log('🤖 AI Analysis Response:', aiResponse);
      
      // Parse JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const analysis = JSON.parse(jsonMatch[0]);
      
      console.log('✅ Transcript analyzed successfully');
      
      return {
        summary: analysis.summary || 'No summary available',
        validation: {
          isValid: analysis.validation?.isValid || false,
          confidence: analysis.validation?.confidence || 0,
          reason: analysis.validation?.reason || 'Unable to validate',
          detectedIssues: analysis.validation?.detectedIssues || []
        },
        keyMoments: analysis.keyMoments || [],
        sentiment: analysis.sentiment || 'Neutral',
        duration: undefined
      };
      
    } catch (error: any) {
      console.error('❌ Analysis error:', error.message);
      throw new Error(`Failed to analyze transcript: ${error.message}`);
    }
  }
  
  /**
   * Full analysis: download, transcribe, and analyze audio
   */
  async analyzeAudioFromUrl(audioUrl: string, verificationMethod: 'zoom' | 'phone' | 'conference' = 'phone'): Promise<VerificationAudioAnalysis> {
    try {
      console.log(`🎙️  Starting audio analysis for ${verificationMethod} verification`);
      console.log(`📥 Audio URL: ${audioUrl.substring(0, 100)}...`);
      
      // Download audio
      console.log('📥 Downloading audio...');
      const audioBuffer = await this.downloadAudio(audioUrl);
      console.log(`✅ Downloaded: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
      
      // Transcribe audio
      const transcript = await this.transcribeAudio(audioBuffer, 'recording.mp3');
      
      // Analyze transcript
      const analysis = await this.analyzeTranscript(transcript, verificationMethod);
      
      // Combine results
      const fullAnalysis: VerificationAudioAnalysis = {
        transcript,
        ...analysis,
        confidence: analysis.validation?.confidence ?? 0,
        isLegitimate: analysis.validation?.isValid ?? false,
        analyzedAt: new Date().toISOString()
      };
      
      console.log('✅ Audio analysis complete!');
      console.log(`   Valid: ${fullAnalysis.validation.isValid ? 'YES' : 'NO'} (${(fullAnalysis.validation.confidence * 100).toFixed(0)}%)`);
      console.log(`   Sentiment: ${fullAnalysis.sentiment}`);
      
      return fullAnalysis;
      
    } catch (error: any) {
      console.error('❌ Audio analysis failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Analyze audio from local file buffer
   */
  async analyzeAudioFromBuffer(audioBuffer: Buffer, verificationMethod: 'zoom' | 'phone' | 'conference' = 'phone'): Promise<VerificationAudioAnalysis> {
    try {
      console.log(`🎙️  Starting audio analysis for ${verificationMethod} verification`);
      
      // Transcribe audio
      const transcript = await this.transcribeAudio(audioBuffer, 'recording.mp3');
      
      // Analyze transcript
      const analysis = await this.analyzeTranscript(transcript, verificationMethod);
      
      // Combine results
      const fullAnalysis: VerificationAudioAnalysis = {
        transcript,
        ...analysis,
        confidence: analysis.validation?.confidence ?? 0,
        isLegitimate: analysis.validation?.isValid ?? false,
        analyzedAt: new Date().toISOString()
      };
      
      console.log('✅ Audio analysis complete!');
      
      return fullAnalysis;
      
    } catch (error: any) {
      console.error('❌ Audio analysis failed:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const verificationAudioAnalyzer = new VerificationAudioAnalyzer();

