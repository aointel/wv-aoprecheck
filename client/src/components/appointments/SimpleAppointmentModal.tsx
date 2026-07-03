import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, MapPin, X, CheckCircle, AlertCircle, DollarSign, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { AppointmentResolutionModal } from '@/components/modals/AppointmentResolutionModal';

interface Lead {
  id: string | number;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  email?: string;
  state?: string;
  city?: string;
  market?: string;
}

interface SimpleAppointmentModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onBookingComplete?: (appointment: any) => void;
  userEmail?: string;
}

const APPOINTMENT_TYPES = [
  { value: 'virtual', label: 'Virtual Appointment' },
];

const MEETING_PLATFORMS = [
  { value: 'whereby', label: 'AOI Meet', description: 'Professional video meetings with direct client access' },
  { value: 'zoom', label: 'Zoom Meeting', description: 'Professional Zoom meeting with automatic scheduling' }
];

// Presentation outcomes (5) - when they started a presentation
const PRESENTATION_OUTCOMES = [
  { value: 'SALE', label: 'Sale', icon: DollarSign },
  { value: 'NO_SALE', label: 'No Sale', icon: X },
  { value: 'THINK', label: 'Think / Reschedule', icon: CalendarClock },
  { value: 'NO_SHOW', label: 'No Show', icon: AlertCircle },
  { value: 'CANCELLED', label: 'Cancelled', icon: X },
];
// Non-presentation outcomes (2)
const NON_PRESENTATION_OUTCOMES = [
  { value: 'ATTENDED', label: 'Attended', icon: CheckCircle },
  { value: 'NO_SHOW', label: 'No Show', icon: AlertCircle },
];

// HH:mm format - matches /api/schedule/availability response for slot comparison (see docs/SCHEDULE_TIME_FORMATS.md)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

// Standard US time zones for agent to choose (veteran's time zone)
const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST, no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
];

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

