/**
 * Audio Transcription Service using OpenAI Whisper API
 * Provides speech-to-text functionality for call recordings
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

/**
 * Download recording from TaalkAI API
 * @param apiUrl The API URL for the recording
 * @param filePath The local file path to save the recording
 * @param taalkUID The unique identifier for the call
 * @returns Promise<boolean> indicating success
 */
async function downloadRecordingFromAPI(apiUrl: string, filePath: string, taalkUID: string): Promise<boolean> {
  try {
    console.log(`Downloading recording from API: ${apiUrl}`);
    
    const apiKey = process.env.TAALK_API_KEY;
    if (!apiKey) {
      console.error('TAALK_API_KEY not configured');
      return false;
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to download recording: ${response.status} ${response.statusText}`);
      return false;
    }
    
    // Ensure the recordings directory exists
    const recordingsDir = path.dirname(filePath);
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }
    
    // Write the audio data to file
    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);
    
    const stats = fs.statSync(filePath);
    console.log(`Successfully downloaded recording for ${taalkUID}: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    
    return true;
  } catch (error) {
    console.error(`Error downloading recording for ${taalkUID}:`, error);
    return false;
  }
}

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
  confidence?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Transcribe an audio file using OpenAI Whisper
 * @param audioFilePath Path to the MP3 file
 * @returns Transcription result with text and metadata
 */
export async function transcribeAudio(audioFilePath: string): Promise<TranscriptionResult | null> {
  try {
    console.log(`Starting transcription for: ${audioFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(audioFilePath)) {
      console.error(`Audio file not found: ${audioFilePath}`);
      return null;
    }
    
    // Get file stats
    const stats = fs.statSync(audioFilePath);
    console.log(`Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    
    // Estimate duration based on file size (rough estimate: 50KB per second)
    const estimatedDuration = stats.size / (1024 * 50);
    console.log(`Estimated duration: ${estimatedDuration.toFixed(1)} seconds`);
    
    // Skip calls under 120 seconds (2 minutes)
    if (estimatedDuration < 120) {
      console.log(`Skipping transcription - call duration (${estimatedDuration.toFixed(1)}s) is under 120 seconds minimum`);
      return {
        text: "[System Messages]: Call duration too short for transcription (under 2 minutes). Likely system messages or incomplete call.",
        duration: estimatedDuration,
        language: 'en',
        confidence: 1.0
      };
    }
    
    // Try multiple transcription approaches to ensure complete audio capture
    let transcription = '';
    let actualDuration = 0;
    let segments: any[] = [];
    
    try {
      // First attempt: Use verbose_json to get actual duration and segments
      const audioReadStream1 = fs.createReadStream(audioFilePath);
      const verboseResult = await openai.audio.transcriptions.create({
        file: audioReadStream1,
        model: 'whisper-1',
        response_format: 'verbose_json',
        temperature: 0.0,
        prompt: "This is a complete call recording. Transcribe ALL audio content from start to finish, including system messages and full conversation between agent and client. Do not stop early or truncate."
      });
      
      transcription = verboseResult.text;
      actualDuration = verboseResult.duration || 0;
      segments = verboseResult.segments || [];
      
      console.log(`Initial transcription: ${transcription.length} chars, duration: ${actualDuration}s, segments: ${segments.length}`);
      
      // Check if transcription seems truncated compared to expected file duration
      const expectedDuration = stats.size / (1024 * 50); // Rough estimate: 50KB per second
      const truncationThreshold = 0.5; // If actual duration is less than 50% of expected, likely truncated
      
      console.log(`Duration check: actual=${actualDuration}s, expected=~${expectedDuration.toFixed(1)}s, threshold=${truncationThreshold}`);
      
      if (actualDuration < expectedDuration * truncationThreshold || transcription.length < 1000) {
        console.log(`Transcription appears truncated, trying multiple alternative approaches...`);
        
        // Try multiple strategies to capture complete audio
        const strategies = [
          {
            name: "High temperature text",
            params: {
              response_format: 'text' as const,
              temperature: 0.8,
              prompt: "This is a complete call recording. Transcribe ALL audio content from beginning to end including the full conversation between participants. Do not stop at system messages - continue through the entire audio file duration."
            }
          },
          {
            name: "No prompt text",
            params: {
              response_format: 'text' as const,
              temperature: 0.2
            }
          },
          {
            name: "Spanish language hint",
            params: {
              response_format: 'text' as const,
              temperature: 0.3,
              language: 'es',
              prompt: "Transcribe toda la grabación de llamada completa incluyendo conversación en español."
            }
          }
        ];
        
        for (const strategy of strategies) {
          try {
            console.log(`Trying strategy: ${strategy.name}`);
            const audioReadStream = fs.createReadStream(audioFilePath);
            const result = await openai.audio.transcriptions.create({
              file: audioReadStream,
              model: 'whisper-1',
              ...strategy.params
            });
            
            if (result.length > transcription.length * 1.2) { // At least 20% more content
              console.log(`Strategy "${strategy.name}" yielded longer transcript: ${result.length} chars vs ${transcription.length} chars`);
              transcription = result;
              actualDuration = expectedDuration; // Use estimated duration
              segments = [];
              break; // Stop trying other strategies
            }
          } catch (error) {
            console.log(`Strategy "${strategy.name}" failed:`, error);
            continue;
          }
        }
      }
      
    } catch (error) {
      console.error('Error in verbose transcription, falling back to text format:', error);
      
      // Fallback to simple text format
      const audioReadStream = fs.createReadStream(audioFilePath);
      transcription = await openai.audio.transcriptions.create({
        file: audioReadStream,
        model: 'whisper-1',
        response_format: 'text',
        temperature: 0.0,
        prompt: "Transcribe all audio content from this call recording including complete conversations."
      });
      
      actualDuration = stats.size / (1024 * 50); // Rough estimate
      segments = [];
    }
    
    console.log(`Final transcription completed for ${path.basename(audioFilePath)}`);
    console.log(`Audio duration: ${actualDuration} seconds`);
    console.log(`Full transcription text length: ${transcription.length} chars`);
    console.log(`Raw transcription text (first 500 chars): ${transcription.substring(0, 500)}`);
    
    // Enhanced Spanish detection - check content analysis
    const hasSpanishContent = detectSpanishContent(transcription);
    const detectedLanguage = hasSpanishContent ? 'es' : 'en';
    
    if (hasSpanishContent) {
      console.log(`Spanish content detected through content analysis`);
    }
    
    // Advanced conversation extraction from system message noise
    const extractedConversation = extractActualConversation(transcription, segments);
    console.log(`Conversation extraction: original=${transcription.length} chars, extracted=${extractedConversation.length} chars`);
    
    // Use extracted conversation if it contains meaningful content
    const finalTranscription = extractedConversation.length > 100 ? extractedConversation : transcription;
    
    // Check for repetitive or low-quality transcriptions after extraction
    const isRepetitive = checkForRepetitiveText(finalTranscription);
    
    let formattedText = finalTranscription;
    
    if (isRepetitive && extractedConversation.length < 200) {
      console.log('Detected repetitive/low-quality audio after conversation extraction...');
      formattedText = `[Audio Analysis Complete]

This call recording contains primarily system messages and background audio.

Audio Duration: ${actualDuration} seconds
Segments Processed: ${segments.length}
Content Analysis: ${transcription.includes('Zoom') ? 'Zoom meeting system' : 'Call system'} messages detected

Raw Content Sample: "${transcription.substring(0, 200)}..."

Note: The recording may contain conversation content at very low volume levels or the participants may not have spoken during this call.`;
    } else if (hasSpanishContent) {
      console.log('Spanish detected, translating to English...');
      formattedText = await translateAndFormatTranscriptFromSpanish(transcription);
    } else {
      // Format English transcript with AOI structure
      formattedText = await formatTranscriptWithAOIStructure(transcription);
    }
    
    return {
      text: formattedText,
      duration: actualDuration,
      language: detectedLanguage
    };
    
  } catch (error) {
    console.error(`Error transcribing audio ${audioFilePath}:`, error);
    
    if (error instanceof Error) {
      // Handle specific OpenAI API errors
      if (error.message.includes('model_not_found')) {
        console.error('Whisper model not available');
      } else if (error.message.includes('invalid_request_error')) {
        console.error('Invalid audio format or file too large');
      } else if (error.message.includes('rate_limit_exceeded')) {
        console.error('OpenAI API rate limit exceeded');
      }
    }
    
    return null;
  }
}

/**
 * Transcribe audio for a specific call and update the database
 * @param taalkUID The unique identifier for the call
 * @param storage The storage interface to update the call record
 * @returns The transcription text or null if failed
 */
export async function transcribeCallRecording(
  taalkUID: string, 
  storage: any
): Promise<string | null> {
  try {
    // Check if transcription already exists
    const call = await storage.getCallByTaalkUID(taalkUID);
    
    if (!call) {
      console.error(`Call not found for taalkUID: ${taalkUID}`);
      return null;
    }
    
    if (call.transcriptionText && call.transcriptionText.length > 10) {
      console.log(`Transcription already exists for ${taalkUID}`);
      return call.transcriptionText;
    }
    
    // Determine the audio file path
    const audioFilePath = path.resolve('public/recordings', `${taalkUID}.mp3`);
    
    // If local file doesn't exist, try to download from recording URL
    if (!fs.existsSync(audioFilePath)) {
      if (call.recordingUrl && call.recordingUrl.includes('api.taalk.ai')) {
        console.log(`Local file not found, downloading recording from API: ${call.recordingUrl}`);
        
        try {
          const downloadSuccess = await downloadRecordingFromAPI(call.recordingUrl, audioFilePath, taalkUID);
          if (!downloadSuccess) {
            console.error(`Failed to download recording for transcription: ${taalkUID}`);
            return null;
          }
        } catch (error) {
          console.error(`Error downloading recording for ${taalkUID}:`, error);
          return null;
        }
      } else {
        console.error(`Audio file not found for transcription: ${audioFilePath}`);
        return null;
      }
    }
    
    // Perform transcription
    const result = await transcribeAudio(audioFilePath);
    
    if (!result || !result.text) {
      console.error(`Failed to transcribe audio for ${taalkUID}`);
      return null;
    }
    
    // Update the call record with the transcription
    await storage.updateCall(call.id, {
      transcriptionText: result.text
    });
    
    console.log(`Successfully transcribed and saved transcription for ${taalkUID}`);
    return result.text;
    
  } catch (error) {
    console.error(`Error in transcribeCallRecording for ${taalkUID}:`, error);
    return null;
  }
}

/**
 * Batch transcribe multiple call recordings
 * @param taalkUIDs Array of call UIDs to transcribe
 * @param storage The storage interface
 * @returns Summary of transcription results
 */
export async function batchTranscribeRecordings(
  taalkUIDs: string[],
  storage: any
): Promise<{
  successful: number;
  failed: number;
  skipped: number;
  results: Array<{ taalkUID: string; success: boolean; text?: string; error?: string }>;
}> {
  const results = [];
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  
  console.log(`Starting batch transcription for ${taalkUIDs.length} recordings`);
  
  for (const taalkUID of taalkUIDs) {
    try {
      // Check if already transcribed
      const call = await storage.getCallByTaalkUID(taalkUID);
      
      if (call?.transcriptionText && call.transcriptionText.length > 10) {
        results.push({ taalkUID, success: true, text: 'Already transcribed' });
        skipped++;
        continue;
      }
      
      const transcriptionText = await transcribeCallRecording(taalkUID, storage);
      
      if (transcriptionText) {
        results.push({ taalkUID, success: true, text: transcriptionText.substring(0, 100) + '...' });
        successful++;
      } else {
        results.push({ taalkUID, success: false, error: 'Transcription failed' });
        failed++;
      }
      
      // Add small delay between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error transcribing ${taalkUID}:`, error);
      results.push({ taalkUID, success: false, error: String(error) });
      failed++;
    }
  }
  
  console.log(`Batch transcription completed: ${successful} successful, ${failed} failed, ${skipped} skipped`);
  
  return {
    successful,
    failed,
    skipped,
    results
  };
}

/**
 * Remove Zoom connection messages from transcription text
 * @param text The raw transcription text
 * @returns Cleaned text with Zoom messages removed
 */
function removeZoomMessages(text: string): string {
  const zoomPhrases = [
    'Welcome to Zoom',
    'Enter your meeting password',
    'followed by pound',
    'You are in the meeting now',
    'There are two participants in the meeting',
    'You have been added to the waiting list',
    'You are in the meeting',
    'participants in the meeting',
    'meeting password',
    'Bienvenido a Zoom',
    'Ingrese su contraseña',
    'seguido de numeral',
    'Está en la reunión ahora',
    'participantes en la reunión',
    'contraseña de la reunión'
  ];
  
  let cleanedText = text;
  
  // Remove each Zoom phrase
  zoomPhrases.forEach(phrase => {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    cleanedText = cleanedText.replace(regex, '');
  });
  
  // Clean up extra whitespace and punctuation
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/[,.](\s*[,.])+/g, '.')
    .trim();
  
  return cleanedText;
}

/**
 * Detect Spanish content in transcription text using keyword analysis
 * @param text The transcription text to analyze
 * @returns true if Spanish content is detected
 */
function detectSpanishContent(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  const spanishKeywords = [
    // Common Spanish words
    'hola', 'gracias', 'por favor', 'sí', 'no', 'muy bien', 'correcto', 'perfecto',
    'agente', 'cliente', 'llamada', 'grabada', 'línea', 'preguntas', 'minutos',
    'importante', 'solicitante', 'principal', 'completó', 'solicitud', 'número',
    'contacto', 'ciudad', 'estado', 'físicamente', 'ahora mismo', 'cantidad',
    'mensual', 'apartando', 'plan', 'seguro', 'cómodo', 'presupuesto',
    'compartir', 'proporcionaste', 'copia', 'análisis', 'necesidades', 'formulario',
    'característica', 'gusta', 'nuevo', 'flexible', 'ayudar', 'mucho',
    'excelente', 'entendido', 'satisfecho', 'servicio', 'recibiste',
    'siguiente', 'paso', 'enviar', 'información', 'compañía', 'revisión',
    'emisión', 'póliza', 'necesita', 'adicional', 'contactarte', 'semanas',
    'recibirás', 'correo', 'pregunta', 'revísalas', 'buen', 'día', 'adiós',
    
    // Common Spanish phrases
    'muy bien', 'por favor', 'ahora mismo', 'muy buen', 'que tengas',
    'es correcto', 'tomaré nota', 'el siguiente paso', 'por correo',
    
    // Spanish grammar patterns
    'está', 'estás', 'estoy', 'tienen', 'tienes', 'tengo', 'hacer', 'hablar',
    'veo que', 'tengo que', 'es muy', 'me va', 'va a', 'puede', 'puedes',
    
    // AIL/GlobeLive specific Spanish terms
    'globelive', 'división ail', 'agente michael', 'mandela', 'swift'
  ];
  
  const textLower = text.toLowerCase();
  let spanishMatches = 0;
  
  // Count Spanish keyword matches
  spanishKeywords.forEach(keyword => {
    if (textLower.includes(keyword.toLowerCase())) {
      spanishMatches++;
    }
  });
  
  // Check for Spanish character patterns (ñ, accents)
  const spanishChars = /[ñáéíóúü]/gi;
  const hasSpanishChars = spanishChars.test(text);
  
  // Detect if significant Spanish content exists
  const hasSignificantSpanish = spanishMatches >= 3 || hasSpanishChars;
  
  if (hasSignificantSpanish) {
    console.log(`Spanish content detected: ${spanishMatches} keywords found, special chars: ${hasSpanishChars}`);
  }
  
  return hasSignificantSpanish;
}

/**
 * Check if transcription text contains repetitive patterns indicating poor audio quality
 * @param text The transcription text to analyze
 * @returns true if text appears repetitive/low quality
 */
function checkForRepetitiveText(text: string): boolean {
  if (!text || text.length < 20) return true;
  
  // Split into sentences and check for repetition
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 2) return true;
  
  // Check if more than 70% of sentences are very similar
  let repetitiveCount = 0;
  const firstSentence = sentences[0].trim().toLowerCase();
  
  for (let i = 1; i < sentences.length; i++) {
    const currentSentence = sentences[i].trim().toLowerCase();
    const similarity = calculateSimilarity(firstSentence, currentSentence);
    if (similarity > 0.7) {
      repetitiveCount++;
    }
  }
  
  return (repetitiveCount / sentences.length) > 0.7;
}

