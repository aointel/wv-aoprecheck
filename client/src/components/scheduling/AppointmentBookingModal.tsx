'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getServiceRequestCredentials, resolveServiceUrl } from '@/lib/service-routing';
import { Calendar, Zap, Link, Clock } from 'lucide-react';
import { format, addHours } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BookingLeadInfo {
  leadId?: string;
  leadName: string;
  leadPhone: string;
  leadMarket?: string;
  leadState?: string;
  leadCity?: string;
}

export interface BookingAgentInfo {
  agentId: string;
  agentEmail: string;
  agentName: string;
  zoomId?: string | null;
}

export interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispositionSource: 'booked' | 'instant_presentation';
  lead: BookingLeadInfo;
  agent: BookingAgentInfo;
  onBooked?: (appointment: any) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern (ET)',  abbrev: 'ET'  },
  { value: 'America/Chicago',     label: 'Central (CT)',  abbrev: 'CT'  },
  { value: 'America/Denver',      label: 'Mountain (MT)', abbrev: 'MT'  },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)',  abbrev: 'PT'  },
] as const;

type IANA = typeof TIMEZONES[number]['value'];

function getZoomLink(zoomId?: string | null): string {
  if (!zoomId) return '';
  // Already a full URL
  if (zoomId.startsWith('http')) return zoomId;
  return `https://zoom.us/j/${zoomId}`;
}

function normalizeZoomPassword(password?: string | null): string {
  const raw = String(password || '').trim();
  if (!raw || raw === '1') return '';
  return raw;
}

function combineLocalDateTime(dateStr: string, timeStr: string, ianaTimezone: IANA): Date {
  // Parse "YYYY-MM-DD" and "HH:mm" in the given timezone, return UTC Date
  const localIso = `${dateStr}T${timeStr}:00`;
  // Use Intl to offset correctly
  const dt = new Date(localIso);
  // Calculate offset for the given TZ
  const tzOffset = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(dt)
  );
  // Simple approach: build UTC from local interpretation
  const localDate = new Date(`${dateStr}T${timeStr}:00`);
  const utcMs = localDate.getTime() - getOffsetMs(ianaTimezone, localDate);
  return new Date(utcMs);
}

function getOffsetMs(ianaTimezone: string, forDate: Date): number {
  const utcStr = forDate.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
  const localStr = forDate.toLocaleString('en-US', { timeZone: ianaTimezone, hour12: false });
  return new Date(localStr).getTime() - new Date(utcStr).getTime();
}

