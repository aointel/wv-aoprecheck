import { supabaseAdmin } from './supabase';

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

/**
 * Helper function to validate summary - exclude "PENDING" and empty values
 */
function isValidSummary(summary: any): boolean {
  if (!summary) return false;
  if (typeof summary === 'string') {
    const trimmed = summary.trim();
    return trimmed !== '' && trimmed !== '[]' && trimmed !== 'PENDING' && trimmed.toUpperCase() !== 'PENDING';
  }
  if (Array.isArray(summary)) {
    return summary.length > 0;
  }
  return !!summary;
}

/**
 * Helper function to validate transcript
 */
function isValidTranscript(transcript: any): boolean {
  if (!transcript) return false;
  const trimmed = String(transcript).trim();
  return trimmed !== '' && trimmed !== '[]';
}

/**
 * Fetch transcript and AI summary from Taalk API for a single session
 */
async function fetchTranscriptAndSummary(session: any): Promise<{
  transcript: string | null;
  summary: any | null;
  parsedSummary: any;
}> {
  const taalkCallId = session.taalk_call_id;
  if (!taalkCallId) {
    return { transcript: null, summary: null, parsedSummary: {} };
  }

  let callTranscript = null;
  let aiSummaryData: any = null;
  let parsedSummary: any = {};

  // Fetch transcript
  try {
    const transcriptUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/transcript?db=michaelmandella`;
    const transcriptResponse = await fetch(transcriptUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });
    
    if (transcriptResponse.ok) {
      callTranscript = await transcriptResponse.text();
    }
  } catch (error) {
    console.error(`❌ Error fetching transcript for ${taalkCallId}:`, error);
  }

  // Fetch AI summary with retry logic
  let summaryResponse: Response | null = null;
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      const summaryUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/summary?db=michaelmandella`;
      summaryResponse = await fetch(summaryUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}` }
      });
      
      if (summaryResponse.ok) {
        break; // Success, exit retry loop
      } else if (summaryResponse.status === 404) {
        // Call not found or not processed yet - don't retry
        console.log(`⚠️ Call ${taalkCallId} summary not found (404) - may not be processed yet`);
        break;
      } else if (summaryResponse.status >= 500 && retryCount < MAX_RETRIES - 1) {
        // Server error - retry
        retryCount++;
        const delay = retryCount * 2000; // 2s, 4s, 6s
        console.log(`⚠️ Server error ${summaryResponse.status} fetching summary for ${taalkCallId}, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      } else {
        // Other error - don't retry
        break;
      }
    } catch (error) {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        const delay = retryCount * 2000;
        console.log(`⚠️ Error fetching summary for ${taalkCallId}, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`❌ Failed to fetch summary for ${taalkCallId} after ${MAX_RETRIES} attempts:`, error);
      }
    }
  }
  
  try {
    if (summaryResponse && summaryResponse.ok) {
      const summaryJson = await summaryResponse.json();
      aiSummaryData = summaryJson.payload?.summary || summaryJson.summary || [];
      
      // Log if summary is empty
      if (!aiSummaryData || (Array.isArray(aiSummaryData) && aiSummaryData.length === 0)) {
        console.log(`⚠️ AI Summary is empty for call ${taalkCallId} - API may not have processed it yet`);
        console.log(`   Response status: ${summaryResponse.status}, Full response: ${JSON.stringify(summaryJson).substring(0, 200)}`);
      } else {
        console.log(`✅ Fetched AI Summary for ${taalkCallId}: ${Array.isArray(aiSummaryData) ? aiSummaryData.length : 'object'} items`);
      }
      
      // Parse summary array into individual fields (same logic as webhook)
      for (const item of aiSummaryData) {
        const key = item.key?.toLowerCase() || '';
        const value = item.value;
        
        if (key.includes('quick recap')) parsedSummary.quickRecap = value;
        else if (key.includes('next steps')) parsedSummary.nextSteps = value;
        else if (key.includes('key topics') || key.includes('summary of key')) parsedSummary.keyTopics = value;
        else if (key.includes('sentiment')) parsedSummary.sentimentScore = parseInt(value) || null;
        else if (key.includes('refuse')) parsedSummary.userRefused = value?.toLowerCase() === 'true';
        else if (key.includes('preview')) parsedSummary.preview = value;
        else if (key.includes('result')) parsedSummary.result = value;
        else if (key.includes('red flag')) parsedSummary.redFlags = value;
        else if (key.includes('favorite feature')) parsedSummary.favoriteFeature = value;
        // Compliance fields
        else if (key.includes('agent confirmed')) parsedSummary.complianceAgentConfirmed = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('contact verified')) parsedSummary.complianceContactVerified = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('premium ok')) parsedSummary.compliancePremiumOk = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('medical q')) parsedSummary.complianceMedicalAsked = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('meds q')) parsedSummary.complianceMedsAsked = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('legal q')) parsedSummary.complianceLegalAsked = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('needs analysis')) parsedSummary.complianceNeedsAnalysis = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('all medical')) parsedSummary.complianceAllMedical = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('info accurate')) parsedSummary.complianceInfoAccurate = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('ach explained')) parsedSummary.complianceAchExplained = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
        else if (key.includes('client satisfied')) parsedSummary.complianceClientSatisfied = value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
      }
      
      // Determine if passed based on result or preview
      if (parsedSummary.result?.toLowerCase().includes('pass') || parsedSummary.preview?.toLowerCase().includes('pass')) {
        parsedSummary.resultPassed = true;
      } else if (parsedSummary.result?.toLowerCase().includes('fail') || parsedSummary.preview?.toLowerCase().includes('fail')) {
        parsedSummary.resultPassed = false;
      }
    } else if (summaryResponse) {
      const errorText = await summaryResponse.text().catch(() => 'Unable to read error');
      console.error(`❌ Error fetching AI summary for ${taalkCallId}: ${summaryResponse.status} ${summaryResponse.statusText}`);
      console.error(`   Response: ${errorText.substring(0, 500)}`);
      // Don't throw - continue to next session
    } else {
      console.error(`❌ Failed to fetch AI summary for ${taalkCallId} after ${MAX_RETRIES} retries`);
    }
  } catch (error) {
    console.error(`❌ Exception processing AI summary for ${taalkCallId}:`, error);
  }

  return { transcript: callTranscript, summary: aiSummaryData, parsedSummary };
}

/**
 * Transcript & Summary Scheduler - Runs every 15 minutes to fetch missing data
 * Finds completed verification sessions that are missing transcript or summary
 * and fetches them from Taalk API
 */
export async function fetchMissingTranscriptsAndSummaries() {
  try {
    console.log('🔄 TRANSCRIPT/SUMMARY SCHEDULER: Starting check for missing data...');
    
    // Find ALL sessions that are missing transcript or summary
    // Uses the existing taalk_call_id from verification_sessions table to fetch data from Taalk API
    // Processes ALL sessions REGARDLESS OF STATUS that:
    // 1. Have a taalk_call_id (call was made) - already stored in verification_sessions.taalk_call_id
    // 2. Are missing call_transcript OR taalk_ai_summary
    // NO STATUS FILTER - processes all sessions with taalk_call_id
    
    console.log(`🔍 Looking for ALL sessions with taalk_call_id missing transcript or summary...`);
    
    // First, let's see how many sessions with taalk_call_id exist (all statuses)
    const { count: totalCount } = await supabaseAdmin
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .not('taalk_call_id', 'is', null);
    
    console.log(`📊 Total sessions with taalk_call_id (all statuses): ${totalCount || 0}`);
    
    // Find ones missing transcript or summary - NO STATUS FILTER
    // CRITICAL: Fetch ALL sessions with taalk_call_id and filter in code
    // because Supabase can't easily query for empty JSONB arrays or "PENDING" strings
    // We'll filter in JavaScript to catch all edge cases
    // Fetch in batches to handle large datasets
    let allSessions: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    let lastFetchError: unknown = null;
    
    while (hasMore) {
      const { data: sessionsBatch, error: fetchError } = await supabaseAdmin
        .from('verification_sessions')
        .select('id, session_id, taalk_call_id, call_transcript, taalk_ai_summary, status, created_at, completed_at, taalk_call_data')
        .not('taalk_call_id', 'is', null)
        .neq('taalk_call_id', '')
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      
      lastFetchError = fetchError;
      if (fetchError) {
        console.error('❌ Error fetching sessions:', fetchError);
        console.error('❌ Error details:', JSON.stringify(fetchError, null, 2));
        hasMore = false;
        break;
      }
      
      if (sessionsBatch && sessionsBatch.length > 0) {
        allSessions.push(...sessionsBatch);
        offset += batchSize;
        
        if (sessionsBatch.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    const sessions = allSessions;
    
    if (lastFetchError) {
      console.error('❌ Error fetching sessions:', lastFetchError);
      console.error('❌ Error details:', JSON.stringify(lastFetchError, null, 2));
      return;
    }
    
    if (!sessions || sessions.length === 0) {
      console.log('✅ No sessions found missing transcript or summary');
      console.log(`   Total sessions with taalk_call_id: ${totalCount || 0}`);
      return;
    }
    
    // CRITICAL: Filter in code to catch empty arrays/strings that Supabase query might miss
    const sessionsNeedingData = sessions.filter(session => {
      // Check transcript
      const hasTranscript = isValidTranscript(session.call_transcript);
      
      // Check summary
      const hasSummary = isValidSummary(session.taalk_ai_summary);
      
      // Need data if missing transcript OR missing summary
      const needsData = !hasTranscript || !hasSummary;
      
      return needsData;
    });
    
    console.log(`📊 Filtered ${sessionsNeedingData.length} sessions needing data from ${sessions.length} total sessions with taalk_call_id`);
    
    if (sessionsNeedingData.length === 0) {
      console.log('✅ All sessions already have transcript and summary');
      return;
    }
    
    console.log(`📊 Found ${sessionsNeedingData.length} sessions missing transcript/summary data (filtered from ${sessions.length} candidates)`);
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // CRITICAL: Process only sessions that need data (not all sessions)
    for (const session of sessionsNeedingData) {
      try {
        // Re-validate (defensive check - should already be filtered)
        const hasTranscript = isValidTranscript(session.call_transcript);
        const hasSummary = isValidSummary(session.taalk_ai_summary);
        
        if (hasTranscript && hasSummary) {
          skippedCount++;
          continue;
        }
        
        const missingTranscript = !hasTranscript;
        const missingSummary = !hasSummary;
        
        console.log(`📝 Fetching data for session ${session.session_id} (call: ${session.taalk_call_id})...`);
        console.log(`   Missing transcript: ${missingTranscript}, Missing summary: ${missingSummary}`);
        
        const { transcript, summary, parsedSummary } = await fetchTranscriptAndSummary(session);
        
        // Only update if we got new data
        const updateData: any = {
          updated_at: new Date().toISOString()
        };
        
        // Update transcript if we got new data and it's valid
        if (transcript && isValidTranscript(transcript) && !isValidTranscript(session.call_transcript)) {
          updateData.call_transcript = transcript;
        }
        
        // Check if summary is actually valid (not empty or "PENDING")
        const hasValidSummary = isValidSummary(summary);
        const currentSummaryEmpty = !isValidSummary(session.taalk_ai_summary);
        
        if (hasValidSummary && currentSummaryEmpty) {
          updateData.taalk_ai_summary = summary;
          
          // Also update parsed fields if we have summary
          if (parsedSummary.quickRecap) updateData.ai_quick_recap = parsedSummary.quickRecap;
          if (parsedSummary.nextSteps) updateData.ai_next_steps = parsedSummary.nextSteps;
          if (parsedSummary.keyTopics) updateData.ai_key_topics = parsedSummary.keyTopics;
          if (parsedSummary.sentimentScore !== undefined) updateData.ai_sentiment_score = parsedSummary.sentimentScore;
          if (parsedSummary.userRefused !== undefined) updateData.ai_user_refused_call = parsedSummary.userRefused;
          if (parsedSummary.result) updateData.ai_result = parsedSummary.result;
          if (parsedSummary.resultPassed !== undefined) updateData.ai_result_passed = parsedSummary.resultPassed;
          if (parsedSummary.redFlags) updateData.ai_red_flags = parsedSummary.redFlags;
          if (parsedSummary.favoriteFeature) updateData.ai_favorite_feature = parsedSummary.favoriteFeature;
          if (parsedSummary.preview) updateData.ai_preview = parsedSummary.preview;
          
          // Compliance fields
          if (parsedSummary.complianceAgentConfirmed !== undefined) updateData.compliance_agent_confirmed = parsedSummary.complianceAgentConfirmed;
          if (parsedSummary.complianceContactVerified !== undefined) updateData.compliance_contact_verified = parsedSummary.complianceContactVerified;
          if (parsedSummary.compliancePremiumOk !== undefined) updateData.compliance_premium_ok = parsedSummary.compliancePremiumOk;
          if (parsedSummary.complianceMedicalAsked !== undefined) updateData.compliance_medical_asked = parsedSummary.complianceMedicalAsked;
          if (parsedSummary.complianceMedsAsked !== undefined) updateData.compliance_meds_asked = parsedSummary.complianceMedsAsked;
          if (parsedSummary.complianceLegalAsked !== undefined) updateData.compliance_legal_asked = parsedSummary.complianceLegalAsked;
          if (parsedSummary.complianceNeedsAnalysis !== undefined) updateData.compliance_needs_analysis = parsedSummary.complianceNeedsAnalysis;
          if (parsedSummary.complianceAllMedical !== undefined) updateData.compliance_all_medical = parsedSummary.complianceAllMedical;
          if (parsedSummary.complianceInfoAccurate !== undefined) updateData.compliance_info_accurate = parsedSummary.complianceInfoAccurate;
          if (parsedSummary.complianceAchExplained !== undefined) updateData.compliance_ach_explained = parsedSummary.complianceAchExplained;
          if (parsedSummary.complianceClientSatisfied !== undefined) updateData.compliance_client_satisfied = parsedSummary.complianceClientSatisfied;
        }
        
        // Only update if we have new data to save
        if (Object.keys(updateData).length > 1) { // More than just updated_at
          const { error: updateError } = await supabaseAdmin
            .from('verification_sessions')
            .update(updateData)
            .eq('session_id', session.session_id);
          
          if (updateError) {
            console.error(`❌ Failed to update session ${session.session_id}:`, updateError);
            errorCount++;
          } else {
            console.log(`✅ Updated session ${session.session_id} - transcript: ${!!transcript}, summary: ${!!summary}`);
            successCount++;
          }
        } else {
          skippedCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing session ${session.session_id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`🎉 TRANSCRIPT/SUMMARY SCHEDULER COMPLETE:`);
    console.log(`   ✅ Successfully updated: ${successCount} sessions`);
    console.log(`   ⚠️ Skipped (already have data): ${skippedCount} sessions`);
    console.log(`   ❌ Errors: ${errorCount} sessions`);
    
  } catch (error) {
    console.error('❌ Error in transcript/summary scheduler:', error);
  }
}

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null;

export function startTranscriptSummaryScheduler() {
  if (schedulerInterval) {
    console.log('⚠️ Transcript/Summary scheduler already running');
    return;
  }
  
  console.log('🚀 Starting Transcript/Summary scheduler (every 5 minutes)');
  
  // Run immediately on startup
  fetchMissingTranscriptsAndSummaries();
  
  // Then run every 5 minutes - keep re-running to process pending AI summaries
  schedulerInterval = setInterval(() => {
    fetchMissingTranscriptsAndSummaries();
  }, 5 * 60 * 1000); // 5 minutes
}

export function stopTranscriptSummaryScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 Transcript/Summary scheduler stopped');
  }
}

