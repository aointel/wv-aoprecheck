/**
 * Dialer Health Monitor
 * Runs hourly during business hours (8am-8pm PT).
 * Detects stuck leads, empty agent queues, and disposition failures.
 * Sends SMS alert via Twilio if issues found.
 */
import { leaseDialerPool as pool } from './db';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from './hardcoded-config';
import twilio from 'twilio';

const ALERT_PHONE = process.env.DIALER_ALERT_PHONE || '+17143560678'; // override via env
const ALERT_FROM = process.env.DIALER_ALERT_FROM_PHONE || '';
const BUSINESS_HOURS_START = 8;  // 8am PT
const BUSINESS_HOURS_END = 20;   // 8pm PT

const THRESHOLDS = {
  staleActiveLeases: 5,       // alert if >5 agents have active leases >1h
  emptyActiveAgents: 10,      // alert if >10 active agents have zero queued leads
  awaitingDisposition: 20,    // alert if >20 leads stuck as awaitingdisposition
};

function isBusinessHours(): boolean {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pt.getHours();
  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
}

async function runHealthCheck(): Promise<{ issues: string[]; stats: Record<string, number> }> {
  const issues: string[] = [];
  const stats: Record<string, number> = {};

  // 1. Stale active leases
  const staleActive = await pool.query(`
    SELECT COUNT(DISTINCT agent_email) as cnt
    FROM leasedialer_assignments
    WHERE status = 'active'
      AND assigned_at < NOW() - INTERVAL '1 hour'
  `);
  stats.staleActiveAgents = Number(staleActive.rows[0]?.cnt || 0);
  if (stats.staleActiveAgents > THRESHOLDS.staleActiveLeases) {
    issues.push(`${stats.staleActiveAgents} agents stuck on leads >1h`);
  }

  // 2. Active agents with empty queues
  const emptyQueues = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM leasedialer_client_status cs
    WHERE cs.updated_at >= NOW() - INTERVAL '15 minutes'
      AND (cs.local_leased_lead_count IS NULL OR cs.local_leased_lead_count = 0)
      AND NOT EXISTS (
        SELECT 1 FROM leasedialer_assignments la
        WHERE lower(la.agent_email) = lower(cs.agent_email)
          AND la.status IN ('active','queued')
      )
  `);
  stats.emptyActiveAgents = Number(emptyQueues.rows[0]?.cnt || 0);
  if (stats.emptyActiveAgents > THRESHOLDS.emptyActiveAgents) {
    issues.push(`${stats.emptyActiveAgents} active agents have no leads queued`);
  }

  // 3. Leads stuck as awaitingdisposition
  const awaitingDisp = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM masterlead
    WHERE lower(trim(cnresolution)) = 'awaitingdisposition'
      AND (last_contacted IS NULL OR last_contacted < NOW() - INTERVAL '2 hours')
  `);
  stats.stuckDispositions = Number(awaitingDisp.rows[0]?.cnt || 0);
  if (stats.stuckDispositions > THRESHOLDS.awaitingDisposition) {
    issues.push(`${stats.stuckDispositions} leads stuck as awaitingdisposition >2h`);
  }

  // 4. Called leads not recycling (>2h old, should be pending)
  const stuckCalled = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM masterlead
    WHERE lower(trim(coalesce(cnresolution,''))) = 'called'
      AND (cn_email IS NULL OR btrim(cn_email) = '')
      AND last_contacted < NOW() - INTERVAL '2 hours'
      AND COALESCE(btrim(taalk_lead_id::text), '') <> ''
  `);
  stats.stuckCalledLeads = Number(stuckCalled.rows[0]?.cnt || 0);
  if (stats.stuckCalledLeads > 500) {
    issues.push(`${stats.stuckCalledLeads} called leads not recycling (>2h old)`);
  }

  return { issues, stats };
}

async function sendAlert(message: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !ALERT_FROM || !ALERT_PHONE) {
    console.error('[HEALTH_MONITOR] SMS not configured - would have sent:', message);
    return;
  }
  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: message,
      from: ALERT_FROM,
      to: ALERT_PHONE,
    });
    console.error('[HEALTH_MONITOR] SMS sent:', message);
  } catch (e: any) {
    console.error('[HEALTH_MONITOR] SMS failed:', e?.message);
  }
}

let monitorTimer: ReturnType<typeof setInterval> | null = null;

export function startDialerHealthMonitor(): void {
  if (monitorTimer) return;
  if (process.env.DIALER_HEALTH_MONITOR_ENABLED === 'false') return;

  const run = async () => {
    if (!isBusinessHours()) return;
    try {
      const { issues, stats } = await runHealthCheck();
      console.error('[HEALTH_MONITOR]', stats);
      if (issues.length > 0) {
        const msg = `⚠️ ConnectNow Dialer Alert:\n${issues.join('\n')}\n${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT`;
        await sendAlert(msg);
      }
    } catch (e: any) {
      console.error('[HEALTH_MONITOR] check failed:', e?.message);
    }
  };

  // Run immediately then every hour
  setTimeout(run, 5000);
  monitorTimer = setInterval(run, 60 * 60 * 1000);
  console.error('[HEALTH_MONITOR] started (hourly, business hours only)');
}