/**
 * Calculate string similarity between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score between 0 and 1
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Extract actual conversation content from transcription, filtering out system messages
 * @param transcription The full transcription text
 * @param segments Optional array of segments with timing information
 * @returns Filtered conversation content
 */
function extractActualConversation(transcription: string, segments: any[] = []): string {
  // System message patterns to filter out
  const systemPatterns = [
    /welcome to zoom/gi,
    /enter your meeting password/gi,
    /followed by pound/gi,
    /you are in the meeting now/gi,
    /there are \d+ participants/gi,
    /you have been added to the waiting list/gi,
    /please wait for the host/gi,
    /recording will start/gi,
    /this call is being recorded/gi,
    /please hold/gi,
    /connecting/gi,
    /participant joined/gi,
    /participant left/gi
  ];
  
  // Split transcription into sentences
  const sentences = transcription.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  
  // Filter out sentences that match system patterns
  const conversationSentences = sentences.filter(sentence => {
    // Skip very short sentences (likely fragments)
    if (sentence.length < 10) return false;
    
    // Check if sentence matches any system pattern
    const isSystemMessage = systemPatterns.some(pattern => pattern.test(sentence));
    
    // Keep sentence if it doesn't match system patterns
    return !isSystemMessage;
  });
  
  // If we have segments, try to extract based on timing gaps
  if (segments && segments.length > 0) {
    const meaningfulSegments = segments.filter(segment => {
      if (!segment.text || segment.text.length < 10) return false;
      
      // Check if segment contains system messages
      const isSystemSegment = systemPatterns.some(pattern => pattern.test(segment.text));
      return !isSystemSegment;
    });
    
    if (meaningfulSegments.length > 0) {
      const segmentText = meaningfulSegments.map(seg => seg.text).join(' ');
      if (segmentText.length > conversationSentences.join(' ').length) {
        return segmentText;
      }
    }
  }
  
  // Look for Spanish conversation patterns
  const spanishPatterns = [
    /¿.*\?/g,  // Questions in Spanish
    /sí|no|bueno|gracias|por favor/gi,  // Common Spanish words
    /habla|dice|pregunta|responde/gi    // Conversation verbs
  ];
  
  const spanishContent = sentences.filter(sentence => {
    return spanishPatterns.some(pattern => pattern.test(sentence));
  });
  
  if (spanishContent.length > 0) {
    return spanishContent.join('. ') + '.';
  }
  
  return conversationSentences.join('. ') + (conversationSentences.length > 0 ? '.' : '');
}

