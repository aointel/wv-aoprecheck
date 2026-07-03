import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Clock, AlertTriangle, ExternalLink, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { format, addDays, isBefore, isAfter, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadData?: {
    id?: string;
    taalk_lead_id?: string;
    leadId?: string;
    name: string;
    phone: string;
    email?: string;
  };
  producerData: {
    id: string;
    name: string;
    email: string;
  };
}

interface TimeSlot {
  time: string;
  available: boolean;
  conflictWith?: string;
}

interface CalendarSync {
  outlook: boolean;
  gmail: boolean;
  ics: boolean;
}

// Veteran's time zone options (same as SimpleAppointmentModal)
const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST, no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
];

// Next 30-min slot in business hours (9–21); returns "HH:mm"
function getNextSuggestedTime(): string {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  let nextMinute = minute <= 30 ? 30 : 60;
  let nextHour = minute <= 30 ? hour : hour + 1;
  if (nextMinute === 60) {
    nextMinute = 0;
    nextHour += 1;
  }
  if (nextHour < 9) {
    nextHour = 9;
    nextMinute = 0;
  }
  if (nextHour >= 21) {
    nextHour = 9;
    nextMinute = 0;
  }
  return `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
}

export function BookAppointmentModal({ isOpen, onClose, leadData, producerData }: BookAppointmentModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [calendarSync, setCalendarSync] = useState<CalendarSync>({
    outlook: false,
    gmail: false,
    ics: true
  });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [calendarSyncOpen, setCalendarSyncOpen] = useState(false);

  const queryClient = useQueryClient();

  // When modal opens, default to today and suggested time
  useEffect(() => {
    if (isOpen) {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      setSelectedDate(todayDate);
      setSelectedTime(getNextSuggestedTime());
    }
  }, [isOpen]);

  // Generate time slots for selected date with AM/PM display (9 AM to 9 PM)
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 9; hour <= 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: timeString,
          available: true,
          conflictWith: undefined
        });
      }
    }
    return slots;
  };

  // Format time for display in AM/PM format
  const formatTimeDisplay = (time: string) => {
    const [hour, minute] = time.split(':');
    const tempDate = new Date();
    tempDate.setHours(parseInt(hour), parseInt(minute));
    
    return tempDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(generateTimeSlots());

  // Check for conflicts when date/time changes
  const { data: conflictCheck } = useQuery({
    queryKey: ['/api/appointments/conflicts', producerData.email, selectedDate, selectedTime, duration],
    enabled: !!(selectedDate && selectedTime),
    queryFn: async () => {
      if (!selectedDate || !selectedTime) return null;
      
      const startTime = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + duration);

      const response = await fetch('/api/appointments/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentEmail: producerData.email,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        })
      });
      
      if (!response.ok) throw new Error('Failed to check conflicts');
      return response.json();
    }
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      console.log('📅 BookAppointmentModal: Creating appointment with data:', JSON.stringify(appointmentData, null, 2));
      try {
        const response = await fetch('/api/appointments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(appointmentData)
        });
        
        console.log('📡 BookAppointmentModal: Response status:', response.status, response.statusText);
        
        const responseText = await response.text();
        console.log('📄 BookAppointmentModal: Raw response:', responseText);
        
        if (!response.ok) {
          console.error('❌ BookAppointmentModal: Appointment creation failed:', response.status, responseText);
          let errorMessage = 'Failed to create appointment';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.details || errorData.message || errorMessage;
          } catch {
            errorMessage = responseText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.error('❌ BookAppointmentModal: Failed to parse response:', e);
          throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
        }
        
        console.log('✅ BookAppointmentModal: Response parsed:', JSON.stringify(result, null, 2));
        
        // Validate the response structure
        if (!result.success) {
          console.error('❌ BookAppointmentModal: Response indicates failure:', result);
          throw new Error(result.error || result.details || result.message || 'Appointment creation failed');
        }
        
        if (!result.appointment || !result.appointment.id) {
          console.error('❌ BookAppointmentModal: Response missing appointment data:', result);
          throw new Error('Appointment was not created - no appointment ID returned');
        }
        
        console.log('🎉 BookAppointmentModal: Appointment created successfully with ID:', result.appointment.id);
        return result;
      } catch (error: any) {
        console.error('❌ BookAppointmentModal: Error in mutationFn:', error);
        throw error;
      }
    },
    onSuccess: (newAppointment) => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      
      // Handle calendar sync (API returns { appointment, ... })
      const appointment = newAppointment?.appointment ?? newAppointment;
      if (calendarSync.outlook && appointment) {
        handleOutlookSync(appointment);
      }
      if (calendarSync.gmail && appointment) {
        handleGmailSync(appointment);
      }
      if (calendarSync.ics && appointment) {
        handleICSDownload(appointment);
      }
      
      toast({
        title: "Appointment Booked Successfully",
        description: `Meeting with ${leadData?.name} scheduled for ${format(selectedDate!, 'PPP')} at ${selectedTime}`,
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Unable to book appointment",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime || !leadData) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (conflictCheck?.hasConflicts) {
      toast({
        title: "Scheduling Conflict",
        description: "Please select a different time slot",
        variant: "destructive"
      });
      return;
    }

    // Validate required fields first
    if (!producerData.id || !producerData.email || !producerData.name) {
      toast({
        title: "Booking Failed",
        description: "Agent information is missing. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Use the actual Taalk lead ID - DO NOT generate random IDs
    const roomLeadId = leadData.taalk_lead_id || leadData.leadId || leadData.id;
    if (!roomLeadId) {
      toast({
        title: "Booking Failed",
        description: "Lead ID is missing. Please try again or contact support.",
        variant: "destructive"
      });
      return;
    }
    const twilioRoomName = `lead-${roomLeadId}`;

    // Create dates with maximum defensive coding
    let startTimeISO: string;
    let endTimeISO: string;
    
    try {
      // Ensure selectedDate is a valid Date
      let dateObj: Date;
      if (selectedDate instanceof Date) {
        dateObj = selectedDate;
      } else if (selectedDate) {
        dateObj = new Date(selectedDate);
      } else {
        throw new Error('No date selected');
      }
      
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date: ${selectedDate}`);
      }
      
      // Parse time safely
      if (!selectedTime || !selectedTime.includes(':')) {
        throw new Error(`Invalid time format: ${selectedTime}`);
      }
      
      const timeParts = selectedTime.split(':');
      if (timeParts.length !== 2) {
        throw new Error(`Invalid time format: ${selectedTime}`);
      }
      
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time values: ${selectedTime} (hours: ${hours}, minutes: ${minutes})`);
      }
      
      // Interpret date + time in VETERAN'S time zone (selectedTimezone)
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const day = dateObj.getDate();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      // Find UTC moment for this local time in veteran's zone (binary search)
      const tz = selectedTimezone;
      let low = new Date(Date.UTC(year, month, day, 0, 0, 0)).getTime();
      let high = low + 48 * 60 * 60 * 1000;
      const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: tz });
      const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' });
      for (let i = 0; i < 25; i++) {
        const mid = Math.floor((low + high) / 2);
        const dStr = fmtDate(mid);
        const tStr2 = fmtTime(mid);
        if (dStr < dateStr || (dStr === dateStr && tStr2 < timeStr)) low = mid;
        else high = mid;
      }
      const startTimeLocal = new Date(Math.floor((low + high) / 2));
      
      if (isNaN(startTimeLocal.getTime())) {
        throw new Error(`Failed to create start time from: ${year}-${month + 1}-${day} ${hours}:${minutes}`);
      }
      
      // Create end time by adding duration
      const endTimeLocal = new Date(startTimeLocal.getTime() + (duration * 60 * 1000));
      
      if (isNaN(endTimeLocal.getTime())) {
        throw new Error(`Failed to create end time`);
      }

      // Convert to ISO strings - toISOString() converts LOCAL time to UTC
      // This is correct - we want to store UTC in the database
      startTimeISO = startTimeLocal.toISOString();
      endTimeISO = endTimeLocal.toISOString();
      
      console.log('📅 Timezone Debug:', {
        veteranTimezone: selectedTimezone,
        selectedDateLocal: dateStr,
        selectedTimeLocal: timeStr,
        startTimeUTC: startTimeISO,
        endTimeUTC: endTimeISO,
        note: 'Date/time interpreted in veteran timezone, converted to UTC for storage'
      });
      
      console.log('📅 Modal: Created dates - startTime:', startTimeISO, 'endTime:', endTimeISO);
      
    } catch (error: any) {
      console.error('❌ Modal: Date creation error:', error);
      toast({
        title: "Date Error",
        description: error.message || "Failed to create appointment time. Please try again.",
        variant: "destructive"
      });
      return;
    }

    const appointmentData = {
      title: `Appointment with ${leadData.name}`,
      description: notes || '',
      appointmentType: 'presentation',
      startTime: startTimeISO,
      endTime: endTimeISO,
      duration: duration || 60,
      timezone: selectedTimezone,
      agentId: producerData.id,
      agentEmail: producerData.email,
      agentName: producerData.name,
      leadId: roomLeadId,
      leadName: leadData.name,
      leadPhone: leadData.phone,
      leadEmail: leadData.email || undefined,
      meetingPlatform: 'AO Meet',
      twilioRoomName,
      notes: notes || '',
      status: 'scheduled',
      confirmationStatus: 'pending'
    };

    console.log('📅 Modal: Sending appointment data:', JSON.stringify(appointmentData, null, 2));
    createAppointmentMutation.mutate(appointmentData);
  };

  const handleOutlookSync = (appointment: any) => {
    const startDate = new Date(appointment.startTime);
    const endDate = new Date(appointment.endTime);
    
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?` +
      `subject=${encodeURIComponent(appointment.title)}&` +
      `startdt=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&` +
      `enddt=${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&` +
      `body=${encodeURIComponent(appointment.description || '')}&` +
      `location=${encodeURIComponent(appointment.meetingUrl || 'ConnectNow Meeting')}`;
    
    window.open(outlookUrl, '_blank');
  };

  const handleGmailSync = (appointment: any) => {
    const startDate = new Date(appointment.startTime);
    const endDate = new Date(appointment.endTime);
    
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&` +
      `text=${encodeURIComponent(appointment.title)}&` +
      `dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&` +
      `details=${encodeURIComponent(appointment.description || '')}&` +
      `location=${encodeURIComponent(appointment.meetingUrl || 'ConnectNow Meeting')}`;
    
    window.open(googleUrl, '_blank');
  };

  const handleICSDownload = (appointment: any) => {
    const startDate = new Date(appointment.startTime);
    const endDate = new Date(appointment.endTime);
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AO Intelligence//ConnectNow//EN',
      'BEGIN:VEVENT',
      `UID:${appointment.id}@aointelligence.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${appointment.title}`,
      `DESCRIPTION:${appointment.description || ''}`,
      `LOCATION:${appointment.meetingUrl || 'ConnectNow Meeting'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointment-${appointment.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Book Appointment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Lead Information */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Client Information</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {leadData?.name || 'Unknown'}</p>
              <p><strong>Phone:</strong> {leadData?.phone || 'Not provided'}</p>
              {leadData?.email && <p><strong>Email:</strong> {leadData.email}</p>}
            </div>
          </div>

          {/* Veteran's time zone - REQUIRED for all scheduling */}
          <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/10">
            <Label htmlFor="book-timezone" className="text-base font-semibold">
              Veteran&apos;s time zone
            </Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger id="book-timezone" className="w-full max-w-sm mt-2">
                <SelectValue placeholder="Select time zone" />
              </SelectTrigger>
              <SelectContent>
                {US_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Date and time below are in the veteran&apos;s time zone
            </p>
          </div>

          {/* Date + Time - compact row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => {
                      const pacificNow = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
                      const pacificToday = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), pacificNow.getDate());
                      return isAfter(date, addDays(pacificToday, 365));
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {selectedDate && (
              <div>
                <Label>Time</Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot.time} value={slot.time} disabled={!slot.available}>
                        {formatTimeDisplay(slot.time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Conflict Warning */}
          {conflictCheck?.hasConflicts && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Schedule conflict:</strong> Please choose a different time.
                <ul className="mt-1 space-y-1">
                  {conflictCheck.conflicts.map((conflict: any, index: number) => (
                    <li key={index} className="text-sm">
                      • {conflict.title} ({format(parseISO(conflict.startTime), 'HH:mm')} - {format(parseISO(conflict.endTime), 'HH:mm')})
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions - primary */}
          <div className="flex justify-between gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createAppointmentMutation.isPending || !selectedDate || !selectedTime || conflictCheck?.hasConflicts}
              className="flex items-center gap-2"
            >
              {createAppointmentMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Booking...
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4" />
                  Book Appointment
                </>
              )}
            </Button>
          </div>

          {/* Options - collapsible (duration, notes) */}
          <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
                {optionsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Options (duration, notes)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select value={duration.toString()} onValueChange={(value) => setDuration(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about the appointment..."
                  rows={2}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Add to calendar - collapsible */}
          <Collapsible open={calendarSyncOpen} onOpenChange={setCalendarSyncOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
                {calendarSyncOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Add to calendar
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="outlook-sync"
                    checked={calendarSync.outlook}
                    onChange={(e) => setCalendarSync(prev => ({ ...prev, outlook: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="outlook-sync" className="text-sm flex items-center gap-2">
                    <ExternalLink className="h-3 w-3" />
                    Add to Outlook Calendar
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="gmail-sync"
                    checked={calendarSync.gmail}
                    onChange={(e) => setCalendarSync(prev => ({ ...prev, gmail: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="gmail-sync" className="text-sm flex items-center gap-2">
                    <ExternalLink className="h-3 w-3" />
                    Add to Google Calendar
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ics-download"
                    checked={calendarSync.ics}
                    onChange={(e) => setCalendarSync(prev => ({ ...prev, ics: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="ics-download" className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-3 w-3" />
                    Download .ics calendar file
                  </label>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </form>
      </DialogContent>
    </Dialog>
  );
}