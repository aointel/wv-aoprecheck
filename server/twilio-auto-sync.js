import twilio from 'twilio';
import { supabaseAdmin } from './supabase';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config';
import { leaseDialerPool as neonPool } from './db';

const BOOKED_RESOLUTIONS = [
  'booked',
  'appointment',
  'appointment_set',
  'set_appointment',
  'qualified',
  'callback_scheduled',
  'meet',
  'sale',
];

function normalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '').slice(-10);
}

export class TwilioAutoSync {
  constructor() {
    this.running = false;
    this.interval = null;
    this.lastRunAt = null;
    this.lastError = null;
    this.twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  async runOnce() {
    if (!supabaseAdmin) return;
    const startedAt = Date.now();
    try {
      let toFix = 0, dialReach = 0, booked = 0;
      try { toFix = await this.fixMissingToNumbers(36); } catch(e) { console.error('TwilioAutoSync fixMissingToNumbers failed:', e.message); }
      try { dialReach = await this.syncDialReachMetrics(24); } catch(e) { console.error('TwilioAutoSync syncDialReachMetrics failed:', e.message); }
      try { booked = await this.syncBookedMetrics(48); } catch(e) { console.error('TwilioAutoSync syncBookedMetrics failed:', e.message); }
      // Disabled: refreshLiveCallBoard causes gmt-0700 timezone error in Postgres
      // await this.refreshLiveCallBoard();
      this.lastRunAt = new Date().toISOString();
      this.lastError = null;
      console.log(`✅ TwilioAutoSync cycle complete in ${Date.now() - startedAt}ms | to_number_fixed=${toFix} dial/reach_inserted=${dialReach} booked_inserted=${booked}`);
    } catch (error) {
      this.lastRunAt = new Date().toISOString();
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('❌ TwilioAutoSync cycle failed:', error);
    }
  }

  startAutoSync(intervalMs = 60_000) {
    if (this.running) return;
    this.running = true;
    this.runOnce().catch(() => {});
    this.interval = setInterval(() => {
      this.runOnce().catch(() => {});
    }, intervalMs);
    console.log(`🔄 TwilioAutoSync started (every ${Math.round(intervalMs / 1000)}s)`);
  }

  stopAutoSync() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.running = false;
    console.log('🛑 TwilioAutoSync stopped');
  }

  // Backward compatibility with old callers
  start() {
    this.startAutoSync();
  }

  stop() {
    this.stopAutoSync();
  }

  async fixExistingAttributions() {
    return this.fixMissingToNumbers(168);
  }

  getStatus() {
    return {
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
    };
  }

