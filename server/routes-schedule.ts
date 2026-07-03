/**
 * Master Schedule API
 * Unified agent schedule: support, meets, appointments, recruit
 * Feeds countdown timer and accountability flow
 */

import { Router } from 'express';
import { getMasterSchedule, getMasterScheduleForDay, getNextUpcomingSlot } from './master-schedule-service';
import { supabaseAdmin } from './supabase';

const router = Router();

/**
 * GET /api/schedule/master
 * Get master schedule for an agent within a date range
 * Query: agentEmail, from (ISO), to (ISO), upcoming (1 for future only)
 */
router.get('/master', async (req, res) => {
  try {
    const agentEmail = (req.query.agentEmail as string)?.trim?.();
    if (!agentEmail) {
      return res.status(400).json({ error: 'Missing agentEmail query param' });
    }
    const fromISO = (req.query.from as string)?.trim?.();
    const toISO = (req.query.to as string)?.trim?.();
    const upcomingOnly = req.query.upcoming === '1';
    const items = await getMasterSchedule(agentEmail, fromISO, toISO, upcomingOnly);
    const meetIds = items.filter((r) => r.source_table === 'meets').map((r) => r.source_id);
    let meetLinks: Record<string, string | null> = {};
    const meetPresentationSession: Record<string, string | null> = {};
    if (meetIds.length > 0 && supabaseAdmin) {
      const { data: meets } = await supabaseAdmin
        .from('meets')
        .select('id, meeting_link, presentation_session_id')
        .in('id', meetIds);
      (meets ?? []).forEach((m) => {
        meetLinks[m.id] = m.meeting_link ?? null;
        meetPresentationSession[m.id] = m.presentation_session_id ?? null;
      });
    }
    const payload = items.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      if (row.source_table === 'meets') {
        if (meetLinks[row.source_id] != null) meta.meetingLink = meetLinks[row.source_id];
        if (meetPresentationSession[row.source_id] != null) meta.presentationSessionId = meetPresentationSession[row.source_id];
      }
      return {
        id: row.id,
        slotStart: row.slot_start,
        slotEnd: row.slot_end,
        scheduleType: row.schedule_type,
        sourceTable: row.source_table,
        sourceId: row.source_id,
        title: row.title,
        description: row.description,
        metadata: meta,
      };
    });
    res.json(payload);
  } catch (e) {
    console.error('❌ Master schedule error:', e);
    res.status(500).json({ error: 'Failed to fetch master schedule' });
  }
});

/**
 * GET /api/schedule/availability
 * Get booked slots for a calendar day from master_schedule (HH:mm format for modal)
 * Query: agentEmail, date (YYYY-MM-DD), timezone (IANA, optional)
 */
router.get('/availability', async (req, res) => {
  try {
    const agentEmail = (req.query.agentEmail as string)?.trim?.();
    const dateStr = (req.query.date as string)?.trim?.();
    const timezone = (req.query.timezone as string)?.trim?.() || 'America/New_York';
    if (!agentEmail || !dateStr) {
      return res.status(400).json({ error: 'Missing agentEmail or date query param' });
    }
    const items = await getMasterScheduleForDay(agentEmail, dateStr, timezone);
    let meetLinks: Record<string, string | null> = {};
    const meetIds = items.filter((r) => r.source_table === 'meets').map((r) => r.source_id);
    let meetDetails: Record<string, { meeting_link?: string; presentation_session_id?: string }> = {};
    if (meetIds.length > 0 && supabaseAdmin) {
      const { data: meets } = await supabaseAdmin
        .from('meets')
        .select('id, meeting_link, presentation_session_id')
        .in('id', meetIds);
      meetDetails = (meets ?? []).reduce((acc, m) => {
        acc[m.id] = { meeting_link: m.meeting_link ?? undefined, presentation_session_id: m.presentation_session_id ?? undefined };
        return acc;
      }, {} as Record<string, { meeting_link?: string; presentation_session_id?: string }>);
      meetLinks = (meets ?? []).reduce((acc, m) => {
        acc[m.id] = m.meeting_link ?? null;
        return acc;
      }, {} as Record<string, string | null>);
    }
    const payload = items.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      if (row.source_table === 'meets' && meetDetails[row.source_id]) {
        meta.meetingLink = meetDetails[row.source_id].meeting_link ?? null;
        meta.presentationSessionId = meetDetails[row.source_id].presentation_session_id ?? null;
      }
      return {
        slot_start: row.slot_start,
        slot_end: row.slot_end,
        time: row.time,
        schedule_type: row.schedule_type,
        source_table: row.source_table,
        source_id: row.source_id,
        title: row.title,
        metadata: meta,
      };
    });
    res.json(payload);
  } catch (e) {
    console.error('❌ Schedule availability error:', e);
    res.status(500).json({ error: 'Failed to fetch schedule availability' });
  }
});

/**
 * GET /api/schedule/master/upcoming
 * Get the single next upcoming slot for countdown banner
 * Query: agentEmail
 */
router.get('/master/upcoming', async (req, res) => {
  try {
    const agentEmail = (req.query.agentEmail as string)?.trim?.();
    if (!agentEmail) {
      return res.status(400).json({ error: 'Missing agentEmail query param' });
    }
    const item = await getNextUpcomingSlot(agentEmail);
    if (!item) return res.json(null);
    let meetingLink: string | null = null;
    let presentationSessionId: string | null = null;
    if (item.source_table === 'meets' && supabaseAdmin) {
      const { data } = await supabaseAdmin.from('meets').select('meeting_link, presentation_session_id').eq('id', item.source_id).single();
      meetingLink = data?.meeting_link ?? null;
      presentationSessionId = data?.presentation_session_id ?? null;
    }
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    if (meetingLink != null) meta.meetingLink = meetingLink;
    if (presentationSessionId != null) meta.presentationSessionId = presentationSessionId;
    res.json({
      id: item.id,
      slot_start: item.slot_start,
      slot_end: item.slot_end,
      schedule_type: item.schedule_type,
      source_table: item.source_table,
      source_id: item.source_id,
      title: item.title,
      metadata: meta,
    });
  } catch (e) {
    console.error('❌ Master schedule upcoming error:', e);
    res.status(500).json({ error: 'Failed to fetch upcoming slot' });
  }
});

export default router;
