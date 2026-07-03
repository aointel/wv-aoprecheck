import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Calendar, Send, X } from 'lucide-react';
import type { RecruitCandidate } from '@shared/schema';

interface AppointmentScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: RecruitCandidate | null;
  userEmail?: string;
  currentStageId?: number;
  stageName?: string;
  stageUrl?: string;
  onAppointmentSaved?: () => void;
}

export function AppointmentScheduleModal({ 
  open, 
  onOpenChange, 
  candidate, 
  userEmail,
  currentStageId,
  stageName,
  stageUrl,
  onAppointmentSaved
}: AppointmentScheduleModalProps) {
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [sendSMS, setSendSMS] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Reset form when modal opens/closes or candidate changes
  useEffect(() => {
    if (open && candidate) {
      // If candidate has existing appointment, pre-fill
      if (candidate.appointmentDate) {
        const date = new Date(candidate.appointmentDate);
        setAppointmentDate(date.toISOString().split('T')[0]);
        setAppointmentTime(date.toTimeString().slice(0, 5));
      } else {
        // Default to tomorrow at 10 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setAppointmentDate(tomorrow.toISOString().split('T')[0]);
        setAppointmentTime('10:00');
      }
      setAppointmentNotes(candidate.appointmentNotes || '');
      setSendSMS(true);
    } else if (!open) {
      // Reset when closing
      setAppointmentDate('');
      setAppointmentTime('');
      setAppointmentNotes('');
      setSendSMS(true);
    }
  }, [open, candidate]);

  const formatAppointmentDateTime = (date: string, time: string): string => {
    if (!date || !time) return '';
    
    const dateObj = new Date(`${date}T${time}`);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    return dateObj.toLocaleDateString('en-US', options);
  };

  const generateSMSMessage = (): string => {
    if (!candidate || !appointmentDate || !appointmentTime) return '';
    
    const formattedDateTime = formatAppointmentDateTime(appointmentDate, appointmentTime);
    let message = `Hi ${candidate.firstName}, this is AO Recruit! `;
    
    if (formattedDateTime) {
      message += `Your appointment is scheduled for ${formattedDateTime}. `;
    }
    
    if (stageUrl) {
      message += `Click here for more information: ${stageUrl}`;
    } else if (currentStageId === 3) {
      // Virtual Overview - use hardcoded journey URL (will be generated on backend)
      message += `Click here to watch our Virtual Overview and connect with us!`;
    }
    
    return message.trim();
  };

  const handleSave = async () => {
    if (!candidate || !appointmentDate || !appointmentTime) {
      toast({
        title: 'Error',
        description: 'Please select both date and time for the appointment',
        variant: 'destructive',
      });
      return;
    }

    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    
    if (appointmentDateTime < new Date()) {
      toast({
        title: 'Error',
        description: 'Appointment date/time must be in the future',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const smsMessage = sendSMS ? generateSMSMessage() : null;
      
      const response = await apiRequest(
        'POST',
        '/api/recruit/candidates/appointment',
        {
          candidateId: candidate.id,
          appointmentDate: appointmentDateTime.toISOString(),
          appointmentNotes: appointmentNotes.trim() || null,
          sendSMS: sendSMS && !!smsMessage,
          smsMessage: smsMessage,
          currentStageId: currentStageId ?? null,
          stageName: stageName ?? null,
          stageUrl: stageUrl ?? null,
        },
        userEmail
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save appointment' }));
        throw new Error(errorData.error || 'Failed to save appointment');
      }

      toast({
        title: 'Appointment Scheduled',
        description: sendSMS 
          ? `Appointment saved and SMS sent to ${candidate.firstName} ${candidate.lastName}`
          : `Appointment saved for ${candidate.firstName} ${candidate.lastName}`,
      });

      // Reset form and close modal
      setAppointmentDate('');
      setAppointmentTime('');
      setAppointmentNotes('');
      setSendSMS(true);
      onOpenChange(false);
      
      // Notify parent to refresh data
      if (onAppointmentSaved) {
        onAppointmentSaved();
      }
    } catch (error: any) {
      console.error('Failed to save appointment:', error);
      toast({
        title: 'Failed to save appointment',
        description: error.message || 'An error occurred while saving the appointment',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setAppointmentDate('');
      setAppointmentTime('');
      setAppointmentNotes('');
      setSendSMS(true);
      onOpenChange(false);
    }
  };

  const smsPreview = generateSMSMessage();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {candidate && (
            <div className="space-y-2">
              <Label>Candidate:</Label>
              <div className="text-sm font-medium">
                {candidate.firstName} {candidate.lastName}
              </div>
              {stageName && (
                <div className="text-xs text-muted-foreground">
                  Current Stage: {stageName}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointment-date">Date:</Label>
              <Input
                id="appointment-date"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                disabled={isSaving}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment-time">Time:</Label>
              <Input
                id="appointment-time"
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                disabled={isSaving}
                className="w-full"
              />
            </div>
          </div>

          {appointmentDate && appointmentTime && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                <Calendar className="h-4 w-4 inline mr-2" />
                Scheduled for: {formatAppointmentDateTime(appointmentDate, appointmentTime)}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="appointment-notes">Notes (optional):</Label>
            <Textarea
              id="appointment-notes"
              value={appointmentNotes}
              onChange={(e) => setAppointmentNotes(e.target.value)}
              placeholder="Add any additional notes about this appointment..."
              className="min-h-[80px] resize-none"
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center space-x-2 p-3 border rounded-lg">
            <Checkbox
              id="send-sms"
              checked={sendSMS}
              onCheckedChange={(checked) => setSendSMS(checked === true)}
              disabled={isSaving || !candidate?.phone}
            />
            <Label htmlFor="send-sms" className="flex-1 cursor-pointer">
              <div className="font-medium">Send SMS notification</div>
              <div className="text-xs text-muted-foreground">
                {candidate?.phone 
                  ? 'Candidate will receive an SMS with appointment details and stage URL'
                  : 'Candidate does not have a phone number'}
              </div>
            </Label>
          </div>

          {sendSMS && smsPreview && (
            <div className="space-y-2">
              <Label>SMS Preview:</Label>
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                <div className="text-sm whitespace-pre-wrap break-words">
                  {smsPreview}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {smsPreview.length} / 1600 characters
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !appointmentDate || !appointmentTime}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                {sendSMS ? 'Save & Send SMS' : 'Save Appointment'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

