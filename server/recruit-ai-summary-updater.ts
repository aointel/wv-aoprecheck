/**
 * Recruit AI Summary Updater
 * 
 * This service periodically checks for recruit candidates with missing AI summaries
 * and attempts to fetch them from the Taalk API. It runs every 5 minutes to catch
 * summaries that may have become available after the initial call.
 * 
 * This ensures AI summaries stay updated even if:
 * - The webhook didn't include the summary
 * - The summary wasn't ready when the call was processed
 * - The poller missed the summary
 */

import { supabaseAdmin } from './supabase';

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

class RecruitAISummaryUpdater {
  private isRunning = false;
  private updateInterval = 3 * 60 * 1000; // 3 minutes (increased frequency to catch summaries faster)
  private intervalId: NodeJS.Timeout | null = null;
  private lastUpdateTime: Date | null = null;
  private processedCandidates = new Set<number>(); // Track candidates we've tried recently

  /**
   * Check if an AI summary is valid
   */
  private isValidAISummary(summary: any): boolean {
    if (!summary) return false;
    const str = String(summary).trim();
    if (str === '' || str === '[]' || str === 'null' || str === 'undefined') return false;
    if (str.length < 10) return false; // Too short to be a real summary
    return true;
  }

  /**
   * Fetch AI summary from Taalk API
   */
  private async fetchAISummaryFromTaalk(sessionId: string): Promise<string | null> {
    if (!sessionId) return null;

    try {
      const summaryUrl = `https://api.taalk.ai/api/calls/${sessionId}/summary?db=michaelmandella`;
      const summaryResponse = await fetch(summaryUrl, {
        headers: { 'Authorization': `Bearer ${taalkApiKey}` }
      });

      if (!summaryResponse.ok) {
        if (summaryResponse.status === 404) {
          return null; // Summary not available yet
        }
        return null;
      }

      const summaryJson = await summaryResponse.json();
      const fetchedSummary = summaryJson.payload?.summary || summaryJson.summary;

      if (!fetchedSummary || fetchedSummary === null || fetchedSummary === undefined) {
        return null;
      }

      let aiSummaryData: string | null = null;
      if (Array.isArray(fetchedSummary)) {
        if (fetchedSummary.length > 0) {
          aiSummaryData = JSON.stringify(fetchedSummary);
        }
      } else if (typeof fetchedSummary === 'string') {
        if (fetchedSummary.trim().length > 0) {
          aiSummaryData = fetchedSummary;
        }
      } else if (typeof fetchedSummary === 'object') {
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
      console.error(`❌ Error fetching AI summary from Taalk API for session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update a single candidate's AI summary
   */
  private async updateCandidateAISummary(candidateId: number, phone: string): Promise<boolean> {
    try {
      // Find VDP call records for this candidate (within last 30 days - increased from 7 days)
      const searchStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const searchEnd = new Date();

      // Normalize phone number for matching
      const normalizedPhone = phone.replace(/[\s\-+()]/g, '');
      const last10Digits = normalizedPhone.slice(-10);
      
      // Try vdp_calls_BLASTPICK first (has sessionid)
      // Try exact match first
      let { data: vdpCalls, error: vdpError } = await supabaseAdmin
        .from('vdp_calls_BLASTPICK')
        .select('sessionid, leadid, phone, time')
        .eq('phone', phone)
        .ilike('market', '%aorecruit%')
        .gte('time', searchStart.toISOString())
        .lte('time', searchEnd.toISOString())
        .order('time', { ascending: false })
        .limit(5);
      
      // If no exact match, try with normalized phone (last 10 digits)
      if ((!vdpCalls || vdpCalls.length === 0) && last10Digits.length === 10) {
        const { data: normalizedCalls } = await supabaseAdmin
          .from('vdp_calls_BLASTPICK')
          .select('sessionid, leadid, phone, time')
          .ilike('phone', `%${last10Digits}%`)
          .ilike('market', '%aorecruit%')
          .gte('time', searchStart.toISOString())
          .lte('time', searchEnd.toISOString())
          .order('time', { ascending: false })
          .limit(5);
        
        if (normalizedCalls && normalizedCalls.length > 0) {
          vdpCalls = normalizedCalls;
        }
      }

      // Also try vdp_calls table (has LeadId from webhook)
      // Try exact match first
      let { data: vdpCallsWebhook, error: vdpWebhookError } = await supabaseAdmin
        .from('vdp_calls')
        .select('leadid, phone, time')
        .eq('phone', phone)
        .ilike('market', '%aorecruit%')
        .gte('time', searchStart.toISOString())
        .lte('time', searchEnd.toISOString())
        .order('time', { ascending: false })
        .limit(5);
      
      // If no exact match, try with normalized phone (last 10 digits)
      if ((!vdpCallsWebhook || vdpCallsWebhook.length === 0) && last10Digits.length === 10) {
        const { data: normalizedWebhookCalls } = await supabaseAdmin
          .from('vdp_calls')
          .select('leadid, phone, time')
          .ilike('phone', `%${last10Digits}%`)
          .ilike('market', '%aorecruit%')
          .gte('time', searchStart.toISOString())
          .lte('time', searchEnd.toISOString())
          .order('time', { ascending: false })
          .limit(5);
        
        if (normalizedWebhookCalls && normalizedWebhookCalls.length > 0) {
          vdpCallsWebhook = normalizedWebhookCalls;
        }
      }

      if (vdpError || vdpWebhookError) {
        return false;
      }

      // Collect all call IDs to try
      const callIds: string[] = [];
      if (vdpCalls) {
        vdpCalls.forEach(call => {
          if (call.sessionid && !callIds.includes(call.sessionid)) callIds.push(call.sessionid);
          if (call.leadid && !callIds.includes(call.leadid)) callIds.push(call.leadid);
        });
      }
      if (vdpCallsWebhook) {
        vdpCallsWebhook.forEach(call => {
          if (call.leadid && !callIds.includes(call.leadid)) callIds.push(call.leadid);
        });
      }

      if (callIds.length === 0) {
        return false;
      }

      // Try each call ID until we find a summary
      for (const callId of callIds) {
        const aiSummary = await this.fetchAISummaryFromTaalk(callId);
        
        if (aiSummary) {
          // Update candidate with AI summary
          const { error: updateError } = await supabaseAdmin
            .from('recruit_candidates')
            .update({
              ai_summary: aiSummary,
              updated_at: new Date().toISOString()
            })
            .eq('id', candidateId);

          if (!updateError) {
            console.log(`✅ AI Summary updated for candidate ${candidateId} (${phone})`);
            return true;
          }
        }

        // Rate limiting: wait 100ms between API calls
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return false;
    } catch (error) {
      console.error(`❌ Error updating AI summary for candidate ${candidateId}:`, error);
      return false;
    }
  }

  /**
   * Check and update missing AI summaries
   */
  private async checkAndUpdateSummaries(): Promise<void> {
    if (this.isRunning) {
      console.log('⏭️ AI Summary updater already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.lastUpdateTime = new Date();

    try {
      console.log('🔍 Checking for recruit candidates with missing AI summaries...');

      // Find candidates created in the last 30 days without valid AI summaries (increased from 7 days)
      // This ensures we catch summaries that may have become available later
      const searchStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const { data: candidates, error } = await supabaseAdmin
        .from('recruit_candidates')
        .select('id, first_name, last_name, phone, ai_summary, created_at')
        .gte('created_at', searchStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(500); // Process up to 500 candidates per run (increased from 100 to catch more missing summaries)

      if (error) {
        console.error('❌ Error fetching candidates:', error);
        return;
      }

      if (!candidates || candidates.length === 0) {
        console.log('✅ No recent candidates to check');
        return;
      }

      // Filter to only candidates without valid summaries
      const candidatesNeedingSummaries = candidates.filter(c => {
        // Skip if we've tried this candidate recently (within last 30 minutes)
        if (this.processedCandidates.has(c.id)) {
          return false;
        }
        return !this.isValidAISummary(c.ai_summary);
      });

      if (candidatesNeedingSummaries.length === 0) {
        console.log('✅ All recent candidates have valid AI summaries');
        return;
      }

      console.log(`📊 Found ${candidatesNeedingSummaries.length} candidates needing AI summaries`);

      let updated = 0;
      let notFound = 0;
      for (const candidate of candidatesNeedingSummaries) {
        console.log(`  🔍 Processing candidate ${candidate.id}: ${candidate.first_name} ${candidate.last_name} (${candidate.phone})`);
        const success = await this.updateCandidateAISummary(candidate.id, candidate.phone);
        if (success) {
          updated++;
          console.log(`  ✅ Successfully updated candidate ${candidate.id}`);
        } else {
          notFound++;
          console.log(`  ⚠️ Could not find AI summary for candidate ${candidate.id}`);
        }
        
        // Mark as processed (will be cleared after 2 hours)
        this.processedCandidates.add(candidate.id);
        
        // Small delay between candidates
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`✅ Updated ${updated} of ${candidatesNeedingSummaries.length} candidates with AI summaries`);
      if (notFound > 0) {
        console.log(`⚠️ Could not find AI summaries for ${notFound} candidates (may not be available yet)`);
      }

      // Clean up processed candidates set periodically (clear after 2 hours)
      // Limit set size to prevent memory issues
      if (this.processedCandidates.size > 1000) {
        this.processedCandidates.clear();
        console.log('  🧹 Cleared processed candidates cache (size limit reached)');
      }

    } catch (error) {
      console.error('❌ Error in AI summary updater:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the updater
   */
  public start(): void {
    if (this.intervalId) {
      console.log('⚠️ AI Summary updater already started');
      return;
    }

    console.log('🚀 Starting Recruit AI Summary Updater (runs every 5 minutes)');
    
    // Run immediately on start
    this.checkAndUpdateSummaries();
    
    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.checkAndUpdateSummaries();
    }, this.updateInterval);
  }

  /**
   * Stop the updater
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Stopped Recruit AI Summary Updater');
    }
  }

  /**
   * Get status
   */
  public getStatus(): { isRunning: boolean; lastUpdateTime: Date | null; updateInterval: number } {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime,
      updateInterval: this.updateInterval
    };
  }
}

export const recruitAISummaryUpdater = new RecruitAISummaryUpdater();
