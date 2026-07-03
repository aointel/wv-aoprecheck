import { Request, Response } from 'express';
import { db } from './db';
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { adjustAgentDailyDeclaredStats } from "./local-hot-tables";
import { upsertMasterSchedule } from './master-schedule-service';
import { sendAppointmentConfirmation } from './appointment-sms';
import { 
  appointments, 
  agentAvailability,
  updateAppointmentSchema,
} from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

function normalizeZoomPassword(password: unknown): string | null {
  const raw = String(password ?? '').trim();
  if (!raw || raw === '1') return null;
  return raw;
}

function mapAppointmentUpdateToSupabase(updateData: Record<string, any>): Record<string, any> {
  const mapped: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    title: 'title',
    description: 'description',
    appointmentType: 'appointment_type',
    startTime: 'start_time',
    endTime: 'end_time',
    duration: 'duration',
    timezone: 'timezone',
    agentId: 'agent_id',
    agentEmail: 'agent_email',
    agentName: 'agent_name',
    leadId: 'lead_id',
    leadName: 'lead_name',
    leadPhone: 'lead_phone',
    leadEmail: 'lead_email',
    leadCity: 'lead_city',
    leadState: 'lead_state',
    leadMarket: 'lead_market',
    meetingPlatform: 'meeting_platform',
    meetingLink: 'meeting_link',
    meetingData: 'meeting_data',
    zoomMeetingId: 'zoom_meeting_id',
    zoomPassword: 'zoom_password',
    zoomJoinUrl: 'zoom_join_url',
    wherebyRoomUrl: 'whereby_room_url',
    wherebyHostRoomUrl: 'whereby_host_room_url',
    wherebyMeetingId: 'whereby_meeting_id',
    twilioRoomName: 'twilio_room_name',
    status: 'status',
    confirmationStatus: 'confirmation_status',
    remindersSent: 'reminders_sent',
    notes: 'notes',
    internalNotes: 'internal_notes',
    googleCalendarEventId: 'google_calendar_event_id',
    googleCalendarSyncStatus: 'google_calendar_sync_status',
    googleCalendarSyncedAt: 'google_calendar_synced_at',
    googleCalendarHtmlLink: 'google_calendar_html_link',
    googleCalendarSyncError: 'google_calendar_sync_error',
    updatedAt: 'updated_at',
    cancelledAt: 'cancelled_at',
    completedAt: 'completed_at',
  };

  for (const [key, value] of Object.entries(updateData)) {
    const column = fieldMap[key] || key;
    if (value instanceof Date) {
      mapped[column] = value.toISOString();
    } else {
      mapped[column] = value;
    }
  }

  return mapped;
}

