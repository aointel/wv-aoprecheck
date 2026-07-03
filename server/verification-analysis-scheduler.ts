import cron, { ScheduledTask } from 'node-cron';
import fetch from 'node-fetch';
import { verificationScreenshotValidator } from './verification-screenshot-validator';
import { verificationAudioAnalyzer } from './verification-audio-analyzer';
import { supabaseAdmin } from './supabase';
import { SUPABASE_URL } from './hardcoded-config';

export class VerificationAnalysisScheduler {
  private static instance: VerificationAnalysisScheduler;
  private cronJob: ScheduledTask | null = null;
  private isRunning: boolean = false;

  private constructor() {}

  static getInstance(): VerificationAnalysisScheduler {
    if (!VerificationAnalysisScheduler.instance) {
      VerificationAnalysisScheduler.instance = new VerificationAnalysisScheduler();
    }
    return VerificationAnalysisScheduler.instance;
  }

  /**
   * Start the verification analysis scheduler
   * Runs every hour to analyze unprocessed verification sessions (AI summaries for AO Precheck)
   */
  start(): void {
    if (this.isRunning) {
      console.log('🔄 Verification analysis scheduler already running');
      return;
    }

    // ✅ FIXED: Schedule to run every hour for AI summary analysis
    this.cronJob = cron.schedule(
      '0 * * * *',  // Every hour at minute 0
      async () => {
        console.log('⏰ Hourly AI analysis scheduler triggered');
        await this.runAnalysisProcess();
      },
      {
        timezone: 'America/New_York'
      }
    );

    this.isRunning = true;
    console.log('✅ Verification analysis scheduler started - analyzing AI summaries every hour');

    // Run initial analysis immediately after 10 seconds
    setTimeout(() => {
      console.log('🚀 Running initial AI analysis on startup...');
      this.runAnalysisProcess();
    }, 10000);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('⏸️ Verification analysis scheduler stopped');
  }

  /**
   * Run the analysis process
   */
  private async runAnalysisProcess(): Promise<void> {
    console.log('\n🤖 Starting automatic verification analysis...');
    
    try {
      await this.analyzeScreenshots();
      
      // Analyze audio recordings that haven't been analyzed yet
      await this.analyzeAudio();
      
      console.log('✅ Automatic verification analysis complete\n');
    } catch (error) {
      console.error('❌ Error in verification analysis process:', error);
    }
  }

  /**
   * Analyze unprocessed screenshots
   * Made public so it can be called immediately after screenshot upload
   */
  async analyzeScreenshots(): Promise<void> {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured for screenshot analysis');
      return;
    }

