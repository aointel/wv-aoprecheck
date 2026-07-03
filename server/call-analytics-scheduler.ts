/**
 * Call Analytics Scheduler
 * Automatically analyzes Taalk transfer calls from vdp_calls table
 * Downloads recordings/transcripts from Taalk API and runs AI analysis
 */

import * as cron from 'node-cron';
import { supabaseAdmin } from './supabase';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config';
import { uploadTranscriptToSupabase } from './call-analytics-transcript-upload';
import { applyInstantPresentationDurationRule } from './call-analytics-analyzer';

const taalkApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ0YWFsay4zN2RhMGU2NS1kMGVjLTQxYWYtOGQzYi03MWRjNTJiNGNiMmYiLCJuYW1lIjoidGFhbGsiLCJleHAiOjIwNTUwMzU2OTJ9.Ywh89Z0PvELHylJReZo8KPOiL7xX21BoBYe16OZfJw4";

class CallAnalyticsScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private batchSize = 10; // Process up to 10 per run (throttle OpenAI usage - REDUCED from 100)
  private readonly pageSize = 1000; // Supabase max per request
  private readonly concurrency = 2; // Analyze up to 2 in parallel (REDUCED from 5 to prevent API hammering)

  /**
   * Start the scheduler
   */
  start(): void {
    if (!supabaseAdmin) {
      console.warn('⚠️ Call Analytics Scheduler disabled - Supabase admin client not configured');
      return;
    }

    if (this.cronJob) {
      console.log('⚠️ Call Analytics Scheduler already running');
      return;
    }

    console.log('🚀 Starting Call Analytics Scheduler...');

    // Run immediately on startup - last 7 days (catches backlog + today)
    this.processPendingCalls(7).catch(error => {
      console.error('❌ Initial call analytics processing failed:', error);
    });

    // FIXED: Run every 5 minutes instead of every 10 seconds to prevent API hammering
    // Each call makes 2 OpenAI API calls (Whisper + GPT), so 10 calls = 20 API calls per run
    this.intervalId = setInterval(() => {
      if (!this.isRunning) {
        this.processPendingCalls(7).catch(e => console.error('❌ Call analytics batch:', e?.message));
      }
    }, 300000); // 5 minutes = 300,000ms (was 10,000ms = 10 seconds)

    // FIXED: Cron backup every 10 minutes instead of every minute
    this.cronJob = cron.schedule('*/10 * * * *', async () => {
      if (!this.isRunning) {
        await this.processPendingCalls(7);
      }
    });

    console.log('✅ Call Analytics Scheduler started - batch every 5min (max 10 calls), cron every 10min, last 7 days');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    console.log('🛑 Call Analytics Scheduler stopped');
  }

  /** Run tasks with concurrency limit; each returns a number (e.g. 1=success, 0=fail); returns sum. */
  private async runWithConcurrency<T>(items: T[], fn: (item: T) => Promise<number>): Promise<number> {
    let total = 0;
    for (let i = 0; i < items.length; i += this.concurrency) {
      const chunk = items.slice(i, i + this.concurrency);
      const results = await Promise.all(chunk.map(fn));
      total += results.reduce((a, b) => a + b, 0);
    }
    return total;
  }

  /**
   * Process pending calls that need analysis
   * @param daysBack - Number of days to look back (default: 7, use null for all)
   */
  public async processPendingCalls(daysBack: number = 0): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Call analytics processing already running, skipping...');
      return;
    }

    this.isRunning = true;
    const label = daysBack === 0 ? 'TODAY ONLY' : `last ${daysBack} days`;
    console.log(`🔄 Starting call analytics batch processing (${label})...`);

    try {
      // 1) Move calls into taalk_call_analytics: insert missing rows from twilio_call_logs (no analysis)
      await this.ensureTwilioCallsInAnalyticsTable(daysBack, this.batchSize * 2);
      // 2) Sync call_duration from twilio_call_logs so Transfer Calls shows duration (CCPRO rows created early lack it)
      await this.fillCcproCallDurations(daysBack, this.batchSize * 2);
      // 3) Fill recording_url for pending twilio-* rows from twilio_call_logs (no analysis)
      await this.fillCcproRecordingUrls(daysBack, this.batchSize * 2);
      // 4) Only analyze from taalk_call_analytics (single analysis path)
      await this.processPendingTaalkCallAnalyticsRows(daysBack, this.batchSize, false);
    } catch (error: any) {
      console.error('❌ Error in call analytics processing:', error);
      console.error('Stack:', error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process vdp_calls directly if billing transactions are missing
   */
  private async processVdpCallsDirectly(daysBack: number | null = 7): Promise<void> {
    try {
      console.log('🔍 Querying vdp_calls directly...');
      
      let query = supabaseAdmin
        .from('vdp_calls')
        .select('id, agent, company_email, phone, time, event, firstname, lastname, sessionID, leadid')
        .eq('event', 'end')
        .order('time', { ascending: false })
        .limit(100);
      
      if (daysBack) {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - daysBack);
        query = query.gte('time', dateLimit.toISOString());
      }

      const { data: vdpCalls, error: vdpError } = await query;

      if (vdpError) {
        console.error('❌ Error fetching vdp_calls:', vdpError);
        return;
      }

      console.log(`📊 Found ${vdpCalls?.length || 0} vdp_calls with event='end'`);

      if (!vdpCalls || vdpCalls.length === 0) {
        console.log('📊 No vdp_calls found');
        return;
      }

      // Filter to only calls with sessionID (Taalk call ID)
      const callsWithSessionID = vdpCalls.filter(c => c.sessionID);
      console.log(`📊 Found ${callsWithSessionID.length} vdp_calls with sessionID (Taalk call ID)`);

      if (callsWithSessionID.length === 0) {
        console.log('⚠️ No vdp_calls have sessionID - cannot find Taalk call ID');
        return;
      }

      // Check which ones are already analyzed
      const sessionIds = callsWithSessionID.map(c => String(c.sessionID));
      const { data: existingAnalyses } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('taalk_call_id, analysis_status')
        .in('taalk_call_id', sessionIds);

      const analyzedSessionIds = new Set(
        (existingAnalyses || [])
          .filter(a => a.analysis_status === 'completed')
          .map(a => a.taalk_call_id)
      );

      // Filter to unanalyzed calls
      const unanalyzedCalls = callsWithSessionID.filter(
        c => !analyzedSessionIds.has(String(c.sessionID))
      ).slice(0, this.batchSize);

      console.log(`📊 Found ${unanalyzedCalls.length} unanalyzed vdp_calls with Taalk call IDs (out of ${callsWithSessionID.length} total)`);

      // Process unanalyzed calls
      for (const vdpCall of unanalyzedCalls) {
        try {
          // Create a mock transaction object
          const transaction = {
            transaction_id: `connect-${vdpCall.id}`,
            agent_email: vdpCall.company_email || 'unknown@aoglobelife.com',
            agent_name: null,
            transaction_date: vdpCall.time || new Date().toISOString(),
            source_id: vdpCall.id,
            source_table: 'vdp_calls',
            metadata: {
              sessionID: vdpCall.sessionID,
              taalk_call_id: String(vdpCall.sessionID) // sessionID IS the Taalk call ID
            }
          };

          console.log(`🔍 Analyzing vdp_call ${vdpCall.id} with Taalk call ID ${vdpCall.sessionID}...`);
          await this.analyzeCall(transaction);
          console.log(`✅ Successfully analyzed vdp_call ${vdpCall.id}`);
        } catch (error: any) {
          console.error(`❌ Failed to analyze vdp_call ${vdpCall.id}:`, error.message);
          console.error(`   Stack: ${error.stack}`);
        }
      }
    } catch (error: any) {
      console.error('❌ Error processing vdp_calls directly:', error);
    }
  }

  /** When daysBack=0 use start of today; otherwise now - N days */
  private getDateLimit(daysBack: number | null): Date {
    const d = new Date();
    if (daysBack === 0) {
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    const safe = daysBack ?? 90;
    d.setDate(d.getDate() - safe);
    return d;
  }

  /**
   * Move Twilio calls into taalk_call_analytics: insert missing rows from twilio_call_logs.
   * Only inserts; does not run analysis. Parent legs only (one row per call).
   */
  private async ensureTwilioCallsInAnalyticsTable(daysBack: number | null = 7, maxRows: number = 500): Promise<number> {
    try {
      const dateLimit = this.getDateLimit(daysBack);
      const { data: tclRows, error: tclErr } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, owner_email, call_started_at, call_duration, recording_url, parent_call_sid')
        .or('call_direction.eq.outbound,call_direction.is.null')
        .in('call_status', ['answered', 'completed'])
        .is('parent_call_sid', null)
        .gte('call_started_at', dateLimit.toISOString())
        .order('call_started_at', { ascending: false })
        .limit(maxRows);
      if (tclErr || !tclRows?.length) return 0;
      const sids = tclRows.map((r: any) => r.twilio_call_sid);
      const { data: existing } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('taalk_call_id')
        .in('taalk_call_id', sids);
      const existingSids = new Set((existing || []).map((r: any) => r.taalk_call_id));
      let inserted = 0;
      for (const tcl of tclRows) {
        if (existingSids.has(tcl.twilio_call_sid)) continue;
        const recUrl = (tcl.recording_url || '').trim();
        const payload: Record<string, unknown> = {
          billing_transaction_id: `twilio-${tcl.twilio_call_sid}`,
          taalk_call_id: tcl.twilio_call_sid,
          agent_email: tcl.owner_email || 'unknown',
          call_date: tcl.call_started_at || new Date().toISOString(),
          call_duration: (tcl.call_duration != null && Number(tcl.call_duration) > 0) ? Number(tcl.call_duration) : null,
          analysis_status: 'pending'
        };
        if (recUrl && recUrl.includes('supabase') && !recUrl.includes('/api/')) payload.recording_url = recUrl;
        const { error: insErr } = await supabaseAdmin.from('taalk_call_analytics').insert(payload);
        if (!insErr) {
          existingSids.add(tcl.twilio_call_sid);
          inserted++;
        }
      }
      if (inserted > 0) console.log(`📊 Ensured ${inserted} Twilio calls in taalk_call_analytics (inserted missing rows)`);
      return inserted;
    } catch (e: any) {
      console.error('❌ ensureTwilioCallsInAnalyticsTable error:', e?.message);
      return 0;
    }
  }

  /**
   * Sync call_duration from twilio_call_logs to taalk_call_analytics for twilio-* rows.
   * CCPRO rows are created early (WebRTC pre-insert) without duration; Twilio sends it later.
   */
  private async fillCcproCallDurations(daysBack: number | null = 7, maxRows: number = 200): Promise<number> {
    try {
      const dateLimit = this.getDateLimit(daysBack);
      const { data: rows, error } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id, taalk_call_id')
        .like('billing_transaction_id', 'twilio-%')
        .or('call_duration.is.null,call_duration.lt.1')
        .gte('call_date', dateLimit.toISOString())
        .order('call_date', { ascending: false })
        .limit(maxRows);
      if (error || !rows?.length) return 0;
      const sids = [...new Set(rows.map((r: any) => r.taalk_call_id).filter(Boolean))];
      const { data: parentRows } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, call_duration')
        .in('twilio_call_sid', sids);
      const { data: childRows } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('parent_call_sid, call_duration')
        .in('parent_call_sid', sids)
        .not('parent_call_sid', 'is', null);
      const durationByParentSid = new Map<string, number>();
      (parentRows || []).forEach((r: any) => {
        const d = Number(r.call_duration);
        if (d > 0) durationByParentSid.set(r.twilio_call_sid, d);
      });
      (childRows || []).forEach((r: any) => {
        const d = Number(r.call_duration);
        const parentSid = (r as any).parent_call_sid;
        if (d > 0 && parentSid) {
          const existing = durationByParentSid.get(parentSid) ?? 0;
          if (d > existing) durationByParentSid.set(parentSid, d);
        }
      });
      let updated = 0;
      for (const row of rows) {
        const sid = (row as any).taalk_call_id;
        const dur = sid ? durationByParentSid.get(sid) : undefined;
        if (dur != null && dur > 0) {
          const { error: upErr } = await supabaseAdmin.from('taalk_call_analytics').update({ call_duration: dur }).eq('id', row.id);
          if (!upErr) updated++;
        }
      }
      if (updated > 0) console.log(`📊 Filled call_duration for ${updated} CCPRO rows from twilio_call_logs`);
      return updated;
    } catch (e: any) {
      console.error('❌ fillCcproCallDurations error:', e?.message);
      return 0;
    }
  }

  /**
   * Fill recording_url for pending twilio-* rows from twilio_call_logs (no analysis).
   * So processPendingTaalkCallAnalyticsRows can later analyze them.
   */
  private async fillCcproRecordingUrls(daysBack: number | null = 7, maxRows: number = 200): Promise<number> {
    try {
      const dateLimit = this.getDateLimit(daysBack);
      const { data: rows, error } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id, taalk_call_id, billing_transaction_id')
        .eq('analysis_status', 'pending')
        .like('billing_transaction_id', 'twilio-%')
        .or('recording_url.is.null,not.recording_url.ilike.%supabase%')
        .gte('call_date', dateLimit.toISOString())
        .order('call_date', { ascending: false })
        .limit(maxRows);
      if (error || !rows?.length) return 0;
      const sids = [...new Set(rows.map((r: any) => r.taalk_call_id).filter(Boolean))];
      const { data: tclRows } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, recording_url, parent_call_sid')
        .in('twilio_call_sid', sids);
      const parentSids = [...new Set((tclRows || []).map((r: any) => r.parent_call_sid).filter(Boolean))];
      let parentUrls: Map<string, string> = new Map();
      if (parentSids.length > 0) {
        const { data: parents } = await supabaseAdmin.from('twilio_call_logs').select('twilio_call_sid, recording_url').in('twilio_call_sid', parentSids);
        (parents || []).forEach((p: any) => {
          const u = (p.recording_url || '').trim();
          if (u && u.includes('supabase') && !u.includes('/api/')) parentUrls.set(p.twilio_call_sid, u);
        });
      }
      const recordingBySid = new Map<string, string>();
      (tclRows || []).forEach((r: any) => {
        const u = (r.recording_url || '').trim();
        if (u && u.includes('supabase') && !u.includes('/api/')) recordingBySid.set(r.twilio_call_sid, u);
      });
      let updated = 0;
      for (const row of rows) {
        const sid = (row as any).taalk_call_id;
        if (!sid) continue;
        let url = recordingBySid.get(sid);
        if (!url) {
          const tcl = (tclRows || []).find((r: any) => r.twilio_call_sid === sid);
          const parentSid = (tcl as any)?.parent_call_sid;
          if (parentSid) url = parentUrls.get(parentSid) || recordingBySid.get(parentSid);
        }
        if (url) {
          const { error: upErr } = await supabaseAdmin.from('taalk_call_analytics').update({ recording_url: url }).eq('id', row.id);
          if (!upErr) updated++;
        }
      }
      if (updated > 0) console.log(`📊 Filled recording_url for ${updated} CCPRO rows from twilio_call_logs`);
      return updated;
    } catch (e: any) {
      console.error('❌ fillCcproRecordingUrls error:', e?.message);
      return 0;
    }
  }

  /**
   * Process pending taalk_call_analytics rows that have Supabase recording_url but analysis_status='pending'.
   * @param ccproOnly - if true, only process twilio-* (CCPRO) calls, skip Taalk
   */
  private async processPendingTaalkCallAnalyticsRows(daysBack: number | null = 7, maxCalls: number = this.batchSize, ccproOnly: boolean = false): Promise<number> {
    try {
      const dateLimit = this.getDateLimit(daysBack);
      let query = supabaseAdmin
        .from('taalk_call_analytics')
        .select('id, taalk_call_id, billing_transaction_id, recording_url, transcript, agent_email, call_date, call_duration')
        .eq('analysis_status', 'pending')
        .ilike('recording_url', '%supabase%')
        .gte('call_date', dateLimit.toISOString())
        .order('call_date', { ascending: false })
        .limit(maxCalls);
      if (ccproOnly) {
        query = query.like('billing_transaction_id', 'twilio-%');
      }
      const { data: pendingRows, error } = await query;
      if (error || !pendingRows?.length) {
        if (pendingRows?.length === 0) return 0;
        return 0;
      }
      console.log(`📊 Found ${pendingRows.length} pending taalk_call_analytics rows with Supabase recording (concurrency: ${this.concurrency})`);
      const { callAnalyticsAnalyzer } = await import('./call-analytics-analyzer');
      const processOne = async (row: any) => {
        try {
          const { data: claimed } = await supabaseAdmin.from('taalk_call_analytics').update({ analysis_status: 'analyzing' }).eq('id', row.id).eq('analysis_status', 'pending').select('id').maybeSingle();
          if (!claimed) return 0;
          const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl((row as any).recording_url, null);
          const taalkCallId = (row as any).taalk_call_id;
          const billingId = (row as any).billing_transaction_id || '';
          const isTwilio = billingId.startsWith('twilio-');
          const BAD_AGENT = ['unknown', 'unknown@aoglobelife.com', 'system@aoglobelife.com', ''];
          const rowAgent = ((row as any).agent_email || '').trim().toLowerCase();
          const rowAgentIsBad = !rowAgent || !rowAgent.includes('@') || BAD_AGENT.includes(rowAgent);
          let fixAgent = {};
          if (isTwilio && taalkCallId && rowAgentIsBad) {
            const { data: tcl } = await supabaseAdmin.from('twilio_call_logs').select('to_number, parent_call_sid, owner_email').eq('twilio_call_sid', taalkCallId).maybeSingle();
            let toNum = (tcl as any)?.to_number;
            if (!toNum && (tcl as any)?.parent_call_sid) {
              const { data: ch } = await supabaseAdmin.from('twilio_call_logs').select('to_number').eq('parent_call_sid', taalkCallId).not('to_number', 'is', null).limit(1).maybeSingle();
              toNum = (ch as any)?.to_number;
            }
            const tclOwner = ((tcl as any)?.owner_email || '').trim().toLowerCase();
            if (tclOwner && tclOwner.includes('@') && !BAD_AGENT.includes(tclOwner)) {
              fixAgent = { agent_email: tclOwner, agent_name: null };
            } else {
              const { agent_email: re, agent_name: rn } = await this.resolveAgentFromDialMetrics(toNum);
              if (re && re !== 'unknown') fixAgent = { agent_email: re, agent_name: rn };
            }
          }
          const agentEmail = (fixAgent as any).agent_email || (row as any).agent_email;
          const associateId = await this.resolveAssociateId(agentEmail);
          let toNum: string | null = null;
          if (isTwilio && taalkCallId) {
            const { data: tcl } = await supabaseAdmin.from('twilio_call_logs').select('to_number, parent_call_sid').eq('twilio_call_sid', taalkCallId).maybeSingle();
            toNum = (tcl as any)?.to_number ?? null;
            if (!toNum && (tcl as any)?.parent_call_sid) {
              const { data: ch } = await supabaseAdmin.from('twilio_call_logs').select('to_number').eq('parent_call_sid', taalkCallId).not('to_number', 'is', null).limit(1).maybeSingle();
              toNum = (ch as any)?.to_number ?? null;
            }
          }
          const analysisData = {
            transcript: analysis.transcript,
            transcript_source: 'ai_transcription',
            ai_analysis: analysis,
            call_score: analysis.scorecard.overallScore,
            scorecard_results: analysis.scorecard,
            coaching_notes: analysis.coachingNotes?.join('\n') || null,
            key_topics: analysis.keyTopics,
            objections_detected: analysis.objectionsDetected,
            sentiment_score: analysis.sentimentScore,
            sentiment_label: analysis.sentiment,
            agent_talk_time_pct: analysis.agentTalkTimePct,
            client_engagement_level: analysis.clientEngagementLevel,
            call_outcome: analysis.callOutcome,
            call_outcome_confidence: analysis.callOutcomeConfidence,
            outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
            compliance_flags: analysis.complianceFlags,
            key_moments: analysis.keyMoments,
            analyzed_at: new Date().toISOString(),
            analysis_status: 'completed',
            analysis_model: 'gpt-4o-mini',
            analysis_version: '1.0',
            ...fixAgent,
            ...(associateId != null ? { associate_id: associateId } : {}),
            ...(toNum ? { to_number: toNum } : {})
          };
          await supabaseAdmin.from('taalk_call_analytics').update(analysisData).eq('id', row.id);
          await uploadTranscriptToSupabase((row as any).billing_transaction_id || '', analysis.transcript || '');
          await this.upsertToCallTransfersTable({
            transaction_id: (row as any).billing_transaction_id || '',
            taalk_call_id: taalkCallId || null,
            transaction_date: (row as any).call_date || new Date().toISOString(),
            agent_email: agentEmail || 'unknown',
            associate_id: associateId,
            agent_name: (fixAgent as any).agent_name || null,
            lead_phone: toNum,
            recording_url: (row as any).recording_url || null,
            transcript: analysis.transcript || null,
            call_duration: (row as any).call_duration ?? null,
            call_score: analysis.scorecard.overallScore ?? null,
            analysis_status: 'completed',
            analyzed_at: new Date().toISOString(),
            sentiment_label: analysis.sentiment,
            call_outcome: analysis.callOutcome,
            outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
            ai_analysis: analysis,
            scorecard_results: analysis.scorecard,
            coaching_notes: analysis.coachingNotes?.join('\n') || null,
            key_topics: analysis.keyTopics,
            objections_detected: analysis.objectionsDetected,
            sentiment_score: analysis.sentimentScore,
            agent_talk_time_pct: analysis.agentTalkTimePct,
            client_engagement_level: analysis.clientEngagementLevel,
            call_outcome_confidence: analysis.callOutcomeConfidence,
            compliance_flags: analysis.complianceFlags,
            key_moments: analysis.keyMoments
          });
          console.log(`✅ Analyzed pending taalk_call_analytics ${(row as any).billing_transaction_id} - Score: ${analysis.scorecard.overallScore}`);
          
          // Rate limiting: Wait 3 seconds after each call completes to prevent hammering OpenAI API
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return 1;
        } catch (e: any) {
          console.error(`❌ Failed to analyze pending ${(row as any).billing_transaction_id}:`, e?.message);
          await supabaseAdmin.from('taalk_call_analytics').update({
            analysis_status: 'failed',
            analysis_error: (e?.message || String(e))?.substring(0, 500)
          }).eq('id', row.id);
          
          // Still wait on error to prevent rapid retries
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return 0;
        }
      };
      return await this.runWithConcurrency(pendingRows, processOne);
    } catch (e: any) {
      console.error('❌ processPendingTaalkCallAnalyticsRows error:', e?.message);
      return 0;
    }
  }

  /**
   * Trigger immediate analysis for taalk_call_analytics rows by taalk_call_id.
   * Called from recording-status webhook when a recording is saved. Runs in background.
   */
  public triggerAnalysisForTaalkCallIds(taalkCallIds: string[]): void {
    if (!taalkCallIds?.length) return;
    const ids = [...taalkCallIds];
    console.log(`🎙️ Triggered immediate analysis for ${ids.length} taalk_call_ids: ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? '...' : ''}`);
    setImmediate(() => {
      this.runAnalysisForTaalkCallIds(ids).catch(e => {
        console.error('❌ triggerAnalysisForTaalkCallIds error:', e?.message || e);
      });
    });
  }

  /**
   * Internal: run analysis for given taalk_call_ids (called from triggerAnalysisForTaalkCallIds).
   */
  private async runAnalysisForTaalkCallIds(taalkCallIds: string[]): Promise<void> {
    try {
      const { data: pendingRows, error } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id, taalk_call_id, billing_transaction_id, recording_url, transcript, agent_email, call_date, call_duration')
        .in('taalk_call_id', taalkCallIds)
        .eq('analysis_status', 'pending')
        .ilike('recording_url', '%supabase%');

      if (error || !pendingRows?.length) {
        console.log(`📊 Immediate analysis: no pending rows found for ${taalkCallIds.length} taalk_call_ids`);
        return;
      }

      const { callAnalyticsAnalyzer } = await import('./call-analytics-analyzer');
      const processOne = async (row: any) => {
        try {
          const { data: claimed } = await supabaseAdmin.from('taalk_call_analytics').update({ analysis_status: 'analyzing' }).eq('id', row.id).eq('analysis_status', 'pending').select('id').maybeSingle();
          if (!claimed) return 0;
          const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl((row as any).recording_url, null);
          const taalkCallId = (row as any).taalk_call_id;
          const billingId = (row as any).billing_transaction_id || '';
          const isTwilio = billingId.startsWith('twilio-');
          const BAD_AGENT = ['unknown', 'unknown@aoglobelife.com', 'system@aoglobelife.com', ''];
          const rowAgent = ((row as any).agent_email || '').trim().toLowerCase();
          const rowAgentIsBad = !rowAgent || !rowAgent.includes('@') || BAD_AGENT.includes(rowAgent);
          let fixAgent = {};
          let toNum: string | null = null;
          if (isTwilio && taalkCallId) {
            const { data: tcl } = await supabaseAdmin.from('twilio_call_logs').select('to_number, parent_call_sid, owner_email').eq('twilio_call_sid', taalkCallId).maybeSingle();
            toNum = (tcl as any)?.to_number ?? null;
            if (!toNum && (tcl as any)?.parent_call_sid) {
              const { data: ch } = await supabaseAdmin.from('twilio_call_logs').select('to_number').eq('parent_call_sid', taalkCallId).not('to_number', 'is', null).limit(1).maybeSingle();
              toNum = (ch as any)?.to_number ?? null;
            }
            if (rowAgentIsBad) {
              const tclOwner = ((tcl as any)?.owner_email || '').trim().toLowerCase();
              if (tclOwner && tclOwner.includes('@') && !BAD_AGENT.includes(tclOwner)) {
                fixAgent = { agent_email: tclOwner, agent_name: null };
              } else {
                const { agent_email: re, agent_name: rn } = await this.resolveAgentFromDialMetrics(toNum);
                if (re && re !== 'unknown') fixAgent = { agent_email: re, agent_name: rn };
              }
            }
          }
          const agentEmail = (fixAgent as any).agent_email || (row as any).agent_email;
          const associateId = await this.resolveAssociateId(agentEmail);
          const analysisData = {
            transcript: analysis.transcript,
            transcript_source: 'ai_transcription',
            ai_analysis: analysis,
            call_score: analysis.scorecard.overallScore,
            scorecard_results: analysis.scorecard,
            coaching_notes: analysis.coachingNotes?.join('\n') || null,
            key_topics: analysis.keyTopics,
            objections_detected: analysis.objectionsDetected,
            sentiment_score: analysis.sentimentScore,
            sentiment_label: analysis.sentiment,
            agent_talk_time_pct: analysis.agentTalkTimePct,
            client_engagement_level: analysis.clientEngagementLevel,
            call_outcome: analysis.callOutcome,
            call_outcome_confidence: analysis.callOutcomeConfidence,
            outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
            compliance_flags: analysis.complianceFlags,
            key_moments: analysis.keyMoments,
            analyzed_at: new Date().toISOString(),
            analysis_status: 'completed',
            analysis_model: 'gpt-4o-mini',
            analysis_version: '1.0',
            ...fixAgent,
            ...(associateId != null ? { associate_id: associateId } : {})
          };
          await supabaseAdmin.from('taalk_call_analytics').update(analysisData).eq('id', row.id);
          await uploadTranscriptToSupabase((row as any).billing_transaction_id || '', analysis.transcript || '');
          await this.upsertToCallTransfersTable({
            transaction_id: billingId,
            taalk_call_id: taalkCallId || null,
            transaction_date: (row as any).call_date || new Date().toISOString(),
            agent_email: agentEmail || 'unknown',
            associate_id: associateId,
            agent_name: (fixAgent as any).agent_name || null,
            lead_phone: toNum,
            recording_url: (row as any).recording_url || null,
            transcript: analysis.transcript || null,
            call_duration: (row as any).call_duration ?? null,
            call_score: analysis.scorecard.overallScore ?? null,
            analysis_status: 'completed',
            analyzed_at: new Date().toISOString(),
            sentiment_label: analysis.sentiment,
            call_outcome: analysis.callOutcome,
            outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
            ai_analysis: analysis,
            scorecard_results: analysis.scorecard,
            coaching_notes: analysis.coachingNotes?.join('\n') || null,
            key_topics: analysis.keyTopics,
            objections_detected: analysis.objectionsDetected,
            sentiment_score: analysis.sentimentScore,
            agent_talk_time_pct: analysis.agentTalkTimePct,
            client_engagement_level: analysis.clientEngagementLevel,
            call_outcome_confidence: analysis.callOutcomeConfidence,
            compliance_flags: analysis.complianceFlags,
            key_moments: analysis.keyMoments
          });
          console.log(`✅ Immediate analysis: ${(row as any).billing_transaction_id} - Score: ${analysis.scorecard.overallScore}`);
          
          // Rate limiting: Wait 3 seconds after each call completes to prevent hammering OpenAI API
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return 1;
        } catch (e: any) {
          console.error(`❌ Immediate analysis failed for ${(row as any).billing_transaction_id}:`, e?.message);
          await supabaseAdmin.from('taalk_call_analytics').update({
            analysis_status: 'failed',
            analysis_error: (e?.message || String(e))?.substring(0, 500)
          }).eq('id', row.id);
          
          // Still wait on error to prevent rapid retries
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return 0;
        }
      };
      const succeeded = await this.runWithConcurrency(pendingRows, processOne);
      console.log(`✅ Immediate analysis complete: ${succeeded} analyzed, ${pendingRows.length - succeeded} failed`);
    } catch (e: any) {
      console.error('❌ runAnalysisForTaalkCallIds error:', e?.message);
      throw e;
    }
  }

  /**
   * Process Twilio outbound calls that need analysis.
   * @param daysBack - days to look back
   * @param maxCalls - max number to process this run (so Taalk + Twilio combined ≤ batchSize)
   */
  private async processTwilioOutboundCalls(daysBack: number | null = 7, maxCalls: number = this.batchSize): Promise<number> {
    try {
      // CRITICAL: Never unbounded - 7M+ rows kills memory and DB. Cap at 30 days.
      const safeDaysBack = daysBack === 0 ? 0 : (daysBack != null ? Math.min(daysBack, 30) : 30);
      const maxRowsToFetch = 5000; // More candidates for Twilio fallback
      const dateLimit = this.getDateLimit(safeDaysBack);

      const { data: twilioCalls, error: twilioError } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('twilio_call_sid, owner_email, call_started_at, call_duration, to_number, parent_call_sid, metadata, recording_url')
        .or('call_direction.eq.outbound,call_direction.is.null')
        .gte('call_duration', 25)
        .in('call_status', ['answered', 'completed'])
        .gte('call_started_at', dateLimit.toISOString())
        .order('call_started_at', { ascending: false })
        .limit(maxRowsToFetch);

      if (twilioError) {
        console.error('❌ Error fetching Twilio calls:', twilioError);
        return 0;
      }

      console.log(`📊 Found ${twilioCalls?.length || 0} reached Twilio outbound calls (last ${safeDaysBack} days, capped at ${maxRowsToFetch})`);

      if (!twilioCalls || twilioCalls.length === 0) {
        return 0;
      }

      // Get existing analyses to skip already processed ones
      // For Twilio calls, we use twilio_call_sid as the identifier
      const callSids = twilioCalls.map(c => c.twilio_call_sid);
      const { data: existingAnalyses } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('taalk_call_id, analysis_status')
        .in('taalk_call_id', callSids);

      const analyzedSids = new Set(
        (existingAnalyses || [])
          .filter(a => a.analysis_status === 'completed')
          .map(a => a.taalk_call_id)
      );

      // Only process calls that have a CONFIRMED recording. Skip any call with no completed recording.
      let unanalyzedCandidates = twilioCalls.filter(
        c => !analyzedSids.has(c.twilio_call_sid)
      );
      // Prefer SIDs that have a pending taalk_call_analytics row (UI shows these) so we update visible rows first
      const { data: pendingRows } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('taalk_call_id')
        .eq('analysis_status', 'pending')
        .like('billing_transaction_id', 'twilio-%')
        .in('taalk_call_id', unanalyzedCandidates.map((c: any) => c.twilio_call_sid));
      const pendingSids = new Set((pendingRows || []).map((r: any) => r.taalk_call_id));
      unanalyzedCandidates = [
        ...unanalyzedCandidates.filter((c: any) => pendingSids.has(c.twilio_call_sid)),
        ...unanalyzedCandidates.filter((c: any) => !pendingSids.has(c.twilio_call_sid))
      ];
      const callsWithRecordings: any[] = [];
      // Fast path: calls that already have recording_url in twilio_call_logs - skip API check
      const needsApiCheck: any[] = [];
      for (const call of unanalyzedCandidates) {
        if (callsWithRecordings.length >= maxCalls) break;
        const hasUrl = call.recording_url && String(call.recording_url).trim().length > 0;
        if (hasUrl) {
          callsWithRecordings.push(call);
        } else {
          needsApiCheck.push(call);
        }
      }
      // Twilio API fallback: check calls without recording_url in DB
      if (needsApiCheck.length > 0 && callsWithRecordings.length < maxCalls && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
        const checkRecordings = async (sid: string) => {
          const recUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${sid}/Recordings.json`;
          const recRes = await fetch(recUrl, { headers: { 'Authorization': `Basic ${authHeader}` } });
          if (!recRes.ok) return false;
          const recData = await recRes.json();
          const list = recData.recordings || recData.Recordings || [];
          const completed = list.filter((r: any) => (r.status || r.Status) === 'completed');
          return completed.length > 0;
        };
        const remaining = maxCalls - callsWithRecordings.length;
        const RECORDING_CHECK_CONCURRENCY = 50;
        for (let i = 0; i < needsApiCheck.length && callsWithRecordings.length < maxCalls; i += RECORDING_CHECK_CONCURRENCY) {
          const chunk = needsApiCheck.slice(i, i + RECORDING_CHECK_CONCURRENCY);
          const results = await Promise.all(chunk.map(async (call: any) => {
            const hasRecording = await checkRecordings(call.twilio_call_sid);
            if (hasRecording) return call;
            if (call.parent_call_sid) {
              const parentHasRecording = await checkRecordings(call.parent_call_sid);
              if (parentHasRecording) return call;
            }
            return null;
          }));
          for (const c of results) if (c && callsWithRecordings.length < maxCalls) callsWithRecordings.push(c);
        }
      }

      console.log(`📊 Found ${callsWithRecordings.length} Twilio calls with confirmed recording (max ${maxCalls}, concurrency: ${this.concurrency})`);

      const processOne = async (twilioCall: any) => {
        try {
          await this.analyzeTwilioCall(twilioCall);
          return 1;
        } catch (error: any) {
          console.error(`❌ Failed to analyze Twilio call ${twilioCall.twilio_call_sid}:`, error.message);
          try {
            const cd = (twilioCall.call_duration != null && Number(twilioCall.call_duration) > 0) ? Number(twilioCall.call_duration) : null;
            const { data: existing } = await supabaseAdmin
              .from('taalk_call_analytics')
              .select('id')
              .eq('taalk_call_id', twilioCall.twilio_call_sid)
              .maybeSingle();

            if (existing) {
              await supabaseAdmin
                .from('taalk_call_analytics')
                .update({
                  analysis_status: 'failed',
                  analysis_error: error.message?.substring(0, 500),
                  call_duration: cd
                })
                .eq('id', existing.id);
            } else {
              await supabaseAdmin
                .from('taalk_call_analytics')
                .insert({
                  billing_transaction_id: `twilio-${twilioCall.twilio_call_sid}`,
                  agent_email: twilioCall.owner_email || 'unknown',
                  call_date: twilioCall.call_started_at || new Date().toISOString(),
                  taalk_call_id: twilioCall.twilio_call_sid,
                  call_duration: cd,
                  analysis_status: 'failed',
                  analysis_error: error.message?.substring(0, 500)
                });
            }
          } catch (updateError) {
            console.error('Error updating failed status:', updateError);
          }
          return 0;
        }
      };
      const succeeded = await this.runWithConcurrency(callsWithRecordings, processOne);
      console.log(`✅ Twilio outbound calls batch complete: ${succeeded} succeeded, ${callsWithRecordings.length - succeeded} failed`);
      return succeeded;
    } catch (error: any) {
      console.error('❌ Error processing Twilio calls:', error);
      return 0;
    }
  }

  /**
   * Resolve agent_email and agent_name from agent_dial_metrics by lead phone (to_number).
   * Uses agent_dial_metrics - NOT masterlead.
   */
  private async resolveAgentFromDialMetrics(toNumber: string | null): Promise<{ agent_email: string; agent_name: string | null }> {
    if (!toNumber || !String(toNumber).trim()) return { agent_email: 'unknown', agent_name: null };
    const digits = String(toNumber).replace(/\D/g, '');
    const phoneNorm = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!phoneNorm) return { agent_email: 'unknown', agent_name: null };
    const { data: admRows } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, agent_name, lead_phone')
      .ilike('lead_phone', `%${phoneNorm}`)
      .not('agent_email', 'is', null)
      .order('event_timestamp', { ascending: false })
      .limit(5);
    const adm = (admRows || []).find((r: any) => {
      const p = String(r?.lead_phone || '').replace(/\D/g, '');
      return p.length >= 10 && p.slice(-10) === phoneNorm;
    }) || admRows?.[0];
    const email = adm?.agent_email;
    if (!email || !String(email).includes('@')) return { agent_email: 'unknown', agent_name: null };
    const bad = ['unknown@aoglobelife.com', 'system@aoglobelife.com', 'unknown', 'cnsysop@aoglobelife.com'];
    if (bad.includes(String(email).toLowerCase().trim())) return { agent_email: 'unknown', agent_name: null };
    const agentName = adm?.agent_name?.trim() || null;
    return { agent_email: String(email).toLowerCase(), agent_name: agentName };
  }

  /**
   * No-op: Call analytics uses taalk_call_analytics only. Data is already in taalk_call_analytics; API reads from there.
   */
  private async upsertToCallTransfersTable(_payload: {
    transaction_id: string;
    taalk_call_id: string | null;
    transaction_date: string;
    agent_email: string;
    associate_id: number | null;
    agent_name: string | null;
    lead_phone: string | null;
    lead_name?: string | null;
    market?: string | null;
    recording_url: string | null;
    transcript?: string | null;
    call_duration?: number | null;
    call_score?: number | null;
    analysis_status: string;
    analyzed_at?: string | null;
    sentiment_label?: string | null;
    call_outcome?: string | null;
    outcome?: string | null;
    ai_analysis?: unknown;
    scorecard_results?: unknown;
    coaching_notes?: string | null;
    key_topics?: string[] | null;
    objections_detected?: string[] | null;
    sentiment_score?: number | null;
    agent_talk_time_pct?: number | null;
    client_engagement_level?: string | null;
    call_outcome_confidence?: number | null;
    compliance_flags?: unknown;
    key_moments?: unknown;
  }): Promise<void> {
    // Call analytics reads from taalk_call_analytics only; no separate transfers table
  }

  /** Resolve associate_id from agent_email (customers first, then producerlist). */
  private async resolveAssociateId(agentEmail: string | null | undefined): Promise<number | null> {
    if (!agentEmail || !String(agentEmail).includes('@')) return null;
    const email = String(agentEmail).toLowerCase().trim();
    const { data: cust } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .or(`company_email.ilike.${email},personal_email.ilike.${email}`)
      .not('associate_id', 'is', null)
      .maybeSingle();
    if (cust?.associate_id != null) return Number(cust.associate_id);
    const { data: pl } = await supabaseAdmin
      .from('producerlist')
      .select('associate_id')
      .ilike('company_email', email)
      .not('associate_id', 'is', null)
      .maybeSingle();
    return pl?.associate_id != null ? Number(pl.associate_id) : null;
  }

  /**
   * Analyze a single Twilio outbound call
   */
  private async analyzeTwilioCall(twilioCall: any): Promise<void> {
    const { twilio_call_sid, owner_email, call_started_at, call_duration, to_number } = twilioCall;

    console.log(`🔍 Analyzing Twilio call: ${twilio_call_sid}`);

    // Download recording from Twilio and upload to Supabase storage
    let recordingUrl: string | null = null;
    const metadata = typeof twilioCall.metadata === 'string' 
      ? JSON.parse(twilioCall.metadata) 
      : (twilioCall.metadata || {});

    // Check recording_url column first, then metadata
    if (twilioCall.recording_url) {
      recordingUrl = twilioCall.recording_url;
      console.log(`✅ Found recording URL in twilio_call_logs.recording_url for ${twilio_call_sid}`);
    } else if (metadata.recording_url && metadata.recording_url.includes('supabase')) {
      recordingUrl = metadata.recording_url;
      console.log(`✅ Found Supabase storage URL in metadata for ${twilio_call_sid}`);
    } else {
      // Download from Twilio and upload to Supabase storage
      try {
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
          throw new Error('Twilio credentials not configured');
        }

        const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

        // For Dial flows, recording is often on PARENT leg - try parent if child has none
        let sidToFetch = twilio_call_sid;
        if (twilioCall.parent_call_sid) {
          const childUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${twilio_call_sid}/Recordings.json`;
          const childRes = await fetch(childUrl, { headers: { 'Authorization': `Basic ${authHeader}` } });
          if (childRes.ok) {
            const childData = await childRes.json();
            const childList = childData.recordings || childData.Recordings || [];
            const childCompleted = childList.filter((r: any) => (r.status || r.Status) === 'completed');
            if (childCompleted.length === 0) {
              sidToFetch = twilioCall.parent_call_sid;
              console.log(`🔍 No recording on child ${twilio_call_sid}, trying parent ${sidToFetch}`);
            }
          }
        }
        console.log(`🔍 Fetching recording from Twilio API for call ${sidToFetch}...`);
        
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${sidToFetch}/Recordings.json`;
        
        const recordingsResponse = await fetch(twilioUrl, {
          headers: {
            'Authorization': `Basic ${authHeader}`
          }
        });
        
        if (!recordingsResponse.ok) {
          const errorText = await recordingsResponse.text().catch(() => '');
          throw new Error(`Twilio API error: ${recordingsResponse.status} - ${errorText.substring(0, 200)}`);
        }

        const recordingsData = await recordingsResponse.json();
        const recordingsList = recordingsData.recordings || recordingsData.Recordings || [];
        // Only use completed recordings (Twilio can return "processing" right after call ends)
        const completedRecordings = Array.isArray(recordingsList)
          ? recordingsList.filter((r: any) => (r.status || r.Status) === 'completed')
          : [];
        if (completedRecordings.length === 0) {
          if (recordingsList.length > 0) {
            console.warn(`⚠️ Twilio call ${twilio_call_sid} has ${recordingsList.length} recording(s) but none are completed yet (status: ${(recordingsList[0] as any).status || (recordingsList[0] as any).Status}) - skipping`);
          } else {
            console.warn(`⚠️ No recordings found for Twilio call ${twilio_call_sid} - call may not have been recorded`);
          }
          recordingUrl = null;
        } else {
          // Get the first completed recording (usually there's only one)
          const recording = completedRecordings[0];
          const recordingSid = recording.sid || recording.Sid;
          if (!recordingSid) {
            console.warn(`⚠️ Twilio recording has no sid for call ${twilio_call_sid}`);
            recordingUrl = null;
          } else {
          console.log(`✅ Found Twilio recording: ${recordingSid} (status: completed)`);

          // Download the actual recording file - use Basic Auth header
          const recordingDownloadUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${recordingSid}.mp3`;
          console.log(`📥 Downloading recording from Twilio...`);
          
          const downloadResponse = await fetch(recordingDownloadUrl, {
            headers: {
              'Authorization': `Basic ${authHeader}`
            }
          });
          if (!downloadResponse.ok) {
            throw new Error(`Failed to download recording: ${downloadResponse.status}`);
          }

          const arrayBuffer = await downloadResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log(`✅ Downloaded ${Math.round(buffer.length / 1024)}KB from Twilio`);

          // Upload to Supabase Storage in call-analysis folder
          const fileName = `call-analysis/twilio-${twilio_call_sid}.mp3`;
          console.log(`☁️ Uploading to Supabase storage: ${fileName}...`);
          
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .upload(fileName, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });

          if (uploadError) {
            console.error(`❌ Supabase Storage upload failed:`, uploadError);
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          console.log(`✅ Uploaded to Supabase storage`);

          // Generate 2-year signed URL
          const { data: urlData, error: urlError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .createSignedUrl(fileName, 63072000); // 2 years in seconds

          if (urlError || !urlData?.signedUrl) {
            console.error(`❌ Failed to generate signed URL:`, urlError);
            throw new Error(`Failed to generate signed URL: ${urlError?.message || 'Unknown error'}`);
          }

          recordingUrl = urlData.signedUrl;
          console.log(`✅ Generated Supabase signed URL for ${twilio_call_sid}`);

          // Update metadata and recording_url column
          const updatedMetadata = {
            ...metadata,
            recording_url: recordingUrl,
            recording_storage_path: fileName,
            recording_uploaded_at: new Date().toISOString()
          };

          const { error: updateErr } = await supabaseAdmin
            .from('twilio_call_logs')
            .update({ metadata: updatedMetadata, recording_url: recordingUrl })
            .eq('twilio_call_sid', twilio_call_sid);
          if (updateErr) {
            console.error(`❌ Failed to save recording_url to twilio_call_logs for ${twilio_call_sid}:`, updateErr);
            throw new Error(`Could not persist recording_url: ${updateErr.message}`);
          }
          console.log(`✅ Saved recording_url to twilio_call_logs for ${twilio_call_sid}`);
          }
        }

      } catch (error: any) {
        console.error(`❌ Error downloading/uploading Twilio recording for ${twilio_call_sid}:`, error.message);
        // If no recording is available, we can still analyze if we have other data
        if (error.message.includes('No recordings found')) {
          console.warn(`⚠️ Continuing without recording for ${twilio_call_sid}`);
          recordingUrl = null;
        } else {
          throw new Error(`Failed to get recording: ${error.message}`);
        }
      }
    }

    // If we don't have a recording, we can't analyze the call
    if (!recordingUrl) {
      throw new Error(`No recording available for call ${twilio_call_sid} - cannot analyze without audio`);
    }

    // Create initial analysis record
    const { data: existingAnalysis, error: existingError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id')
      .eq('taalk_call_id', twilio_call_sid)
      .maybeSingle();

    if (existingError) {
      console.error(`❌ Error checking existing analysis for ${twilio_call_sid}:`, existingError);
      throw new Error(`Database error: ${existingError.message}`);
    }

    if (existingAnalysis) {
      const { error: updateError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .update({ analysis_status: 'analyzing' })
        .eq('id', existingAnalysis.id);
      
      if (updateError) {
        console.error(`❌ Error updating analysis status for ${twilio_call_sid}:`, updateError);
        throw new Error(`Database update error: ${updateError.message}`);
      }
    } else {
      const callDurationSec = (call_duration != null && Number(call_duration) > 0) ? Number(call_duration) : null;
      let initToNumber = to_number || twilioCall.to_number;
      if (!initToNumber && twilioCall.parent_call_sid) {
        const { data: cr } = await supabaseAdmin.from('twilio_call_logs').select('to_number').eq('parent_call_sid', twilio_call_sid).not('to_number', 'is', null).limit(1).maybeSingle();
        initToNumber = (cr as any)?.to_number;
      }
      const BAD = ['unknown', 'unknown@aoglobelife.com', 'system@aoglobelife.com', ''];
      const ownerOk = (owner_email || '').trim().toLowerCase();
      const ownerIsBad = !ownerOk || !ownerOk.includes('@') || BAD.includes(ownerOk);
      const { agent_email: initEmail } = ownerIsBad ? await this.resolveAgentFromDialMetrics(initToNumber) : { agent_email: 'unknown' as const };
      const initAgentEmail = (!ownerIsBad ? ownerOk : (initEmail && initEmail !== 'unknown' ? initEmail : owner_email || 'unknown'));
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .insert({
          billing_transaction_id: `twilio-${twilio_call_sid}`,
          agent_email: initAgentEmail,
          call_date: call_started_at || new Date().toISOString(),
          taalk_call_id: twilio_call_sid,
          recording_url: recordingUrl,
          call_duration: callDurationSec,
          analysis_status: 'analyzing',
        })
        .select()
        .single();
      
      if (insertError) {
        console.error(`❌ Error inserting initial analysis record for ${twilio_call_sid}:`, insertError);
        throw new Error(`Database insert error: ${insertError.message}`);
      }
      console.log(`✅ Created initial analysis record for ${twilio_call_sid}:`, insertedData?.id);
    }

    // Import and use call analytics analyzer
    const { callAnalyticsAnalyzer } = await import('./call-analytics-analyzer');

    // For Twilio calls, we need to download from Twilio (not Taalk)
    // The analyzer's downloadAudio should handle Twilio URLs too
    console.log(`🎤 Transcribing and analyzing Twilio recording for ${twilio_call_sid}...`);
    const analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(recordingUrl, null); // No Taalk API key needed for Twilio

    // Save analysis to database
    // CRITICAL: Re-check for existing record right before save to prevent duplicates
    const { data: finalCheckRows, error: finalCheckError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id')
      .eq('taalk_call_id', twilio_call_sid)
      .limit(1);

    if (finalCheckError) {
      console.error(`❌ Error checking for existing record before save: ${finalCheckError.message}`);
      throw new Error(`Database error: ${finalCheckError.message}`);
    }

    const finalCheck = finalCheckRows && finalCheckRows.length > 0 ? finalCheckRows[0] : null;

    // Use owner_email (actual producer for this call) first; only fall back to dial metrics when owner is missing/bad
    const BAD = ['unknown', 'unknown@aoglobelife.com', 'system@aoglobelife.com', ''];
    const ownerOk = (owner_email || '').trim().toLowerCase();
    const ownerIsBad = !ownerOk || !ownerOk.includes('@') || BAD.includes(ownerOk);
    let toNumber = to_number || twilioCall.to_number;
    if (!toNumber && twilioCall.parent_call_sid) {
      const { data: childRow } = await supabaseAdmin.from('twilio_call_logs').select('to_number').eq('parent_call_sid', twilio_call_sid).not('to_number', 'is', null).limit(1).maybeSingle();
      toNumber = (childRow as any)?.to_number;
    }
    const { agent_email: resolvedEmail, agent_name: resolvedName } = ownerIsBad ? await this.resolveAgentFromDialMetrics(toNumber) : { agent_email: 'unknown' as const, agent_name: null };
    const agentEmail = !ownerIsBad ? ownerOk : (resolvedEmail && resolvedEmail !== 'unknown' ? resolvedEmail : owner_email || 'unknown');
    const agentName = !ownerIsBad ? null : resolvedName;
    const associateId = await this.resolveAssociateId(agentEmail);

    const callDurationSec = (call_duration != null && Number(call_duration) > 0) ? Number(call_duration) : null;
    const analysisData = {
      billing_transaction_id: `twilio-${twilio_call_sid}`,
      agent_email: agentEmail,
      agent_name: agentName,
      ...(associateId != null ? { associate_id: associateId } : {}),
      call_date: call_started_at || new Date().toISOString(),
      taalk_call_id: twilio_call_sid,
      recording_url: recordingUrl,
      call_duration: callDurationSec,
      transcript: analysis.transcript,
      transcript_source: 'ai_transcription',
      ai_analysis: analysis,
      call_score: analysis.scorecard.overallScore,
      scorecard_results: analysis.scorecard,
      coaching_notes: analysis.coachingNotes?.join('\n') || null,
      key_topics: analysis.keyTopics,
      objections_detected: analysis.objectionsDetected,
      sentiment_score: analysis.sentimentScore,
      sentiment_label: analysis.sentiment,
      agent_talk_time_pct: analysis.agentTalkTimePct,
      client_engagement_level: analysis.clientEngagementLevel,
      call_outcome: analysis.callOutcome,
      call_outcome_confidence: analysis.callOutcomeConfidence,
      outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
      compliance_flags: analysis.complianceFlags,
      key_moments: analysis.keyMoments,
      analyzed_at: new Date().toISOString(),
      analysis_status: 'completed',
      analysis_model: 'gpt-4o-mini',
      analysis_version: '1.0'
    };

    if (finalCheck) {
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .update(analysisData)
        .eq('id', finalCheck.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`❌ Error updating analysis for ${twilio_call_sid}:`, updateError);
        throw new Error(`Database update error: ${updateError.message}`);
      }
      console.log(`✅ Updated analysis record for ${twilio_call_sid}:`, updatedData?.id);
    } else {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .insert(analysisData)
        .select()
        .single();
      
      if (insertError) {
        // If insert fails due to duplicate, try update instead
        if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
          console.warn(`⚠️ Insert failed due to duplicate, trying update instead...`);
          const { data: existingRecord } = await supabaseAdmin
            .from('taalk_call_analytics')
            .select('id')
            .eq('taalk_call_id', twilio_call_sid)
            .maybeSingle();
          
          if (existingRecord) {
            const { error: updateError } = await supabaseAdmin
              .from('taalk_call_analytics')
              .update(analysisData)
              .eq('id', existingRecord.id);
            
            if (updateError) {
              throw new Error(`Database update error after duplicate insert: ${updateError.message}`);
            }
            console.log(`✅ Updated existing record after duplicate insert attempt: ${existingRecord.id}`);
          } else {
            throw new Error(`Database insert error: ${insertError.message}`);
          }
        } else {
          console.error(`❌ Error inserting analysis for ${twilio_call_sid}:`, insertError);
          throw new Error(`Database insert error: ${insertError.message}`);
        }
      } else {
        console.log(`✅ Inserted analysis record for ${twilio_call_sid}:`, insertedData?.id);
      }
    }

    // CCPRO: If this was the parent leg, propagate analysis to all child taalk_call_analytics rows so UI (which shows child rows) updates
    const { data: childRows } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid')
      .eq('parent_call_sid', twilio_call_sid);
    if (childRows?.length) {
      const childSids = childRows.map((r: any) => r.twilio_call_sid);
      const childUpdate = {
        recording_url: recordingUrl,
        transcript: analysis.transcript,
        transcript_source: 'ai_transcription',
        ai_analysis: analysis,
        call_score: analysis.scorecard.overallScore,
        scorecard_results: analysis.scorecard,
        coaching_notes: analysis.coachingNotes?.join('\n') || null,
        key_topics: analysis.keyTopics,
        objections_detected: analysis.objectionsDetected,
        sentiment_score: analysis.sentimentScore,
        sentiment_label: analysis.sentiment,
        agent_talk_time_pct: analysis.agentTalkTimePct,
        client_engagement_level: analysis.clientEngagementLevel,
        call_outcome: analysis.callOutcome,
        call_outcome_confidence: analysis.callOutcomeConfidence,
        outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
        compliance_flags: analysis.complianceFlags,
        key_moments: analysis.keyMoments,
        analyzed_at: new Date().toISOString(),
        analysis_status: 'completed',
        analysis_model: 'gpt-4o-mini',
        analysis_version: '1.0',
        agent_email: agentEmail,
        agent_name: agentName,
        ...(associateId != null ? { associate_id: associateId } : {})
      };
      for (const childSid of childSids) {
        const { error: childUpErr } = await supabaseAdmin
          .from('taalk_call_analytics')
          .update(childUpdate)
          .eq('taalk_call_id', childSid);
        if (!childUpErr) {
          await this.upsertToCallTransfersTable({
            transaction_id: `twilio-${childSid}`,
            taalk_call_id: childSid,
            transaction_date: call_started_at || new Date().toISOString(),
            agent_email: agentEmail,
            associate_id: associateId,
            agent_name: agentName,
            lead_phone: toNumber || null,
            recording_url: recordingUrl,
            transcript: analysis.transcript || null,
            call_duration: callDurationSec,
            call_score: analysis.scorecard.overallScore ?? null,
            analysis_status: 'completed',
            analyzed_at: new Date().toISOString(),
            sentiment_label: analysis.sentiment,
            call_outcome: analysis.callOutcome,
            outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
            ai_analysis: analysis,
            scorecard_results: analysis.scorecard,
            coaching_notes: analysis.coachingNotes?.join('\n') || null,
            key_topics: analysis.keyTopics,
            objections_detected: analysis.objectionsDetected,
            sentiment_score: analysis.sentimentScore,
            agent_talk_time_pct: analysis.agentTalkTimePct,
            client_engagement_level: analysis.clientEngagementLevel,
            call_outcome_confidence: analysis.callOutcomeConfidence,
            compliance_flags: analysis.complianceFlags,
            key_moments: analysis.keyMoments
          });
        }
      }
      if (childSids.length > 0) console.log(`✅ Propagated analysis to ${childSids.length} child row(s)`);
    }

    await this.upsertToCallTransfersTable({
      transaction_id: `twilio-${twilio_call_sid}`,
      taalk_call_id: twilio_call_sid,
      transaction_date: call_started_at || new Date().toISOString(),
      agent_email: agentEmail,
      associate_id: associateId,
      agent_name: agentName,
      lead_phone: toNumber || null,
      recording_url: recordingUrl,
      transcript: analysis.transcript || null,
      call_duration: callDurationSec,
      call_score: analysis.scorecard.overallScore ?? null,
      analysis_status: 'completed',
      analyzed_at: new Date().toISOString(),
      sentiment_label: analysis.sentiment,
      call_outcome: analysis.callOutcome,
      outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
      ai_analysis: analysis,
      scorecard_results: analysis.scorecard,
      coaching_notes: analysis.coachingNotes?.join('\n') || null,
      key_topics: analysis.keyTopics,
      objections_detected: analysis.objectionsDetected,
      sentiment_score: analysis.sentimentScore,
      agent_talk_time_pct: analysis.agentTalkTimePct,
      client_engagement_level: analysis.clientEngagementLevel,
      call_outcome_confidence: analysis.callOutcomeConfidence,
      compliance_flags: analysis.complianceFlags,
      key_moments: analysis.keyMoments
    });

    // Upload full transcript to Supabase Storage
    await uploadTranscriptToSupabase(`twilio-${twilio_call_sid}`, analysis.transcript || '');

    console.log(`✅ Successfully analyzed Twilio call ${twilio_call_sid} - Score: ${analysis.scorecard.overallScore}`);
  }

  /**
   * Return true only if this transaction has a valid Taalk session ID (24 hex) and Taalk confirms a recording exists.
   * No recording = don't download. Skip.
   */
  private async taalkHasConfirmedRecording(transaction: any): Promise<boolean> {
    let taalkCallId: string | null = null;
    if (transaction.metadata?.sessionID) taalkCallId = String(transaction.metadata.sessionID);
    else if (transaction.metadata?.taalk_call_id || transaction.metadata?.call_id) taalkCallId = transaction.metadata.taalk_call_id || transaction.metadata.call_id;
    if (!taalkCallId && transaction.source_id) {
      const { data: vdp } = await supabaseAdmin.from('vdp_calls').select('sessionID').eq('id', transaction.source_id).maybeSingle();
      if (vdp?.sessionID) taalkCallId = String(vdp.sessionID);
    }
    if (!taalkCallId || !/^[0-9a-fA-F]{24}$/.test(taalkCallId)) return false;
    const recordingUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
    const res = await fetch(recordingUrl, { method: 'HEAD', headers: { 'Authorization': `Bearer ${taalkApiKey}` } });
    if (res.ok) return true;
    const getRes = await fetch(recordingUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${taalkApiKey}` } });
    return getRes.ok;
  }

  /**
   * Analyze a single call
   */
  private async analyzeCall(transaction: any): Promise<void> {
    const { transaction_id, agent_email, agent_name, transaction_date, source_id } = transaction;

    console.log(`🔍 Analyzing call: ${transaction_id}`);

    // Try to get vdp_call if source_id is provided, but don't require it
    let vdpCall: any = null;
    if (source_id) {
      const { data: vdp, error: vdpError } = await supabaseAdmin
        .from('vdp_calls')
        .select('id, sessionID, leadid, phone, time, event, duration')
        .eq('id', source_id)
        .maybeSingle();

      if (vdpError) {
        console.warn(`⚠️ Error querying vdp_calls for source_id ${source_id}:`, vdpError.message);
        // Don't throw - continue without vdp_call
      } else {
        vdpCall = vdp;
      }
    }

    // Try to get Taalk call ID from multiple sources
    let taalkCallId: string | null = null;
    
    // Method 1: Check transaction metadata FIRST (most reliable for CSV imports)
    if (transaction.metadata?.sessionID) {
      taalkCallId = String(transaction.metadata.sessionID);
      console.log(`✅ Found Taalk call ID from metadata.sessionID: ${taalkCallId}`);
    } else if (transaction.metadata?.taalk_call_id || transaction.metadata?.call_id) {
      taalkCallId = transaction.metadata.taalk_call_id || transaction.metadata.call_id;
      console.log(`✅ Found Taalk call ID from transaction metadata: ${taalkCallId}`);
    }
    
    // Method 2: Use sessionID from vdp_call if available
    if (!taalkCallId && vdpCall?.sessionID) {
      taalkCallId = String(vdpCall.sessionID);
      console.log(`✅ Using sessionID from vdp_call: ${taalkCallId}`);
    }
    
    // Do NOT use leadid - it's not a Taalk session ID and will always 401. No recording without valid session ID.
    
    // Method 3: Query Taalk API to find call by phone number - SIMPLIFIED, JUST SEARCH BY PHONE
    if (!taalkCallId && vdpCall?.phone) {
      try {
        console.log(`🔍 Searching Taalk API for call with phone ${vdpCall.phone}...`);
        
        // Query recent calls from Taalk API - just get recent calls and match by phone
        const recentCallsUrl = `https://api.taalk.ai/api/calls?db=michaelmandella&limit=1000`;
        const recentCallsResponse = await fetch(recentCallsUrl, {
          headers: { 'Authorization': `Bearer ${taalkApiKey}` }
        });
        
        if (recentCallsResponse.ok) {
          const callsData = await recentCallsResponse.json();
          const calls = Array.isArray(callsData) ? callsData : (callsData.calls || []);
          
          console.log(`📊 Found ${calls.length} calls from Taalk API to search`);
          
          // Normalize phone number for matching (remove +, spaces, dashes, keep last 10 digits)
          const normalizePhone = (phone: string) => {
            if (!phone) return '';
            const cleaned = phone.replace(/[\s\-+()]/g, '');
            // Keep last 10 digits (US phone numbers)
            return cleaned.slice(-10);
          };
          
          const targetPhone = normalizePhone(vdpCall.phone);
          
          console.log(`🔍 Searching for phone: ${targetPhone} (normalized from ${vdpCall.phone})`);
          
          // Find matching call by phone ONLY (simpler - just match phone number)
          const matchingCalls = calls.filter((call: any) => {
            const callPhone = normalizePhone(call.phone || call.from || call.to || '');
            return callPhone === targetPhone;
          });
          
          if (matchingCalls.length > 0) {
            // Use the most recent one
            matchingCalls.sort((a: any, b: any) => {
              const timeA = new Date(a.created_at || a.createdAt || a.time || a.date || 0).getTime();
              const timeB = new Date(b.created_at || b.createdAt || b.time || b.date || 0).getTime();
              return timeB - timeA; // Most recent first
            });
            
            const bestMatch = matchingCalls[0];
            taalkCallId = bestMatch.id || bestMatch._id || bestMatch.callId;
            console.log(`✅ Found Taalk call ID from API search: ${taalkCallId} (from ${matchingCalls.length} matches)`);
          } else {
            console.warn(`⚠️ No matching call found in Taalk API for phone ${vdpCall.phone}`);
            console.warn(`   Searched ${calls.length} calls, target phone: ${targetPhone}`);
          }
        } else {
          const errorText = await recentCallsResponse.text().catch(() => '');
          console.warn(`⚠️ Failed to query Taalk API for calls: ${recentCallsResponse.status} - ${errorText.substring(0, 200)}`);
        }
      } catch (error: any) {
        console.error(`❌ Error searching Taalk API: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
      }
    }

    // CRITICAL: Don't proceed if we don't have a valid Taalk call ID
    if (!taalkCallId) {
      const errorMsg = `No Taalk call ID found for transaction ${transaction_id}. Tried metadata.sessionID, metadata.taalk_call_id, vdp_call.sessionID (${vdpCall?.sessionID || 'N/A'}), vdp_call.leadid (${vdpCall?.leadid || 'N/A'}), and API search with phone ${vdpCall?.phone || 'N/A'}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    // No valid Taalk session ID = no recording. Do not proceed.
    if (!/^[0-9a-fA-F]{24}$/.test(taalkCallId) && !taalkCallId.startsWith('taalk_')) {
      throw new Error(`Invalid Taalk call ID (no recording): ${taalkCallId}. Must be 24-char hex or taalk_ prefix.`);
    }

    // Create initial analysis record
    // Handle potential duplicates by getting the first one
    const { data: existingAnalyses, error: existingError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id')
      .eq('billing_transaction_id', transaction_id)
      .limit(1);

    if (existingError) {
      console.error(`❌ Error checking existing analysis for ${transaction_id}:`, existingError);
      throw new Error(`Database error: ${existingError.message}`);
    }

    const existingAnalysis = existingAnalyses && existingAnalyses.length > 0 ? existingAnalyses[0] : null;

    if (existingAnalysis) {
      const { error: updateError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .update({ analysis_status: 'analyzing' })
        .eq('id', existingAnalysis.id);
      
      if (updateError) {
        console.error(`❌ Error updating analysis status for ${transaction_id}:`, updateError);
        throw new Error(`Database update error: ${updateError.message}`);
      }
      console.log(`✅ Updated existing analysis record to 'analyzing' for ${transaction_id}`);
    } else {
      // CRITICAL: Don't create blank record - only create AFTER we have data
      // This prevents 1000 blank records if downloads fail
      console.log(`📝 Will create analysis record after downloading data for ${transaction_id}`);
    }

    // Fetch transcript, recording, and call details (including duration) from Taalk API
    let transcript: string | null = null;
    let recordingUrl: string | null = null;
    let callDuration: number | null = null;

    try {
      // Fetch call details from Taalk API to get duration
      const callDetailsUrl = `https://api.taalk.ai/api/calls/${taalkCallId}?db=michaelmandella`;
      console.log(`📞 Fetching call details from Taalk API...`);
      
      let callDetailsResponse = await fetch(callDetailsUrl, {
        headers: { 
          'Authorization': `Bearer ${taalkApiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!callDetailsResponse.ok) {
        const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
        callDetailsResponse = await fetch(callDetailsUrl, {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json'
          }
        });
      }

      if (callDetailsResponse.ok) {
        const callData = await callDetailsResponse.json();
        const callInfo = callData.payload || callData;
        
        // Duration is in milliseconds from Taalk API, convert to seconds
        if (callInfo.duration !== undefined && callInfo.duration !== null) {
          callDuration = Math.round(callInfo.duration / 1000); // Convert milliseconds to seconds
          console.log(`✅ Call duration: ${callDuration} seconds (${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')})`);
        }
      } else {
        console.warn(`⚠️ Could not fetch call details for duration: ${callDetailsResponse.status}`);
      }

      // Fallback to vdp_calls duration if available
      if (!callDuration && vdpCall?.duration) {
        const vdpDuration = parseFloat(vdpCall.duration);
        if (!isNaN(vdpDuration)) {
          callDuration = Math.round(vdpDuration);
          console.log(`✅ Using duration from vdp_calls: ${callDuration} seconds`);
        }
      }

      // Fetch transcript from Taalk API (EXACT SAME AS VERIFICATION CALLS)
      const transcriptUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/transcript?db=michaelmandella`;
      console.log(`📝 Fetching transcript from Taalk API...`);
      
      let transcriptResponse = await fetch(transcriptUrl, {
        headers: { 
          'Authorization': `Bearer ${taalkApiKey}`,
          'Accept': 'text/plain, text/*, */*'
        }
      });

      // Fallback to basic auth if bearer fails (EXACT SAME AS VERIFICATION CALLS)
      if (!transcriptResponse.ok) {
        const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
        transcriptResponse = await fetch(transcriptUrl, {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'text/plain, text/*, */*'
          }
        });
      }

      if (transcriptResponse.ok) {
        transcript = await transcriptResponse.text();
        console.log(`✅ Transcript fetched from Taalk: ${transcript.length} characters`);
      } else {
        console.warn(`⚠️ Transcript not available for call ${taalkCallId}: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
      }

      // Download recording from Taalk and upload to Supabase storage (EXACT SAME AS VERIFICATION CALLS)
      const taalkRecordingUrl = `https://api.taalk.ai/api/calls/${taalkCallId}/recording?db=michaelmandella`;
      console.log(`🎵 Downloading Taalk recording for call ${taalkCallId}...`);
      
      try {
        // Try Bearer token auth first
        let response = await fetch(taalkRecordingUrl, {
          headers: {
            'Authorization': `Bearer ${taalkApiKey}`,
            'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
          }
        });
        
        // Fallback to basic auth if bearer fails
        if (!response.ok) {
          const basicAuth = Buffer.from('michaelmandella@aoglobelife.com:Aoletsgrow24!').toString('base64');
          response = await fetch(taalkRecordingUrl, {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
            }
          });
        }
        
        if (!response.ok) {
          console.warn(`⚠️ Recording not available for call ${taalkCallId}: ${response.status} ${response.statusText}`);
          recordingUrl = null;
        } else {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
          const sizeKB = (buffer.length / 1024).toFixed(2);
          console.log(`✅ Downloaded ${sizeMB} MB (${sizeKB} KB) from Taalk`);
          
          // Always upload to Supabase (Supabase URL for every Taalk recording we get)
          const fileName = `call-analysis/${taalkCallId}.mp3`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('verify_agent_screenshot')
            .upload(fileName, buffer, {
              contentType: 'audio/mpeg',
              upsert: true
            });
          
          if (uploadError) {
            console.error(`❌ Supabase Storage upload failed:`, uploadError);
            recordingUrl = null;
          } else {
            console.log(`☁️ Uploaded to Supabase: ${fileName}`);
            
            const { data: signedData, error: signedError } = await supabaseAdmin.storage
              .from('verify_agent_screenshot')
              .createSignedUrl(fileName, 63072000);
            
            if (signedError || !signedData?.signedUrl) {
              console.error(`❌ Failed to generate signed URL:`, signedError);
              recordingUrl = null;
            } else {
              recordingUrl = signedData.signedUrl;
              console.log(`✅ RECORDING SAVED: ${fileName} - Signed URL generated`);
            }
          }
        }
      } catch (downloadError: any) {
        console.error(`❌ Error downloading/storing recording:`, downloadError);
        recordingUrl = null;
      }
    } catch (error: any) {
      console.error(`❌ Error fetching from Taalk API for ${taalkCallId}:`, error.message);
      // Don't throw here - we'll try to continue with what we have
      console.warn(`⚠️ Continuing without transcript/recording - will try to analyze with available data`);
    }

    // Import and use call analytics analyzer
    const { callAnalyticsAnalyzer } = await import('./call-analytics-analyzer');

    let analysis;
    if (transcript && transcript.trim().length > 0) {
      // Use existing transcript
      console.log(`📝 Analyzing transcript for ${transaction_id}...`);
      analysis = await callAnalyticsAnalyzer.analyzeTranscriptOnly(transcript);
    } else if (recordingUrl && taalkCallId) {
      // Transcribe and analyze from recording (now using Supabase storage URL)
      console.log(`🎤 Transcribing and analyzing recording for ${transaction_id}...`);
      console.log(`   Using Supabase storage URL`);
      analysis = await callAnalyticsAnalyzer.analyzeAudioFromUrl(recordingUrl, null); // No API key needed for Supabase URLs
    } else {
      throw new Error(`No transcript or recording available for analysis. taalkCallId: ${taalkCallId}, recordingUrl: ${recordingUrl}`);
    }

    // Save analysis to database
    // CRITICAL: Check for existing record (might have been created earlier or by another process)
    const { data: finalCheckRows, error: finalCheckError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id')
      .eq('billing_transaction_id', transaction_id)
      .limit(1);

    if (finalCheckError) {
      console.error(`❌ Error checking for existing record before save: ${finalCheckError.message}`);
      throw new Error(`Database error: ${finalCheckError.message}`);
    }

    const finalCheck = finalCheckRows && finalCheckRows.length > 0 ? finalCheckRows[0] : null;
    
    // CRITICAL: Require Supabase recording URL for every saved row; need transcript or recording to analyze
    if (!transcript && !recordingUrl) {
      console.error(`❌ No transcript or recording for ${transaction_id} - skipping`);
      throw new Error(`No transcript or recording available for analysis`);
    }
    if (!recordingUrl) {
      console.error(`❌ No Supabase recording URL for ${transaction_id} - skipping (Taalk recording missing or upload failed)`);
      throw new Error(`No Supabase recording URL - cannot save without recording`);
    }

    const analysisData = {
      billing_transaction_id: transaction_id,
      agent_email: agent_email,
      call_date: transaction_date,
      taalk_call_id: taalkCallId,
      recording_url: recordingUrl,
      call_duration: callDuration, // Duration in seconds
      transcript: transcript || analysis.transcript, // Store original Taalk transcript if available, otherwise use analysis transcript
      transcript_source: transcript ? 'taalk_api' : 'ai_transcription',
      ai_analysis: analysis,
      call_score: analysis.scorecard.overallScore,
      scorecard_results: analysis.scorecard,
      coaching_notes: analysis.coachingNotes?.join('\n') || null,
      key_topics: analysis.keyTopics,
      objections_detected: analysis.objectionsDetected,
      sentiment_score: analysis.sentimentScore,
      sentiment_label: analysis.sentiment,
      agent_talk_time_pct: analysis.agentTalkTimePct,
      client_engagement_level: analysis.clientEngagementLevel,
      call_outcome: analysis.callOutcome,
      call_outcome_confidence: analysis.callOutcomeConfidence,
      outcome: applyInstantPresentationDurationRule(analysis.outcome, (row as any)?.call_duration ?? null),
      compliance_flags: analysis.complianceFlags,
      key_moments: analysis.keyMoments,
      analyzed_at: new Date().toISOString(),
      analysis_status: 'completed',
      analysis_model: 'gpt-4o-mini',
      analysis_version: '1.0'
    };

    if (finalCheck) {
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .update(analysisData)
        .eq('id', finalCheck.id)
        .select()
        .single();
      
      if (updateError) {
        console.error(`❌ Error updating analysis for ${transaction_id}:`, updateError);
        throw new Error(`Database update error: ${updateError.message}`);
      }
      console.log(`✅ Updated analysis record for ${transaction_id}:`, updatedData?.id);
    } else {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .insert(analysisData)
        .select()
        .single();
      
      if (insertError) {
        // If insert fails due to duplicate, try update instead
        if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
          console.warn(`⚠️ Insert failed due to duplicate, trying update instead...`);
          const { data: existingRecord } = await supabaseAdmin
            .from('taalk_call_analytics')
            .select('id')
            .eq('billing_transaction_id', transaction_id)
            .maybeSingle();
          
          if (existingRecord) {
            const { error: updateError } = await supabaseAdmin
              .from('taalk_call_analytics')
              .update(analysisData)
              .eq('id', existingRecord.id);
            
            if (updateError) {
              throw new Error(`Database update error after duplicate insert: ${updateError.message}`);
            }
            console.log(`✅ Updated existing record after duplicate insert attempt: ${existingRecord.id}`);
          } else {
            throw new Error(`Database insert error: ${insertError.message}`);
          }
        } else {
          console.error(`❌ Error inserting analysis for ${transaction_id}:`, insertError);
          throw new Error(`Database insert error: ${insertError.message}`);
        }
      } else {
        console.log(`✅ Inserted analysis record for ${transaction_id}:`, insertedData?.id);
      }
    }

    // Upload full transcript to Supabase Storage
    const fullTranscript = transcript || analysis.transcript || '';
    await uploadTranscriptToSupabase(transaction_id, fullTranscript);

    console.log(`✅ Successfully analyzed call ${transaction_id} - Score: ${analysis.scorecard.overallScore}`);
  }
}

// Export singleton instance
export const callAnalyticsScheduler = new CallAnalyticsScheduler();
