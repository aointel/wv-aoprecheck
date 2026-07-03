require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fetch = require('node-fetch');

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: fetch
  }
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyzeScreenshot(screenshotBase64) {
  const prompt = `You are analyzing a screenshot from an HPPRO insurance presentation system.

EXTRACT ALL VISIBLE DATA FROM ANY INPUT FIELDS, DROPDOWNS, AMOUNTS, OR FILLED-IN VALUES:

**PRIMARY CLIENT (NEEDS ANALYSIS):**
- primary_first_name, primary_last_name, primary_dob, primary_age
- primary_status, primary_gender, primary_email, primary_phone, primary_zip

**SPOUSE INFO:**
- spouse_first_name, spouse_last_name, spouse_dob, spouse_occupation, spouse_gender

**PLAN LEVELS:**
- enhanced_monthly, recommended_monthly, basic_monthly

**PRODUCTS:**
For EACH product visible (A71000, SRGWL, 10YRC, ADB, WHL, etc), extract:
- product_name_coverage (dollar amount)
- product_name_daily_cost
- product_name_added (true/false if checkbox checked)

**BENEFITS SUMMARY:**
- selected_plan ("ENHANCED", "RECOMMENDED", or "BASIC")
- when_something_happens, emergency_room_benefit, daily_hospital_benefit
- any_cause_of_death, accident_death

**FINISH PRESENTATION:**
- presentation_outcome ("ENROLLMENT", "NOT INTERESTED", "THINK", etc)
- total_presentation_time

Respond in JSON format with ALL fields matching database column names exactly.
Only include fields that are visible on this screen:
{
  "milestone": "intro|sponsorship|needs_analysis|plan_generator|benefits_summary|finish|other",
  "confidence": 0.0-1.0,
  "primary_first_name": "...",
  "primary_last_name": "...",
  "primary_email": "...",
  "primary_phone": "...",
  "spouse_first_name": "...",
  "enhanced_monthly": 0.00,
  "recommended_monthly": 0.00,
  "basic_monthly": 0.00,
  "selected_plan": "ENHANCED|RECOMMENDED|BASIC",
  "presentation_outcome": "ENROLLMENT|NOT INTERESTED|etc"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: screenshotBase64,
              detail: 'low'
            }
          }
        ]
      }
    ],
    max_tokens: 1000,
    temperature: 0.2
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  return JSON.parse(jsonMatch[0]);
}

async function backfillPresentations() {
  console.log('\n🔄 Starting presentation analysis backfill...\n');

  // Get ALL presentations that don't have current_phase set
  const { data: sessions, error } = await supabase
    .from('presentation_sessions')
    .select('id, session_id, agent_email, started_at, status, current_phase, screenshot_count')
    .is('current_phase', null)
    .order('started_at', { ascending: false })
    .limit(200); // Process 200 at a time

  if (error) {
    console.error('❌ Error fetching sessions:', error);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log('✅ No presentations need backfilling!');
    return;
  }

  console.log(`📊 Found ${sessions.length} presentations to analyze\n`);

  let processed = 0;
  let updated = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      processed++;
      console.log(`\n[${processed}/${sessions.length}] Processing session ${session.session_id || session.id}`);
      console.log(`  Agent: ${session.agent_email}`);
      console.log(`  Date: ${new Date(session.started_at).toLocaleString()}`);
      console.log(`  Screenshots: ${session.screenshot_count || 0}`);

      // Get screenshots for this session
      const { data: screenshots, error: screenshotError } = await supabase
        .from('presentation_screenshots')
        .select('screenshot_data, sequence_number, ai_analysis')
        .eq('session_id', session.id)
        .order('sequence_number', { ascending: false })
        .limit(10); // Analyze last 10 screenshots to get best milestone data

      if (screenshotError || !screenshots || screenshots.length === 0) {
        console.log('  ⚠️ No screenshots found, skipping...');
        continue;
      }

      console.log(`  📸 Found ${screenshots.length} screenshots`);

      // Analyze screenshots and collect all data
      const allData = {};
      let latestMilestone = null;
      let highestConfidence = 0;
      
      for (const screenshot of screenshots) {
        try {
          console.log(`    Analyzing screenshot ${screenshot.sequence_number}...`);
          const analysis = await analyzeScreenshot(screenshot.screenshot_data);
          
          if (analysis) {
            // Merge data (later screenshots override earlier ones)
            Object.assign(allData, analysis);
            
            // Track the milestone with highest confidence
            if (analysis.milestone && analysis.confidence > highestConfidence) {
              latestMilestone = analysis.milestone;
              highestConfidence = analysis.confidence;
            }
            
            console.log(`    ✅ Screenshot ${screenshot.sequence_number}: milestone=${analysis.milestone}, confidence=${analysis.confidence}`);
          }
        } catch (aiError) {
          console.error(`    ❌ AI analysis failed:`, aiError.message);
        }
      }

      // Update session with collected data
      if (Object.keys(allData).length > 0) {
        const updateData = {};
        
        // Copy all fields except metadata
        for (const [key, value] of Object.entries(allData)) {
          if (value !== null && value !== undefined && key !== 'milestone' && key !== 'confidence') {
            updateData[key] = value;
          }
        }
        
        // IMPORTANT: Set current_phase from the best milestone detected
        if (latestMilestone) {
          updateData.current_phase = latestMilestone;
          updateData.phase_updated_at = new Date().toISOString();
          console.log(`  📍 Setting phase to: ${latestMilestone} (confidence: ${highestConfidence})`);
        }

        console.log(`  📝 Updating session with ${Object.keys(updateData).length} fields...`);

        const { error: updateError } = await supabase
          .from('presentation_sessions')
          .update(updateData)
          .eq('id', session.id);

        if (updateError) {
          console.error('  ❌ Update failed:', updateError);
          failed++;
        } else {
          console.log('  ✅ Session updated successfully');
          updated++;
        }
      } else {
        console.log('  ⚠️ No data extracted from any screenshot');
      }

      // Rate limit: wait 1 second between sessions to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  ❌ Error processing session:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Processed: ${processed}`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60) + '\n');
}

backfillPresentations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