    try {
      const BATCH_SIZE = 25;
      let processed = 0;
      const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops
      let iterations = 0;

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        // Find sessions with screenshots that haven't been analyzed yet
        // ✅ FIXED: Query finds sessions with actual screenshots (not 'PENDING')
        // Get all sessions with screenshots, then filter in JavaScript for better control
        // ✅ FIXED: Removed retry_count check from query (column might not exist)
        // Will filter in JavaScript instead
        const { data: allSessions, error } = await supabaseAdmin
          .from('verification_sessions')
          .select('*')
          .or('screenshot_url.not.is.null,screenshot_path.not.is.null')  // Has screenshot_url OR screenshot_path
          .order('created_at', { ascending: false })
          .limit(BATCH_SIZE * 5); // Fetch more to account for filtering

        if (error) {
          console.error('❌ Error fetching sessions for screenshot analysis:', error);
          return;
        }

        if (!allSessions || allSessions.length === 0) {
          if (processed === 0) {
            console.log('📸 No sessions needing screenshot analysis');
          } else {
            console.log(`📸 Screenshot analysis complete. Processed ${processed} session(s).`);
          }
          break; // Exit loop when no more sessions
        }

        // ✅ FIXED: Filter to only unanalyzed sessions with ACTUAL screenshots (not 'PENDING')
        const sessions = allSessions.filter(session => {
          // Must have actual screenshot URL/path (not 'PENDING' or NULL)
          const hasScreenshot = (session.screenshot_url && 
                                 session.screenshot_url !== 'PENDING' && 
                                 session.screenshot_url.trim() !== '') ||
                                (session.screenshot_path && 
                                 session.screenshot_path !== 'PENDING' && 
                                 session.screenshot_path.trim() !== '');
          
          // Must not be already analyzed
          const needsAnalysis = session.screenshot_analysis_complete === null || 
                                session.screenshot_analysis_complete === false;
          
          // Must not have exceeded retry limit (if column exists)
          const retryCount = session.screenshot_analysis_retry_count ?? 0;
          const canRetry = retryCount < 1;
          
          return hasScreenshot && needsAnalysis && canRetry;
        });

        if (sessions.length === 0) {
          if (processed === 0) {
            console.log('📸 No sessions needing screenshot analysis');
          } else {
            console.log(`📸 Screenshot analysis complete. Processed ${processed} session(s).`);
          }
          break; // Exit loop when no more sessions
        }

        console.log(`📸 Processing ${sessions.length} session(s) for screenshot analysis`);

        for (const session of sessions) {
          // SAFETY CHECK: Skip if already analyzed to prevent duplicate API calls
          if (session.screenshot_analysis_complete === true) {
            console.log(`  ⏭️  Skipping session ${session.id} - already analyzed`);
            continue;
          }

          // MAX RETRY = 1: Skip if already retried once
          const retryCount = session.screenshot_analysis_retry_count || 0;
          if (retryCount >= 1) {
            console.log(`  ⏭️  Skipping session ${session.id} - already retried once (retry_count: ${retryCount})`);
            continue;
          }

          processed += 1;
        try {
          console.log(`  Processing screenshot for session ${session.id} - ${session.agent_email || session.company_email}`);

          const screenshotDataUrl = await this.fetchScreenshotDataUrl(session);
          if (!screenshotDataUrl) {
            console.warn(`  ⚠️ No screenshot available for session ${session.id}`);
            await supabaseAdmin
              .from('verification_sessions')
              .update({
                screenshot_validation: {
                  issues: ['Missing required screenshot'],
                  reason: 'NO SCREENSHOT PROVIDED - Screenshot is required for all verifications',
                  isValid: false,
                  confidence: 1,
                  validationType: 'invalid',
                  detectedElements: {
                    hasZoomUI: false,
                    isInPerson: false,
                    peopleCount: 0,
                    imageQuality: 'unusable',
                    hasFaceTimeUI: false,
                    hasWhatsAppUI: false,
                    hasMultiplePeople: false,
                    hasOtherVideoCallUI: false,
                    hasVideoCallInterface: false
                  }
                },
                screenshot_analysis_complete: true,
                screenshot_analysis_confidence: 0
              })
              .eq('id', session.id);
            continue;
          }

          console.log(`  🤖 Analyzing screenshot with AI...`);
          const validation = await verificationScreenshotValidator.validateScreenshot(
            screenshotDataUrl,
            session.verification_method || 'zoom'
          );

          if (!validation) {
            console.error(`  ❌ Screenshot validation returned null/undefined for session ${session.id}`);
            continue;
          }

          console.log(`  💾 Saving analysis results to database...`);
          // CRITICAL: Verify the update actually worked to prevent re-analysis
          const { error: updateError, data: updatedRows } = await supabaseAdmin
            .from('verification_sessions')
            .update({ 
              screenshot_validation: validation,
              screenshot_analysis_complete: true,
              screenshot_analysis_confidence: validation?.confidence ?? 0,
              verification_result: validation.isValid ? 'COMPLETED' : 'FAILED',
              screenshot_analysis_retry_count: 0  // Reset retry count on success
            })
            .eq('id', session.id)
            .select('id, screenshot_analysis_complete');

          if (updateError) {
            console.error(`  ❌ CRITICAL: Failed to save screenshot analysis to database for session ${session.id}:`, updateError);
            console.error(`     This session will be re-analyzed on next run!`);
            throw updateError; // Re-throw to prevent continuing
          }

          if (!updatedRows || updatedRows.length === 0) {
            console.error(`  ❌ CRITICAL: No rows updated for session ${session.id} - session may not exist`);
            console.error(`     This session will be re-analyzed on next run!`);
          } else {
            console.log(`  ✅ Screenshot analyzed and MARKED COMPLETE: ${validation.isValid ? 'VALID' : 'INVALID'} (${(validation.confidence * 100).toFixed(0)}% confidence)`);
          }
          
          // Rate limiting: Wait 2 seconds between API calls to prevent hammering OpenAI
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          console.error(`  ❌ Failed to analyze screenshot for session ${session.id}:`, error);
          console.error(`     Error details:`, error.message);
          if (error.stack) {
            console.error(`     Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
          }
          
          // MAX RETRY = 1: Increment retry count on failure
          const currentRetryCount = session.screenshot_analysis_retry_count || 0;
          const newRetryCount = currentRetryCount + 1;
          
          // Update retry count in database
          await supabaseAdmin
            .from('verification_sessions')
            .update({ 
              screenshot_analysis_retry_count: newRetryCount
            })
            .eq('id', session.id);
          
          if (newRetryCount >= 1) {
            console.log(`  ⚠️  Session ${session.id} marked as failed after ${newRetryCount} retry attempt(s). Will not retry again.`);
          }
          
          // Don't continue processing this session - it won't be retried again due to retry_count check
        }
        }

        // Safety check: If we've hit max iterations, log warning and break
        if (iterations >= MAX_ITERATIONS) {
          console.warn(`⚠️  Reached maximum iterations (${MAX_ITERATIONS}) for screenshot analysis. Stopping to prevent infinite loop.`);
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error in screenshot analysis:', error);
    }
  }

  /**
   * Analyze unprocessed audio recordings
   */
  private async analyzeAudio(): Promise<void> {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured for audio analysis');
      return;
    }

    try {
      const BATCH_SIZE = 10;
      let processed = 0;
      const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops
      let iterations = 0;
      const processedSessionIds = new Set<string>(); // Track processed sessions to prevent duplicates

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        // CRITICAL: Fetch sessions with EITHER recording_url OR call_transcript that need analysis
        // Many sessions have call_transcript from Taalk but no audio_analysis
        // Note: Empty/[]/PENDING transcripts filtered in code via hasValidTranscript - avoid call_transcript.neq.[] on text column
        const { data: sessions, error } = await supabaseAdmin
          .from('verification_sessions')
          .select('*')
          .or('and(recording_url.not.is.null,recording_url.neq.PENDING),and(call_transcript.not.is.null,call_transcript.neq.PENDING)')  // Has recording OR transcript
          .or('call_analysis_complete.is.null,call_analysis_complete.eq.false')  // Only get unprocessed sessions
          .or('audio_analysis_retry_count.is.null,audio_analysis_retry_count.lt.1')  // MAX RETRY = 1: Only retry once
          .order('created_at', { ascending: false })
          .limit(BATCH_SIZE);

        if (error) {
          console.error('❌ Error fetching sessions for audio analysis:', error);
          return;
        }

        if (!sessions || sessions.length === 0) {
          if (processed === 0) {
            console.log('🎵 No sessions needing audio analysis');
          } else {
            console.log(`🎵 Audio analysis complete. Processed ${processed} session(s).`);
          }
          break; // Exit loop when no more sessions
        }

        // Safety check: If we've processed sessions but they're all duplicates, break
        const newSessions = sessions.filter(s => !processedSessionIds.has(s.id) && (s.call_analysis_complete !== true || s.audio_analysis === null));
        if (newSessions.length === 0) {
          console.log(`🎵 All remaining sessions already processed. Stopping.`);
          break;
        }

        console.log(`🎵 Processing ${sessions.length} session(s) for audio analysis`);

        for (const session of sessions) {
          // SAFETY CHECK: Skip if already processed in this run to prevent duplicate API calls
          if (processedSessionIds.has(session.id)) {
            console.log(`  ⏭️  Skipping session ${session.id} - already processed in this run`);
            continue;
          }

          // SAFETY CHECK: Skip if already analyzed to prevent duplicate API calls
          if (session.call_analysis_complete === true && session.audio_analysis !== null) {
            console.log(`  ⏭️  Skipping session ${session.id} - already analyzed`);
            continue;
          }

          // MAX RETRY = 1: Skip if already retried once
          const retryCount = session.audio_analysis_retry_count || 0;
          if (retryCount >= 1) {
            console.log(`  ⏭️  Skipping session ${session.id} - already retried once (retry_count: ${retryCount})`);
            continue;
          }

          processedSessionIds.add(session.id);
          processed += 1;
        try {
          console.log(`  Processing audio for session ${session.id} - ${session.agent_email || session.company_email}`);
          
          let analysis;
          
          // CRITICAL: If we have call_transcript but no recording_url, analyze the transcript directly
          // Don't require recording_url - many sessions have transcripts from Taalk but no audio file
          const hasValidTranscript = session.call_transcript && 
            session.call_transcript.trim() !== '' && 
            session.call_transcript.trim() !== '[]' &&
            session.call_transcript.trim().toUpperCase() !== 'PENDING';
          const hasRecordingUrl = session.recording_url && session.recording_url !== 'PENDING';
          
          if (hasValidTranscript && !hasRecordingUrl) {
            console.log(`  📝 Session has transcript but no recording_url - analyzing transcript directly...`);
            const transcriptAnalysis = await verificationAudioAnalyzer.analyzeTranscript(
              session.call_transcript,
              (session.verification_method || 'phone') as 'zoom' | 'phone' | 'conference'
            );
            
            // Convert to full analysis format
            analysis = {
              transcript: session.call_transcript,
              ...transcriptAnalysis,
              confidence: transcriptAnalysis.validation?.confidence ?? 0,
              isLegitimate: transcriptAnalysis.validation?.isValid ?? false,
              analyzedAt: new Date().toISOString()
            };
          } else if (hasRecordingUrl) {
            // Has recording URL - download and analyze
            analysis = await verificationAudioAnalyzer.analyzeAudioFromUrl(
              session.recording_url,
              session.verification_method || 'phone'
            );
          } else {
            console.log(`  ⚠️  Session has neither valid recording_url nor call_transcript - skipping`);
            continue;
          }

          const confidence =
            analysis.validation?.confidence ??
            analysis.confidence ??
            0;

          // CRITICAL: Extract summary and transcript to individual fields for frontend display
          // The frontend looks for these specific fields, not just the audio_analysis JSONB
          const updateData: any = {
            audio_analysis: analysis,
            call_analysis_complete: true,
            verification_result: analysis.isLegitimate ? 'COMPLETED' : 'FAILED',
            audio_analysis_retry_count: 0,  // Reset retry count on success
            // CRITICAL: Extract summary fields for frontend - these are what the UI looks for
            call_transcript: analysis.transcript || session.call_transcript || null,
            taalk_ai_summary: analysis.summary || null,
            ai_quick_recap: analysis.summary || null,  // Use summary as quick recap
            ai_result: analysis.validation?.reason || null,
            ai_result_passed: analysis.validation?.isValid ?? null
          };

          // CRITICAL: Verify the update actually worked to prevent re-analysis
          const { error: updateError, data: updatedRows } = await supabaseAdmin
            .from('verification_sessions')
            .update(updateData)
            .eq('id', session.id)
            .select('id, call_analysis_complete');

          if (updateError) {
            console.error(`  ❌ CRITICAL: Failed to save audio analysis to database for session ${session.id}:`, updateError);
            console.error(`     This session will be re-analyzed on next run!`);
            // Remove from processed set so it can be retried
            processedSessionIds.delete(session.id);
            throw updateError; // Re-throw to prevent continuing
          }

          if (!updatedRows || updatedRows.length === 0) {
            console.error(`  ❌ CRITICAL: No rows updated for session ${session.id} - session may not exist`);
            console.error(`     This session will be re-analyzed on next run!`);
            // Remove from processed set so it can be retried
            processedSessionIds.delete(session.id);
          } else {
            console.log(`  ✅ Audio analyzed and MARKED COMPLETE: ${analysis.isLegitimate ? 'LEGITIMATE' : 'SUSPICIOUS'} (${analysis.confidence} confidence)`);
          }
          
          // Rate limiting: Wait 3 seconds between audio API calls (Whisper + GPT = 2 API calls per session)
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error: any) {
          console.error(`  ❌ Failed to analyze audio for session ${session.id}:`, error.message);
          
          // MAX RETRY = 1: Increment retry count on failure
          const currentRetryCount = session.audio_analysis_retry_count || 0;
          const newRetryCount = currentRetryCount + 1;
          
          // Update retry count in database
          await supabaseAdmin
            .from('verification_sessions')
            .update({ 
              audio_analysis_retry_count: newRetryCount
            })
            .eq('id', session.id);
          
          if (newRetryCount >= 1) {
            console.log(`  ⚠️  Session ${session.id} marked as failed after ${newRetryCount} retry attempt(s). Will not retry again.`);
          }
          
          // Remove from processed set on error - but it won't be retried again due to retry_count check
          processedSessionIds.delete(session.id);
        }
        }

        // Safety check: If we've hit max iterations, log warning and break
        if (iterations >= MAX_ITERATIONS) {
          console.warn(`⚠️  Reached maximum iterations (${MAX_ITERATIONS}) for audio analysis. Stopping to prevent infinite loop.`);
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error in audio analysis:', error);
    }
  }

  /**
   * Re-run AO precheck screenshot analysis for sessions from a given date.
   * @param sinceDate ISO date string (e.g. '2026-02-07')
   * @param options delayMs between API calls (default 3000), batchSize (default 10)
   */
  async runScreenshotAnalysisFromDate(
    sinceDate: string,
    options: { delayMs?: number; batchSize?: number } = {}
  ): Promise<{ processed: number; failed: number }> {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return { processed: 0, failed: 0 };
    }
    const delayMs = options.delayMs ?? 3000;
    const BATCH_SIZE = options.batchSize ?? 10;
    const since = new Date(sinceDate);
    since.setHours(0, 0, 0, 0);
    const sinceStr = since.toISOString();
    let processed = 0;
    let failed = 0;
    const MAX_ITERATIONS = 200;
    const processedSessionIds = new Set<string>();
    const pageSize = BATCH_SIZE * 3;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const offset = iter * pageSize;
      const { data: allSessions, error } = await supabaseAdmin
        .from('verification_sessions')
        .select('*')
        .gte('created_at', sinceStr)
        .or('screenshot_url.not.is.null,screenshot_path.not.is.null')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error || !allSessions?.length) {
        if (processed === 0 && iter === 0) console.log('📸 No sessions needing screenshot analysis from', sinceDate);
        break;
      }

      const sessions = allSessions.filter((session: any) => {
        const hasScreenshot = (session.screenshot_url && session.screenshot_url !== 'PENDING' && session.screenshot_url.trim() !== '') ||
          (session.screenshot_path && session.screenshot_path !== 'PENDING' && session.screenshot_path.trim() !== '');
        const needsAnalysis = session.screenshot_analysis_complete === null || session.screenshot_analysis_complete === false;
        return hasScreenshot && needsAnalysis && !processedSessionIds.has(session.id);
      });

      if (sessions.length === 0) break;

      console.log(`📸 [from ${sinceDate}] Processing ${sessions.length} screenshot(s) (delay ${delayMs}ms)...`);
      for (const session of sessions) {
        processedSessionIds.add(session.id);
        try {
          console.log(`  Session ${session.id} - ${session.agent_email || session.company_email}`);
          const screenshotDataUrl = await this.fetchScreenshotDataUrl(session);
          if (!screenshotDataUrl) {
            await supabaseAdmin.from('verification_sessions').update({
              screenshot_validation: { issues: ['Missing required screenshot'], isValid: false, confidence: 1 },
              screenshot_analysis_complete: true,
              screenshot_analysis_confidence: 0
            }).eq('id', session.id);
            processed++;
            continue;
          }
          const validation = await verificationScreenshotValidator.validateScreenshot(
            screenshotDataUrl,
            session.verification_method || 'zoom'
          );
          if (!validation) throw new Error('Validation returned null');
          const { error: updateError } = await supabaseAdmin
            .from('verification_sessions')
            .update({
              screenshot_validation: validation,
              screenshot_analysis_complete: true,
              screenshot_analysis_confidence: validation?.confidence ?? 0,
              screenshot_analysis_retry_count: 0,
              verification_result: validation.isValid ? 'COMPLETED' : 'FAILED'
            })
            .eq('id', session.id);
          if (updateError) throw updateError;
          processed++;
          console.log(`  ✅ ${session.id} - ${validation.isValid ? 'VALID' : 'INVALID'}`);
        } catch (e: any) {
          failed++;
          console.error(`  ❌ ${session.id}:`, e?.message || e);
          const retryCount = (session.screenshot_analysis_retry_count ?? 0) + 1;
          await supabaseAdmin.from('verification_sessions').update({ screenshot_analysis_retry_count: retryCount }).eq('id', session.id);
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    console.log(`✅ AO precheck screenshot analysis from ${sinceDate} complete. Processed: ${processed}, Failed: ${failed}`);
    return { processed, failed };
  }

  /**
   * Re-run AO precheck audio analysis for sessions from a given date (e.g. after API was exceeded).
   * Uses longer delay between calls to avoid rate limits.
   * @param sinceDate ISO date string (e.g. '2026-02-07'); only sessions with created_at >= this are processed
   * @param options delayMs between API calls (default 6000), batchSize (default 5)
   */
  async runAudioAnalysisFromDate(
    sinceDate: string,
    options: { delayMs?: number; batchSize?: number } = {}
  ): Promise<{ processed: number; failed: number }> {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return { processed: 0, failed: 0 };
    }
    const delayMs = options.delayMs ?? 6000;
    const BATCH_SIZE = options.batchSize ?? 5;
    const since = new Date(sinceDate);
    since.setHours(0, 0, 0, 0);
    const sinceStr = since.toISOString();
    let processed = 0;
    let failed = 0;
    const MAX_ITERATIONS = 200;
    const processedSessionIds = new Set<string>();

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const offset = iter * BATCH_SIZE;
      const { data: sessions, error } = await supabaseAdmin
        .from('verification_sessions')
        .select('*')
        .gte('created_at', sinceStr)
        .or('and(recording_url.not.is.null,recording_url.neq.PENDING),and(call_transcript.not.is.null,call_transcript.neq.PENDING)')
        .or('call_analysis_complete.is.null,call_analysis_complete.eq.false')
        .or('audio_analysis_retry_count.is.null,audio_analysis_retry_count.lt.1')
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);

      if (error || !sessions?.length) {
        if (processed === 0 && iter === 0) console.log('🎵 No sessions needing audio analysis from', sinceDate);
        break;
      }

      const toProcess = sessions.filter(
        (s: any) => !processedSessionIds.has(s.id) && (s.call_analysis_complete !== true || s.audio_analysis == null) && (s.audio_analysis_retry_count ?? 0) < 1
      );
      if (toProcess.length === 0) break;

      console.log(`🎵 [from ${sinceDate}] Processing ${toProcess.length} session(s) (delay ${delayMs}ms between calls)...`);
      for (const session of toProcess) {
        processedSessionIds.add(session.id);
        try {
          console.log(`  Session ${session.id} - ${session.agent_email || session.company_email}`);
          let analysis: any;
          const hasValidTranscript = session.call_transcript?.trim() && session.call_transcript.trim() !== '[]' && session.call_transcript.trim().toUpperCase() !== 'PENDING';
          const hasRecordingUrl = session.recording_url && session.recording_url !== 'PENDING';
          if (hasValidTranscript && !hasRecordingUrl) {
            analysis = {
              transcript: session.call_transcript,
              ...(await verificationAudioAnalyzer.analyzeTranscript(session.call_transcript, (session.verification_method || 'phone') as 'zoom' | 'phone' | 'conference')),
              analyzedAt: new Date().toISOString()
            };
            analysis.confidence = analysis.validation?.confidence ?? 0;
            analysis.isLegitimate = analysis.validation?.isValid ?? false;
          } else if (hasRecordingUrl) {
            analysis = await verificationAudioAnalyzer.analyzeAudioFromUrl(session.recording_url, session.verification_method || 'phone');
          } else {
            continue;
          }
          const { error: updateError } = await supabaseAdmin
            .from('verification_sessions')
            .update({
              audio_analysis: analysis,
              call_analysis_complete: true,
              verification_result: analysis.isLegitimate ? 'COMPLETED' : 'FAILED',
              audio_analysis_retry_count: 0,
              call_transcript: analysis.transcript || session.call_transcript || null,
              taalk_ai_summary: analysis.summary || null,
              ai_quick_recap: analysis.summary || null,
              ai_result: analysis.validation?.reason || null,
              ai_result_passed: analysis.validation?.isValid ?? null
            })
            .eq('id', session.id);
          if (updateError) throw updateError;
          processed++;
          console.log(`  ✅ ${session.id} - ${analysis.isLegitimate ? 'LEGITIMATE' : 'SUSPICIOUS'}`);
        } catch (e: any) {
          failed++;
          console.error(`  ❌ ${session.id}:`, e?.message || e);
          const retryCount = (session.audio_analysis_retry_count ?? 0) + 1;
          await supabaseAdmin.from('verification_sessions').update({ audio_analysis_retry_count: retryCount }).eq('id', session.id);
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    console.log(`✅ AO precheck audio analysis from ${sinceDate} complete. Processed: ${processed}, Failed: ${failed}`);
    return { processed, failed };
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }

  private resolveStorageReference(value?: string | null): { bucket: string; object: string } | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'PENDING') return null;

    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      const objectIndex = segments.indexOf('object');
      if (objectIndex !== -1 && objectIndex + 1 < segments.length) {
        let idx = objectIndex + 1;
        if (['sign', 'public', 'render'].includes(segments[idx])) {
          idx += 1;
        }
        if (idx >= segments.length) return null;
        const bucket = segments[idx];
        const object = segments.slice(idx + 1).join('/');
        return bucket && object ? { bucket, object } : null;
      }
    } catch {
      // Not a URL, fall through
    }

    const cleaned = trimmed.replace(/^\/+/, '');
    const parts = cleaned.split('/');
    if (parts.length < 2) return null;
    const bucket = parts.shift()!;
    const object = parts.join('/');
    return bucket && object ? { bucket, object } : null;
  }

  private async fetchScreenshotDataUrl(session: any): Promise<string | null> {
    if (!supabaseAdmin) return null;

    const sources: Array<string | null | undefined> = [session.screenshot_path, session.screenshot_url];

    for (const source of sources) {
      if (!source || source === 'PENDING') continue;

      let urlToFetch = source;

      const ref = this.resolveStorageReference(source);
      if (ref) {
        try {
          const { data, error } = await supabaseAdmin
            .storage
            .from(ref.bucket)
            .createSignedUrl(ref.object, 300);
          if (!error && data?.signedUrl) {
            urlToFetch = data.signedUrl;
          } else if (!urlToFetch.startsWith('http')) {
            const baseUrl = SUPABASE_URL || process.env.SUPABASE_URL;
            if (baseUrl) {
              urlToFetch = `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${ref.bucket}/${ref.object}`;
            }
          }
        } catch (error) {
          console.warn(`  ⚠️ Failed to generate signed URL for ${session.session_id}:`, error);
        }
      }

      try {
        const response = await fetch(urlToFetch);
        if (!response.ok) {
          throw new Error(`Screenshot download failed (${response.status})`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
        return dataUri;
      } catch (error) {
        console.warn(`  ⚠️ Unable to download screenshot from ${urlToFetch}:`, error instanceof Error ? error.message : error);
      }
    }

    return null;
  }
}

// Export singleton instance
export const verificationAnalysisScheduler = VerificationAnalysisScheduler.getInstance();

