/**
 * Backfill ALL missing AI summaries for recruit candidates
 * 
 * This script:
 * 1. Finds all candidates with empty/null AI summaries, '[]', 'null', 'undefined', or invalid data
 * 2. For each candidate, looks up their sessionid/LeadId from vdp_calls_BLASTPICK and vdp_calls
 * 3. Queries Taalk API to fetch the AI summary
 * 4. Updates the candidate with the real AI summary
 * 
 * Run with: npm run backfill-all-recruit-ai-summaries
 * 
 * Options:
 * - Set FORCE_REFRESH=true to re-fetch summaries even if they exist (for validation)
 * - Set MAX_CANDIDATES=N to limit how many candidates to process
 */

import { supabaseAdmin } from '../supabase';

// Configuration
const FORCE_REFRESH = process.env.FORCE_REFRESH === 'true';
const MAX_CANDIDATES = process.env.MAX_CANDIDATES ? parseInt(process.env.MAX_CANDIDATES) : undefined;

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

/**
 * Fetch AI summary from Taalk API using session ID
 */
async function fetchAISummaryFromTaalk(sessionId: string): Promise<string | null> {
  if (!sessionId) {
    return null;
  }

  try {
    const summaryUrl = `https://api.taalk.ai/api/calls/${sessionId}/summary?db=michaelmandella`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });

    if (!summaryResponse.ok) {
      if (summaryResponse.status === 404) {
        console.log(`  ⚠️  Taalk API: No summary found for session ${sessionId} (404)`);
        return null;
      }
      console.log(`  ⚠️  Taalk API returned ${summaryResponse.status} for session ${sessionId}`);
      return null;
    }

    const summaryJson = await summaryResponse.json();
    const fetchedSummary = summaryJson.payload?.summary || summaryJson.summary;

    // Only process if we have actual summary data (not empty/null/undefined)
    if (!fetchedSummary || fetchedSummary === null || fetchedSummary === undefined) {
      return null;
    }

    let aiSummaryData: string | null = null;
    if (Array.isArray(fetchedSummary)) {
      // Only store if array has actual content (not empty)
      if (fetchedSummary.length > 0) {
        aiSummaryData = JSON.stringify(fetchedSummary);
      }
    } else if (typeof fetchedSummary === 'string') {
      // Only store if string has actual content (not empty/whitespace)
      if (fetchedSummary.trim().length > 0) {
        aiSummaryData = fetchedSummary;
      }
    } else if (typeof fetchedSummary === 'object') {
      // Only store if object has actual content (not empty)
      const keys = Object.keys(fetchedSummary);
      if (keys.length > 0) {
        aiSummaryData = JSON.stringify(fetchedSummary);
      }
    }

    if (aiSummaryData && aiSummaryData !== '[]' && aiSummaryData.trim().length > 0) {
      return aiSummaryData;
    }

    return null;
  } catch (error) {
    console.error(`  ❌ Error fetching AI summary from Taalk API for session ${sessionId}:`, error);
    return null;
  }
}

/**
 * Check if an AI summary is valid (not empty, null, '[]', etc.)
 */
function isValidAISummary(summary: any): boolean {
  if (!summary) return false;
  const str = String(summary).trim();
  if (str === '' || str === '[]' || str === 'null' || str === 'undefined') return false;
  if (str.length < 10) return false; // Too short to be a real summary
  return true;
}

