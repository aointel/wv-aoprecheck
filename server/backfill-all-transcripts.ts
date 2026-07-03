/**
 * COMPREHENSIVE Backfill Script: Fetch Transcripts and AI Summaries for ALL Verification Sessions
 * 
 * This script processes ALL verification_sessions with taalk_call_id,
 * REGARDLESS OF STATUS, and fetches their transcripts and AI summaries from Taalk API.
 * 
 * Run with: tsx server/backfill-all-transcripts.ts
 * 
 * Options:
 *   --limit N        Process only first N sessions (for testing)
 *   --force          Re-fetch even if transcript/summary already exists
 */

import { supabaseAdmin } from './supabase';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

/**
 * Fetch transcript and AI summary from Taalk API for a single session
 */
async function fetchTranscriptAndSummary(taalkCallId: string): Promise<{
  transcript: string | null;
  summary: any | null;
  parsedSummary: any;
  isIncomplete: boolean;
}> {
  let callTranscript = null;
  let aiSummaryData: any = null;
  let parsedSummary: any = {};
  let isIncomplete = false;

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
    console.error(`  ❌ Error fetching transcript:`, error);
  }

  // Fetch AI summary
  try {
    const summaryUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/summary?db=michaelmandella`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: { 'Authorization': `Bearer ${taalkApiKey}` }
    });
    
    if (summaryResponse.ok) {
      const summaryJson = await summaryResponse.json();
      aiSummaryData = summaryJson.payload?.summary || summaryJson.summary || [];
      
      // Check if summary is empty (incomplete call)
      if (!aiSummaryData || (Array.isArray(aiSummaryData) && aiSummaryData.length === 0)) {
        isIncomplete = true;
        console.log(`  ⚠️ Call ${taalkCallId} - Summary is empty (incomplete call)`);
      } else {
        // Parse summary array into individual fields
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
        
        // Determine if passed
        if (parsedSummary.result?.toLowerCase().includes('pass') || parsedSummary.preview?.toLowerCase().includes('pass')) {
          parsedSummary.resultPassed = true;
        } else if (parsedSummary.result?.toLowerCase().includes('fail') || parsedSummary.preview?.toLowerCase().includes('fail')) {
          parsedSummary.resultPassed = false;
        }
      }
    } else if (summaryResponse.status === 404) {
      // Call not found or not processed yet - incomplete
      isIncomplete = true;
      console.log(`  ⚠️ Call ${taalkCallId} - Summary not found (404) - incomplete call`);
    }
  } catch (error) {
    console.error(`  ❌ Error fetching AI summary:`, error);
    isIncomplete = true; // Assume incomplete on error
  }

  return { transcript: callTranscript, summary: aiSummaryData, parsedSummary, isIncomplete };
}

async function backfillAllTranscripts(limit?: number, force: boolean = false) {
  console.log('🔄 Starting COMPREHENSIVE transcript/summary backfill...');
  console.log('📋 Processing ALL verification_sessions with taalk_call_id (REGARDLESS OF STATUS)\n');
  
  try {
    // Get ALL sessions with taalk_call_id - NO STATUS FILTER
    // Fetch in batches to handle Supabase pagination limits
    console.log('📊 Fetching ALL sessions with taalk_call_id...');
    
    let allSessions: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      let query = supabaseAdmin
        .from('verification_sessions')
        .select('id, session_id, taalk_call_id, call_transcript, taalk_ai_summary, status, created_at, completed_at')
        .not('taalk_call_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      
      const { data: sessions, error: fetchError } = await query;
      
      if (fetchError) {
        console.error('❌ Error fetching sessions:', fetchError);
        return;
      }
      
      if (!sessions || sessions.length === 0) {
        hasMore = false;
        break;
      }
      
      allSessions = allSessions.concat(sessions);
      console.log(`   Fetched batch: ${sessions.length} sessions (total so far: ${allSessions.length})`);
      
      // If we got fewer than batchSize, we've reached the end
      if (sessions.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
        // Apply limit if specified
        if (limit && allSessions.length >= limit) {
          allSessions = allSessions.slice(0, limit);
          hasMore = false;
        }
      }
    }
    
    const sessions = limit ? allSessions.slice(0, limit) : allSessions;
    
    if (sessions.length === 0) {
      console.log('⚠️ No sessions with taalk_call_id found');
      return;
    }
    
    // Get total count separately
    const { count: totalCount } = await supabaseAdmin
      .from('verification_sessions')
      .select('*', { count: 'exact', head: true })
      .not('taalk_call_id', 'is', null);
    
    console.log(`✅ Found ${sessions.length} sessions with taalk_call_id`);
    if (totalCount) {
      console.log(`📊 Total sessions with taalk_call_id in database: ${totalCount}`);
    }
    
    // Show status breakdown
    const statusCounts: Record<string, number> = {};
    for (const session of sessions) {
      statusCounts[session.status || 'unknown'] = (statusCounts[session.status || 'unknown'] || 0) + 1;
    }
    console.log(`📊 Status breakdown:`, statusCounts);
    console.log('');
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const progress = `[${i + 1}/${sessions.length}]`;
      
      // Check if already has valid data (unless force mode)
      // Consider empty strings and "PENDING" as missing data
      const hasTranscript = session.call_transcript && session.call_transcript.trim() !== '';
      
      // Validate summary - exclude "PENDING" and empty values
      const isValidSummary = (summary: any): boolean => {
        if (!summary) return false;
        if (typeof summary === 'string') {
          const trimmed = summary.trim();
          return trimmed !== '' && trimmed !== '[]' && trimmed !== 'PENDING' && trimmed.toUpperCase() !== 'PENDING';
        }
        if (Array.isArray(summary)) {
          return summary.length > 0;
        }
        return !!summary;
      };
      
      const hasSummary = isValidSummary(session.taalk_ai_summary);
      
      if (!force && hasTranscript && hasSummary) {
        if ((i + 1) % 100 === 0) {
          console.log(`${progress} Skipping ${i + 1} sessions (already have data)...`);
        }
        skippedCount++;
        continue;
      }
      
      // Log which data is missing
      if (!hasTranscript || !hasSummary) {
        const missing = [];
        if (!hasTranscript) missing.push('transcript');
        if (!hasSummary) missing.push('summary');
        if ((i + 1) % 50 === 0 || i < 10) {
          console.log(`${progress} Session ${session.session_id} missing: ${missing.join(', ')}`);
        }
      }
      
      if ((i + 1) % 50 === 0 || i === 0) {
        console.log(`${progress} Processing session ${session.session_id} (status: ${session.status || 'unknown'})...`);
      }
      
      // Fetch from Taalk
      const { transcript, summary, parsedSummary, isIncomplete } = await fetchTranscriptAndSummary(session.taalk_call_id);
      
      // Build update object
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (transcript && (!hasTranscript || force)) {
        updateData.call_transcript = transcript;
      }
      
      // Validate summary before saving - don't save if it's "PENDING" or invalid
      const isValidSummaryData = (summary: any): boolean => {
        if (!summary) return false;
        if (typeof summary === 'string') {
          const trimmed = summary.trim();
          return trimmed !== '' && trimmed !== '[]' && trimmed !== 'PENDING' && trimmed.toUpperCase() !== 'PENDING';
        }
        if (Array.isArray(summary)) {
          return summary.length > 0;
        }
        return !!summary;
      };
      
      // Check if call is incomplete (no summary available from Taalk)
      const hasValidSummary = summary && isValidSummaryData(summary);
      
      // If call is incomplete (404 or empty summary), mark as incomplete
      if (isIncomplete && (!hasSummary || force)) {
        // Mark as incomplete call - this is NOT a failure, just incomplete
        updateData.ai_result = 'INCOMPLETE';
        updateData.ai_result_passed = null; // null means incomplete, not failed
        updateData.taalk_ai_summary = null; // Clear any invalid summary
        // Clear parsed fields too
        updateData.ai_quick_recap = null;
        updateData.ai_result = 'INCOMPLETE';
        if ((i + 1) % 50 === 0 || i < 10) {
          console.log(`  ⚠️ Session ${session.session_id} - Call incomplete (no summary from Taalk API)`);
        }
      } else if (hasValidSummary && (!hasSummary || force)) {
        // We have a valid summary - save it
        updateData.taalk_ai_summary = summary;
        
        // Add parsed fields
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
      
      // Only update if we have new data
      if (Object.keys(updateData).length > 1) {
        const { error: updateError } = await supabaseAdmin
          .from('verification_sessions')
          .update(updateData)
          .eq('session_id', session.session_id);
        
        if (updateError) {
          console.error(`  ❌ Failed to update session ${session.session_id}:`, updateError.message);
          errorCount++;
        } else {
          if ((i + 1) % 50 === 0 || i < 10) {
            console.log(`  ✅ Updated session ${session.session_id} - transcript: ${!!transcript}, summary: ${!!summary}`);
          }
          successCount++;
          updatedCount++;
        }
      } else {
        skippedCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 COMPREHENSIVE BACKFILL COMPLETE!');
    console.log('='.repeat(70));
    console.log(`✅ Successfully updated: ${successCount} sessions`);
    console.log(`⏭️  Skipped (already had data): ${skippedCount} sessions`);
    console.log(`❌ Errors: ${errorCount} sessions`);
    console.log(`📊 Total processed: ${sessions.length} sessions`);
    console.log('='.repeat(70) + '\n');
    
  } catch (error) {
    console.error('❌ Fatal error in backfill:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;
const force = args.includes('--force');

// Run the backfill
backfillAllTranscripts(limit, force)
  .then(() => {
    console.log('✅ Backfill script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backfill script failed:', error);
    process.exit(1);
  });

