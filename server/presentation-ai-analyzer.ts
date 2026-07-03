/**
 * Presentation AI Analyzer
 * Uses GPT-4o-mini Vision to analyze presentation screenshots
 * Cost-effective option: ~$0.0001 per image
 */

import OpenAI from "openai";

// DISABLED - OpenAI not used for presentation analysis
const openai = null;

interface SlideAnalysis {
  slide_title: string;
  slide_type: string; // title, product, pricing, benefits, comparison, objection, close
  products_mentioned: string[];
  key_points: string[];
  has_pricing: boolean;
  pricing_details?: string;
  quality_score: number; // 0-1
  readability: 'high' | 'medium' | 'low';
  text_content: string;
  slide_summary: string;
}

export class PresentationAIAnalyzer {
  
  /**
   * Analyze a single slide screenshot
   */
  async analyzeSlide(screenshotBase64: string): Promise<SlideAnalysis | null> {
    if (!openai) {
      console.warn('⚠️ OpenAI API key not configured - skipping AI analysis');
      return null;
    }

    try {
      console.log('🤖 Analyzing slide with GPT-4o-mini Vision...');

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are analyzing an insurance sales presentation slide from HPPRO.

Please analyze this slide and extract:
1. Slide title or main heading
2. Slide type (title, product_overview, pricing, benefits, comparison, objection_handling, close, other)
3. Insurance products mentioned (Whole Life, Term Life, Final Expense, IUL, Annuities, etc.)
4. Key bullet points or main messages
5. Whether pricing information is shown
6. Specific pricing details if visible
7. Quality score (0-1) based on readability, professionalism, and clarity
8. Readability level (high, medium, low)
9. All text content you can read
10. Brief summary of what this slide covers

Return ONLY a valid JSON object with this structure:
{
  "slide_title": "string",
  "slide_type": "string",
  "products_mentioned": ["string"],
  "key_points": ["string"],
  "has_pricing": boolean,
  "pricing_details": "string or null",
  "quality_score": 0.85,
  "readability": "high",
  "text_content": "string",
  "slide_summary": "string"
}`
              },
              {
                type: "image_url",
                image_url: {
                  url: screenshotBase64,
                  detail: "low" // Low-detail mode for cost efficiency (3x cheaper)
                }
              }
            ]
          }
        ],
        max_tokens: 500, // Reduced for cost savings
        temperature: 0.2
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      const analysis: SlideAnalysis = JSON.parse(content);
      
      console.log('✅ Slide analyzed:', analysis.slide_title);
      return analysis;
      
    } catch (error) {
      console.error('❌ Error analyzing slide:', error);
      return null;
    }
  }

  /**
   * Analyze all slides in a presentation and generate summary
   */
  async analyzePresentation(screenshots: Array<{ screenshot_data: string, sequence_number: number }>): Promise<{
    total_slides: number;
    products_covered: string[];
    has_pricing: boolean;
    presentation_flow: string[];
    quality_average: number;
    overall_summary: string;
    slides_analysis: SlideAnalysis[];
  } | null> {
    if (!openai || screenshots.length === 0) {
      return null;
    }

    try {
      console.log(`🤖 Analyzing ${screenshots.length} slides...`);

      const slidesAnalysis: SlideAnalysis[] = [];
      
      // Analyze each slide
      for (const screenshot of screenshots) {
        const analysis = await this.analyzeSlide(screenshot.screenshot_data);
        if (analysis) {
          slidesAnalysis.push(analysis);
        }
        
        // Rate limit - wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Generate overall presentation summary
      const products_covered = [...new Set(slidesAnalysis.flatMap(s => s.products_mentioned))];
      const has_pricing = slidesAnalysis.some(s => s.has_pricing);
      const quality_average = slidesAnalysis.reduce((sum, s) => sum + s.quality_score, 0) / slidesAnalysis.length;
      const presentation_flow = slidesAnalysis.map(s => s.slide_type);

      // Generate overall summary with GPT
      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an insurance sales manager reviewing an agent's presentation."
          },
          {
            role: "user",
            content: `Analyze this presentation and provide a brief summary (2-3 sentences):

Slides: ${slidesAnalysis.map((s, i) => `${i+1}. ${s.slide_title} (${s.slide_type})`).join('\n')}

Products: ${products_covered.join(', ')}
Pricing shown: ${has_pricing ? 'Yes' : 'No'}

What did the agent present and how effective was it?`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const overall_summary = summaryResponse.choices[0]?.message?.content || 'No summary available';

      console.log('✅ Presentation analysis complete');

      return {
        total_slides: slidesAnalysis.length,
        products_covered,
        has_pricing,
        presentation_flow,
        quality_average,
        overall_summary,
        slides_analysis: slidesAnalysis
      };
      
    } catch (error) {
      console.error('❌ Error analyzing presentation:', error);
      return null;
    }
  }

  /**
   * Quick analysis of a single slide for real-time display
   */
  async quickAnalyze(screenshotBase64: string): Promise<{
    title: string;
    type: string;
    summary: string;
  } | null> {
    if (!openai) return null;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What's on this slide? Give a brief 1-sentence description. Return JSON: {\"title\": \"...\", \"type\": \"...\", \"summary\": \"...\"}"
              },
              {
                type: "image_url",
                image_url: {
                  url: screenshotBase64,
                  detail: "low"
                }
              }
            ]
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;

      return JSON.parse(content);
    } catch (error) {
      console.error('❌ Quick analysis failed:', error);
      return null;
    }
  }
}

// Singleton instance
export const presentationAIAnalyzer = new PresentationAIAnalyzer();