/** Given a date (YYYY-MM-DD), time (HH:mm), and IANA timezone, return the UTC Date for that local moment. */
function localTimeInZoneToUTC(dateStr: string, timeStr: string, ianaZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hour, min] = timeStr.split(':').map(Number);
  const targetDateStr = dateStr;
  const targetTimeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  let low = new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).getTime();
  let high = low + 48 * 60 * 60 * 1000;
  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString('en-CA', { timeZone: ianaZone });
  const fmtTime = (t: number) =>
    new Date(t).toLocaleTimeString('en-US', { timeZone: ianaZone, hour12: false, hour: '2-digit', minute: '2-digit' });
  for (let i = 0; i < 25; i++) {
    const mid = Math.floor((low + high) / 2);
    const dStr = fmtDate(mid);
    const tStr = fmtTime(mid);
    if (dStr < targetDateStr || (dStr === targetDateStr && tStr < targetTimeStr)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return new Date(Math.floor((low + high) / 2));
}

// This will be replaced with real calendar data from API

export function SimpleAppointmentModal({ lead, isOpen, onClose, onBookingComplete, userEmail }: SimpleAppointmentModalProps) {
  // Normalize lead names - support both camelCase (firstName/lastName) and snake_case (first_name/last_name) from API/dialer
  const firstName = lead?.firstName ?? lead?.first_name ?? 'Unknown';
  const lastName = lead?.lastName ?? lead?.last_name ?? 'Lead';

  const { toast } = useToast();
  const { authState } = useAuth();
  const [isScheduling, setIsScheduling] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [manualPhoneNumber, setManualPhoneNumber] = useState('');
  
  // Form state
  const [appointmentType, setAppointmentType] = useState('virtual');
  const [meetingPlatform, setMeetingPlatform] = useState('whereby');
  const [selectedDate, setSelectedDate] = useState(() => {
    // Get current date in local timezone to avoid UTC conversion issues
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [selectedTimezone, setSelectedTimezone] = useState('America/New_York');
  const [notes, setNotes] = useState('');
  
  // Step state for modal flow - disposition-required blocks until resolved
  const [step, setStep] = useState<'loading' | 'disposition-required' | 'type' | 'time' | 'confirm' | 'aoi-meet'>('loading');
  const [meetsNeedingDisposition, setMeetsNeedingDisposition] = useState<any[]>([]);
  const [isLoadingDisposition, setIsLoadingDisposition] = useState(false);
  const [resolutionTarget, setResolutionTarget] = useState<{ meet: any; disposition: string } | null>(null);
  
  // Real Whereby meeting state - no fake IDs
  const [wherebyMeeting, setWherebyMeeting] = useState<any>(null);
  const [meetingUrl, setMeetingUrl] = useState('');
  
  // Create real Whereby meeting when needed
  const createWherebyMeeting = async () => {
    try {
      const agentEmail = userEmail || 'cnsysop@aoglobelife.com';
      
      const requestBody = {
        agentEmail: agentEmail,
        leadName: `${firstName} ${lastName}`,
        leadId: lead.id?.toString() || 'appointment'
      };

      console.log('🎥 Creating real Whereby meeting:', requestBody);

      const response = await fetch('/api/whereby/create-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const meeting = await response.json();
      
      if (!meeting.success) {
        throw new Error(meeting.error || 'Failed to create meeting');
      }

      console.log('✅ Real Whereby meeting created:', meeting);
      setWherebyMeeting(meeting);
      
      // Set the appropriate URL based on user role
      // Any authenticated producer gets host access to their own meeting
      const isHost = Boolean(userEmail); // Any authenticated user is host of their own meeting
      const urlToUse = isHost ? meeting.hostRoomUrl : meeting.roomUrl;
      
      console.log(`🎥 User ${userEmail} is ${isHost ? 'HOST' : 'PARTICIPANT'} - using ${isHost ? 'hostRoomUrl' : 'roomUrl'}`);
      setMeetingUrl(urlToUse);
      return meeting;
    } catch (error) {
      console.error('Failed to create Whereby meeting:', error);
      toast({
        title: "Meeting Creation Failed",
        description: "Could not create video meeting. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  // State to track if appointment has been created automatically
  const [appointmentCreated, setAppointmentCreated] = useState(false);
  
  // Create Whereby meeting when platform is selected OR when step changes to confirm
  useEffect(() => {
    if (meetingPlatform === 'whereby' && !wherebyMeeting && !meetingUrl && isOpen) {
      console.log('🎥 useEffect: Creating Whereby meeting...');
      createWherebyMeeting();
    }
  }, [meetingPlatform, step, isOpen]);

  // Function to schedule appointments - defined before useEffect
  const handleScheduleAppointment = async () => {
    setIsScheduling(true);
    
    try {
      console.log('📅 Starting appointment scheduling...', { lead, meetingPlatform, selectedDate, selectedTime });
      
      // Generate unique leadId for private room system
      const leadId = lead.id?.toString() || `apt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const twilioRoomName = `lead-${leadId}`;
      
      let meetingLink = '';
      let meetingData = {};
      
      if (meetingPlatform === 'zoom') {
        // Use agent's personal Zoom room (from their profile setup)
        const zoomRoomId = authState.profile?.zoomId || '';
        const zoomPassword = authState.profile?.zoomPassword || '1';
        
        if (!zoomRoomId) {
          throw new Error('No Zoom Room ID found. Please set up your Zoom credentials in Profile Settings.');
        }
        
        // Construct Zoom meeting link using agent's personal room
        meetingLink = `https://zoom.us/j/${zoomRoomId}?pwd=${zoomPassword}`;
          meetingData = {
            platform: 'zoom',
          meetingId: zoomRoomId,
            joinUrl: meetingLink,
          meetingPassword: zoomPassword,
          personalRoom: true
          };
        
        console.log('✅ Using agent Zoom room:', { zoomRoomId, zoomPassword });
      } else if (meetingPlatform === 'meet-now') {
        // For Meet Now, create a real Whereby meeting immediately
        const meeting = await createWherebyMeeting();
        if (!meeting) {
          throw new Error('Failed to create Whereby meeting');
        }
        meetingLink = meeting.roomUrl;
        meetingData = {
          platform: 'whereby',
          roomUrl: meeting.roomUrl,
          hostRoomUrl: meeting.hostRoomUrl,
          meetingId: meeting.meetingId,
          leadId: leadId,
          immediateStart: true
        };
      } else {
        // Create real Whereby meeting via API
        const meeting = await createWherebyMeeting();
        if (!meeting) {
          throw new Error('Failed to create Whereby meeting');
        }
        meetingLink = meeting.roomUrl;
        meetingData = {
          platform: 'whereby',
          roomUrl: meeting.roomUrl,
          hostRoomUrl: meeting.hostRoomUrl,
          meetingId: meeting.meetingId,
          leadId: leadId
        };
      }
      
      // For Meet Now, use current time instead of selected time
      const appointmentStartTime = meetingPlatform === 'meet-now'
        ? new Date()
        : localTimeInZoneToUTC(selectedDate, selectedTime, selectedTimezone);
      const appointmentEndTime = new Date(appointmentStartTime.getTime() + 60 * 60000);

      // Send SMS invitation to client with meeting link (show time in selected timezone for the veteran)
      try {
        const agentFullName = authState.profile ? `${authState.profile.firstName} ${authState.profile.lastName}` : authState.user?.email?.split('@')[0] || 'Your agent';
        const platformName = meetingPlatform === 'zoom' ? 'Zoom' : 'video';
        const appointmentTime = appointmentStartTime.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: selectedTimezone
        });
        
        const smsMessage = `Hi ${firstName}, ${agentFullName} has scheduled a ${platformName} meeting with you on ${appointmentTime}. Join here: ${meetingLink}`;
        
        console.log('📱 Sending appointment SMS:', { to: lead.phone, message: smsMessage });
        
        const smsResponse = await fetch('/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: lead.phone,
            message: smsMessage
          })
        });
        
        if (smsResponse.ok) {
          console.log('✅ Appointment SMS sent successfully');
        } else {
          console.warn('⚠️ SMS sending failed, but appointment still created');
        }
      } catch (smsError) {
        console.error('❌ SMS Error:', smsError);
        // Don't fail the whole appointment if SMS fails
      }
      
      // Create appointment via API
      const appointmentData = {
        title: `Virtual Appointment with ${firstName} ${lastName}`,
        description: notes,
        appointmentType: meetingPlatform === 'meet-now' ? 'immediate' : 'virtual',
        startTime: appointmentStartTime.toISOString(),
        endTime: appointmentEndTime.toISOString(),
        duration: 60,
        timezone: selectedTimezone,
        agentId: authState.user?.email || 'unknown',
        agentEmail: authState.user?.email || 'producer@aoglobelife.com',
        agentName: authState.profile ? `${authState.profile.firstName} ${authState.profile.lastName}` : 'producer',
        leadId,
        leadName: `${firstName} ${lastName}`,
        leadPhone: lead.phone,
        leadEmail: lead.email || '',
        meetingPlatform: meetingPlatform === 'zoom' ? 'Zoom Meeting' : meetingPlatform === 'meet-now' ? 'AOI Meet' : 'Whereby Video Meetings',
        meetingLink,
        meetingData,
        twilioRoomName: meetingPlatform === 'whereby' ? twilioRoomName : null,
        notes,
        status: 'scheduled',
        confirmationStatus: 'pending'
      };

      // Send meet to API (using meets table, not appointments)
      const response = await fetch('/api/meets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_email: authState.user?.email || userEmail,
          agent_name: `${authState.profile?.firstName || ''} ${authState.profile?.lastName || ''}`.trim() || authState.user?.email?.split('@')[0],
          client_first_name: firstName,
          client_last_name: lastName,
          client_phone: lead?.phone,
          client_email: lead?.email || '', // CRITICAL: Send email for Unavatar social media pictures
          client_state: lead?.state,
          client_city: lead?.city,
          scheduled_date: appointmentStartTime.toISOString(),
          scheduled_time: selectedTime,
          timezone: selectedTimezone,
          market_type: lead?.market || 'Unknown',
          meet_type: 'presentation',
          notes,
          created_from: 'call_connector',
          whereby_room_url: meetingLink
        }),
      });

      if (!response.ok) {
        console.error('❌ Appointment creation failed - Response status:', response.status);
        console.error('❌ Response headers:', response.headers);
        
        // Try to get error details, but handle HTML responses gracefully
        let errorMessage = 'Failed to create appointment';
        try {
          const errorData = await response.json();
          console.error('❌ Appointment creation failed:', errorData);
          errorMessage = errorData.details || errorData.error || errorMessage;
        } catch (parseError) {
          // If we can't parse as JSON, get the text response
          try {
            const errorText = await response.text();
            console.error('❌ Non-JSON error response:', errorText.substring(0, 200));
            errorMessage = `API Error: ${response.status} ${response.statusText}`;
          } catch (textError) {
            console.error('❌ Could not read error response:', textError);
          }
        }
        throw new Error(errorMessage);
      }

      let createdAppointment;
      try {
        createdAppointment = await response.json();
      } catch (jsonError) {
        console.error('❌ Failed to parse success response as JSON:', jsonError);
        // If we can't parse the success response, but the request was successful, 
        // create a basic appointment object
        createdAppointment = {
          success: true,
          appointment: {
            title: appointmentData.title,
            leadName: appointmentData.leadName,
            startTime: appointmentData.startTime,
            endTime: appointmentData.endTime,
            meetingLink: meetingLink
          }
        };
      }
      
      // Removed toast notification - appointment booking happens silently
      
      if (onBookingComplete) {
        onBookingComplete(createdAppointment);
      }
      
      // For Meet Now appointments, only close if not already on AOI Meet step
      if (meetingPlatform === 'meet-now' && step !== 'aoi-meet') {
        setStep('aoi-meet'); // Go to AOI Meet step within the same flow
      } else if (step !== 'aoi-meet') {
        onClose();
      }
      // If we're already on aoi-meet step, don't close or change steps
    } catch (error) {
      console.error('❌ Failed to schedule appointment:', error);
      toast({
        title: "Scheduling Failed", 
        description: `Unable to schedule appointment: ${(error as Error)?.message || 'Please try again.'}`,
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };

  // DISABLED: Auto-create appointment when AOI Meet step is reached
  // useEffect(() => {
  //   if (step === 'aoi-meet' && !appointmentCreated && !isScheduling) {
  //     const createAppointmentInBackground = async () => {
  //       try {
  //         setIsScheduling(true);
  //         await handleScheduleAppointment();
  //         setAppointmentCreated(true);
  //         console.log('✅ Appointment created automatically in background');
  //       } catch (error) {
  //         console.error('❌ Background appointment creation failed:', error);
  //         // Don't show error toast since this is background operation
  //       } finally {
  //         setIsScheduling(false);
  //       }
  //     };
      
  //     createAppointmentInBackground();
  //   }
  // }, [step, appointmentCreated, isScheduling, handleScheduleAppointment]);

  // Fetch meets needing disposition when modal opens - BLOCKS until resolved
  useEffect(() => {
    if (!isOpen) return;
    const agentEmail = authState.user?.email || userEmail;
    if (!agentEmail) {
      setStep('type');
      setIsLoadingDisposition(false);
      return;
    }
    let cancelled = false;
    const fetchNeeding = async () => {
      setIsLoadingDisposition(true);
      try {
        const res = await fetch(`/api/meets/agent/${encodeURIComponent(agentEmail)}/needing-disposition`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const meets = data.meets || [];
        if (meets.length > 0 && !cancelled) {
          setMeetsNeedingDisposition(meets);
          setStep('disposition-required');
        } else if (!cancelled) {
          setStep('type');
        }
      } catch {
        if (!cancelled) setStep('type');
      } finally {
        if (!cancelled) setIsLoadingDisposition(false);
      }
    };
    fetchNeeding();
    return () => { cancelled = true; };
  }, [isOpen, authState.user?.email, userEmail]);

  // Reset modal state when modal opens/closes (step is set by disposition fetch)
  useEffect(() => {
    if (isOpen) {
      setMeetingPlatform('whereby');
      setWherebyMeeting(null);
      setMeetingUrl('');
      setIsScheduling(false);
      setManualPhoneNumber('');
      setNotes('');
      
      // Reset date, time, and timezone to current defaults
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
      setSelectedTime('10:00');
      setSelectedTimezone('America/New_York');
    } else {
      // Clean up when modal closes
      setAppointmentCreated(false);
    }
  }, [isOpen]);
  
  // Calendar sync state
  const [calendarSync, setCalendarSync] = useState({
    outlook: false,
    gmail: false,
    ics: false
  });
  
  // Schedule state
  const [producerSchedule, setproducerSchedule] = useState<{[key: string]: any[]}>({});
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Load producer schedule from master_schedule when modal opens or date/timezone changes
  useEffect(() => {
    if (isOpen && authState.user?.email) {
      loadproducerSchedule();
    }
  }, [isOpen, selectedDate, selectedTimezone, authState.user?.email]);

  const handleDispositionComplete = async (data: { disposition: string; saleAmount?: number; notes?: string }) => {
    if (!resolutionTarget) return;
    const res = await fetch(`/api/meets/${resolutionTarget.meet.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disposition: data.disposition,
        sale_amount: data.saleAmount,
        notes: data.notes,
      }),
    });
    if (!res.ok) throw new Error('Failed to save');
    setMeetsNeedingDisposition((prev) => {
      const next = prev.filter((m) => m.id !== resolutionTarget.meet.id);
      if (next.length === 0) setStep('type');
      return next;
    });
    setResolutionTarget(null);
    toast({ title: 'Outcome recorded', description: `Marked as ${data.disposition.replace(/_/g, ' ')}` });
  };

  const loadproducerSchedule = async () => {
    if (!authState.user?.email) return;
    
    setIsLoadingSchedule(true);
    try {
      const params = new URLSearchParams({
        agentEmail: authState.user.email,
        date: selectedDate,
        timezone: selectedTimezone,
      });
      const response = await fetch(`/api/schedule/availability?${params}`);
      if (response.ok) {
        const data = await response.json();
        const bookedSlots = Array.isArray(data) ? data : [];
        
        // Update schedule state (keyed by date+tz for consistency)
        setproducerSchedule(prev => ({
          ...prev,
          [selectedDate]: bookedSlots
        }));
        
        // Booked times are in HH:mm format from master_schedule (same as TIME_SLOTS)
        const bookedTimes = bookedSlots.map((s: { time: string }) => s.time);
        const available = TIME_SLOTS.filter(slot => !bookedTimes.includes(slot));
        setAvailableSlots(available);
        
        // If current selected time is not available, pick first available
        if (!available.includes(selectedTime) && available.length > 0) {
          setSelectedTime(available[0]);
        }
      } else {
        setproducerSchedule(prev => ({ ...prev, [selectedDate]: [] }));
        setAvailableSlots(TIME_SLOTS);
      }
    } catch (error) {
      console.error('Failed to load schedule availability:', error);
      setproducerSchedule(prev => ({ ...prev, [selectedDate]: [] }));
      setAvailableSlots(TIME_SLOTS);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  // Calendar sync functions (same as AppointmentScheduler)
  const handleOutlookSync = async (appointment: any) => {
    try {
      const startDate = new Date(appointment.startTime);
      const endDate = new Date(appointment.endTime);
      
      const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?` +
        `subject=${encodeURIComponent(appointment.title)}&` +
        `startdt=${startDate.toISOString()}&` +
        `enddt=${endDate.toISOString()}&` +
        `body=${encodeURIComponent(`Meeting with ${appointment.leadName}\n\nJoin Meeting: ${appointment.meetingLink || `https://aoirail-production.up.railway.app/twilio-video?room=${encodeURIComponent(`lead-${appointment.leadId}`)}&agentName=Client&leadName=${encodeURIComponent(appointment.leadName)}`}`)}`;
      
      window.open(outlookUrl, '_blank');
    } catch (error) {
      console.error('Outlook sync failed:', error);
    }
  };

  const handleGmailSync = async (appointment: any) => {
    try {
      const startDate = new Date(appointment.startTime);
      const endDate = new Date(appointment.endTime);
      
      const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&` +
        `text=${encodeURIComponent(appointment.title)}&` +
        `dates=${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&` +
        `details=${encodeURIComponent(`Meeting with ${appointment.leadName}\n\nJoin Meeting: ${appointment.meetingLink || `https://aoirail-production.up.railway.app/twilio-video?room=${encodeURIComponent(`lead-${appointment.leadId}`)}&agentName=Client&leadName=${encodeURIComponent(appointment.leadName)}`}`)}&` +
        `location=${encodeURIComponent('ConnectNow Virtual Meeting Room')}`;
      
      window.open(googleCalUrl, '_blank');
    } catch (error) {
      console.error('Google Calendar sync failed:', error);
    }
  };

  const handleICSDownload = (appointment: any) => {
    try {
      const startDate = new Date(appointment.startTime);
      const endDate = new Date(appointment.endTime);
      
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ConnectNow//ConnectNow Meetings//EN',
        'BEGIN:VEVENT',
        `UID:${appointment.id}@aoirail-production.up.railway.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `SUMMARY:${appointment.title}`,
        `DESCRIPTION:Meeting with ${appointment.leadName}\\n\\nJoin Meeting: ${appointment.meetingLink || 'https://aoirail-production.up.railway.app/video-waiting-room?leadId=' + appointment.leadId}`,
        'LOCATION:ConnectNow Virtual Meeting Room',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      
      const blob = new Blob([icsContent], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `appointment-${appointment.leadName.replace(/\s+/g, '-')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('ICS download failed:', error);
    }
  };

  const canClose = step !== 'disposition-required' && step !== 'loading';
  const handleOpenChange = (open: boolean) => {
    if (!open && !canClose) {
      toast({ title: 'Complete required', description: 'You must record the outcome for all appointments before continuing.', variant: 'destructive' });
      return;
    }
    if (!open) onClose();
  };

  // Keep hooks unconditional; returning before hooks causes React tree corruption.
  if (!lead) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-hidden p-0 [&>button]:hidden"
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
        onInteractOutside={(e) => !canClose && e.preventDefault()}
      >
        <DialogTitle className="sr-only">Schedule Appointment with {firstName} {lastName}</DialogTitle>
        <DialogDescription className="sr-only">Choose meeting type, select date and time, and confirm appointment details</DialogDescription>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Schedule Appointment</h2>
                <p className="text-blue-100">Meeting with {firstName} {lastName}</p>
              </div>
            </div>
            <button
              onClick={() => canClose && onClose()}
              disabled={!canClose}
              className={`absolute top-4 right-4 text-white hover:text-white transition-all rounded-full p-2.5 hover:bg-white/30 backdrop-blur-sm border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl hover:scale-110 group ${!canClose ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label="Close"
              title={!canClose ? 'Record outcomes first' : 'Close'}
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-4 mt-6">
            {(step === 'disposition-required' || step === 'loading') && (
              <div className="flex items-center gap-2 text-white">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-amber-500">
                  {step === 'loading' ? '...' : '!'}
                </div>
                <span className="text-sm font-medium">{step === 'loading' ? 'Checking schedule' : 'Record outcomes required'}</span>
              </div>
            )}
            {step !== 'disposition-required' && step !== 'loading' && (
            <div className={`flex items-center gap-2 ${step === 'type' ? 'text-white' : 'text-blue-200'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'type' ? 'bg-white text-blue-600' : 'bg-blue-500'}`}>
                1
              </div>
              <span className="text-sm font-medium">Meeting Type</span>
            </div>
            )}
            {step !== 'disposition-required' && <div className={`h-0.5 flex-1 ${step !== 'type' ? 'bg-white' : 'bg-blue-400'}`} />}
            
            {step !== 'disposition-required' && meetingPlatform === 'meet-now' ? (
              // Meet Now flow: Type → AOI Meet
              <div className={`flex items-center gap-2 ${step === 'aoi-meet' ? 'text-white' : 'text-blue-200'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'aoi-meet' ? 'bg-white text-blue-600' : 'bg-blue-500'}`}>
                  2
                </div>
                <span className="text-sm font-medium">Start Meeting</span>
              </div>
            ) : step !== 'disposition-required' && step !== 'loading' ? (
              // Normal flow: Type → Time → Confirm
              <>
                <div className={`flex items-center gap-2 ${step === 'time' ? 'text-white' : 'text-blue-200'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'time' ? 'bg-white text-blue-600' : 'bg-blue-500'}`}>
                    2
                  </div>
                  <span className="text-sm font-medium">Date & Time</span>
                </div>
                <div className={`h-0.5 flex-1 ${step === 'confirm' ? 'bg-white' : 'bg-blue-400'}`} />
                <div className={`flex items-center gap-2 ${step === 'confirm' ? 'text-white' : 'text-blue-200'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'confirm' ? 'bg-white text-blue-600' : 'bg-blue-500'}`}>
                    3
                  </div>
                  <span className="text-sm font-medium">Confirm</span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Content */}
        <div className="p-0">
          {/* Loading - checking for appointments needing disposition */}
          {step === 'loading' && (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Checking your schedule...</p>
            </div>
          )}

          {/* Step 0: BLOCKING - Record outcomes for past appointments before doing anything */}
          {step === 'disposition-required' && (
            <div className="p-8">
              <div className="mb-6">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-6 w-6" />
                  <h3 className="text-xl font-semibold">Record appointment outcomes</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  You must record what happened with these appointments before you can schedule new ones.
                </p>
              </div>
              {isLoadingDisposition ? (
                <div className="text-center py-12">Loading...</div>
              ) : (
                <div className="space-y-4">
                  {meetsNeedingDisposition.map((meet) => {
                    const clientName = `${meet.client_first_name || ''} ${meet.client_last_name || ''}`.trim() || 'Client';
                    const outcomes = meet.presentation_session_id ? PRESENTATION_OUTCOMES : NON_PRESENTATION_OUTCOMES;
                    return (
                      <Card key={meet.id} className="border-amber-200 dark:border-amber-800">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                              <p className="font-semibold">{clientName}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(meet.scheduled_date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {outcomes.map((outcome) => {
                                const Icon = outcome.icon;
                                return (
                                  <Button
                                    key={outcome.value}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setResolutionTarget({ meet, disposition: outcome.value })}
                                  >
                                    <Icon className="h-4 w-4 mr-2" />
                                    {outcome.label}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Meeting Type Selection */}
          {step === 'type' && (
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Choose Meeting Platform</h3>
                <p className="text-gray-600 dark:text-gray-400">Select your preferred video conferencing platform</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MEETING_PLATFORMS.map((platform) => (
                  <div
                    key={platform.value}
                    onClick={() => setMeetingPlatform(platform.value)}
                    className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      meetingPlatform === platform.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg mb-1">{platform.label}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {platform.description}
                        </p>
                        <div className="text-xs text-gray-500">
                          Professional video meeting • Secure & reliable
                        </div>
                      </div>
                      {meetingPlatform === platform.value && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-8">
                <Button
                  onClick={async () => {
                    if (meetingPlatform === 'meet-now') {
                      // Create real Whereby meeting for Meet Now
                      if (!wherebyMeeting && !meetingUrl) {
                        const meeting = await createWherebyMeeting();
                        if (!meeting) {
                          toast({
                            title: "Meeting Creation Failed",
                            description: "Could not create meeting. Please try again.",
                            variant: "destructive"
                          });
                          return;
                        }
                      }
                      
                      // Set current date and time for immediate meeting
                      const now = new Date();
                      setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
                      setSelectedTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                      
                      // Create the appointment immediately and then go to AOI Meet step
                      await handleScheduleAppointment();
                      // handleScheduleAppointment will set step to 'aoi-meet' automatically
                    } else {
                      setStep('time');
                    }
                  }}
                  disabled={isScheduling}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {meetingPlatform === 'meet-now' 
                    ? (isScheduling ? 'Creating Meeting...' : 'Start Meeting Now') 
                    : 'Continue to Date & Time'
                  }
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Date & Time Selection with Calendar Layout */}
          {step === 'time' && (
            <div>
              {/* Veteran's time zone - PROMINENT at top of scheduling step */}
              <div className="px-8 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10">
                <Label htmlFor="appointment-timezone" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Veteran&apos;s time zone
                </Label>
                <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                  <SelectTrigger id="appointment-timezone" className="w-full max-w-sm mt-2">
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
                  All times below are in the veteran&apos;s time zone
                </p>
              </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px]">
              {/* Calendar Section (Left Side) */}
              <div className="bg-gradient-to-br from-slate-700 to-slate-800 p-8 text-white">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Meet with {firstName}</h3>
                      <p className="text-slate-300">{lead.market || 'Insurance'} consultation</p>
                    </div>
                  </div>
                  
                  {/* Complete Lead info display */}
                  <div className="bg-white/10 rounded-lg p-4 mb-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span className="font-medium">{lead.phone}</span>
                    </div>
                    {lead.city && lead.state && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm text-slate-200">{lead.city}, {lead.state}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 text-slate-300">📧</span>
                        <span className="text-sm text-slate-200">{lead.email}</span>
                      </div>
                    )}
                    {(lead as any).groupName && (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 text-slate-300">🏢</span>
                        <span className="text-sm text-slate-200">{(lead as any).groupName}</span>
                      </div>
                    )}
                    {(lead as any).beneficiary && (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 text-slate-300">👤</span>
                        <span className="text-sm text-slate-200">Beneficiary: {(lead as any).beneficiary}</span>
                      </div>
                    )}
                    {(lead as any).relationship && (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 text-slate-300">❤️</span>
                        <span className="text-sm text-slate-200 capitalize">{(lead as any).relationship}</span>
                      </div>
                    )}
                    {(lead as any).leadId && (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 text-slate-300">🆔</span>
                        <span className="text-xs text-slate-300 font-mono">ID: {(lead as any).leadId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Calendar Display */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-lg">Select Date</h4>
                    <div className="text-sm text-slate-300">
                      {new Date(selectedDate).toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </div>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="bg-white/5 rounded-lg p-4">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-3">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center text-xs font-semibold text-slate-400 uppercase">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-2">
                      {(() => {
                        const today = new Date();
                        const currentMonth = new Date(selectedDate);
                        const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                        const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                        const startingDayOfWeek = firstDay.getDay();
                        const totalDays = lastDay.getDate();
                        
                        const days = [];
                        
                        // Empty cells before month starts
                        for (let i = 0; i < startingDayOfWeek; i++) {
                          days.push(
                            <div key={`empty-${i}`} className="aspect-square" />
                          );
                        }
                        
                        // Actual days of the month
                        for (let day = 1; day <= totalDays; day++) {
                          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                          const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const isToday = date.toDateString() === today.toDateString();
                          const isSelected = dateString === selectedDate;
                          const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                          
                          days.push(
                            <button
                              key={day}
                              onClick={() => !isPast && setSelectedDate(dateString)}
                              disabled={isPast}
                              className={`aspect-square rounded-lg text-sm font-medium transition-all duration-200 ${
                                isSelected
                                  ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                                  : isToday
                                  ? 'bg-white/20 text-white border-2 border-blue-400'
                                  : isPast
                                  ? 'text-slate-600 cursor-not-allowed'
                                  : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        }
                        
                        return days;
                      })()}
                    </div>
                    
                    {/* Month Navigation */}
                    <div className="flex justify-between mt-4 pt-4 border-t border-white/10">
                      <button
                        onClick={() => {
                          const date = new Date(selectedDate);
                          date.setMonth(date.getMonth() - 1);
                          const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
                          setSelectedDate(newDate);
                        }}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm transition-colors"
                      >
                        ← Previous
                      </button>
                      <button
                        onClick={() => {
                          const date = new Date(selectedDate);
                          date.setMonth(date.getMonth() + 1);
                          const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
                          setSelectedDate(newDate);
                        }}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Selection Section (Right Side) */}
              <div className="p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2">Available Times</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Select your preferred appointment time
                  </p>
                  {isLoadingSchedule && (
                    <div className="text-sm text-blue-600 mt-2">Loading available times...</div>
                  )}
                </div>

                {/* Time Slots Grid */}
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {(isLoadingSchedule ? TIME_SLOTS : availableSlots).map((time) => {
                    const isBooked = !availableSlots.includes(time) && !isLoadingSchedule;
                    return (
                      <button
                        key={time}
                        onClick={() => !isBooked && setSelectedTime(time)}
                        disabled={isBooked || isLoadingSchedule}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
                          selectedTime === time && !isBooked
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : isBooked 
                            ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {formatTimeDisplay(time)}
                        {isBooked && <span className="block text-xs text-gray-400">Unavailable</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={() => setStep('type')}>
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep('confirm')}
                    disabled={!selectedTime || isLoadingSchedule}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Continue to Confirm
                  </Button>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 'confirm' && (
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Confirm Appointment</h3>
                <p className="text-gray-600 dark:text-gray-400">Review your appointment details</p>
              </div>

              {/* Appointment Summary */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Meeting Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span>{firstName} {lastName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>{new Date(selectedDate).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>
                            {formatTimeDisplay(selectedTime)}
                            <span className="text-gray-500 text-xs ml-1">
                              ({US_TIMEZONES.find((z) => z.value === selectedTimezone)?.label})
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">Platform & Access</h4>
                      <div className="text-sm space-y-2">
                        <Badge className="bg-blue-100 text-blue-800 mb-2">
                          {MEETING_PLATFORMS.find(p => p.value === meetingPlatform)?.label}
                        </Badge>
                        {meetingPlatform === 'meet-now' && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                            <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">Meet Now - Immediate Meeting</p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              Appointment scheduled for current time. After confirmation, you'll be connected to the AOI Meet interface to start the meeting.
                            </p>
                          </div>
                        )}
                        {meetingPlatform === 'whereby' && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">AOI Meet</p>
                            {meetingUrl ? (
                              <>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-mono break-all">
                                  Meeting Room: {meetingUrl}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                              Client will receive SMS invitation with direct meeting link
                            </p>
                              </>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                  Creating secure meeting room...
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {meetingPlatform === 'zoom' && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">Your Zoom Room:</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                              Room ID: {authState.profile?.zoomId || 'Not set up'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                              Password: {authState.profile?.zoomPassword || '1'}
                            </p>
                            {!authState.profile?.zoomId && (
                              <p className="text-xs text-red-600 mt-2">
                                ⚠️ Set up your Zoom credentials in Profile Settings first
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Optional Notes */}
              <div className="mb-6">
                <Label htmlFor="notes">Meeting Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any specific topics you'd like to discuss..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Disposition reminder - MUST record outcome when appointment time comes */}
              <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  You must record the outcome when the appointment time comes
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Go to AO Meet → Mark outcome. If you start a presentation (HP Pro), use Sale / No Sale / Think / No Show / Cancelled. If not, use Attended or No Show.
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('time')}>
                  Back
                </Button>
                <Button
                  onClick={handleScheduleAppointment}
                  disabled={isScheduling || (meetingPlatform === 'whereby' && !meetingUrl)}
                  size="lg"
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  {isScheduling ? 'Scheduling...' : 
                   (meetingPlatform === 'whereby' && !meetingUrl) ? 'Creating Meeting...' :
                   'Schedule Appointment'}
                </Button>
              </div>
            </div>
          )}

          {/* AOI Meet Step - Step 2 for Meet Now appointments */}
          {step === 'aoi-meet' && (
            <div className="bg-white p-8 min-h-[500px]">
              <div className="max-w-lg mx-auto space-y-6">
                {/* Success Header */}
                <div className="text-center mb-8">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center justify-center text-green-800 mb-2">
                      <CheckCircle className="h-8 w-8 mr-3" />
                      <h3 className="text-2xl font-bold">Meeting Ready!</h3>
                    </div>
                    <p className="text-green-700">Immediate appointment created for {firstName} {lastName}</p>
                    <div className="text-sm text-green-600 mt-2">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Meeting starts at {new Date().toLocaleTimeString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meeting Link Display */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-blue-900">Meeting Link</h4>
                    {userEmail ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">HOST ACCESS</span>
                    ) : (
                      <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">WAITING ROOM</span>
                    )}
                  </div>
                  <div className="bg-white rounded border p-3 text-sm font-mono text-gray-700 break-all">
                    {meetingUrl}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-300"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigator.clipboard.writeText(meetingUrl);
                        toast({
                          title: "Copied!",
                          description: "Meeting link copied to clipboard",
                        });
                      }}
                    >
                      Copy Link
                    </Button>
                    {userEmail ? (
                      <div className="text-xs text-green-700 pt-2">
                        You have host controls to admit participants
                      </div>
                    ) : (
                      <div className="text-xs text-orange-700 pt-2">
                        You'll wait for host approval to join
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                  <Button
                    className="w-full h-16 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold text-lg"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(meetingUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                    }}
                  >
                    🎥 START Meeting
                  </Button>

                  {/* SMS Section with Manual Phone Input */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">Send Meeting Invite</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="phoneNumber" className="text-sm text-gray-700">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="Enter phone number or use lead's number"
                          value={manualPhoneNumber || lead.phone}
                          onChange={(e) => setManualPhoneNumber(e.target.value)}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Default: {lead.phone} • Override with custom number if needed
                        </p>
                      </div>
                      
                      <Button
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const phoneToUse = manualPhoneNumber || lead.phone;
                          
                          if (!phoneToUse) {
                            toast({
                              title: "No Phone Number",
                              description: "Please enter a phone number",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          try {
                            const smsMessage = `Hi ${firstName}, please join our secure video meeting: ${meetingUrl}`;
                            const response = await fetch('/api/sms/send', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                to: phoneToUse,
                                message: smsMessage
                              })
                            });

                            if (response.ok) {
                              toast({
                                title: "Text Sent!",
                                description: `Meeting invite sent to ${firstName} at ${phoneToUse}`,
                              });
                            } else {
                              throw new Error('SMS failed');
                            }
                          } catch (error) {
                            toast({
                              title: "SMS Failed",
                              description: "Could not send text message. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        📱 Send Text Message
                      </Button>
                    </div>
                  </div>

                  {/* HP PRO Button - Redesigned */}
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-orange-900">Hour Power PRO</h4>
                        <p className="text-sm text-orange-700">Launch presentation system</p>
                      </div>
                      <Button
                        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium px-6"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🚀 HP Pro button clicked - opening popup!');
                          const popup = window.open(
                            'https://hppro.planetaltig.com/#/',
                            'HPProSalesPlatform',
                            'width=1600,height=1000,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no'
                          );

                          if (popup) {
                            try {
                              popup.focus();
                            } catch (err) {
                              console.error('Could not focus popup:', err);
                              popup.focus();
                            }

                            toast({
                              title: "HP Pro Opened",
                              description: "Sales presentation platform opened",
                              duration: 2000,
                            });
                          } else {
                            toast({
                              title: "Popup Blocked",
                              description: "Please allow popups for this site",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <ExternalLink className="w-5 h-5 mr-2" />
                        Launch HP PRO
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lead Info Summary */}
                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                  <h4 className="font-semibold text-gray-900 mb-2">Contact Details</h4>
                  <div className="text-gray-600">
                    <div>{firstName} {lastName}</div>
                    <div>{lead.phone}</div>
                    {lead.email && <div>{lead.email}</div>}
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-6 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // Reset to appointment scheduling flow
                      setStep('type');
                      setMeetingPlatform('whereby');
                      setWherebyMeeting(null);
                      setMeetingUrl('');
                      setManualPhoneNumber('');
                      setNotes('');
                    }}
                    className="flex-1"
                  >
                    📅 Schedule Another Appointment
                  </Button>
                  <Button variant="outline" onClick={onClose} className="flex-1">
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Resolution detail modal (ALP, notes) - required before closing */}
    {resolutionTarget && (
      <AppointmentResolutionModal
        isOpen={!!resolutionTarget}
        onClose={() => setResolutionTarget(null)}
        meetId={resolutionTarget.meet.id}
        clientName={`${resolutionTarget.meet.client_first_name || ''} ${resolutionTarget.meet.client_last_name || ''}`.trim() || 'Client'}
        disposition={resolutionTarget.disposition as any}
        meetingLink={resolutionTarget.meet.meeting_link}
        onComplete={handleDispositionComplete}
      />
    )}
    </>
  );
}