  async fixMissingToNumbers(hoursBack = 36) {
    const end = new Date();
    const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1000);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const parentRows = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from('twilio_call_logs')
        .select('id,twilio_call_sid,to_number,call_started_at,call_direction')
        .gte('call_started_at', startIso)
        .lt('call_started_at', endIso)
        .eq('call_direction', 'outbound')
        .or('to_number.is.null,to_number.eq.')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      parentRows.push(...rows);
      if (rows.length < pageSize) break;
    }
    if (parentRows.length === 0) return 0;

    const parentBySid = new Map();
    for (const row of parentRows) {
      const sid = String(row.twilio_call_sid || '').trim();
      if (sid) parentBySid.set(sid, Number(row.id));
    }

    // Use ISO strings to avoid timezone offset format (GMT-0700) that Postgres rejects
    const startDate = new Date(start.toISOString());
    const endDate = new Date(end.toISOString());
    const twilioCalls = await this.twilioClient.calls.list({
      startTimeAfter: startDate,
      startTimeBefore: endDate,
      pageSize: 1000,
      limit: 100000,
    });

    const toById = new Map();
    for (const call of twilioCalls) {
      const parentSid = String(call.parentCallSid || '').trim();
      if (!parentSid) continue;
      const id = parentBySid.get(parentSid);
      const to = String(call.to || '').trim();
      if (!id || !to) continue;
      if (!toById.has(id)) toById.set(id, to);
    }

    const entries = [...toById.entries()];
    let updated = 0;
    // Batch update: group by to_number value and update all matching IDs at once
    // This replaces 200 individual concurrent UPDATEs with one UPDATE per unique to_number value
    const byToNumber = new Map();
    for (const [id, to] of entries) {
      if (!byToNumber.has(to)) byToNumber.set(to, []);
      byToNumber.get(to).push(id);
    }
    const now = new Date().toISOString();
    for (const [to, ids] of byToNumber.entries()) {
      const { error, count } = await supabaseAdmin
        .from('twilio_call_logs')
        .update({ to_number: to, updated_at: now })
        .in('id', ids);
      if (!error) updated += ids.length;
    }
    return updated;
  }

  async syncDialReachMetrics(hoursBack = 24) {
    const end = new Date();
    const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1000);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const existing = new Set();
    let offset = 0;
    while (true) {
      const { rows } = await neonPool.query(
        `SELECT call_sid, event_type FROM agent_dial_metrics WHERE source = 'twilio_auto_sync' AND event_timestamp >= $1 AND event_timestamp < $2 LIMIT 1000 OFFSET $3`,
        [startIso, endIso, offset]
      );
      for (const row of rows) {
        existing.add(`${String(row.call_sid || '')}:${String(row.event_type || '')}`);
      }
      if (rows.length < 1000) break;
      offset += 1000;
    }

    const inserts = [];
    let tclOffset = 0;
    while (true) {
      const { rows } = await neonPool.query(
        `SELECT owner_email, to_number, call_duration, call_status, call_started_at, twilio_call_sid FROM twilio_call_logs WHERE call_direction='outbound' AND call_started_at >= $1 AND call_started_at < $2 AND owner_email IS NOT NULL AND owner_email <> '' AND to_number IS NOT NULL AND to_number <> '' ORDER BY call_started_at DESC LIMIT 1000 OFFSET $3`,
        [startIso, endIso, tclOffset]
      );

      for (const row of rows) {
        const email = String(row.owner_email || '').toLowerCase().trim();
        const phone = normalizePhone(row.to_number);
        const status = String(row.call_status || '').toLowerCase();
        const duration = Number(row.call_duration || 0);
        const sid = String(row.twilio_call_sid || '').trim();
        const ts = row.call_started_at instanceof Date
          ? row.call_started_at.toISOString()
          : String(row.call_started_at || '');
        if (!email || phone.length !== 10 || !sid || !ts) continue;

        const answeredOrCompleted = status === 'answered' || status === 'completed';
        const excluded = ['failed', 'busy', 'no-answer', 'canceled'].includes(status) && !answeredOrCompleted;
        const isDial = (duration >= 1 || answeredOrCompleted) && !excluded;
        const isReach = duration >= 55 && answeredOrCompleted;

        if (isDial) {
          const key = `${sid}:dial`;
          if (!existing.has(key)) {
            existing.add(key);
            inserts.push({
              agent_email: email,
              lead_phone: phone,
              event_type: 'dial',
              event_timestamp: ts,
              call_duration: duration > 0 ? duration : null,
              call_status: status || null,
              call_sid: sid,
              source: 'twilio_auto_sync',
              disposition: null,
            });
          }
        }
        if (isReach) {
          const key = `${sid}:reach`;
          if (!existing.has(key)) {
            existing.add(key);
            inserts.push({
              agent_email: email,
              lead_phone: phone,
              event_type: 'reach',
              event_timestamp: ts,
              call_duration: duration > 0 ? duration : null,
              call_status: status || null,
              call_sid: sid,
              source: 'twilio_auto_sync',
              disposition: 'connected',
            });
          }
        }
      }

      if (rows.length < 1000) break;
      tclOffset += 1000;
    }

    const cols = ['agent_email', 'lead_phone', 'event_type', 'event_timestamp', 'call_duration', 'call_status', 'call_sid', 'source', 'disposition'];
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const placeholders = chunk.map((_, ri) =>
        `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`
      ).join(', ');
      const values = chunk.flatMap(r => cols.map(c => r[c] !== undefined ? r[c] : null));
      await neonPool.query(
        `INSERT INTO agent_dial_metrics (${cols.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      );
      inserted += chunk.length;
      await new Promise(r => setTimeout(r, 200));
    }
    return inserted;
  }

  async syncBookedMetrics(hoursBack = 48) {
    const end = new Date();
    const start = new Date(end.getTime() - hoursBack * 60 * 60 * 1000);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const existing = new Set();
    let offset = 0;
    while (true) {
      const { rows } = await neonPool.query(
        `SELECT agent_email, lead_id, lead_phone, event_timestamp FROM agent_dial_metrics WHERE event_type = 'booked' AND event_timestamp >= $1 AND event_timestamp < $2 LIMIT 1000 OFFSET $3`,
        [startIso, endIso, offset]
      );
      for (const row of rows) {
        const email = String(row.agent_email || '').toLowerCase().trim();
        const leadId = Number(row.lead_id || 0) || 0;
        const phone = normalizePhone(row.lead_phone);
        const day = String(row.event_timestamp || '').slice(0, 10);
        if (!email || !day) continue;
        if (leadId > 0) {
          existing.add(`id:${email}:${leadId}:${day}`);
        } else if (phone.length === 10) {
          existing.add(`phone:${email}:${phone}:${day}`);
        }
      }
      if (rows.length < 1000) break;
      offset += 1000;
    }

    const inserts = [];
    const resolutionPlaceholders = BOOKED_RESOLUTIONS.map((_, i) => `$${i + 3}`).join(', ');
    let mlOffset = 0;
    while (true) {
      const { rows } = await neonPool.query(
        `SELECT id, cn_email, phone, first_name, last_name, state, cnresolution, updated_at FROM masterlead WHERE cnresolution IN (${resolutionPlaceholders}) AND updated_at >= $1 AND updated_at < $2 ORDER BY updated_at DESC LIMIT 1000 OFFSET $${BOOKED_RESOLUTIONS.length + 3}`,
        [startIso, endIso, ...BOOKED_RESOLUTIONS, mlOffset]
      );
      for (const row of rows) {
        const email = String(row.cn_email || '').toLowerCase().trim();
        const phone = normalizePhone(row.phone);
        const leadId = Number(row.id || 0) || null;
        const ts = row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at || '');
        if (!email || phone.length !== 10 || !leadId || !ts) continue;
        const day = ts.slice(0, 10);
        const key = `id:${email}:${leadId}:${day}`;
        const phoneKey = `phone:${email}:${phone}:${day}`;
        if (existing.has(key)) continue;
        if (existing.has(phoneKey)) continue;
        existing.add(key);
        existing.add(phoneKey);
        inserts.push({
          agent_email: email,
          lead_id: leadId,
          lead_phone: phone,
          lead_name: `${String(row.first_name || '').trim()} ${String(row.last_name || '').trim()}`.trim() || null,
          lead_state: String(row.state || '').trim().toUpperCase() || null,
          event_type: 'booked',
          event_timestamp: ts,
          disposition: String(row.cnresolution || 'booked').toLowerCase(),
          source: 'twilio_auto_sync_booked',
          notes: 'Auto-synced from masterlead resolution',
        });
      }
      if (rows.length < 1000) break;
      mlOffset += 1000;
    }

    const cols = ['agent_email', 'lead_id', 'lead_phone', 'lead_name', 'lead_state', 'event_type', 'event_timestamp', 'disposition', 'source', 'notes'];
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const placeholders = chunk.map((_, ri) =>
        `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`
      ).join(', ');
      const values = chunk.flatMap(r => cols.map(c => r[c] !== undefined ? r[c] : null));
      await neonPool.query(
        `INSERT INTO agent_dial_metrics (${cols.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        values
      );
      inserted += chunk.length;
      await new Promise(r => setTimeout(r, 200));
    }
    return inserted;
  }

  async refreshLiveCallBoard() {
    try {
      const { liveCallBoardStatsScheduler } = await import('./live-call-board-stats-scheduler');
      await liveCallBoardStatsScheduler.triggerUpdate();
      const { rebuildAllLiveSnapshots } = await import('./public-live-card-service');
      await rebuildAllLiveSnapshots();
    } catch (error) {
      console.warn('⚠️ live_call_boardt refresh skipped:', error?.message || error);
    }
  }
}

export const twilioAutoSync = new TwilioAutoSync();
