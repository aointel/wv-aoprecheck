/**
 * Backfill script to migrate all historical billing transactions
 * 
 * This script processes ALL records from:
 * 1. vdp_calls (connect transactions - $8)
 * 2. verification_sessions (precheck transactions - $3)
 * 3. recruit_candidates (recruit transactions - $5)
 * 
 * Unlike the regular sync which only looks back 24 hours, this processes everything.
 */

import { supabaseAdmin } from './supabase';

type AgentInfo = {
  email: string;
  associateId: number | null;
  name: string;
};

export class BillingTransactionBackfill {
  private agentCacheByEmail = new Map<string, AgentInfo>();
  private agentCacheByAssociate = new Map<string, AgentInfo>();

  /**
   * Resolve agent info from email or associate ID (matches billing-transaction-sync.ts logic)
   */
  private async resolveAgentInfo(
    email?: string | null,
    associateIdOrName?: number | string | null,
    fallbackName?: string | null
  ): Promise<AgentInfo> {
    const normalizedEmail = email?.toLowerCase().trim() || null;
    const associateKey = associateIdOrName !== null && associateIdOrName !== undefined
      ? String(associateIdOrName).trim()
      : null;

    if (normalizedEmail && this.agentCacheByEmail.has(normalizedEmail)) {
      return this.agentCacheByEmail.get(normalizedEmail)!;
    }

    if (associateKey && this.agentCacheByAssociate.has(associateKey)) {
      return this.agentCacheByAssociate.get(associateKey)!;
    }

    let resolvedEmail = normalizedEmail;
    let resolvedAssociate: number | null = null;
    let resolvedName = fallbackName && fallbackName.trim().length > 0 ? fallbackName.trim() : null;

    if (associateKey && /^\d+$/.test(associateKey)) {
      resolvedAssociate = Number(associateKey);
    }

    if (supabaseAdmin) {
      try {
        if (resolvedEmail) {
          const { data: customerByEmail } = await supabaseAdmin
            .from('customers')
            .select('associate_id, first_name, last_name, company_email, personal_email')
            .or(`company_email.eq.${resolvedEmail},personal_email.eq.${resolvedEmail}`)
            .maybeSingle();

          if (customerByEmail) {
            resolvedAssociate = customerByEmail.associate_id ?? resolvedAssociate;
            resolvedEmail =
              (customerByEmail.company_email || customerByEmail.personal_email || resolvedEmail)?.toLowerCase() ||
              resolvedEmail;
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

        if ((!resolvedEmail || !resolvedName) && associateKey) {
          // Handle duplicates by preferring records with company_email and more complete data
          const { data: customersById } = await supabaseAdmin
            .from('customers')
            .select('associate_id, first_name, last_name, company_email, personal_email')
            .eq('associate_id', associateKey)
            .order('company_email', { ascending: false, nullsFirst: false }) // Prefer records with company_email
            .limit(1);

          const customerById = customersById && customersById.length > 0 ? customersById[0] : null;

          if (customerById) {
            resolvedAssociate = customerById.associate_id ?? resolvedAssociate;
            resolvedEmail =
              (customerById.company_email || customerById.personal_email || resolvedEmail)?.toLowerCase() ||
              resolvedEmail;
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

        if ((!resolvedEmail || !resolvedName) && associateKey) {
          const { data: hierarchy } = await supabaseAdmin
            .from('agent_hierarchy')
            .select('agent_email, agent_name, agent_associate_id')
            .eq('agent_associate_id', associateKey)
            .maybeSingle();

          if (hierarchy) {
            resolvedEmail = hierarchy.agent_email?.toLowerCase() || resolvedEmail;
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

    if (!resolvedEmail && associateKey) {
      resolvedEmail = `associate-${associateKey}@pending-lookup.aogi`;
    } else if (!resolvedEmail) {
      resolvedEmail = 'unknown@pending-lookup.aogi';
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
    const parts = [first, last].filter(Boolean);
    if (parts.length === 0) return null;
    return parts.join(' ');
  }

  /**
   * Backfill connect transactions from vdp_calls
   */
  async backfillConnectTransactions(startDate?: Date, endDate?: Date): Promise<{ processed: number; skipped: number; errors: number }> {
    console.log('📊 Backfilling connect transactions from vdp_calls...');
    
      let query = supabaseAdmin
        .from('vdp_calls')
        .select('id, agent, company_email, firstName, lastName, phone, time, updated_at, market, event, sessionID')
        .or('event.eq.END,event.eq.end')
        .not('market', 'ilike', '%aorecruit%')  // aorecruit billed separately as recruit-call transactions
        .order('updated_at', { ascending: false });
    
    if (startDate) {
      query = query.gte('updated_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('updated_at', endDate.toISOString());
    }
    
    // Process in batches
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;
    
    while (hasMore) {
      const { data: calls, error } = await query.range(offset, offset + batchSize - 1);
      
      if (error) {
        console.error('❌ Error fetching vdp_calls:', error);
        errors++;
        break;
      }
      
      if (!calls || calls.length === 0) {
        hasMore = false;
        break;
      }
      
      // Get existing transaction IDs
      const connectIds = calls
        .map(call => (typeof call.id === 'number' ? call.id : null))
        .filter((id): id is number => id !== null);
      
      if (connectIds.length === 0) {
        offset += batchSize;
        continue;
      }
      
      const { data: existingRows } = await supabaseAdmin
        .from('billing_transactions')
        .select('source_id')
        .eq('source_table', 'vdp_calls')
        .in('source_id', connectIds);
      
      const existingIds = new Set(
        (existingRows || [])
          .map(row => row.source_id)
          .filter((id): id is number => typeof id === 'number')
      );
      
      console.log(`   📊 Batch ${Math.floor(offset / batchSize) + 1}: Found ${calls.length} vdp_calls, ${existingIds.size} already exist in billing_transactions`);
      
      for (const call of calls) {
        try {
          if (typeof call.id !== 'number') {
            skipped++;
            continue;
          }
          
          if (existingIds.has(call.id)) {
            skipped++;
            continue;
          }
          
          const leadName = this.combineName(call.firstName, call.lastName);
          const transactionDate = call.time || call.updated_at || new Date().toISOString();
          
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
              skipped++;
              continue;
            }
            console.error(`❌ Failed to insert connect transaction ${call.id}:`, insertError);
            errors++;
            continue;
          }
          
          processed++;
          if (processed % 100 === 0) {
            console.log(`   📊 Processed ${processed} connect transactions...`);
          }
        } catch (error) {
          console.error(`❌ Error processing connect transaction ${call.id}:`, error);
          errors++;
        }
      }
      
      if (calls.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }
    
    console.log(`✅ Connect transactions backfill complete: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    return { processed, skipped, errors };
  }

  /**
   * Backfill precheck transactions from verification_sessions
   */
  async backfillPrecheckTransactions(startDate?: Date, endDate?: Date): Promise<{ processed: number; skipped: number; errors: number }> {
    console.log('⚠️ Precheck billing transactions are DISABLED - returning early');
    return { processed: 0, skipped: 0, errors: 0 };
    // DISABLED: Precheck billing transactions and notifications
    // console.log('📊 Backfilling precheck transactions from verification_sessions...');
    
    let query = supabaseAdmin
      .from('verification_sessions')
      .select('id, first_name, last_name, phone, associate_id, company_email, agent_first_name, agent_last_name, status, completed_at, updated_at, created_at')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });
    
    if (startDate) {
      query = query.gte('updated_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('updated_at', endDate.toISOString());
    }
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;
    
    while (hasMore) {
      const { data: sessions, error } = await query.range(offset, offset + batchSize - 1);
      
      if (error) {
        console.error('❌ Error fetching verification_sessions:', error);
        errors++;
        break;
      }
      
      if (!sessions || sessions.length === 0) {
        hasMore = false;
        break;
      }
      
      const sessionIds = sessions
        .map(session => (typeof session.id === 'number' ? session.id : null))
        .filter((id): id is number => id !== null);
      
      if (sessionIds.length === 0) {
        offset += batchSize;
        continue;
      }
      
      const { data: existingRows } = await supabaseAdmin
        .from('billing_transactions')
        .select('source_id')
        .eq('source_table', 'verification_sessions')
        .in('source_id', sessionIds);
      
      const existingIds = new Set(
        (existingRows || [])
          .map(row => row.source_id)
          .filter((id): id is number => typeof id === 'number')
      );
      
      console.log(`   📊 Batch ${Math.floor(offset / batchSize) + 1}: Found ${sessions.length} verification_sessions, ${existingIds.size} already exist in billing_transactions`);
      
      for (const session of sessions) {
        try {
          if (typeof session.id !== 'number') {
            skipped++;
            continue;
          }
          
          if (existingIds.has(session.id)) {
            skipped++;
            continue;
          }
          
          const leadName = this.combineName(session.first_name, session.last_name);
          const agentName = this.combineName(session.agent_first_name, session.agent_last_name);
          const transactionDate = session.completed_at || session.updated_at || session.created_at || new Date().toISOString();
          
          const agentInfo = await this.resolveAgentInfo(
            session.company_email,
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
          
          // DISABLED: Precheck billing transactions
          // const { error: insertError } = await supabaseAdmin
          //   .from('billing_transactions')
          //   .insert(payload);
          
          // if (insertError) {
          //   if (insertError.code === '23505') {
          //     skipped++;
          //     continue;
          //   }
          //   console.error(`❌ Failed to insert precheck transaction ${session.id}:`, insertError);
          //   errors++;
          //   continue;
          // }
          
          // DISABLED: Skip processing since billing is disabled
          // processed++;
          // if (processed % 100 === 0) {
          //   console.log(`   📊 Processed ${processed} precheck transactions...`);
          // }
        } catch (error) {
          console.error(`❌ Error processing precheck transaction ${session.id}:`, error);
          errors++;
        }
      }
      
      if (sessions.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }
    
    console.log(`✅ Precheck transactions backfill complete: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    return { processed, skipped, errors };
  }

  /**
   * Backfill recruit transactions from recruit_candidates
   */
  async backfillRecruitTransactions(startDate?: Date, endDate?: Date): Promise<{ processed: number; skipped: number; errors: number }> {
    console.log('📊 Backfilling recruit transactions from recruit_candidates...');

    let query = supabaseAdmin
      .from('recruit_candidates')
      .select('id, first_name, last_name, phone, agent_email, agent_id, status, created_at, updated_at')
      .order('updated_at', { ascending: false });
    
    if (startDate) {
      query = query.gte('updated_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('updated_at', endDate.toISOString());
    }
    
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;
    
    while (hasMore) {
      const { data: candidates, error } = await query.range(offset, offset + batchSize - 1);
      
      if (error) {
        console.error('❌ Error fetching recruit_candidates:', error);
        errors++;
        break;
      }
      
      if (!candidates || candidates.length === 0) {
        hasMore = false;
        break;
      }
      
      const candidateIds = candidates
        .map(candidate => candidate.id)
        .filter((id): id is string | number => id !== null && id !== undefined && id !== '');
      
      if (candidateIds.length === 0) {
        offset += batchSize;
        continue;
      }
      
      const recruitTransactionIds = candidateIds.map(id => `recruit-${id}`);
      
      const { data: existingRows } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id')
        .in('transaction_id', recruitTransactionIds);
      
      const existingIds = new Set(
        (existingRows || []).map(row => row.transaction_id)
      );
      
      for (const candidate of candidates) {
        try {
          if (candidate.id === null || candidate.id === undefined || candidate.id === '') {
            skipped++;
            continue;
          }
          const transactionId = `recruit-${candidate.id}`;
          if (existingIds.has(transactionId)) {
            skipped++;
            continue;
          }
          
          const leadName = this.combineName(candidate.first_name, candidate.last_name);
          const transactionDate = candidate.updated_at || candidate.created_at || new Date().toISOString();
          
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
            source_id: candidate.id,
            description: 'AO Recruit candidate charge',
            metadata: {
              status: candidate.status,
            },
          };
          
          const { error: insertError } = await supabaseAdmin
            .from('billing_transactions')
            .insert(payload);

          if (insertError) {
            if (insertError.code === '23505') {
              skipped++;
              continue;
            }
            console.error(`❌ Failed to insert recruit transaction ${candidate.id}:`, insertError);
            errors++;
            continue;
          }

          processed++;
          if (processed % 100 === 0) {
            console.log(`   📊 Processed ${processed} recruit transactions...`);
          }
        } catch (error) {
          console.error(`❌ Error processing recruit transaction ${candidate.id}:`, error);
          errors++;
        }
      }
      
      if (candidates.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }
    
    console.log(`✅ Recruit transactions backfill complete: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    return { processed, skipped, errors };
  }

  /**
   * Backfill recruit *connections* (per call) from vdp_calls where market = aorecruit.
   * One billing transaction per recruit call (like connect), not per candidate.
   */
  async backfillRecruitConnectionsFromVdpCalls(startDate?: Date, endDate?: Date): Promise<{ processed: number; skipped: number; errors: number }> {
    console.log('📊 Backfilling recruit connections from vdp_calls (market aorecruit)...');

    // Diagnostic: count aorecruit rows (any event) and with event=end
    const { count: countAny } = await supabaseAdmin
      .from('vdp_calls')
      .select('id', { count: 'exact', head: true })
      .ilike('market', '%aorecruit%');
    const { count: countEnd } = await supabaseAdmin
      .from('vdp_calls')
      .select('id', { count: 'exact', head: true })
      .ilike('market', '%aorecruit%')
      .or('event.eq.END,event.eq.end');
    console.log(`   🔍 vdp_calls: ${countAny ?? 0} rows with market aorecruit, ${countEnd ?? 0} with event END`);

    let query = supabaseAdmin
      .from('vdp_calls')
      .select('id, agent, company_email, firstName, lastName, phone, time, updated_at, market, event, sessionID')
      .ilike('market', '%aorecruit%')
      .or('event.eq.END,event.eq.end')
      .order('updated_at', { ascending: false });

    if (startDate) {
      query = query.gte('updated_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('updated_at', endDate.toISOString());
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;

    while (hasMore) {
      const { data: calls, error } = await query.range(offset, offset + batchSize - 1);

      if (error) {
        console.error('❌ Error fetching vdp_calls (aorecruit):', error);
        errors++;
        break;
      }

      if (!calls || calls.length === 0) {
        hasMore = false;
        break;
      }

      const callIds = calls
        .map(call => (typeof call.id === 'number' ? call.id : null))
        .filter((id): id is number => id !== null);
      const recruitCallTransactionIds = callIds.map(id => `recruit-call-${id}`);

      const { data: existingRows } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id')
        .in('transaction_id', recruitCallTransactionIds);

      const existingIds = new Set((existingRows || []).map(row => row.transaction_id));

      console.log(`   📊 Batch ${Math.floor(offset / batchSize) + 1}: ${calls.length} aorecruit calls, ${existingIds.size} already billed`);

      for (const call of calls) {
        try {
          if (typeof call.id !== 'number') {
            skipped++;
            continue;
          }
          const transactionId = `recruit-call-${call.id}`;
          if (existingIds.has(transactionId)) {
            skipped++;
            continue;
          }

          const leadName = this.combineName(call.firstName, call.lastName);
          const transactionDate = call.time || call.updated_at || new Date().toISOString();
          const agentInfo = await this.resolveAgentInfo(
            call.company_email,
            call.agent,
            leadName
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
            lead_phone: call.phone || null,
            source_table: 'vdp_calls',
            source_id: call.id,
            description: 'AO Recruit connection charge',
            metadata: {
              market: call.market ?? 'aorecruit',
              sessionID: call.sessionID ?? null,
            },
          };

          const { error: insertError } = await supabaseAdmin
            .from('billing_transactions')
            .insert(payload);

          if (insertError) {
            if (insertError.code === '23505') {
              skipped++;
              continue;
            }
            console.error(`❌ Failed to insert recruit-call transaction ${call.id}:`, insertError);
            errors++;
            continue;
          }
          processed++;
          if (processed % 100 === 0) {
            console.log(`   📊 Processed ${processed} recruit connection transactions...`);
          }
        } catch (err) {
          console.error(`❌ Error processing recruit call ${call.id}:`, err);
          errors++;
        }
      }

      if (calls.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`✅ Recruit connections (vdp_calls) backfill complete: ${processed} processed, ${skipped} skipped, ${errors} errors`);
    return { processed, skipped, errors };
  }

  /**
   * Backfill missed_call transactions from twilio_call_logs.
   * Source: calls where call_status is no-answer, busy, failed, or canceled (agent did not answer).
   * Uses owner_email as agent; resolves name/associate_id via resolveAgentInfo.
   */
  async backfillMissedCallTransactions(startDate?: Date, endDate?: Date): Promise<{ processed: number; skipped: number; errors: number }> {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin not available');
      return { processed: 0, skipped: 0, errors: 1 };
    }
    console.log('📞 Backfilling missed_call transactions from twilio_call_logs (no-answer/busy/failed/canceled)...');
    const missedStatuses = ['no-answer', 'busy', 'failed', 'canceled'];
    let query = supabaseAdmin
      .from('twilio_call_logs')
      .select('twilio_call_sid, owner_email, call_status, call_started_at, to_number, from_number')
      .in('call_status', missedStatuses)
      .not('owner_email', 'is', null)
      .order('call_started_at', { ascending: false });
    if (startDate) {
      query = query.gte('call_started_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('call_started_at', endDate.toISOString());
    }
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;
    while (hasMore) {
      const { data: calls, error } = await query.range(offset, offset + batchSize - 1);
      if (error) {
        console.error('❌ Error fetching twilio_call_logs for missed calls:', error);
        errors++;
        break;
      }
      if (!calls || calls.length === 0) {
        hasMore = false;
        break;
      }
      const sids = (calls as any[]).map(c => c.twilio_call_sid).filter(Boolean);
      const transactionIds = sids.map((sid: string) => `missed_call-tcl-${sid}`);
      const { data: existing } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id')
        .in('transaction_id', transactionIds);
      const existingSids = new Set(
        (existing || []).map((r: any) => (r.transaction_id || '').replace(/^missed_call-tcl-/, '')).filter(Boolean)
      );
      for (const call of calls as any[]) {
        const sid = call.twilio_call_sid;
        const owner = (call.owner_email || '').toString().trim().toLowerCase();
        if (!sid || !owner || !owner.includes('@')) {
          skipped++;
          continue;
        }
        if (existingSids.has(sid)) {
          skipped++;
          continue;
        }
        try {
          const agentInfo = await this.resolveAgentInfo(owner, null, null);
          const transactionDate = call.call_started_at || new Date().toISOString();
          const transactionId = `missed_call-tcl-${sid}`.slice(0, 200);
          const { error: insertErr } = await supabaseAdmin
            .from('billing_transactions')
            .insert({
              transaction_id: transactionId,
              transaction_type: 'missed_call',
              agent_email: agentInfo.email,
              agent_associate_id: agentInfo.associateId,
              agent_name: agentInfo.name,
              transaction_date: transactionDate,
              amount_usd: 4,
              credits_charged: 4,
              lead_name: null,
              lead_phone: call.to_number || call.from_number || null,
              source_table: 'twilio_call_logs',
              source_id: sid,
              description: 'Missed call (from Twilio call log)',
              metadata: { twilio_call_sid: sid, call_status: call.call_status },
            });
          if (insertErr) {
            if (insertErr.code === '23505') {
              skipped++;
            } else {
              console.error('❌ Insert missed_call failed:', insertErr.message);
              errors++;
            }
          } else {
            processed++;
            existingSids.add(sid);
          }
        } catch (e) {
          console.error('❌ Error processing missed call', sid, e);
          errors++;
        }
      }
      if (calls.length < batchSize) hasMore = false;
      else offset += batchSize;
    }
    console.log(`✅ Missed call backfill complete: ${processed} processed, ${skipped} skipped, ${errors} errors (source: twilio_call_logs)`);
    return { processed, skipped, errors };
  }

  /**
   * Backfill all transaction types
   */
  async backfillAll(startDate?: Date, endDate?: Date): Promise<{
    connect: { processed: number; skipped: number; errors: number };
    precheck: { processed: number; skipped: number; errors: number };
    recruit: { processed: number; skipped: number; errors: number };
  }> {
    console.log('🚀 Starting billing transactions backfill...');
    console.log(`📅 Date range: ${startDate?.toISOString() || 'all'} to ${endDate?.toISOString() || 'all'}`);
    console.log('');
    
    const [connectResult, precheckResult, recruitResult] = await Promise.all([
      this.backfillConnectTransactions(startDate, endDate),
      this.backfillPrecheckTransactions(startDate, endDate),
      this.backfillRecruitTransactions(startDate, endDate),
    ]);
    
    console.log('');
    console.log('✅ Billing transactions backfill complete!');
    console.log(`   Connect: ${connectResult.processed} processed, ${connectResult.skipped} skipped, ${connectResult.errors} errors`);
    console.log(`   Precheck: ${precheckResult.processed} processed, ${precheckResult.skipped} skipped, ${precheckResult.errors} errors`);
    console.log(`   Recruit: ${recruitResult.processed} processed, ${recruitResult.skipped} skipped, ${recruitResult.errors} errors`);
    
    return {
      connect: connectResult,
      precheck: precheckResult,
      recruit: recruitResult,
    };
  }
}

export const billingTransactionBackfill = new BillingTransactionBackfill();

