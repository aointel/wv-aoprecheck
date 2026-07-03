import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.SUPABASE_URL || 'https://zrkzadkgjvzwgupryuha.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpya3phZGtnanZ6d2d1cHJ5dWhhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDY2MzU4MiwiZXhwIjoyMDQ2MjM5NTgyfQ.hJ9r5_aSKx7TZu91XbA0ZyUdFAU5WcRPU8b8_Y3Vr2A';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
import { OPENAI_API_KEY } from './hardcoded-config.js';
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function backfillPresentations() {
  console.log('🔄 Starting presentation analysis backfill...');

  try {
    // Get all presentation sessions that need analysis
    const { data: sessions, error } = await supabase
      .from('presentation_sessions')
      .select('*')
      .is('ai_analysis', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching sessions: ${JSON.stringify(error)}`);
    }

    console.log(`📊 Found ${sessions?.length || 0} sessions to analyze`);

    if (!sessions || sessions.length === 0) {
      return { message: 'No sessions need analysis', processed: 0 };
    }

    let processed = 0;
    let errors = 0;

    for (const session of sessions) {
      try {
        console.log(`\n🔍 Analyzing session ${session.id}...`);

        // Get screenshots for this session
        const { data: screenshots, error: screenshotError } = await supabase
          .from('presentation_screenshots')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true });

        if (screenshotError) {
          console.error(`❌ Error fetching screenshots for session ${session.id}:`, screenshotError);
          errors++;
          continue;
        }

        if (!screenshots || screenshots.length === 0) {
          console.log(`⚠️ No screenshots found for session ${session.id}`);
          continue;
        }

        console.log(`📸 Found ${screenshots.length} screenshots for session ${session.id}`);

        // Analyze each screenshot
        const analysisResults = [];
        for (const screenshot of screenshots) {
          try {
            console.log(`🔍 Analyzing screenshot ${screenshot.id}...`);
            
            // Download screenshot from Supabase Storage
            const { data: imageData, error: downloadError } = await supabase.storage
              .from('presentation-screenshots')
              .download(screenshot.file_path);

            if (downloadError) {
              console.error(`❌ Error downloading screenshot ${screenshot.id}:`, downloadError);
              continue;
            }

            // Convert to base64
            const arrayBuffer = await imageData.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');

            // Analyze with AI
            const analysis = await analyzeScreenshot(base64);
            analysisResults.push({
              screenshot_id: screenshot.id,
              analysis
            });

            console.log(`✅ Analyzed screenshot ${screenshot.id}`);
          } catch (screenshotError) {
            console.error(`❌ Error analyzing screenshot ${screenshot.id}:`, screenshotError);
          }
        }

        // Update session with analysis results
        if (analysisResults.length > 0) {
          const { error: updateError } = await supabase
            .from('presentation_sessions')
            .update({
              ai_analysis: analysisResults,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`❌ Error updating session ${session.id}:`, updateError);
            errors++;
          } else {
            console.log(`✅ Updated session ${session.id} with analysis`);
            processed++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (sessionError) {
        console.error(`❌ Error processing session ${session.id}:`, sessionError);
        errors++;
      }
    }

    console.log(`\n🎉 Backfill completed!`);
    console.log(`✅ Processed: ${processed} sessions`);
    console.log(`❌ Errors: ${errors} sessions`);

    return {
      message: 'Backfill completed',
      processed,
      errors,
      total: sessions.length
    };

  } catch (error) {
    console.error('❌ Backfill error:', error);
    throw error;
  }
}

async function analyzeScreenshot(screenshotBase64: string) {
  const prompt = `You are analyzing a screenshot from an HPPRO insurance presentation system.

EXTRACT ALL VISIBLE DATA FROM ANY INPUT FIELDS, DROPDOWNS, AMOUNTS, OR FILLED-IN VALUES:

**PRIMARY CLIENT (NEEDS ANALYSIS):**
- primary_first_name, primary_last_name, primary_dob, primary_age
- primary_status, primary_gender, primary_email, primary_phone, primary_zip

**SPOUSE INFO:**
- spouse_first_name, spouse_last_name, spouse_dob, spouse_occupation, spouse_gender

**CHILDREN INFO:**
- child1_name, child1_dob, child1_gender
- child2_name, child2_dob, child2_gender
- child3_name, child3_dob, child3_gender

**INSURANCE DETAILS:**
- coverage_amount, coverage_type, premium_amount, payment_frequency
- beneficiary_name, beneficiary_relationship

**ADDRESS INFO:**
- street_address, city, state, zip_code

**OTHER INFO:**
- occupation, employer, annual_income, health_conditions
- smoking_status, height, weight, any_other_visible_data

**IMPORTANT:**
- Extract EXACT values as they appear on screen
- If a field is empty or not visible, return null
- If you see dropdowns or selections, extract the selected values
- Look for any error messages or validation issues
- Note the overall completion status of the form

Return ONLY a JSON object with the extracted data.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Try to parse the JSON response
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.warn('⚠️ Could not parse JSON response, returning raw content');
      return { raw_analysis: content };
    }

  } catch (error) {
    console.error('❌ Error analyzing screenshot:', error);
    return { error: error.message };
  }
}
