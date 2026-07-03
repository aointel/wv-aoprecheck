/**
 * Background schedulers, pollers, and periodic jobs.
 * Run in the web process when START_WORKERS_IN_WEB is not disabled, or via entry-worker.ts (standalone).
 * AOIntel VDP poller uses a no-op display hook — agents load leads when they ignite / poll the queue, not via server push.
 */
import { twilioAutoSync } from "./twilio-auto-sync.js";
import { isHotTablesEodOnly } from "./hot-table-mode";
const JOB_WEBHOOKS_ENABLED = String(process.env.ENABLE_ZAPIER_JOB_WEBHOOKS || "").toLowerCase() === "true";

export async function startBackgroundWorkers(): Promise<void> {
  if (process.env.ENABLE_WORKERS === "false") {
    console.log("⏭️ ENABLE_WORKERS=false — background workers not started");
    return;
  }

  // Start VDP Credit Enforcer - automatically disable VDP for agents with credits <= -10
  console.log("💰 Starting VDP Credit Enforcer...");
  try {
    const { vdpCreditEnforcer } = await import("./vdp-credit-enforcer");
    vdpCreditEnforcer.start();
    console.log("✅ VDP Credit Enforcer started - checking every 10 minutes");
  } catch (error) {
    console.warn("⚠️ VDP Credit Enforcer failed to start (non-critical):", error);
  }

  // Start Agent Availability Tracker - tracks agent availability in database
  console.log("📊 Starting Agent Availability Tracker...");
  try {
    const { agentAvailabilityTracker } = await import("./agent-availability-tracker");
    agentAvailabilityTracker.start();
    console.log("✅ Agent Availability Tracker started");
  } catch (error) {
    console.warn("⚠️ Agent Availability Tracker failed to start (non-critical):", error);
  }

  // Start Daily Verification Report Scheduler - sends email at 9 AM PST
  console.log("📧 Starting Daily Verification Report Scheduler...");
  try {
    const { startDailyReportScheduler } = await import("./verification-daily-report");
    startDailyReportScheduler();
    console.log("✅ Daily Verification Report Scheduler started");
  } catch (error) {
    console.warn("⚠️ Daily Report Scheduler failed to start (non-critical):", error);
  }

  // Helper: get states currently outside calling hours (8AM-9PM local)
  function getStatesOutsideCallingWindowNow(): string[] {
    const stateTimezones: Record<string, string> = {
      CT: 'America/New_York', ME: 'America/New_York', NH: 'America/New_York',
      VT: 'America/New_York', MA: 'America/New_York', RI: 'America/New_York',
      NY: 'America/New_York', NJ: 'America/New_York', PA: 'America/New_York',
      OH: 'America/New_York', MI: 'America/New_York', IN: 'America/New_York',
      KY: 'America/New_York', WV: 'America/New_York', VA: 'America/New_York',
      NC: 'America/New_York', SC: 'America/New_York', GA: 'America/New_York',
      FL: 'America/New_York', MD: 'America/New_York', DE: 'America/New_York',
      DC: 'America/New_York',
      IL: 'America/Chicago', WI: 'America/Chicago', MN: 'America/Chicago',
      IA: 'America/Chicago', MO: 'America/Chicago', AR: 'America/Chicago',
      LA: 'America/Chicago', MS: 'America/Chicago', AL: 'America/Chicago',
      TN: 'America/Chicago', OK: 'America/Chicago', KS: 'America/Chicago',
      NE: 'America/Chicago', SD: 'America/Chicago', ND: 'America/Chicago',
      TX: 'America/Chicago',
      MT: 'America/Denver', WY: 'America/Denver', CO: 'America/Denver',
      NM: 'America/Denver', UT: 'America/Denver', ID: 'America/Denver',
      AZ: 'America/Phoenix',
      WA: 'America/Los_Angeles', OR: 'America/Los_Angeles', CA: 'America/Los_Angeles',
      NV: 'America/Los_Angeles',
      AK: 'America/Anchorage',
      HI: 'Pacific/Honolulu',
    };
    const outside: string[] = [];
    for (const [state, tz] of Object.entries(stateTimezones)) {
      const hour = parseInt(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));
      if (hour >= 21 || hour < 8) outside.push(state); // past 9PM or before 8AM
    }
    return outside;
  }

  // Calling window sweep — release after-hours leads at 6, 7, 8, 9 PM PT
  try {
    const cron2 = await import('node-cron');
    const runCallingWindowSweep = async () => {
      try {
        const { pool } = await import('./db.js');
        // Release all queued/active assignments in states that are now outside calling hours
        const result = await pool.query(`
          WITH outside_window AS (
            UPDATE leasedialer_assignments la
            SET status = 'released',
                released_at = NOW(),
                release_reason = 'outside_calling_window_sweep',
                updated_at = NOW()
            FROM masterlead ml
            WHERE ml.id = la.lead_id
              AND la.status IN ('queued', 'active')
              AND COALESCE(NULLIF(upper(btrim(ml.taalk_state::text)), ''), NULLIF(upper(btrim(ml.state::text)), '')) = ANY($1::text[])
            RETURNING la.lead_id, la.agent_email
          )
          SELECT COUNT(*)::int AS released FROM outside_window
        `, [getStatesOutsideCallingWindowNow()]);
        console.log('[CallingWindowSweep] Released', result.rows[0]?.released, 'after-hours assignments');
      } catch (e: any) {
        console.error('[CallingWindowSweep] failed:', e?.message);
      }
    };
    // Run at 6, 7, 8, 9 PM PT
    for (const hour of [18, 19, 20, 21]) {
      cron2.default.schedule(`0 ${hour} * * *`, runCallingWindowSweep, { timezone: 'America/Los_Angeles' });
    }
    console.log('✅ Calling window sweep scheduled at 6, 7, 8, 9 PM PT');
  } catch (e: any) {
    console.warn('⚠️ Calling window sweep scheduler failed to start:', e?.message);
  }

  // AO Intel - Active Users daily report at 8 AM PT
  try {
    const cron = await import('node-cron');
    cron.default.schedule('0 8 * * *', async () => {
      try {
        const { sendAOIntelActiveUsersReport } = await import('./ao-intel-active-users-report.js');
        await sendAOIntelActiveUsersReport();
      } catch (e: any) {
        console.error('[AOIntel] Report failed:', e?.message);
      }
    }, { timezone: 'America/Los_Angeles' });
    console.log('✅ AO Intel Active Users report scheduled — daily 8 AM PT');
  } catch (e: any) {
    console.warn('⚠️ AO Intel report scheduler failed to start:', e?.message);
  }

  // Start Recruit VDP Poller to monitor vdp_calls_BLASTPICK table
  console.log("🎯 Starting Recruit VDP Poller...");
  try {
    const { recruitVDPPoller } = await import("./recruit-vdp-poller");
    recruitVDPPoller.start();
    console.log("✅ Recruit VDP Poller started - monitoring for aorecruit calls");
  } catch (error) {
    console.error("⚠️ Recruit VDP Poller failed to start (non-critical):", error);
  }

  // Start Recruit AI Summary Updater (periodically checks for missing summaries)
  console.log("🎯 Starting Recruit AI Summary Updater...");
  try {
    const { recruitAISummaryUpdater } = await import("./recruit-ai-summary-updater");
    recruitAISummaryUpdater.start();
    console.log("✅ Recruit AI Summary Updater started - will check for missing summaries every 5 minutes");
  } catch (error) {
    console.error("⚠️ Recruit AI Summary Updater failed to start (non-critical):", error);
  }

  // Start AOIntel VDP Poller to monitor vdp_calls for PICK_UP events
  console.log("🎯 Starting AOIntel VDP Poller...");
  try {
    const { aoIntelVDPPoller, setAOIntelLeadDisplayTrigger } = await import("./aointel-vdp-poller");
    setAOIntelLeadDisplayTrigger(async () => {});
    aoIntelVDPPoller.start();
    console.log("✅ AOIntel VDP Poller started - monitoring for AOIntel PICK_UP events (2s interval)");
  } catch (error) {
    console.error("⚠️ AOIntel VDP Poller failed to start (non-critical):", error);
  }

  import("./taalk-vdp-poller").then(({ taalkVDPPoller }) => {
    taalkVDPPoller.start();
    console.log("✅ Taalk VDP Poller started - polling Taalk API every 10 seconds");

    import("./vdp-agent-tracker.js")
      .then(({ vdpAgentTracker }) => {
        vdpAgentTracker.start();
        console.log("✅ VDP Agent Tracker started - real-time dial/reached/booked enabled");
      })
      .catch((err) => console.warn("⚠️ VDP Agent Tracker failed (non-critical):", err));
  }).catch((err) => console.warn("⚠️ Taalk VDP Poller failed (non-critical):", err));

  import("./recording-scheduler")
    .then(() => {
      console.log("✅ Recording scheduler started - checking every 5 minutes");
    })
    .catch((err) => console.warn("⚠️ Recording scheduler failed (non-critical):", err));

  import("./recording-url-scheduler")
    .then(() => {
      console.log("✅ Recording URL scheduler started - checking every 10 minutes");
    })
    .catch((err) => console.warn("⚠️ Recording URL scheduler failed (non-critical):", err));

  import("./hotlead-scheduler")
    .then(({ hotleadScheduler }) => {
      hotleadScheduler.startScheduler();
      console.log("✅ Hotlead scheduler started - sending leads to Zapier every 5 minutes");
    })
    .catch((err) => console.warn("⚠️ Hotlead scheduler failed (non-critical):", err));

  import("./daily-billing-recap-service")
    .then(({ DailyBillingRecapService }) => {
      DailyBillingRecapService.setupDailyRecapScheduler();
      console.log("✅ Daily billing recap scheduler started");
    })
    .catch((err) => console.warn("⚠️ Billing recap failed (non-critical):", err));

  import("./appointment-reminder-scheduler")
    .then(({ appointmentReminderScheduler }) => {
      appointmentReminderScheduler.start();
      console.log("✅ Appointment reminder scheduler started - checking every 5 minutes");
    })
    .catch((err) => console.warn("⚠️ Appointment reminder scheduler failed (non-critical):", err));

  // live_call_boardt scheduler disabled - table not in use
  // import("./live-call-board-stats-scheduler")
  //   .then(({ liveCallBoardStatsScheduler }) => {
  //     liveCallBoardStatsScheduler.start();
  //   })
  //   .catch((err) => console.warn("⚠️ live_call_boardt stats scheduler failed:", err));

  if (isHotTablesEodOnly()) {
    console.log("⏭️ Twilio auto-sync disabled in hot-table EOD-only mode");
  } else {
    try {
      twilioAutoSync.startAutoSync(60_000);
      console.log("✅ Twilio auto-sync started (every 60 seconds)");
    } catch (syncErr) {
      console.warn("⚠️ Twilio auto-sync failed to start (non-critical):", syncErr);
    }
  }

  import("./billing-transaction-sync")
    .then(({ billingTransactionSync }) => {
      if (billingTransactionSync) {
        billingTransactionSync.start();
        console.error(
          "[AOIrail] billing-transaction-sync start() invoked (connects → billing_transactions; check stderr for timer ACTIVE)",
        );
        setTimeout(() => {
          const isActive = (billingTransactionSync as { timer?: ReturnType<typeof setInterval> }).timer != null;
          if (isActive) {
            console.error("[AOIrail] billing-transaction-sync timer confirmed ACTIVE after 10s");
          } else {
            console.error("[AOIrail] billing-transaction-sync timer NOT active — retrying start()");
            billingTransactionSync.start();
          }
        }, 10000);
      } else {
        console.error("[AOIrail] billingTransactionSync instance missing — module load bug");
      }
    })
    .catch((err) => {
      console.error("❌ Billing transaction sync failed to load:", err);
      setTimeout(() => {
        import("./billing-transaction-sync")
          .then(({ billingTransactionSync }) => {
            billingTransactionSync.start();
            console.log("✅ Billing transaction sync started on retry");
          })
          .catch((retryErr) => console.error("❌ Billing transaction sync retry failed:", retryErr));
      }, 30000);
    });

  import("./verification-analysis-scheduler")
    .then(({ verificationAnalysisScheduler }) => {
      verificationAnalysisScheduler.start();
      console.log("✅ Verification analysis scheduler started - analyzing AI summaries every hour");
    })
    .catch((err) => {
      console.error("❌ CRITICAL: Verification analysis scheduler failed to start:", err);
      console.error("   AI summaries will NOT be analyzed automatically!");
    });

  import("./taalk-campaign-sync-scheduler")
    .then(({ taalkCampaignSyncScheduler }) => {
      taalkCampaignSyncScheduler.start();
      console.log("✅ Taalk campaign sync scheduler started");
    })
    .catch((err) => console.warn("⚠️ Taalk campaign sync failed (non-critical):", err));

  if (isHotTablesEodOnly()) {
    console.log("⏭️ Inbound calls Twilio sync disabled in hot-table EOD-only mode");
  } else {
    import("./inbound-calls-twilio-sync")
      .then(({ startInboundCallsTwilioSync }) => {
        startInboundCallsTwilioSync();
      })
      .catch((err) => console.warn("⚠️ Inbound calls Twilio sync failed (non-critical):", err));
  }

    // local-hot-tables-sync DISABLED - was syncing twilio_call_logs from Neon to Supabase, causing deadlocks. Neon is source of truth.

  if (JOB_WEBHOOKS_ENABLED) {
    import("./twilio-call-zapier-scheduler")
      .then(({ twilioCallZapierScheduler }) => {
        twilioCallZapierScheduler.start();
        console.log("✅ Twilio→Zapier call scheduler started - syncing every 5 minutes");
      })
      .catch((err) => console.warn("⚠️ Twilio→Zapier scheduler failed (non-critical):", err));
  } else {
    console.log("⏭️ Twilio→Zapier job scheduler disabled (ENABLE_ZAPIER_JOB_WEBHOOKS!=true)");
  }

  if (JOB_WEBHOOKS_ENABLED && process.env.BOOKED_LEADS_WEBHOOK_SENDER_ENABLED === "true") {
    import("./booked-leads-webhook-sender")
      .then(({ bookedLeadsWebhookSender }) => {
        bookedLeadsWebhookSender.start();
        console.log("✅ Call Connector Pro webhook sender started");
      })
      .catch((err) => console.warn("⚠️ Webhook sender failed (non-critical):", err));
  } else {
    console.log("⏭️ Call Connector Pro booked/long-call webhook sender disabled (job/env guard)");
  }

  import("./ftc-queue-cleaner")
    .then(({ startFTCQueueCleaner }) => {
      startFTCQueueCleaner();
      console.log("✅ FTC queue cleaner started - updates FTCRESTRICTED column every 60 minutes");
    })
    .catch((err) => console.warn("⚠️ FTC queue cleaner failed (non-critical):", err));

  import("./verification-automation-scheduler")
    .then(({ verificationAutomationScheduler }) => {
      verificationAutomationScheduler.start();
      console.log("✅ Verification Automation scheduler started - runs IP analysis every 15 minutes");
    })
    .catch((err) => console.warn("⚠️ Verification Automation scheduler failed (non-critical):", err));

  import("./presentation-lifecycle-manager")
    .then(({ presentationLifecycleManager }) => {
      presentationLifecycleManager.start();
      console.log("✅ Presentation lifecycle manager started");
    })
    .catch((err) => console.warn("⚠️ Presentation lifecycle manager failed (non-critical):", err));

  import("./ccpro-flag-sync-scheduler")
    .then(({ ccproFlagSyncScheduler }) => {
      ccproFlagSyncScheduler.start();
      console.log("✅ CCPRO flag sync scheduler started - syncs daily at 3:00 AM EST");
    })
    .catch((err) => console.warn("⚠️ CCPRO flag sync scheduler failed (non-critical):", err));

  import("./connectnow-billing-daily-scheduler")
    .then(({ connectNowBillingDailyScheduler }) => {
      connectNowBillingDailyScheduler.start();
      console.log("✅ ConnectNow Billing Daily Scheduler started - populates data daily at 12:00 AM PST");
    })
    .catch((err) => console.warn("⚠️ ConnectNow Billing Daily Scheduler failed (non-critical):", err));

  import("./activity-card-report-scheduler")
    .then(({ activityCardReportScheduler }) => {
      activityCardReportScheduler.start();
      console.log("✅ Activity card report scheduler started for Chris hierarchy pilot");
    })
    .catch((err) => console.warn("⚠️ Activity card report scheduler failed (non-critical):", err));

  // Lead Assignment Scheduler: midnight reset + every-5-min recycling of called/no_answer leads → pending
  import("./lead-assignment-scheduler")
    .then(({ leadAssignmentScheduler }) => {
      leadAssignmentScheduler.startScheduler();
      console.log("✅ Lead Assignment Scheduler started - midnight reset + 5-min cnresolution recycling");
    })
    .catch((err) => console.warn("⚠️ Lead Assignment Scheduler failed to start (non-critical):", err));

  // Recycle unowned called/no-answer leads back to pending after 1 hour
  // Runs every 5 minutes so agents always have fresh leads without waiting for midnight
  const runUnownedLeadRecycle = async () => {
    try {
      const { pool } = await import("./db.js");
      const result = await pool.query(`
        UPDATE masterlead
        SET cnresolution = 'pending',
            updated_at = NOW()
        WHERE lower(trim(coalesce(cnresolution, ''))) IN ('called', 'call', 'no_answer', 'no answer', 'no_answer_vm', 'voicemail')
          AND (cn_email IS NULL OR btrim(cn_email) = '')
          AND COALESCE(btrim(taalk_lead_id::text), '') <> ''
          AND COALESCE(lower(dnc::text), '') NOT IN ('true', '1', 'yes', 'y')
          AND NOT (lower(COALESCE(taalk_market::text, '')) LIKE '%plus%' OR lower(COALESCE(market::text, '')) LIKE '%plus%')
          AND COALESCE(updated_at, last_contacted, created_at, NOW()) < NOW() - INTERVAL '1 hour'
        RETURNING id
      `);
      if (result.rowCount && result.rowCount > 0) {
        console.log("[UNOWNED_RECYCLE] Reset " + result.rowCount + " unowned called leads to pending");
      }
    } catch (err) {
      console.warn('[UNOWNED_RECYCLE] Failed:', err && err.message);
    }
  };
  setTimeout(runUnownedLeadRecycle, 30_000);
  setInterval(runUnownedLeadRecycle, 5 * 60 * 1000);

  console.log("🚫 Call Analytics Scheduler DISABLED - OpenAI API calls turned off to prevent excessive billing");

  import("./call-analytics-disposition-model")
    .then(({ loadDispositionModelFromDb }) => {
      loadDispositionModelFromDb()
        .then(() => console.log("✅ Call analytics disposition rules loaded from DB"))
        .catch(() => {});
    })
    .catch(() => {});

  console.log("⏭️ No-answer 1-minute auto-reset loop disabled by ops");

  // Every 15 minutes: any recently failed outbound calls are force-marked failed
  // and removed from leasedialer queue so they cannot circulate.
  const runFailedLeadQueueCleanup = async () => {
    try {
      const { pool } = await import("./db.js");
      const { rows } = await pool.query(`
        WITH recent_failed_phones AS (
          SELECT DISTINCT RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10) AS phone10
          FROM twilio_call_logs t
          WHERE lower(COALESCE(t.call_status, '')) = 'failed'
            AND lower(COALESCE(t.call_direction, '')) LIKE 'outbound%'
            AND t.call_started_at >= NOW() - INTERVAL '20 minutes'
            AND length(RIGHT(REGEXP_REPLACE(COALESCE(t.to_number, ''), '\\D', '', 'g'), 10)) = 10
        ),
        target_leads AS (
          SELECT ml.id
          FROM masterlead ml
          JOIN recent_failed_phones rf
            ON (
              rf.phone10 = NULLIF(btrim(ml.phone_last10), '')
              OR rf.phone10 = RIGHT(REGEXP_REPLACE(COALESCE(ml.phone::text, ''), '\\D', '', 'g'), 10)
            )
        ),
        released AS (
          UPDATE leasedialer_assignments la
          SET status = 'released',
              released_at = NOW(),
              release_reason = 'failed_call_15m_sync',
              updated_at = NOW()
          WHERE la.status IN ('queued', 'active')
            AND la.lead_id IN (SELECT id FROM target_leads)
          RETURNING la.id
        ),
        marked_failed AS (
          UPDATE masterlead ml
          SET cnresolution = 'failed',
              updated_at = NOW()
          WHERE ml.id IN (SELECT id FROM target_leads)
            AND lower(trim(COALESCE(ml.cnresolution, ''))) <> 'failed'
          RETURNING ml.id
        )
        SELECT
          (SELECT COUNT(*)::int FROM recent_failed_phones) AS failed_phones_window,
          (SELECT COUNT(*)::int FROM released) AS queue_rows_released,
          (SELECT COUNT(*)::int FROM marked_failed) AS masterlead_rows_marked_failed
      `);

      const stats = rows?.[0] || {};
      console.log(
        `[FailedLeadCleanup/15m] failed_phones_window=${stats.failed_phones_window || 0} ` +
        `queue_rows_released=${stats.queue_rows_released || 0} ` +
        `masterlead_rows_marked_failed=${stats.masterlead_rows_marked_failed || 0}`
      );
    } catch (e: any) {
      console.warn("[FailedLeadCleanup/15m] failed (non-critical):", e?.message || e);
    }
  };

  // Immediate first pass, then every 15 minutes.
  setTimeout(() => {
    runFailedLeadQueueCleanup().catch(() => {});
  }, 10_000);
  setInterval(() => {
    runFailedLeadQueueCleanup().catch(() => {});
  }, 15 * 60 * 1000);
  console.log("✅ Failed lead queue cleanup scheduled - every 15 minutes");

  // Public live card setup — runs once in worker
  setTimeout(async () => {
    try {
      const { ensurePublicLiveCardTables, seedChrisLiveLink } = await import('./public-live-card-service.js');
      await ensurePublicLiveCardTables();
      const link = await seedChrisLiveLink();
      console.log(`[WORKER] ✅ Public live card ready at ${link.urlPath}`);
    } catch (err: any) {
      console.warn('[WORKER] ⚠️ Public live card bootstrap failed (non-critical):', err.message);
    }
  }, 10_000);

  // Run hierarchy sync once on worker startup, then every 6 hours
  const runHierarchySync = async () => {
    try {
      const { storage } = await import('./storage.js');
      await storage.syncAllProfilesToHierarchy();
      console.log('[WORKER] ✅ Agent hierarchy synced');
    } catch (err: any) {
      console.warn('[WORKER] ⚠️ Agent hierarchy sync failed (non-critical):', err.message);
    }
  };
  setTimeout(runHierarchySync, 60_000); // 60s after startup
  setInterval(runHierarchySync, 6 * 60 * 60 * 1000); // every 6 hours

  console.log("✅ Background worker bootstrap complete (schedulers may still be loading asynchronously)");
}
