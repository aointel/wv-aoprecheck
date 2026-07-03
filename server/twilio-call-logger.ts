// Twilio Call Logger - Actually logs calls to Supabase
import { supabaseAdmin } from './supabase';
import { upsertTwilioCallLogLocal } from './local-hot-tables';

export class TwilioCallLogger {
  constructor() {
    console.log('TwilioCallLogger initialized');
  }
  
  /** Log a call — writes to local Postgres only, not Supabase */
  static async logCall(callData) {
    try {
      const {
        twilioCallSid, direction = 'outbound', fromNumber, toNumber,
        status, ownerEmail, agentIdentity, callStartedAt, callSource = 'unknown', metadata = {}
      } = callData;

      if (!twilioCallSid) return;

      const callLogData: Record<string, unknown> = {
        twilio_call_sid: twilioCallSid,
        call_direction: direction,
        from_number: fromNumber || '',
        to_number: toNumber || '',
        call_status: status || 'initiated',
        call_duration: 0,
        owner_email: ownerEmail || 'unknown@aoglobelife.com',
        agent_identity: agentIdentity || ownerEmail || 'unknown@aoglobelife.com',
        call_started_at: callStartedAt || new Date().toISOString(),
        call_source: callSource,
        metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
        updated_at: new Date().toISOString(),
      };

      await upsertTwilioCallLogLocal(callLogData);
      console.log(`✅ TwilioCallLogger: logged call ${twilioCallSid} for ${ownerEmail} (local Postgres)`);
    } catch (error) {
      console.error('❌ TwilioCallLogger: Error logging call:', error);
    }
  }

  static normalizeDateRange(startDate?: string, endDate?: string): { startIso?: string; endIso?: string } {
    const toIso = (value?: string, isEnd = false): string | undefined => {
      if (!value) return undefined;
      const raw = String(value).trim();
      if (!raw) return undefined;

      // If caller sends YYYY-MM-DD, treat as full UTC day range.
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const suffix = isEnd ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
        return `${raw}${suffix}`;
      }

      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return undefined;
      return dt.toISOString();
    };

    return {
      startIso: toIso(startDate, false),
      endIso: toIso(endDate, true),
    };
  }

  static async getAllCalls(ownerEmail?: string, startDate?: string, endDate?: string, limit = 1000) {
    try {
      if (!supabaseAdmin) {
        console.error('❌ TwilioCallLogger.getAllCalls: supabaseAdmin not available');
        return [];
      }

      const { startIso, endIso } = TwilioCallLogger.normalizeDateRange(startDate, endDate);
      const maxRows = Math.min(Math.max(Number(limit) || 1000, 1), 5000);

      let query = supabaseAdmin
        .from('twilio_call_logs')
        .select('*')
        .order('call_started_at', { ascending: false })
        .limit(maxRows);

      if (ownerEmail) {
        query = query.eq('owner_email', String(ownerEmail).toLowerCase().trim());
      }
      if (startIso) query = query.gte('call_started_at', startIso);
      if (endIso) query = query.lte('call_started_at', endIso);

      const { data, error } = await query;
      if (error) {
        console.error('❌ TwilioCallLogger.getAllCalls query error:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('❌ TwilioCallLogger.getAllCalls error:', error);
      return [];
    }
  }

  static async getCallStats(ownerEmail?: string, startDate?: string, endDate?: string) {
    const calls = await TwilioCallLogger.getAllCalls(ownerEmail, startDate, endDate, 5000);
    const totalCalls = calls.length;
    const completedCalls = calls.filter((c: any) => String(c.call_status || '').toLowerCase() === 'completed').length;
    const answeredCalls = calls.filter((c: any) => {
      const d = Number(c.call_duration || 0);
      return Number.isFinite(d) && d > 0;
    }).length;
    const failedCalls = calls.filter((c: any) => {
      const s = String(c.call_status || '').toLowerCase();
      return s === 'failed' || s === 'busy' || s === 'no-answer' || s === 'canceled';
    }).length;
    const durations = calls
      .map((c: any) => Number(c.call_duration || 0))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    const averageDuration = durations.length
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;

    return {
      totalCalls,
      completedCalls,
      answeredCalls,
      failedCalls,
      averageDuration,
    };
  }

  static async syncExistingTwilioCalls() {
    // Implementation for syncing
    return 0;
  }

  static async clearAllCalls() {
    // Implementation for clearing
    return true;
  }

  /** Update twilio_call_logs with Twilio AMD result — writes to local Postgres only */
  static async updateAmdResult(callSid: string, params: { answeredBy: string; machineDetectionDurationMs?: number | null }, _maxRetries = 5) {
    try {
      if (!callSid) return;
      const { answeredBy, machineDetectionDurationMs } = params;
      console.log(`📞 TwilioCallLogger: Updating AMD for ${callSid}: answeredBy=${answeredBy}`);
      const update: Record<string, unknown> = {
        twilio_call_sid: callSid,
        answered_by: answeredBy || null,
        updated_at: new Date().toISOString(),
      };
      if (machineDetectionDurationMs != null) update.amd_duration_ms = machineDetectionDurationMs;
      await upsertTwilioCallLogLocal(update);
      console.log(`✅ TwilioCallLogger: AMD updated for ${callSid} (local Postgres)`);
    } catch (err) {
      console.error('❌ TwilioCallLogger: updateAmdResult error:', err);
    }
  }
}

export const twilioCallLogger = new TwilioCallLogger();
