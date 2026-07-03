import { Router } from 'express';
import { supabaseAdmin } from './supabase';
import OpenAI from 'openai';

const router = Router();

// DISABLED: Presentation screenshot analysis disabled - OpenAI only for verification screenshots
// const openai = new OpenAI({ 
//   apiKey: 'DISABLED'
// });
const openai = null; // Disabled - OpenAI only for verification screenshots

/**
 * POST /api/presentations/analyze-screenshots/:sessionId
 * Analyze screenshots using GPT-4 Vision to extract ALL data
 */
router.post('/analyze-screenshots/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log('🖼️  Analyzing screenshots with Vision AI for session:', sessionId);

    // Get screenshots for this session
    const { data: screenshots, error } = await supabaseAdmin
      .from('presentation_screenshots')
      .select('*')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: true });

    if (error) throw error;

    if (!screenshots || screenshots.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No screenshots found for this session' 
      });
    }

    console.log(`📸 Found ${screenshots.length} screenshots`);

    // Analyze last 10 screenshots (most important - end of presentation)
    const screenshotsToAnalyze = screenshots.slice(-10);
    console.log(`   Analyzing last ${screenshotsToAnalyze.length} screenshots with Vision AI...`);

    const extractedData = {
      client_first_name: '',
      client_last_name: '',
      client_phone: '',
      client_state: '',
      alp_amount: '',
      all_dollar_amounts: [],
      furthest_page: '',
      all_data_seen: []
    };

    // DISABLED: OpenAI only for screenshot validation
    if (!openai) {
      return res.status(503).json({ 
        success: false, 
        error: 'AI screenshot analysis is disabled. OpenAI API is only used for verification screenshot validation.' 
      });
    }

    for (const screenshot of screenshotsToAnalyze) {
      try {
        // Use GPT-4 Vision to analyze the screenshot
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract ALL visible data from this HPPRO insurance presentation screenshot. Return JSON with: client_first_name, client_last_name, client_phone, client_state, alp_amount (any $ amount you see), page_type (what screen is this - intro/client_info/plan_selection/enrollment/etc), all_text_visible (all text you can read)'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: screenshot.screenshot_data // base64 data URL
                  }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1000
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');
        console.log(`     Screenshot ${screenshot.sequence_number}:`, result.page_type, result.client_first_name || 'no name');
        
        // Merge data
        if (result.client_first_name) extractedData.client_first_name = result.client_first_name;
        if (result.client_last_name) extractedData.client_last_name = result.client_last_name;
        if (result.client_phone) extractedData.client_phone = result.client_phone;
        if (result.client_state) extractedData.client_state = result.client_state;
        if (result.alp_amount) extractedData.alp_amount = result.alp_amount;
        if (result.page_type) extractedData.furthest_page = result.page_type;
        if (result.all_text_visible) extractedData.all_data_seen.push(result.all_text_visible);

      } catch (visionError) {
        console.error(`     ❌ Vision error on screenshot ${screenshot.sequence_number}:`, visionError.message);
      }

      // Wait 1 second between vision calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Vision analysis complete!');
    console.log('   Extracted:', extractedData);

    // Update presentation_sessions with extracted data
    const disposition = extractedData.furthest_page?.includes('enroll') ? 'SOLD' : 'NO_SALE';

    const { error: updateError } = await supabaseAdmin
      .from('presentation_sessions')
      .update({
        client_data: {
          firstName: extractedData.client_first_name,
          lastName: extractedData.client_last_name,
          phone: extractedData.client_phone,
          state: extractedData.client_state,
          alp: extractedData.alp_amount
        },
        client_name: `${extractedData.client_first_name} ${extractedData.client_last_name}`.trim(),
        current_phase: { phase: extractedData.furthest_page },
        ai_summary: `${disposition} - ${extractedData.furthest_page || 'unknown'} phase - ALP: ${extractedData.alp_amount || 'N/A'}`,
        status: disposition === 'SOLD' ? 'completed' : 'abandoned'
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('❌ Failed to update session:', updateError);
    }

    res.json({
      success: true,
      extractedData,
      screenshotsAnalyzed: screenshotsToAnalyze.length
    });

  } catch (error: any) {
    console.error('❌ Error in screenshot analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;

