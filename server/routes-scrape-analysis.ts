import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import OpenAI from 'openai';

const router = Router();

// DISABLED: Presentation analysis disabled - OpenAI only for screenshot validation
// const openai = new OpenAI({ 
//   apiKey: 'DISABLED'
// });
const openai = null; // Disabled - OpenAI only for verification screenshots

/**
 * POST /api/presentations/analyze/:sessionId
 * Analyzes all scraped data for a presentation session using AI
 */
router.post('/analyze/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('🤖 Starting AI analysis for session:', sessionId);

    // Fetch all scraped data for this session
    const { data: scrapedData, error } = await supabaseAdmin
      .from('scraped_presentation_data')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('❌ Error fetching scraped data:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch scraped data',
        details: error.message 
      });
    }

    if (!scrapedData || scrapedData.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No scraped data found for this session' 
      });
    }

    console.log(`📊 Analyzing ${scrapedData.length} data points`);

    // Limit to last 50 data points to avoid token limits and get recent/final data
    const recentData = scrapedData.slice(-50);
    console.log(`   Using most recent ${recentData.length} data points for analysis`);

    // Prepare data for AI analysis
    const analysisData = recentData.map((entry: any, index: number) => ({
      timestamp: entry.timestamp,
      sequenceNumber: index + 1,
      url: entry.scraped_data.url,
      title: entry.scraped_data.title,
      textContent: entry.scraped_data.textContent?.substring(0, 1000), // Limit text
      headings: entry.scraped_data.headings,
      links: entry.scraped_data.links?.map((l: any) => l.text),
      images: entry.scraped_data.images?.length || 0,
      forms: entry.scraped_data.forms?.length || 0,
    }));

    // Calculate time spent on each page
    const pageAnalysis = analysisData.map((page: any, index: number) => {
      const nextPage = analysisData[index + 1];
      const currentTime = new Date(page.timestamp).getTime();
      const nextTime = nextPage ? new Date(nextPage.timestamp).getTime() : null;
      const timeSpentSeconds = nextTime ? Math.round((nextTime - currentTime) / 1000) : null;

      return {
        ...page,
        timeSpentSeconds,
      };
    });

    // Create AI prompt - JUST EXTRACT EVERYTHING
    const prompt = `Extract ALL data from this HPPRO presentation. Don't filter, don't decide - just extract EVERYTHING you see:

DATA:
${JSON.stringify(pageAnalysis, null, 2)}

Return JSON with EVERY piece of data you can find:
{
  "client_first_name": "",
  "client_last_name": "",
  "client_phone": "",
  "client_email": "",
  "client_age": 0,
  "client_city": "",
  "client_state": "",
  "client_zip": "",
  "spouse_first_name": "",
  "spouse_last_name": "",
  "alp_amount": "",
  "ahp_amount": "",
  "daily_premium": "",
  "monthly_premium": "",
  "total_premium": "",
  "all_dollar_amounts_found": [],
  "furthest_url": "",
  "all_urls_visited": [],
  "market_type": "",
  "products_mentioned": [],
  "all_text_extracted": ""
}

EXTRACT EVERYTHING. Look in:
- textContent for ANY names, numbers, dollar amounts
- form field values even if field names are empty
- All URLs to track progression
- ALL dollar amounts you see anywhere
- ANY text that looks like client data

Don't make decisions. Just extract RAW DATA.`;

    // DISABLED: OpenAI only for screenshot validation
    if (!openai) {
      return res.status(503).json({ 
        success: false, 
        error: 'AI analysis is disabled. OpenAI API is only used for screenshot validation.' 
      });
    }

    console.log('🤖 Sending to OpenAI for analysis...');

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction specialist for insurance presentations. Extract ONLY the sales data: premium amounts, disposition (sale/not interested/cant afford/postponed), lead name, and metrics. Do not provide coaching or recommendations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');
    
    console.log('✅ AI analysis completed');

    // Store the analysis in database
    const { data: analysisRecord, error: insertError } = await supabaseAdmin
      .from('presentation_analysis')
      .insert({
        session_id: sessionId,
        analysis: analysis,
        data_points_analyzed: scrapedData.length,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('⚠️ Failed to store analysis:', insertError);
      // Continue anyway - return the analysis even if storage fails
    }

    // Check if this counts as a real presentation
    // Must reach "No Cost Benefits" section (beyond StartPresentation and home)
    const reachedNoCostBenefits = analysis.all_urls_visited?.some(url => 
      !url.includes('StartPresentation') && 
      !url.includes('home') && 
      !url.includes('gameplan') &&
      url.includes('hppro')
    );

    console.log(`\n🔍 Presentation validation:`);
    console.log(`   Reached No Cost Benefits: ${reachedNoCostBenefits}`);
    console.log(`   Furthest URL: ${analysis.furthest_url}`);
    console.log(`   COUNTS AS PRESENTATION: ${reachedNoCostBenefits}\n`);

    // UPDATE THE PRESENTATION SESSION WITH EXTRACTED DATA (ALWAYS - even if not a real presentation)
    console.log('💾 Updating presentation_sessions with ALL extracted data...');
    
    // Determine status based on whether they reached No Cost Benefits
    let status = 'abandoned';
    let summary = 'Did not reach No Cost Benefits';
    
    if (reachedNoCostBenefits) {
      // Real presentation - check if sold
      if (analysis.furthest_url?.includes('eapp') || analysis.furthest_url?.includes('enroll')) {
        status = 'completed';
        summary = 'SOLD - Reached enrollment';
      } else {
        status = 'abandoned';
        summary = 'NO SALE - Stopped before enrollment';
      }
    }
    
    const updateData: any = {
      ai_summary: `${summary} - ALP: ${analysis.alp || 'N/A'}`,
      status: status,
      ended_at: new Date().toISOString()
    };

    // ALWAYS add client data if ANY exists
    if (analysis.client_first_name || analysis.client_last_name || analysis.client_phone) {
      updateData.client_data = {
        firstName: analysis.client_first_name,
        lastName: analysis.client_last_name,
        phone: analysis.client_phone,
        email: analysis.client_email,
        city: analysis.client_city,
        state: analysis.client_state,
        zip: analysis.client_zip,
        alp: analysis.alp
      };
      
      updateData.client_name = `${analysis.client_first_name || ''} ${analysis.client_last_name || ''}`.trim() || null;
    }

    // Add current phase
    if (analysis.furthest_url) {
      let phase = 'intro';
      if (analysis.furthest_url.includes('eapp') || analysis.furthest_url.includes('enroll')) phase = 'enrollment';
      else if (analysis.furthest_url.includes('plan') || analysis.furthest_url.includes('quote')) phase = 'plan_selection';
      else if (analysis.furthest_url.includes('Start')) phase = 'start';
      
      updateData.current_phase = { phase };
    }

    // Update the session
    const { error: updateError } = await supabaseAdmin
      .from('presentation_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (updateError) {
      console.error('❌ Failed to update presentation_sessions:', updateError);
    } else {
      console.log('✅ presentation_sessions updated with AI analysis data');
    }

    res.json({
      success: true,
      sessionId,
      analysis,
      metadata: {
        dataPointsAnalyzed: scrapedData.length,
        analysisTimestamp: new Date().toISOString(),
        totalDuration: pageAnalysis[pageAnalysis.length - 1]?.timestamp 
          ? Math.round((new Date(pageAnalysis[pageAnalysis.length - 1].timestamp).getTime() - 
                       new Date(pageAnalysis[0].timestamp).getTime()) / 1000)
          : 0
      }
    });

  } catch (error: any) {
    console.error('❌ Error analyzing presentation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to analyze presentation',
      details: error.message 
    });
  }
});

/**
 * GET /api/presentations/analyze/:sessionId
 * Retrieves existing analysis for a session
 */
router.get('/analyze/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data, error } = await supabaseAdmin
      .from('presentation_analysis')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error fetching analysis:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch analysis',
        details: error.message 
      });
    }

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'No analysis found for this session' 
      });
    }

    res.json({
      success: true,
      sessionId,
      analysis: data.analysis,
      metadata: {
        dataPointsAnalyzed: data.data_points_analyzed,
        analysisTimestamp: data.created_at,
      }
    });

  } catch (error: any) {
    console.error('❌ Error retrieving analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve analysis',
      details: error.message 
    });
  }
});

export default router;

