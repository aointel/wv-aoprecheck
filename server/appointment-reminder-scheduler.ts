/**
 * appointment-reminder-scheduler.ts
 * Checks every 5 minutes for appointments needing reminder SMS.
 *
 * 3-stage reminder logic:
 *   Stage 1 (reminders_sent=0): 23-25h before → lead 24h reminder
 *   Stage 2 (reminders_sent=1): 50-70min before → lead 1h reminder
 *   Stage 3 (reminders_sent=2): 10-20min before → lead 15min reminder
 */
import { supabaseAdmin } from './supabase';
import { sendAppointmentReminder } from './appointment-sms';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let _timer: ReturnType<typeof setInterval> | null = null;

async function runReminders(): Promise<void> {
  if (!supabaseAdmin) return;

  try {
    const now = new Date();
    // Fetch all upcoming appointments with pending outcome that may need reminders
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const baseSelect = 'id, lead_name, lead_phone, lead_state, agent_name, agent_phone, start_time, zoom_join_url, zoom_password, reminders_sent, confirmation_status, outcome';
    const withMeetingLinkSelect = `${baseSelect}, meeting_link`;
    const runSelect = async (selectClause: string) =>
      supabaseAdmin
        .from('appointments')
        .select(selectClause)
        .in('status', ['scheduled', 'confirmed'])
        .eq('confirmation_status', 'sent')
        .or('outcome.eq.pending,outcome.is.null')
        .lte('start_time', in25h.toISOString())
        .gt('start_time', now.toISOString());

    let { data: candidates, error } = await runSelect(withMeetingLinkSelect);
    const missingMeetingLinkColumn =
      !!error &&
      /meeting_link/i.test(String(error.message || '')) &&
      /(does not exist|schema cache)/i.test(String(error.message || ''));
    if (missingMeetingLinkColumn) {
      const fallback = await runSelect(baseSelect);
      candidates = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('[appt-reminder] query error:', error.message);
      return;
    }
    if (!candidates || candidates.length === 0) return;

    for (const appt of candidates) {
      const startTime = new Date(appt.start_time);
      const msUntil = startTime.getTime() - now.getTime();
      const hoursUntil = msUntil / (1000 * 60 * 60);
      const minutesUntil = msUntil / (1000 * 60);
      const remindersSent = appt.reminders_sent ?? 0;
      const zoomLink = appt.zoom_join_url ?? appt.meeting_link ?? null;

      // ── Stage 1: 24h reminder (window: 23–25h before, not yet sent) ──────
      if (remindersSent === 0 && hoursUntil >= 23 && hoursUntil <= 25) {
        const clientSent = await sendAppointmentReminder(
          { leadName: appt.lead_name, leadPhone: appt.lead_phone, leadState: appt.lead_state, agentName: appt.agent_name, startTime: appt.start_time, zoomLink, zoomPassword: (appt as any).zoom_password },
          24,
        );
        if (clientSent) {
          await supabaseAdmin.from('appointments').update({ reminders_sent: 1, updated_at: now.toISOString() }).eq('id', appt.id);
          console.log(`[appt-reminder] ✅ stage-1 (24h) sent for appt ${appt.id}`);
        }
        continue;
      }

      // ── Stage 2: 1h reminder (window: 50–70min before, stage 1 done) ─────
      if (remindersSent === 1 && minutesUntil >= 50 && minutesUntil <= 70) {
        const clientSent = await sendAppointmentReminder(
          { leadName: appt.lead_name, leadPhone: appt.lead_phone, leadState: appt.lead_state, agentName: appt.agent_name, startTime: appt.start_time, zoomLink, zoomPassword: (appt as any).zoom_password },
          1,
        );
        if (clientSent) {
          await supabaseAdmin.from('appointments').update({ reminders_sent: 2, updated_at: now.toISOString() }).eq('id', appt.id);
          console.log(`[appt-reminder] ✅ stage-2 (1h) sent for appt ${appt.id}`);
        }
        continue;
      }

      // ── Stage 3: 15min reminder (window: 10–20min before, stage 2 done) ──
      if (remindersSent === 2 && minutesUntil >= 10 && minutesUntil <= 20) {
        const clientSent = await sendAppointmentReminder(
          { leadName: appt.lead_name, leadPhone: appt.lead_phone, leadState: appt.lead_state, agentName: appt.agent_name, startTime: appt.start_time, zoomLink, zoomPassword: (appt as any).zoom_password },
          0.25, // will display as "~0 hours" — override label below
        );
        if (clientSent) {
          await supabaseAdmin.from('appointments').update({ reminders_sent: 3, updated_at: now.toISOString() }).eq('id', appt.id);
          console.log(`[appt-reminder] ✅ stage-3 (15min) sent for appt ${appt.id}`);
        }
        continue;
      }
    }
  } catch (err: any) {
    console.error('[appt-reminder] unexpected error:', err?.message);
  }
}

export const appointmentReminderScheduler = {
  start() {
    if (_timer) return;
    console.log('[appt-reminder] starting (5-min interval, 3-stage)');
    void runReminders();
    _timer = setInterval(() => { void runReminders(); }, INTERVAL_MS);
  },
  stop() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  },
};
