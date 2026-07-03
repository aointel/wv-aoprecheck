'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CheckCircle2 } from 'lucide-react';
import type { PendingAppointment } from '@/hooks/use-dialer-gate';
import { getServiceRequestCredentials, resolveServiceUrl } from '@/lib/service-routing';

const OUTCOME_OPTIONS = [
  { value: 'sale',           label: 'Sale',           color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'no_sale',        label: 'No Sale',        color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'no_show',        label: 'No Show',        color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'rescheduled',    label: 'Rescheduled',    color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'cannot_afford',  label: 'Cannot Afford',  color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'medically_uninsurable', label: 'Medically Uninsurable', color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300' },
  { value: 'policy_issued',  label: 'Policy Issued',  color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'cancelled',      label: 'Cancelled',      color: 'bg-orange-100 text-orange-700 border-orange-300' },
] as const;

type OutcomeValue = typeof OUTCOME_OPTIONS[number]['value'];

interface AppointmentRowState {
  outcome: OutcomeValue | '';
  alp: string;
  notes: string;
  saving: boolean;
  saved: boolean;
}

interface AppointmentOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: PendingAppointment[];
  /** Called when any outcome is saved so parent can refresh */
  onOutcomeSaved?: (id: number, outcome: OutcomeValue) => void;
}

function formatApptTime(utcIso: string, timezone?: string): string {
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Date(utcIso).toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return format(new Date(utcIso), 'MMM d, yyyy h:mm a');
  }
}

export function AppointmentOutcomeModal({
  isOpen,
  onClose,
  appointments,
  onOutcomeSaved,
}: AppointmentOutcomeModalProps) {
  const { toast } = useToast();

  const [rowStates, setRowStates] = useState<Record<number, AppointmentRowState>>({});

  const getRow = (id: number): AppointmentRowState =>
    rowStates[id] ?? { outcome: '', alp: '', notes: '', saving: false, saved: false };

  const setRow = (id: number, patch: Partial<AppointmentRowState>) =>
    setRowStates(prev => ({ ...prev, [id]: { ...getRow(id), ...patch } }));

  const handleSave = async (appt: PendingAppointment) => {
    const row = getRow(appt.id);
    if (!row.outcome) {
      toast({ title: 'Select an outcome', description: 'Please choose an outcome before saving.', variant: 'destructive' });
      return;
    }
    if (row.outcome === 'sale') {
      const cleanAlp = row.alp.replace(/[^0-9.]/g, '');
      if (!cleanAlp || Number(cleanAlp) <= 0) {
        toast({ title: 'ALP required', description: 'Enter a valid ALP amount for sale outcomes.', variant: 'destructive' });
        return;
      }
    }

    setRow(appt.id, { saving: true });
    try {
      const endpoint = resolveServiceUrl(`/api/appointments/${appt.id}/outcome`);
      const cleanAlp = row.alp.replace(/[^0-9.]/g, '');
      const outcomeNotes =
        row.outcome === 'sale' && cleanAlp
          ? [`ALP: $${cleanAlp}`, row.notes.trim()].filter(Boolean).join('\n')
          : row.notes;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        credentials: getServiceRequestCredentials(endpoint),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: row.outcome, outcomeNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setRow(appt.id, { saving: false, saved: true });
      toast({ title: 'Outcome saved', description: `${appt.lead_name} — ${row.outcome.replace('_', ' ')}` });
      onOutcomeSaved?.(appt.id, row.outcome as OutcomeValue);
    } catch (err: any) {
      setRow(appt.id, { saving: false });
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const unsaved = appointments.filter(a => !getRow(a.id).saved);
  const allDone = unsaved.length === 0 && appointments.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Appointment Outcomes</DialogTitle>
          <DialogDescription>
            {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} awaiting an outcome.
          </DialogDescription>
        </DialogHeader>

        {allDone ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-slate-700 dark:text-slate-200">All outcomes logged!</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {appointments.map(appt => {
              const row = getRow(appt.id);
              if (row.saved) return null;
              const optionObj = OUTCOME_OPTIONS.find(o => o.value === row.outcome);

              return (
                <div
                  key={appt.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{appt.lead_name}</div>
                      <div className="text-sm text-slate-500">{appt.lead_phone}</div>
                    </div>
                    <div className="text-right text-xs text-slate-400 shrink-0">
                      <div>{formatApptTime(appt.start_time)}</div>
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {appt.disposition_source === 'instant_presentation' ? 'Instant Pres.' : 'Booked'}
                      </Badge>
                    </div>
                  </div>

                  {/* Outcome selector */}
                  <Select value={row.outcome} onValueChange={v => setRow(appt.id, { outcome: v as OutcomeValue })}>
                    <SelectTrigger className={`w-full ${optionObj ? optionObj.color + ' border' : ''}`}>
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOME_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {row.outcome === 'sale' && (
                    <input
                      value={row.alp}
                      onChange={e => setRow(appt.id, { alp: e.target.value })}
                      placeholder="ALP amount (required for sale)"
                      className="h-9 w-full rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm text-emerald-900 outline-none ring-offset-background placeholder:text-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400"
                    />
                  )}

                  {/* Notes */}
                  <Textarea
                    value={row.notes}
                    onChange={e => setRow(appt.id, { notes: e.target.value })}
                    placeholder="Optional notes..."
                    className="min-h-[50px] resize-none text-sm"
                  />

                  {/* Save */}
                  <Button
                    onClick={() => handleSave(appt)}
                    disabled={!row.outcome || row.saving}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    {row.saving ? 'Saving...' : 'Save Outcome'}
                  </Button>
                </div>
              );
            })}

            <Button variant="outline" onClick={onClose} className="w-full mt-2">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
