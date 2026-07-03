/**
 * Translation utility to translate Spanish text to English
 */

// Simple Spanish detection - checks for common Spanish words and patterns
export function detectSpanish(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  const spanishIndicators = [
    /\b(realizó|realizo|confirmó|confirmo|reunió|reunio|agente|llamada|grabada|información|ubicación|pago|mensual|cómodo|presupuesto)\b/gi,
    /\b(con|para|sobre|su|su|el|la|los|las|un|una|del|de|a|en)\b/gi,
    /\b(es|son|está|estan|fue|fueron|será|seran)\b/gi,
    /[áéíóúñüÁÉÍÓÚÑÜ]/g, // Spanish accent marks
  ];
  
  let spanishScore = 0;
  const textLower = text.toLowerCase();
  
  // Check for Spanish words
  spanishIndicators.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      spanishScore += matches.length;
    }
  });
  
  // If we have accent marks, likely Spanish
  if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(text)) {
    spanishScore += 5;
  }
  
  // Threshold: if we have multiple Spanish indicators, it's likely Spanish
  return spanishScore >= 3;
}

// Translate Spanish text to English using OpenAI
export async function translateToEnglish(spanishText: string): Promise<string> {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: spanishText,
        from: 'es',
        to: 'en',
      }),
    });

    if (!response.ok) {
      console.warn('Translation API failed, returning original text');
      return spanishText;
    }

    const data = await response.json();
    return data.translatedText || spanishText;
  } catch (error) {
    console.error('Translation error:', error);
    return spanishText; // Return original on error
  }
}

// Memoized translation cache
const translationCache = new Map<string, string>();

export async function translateIfSpanish(text: string): Promise<string> {
  if (!text) return text;
  
  // Check cache first
  if (translationCache.has(text)) {
    return translationCache.get(text)!;
  }
  
  // Check if it's Spanish
  if (!detectSpanish(text)) {
    translationCache.set(text, text);
    return text;
  }
  
  // Translate
  const translated = await translateToEnglish(text);
  translationCache.set(text, translated);
  return translated;
}

