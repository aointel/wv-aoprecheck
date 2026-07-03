import { supabaseAdmin } from './supabase';

type AgentInfo = {
  email: string;
  associateId: number | null;
  name: string;
};

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const INITIAL_LOOKBACK_MINUTES = 90 * 24 * 60; // 90 days lookback on first run to catch all missed transactions
const CONTINUOUS_LOOKBACK_MINUTES = 24 * 60; // 24 hours on subsequent runs to catch any missed events
const MAX_INITIAL_PROCESSING = 10000; // Max records to process in initial sync to avoid timeout

/** PostgREST/Supabase default max rows per response; must page or "already billed" sets truncate at 1000. */
const EXISTING_BILLING_PAGE = 1000;

export class BillingTransactionSync {
  public timer: NodeJS.Timeout | null = null; // Made public for verification
  private isRunning = false;
  private hasCompletedInitialSync = false;
  private agentCacheByEmail = new Map<string, AgentInfo>();
  private agentCacheByAssociate = new Map<string, AgentInfo>();

  /** Full set of vdp_calls.id already present in billing_transactions (paginated — not capped at 1000). */
  private async fetchAllBilledVdpConnectSourceIds(): Promise<Set<number>> {
    if (!supabaseAdmin) return new Set();
    const set = new Set<number>();
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('billing_transactions')
        .select('source_id')
        .eq('source_table', 'vdp_calls')
        .not('source_id', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + EXISTING_BILLING_PAGE - 1);
      if (error) {
        console.error('❌ Failed to page billed connect source_ids:', error.message);
        break;
      }
      if (!data?.length) break;
      for (const row of data) {
        if (typeof row.source_id === 'number') set.add(row.source_id);
      }
      if (data.length < EXISTING_BILLING_PAGE) break;
      offset += EXISTING_BILLING_PAGE;
    }
    return set;
  }

  private async fetchAllBilledPrecheckSourceIds(): Promise<Set<number>> {
    if (!supabaseAdmin) return new Set();
    const set = new Set<number>();
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('billing_transactions')
        .select('source_id')
        .eq('source_table', 'verification_sessions')
        .not('source_id', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + EXISTING_BILLING_PAGE - 1);
      if (error) {
        console.error('❌ Failed to page billed precheck source_ids:', error.message);
        break;
      }
      if (!data?.length) break;
      for (const row of data) {
        if (typeof row.source_id === 'number') set.add(row.source_id);
      }
      if (data.length < EXISTING_BILLING_PAGE) break;
      offset += EXISTING_BILLING_PAGE;
    }
    return set;
  }

  private async fetchAllBilledRecruitTransactionIds(): Promise<Set<string>> {
    if (!supabaseAdmin) return new Set();
    const set = new Set<string>();
    let offset = 0;
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id')
        .eq('transaction_type', 'recruit')
        .like('transaction_id', 'recruit-%')
        .order('id', { ascending: true })
        .range(offset, offset + EXISTING_BILLING_PAGE - 1);
      if (error) {
        console.error('❌ Failed to page billed recruit transaction_ids:', error.message);
        break;
      }
      if (!data?.length) break;
      for (const row of data) {
        if (typeof row.transaction_id === 'string') set.add(row.transaction_id);
      }
      if (data.length < EXISTING_BILLING_PAGE) break;
      offset += EXISTING_BILLING_PAGE;
    }
    return set;
  }

  start(): void {
    if (!supabaseAdmin) {
      // warn/log are no-ops on web in NODE_ENV=production — use error so ops can see why sync never runs
      console.error('[AOIrail] billing-transaction-sync DISABLED: supabaseAdmin not configured');
      return;
    }

    if (this.timer) {
      console.error('[AOIrail] billing-transaction-sync already running (duplicate start ignored)');
      return;
    }

    console.error(
      `[AOIrail] billing-transaction-sync STARTING (initial backfill up to ${INITIAL_LOOKBACK_MINUTES / 60 / 24} days; then every 5 min)`,
    );
    this.runCycle(INITIAL_LOOKBACK_MINUTES).finally(() => {
      this.hasCompletedInitialSync = true;
      console.log(`✅ Initial billing transaction sync completed - synced last ${INITIAL_LOOKBACK_MINUTES / 60 / 24} days`);
    }).catch(error => {
      console.error('❌ Initial billing transaction sync failed:', error);
    });

    // Start the interval timer
    this.timer = setInterval(() => {
      if (!this.isRunning) {
        const lookback = this.hasCompletedInitialSync
          ? CONTINUOUS_LOOKBACK_MINUTES
          : INITIAL_LOOKBACK_MINUTES;
        console.log(`🔄 Running billing transaction sync cycle (lookback: ${lookback} minutes)`);
        this.runCycle(lookback).catch(error => {
          console.error('❌ Billing transaction sync cycle failed:', error);
        });
      } else {
        console.log('⏳ Billing transaction sync cycle skipped - previous cycle still running');
      }
    }, FIVE_MINUTES_MS);
    
    console.error(
      `[AOIrail] billing-transaction-sync timer ACTIVE — interval ${FIVE_MINUTES_MS / 1000 / 60} minutes`,
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏸️ Billing transaction sync stopped');
    }
  }

  private async runCycle(lookbackMinutes: number): Promise<void> {
    if (!supabaseAdmin) {
      return;
    }

    if (this.isRunning) {
      console.log('⏳ Previous billing transaction sync still running – skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();

    try {
      const isInitialSync = !this.hasCompletedInitialSync;
      const [connectResult, precheckResult, recruitResult] = await Promise.allSettled([
        this.syncConnectTransactions(lookbackMinutes, isInitialSync),
        // DISABLED: Precheck billing notifications and transactions
        Promise.resolve(0), // this.syncPrecheckTransactions(lookbackMinutes, isInitialSync),
        this.syncRecruitTransactions(lookbackMinutes, isInitialSync),
      ]);

      const insertedConnect =
        connectResult.status === 'fulfilled' ? connectResult.value : 0;
      const insertedPrecheck =
        precheckResult.status === 'fulfilled' ? precheckResult.value : 0;
      const insertedRecruit =
        recruitResult.status === 'fulfilled' ? recruitResult.value : 0;

      const totalInserted = insertedConnect + insertedPrecheck + insertedRecruit;
      const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);

      if (totalInserted > 0) {
        console.log(
          `💳 Billing transaction sync added ${totalInserted} records ` +
            `(connect: ${insertedConnect}, precheck: ${insertedPrecheck}, recruit: ${insertedRecruit}) ` +
            `in ${durationSec}s`
        );
      } else {
        console.log(`✅ Billing transaction sync complete – no new records found (in ${durationSec}s)`);
      }
    } catch (error) {
      console.error('❌ Billing transaction sync encountered an error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async syncConnectTransactions(lookbackMinutes: number, isInitialSync: boolean = false): Promise<number> {
    if (!supabaseAdmin) return 0;

    const since = isInitialSync ? null : new Date(Date.now() - lookbackMinutes * 60_000).toISOString();
    let totalInserted = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;
    let processedCount = 0;

    const existingSourceIds = await this.fetchAllBilledVdpConnectSourceIds();
    console.log(`  🔍 Loaded ${existingSourceIds.size} billed vdp_calls source_ids to exclude (paged; not capped at 1000)`);

    // Process in batches to handle more than 500 records
    while (hasMore && (isInitialSync ? processedCount < MAX_INITIAL_PROCESSING : true)) {
      // 🔥 CRITICAL: Check for both 'END' and 'end' (case-insensitive matching)
      // On initial sync, don't filter by date - process ALL unprocessed records
      // FIX: vdp_calls doesn't have created_at, use updated_at or time instead
      let query = supabaseAdmin
        .from('vdp_calls')
        .select(
          'id, agent, company_email, firstName, lastName, phone, time, updated_at, market, event, sessionID'
        )
        .or('event.eq.END,event.eq.end')
        .not('market', 'ilike', '%aorecruit%')  // aorecruit billed separately as recruit-call transactions
        .order('updated_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      
      if (!isInitialSync && since) {
        query = query.gte('updated_at', since);
      }

      const { data: calls, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch vdp_calls for billing sync:', error);
        break;
      }

      if (!calls || calls.length === 0) {
        hasMore = false;
        break;
      }

      // Filter out calls that already have billing transactions
      const callsToProcess = calls.filter(call => 
        typeof call.id === 'number' && !existingSourceIds.has(call.id)
      );

      if (callsToProcess.length === 0) {
        if (calls.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        continue;
      }

      let inserted = 0;

      for (const call of callsToProcess) {
        if (typeof call.id !== 'number') continue;

      const leadName = this.combineName(call.firstName, call.lastName);
      const transactionDate =
        call.time || call.updated_at || new Date().toISOString();

      const agentInfo = await this.resolveAgentInfo(
        call.company_email,
        call.agent,
        leadName
      );

      const payload = {
        transaction_id: `connect-${call.id}`,
        transaction_type: 'connect',
        agent_email: agentInfo.email,
        agent_associate_id: agentInfo.associateId,
        agent_name: agentInfo.name,
        transaction_date: transactionDate,
        amount_usd: 8.0,
        credits_charged: 8,
        lead_name: leadName,
        lead_phone: call.phone || null,
        source_table: 'vdp_calls',
        source_id: call.id,
        description: 'AO Connect charge',
        metadata: {
          market: call.market ?? null,
          sessionID: call.sessionID ?? null, // Store sessionID (Taalk call ID) in metadata
          taalk_call_id: call.sessionID ?? null, // Also store as taalk_call_id for easy lookup
        },
      };

      const { error: insertError } = await supabaseAdmin
        .from('billing_transactions')
        .insert(payload);

      if (insertError) {
        if (insertError.code === '23505') {
          continue;
        }
        console.error('❌ Failed to insert connect billing transaction:', insertError);
        continue;
      }

      // 🔥 NEW: Create notification for agent
      try {
        await this.createBillingNotification(
          agentInfo.email,
          'connect',
          payload.amount_usd,
          payload.credits_charged,
          payload.lead_name,
          payload.transaction_id
        );
      } catch (notifError) {
        console.warn('⚠️ Failed to create billing notification (non-critical):', notifError);
      }

          inserted += 1;
        totalInserted += 1;
      }

      // Check if we need to process more batches
      if (calls.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }

      processedCount += calls.length;

      if (inserted > 0) {
        console.log(`  📦 Processed batch: ${inserted} new connect transactions (offset: ${offset - batchSize}, total processed: ${processedCount})`);
      }
    }

    if (isInitialSync && processedCount >= MAX_INITIAL_PROCESSING) {
      console.log(`  ⚠️ Initial sync hit max processing limit (${MAX_INITIAL_PROCESSING}). Remaining records will be processed in next cycle.`);
    }

    return totalInserted;
  }

  private async syncPrecheckTransactions(lookbackMinutes: number, isInitialSync: boolean = false): Promise<number> {
    if (!supabaseAdmin) return 0;

    const since = isInitialSync ? null : new Date(Date.now() - lookbackMinutes * 60_000).toISOString();
    let totalInserted = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;
    let processedCount = 0;

    const existingSourceIds = await this.fetchAllBilledPrecheckSourceIds();
    console.log(`  🔍 Loaded ${existingSourceIds.size} billed verification_sessions source_ids to exclude (paged)`);

    // Process in batches to handle more than 500 records
    while (hasMore && (isInitialSync ? processedCount < MAX_INITIAL_PROCESSING : true)) {
      // On initial sync, don't filter by date - process ALL unprocessed records
      let query = supabaseAdmin
        .from('verification_sessions')
        .select(
          'id, first_name, last_name, phone, associate_id, agent_email, company_email, agent_first_name, agent_last_name, status, completed_at, updated_at, created_at'
        )
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      
      if (!isInitialSync && since) {
        query = query.gte('created_at', since);
      }

      const { data: sessions, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch verification sessions for billing sync:', error);
        break;
      }

      if (!sessions || sessions.length === 0) {
        hasMore = false;
        break;
      }

      // Filter out sessions that already have billing transactions
      const sessionsToProcess = sessions.filter(session => 
        typeof session.id === 'number' && !existingSourceIds.has(session.id)
      );

      if (sessionsToProcess.length === 0) {
        if (sessions.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        continue;
      }

      let inserted = 0;

      for (const session of sessionsToProcess) {
        if (typeof session.id !== 'number') continue;

      const leadName = this.combineName(session.first_name, session.last_name);
      const agentName = this.combineName(session.agent_first_name, session.agent_last_name);
      const transactionDate =
        session.completed_at || session.updated_at || session.created_at || new Date().toISOString();

      const agentInfo = await this.resolveAgentInfo(
        session.agent_email || session.company_email,
        session.associate_id,
        agentName
      );

      const payload = {
        transaction_id: `precheck-${session.id}`,
        transaction_type: 'precheck',
        agent_email: agentInfo.email,
        agent_associate_id: agentInfo.associateId,
        agent_name: agentInfo.name,
        transaction_date: transactionDate,
        amount_usd: 3.0,
        credits_charged: 3,
        lead_name: leadName,
        lead_phone: session.phone || null,
        source_table: 'verification_sessions',
        source_id: session.id,
        description: 'AO PreCheck verification charge',
        metadata: {
          status: session.status,
          completedAt: session.completed_at,
        },
      };

      // DISABLED: Precheck billing transactions and notifications
      // const { error: insertError } = await supabaseAdmin
      //   .from('billing_transactions')
      //   .insert(payload);

      // if (insertError) {
      //   if (insertError.code === '23505') {
      //     continue;
      //   }
      //   console.error('❌ Failed to insert precheck billing transaction:', insertError);
      //   continue;
      // }

      // DISABLED: Precheck billing notifications
      // try {
      //   await this.createBillingNotification(
      //     agentInfo.email,
      //     'precheck',
      //     payload.amount_usd,
      //     payload.credits_charged,
      //     payload.lead_name,
      //     payload.transaction_id
      //   );
      // } catch (notifError) {
      //   console.warn('⚠️ Failed to create billing notification (non-critical):', notifError);
      // }

        inserted += 1;
        totalInserted += 1;
      }

      processedCount += sessions.length;

      // Check if we need to process more batches
      if (sessions.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }

      if (inserted > 0) {
        console.log(`  📦 Processed batch: ${inserted} new precheck transactions (offset: ${offset - batchSize}, total processed: ${processedCount})`);
      }
    }

    if (isInitialSync && processedCount >= MAX_INITIAL_PROCESSING) {
      console.log(`  ⚠️ Initial sync hit max processing limit (${MAX_INITIAL_PROCESSING}). Remaining records will be processed in next cycle.`);
    }

    return totalInserted;
  }

  private async syncRecruitTransactions(lookbackMinutes: number, isInitialSync: boolean = false): Promise<number> {
    if (!supabaseAdmin) return 0;

    const since = isInitialSync ? null : new Date(Date.now() - lookbackMinutes * 60_000).toISOString();
    let totalInserted = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;
    let processedCount = 0;

    const existingTransactionIds = await this.fetchAllBilledRecruitTransactionIds();
    console.log(`  🔍 Loaded ${existingTransactionIds.size} billed recruit transaction_ids to exclude (paged)`);

    // Process in batches to handle more than 500 records
    while (hasMore && (isInitialSync ? processedCount < MAX_INITIAL_PROCESSING : true)) {
      // On initial sync, don't filter by date - process ALL unprocessed records
      let query = supabaseAdmin
        .from('recruit_candidates')
        .select(
          'id, first_name, last_name, phone, agent_email, agent_id, status, created_at, updated_at'
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      
      if (!isInitialSync && since) {
        query = query.gte('created_at', since);
      }

      const { data: candidates, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch recruit candidates for billing sync:', error);
        break;
      }

      if (!candidates || candidates.length === 0) {
        hasMore = false;
        break;
      }

      // Filter out candidates that already have billing transactions
      const candidatesToProcess = candidates.filter(candidate => {
        if (!candidate.id) return false;
        const transactionId = `recruit-${candidate.id}`;
        return !existingTransactionIds.has(transactionId);
      });

      if (candidatesToProcess.length === 0) {
        if (candidates.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
        }
        continue;
      }

      let inserted = 0;

      for (const candidate of candidatesToProcess) {
        if (!candidate.id) continue;
        const transactionId = `recruit-${candidate.id}`;

      const leadName = this.combineName(candidate.first_name, candidate.last_name);
      const transactionDate = candidate.created_at || candidate.updated_at || new Date().toISOString();

      const agentInfo = await this.resolveAgentInfo(
        candidate.agent_email,
        candidate.agent_id,
        null
      );

      const payload = {
        transaction_id: transactionId,
        transaction_type: 'recruit',
        agent_email: agentInfo.email,
        agent_associate_id: agentInfo.associateId,
        agent_name: agentInfo.name,
        transaction_date: transactionDate,
        amount_usd: 5.0,
        credits_charged: 5,
        lead_name: leadName,
        lead_phone: candidate.phone || null,
        source_table: 'recruit_candidates',
        source_id: String(candidate.id),
        description: 'AO Recruit candidate charge',
        metadata: {
          recruit_candidate_id: candidate.id,
          status: candidate.status,
        },
      };

      const { error: insertError } = await supabaseAdmin
        .from('billing_transactions')
        .insert(payload);

      if (insertError) {
        if (insertError.code === '23505') {
          continue;
        }
        console.error('❌ Failed to insert recruit billing transaction:', insertError);
        continue;
      }

      try {
        await this.createBillingNotification(
          agentInfo.email,
          'recruit',
          payload.amount_usd,
          payload.credits_charged,
          payload.lead_name,
          payload.transaction_id
        );
      } catch (notifError) {
        console.warn('⚠️ Failed to create billing notification (non-critical):', notifError);
      }

        inserted += 1;
        totalInserted += 1;
      }

      processedCount += candidates.length;

      // Check if we need to process more batches
      if (candidates.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }

      if (inserted > 0) {
        console.log(`  📦 Processed batch: ${inserted} new recruit transactions (offset: ${offset - batchSize}, total processed: ${processedCount})`);
      }
    }

    if (isInitialSync && processedCount >= MAX_INITIAL_PROCESSING) {
      console.log(`  ⚠️ Initial sync hit max processing limit (${MAX_INITIAL_PROCESSING}). Remaining records will be processed in next cycle.`);
    }

    return totalInserted;
  }

  private async resolveAgentInfo(
    email?: string | null,
    associateId?: string | number | null,
    fallbackName?: string | null
  ): Promise<AgentInfo> {
    const normalizedEmail = email?.toLowerCase().trim() || null;
    const associateKey = associateId !== null && associateId !== undefined
      ? String(associateId).trim()
      : null;

    if (normalizedEmail && this.agentCacheByEmail.has(normalizedEmail)) {
      return this.agentCacheByEmail.get(normalizedEmail)!;
    }

    if (associateKey && this.agentCacheByAssociate.has(associateKey)) {
      return this.agentCacheByAssociate.get(associateKey)!;
    }

    let resolvedEmail = normalizedEmail;
    let resolvedAssociate: number | null = null;
    let resolvedName =
      fallbackName && fallbackName.trim().length > 0 ? fallbackName.trim() : null;

    if (associateKey && /^\d+$/.test(associateKey)) {
      resolvedAssociate = Number(associateKey);
    }

    if (supabaseAdmin) {
      try {
        // 1) If we have an email, enrich with customers but NEVER downgrade to unknown
        if (resolvedEmail) {
          const { data: customerByEmail } = await supabaseAdmin
            .from('customers')
            .select('associate_id, first_name, last_name, company_email, personal_email')
            .or(`company_email.eq.${resolvedEmail},personal_email.eq.${resolvedEmail}`)
            .maybeSingle();

          if (customerByEmail) {
            resolvedAssociate = customerByEmail.associate_id ?? resolvedAssociate;
            // Prefer the formal company/personal email from customers if present (normalized)
            const enrichedEmail = (customerByEmail.company_email || customerByEmail.personal_email)?.toLowerCase();
            if (enrichedEmail) {
              resolvedEmail = enrichedEmail;
            }
            if (!resolvedName) {
              const name = this.combineName(
                customerByEmail.first_name,
                customerByEmail.last_name
              );
              if (name) {
                resolvedName = name;
              }
            }
          }
        }

        // 2) If we have associate_id, enrich with customers/agent_hierarchy but NEVER overwrite known values with unknowns
        if (associateKey) {
          // Handle duplicates by preferring records with company_email
          const { data: customersById } = await supabaseAdmin
            .from('customers')
            .select('associate_id, first_name, last_name, company_email, personal_email')
            .eq('associate_id', associateKey)
            .order('company_email', { ascending: false, nullsFirst: false }) // Prefer records with company_email
            .limit(1);

          const customerById = customersById && customersById.length > 0 ? customersById[0] : null;

          if (customerById) {
            resolvedAssociate = customerById.associate_id ?? resolvedAssociate;
            const enrichedEmail = (customerById.company_email || customerById.personal_email)?.toLowerCase();
            if (!resolvedEmail && enrichedEmail) {
              resolvedEmail = enrichedEmail;
            }
            if (!resolvedName) {
              const name = this.combineName(
                customerById.first_name,
                customerById.last_name
              );
              if (name) {
                resolvedName = name;
              }
            }
          }
        }

        if (associateKey) {
          const { data: hierarchy } = await supabaseAdmin
            .from('agent_hierarchy')
            .select('agent_email, agent_name, agent_associate_id')
            .eq('agent_associate_id', associateKey)
            .maybeSingle();

          if (hierarchy) {
            const hEmail = hierarchy.agent_email?.toLowerCase();
            if (!resolvedEmail && hEmail) {
              resolvedEmail = hEmail;
            }
            if (!resolvedName && hierarchy.agent_name) {
              resolvedName = hierarchy.agent_name;
            }
            if (!resolvedAssociate && hierarchy.agent_associate_id) {
              resolvedAssociate = Number(hierarchy.agent_associate_id);
            }
          }
        }
      } catch (lookupError) {
        console.warn('⚠️ Agent resolution lookup failed:', lookupError);
      }
    }

    // Finalize: if we still don't have email, try to form a deterministic placeholder from associate ID.
    if (!resolvedEmail) {
      if (associateKey) {
        resolvedEmail = `associate-${associateKey}@pending-lookup.aogi`;
      } else {
        // Only emit unknown when BOTH email and associate id are missing
        resolvedEmail = 'unknown@pending-lookup.aogi';
      }
    }

    if (!resolvedAssociate && associateKey && /^\d+$/.test(associateKey)) {
      resolvedAssociate = Number(associateKey);
    }

    if (!resolvedName) {
      resolvedName = resolvedEmail.split('@')[0];
    }

    const info: AgentInfo = {
      email: resolvedEmail,
      associateId: resolvedAssociate,
      name: resolvedName,
    };

    this.agentCacheByEmail.set(info.email, info);
    if (associateKey) {
      this.agentCacheByAssociate.set(associateKey, info);
    }

    return info;
  }

  private combineName(first?: string | null, last?: string | null): string | null {
    const parts = [first, last].filter(Boolean).map(value => value!.trim());
    if (parts.length === 0) return null;
    return parts.join(' ');
  }

  /**
   * Create a billing notification for an agent
   */
  private async createBillingNotification(
    agentEmail: string,
    transactionType: 'connect' | 'precheck' | 'recruit',
    amountUsd: number,
    creditsCharged: number,
    leadName: string | null,
    transactionId: string
  ): Promise<void> {
    if (!supabaseAdmin) return;

    const serviceNames: Record<string, string> = {
      connect: 'AO Connect',
      precheck: 'AO PreCheck',
      recruit: 'AO Recruit',
    };

    const serviceName = serviceNames[transactionType] || transactionType;
    const leadDisplay = leadName ? ` for ${leadName}` : '';

    const { error } = await supabaseAdmin
      .from('agent_notifications')
      .insert({
        agent_email: agentEmail.toLowerCase(),
        notification_type: 'billing_transaction',
        title: `${serviceName} Charge`,
        message: `You were charged $${amountUsd.toFixed(2)} (${creditsCharged} credits)${leadDisplay}`,
        read: false,
        metadata: {
          transaction_type: transactionType,
          transaction_id: transactionId,
          amount_usd: amountUsd,
          credits_charged: creditsCharged,
          lead_name: leadName,
        },
      });

    if (error) {
      console.error('❌ Failed to create billing notification:', error);
      throw error;
    }
  }
}

export const billingTransactionSync = new BillingTransactionSync();