async function backfillAllRecruitAISummaries() {
  console.log('🚀 Starting backfill of ALL missing recruit candidate AI summaries...\n');
  if (FORCE_REFRESH) {
    console.log('⚠️  FORCE_REFRESH enabled - will re-fetch summaries even if they exist\n');
  }
  if (MAX_CANDIDATES) {
    console.log(`📊 MAX_CANDIDATES set to ${MAX_CANDIDATES} - will process up to ${MAX_CANDIDATES} candidates\n`);
  }

  try {
    // Step 1: Find all candidates with missing/empty/invalid AI summaries
    console.log('📋 Step 1: Finding candidates with missing/empty/invalid AI summaries...');
    
    // First, get all candidates (we'll filter in memory for better control)
    const { data: allCandidates, error: fetchError } = await supabaseAdmin
      .from('recruit_candidates')
      .select('id, first_name, last_name, phone, ai_summary, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_CANDIDATES || 10000); // Reasonable limit

    if (fetchError) {
      console.error('❌ Error fetching candidates:', fetchError);
      return;
    }

    if (!allCandidates || allCandidates.length === 0) {
      console.log('✅ No candidates found');
      return;
    }

    // Filter candidates based on FORCE_REFRESH flag
    const candidates = FORCE_REFRESH 
      ? allCandidates 
      : allCandidates.filter(c => !isValidAISummary(c.ai_summary));

    if (fetchError) {
      console.error('❌ Error fetching candidates:', fetchError);
      return;
    }

    if (!candidates || candidates.length === 0) {
      console.log('✅ No candidates with missing/invalid AI summaries found');
      return;
    }

    console.log(`📊 Found ${candidates.length} candidates to process (${FORCE_REFRESH ? 'FORCE_REFRESH mode' : 'missing/invalid summaries only'})\n`);

    // Step 2: For each candidate, find their sessionid from vdp_calls_BLASTPICK
    let processed = 0;
    let updated = 0;
    let notFound = 0;
    let noSummary = 0;
    let errors = 0;

    for (const candidate of candidates) {
      processed++;
      const candidatePhone = candidate.phone;
      const candidateName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Unknown';
      
      console.log(`\n[${processed}/${candidates.length}] Processing: ${candidateName} (${candidatePhone}) - ID: ${candidate.id}`);

      // Find sessionid/LeadId from vdp_calls_BLASTPICK and vdp_calls by phone number
      // Look for calls within 30 days of candidate creation (wider window for better matching)
      const candidateCreatedAt = new Date(candidate.created_at);
      const searchStart = new Date(candidateCreatedAt.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days before
      const searchEnd = new Date(candidateCreatedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after

      // Try vdp_calls_BLASTPICK first (has sessionid)
      const { data: vdpCalls, error: vdpError } = await supabaseAdmin
        .from('vdp_calls_BLASTPICK')
        .select('sessionid, time, market, agent, leadid')
        .eq('phone', candidatePhone)
        .ilike('market', '%aorecruit%')
        .gte('time', searchStart.toISOString())
        .lte('time', searchEnd.toISOString())
        .order('time', { ascending: false })
        .limit(10); // Get up to 10 recent calls

      // Also try vdp_calls table (has LeadId from webhook)
      const { data: vdpCallsWebhook, error: vdpWebhookError } = await supabaseAdmin
        .from('vdp_calls')
        .select('leadid, time, market, company_email')
        .eq('phone', candidatePhone)
        .ilike('market', '%aorecruit%')
        .gte('time', searchStart.toISOString())
        .lte('time', searchEnd.toISOString())
        .order('time', { ascending: false })
        .limit(10);

      // Combine both sources
      const allCallIds: Array<{ id: string; source: string; time: string }> = [];
      
      if (vdpCalls) {
        for (const call of vdpCalls) {
          if (call.sessionid) {
            allCallIds.push({ id: call.sessionid, source: 'vdp_calls_BLASTPICK (sessionid)', time: call.time });
          }
          if (call.leadid) {
            allCallIds.push({ id: call.leadid, source: 'vdp_calls_BLASTPICK (leadid)', time: call.time });
          }
        }
      }
      
      if (vdpCallsWebhook) {
        for (const call of vdpCallsWebhook) {
          if (call.leadid) {
            allCallIds.push({ id: call.leadid, source: 'vdp_calls (leadid)', time: call.time });
          }
        }
      }
      
      // Remove duplicates
      const uniqueCallIds = Array.from(new Map(allCallIds.map(item => [item.id, item])).values());

      if (vdpError || vdpWebhookError) {
        console.error(`  ❌ Error looking up VDP calls:`, vdpError || vdpWebhookError);
        errors++;
        continue;
      }

      if (uniqueCallIds.length === 0) {
        console.log(`  ⚠️  No VDP calls found for phone ${candidatePhone} around creation time`);
        notFound++;
        continue;
      }

      console.log(`  📞 Found ${uniqueCallIds.length} unique call ID(s) to try`);

      // Try each call ID until we find one with a summary
      let aiSummaryFound = false;
      for (const callInfo of uniqueCallIds) {
        if (!callInfo.id) {
          continue;
        }

        console.log(`  🔍 Trying ${callInfo.source}: ${callInfo.id}`);
        const aiSummary = await fetchAISummaryFromTaalk(callInfo.id);

        if (aiSummary) {
          console.log(`  ✅ Found AI summary (${aiSummary.length} chars) for ${callInfo.id}`);
          
          // Update candidate with AI summary
          const { error: updateError } = await supabaseAdmin
            .from('recruit_candidates')
            .update({
              ai_summary: aiSummary,
              updated_at: new Date().toISOString()
            })
            .eq('id', candidate.id);

          if (updateError) {
            console.error(`  ❌ Failed to update candidate:`, updateError);
            errors++;
          } else {
            console.log(`  ✅ ✅ ✅ AI SUMMARY SAVED to candidate ${candidate.id}!`);
            updated++;
            aiSummaryFound = true;
            break; // Found and saved, move to next candidate
          }
        } else {
          console.log(`  ⚠️  No AI summary available for ${callInfo.id}`);
        }

        // Rate limiting: wait 200ms between API calls to avoid overwhelming Taalk API
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (!aiSummaryFound) {
        console.log(`  ⚠️  No AI summary found for any sessionid for candidate ${candidate.id}`);
        noSummary++;
      }
    }

    // Summary
    console.log('\n📊 Backfill Summary:');
    console.log(`  Total candidates processed: ${processed}`);
    console.log(`  ✅ Successfully updated: ${updated}`);
    console.log(`  ⚠️  No VDP calls found: ${notFound}`);
    console.log(`  ⚠️  No AI summary available: ${noSummary}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n💡 Tip: Run with FORCE_REFRESH=true to re-fetch all summaries`);
    console.log(`💡 Tip: Run with MAX_CANDIDATES=N to limit processing`);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('backfill-all-recruit-ai-summaries.ts');
if (isMainModule) {
  backfillAllRecruitAISummaries()
    .then(() => {
      console.log('\n✅ Backfill completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Backfill failed:', error);
      process.exit(1);
    });
}

export { backfillAllRecruitAISummaries };