function parseAlpFromOutcomeNotes(notes: unknown): number {
  const raw = String(notes ?? "");
  const match = raw.match(/ALP:\s*\$?\s*([0-9,]+(?:\.[0-9]+)?)/i);
  if (!match) return 0;
  const parsed = Number(String(match[1]).replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mapAppointmentOutcomeToLeadResolution(outcome: string): string {
  const normalized = String(outcome || "").toLowerCase();
  if (!normalized || normalized === "pending") return "appointment_set";
  if (normalized === "sale" || normalized === "policy_issued") return "sold";
  if (normalized === "rescheduled") return "callback";
  return normalized;
}

function normalizeOutcomeLabel(outcome: string): string {
  const normalized = String(outcome || "").trim();
  if (!normalized) return "pending";
  return normalized.replace(/_/g, " ");
}

async function syncMasterleadResolutionFromAppointment(args: {
  leadId?: unknown;
  leadPhone?: unknown;
  outcome: string;
  outcomeNotes?: unknown;
}): Promise<void> {
  const leadId = String(args.leadId ?? "").trim();
  const phoneLast10 = normalizePhoneLast10(args.leadPhone);
  if (!leadId && phoneLast10.length !== 10) return;

  const nowIso = new Date().toISOString();
  const outcome = String(args.outcome || "").toLowerCase();
  const leadResolution = mapAppointmentOutcomeToLeadResolution(outcome);
  const alp = parseAlpFromOutcomeNotes(args.outcomeNotes);
  const noteSource = String(args.outcomeNotes ?? "").trim();
  const fallbackNote = normalizeOutcomeLabel(outcome);
  const updateData: Record<string, unknown> = {
    cnresolution: leadResolution,
    resolution_notes: noteSource || fallbackNote,
    resolved_at: outcome === "pending" ? null : nowIso,
    updated_at: nowIso,
    last_contacted: nowIso,
  };

  if (outcome === "sale" && alp > 0) {
    updateData.ALP = String(alp);
    updateData.disposition_notes = `${noteSource || "sale"} [ALP: $${alp}]`;
  }

  const attemptUpdate = async (column: string, value: string): Promise<number> => {
    const { data, error } = await masterleadClient
      .from("masterlead")
      .update(updateData)
      .eq(column, value)
      .select("id");
    if (error) throw new Error(error.message || `masterlead update failed on ${column}`);
    return Array.isArray(data) ? data.length : 0;
  };

  let updated = 0;
  if (leadId) {
    updated = await attemptUpdate("taalk_lead_id", leadId);
    if (!updated) updated = await attemptUpdate("id", leadId);
  }

  if (!updated && phoneLast10.length === 10) {
    const { data: byPhone, error: phoneLookupError } = await masterleadClient
      .from("masterlead")
      .select("id, phone")
      .ilike("phone", `%${phoneLast10}`)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (phoneLookupError) throw new Error(phoneLookupError.message || "masterlead phone lookup failed");
    const phoneLeadId = String((byPhone?.[0] as any)?.id || "").trim();
    if (phoneLeadId) {
      updated = await attemptUpdate("id", phoneLeadId);
    }
  }
}

function toPacificDateKey(value: unknown): string {
  const date = value ? new Date(String(value)) : new Date();
  return date.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function normalizePhoneLast10(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

export async function createAppointment(req: Request, res: Response) {
  try {
    console.log('📅 Creating new appointment:', JSON.stringify(req.body, null, 2));
    
    // Validate required fields first
    if (!req.body.startTime || !req.body.endTime) {
      throw new Error('startTime and endTime are required');
    }
    if (!req.body.agentEmail || !req.body.agentName || !req.body.agentId) {
      throw new Error('agentEmail, agentName, and agentId are required');
    }
    if (!req.body.leadName || !req.body.leadPhone) {
      throw new Error('leadName and leadPhone are required');
    }
    
    // Simple date handling - just use what we get
    const processedBody = {
      ...req.body,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime)
    };

    // Extract Whereby meeting data if present
    if (req.body.meetingData && req.body.meetingData.platform === 'whereby') {
      processedBody.wherebyRoomUrl = req.body.meetingData.roomUrl;
      processedBody.wherebyHostRoomUrl = req.body.meetingData.hostRoomUrl;
      processedBody.wherebyMeetingId = req.body.meetingData.meetingId;
      processedBody.meetingLink = req.body.meetingLink;
      processedBody.meetingData = req.body.meetingData;
      processedBody.meetingPlatform = 'whereby';
    }
    
    // Use raw data directly - no schema validation
    const appointmentData = {
      title: req.body.title || `Appointment with ${req.body.leadName}`,
      description: req.body.description || null,
      appointmentType: req.body.appointmentType || 'presentation',
      startTime: processedBody.startTime,
      endTime: processedBody.endTime,
      duration: req.body.duration || 60,
      timezone: req.body.timezone || 'America/New_York',
      agentId: req.body.agentId,
      agentEmail: req.body.agentEmail,
      agentName: req.body.agentName,
      leadId: req.body.leadId || null,
      leadName: req.body.leadName,
      leadPhone: req.body.leadPhone,
      leadEmail: req.body.leadEmail || null,
      leadCity: req.body.leadCity || null,
      leadState: req.body.leadState || null,
      meetingPlatform: req.body.meetingPlatform || 'AO Meet',
      status: req.body.status || 'scheduled',
      notes: req.body.notes || null,
      ...processedBody
    };

    // Use Supabase instead of Drizzle since appointments table doesn't exist in Drizzle DB
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }

    // Simple date conversion
    const startTimeISO = (appointmentData.startTime instanceof Date 
      ? appointmentData.startTime 
      : new Date(appointmentData.startTime)).toISOString();
    const endTimeISO = (appointmentData.endTime instanceof Date 
      ? appointmentData.endTime 
      : new Date(appointmentData.endTime)).toISOString();

    const insertPayload = {
      title: appointmentData.title,
      description: appointmentData.description || null,
      appointment_type: appointmentData.appointmentType || 'presentation',
      start_time: startTimeISO,
      end_time: endTimeISO,
      duration: appointmentData.duration || 60,
      timezone: appointmentData.timezone || 'America/New_York',
      agent_id: appointmentData.agentId,
      agent_email: appointmentData.agentEmail,
      agent_name: appointmentData.agentName,
      lead_id: appointmentData.leadId || null,
      lead_name: appointmentData.leadName,
      lead_phone: appointmentData.leadPhone,
      lead_email: appointmentData.leadEmail || null,
      lead_city: appointmentData.leadCity || null,
      lead_state: appointmentData.leadState || null,
      meeting_platform: appointmentData.meetingPlatform || 'AO Meet',
      twilio_room_name: (appointmentData as any).twilioRoomName || null,
      zoom_meeting_id: (appointmentData as any).zoomMeetingId || null,
      zoom_password: normalizeZoomPassword((appointmentData as any).zoomPassword),
      zoom_join_url: (appointmentData as any).zoomJoinUrl || null,
      whereby_room_url: (appointmentData as any).wherebyRoomUrl || null,
      whereby_host_room_url: (appointmentData as any).wherebyHostRoomUrl || null,
      whereby_meeting_id: (appointmentData as any).wherebyMeetingId || null,
      status: appointmentData.status || 'scheduled',
      confirmation_status: (appointmentData as any).confirmationStatus || 'pending',
      outcome: (appointmentData as any).outcome || 'pending',
      outcome_notes: (appointmentData as any).outcomeNotes || null,
      disposition_source: (appointmentData as any).dispositionSource || null,
      notes: appointmentData.notes || null,
      internal_notes: (appointmentData as any).internalNotes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Callbacks are limited to 5 per agent per UTC day.
    if (String(insertPayload.appointment_type || '').toLowerCase() === 'callback') {
      const callbackStart = new Date(startTimeISO);
      const dayStart = new Date(Date.UTC(
        callbackStart.getUTCFullYear(),
        callbackStart.getUTCMonth(),
        callbackStart.getUTCDate(),
        0, 0, 0, 0,
      ));
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const { count: callbackCount, error: callbackCountError } = await supabaseAdmin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('agent_email', appointmentData.agentEmail)
        .eq('appointment_type', 'callback')
        .gte('start_time', dayStart.toISOString())
        .lt('start_time', dayEnd.toISOString())
        .neq('status', 'cancelled');

      if (callbackCountError) {
        throw new Error(callbackCountError.message || 'Failed to validate callback limit');
      }
      if ((callbackCount || 0) >= 5) {
        return res.status(400).json({
          success: false,
          error: 'Callback daily limit reached',
          details: 'Agents are limited to 5 callbacks per day.',
        });
      }
    }

    // Prevent duplicate open appointments for the same lead/agent.
    // Agents should edit/reschedule the existing card instead of creating a new one.
    // IMPORTANT: do NOT collapse auto instant presentations; each qualifying call must register as its own row.
    const dispositionSource = String(insertPayload.disposition_source || '').toLowerCase();
    const skipLeadDedupe =
      dispositionSource === 'instant_presentation' ||
      String(insertPayload.internal_notes || '').includes('AUTO_INSTANT_CALL_SID:');
    if (String(insertPayload.appointment_type || '').toLowerCase() !== 'callback' && !skipLeadDedupe) {
      const incomingLeadId = String(appointmentData.leadId ?? '').trim();
      const incomingPhoneLast10 = normalizePhoneLast10(appointmentData.leadPhone);

      const { data: existingRows, error: existingRowsError } = await supabaseAdmin
        .from('appointments')
        .select('id, start_time, lead_id, lead_phone, status, outcome, appointment_type')
        .eq('agent_email', appointmentData.agentEmail)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false })
        .limit(200);

      if (existingRowsError) {
        throw new Error(existingRowsError.message || 'Failed to validate duplicate appointments');
      }

      const duplicate = (existingRows || []).find((row: any) => {
        const existingType = String(row?.appointment_type || '').toLowerCase();
        if (existingType === 'callback') return false;

        const existingStatus = String(row?.status || '').toLowerCase();
        const existingOutcome = String(row?.outcome || '').toLowerCase();
        const stillOpen =
          existingStatus !== 'completed' &&
          existingStatus !== 'cancelled' &&
          existingOutcome !== 'sale' &&
          existingOutcome !== 'no_sale' &&
          existingOutcome !== 'policy_issued' &&
          existingOutcome !== 'not_interested' &&
          existingOutcome !== 'cannot_afford' &&
          existingOutcome !== 'medically_uninsurable' &&
          existingOutcome !== 'no_show';
        if (!stillOpen) return false;

        const existingLeadId = String(row?.lead_id ?? '').trim();
        const existingPhoneLast10 = normalizePhoneLast10(row?.lead_phone);
        const sameLeadById = Boolean(incomingLeadId && existingLeadId && incomingLeadId === existingLeadId);
        const sameLeadByPhone = Boolean(incomingPhoneLast10 && existingPhoneLast10 && incomingPhoneLast10 === existingPhoneLast10);
        return sameLeadById || sameLeadByPhone;
      });

      if (duplicate) {
        const { data: movedAppointment, error: moveError } = await supabaseAdmin
          .from('appointments')
          .update({
            title: insertPayload.title,
            description: insertPayload.description,
            appointment_type: insertPayload.appointment_type,
            start_time: insertPayload.start_time,
            end_time: insertPayload.end_time,
            duration: insertPayload.duration,
            timezone: insertPayload.timezone,
            lead_id: insertPayload.lead_id,
            lead_name: insertPayload.lead_name,
            lead_phone: insertPayload.lead_phone,
            lead_email: insertPayload.lead_email,
            lead_city: insertPayload.lead_city,
            lead_state: insertPayload.lead_state,
            meeting_platform: insertPayload.meeting_platform,
            twilio_room_name: insertPayload.twilio_room_name,
            zoom_meeting_id: insertPayload.zoom_meeting_id,
            zoom_password: insertPayload.zoom_password,
            zoom_join_url: insertPayload.zoom_join_url,
            whereby_room_url: insertPayload.whereby_room_url,
            whereby_host_room_url: insertPayload.whereby_host_room_url,
            whereby_meeting_id: insertPayload.whereby_meeting_id,
            status: 'scheduled',
            disposition_source: insertPayload.disposition_source,
            notes: insertPayload.notes,
            internal_notes: insertPayload.internal_notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', duplicate.id)
          .select()
          .single();

        if (moveError || !movedAppointment) {
          const errText = moveError?.message || 'Failed to move existing appointment';
          throw new Error(errText);
        }

        try {
          await upsertMasterSchedule({
            agentEmail: appointmentData.agentEmail,
            slotStart: startTimeISO,
            slotEnd: endTimeISO,
            scheduleType: 'appointment',
            sourceTable: 'appointments',
            sourceId: String(duplicate.id),
            title: appointmentData.title,
            metadata: { lead_name: appointmentData.leadName, lead_phone: appointmentData.leadPhone },
          });
        } catch (masterErr) {
          console.warn('⚠️ Failed to update master_schedule after moving duplicate appointment:', (masterErr as Error)?.message);
        }

        console.log(`🔁 Moved existing appointment ${duplicate.id} instead of creating duplicate`);
        return res.status(200).json({
          success: true,
          movedExisting: true,
          appointment: movedAppointment,
          id: movedAppointment.id,
        });
      }
    }

    console.log('📅 Inserting appointment payload:', JSON.stringify(insertPayload, null, 2));

    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Supabase insert error:', JSON.stringify(insertError, null, 2));
      const errorMessage = insertError.message || insertError.code || JSON.stringify(insertError);
      const errorDetails = insertError.details || insertError.hint || '';
      throw new Error(`Failed to create appointment: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`);
    }

    if (!newAppointment) {
      console.error('❌ No appointment data returned from Supabase');
      throw new Error('Failed to create appointment: No data returned from database');
    }

    console.log('✅ Appointment created successfully:', newAppointment.id);

    // Write-through to master_schedule for countdown/accountability
    try {
      await upsertMasterSchedule({
        agentEmail: appointmentData.agentEmail,
        slotStart: startTimeISO,
        slotEnd: endTimeISO,
        scheduleType: 'appointment',
        sourceTable: 'appointments',
        sourceId: String(newAppointment.id),
        title: appointmentData.title,
        metadata: { lead_name: appointmentData.leadName, lead_phone: appointmentData.leadPhone },
      });
    } catch (masterErr) {
      console.warn('⚠️ Failed to write appointment to master_schedule:', (masterErr as Error)?.message);
    }

    // Update masterlead ownership/status when the appointment was created from a looked-up lead.
    if (appointmentData.leadId && supabaseAdmin) {
      try {
        const leadAssignmentUpdate = {
          cn_email: appointmentData.agentEmail,
          cnresolution: 'appointment_set',
          last_contacted: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Update by taalk_lead_id first (most common)
        let { data: leadUpdate, error: leadUpdateError } = await masterleadClient.from('masterlead')
          .update(leadAssignmentUpdate)
          .eq('taalk_lead_id', appointmentData.leadId)
          .select();

        // If not found by taalk_lead_id, try by id
        if (!leadUpdate || leadUpdate.length === 0) {
          const { data: leadUpdateById, error: leadUpdateByIdError } = await masterleadClient.from('masterlead')
            .update(leadAssignmentUpdate)
            .eq('id', appointmentData.leadId)
            .select();
          
          leadUpdate = leadUpdateById;
          leadUpdateError = leadUpdateByIdError;
        }

        if (leadUpdateError) {
          console.warn('⚠️ Failed to update masterlead appointment owner/status:', leadUpdateError);
          // Don't fail the appointment creation if this update fails
        } else if (leadUpdate && leadUpdate.length > 0) {
          console.log('✅ Updated masterlead cn_email/cnresolution for appointment lead:', appointmentData.leadId, appointmentData.agentEmail);
        } else {
          console.warn('⚠️ No masterlead record found to update for lead:', appointmentData.leadId);
        }
      } catch (error) {
        console.warn('⚠️ Error updating masterlead:', error);
        // Don't fail the appointment creation if this update fails
      }
    }

    // Send appointment webhook to Zapier for external automation
    try {
      const webhookPayload = {
        event: 'appointment_scheduled',
        timestamp: new Date().toISOString(),
        appointment: {
          id: newAppointment.id,
          title: appointmentData.title,
          startTime: appointmentData.startTime,
          endTime: appointmentData.endTime,
          duration: appointmentData.duration,
          timezone: appointmentData.timezone || 'America/New_York',
          meetingPlatform: appointmentData.meetingPlatform,
          meetingLink: (appointmentData as any).meetingLink,
          status: appointmentData.status || 'scheduled'
        },
        agent: {
          id: appointmentData.agentId,
          email: appointmentData.agentEmail,
          name: appointmentData.agentName
        },
        lead: {
          id: appointmentData.leadId,
          name: appointmentData.leadName,
          phone: appointmentData.leadPhone,
          email: appointmentData.leadEmail
        },
        metadata: {
          source: 'ConnectNow CRM',
          platform: 'Replit',
          notes: appointmentData.notes
        }
      };

      console.log('📅 Sending appointment webhook to Zapier:', webhookPayload);
      
      // Send to Zapier webhook endpoint
      const webhookResponse = await fetch('https://hooks.zapier.com/hooks/catch/2467580/uu5qnr4/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      });

      if (webhookResponse.ok) {
        console.log('✅ Appointment webhook sent successfully to Zapier');
      } else {
        console.warn('⚠️ Appointment webhook failed:', webhookResponse.status);
      }
    } catch (webhookError) {
      console.error('❌ Appointment webhook error:', webhookError);
      // Don't fail the appointment creation if webhook fails
    }

    res.json({ 
      success: true,
      appointment: newAppointment,
      message: 'Appointment scheduled successfully'
    });

  } catch (error: any) {
    console.error('❌ Error creating appointment:', error);
    console.error('❌ Error stack:', error?.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorDetails = error?.details || error?.hint || error?.code || '';
    
    res.status(400).json({ 
      success: false,
      error: 'Failed to create appointment',
      details: errorMessage + (errorDetails ? ` (${errorDetails})` : ''),
      rawError: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}

export async function sendAppointmentClientTexts(req: Request, res: Response) {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: 'Supabase not available' });
    }

    const appointmentId = Number(req.params.id);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid appointment id' });
    }

    let appt: any = null;
    let apptError: any = null;
    const baseSelect = 'id, lead_name, lead_phone, lead_state, agent_name, start_time, zoom_join_url, zoom_password, confirmation_status, status';
    const withMeetingLinkSelect = `${baseSelect}, meeting_link`;
    const runSelect = async (selectClause: string) =>
      supabaseAdmin
        .from('appointments')
        .select(selectClause)
        .eq('id', appointmentId)
        .maybeSingle();

    const first = await runSelect(withMeetingLinkSelect);
    appt = first.data;
    apptError = first.error;

    const missingMeetingLinkColumn =
      !!apptError &&
      /meeting_link/i.test(String(apptError.message || '')) &&
      /(does not exist|schema cache)/i.test(String(apptError.message || ''));

    if (missingMeetingLinkColumn) {
      const fallback = await runSelect(baseSelect);
      appt = fallback.data;
      apptError = fallback.error;
    }

    if (apptError) {
      return res.status(500).json({ success: false, error: apptError.message || 'Failed to load appointment' });
    }
    if (!appt) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    const leadPhone = String(appt.lead_phone || '').trim();
    if (!leadPhone) {
      return res.status(400).json({ success: false, error: 'Lead phone is required before sending text confirmation' });
    }

    const zoomLink = String(appt.zoom_join_url || appt.meeting_link || '').trim();
    if (!zoomLink) {
      return res.status(400).json({ success: false, error: 'Please save Zoom info before sending text confirmation' });
    }

    // sendAppointmentConfirmation uses Twilio credentials from hardcoded-config via appointment-sms.ts
    const sent = await sendAppointmentConfirmation({
      leadName: String(appt.lead_name || 'Client'),
      leadPhone,
      leadState: appt.lead_state ?? null,
      agentName: String(appt.agent_name || 'Agent'),
      startTime: appt.start_time,
      zoomLink,
      zoomPassword: normalizeZoomPassword((appt as any).zoom_password),
    });

    if (!sent) {
      return res.status(502).json({ success: false, error: 'Failed to send confirmation text' });
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({
        confirmation_status: 'sent',
        reminders_sent: 0,
        updated_at: nowIso,
      })
      .eq('id', appointmentId);

    if (updateError) {
      return res.status(500).json({ success: false, error: updateError.message || 'Failed to enable reminders' });
    }

    return res.json({
      success: true,
      appointmentId,
      confirmationStatus: 'sent',
      remindersEnabled: true,
      message: 'Confirmation text sent and client reminders enabled.',
    });
  } catch (error: any) {
    console.error('❌ Error sending appointment client texts:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to send appointment client texts',
    });
  }
}

export async function getAppointments(req: Request, res: Response) {
  try {
    console.log('📅 Get appointments called with query:', req.query);

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

    const {
      agentEmail,
      leadId,
      status,
      appointmentType,
      startDate,
      endDate,
      from,
      to,
    } = req.query as Record<string, string | undefined>;

    const rangeStart = startDate || from;
    const rangeEnd = endDate || to;

    let query = supabaseAdmin
      .from('appointments')
      .select('*')
      .order('start_time', { ascending: true });

    if (agentEmail) query = query.eq('agent_email', agentEmail);
    if (leadId) query = query.eq('lead_id', leadId);
    if (status) query = query.eq('status', status);
    if (appointmentType) query = query.eq('appointment_type', appointmentType);
    if (rangeStart) query = query.gte('start_time', rangeStart);
    if (rangeEnd) query = query.lte('start_time', rangeEnd);

    const { data: results, error } = await query;

    if (error) {
      console.error('❌ Supabase get appointments error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch appointments' });
    }

    // Enhance results with sync status information
    const enhancedResults = (results ?? []).map((appointment: any) => ({
      ...appointment,
      // Add computed sync status
      syncStatus: {
        isSynced: appointment.google_calendar_sync_status === 'synced',
        status: appointment.google_calendar_sync_status || 'pending',
        lastSynced: appointment.google_calendar_synced_at,
        hasError: appointment.google_calendar_sync_error,
        googleCalendarLink: appointment.google_calendar_html_link,
        eventId: appointment.google_calendar_event_id
      },
      // Add sync actions available
      syncActions: {
        canSync: appointment.google_calendar_sync_status !== 'synced' || !appointment.google_calendar_event_id,
        canResync: appointment.google_calendar_sync_status === 'synced' && appointment.google_calendar_event_id,
        canViewInGoogle: appointment.google_calendar_html_link ? true : false
      }
    }));

    console.log(`🗓️ Enhanced appointments with sync status: ${enhancedResults.length} appointments`);
    
    res.json(enhancedResults);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(400).json({ error: 'Failed to fetch appointments' });
  }
}

export async function getAppointmentById(req: Request, res: Response) {
  try {
    const appointmentId = parseInt(req.params.id);
    if (!Number.isFinite(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle();

    if (error) {
      console.error('Get appointment Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch appointment' });
    }

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(400).json({ error: 'Failed to fetch appointment' });
  }
}

export async function updateAppointment(req: Request, res: Response) {
  try {
    const appointmentId = parseInt(req.params.id);
    if (!Number.isFinite(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase not available' });
    }
    const updates = updateAppointmentSchema.parse({ ...req.body, id: appointmentId });

    const { id, ...updateData } = updates;
    const updateDataWithTimestamp = {
      ...updateData,
      updatedAt: new Date(),
    };

    // If status is being changed to cancelled or completed, add timestamp
    if (updates.status === 'cancelled') {
      updateDataWithTimestamp.cancelledAt = new Date();
    } else if (updates.status === 'completed') {
      updateDataWithTimestamp.completedAt = new Date();
    }

    const { data: updatedAppointment, error } = await supabaseAdmin
      .from('appointments')
      .update(mapAppointmentUpdateToSupabase(updateDataWithTimestamp))
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Update appointment Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to update appointment' });
    }

    if (!updatedAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(updatedAppointment);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(400).json({ error: 'Failed to update appointment' });
  }
}

export async function deleteAppointment(req: Request, res: Response) {
  try {
    const appointmentId = parseInt(req.params.id);
    if (!Number.isFinite(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

    const { data: deletedAppointment, error } = await supabaseAdmin
      .from('appointments')
      .delete()
      .eq('id', appointmentId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Delete appointment Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to delete appointment' });
    }

    if (!deletedAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(400).json({ error: 'Failed to delete appointment' });
  }
}

export async function getAgentAvailability(req: Request, res: Response) {
  try {
    const agentEmail = req.params.agentEmail;

    const availability = await db
      .select()
      .from(agentAvailability)
      .where(eq(agentAvailability.agentEmail, agentEmail));

    res.json(availability);
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(400).json({ error: 'Failed to fetch availability' });
  }
}

export async function updateAgentAvailability(req: Request, res: Response) {
  try {
    const agentEmail = req.params.agentEmail;
    const availabilityData = req.body;

    // Delete existing availability
    await db
      .delete(agentAvailability)
      .where(eq(agentAvailability.agentEmail, agentEmail));

    // Insert new availability
    if (availabilityData.length > 0) {
      await db
        .insert(agentAvailability)
        .values(availabilityData.map((slot: any) => ({
          ...slot,
          agentEmail,
        })));
    }

    res.json({ message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(400).json({ error: 'Failed to update availability' });
  }
}

export async function updateAppointmentOutcome(req: Request, res: Response) {
  try {
    const appointmentId = parseInt(req.params.id);
    const { outcome, outcomeNotes } = req.body;

    if (!outcome) {
      return res.status(400).json({ error: 'outcome is required' });
    }

    const validOutcomes = [
      'pending',
      'sale',
      'no_sale',
      'no_show',
      'rescheduled',
      'not_interested',
      'cannot_afford',
      'medically_uninsurable',
      'policy_issued',
      'cancelled'
    ];
    if (!validOutcomes.includes(outcome)) {
      return res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(', ')}` });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

    const { data: existingAppt, error: existingError } = await supabaseAdmin
      .from('appointments')
      .select('id, agent_email, start_time, lead_id, lead_phone, outcome, outcome_notes')
      .eq('id', appointmentId)
      .maybeSingle();

    if (existingError) {
      console.error('❌ updateAppointmentOutcome load-existing error:', existingError.message);
      return res.status(500).json({ error: 'Failed to load current appointment outcome' });
    }
    if (!existingAppt) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const statusByOutcome: Record<string, string> = {
      pending: 'scheduled',
      sale: 'completed',
      no_sale: 'completed',
      no_show: 'no_show',
      rescheduled: 'rescheduled',
      not_interested: 'completed',
      cannot_afford: 'completed',
      medically_uninsurable: 'completed',
      policy_issued: 'completed',
      cancelled: 'cancelled',
    };
    const completedAt = ['sale', 'no_sale', 'no_show', 'rescheduled', 'not_interested', 'cannot_afford', 'medically_uninsurable', 'policy_issued', 'cancelled'].includes(outcome)
      ? new Date().toISOString()
      : null;

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({
        outcome,
        outcome_notes: outcomeNotes ?? null,
        outcome_at: new Date().toISOString(),
        status: statusByOutcome[outcome] || 'completed',
        completed_at: outcome === 'cancelled' ? null : completedAt,
        cancelled_at: outcome === 'cancelled' ? completedAt : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) {
      console.error('❌ updateAppointmentOutcome error:', error.message);
      return res.status(500).json({ error: 'Failed to update outcome' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const previousOutcome = String(existingAppt.outcome || '').toLowerCase();
    const nextOutcome = String(outcome || '').toLowerCase();
    const wasSale = previousOutcome === 'sale';
    const isSale = nextOutcome === 'sale';
    const previousAlp = parseAlpFromOutcomeNotes(existingAppt.outcome_notes);
    const nextAlp = parseAlpFromOutcomeNotes(outcomeNotes);
    const declaredSalesDelta = (isSale ? 1 : 0) - (wasSale ? 1 : 0);
    const declaredAlpDelta = (isSale ? nextAlp : 0) - (wasSale ? previousAlp : 0);

    if (existingAppt.agent_email && (declaredSalesDelta !== 0 || declaredAlpDelta !== 0)) {
      const statDate = toPacificDateKey(existingAppt.start_time);
      try {
        await adjustAgentDailyDeclaredStats(
          String(existingAppt.agent_email),
          statDate,
          declaredSalesDelta,
          declaredAlpDelta,
        );
      } catch (statsErr: any) {
        console.error('❌ updateAppointmentOutcome stats-adjust failed:', statsErr?.message || statsErr);
      }
    }

    try {
      await syncMasterleadResolutionFromAppointment({
        leadId: (existingAppt as any).lead_id,
        leadPhone: (existingAppt as any).lead_phone,
        outcome: nextOutcome,
        outcomeNotes,
      });
    } catch (syncError: any) {
      console.warn('⚠️ updateAppointmentOutcome masterlead sync failed:', syncError?.message || syncError);
    }

    console.log(`✅ Appointment ${appointmentId} outcome set to "${outcome}"`);
    res.json({ success: true, appointment: data });
  } catch (error: any) {
    console.error('❌ updateAppointmentOutcome:', error);
    res.status(500).json({ error: 'Failed to update appointment outcome' });
  }
}

export async function getPendingOutcomes(req: Request, res: Response) {
  try {
    const { agentEmail } = req.query as { agentEmail?: string };

    if (!agentEmail) {
      return res.status(400).json({ error: 'agentEmail query param is required' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase not available' });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('*')
      .eq('agent_email', agentEmail)
      .or('outcome.eq.pending,outcome.is.null')
      .lt('start_time', now)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('❌ getPendingOutcomes error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch pending outcomes' });
    }

    res.json(data ?? []);
  } catch (error: any) {
    console.error('❌ getPendingOutcomes:', error);
    res.status(500).json({ error: 'Failed to fetch pending outcomes' });
  }
}

// Helper function to check for appointment conflicts
export async function checkAppointmentConflicts(
  agentEmail: string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: number
) {
  
  let whereConditions = [
    eq(appointments.agentEmail, agentEmail),
    lte(appointments.startTime, new Date(endTime)),
    gte(appointments.endTime, new Date(startTime))
  ];

  if (excludeAppointmentId) {
    whereConditions.push(eq(appointments.id, excludeAppointmentId));
  }

  const conflicts = await db
    .select()
    .from(appointments)
    .where(and(...whereConditions));

  return conflicts;
}