function showInZone(utcDate: Date, ianaTimezone: string, abbrev: string): string {
  try {
    return formatInTimeZone(utcDate, ianaTimezone, 'h:mm a') + ' ' + abbrev;
  } catch {
    return '';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AppointmentBookingModal({
  isOpen,
  onClose,
  dispositionSource,
  lead,
  agent,
  onBooked,
}: AppointmentBookingModalProps) {
  const { toast } = useToast();
  const isInstant = dispositionSource === 'instant_presentation';

  const defaultZoom = getZoomLink(agent.zoomId);
  const [zoomLink, setZoomLink] = useState(defaultZoom);
  const [zoomPassword, setZoomPassword] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState<IANA>('America/New_York');
  const [notes, setNotes] = useState('');
  const [sendTextConfirmation, setSendTextConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !agent?.agentEmail) return;
    const endpoint = resolveServiceUrl(`/api/agent/profile-direct?userEmail=${encodeURIComponent(agent.agentEmail)}`);
    fetch(endpoint, { credentials: getServiceRequestCredentials(endpoint) })
      .then(res => (res.ok ? res.json() : null))
      .then(profile => {
        if (!profile) return;
        const profileZoomId = profile.zoom_id || profile.zoomId;
        const profileZoomLink = profileZoomId
          ? (String(profileZoomId).startsWith('http') ? String(profileZoomId) : `https://zoom.us/j/${profileZoomId}`)
          : '';
        const profileZoomPassword = normalizeZoomPassword(profile.zoom_password || profile.zoomPassword || '');
        setZoomLink(prev => prev || profileZoomLink);
        setZoomPassword(profileZoomPassword);
      })
      .catch(() => undefined);
  }, [isOpen, agent?.agentEmail]);

  // Derived: other-zone conversions shown live
  const otherZones = TIMEZONES.filter(tz => tz.value !== timezone);
  let utcTime: Date | null = null;
  if (date && time) {
    try { utcTime = combineLocalDateTime(date, time, timezone); } catch {}
  }

  const handleSubmit = async () => {
    if (!isInstant && (!date || !time)) {
      toast({ title: 'Required', description: 'Please select date and time', variant: 'destructive' });
      return;
    }

    if (sendTextConfirmation && !zoomLink.trim()) {
      toast({
        title: 'Zoom required',
        description: 'Please make sure Zoom info is saved before sending text confirmation.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const startTime = isInstant
        ? new Date().toISOString()
        : combineLocalDateTime(date, time, timezone).toISOString();

      const endTime = isInstant
        ? addHours(new Date(), 1).toISOString()
        : addHours(new Date(startTime), 1).toISOString();

      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const payload = {
        title: `Appointment with ${lead.leadName}`,
        appointmentType: isInstant ? 'instant_presentation' : 'presentation',
        startTime,
        endTime,
        duration: 60,
        timezone: isInstant ? browserTz : timezone,
        agentId: agent.agentId,
        agentEmail: agent.agentEmail,
        agentName: agent.agentName,
        leadId: lead.leadId ?? null,
        leadName: lead.leadName,
        leadPhone: lead.leadPhone,
        leadMarket: lead.leadMarket ?? null,
        leadState: lead.leadState ?? null,
        leadCity: lead.leadCity ?? null,
        meetingPlatform: zoomLink ? 'zoom' : 'AO Meet',
        meetingLink: zoomLink || null,
        zoomJoinUrl: zoomLink || null,
        zoomPassword: normalizeZoomPassword(zoomPassword) || null,
        notes: notes || null,
        status: 'scheduled',
        dispositionSource,
        outcome: 'pending',
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.details || data.error || 'Failed to book appointment');
      }

      if (sendTextConfirmation && data?.appointment?.id) {
        const textRes = await fetch(`/api/appointments/${data.appointment.id}/send-client-texts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const textPayload = await textRes.json().catch(() => ({}));
        if (!textRes.ok || textPayload.success === false) {
          throw new Error(textPayload.error || 'Appointment saved, but text confirmation failed');
        }
      }

      toast({
        title: 'Appointment booked!',
        description: sendTextConfirmation
          ? `${lead.leadName} — confirmation sent and reminders enabled`
          : `${lead.leadName} — ${isInstant ? 'now' : `${date} ${time}`}`,
      });
      onBooked?.(data.appointment);
      onClose();
    } catch (err: any) {
      toast({ title: 'Booking failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md overflow-hidden border-0 bg-transparent p-0 text-white shadow-none">
        <div className="rounded-3xl bg-gradient-to-br from-blue-400 via-violet-500 to-cyan-300 p-[1px] shadow-[0_26px_90px_rgba(15,23,42,0.55)]">
          <div className="rounded-[calc(1.5rem-1px)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 bg-gradient-to-r from-cyan-200 via-blue-200 to-violet-200 bg-clip-text text-transparent">
            {isInstant ? <Zap className="h-5 w-5 text-blue-200" /> : <Calendar className="h-5 w-5 text-emerald-200" />}
            {isInstant ? 'Log Instant Presentation' : 'Book Appointment'}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {isInstant
              ? 'Confirm the instant presentation that just happened.'
              : `Schedule an appointment with ${lead.leadName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            <strong>AOI: Meet is still in BETA</strong> - Please schedule and manage appointments in the Planet and here!
          </div>
          <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-100">
            Auto text is disabled. Text confirmations/reminders send only when the agent selects it.
          </div>

          {/* Client info (read-only) */}
          <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className="font-semibold text-white">{lead.leadName}</div>
            <div className="text-slate-300">{lead.leadPhone}</div>
            {lead.leadMarket && (
              <div className="text-xs text-slate-300">
                Market: <span className="font-semibold text-blue-100">{lead.leadMarket}</span>
              </div>
            )}
            {lead.leadState && <div className="text-xs text-slate-400">{[lead.leadCity, lead.leadState].filter(Boolean).join(', ')}</div>}
          </div>

          {/* Zoom link */}
          <div>
            <Label className="flex items-center gap-1.5 mb-1.5">
              <Link className="h-3.5 w-3.5" /> Zoom Link
            </Label>
            <Input
              value={zoomLink}
              onChange={e => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="border-white/10 bg-white/10 text-sm text-white placeholder:text-slate-500"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-slate-300">Zoom Password (if any)</Label>
            <Input
              value={zoomPassword}
              onChange={e => setZoomPassword(e.target.value)}
              placeholder="Leave blank if none"
              className="border-white/10 bg-white/10 text-sm text-white placeholder:text-slate-500"
            />
          </div>

          {/* BOOKED-specific fields */}
          {!isInstant && (
            <>
              {/* Date */}
              <div>
                  <Label className="mb-1.5 block text-slate-300">Appointment Date</Label>
                <Input
                  type="date"
                  value={date}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setDate(e.target.value)}
                    className="border-white/10 bg-white/10 text-white"
                />
              </div>

              {/* Time + Timezone */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="mb-1.5 block text-slate-300">Time</Label>
                  <Input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="border-white/10 bg-white/10 text-white"
                  />
                </div>
                <div className="flex-1">
                  <Label className="mb-1.5 block text-slate-300">Timezone</Label>
                  <Select value={timezone} onValueChange={v => setTimezone(v as IANA)}>
                    <SelectTrigger className="border-white/10 bg-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live cross-zone conversion */}
              {utcTime && time && (
                <div className="rounded-2xl border border-blue-300/20 bg-blue-400/10 px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-blue-200">
                    <Clock className="h-3 w-3" /> Same time in other zones:
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {otherZones.map(tz => (
                      <div key={tz.value} className="text-center">
                        <div className="text-xs font-bold text-slate-100">
                          {showInZone(utcTime!, tz.value, tz.abbrev)}
                        </div>
                        <div className="text-[10px] text-slate-400">{tz.abbrev}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div>
            <Label className="mb-1.5 block text-slate-300">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this appointment..."
              className="min-h-[60px] resize-none border-white/10 bg-white/10 text-sm text-white placeholder:text-slate-500"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs text-sky-100">
            <input
              type="checkbox"
              checked={sendTextConfirmation}
              onChange={e => setSendTextConfirmation(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Send Text Confirmation and reminders to client
              <span className="ml-1 text-sky-200">(Please make sure Zoom info is saved)</span>
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 border-white/10 bg-white/10 text-white hover:bg-white/20" disabled={loading}>
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 text-white hover:brightness-110"
              disabled={loading}
            >
              {loading ? 'Saving...' : isInstant ? 'Log Presentation' : 'Book Appointment'}
            </Button>
          </div>
        </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