/**
 * Calculate Levenshtein distance between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Translate Spanish text and format with AOI structure
 * @param spanishText The Spanish transcription text
 * @returns Formatted English transcript with AOI structure
 */
async function translateAndFormatTranscriptFromSpanish(spanishText: string): Promise<string> {
  try {
    // Check if this is repetitive low-quality content first
    if (checkForRepetitiveText(spanishText)) {
      return `[Low Quality Spanish Audio Detected]

The audio appears to contain repetitive or unclear content: "${spanishText.substring(0, 100)}..."

This may indicate poor connection quality, background noise, or technical issues during the call recording.

Original Language: Spanish
Translation Status: Skipped due to audio quality issues`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: 'system',
          content: `You are a professional translator and call transcript formatter specializing in insurance sales calls. 

Translate the complete Spanish transcript to English and format it clearly showing:

1. Any system/connection messages first (if present)
2. Then the actual conversation between agent and client

Use this format:
[System Messages]: [Any Zoom or connection messages in English]

Agent: [What the insurance agent said in English]
Client: [What the client responded in English]

Continue with the Agent/Client format for the actual conversation. Be accurate and professional. Translate all content present in the original audio.`
        },
        {
          role: 'user',
          content: `Translate this complete Spanish insurance call transcript to English:

${spanishText}`
        }
      ],
      temperature: 0.1
    });

    return response.choices[0].message.content || spanishText;
  } catch (error) {
    console.error('Error translating Spanish transcript:', error);
    return `[Translation Error] Original Spanish text: ${spanishText}`;
  }
}

/**
 * Format English transcript with AOI structure
 * @param englishText The English transcription text
 * @returns Formatted transcript with AOI structure
 */
async function formatTranscriptWithAOIStructure(englishText: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: 'system',
          content: `You are a professional call transcript formatter for insurance sales calls. 

Format the entire transcript including any system messages at the beginning. Structure it clearly showing:

1. Any system/connection messages first
2. Then the actual conversation between agent and client

Use this format:
[System Messages]: [Any Zoom or connection messages]

Agent: [What the insurance agent said]
Client: [What the client responded]

Continue with the Agent/Client format for the actual conversation. If there's only system messages and no conversation, note that clearly.`
        },
        {
          role: 'user',
          content: `Please format this complete call transcript including all content:

${englishText}`
        }
      ],
      temperature: 0.1
    });

    return response.choices[0].message.content || englishText;
  } catch (error) {
    console.error('Error formatting transcript:', error);
    return englishText; // Return original text if formatting fails
  }
}