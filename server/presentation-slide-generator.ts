/**
 * Presentation Slide Generator
 * SIMPLIFIED: Only extracts what managers care about
 * 1. Stats breakdown (KPIs)
 * 2. Needs analysis (client needs)
 * 3. Benefits presented (what was shown)
 * 4. Final benefit summary (what was selected)
 */

import OpenAI from 'openai';
import { supabaseAdmin } from './supabase';

// DISABLED - OpenAI not used for slide generation
const openAIClient: OpenAI | null = null;

interface PresentationSlide {
  slideNumber: number;
  title: string;
  content: string[];
  slideType: 'stats' | 'needs_analysis' | 'benefits_presented' | 'final_summary' | 'skip';
  screenshot?: string; // Include screenshot for reference
  clientName?: string;
  clientInfo?: string;
  quotes?: Array<{carrier: string; premium: string; coverage: string}>;
  selectedProduct?: {carrier: string; product: string; premium: string};
}

class PresentationSlideGenerator {
  
  /**
   * Generate a presentable slide deck from screenshots
   */
  async generateSlideDeck(sessionId: string): Promise<PresentationSlide[]> {
    try {
      console.log('🎨 Generating AI-powered slide deck for session:', sessionId);
      
      // Get all screenshots for this session
      const { data: screenshots, error } = await supabaseAdmin
        .from('presentation_screenshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: true });
      
      if (error || !screenshots || screenshots.length === 0) {
        console.error('❌ No screenshots found for session:', sessionId);
        return [];
      }
      
      console.log(`📸 Processing ${screenshots.length} screenshots...`);
      
      const slides: PresentationSlide[] = [];
      
      // Process screenshots in batches of 10 for efficiency
      const batchSize = 10;
      for (let i = 0; i < screenshots.length; i += batchSize) {
        const batch = screenshots.slice(i, Math.min(i + batchSize, screenshots.length));
        console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(screenshots.length/batchSize)}...`);
        
        const batchSlides = await this.analyzeBatch(batch, i);
        slides.push(...batchSlides);
      }
      
      // Filter out "skip" slides - only keep what managers care about
      const importantSlides = slides.filter(s => s.slideType !== 'skip');
      
      console.log(`🎯 Filtered ${screenshots.length} screenshots down to ${importantSlides.length} important slides`);
      console.log(`   - Stats: ${importantSlides.filter(s => s.slideType === 'stats').length}`);
      console.log(`   - Needs Analysis: ${importantSlides.filter(s => s.slideType === 'needs_analysis').length}`);
      console.log(`   - Benefits Presented: ${importantSlides.filter(s => s.slideType === 'benefits_presented').length}`);
      console.log(`   - Final Summary: ${importantSlides.filter(s => s.slideType === 'final_summary').length}`);
      
      // Save slide deck to database
      await supabaseAdmin
        .from('presentation_sessions')
        .update({
          slides_data: { slides: importantSlides },
          total_slides_shown: importantSlides.length,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
      
      console.log(`✅ Generated ${importantSlides.length} presentation slides (skipped ${slides.length - importantSlides.length} unimportant screens)`);
      return importantSlides;
      
    } catch (error) {
      console.error('❌ Error generating slide deck:', error);
      return [];
    }
  }
  
  /**
   * Analyze a batch of screenshots together
   */
  async analyzeBatch(screenshots: any[], startIndex: number): Promise<PresentationSlide[]> {
    try {
      // Analyze each screenshot individually for now (can be optimized later)
      const slides: PresentationSlide[] = [];
      
      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        const slideNumber = startIndex + i + 1;
        
        const slide = await this.analyzeScreenshotForSlide(
          screenshot.screenshot_data || screenshot.screenshot_url,
          slideNumber
        );
        
        slides.push(slide);
      }
      
      return slides;
    } catch (error) {
      console.error('❌ Error analyzing batch:', error);
      return [];
    }
  }
  
  /**
   * Analyze a single screenshot - SIMPLIFIED for manager needs
   * Only keep: Stats, Needs Analysis, Benefits Presented, Final Summary
   */
  async analyzeScreenshotForSlide(screenshotData: string, slideNumber: number): Promise<PresentationSlide> {
    try {
      const prompt = `Analyze this insurance presentation screenshot. MANAGERS ONLY CARE ABOUT:
1. STATS/KPIs (presentation metrics, duration, leads reviewed, etc.)
2. NEEDS ANALYSIS (client info, age, location, needs identified)
3. BENEFITS PRESENTED (quotes shown, carriers, premiums, coverage amounts)
4. FINAL SUMMARY (what was selected/sold)

Determine if this screen is ONE OF THESE:
- "stats": Stats/KPIs/Analytics screen
- "needs_analysis": Client information or needs analysis
- "benefits_presented": Insurance quotes/products being shown
- "final_summary": Final benefit summary or selection screen
- "skip": Skip this screenshot (not important for managers)

Respond in JSON:
{
  "title": "Brief screen title",
  "content": ["Bullet point 1", "Bullet point 2"],
  "slideType": "stats|needs_analysis|benefits_presented|final_summary|skip",
  "clientName": "Full client name if visible",
  "clientInfo": "Age, location, tobacco status if visible",
  "quotes": [{"carrier": "Carrier name", "premium": "$X/month", "coverage": "$X"}],
  "selectedProduct": {"carrier": "...", "product": "...", "premium": "..."}
}

If slideType is "skip", just return {"slideType": "skip"}`;

      if (!openAIClient) {
        console.warn('⚠️ OpenAI disabled for presentation slide generation - skipping AI analysis');
        return { slideNumber, title: '', content: [], slideType: 'skip' };
      }
      const response = await openAIClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: screenshotData.startsWith('data:') ? screenshotData : `data:image/png;base64,${screenshotData}`,
                  detail: 'low' // Low detail for faster/cheaper analysis
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { slideNumber, title: '', content: [], slideType: 'skip' };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { slideNumber, title: '', content: [], slideType: 'skip' };
      }

      const slideData = JSON.parse(jsonMatch[0]);
      
      // Skip slides that aren't important
      if (slideData.slideType === 'skip') {
        return { slideNumber, title: '', content: [], slideType: 'skip' };
      }
      
      return {
        slideNumber,
        title: slideData.title || `Slide ${slideNumber}`,
        content: slideData.content || [],
        slideType: slideData.slideType,
        screenshot: screenshotData,
        clientName: slideData.clientName,
        clientInfo: slideData.clientInfo,
        quotes: slideData.quotes,
        selectedProduct: slideData.selectedProduct
      };

    } catch (error) {
      console.error(`❌ Error analyzing slide ${slideNumber}:`, error);
      return { slideNumber, title: '', content: [], slideType: 'skip' };
    }
  }
}

export const presentationSlideGenerator = new PresentationSlideGenerator();

