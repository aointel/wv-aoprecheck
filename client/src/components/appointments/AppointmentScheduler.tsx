import React, { useState } from 'react';
import { Calendar, Clock, User, Video, Plus, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { InsertAppointment } from '@shared/schema';

interface AppointmentSchedulerProps {
  preSelectedDate?: string;
  onClose?: () => void;
}

const APPOINTMENT_TYPES = [
  { value: 'consultation', label: 'Initial Consultation', duration: 60, color: 'bg-blue-500' },
  { value: 'follow-up', label: 'Follow-up Call', duration: 30, color: 'bg-green-500' },
  { value: 'presentation', label: 'Product Presentation', duration: 90, color: 'bg-purple-500' },
  { value: 'closing', label: 'Closing Meeting', duration: 120, color: 'bg-orange-500' },
];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

// Helper function to format time slots with AM/PM and timezone
const formatTimeSlot = (time: string, timezone: string = 'America/New_York') => {
  const [hour, minute] = time.split(':');
  const tempDate = new Date();
  tempDate.setHours(parseInt(hour), parseInt(minute));
  
  return tempDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export function AppointmentScheduler({ preSelectedDate, onClose }: AppointmentSchedulerProps) {
  const { authState } = useAuth();
  const { toast } = useToast();
  
  const [appointmentData, setAppointmentData] = useState<Partial<InsertAppointment>>({
    appointmentType: 'consultation',
    duration: 60,
    meetingPlatform: 'whereby',
    timezone: 'America/New_York',
    agentEmail: authState.user?.email || 'cnsysop@aoglobelife.com',
    agentName: authState.profile ? `${authState.profile.firstName} ${authState.profile.lastName}` : 'producer',
  });

  const [selectedDate, setSelectedDate] = useState(preSelectedDate || new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('10:00');

  // Calendar sync state
  const [calendarSync, setCalendarSync] = useState({
    outlook: false,
    gmail: false,
    ics: false
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointment: InsertAppointment) => {
      return apiRequest('POST', '/api/appointments', appointment);
    },
    onSuccess: async (createdAppointment) => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      

      
      toast({
        title: "Appointment Scheduled Successfully!",
        description: `Private meeting room created for ${appointmentData.leadName} on ${selectedDate} at ${selectedTime}`,
      });
      onClose?.();
    },
    onError: (error: any) => {
      toast({
        title: "Scheduling Failed",
        description: error.message || "Could not schedule appointment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    const startDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const duration = appointmentData.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    
    // Use existing lead ID or generate consistent identifier based on appointment data
    const leadId = appointmentData.leadId || `apt-${appointmentData.leadName?.replace(/\s/g, '')}-${selectedDate?.replace(/-/g, '')}-${selectedTime?.replace(/:/, '')}`;
    const twilioRoomName = `lead-${leadId}`;
    
    let meetingData = {};
    let meetingLink = '';
    
    // Create Whereby meeting if selected
    if ((appointmentData.meetingPlatform || 'whereby') === 'whereby') {
      try {
        const wherebyResponse = await apiRequest('POST', '/api/whereby/create-meeting', {
          agentEmail: authState.user?.email,
          leadName: appointmentData.leadName || 'Client',
          leadId: leadId,
          scheduledTime: startDateTime.toISOString()
        });

        if (wherebyResponse.success) {
          meetingLink = wherebyResponse.roomUrl;
          meetingData = {
            platform: 'whereby',
            roomUrl: wherebyResponse.roomUrl,
            hostRoomUrl: wherebyResponse.hostRoomUrl,
            meetingId: wherebyResponse.meetingId
          };
        } else {
          throw new Error('Failed to create Whereby meeting');
        }
      } catch (error) {
        console.error('❌ AOI Meet creation failed:', error);
        toast({
          title: "AOI Meet Failed",
          description: "Could not create video meeting. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    const appointmentToCreate: InsertAppointment = {
      ...appointmentData,
      startTime: startDateTime,
      endTime: endDateTime,
      leadId,
      twilioRoomName,
      meetingPlatform: appointmentData.meetingPlatform || 'whereby',
      meetingLink,
      meetingData,
      status: 'scheduled',
      title: `${appointmentData.appointmentType} appointment with ${appointmentData.leadName}`,
    } as InsertAppointment;
    
    createAppointmentMutation.mutate(appointmentToCreate);
  };

  // Calendar sync functions
  const handleOutlookSync = async (appointment: any) => {
    try {
      const startDate = new Date(appointment.startTime);
      const endDate = new Date(appointment.endTime);
      
      const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?` +
        `subject=${encodeURIComponent(appointment.title)}&` +
        `startdt=${startDate.toISOString()}&` +
        `enddt=${endDate.toISOString()}&` +
        `body=${encodeURIComponent(`Meeting with ${appointment.leadName}\n\nJoin Meeting: ${appointment.meetingLink || `https://aoirail-production.up.railway.app/video-meeting?room=${encodeURIComponent(`lead-${appointment.leadId}`)}&agentName=Client&leadName=${encodeURIComponent(appointment.leadName)}`}`)}`;
      
      window.open(outlookUrl, '_blank');
    } catch (error) {
      console.error('Outlook sync failed:', error);
    }
  };

  // Google Calendar OAuth authentication
  const handleGoogleCalendarAuth = async () => {
    try {
      console.log('🗓️ Starting Google Calendar authentication...');
      
      // Get auth URL from backend
      const response = await fetch('/api/google-calendar/auth-url');
      const data = await response.json();
      
      if (!data.authUrl) {
        throw new Error('Failed to get authentication URL');
      }
      
      console.log('🗓️ Opening OAuth window...');
      
      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        'googleAuth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        throw new Error('Popup blocked - please allow popups for this site');
      }
      
      // Listen for messages from the popup
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          console.log('✅ Google Calendar authentication successful');
          localStorage.setItem('googleCalendarTokens', JSON.stringify(event.data.tokens));
          popup.close();
          window.removeEventListener('message', messageListener);
          
          toast({
            title: "Google Calendar Connected",
            description: "Your appointments will now sync with Google Calendar",
          });
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          console.error('❌ Google Calendar authentication failed:', event.data.error);
          popup.close();
          window.removeEventListener('message', messageListener);
          
          toast({
            title: "Authentication Failed",
            description: event.data.error || "Could not connect to Google Calendar",
            variant: "destructive"
          });
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          console.log('🗓️ Google Calendar auth popup closed');
        }
      }, 1000);
      
    } catch (error) {
      console.error('Google Calendar auth failed:', error);
      toast({
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : "Could not start Google Calendar authentication",
        variant: "destructive"
      });
    }
  };



  const handleGmailSync = async (appointment: any) => {
    try {
      // First check if user is authenticated with Google Calendar
      const statusResponse = await fetch('/api/google-calendar/status');
      const statusData = await statusResponse.json();
      
      if (!statusData.authenticated) {
        // Show authentication prompt
        toast({
          title: "Authentication Required",
          description: "Connect to Google Calendar to sync appointments",
        });
        
        // Start Google Calendar authentication
        handleGoogleCalendarAuth();
        return;
      }
      
      // Sync directly to Google Calendar
      const response = await fetch('/api/google-calendar/events/appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: appointment.title || 'AO Intelligence Appointment',
          description: `Meeting with ${appointment.leadName}\n\nJoin Meeting: https://aoirail-production.up.railway.app/video-meeting?room=${encodeURIComponent(`lead-${appointment.leadId || appointment.id}`)}`,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          location: 'ConnectNow Virtual Meeting Room',
          attendeeEmail: appointment.leadEmail,
          appointmentId: appointment.id
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast({
          title: "Synced to Google Calendar",
          description: `Appointment "${data.summary}" added to your calendar`,
        });
      } else {
        throw new Error(data.error || 'Failed to sync to Google Calendar');
      }
      
    } catch (error) {
      console.error('Google Calendar sync failed:', error);
      
      // Fallback to ICS download
      toast({
        title: "Sync Failed - Creating Backup",
        description: "Downloading calendar file as backup",
        variant: "destructive"
      });
      
      try {
        const response = await fetch('/api/simple-calendar/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: appointment.title || 'AO Intelligence Appointment',
            description: `Meeting with ${appointment.leadName}\n\nJoin Meeting: https://aoirail-production.up.railway.app/video-meeting?room=${encodeURIComponent(`lead-${appointment.leadId || appointment.id}`)}`,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            appointmentId: appointment.id,
            leadName: appointment.leadName,
            leadPhone: appointment.leadPhone
          })
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `appointment-${appointment.id || Date.now()}.ics`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } catch (fallbackError) {
        console.error('Fallback ICS creation failed:', fallbackError);
      }
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

  const [step, setStep] = useState<'type' | 'time' | 'details'>('type');
  const [selectedType, setSelectedType] = useState<string>('');

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Schedule Appointment</h2>
              <p className="text-blue-100">Choose your preferred meeting type and time</p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mt-6">
          <div className={`flex items-center gap-2 ${step === 'type' ? 'text-white' : 'text-blue-200'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'type' ? 'bg-white text-blue-600' : 'bg-blue-500'}`}>
              1
            </div>
            <span className="text-sm font-medium">Choose Type</span>
          </div>
          <div className={`h-0.5 flex-1 ${step !== 'type' ? 'bg-white' : 'bg-blue-400'}`} />
          <div className={`flex items-center gap-2 ${step === 'time' ? 'text-white' : 'text-blue-200'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'time' ? 'bg-white text-blue-600' : 'bg-blue-500'}`}>
              2
            </div>
            <span className="text-sm font-medium">Select Time</span>
          </div>
          <div className={`h-0.5 flex-1 ${step === 'details' ? 'bg-white' : 'bg-blue-400'}`} />
          <div className={`flex items-center gap-2 ${step === 'details' ? 'text-white' : 'text-blue-200'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'details' ? 'bg-white text-blue-600' : 'bg-blue-500'}`}>
              3
            </div>
            <span className="text-sm font-medium">Your Info</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-0">
        {/* Step 1: Appointment Type Selection */}
        {step === 'type' && (
          <div className="p-8">
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">How long do you need?</h3>
              <p className="text-gray-600 dark:text-gray-400">Select the type of appointment that best fits your needs</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {APPOINTMENT_TYPES.map((type) => (
                <div
                  key={type.value}
                  onClick={() => {
                    setSelectedType(type.value);
                    setAppointmentData(prev => ({
                      ...prev,
                      appointmentType: type.value as any,
                      duration: type.duration
                    }));
                  }}
                  className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedType === type.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-4 h-4 rounded-full mt-1 ${type.color}`} />
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-1">{type.label}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {type.duration} minutes • Professional video meeting
                      </p>
                      <div className="text-xs text-gray-500">
                        {type.value === 'consultation' && 'Perfect for initial discussions and discovery'}
                        {type.value === 'follow-up' && 'Quick check-in and progress updates'}
                        {type.value === 'presentation' && 'Detailed product walkthrough and demo'}
                        {type.value === 'closing' && 'Final decision meeting and contract review'}
                      </div>
                    </div>
                    {selectedType === type.value && (
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
                onClick={() => setStep('time')}
                disabled={!selectedType}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Continue to Time Selection
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Time Selection with Calendar */}
        {step === 'time' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px]">
            {/* Calendar Section */}
            <div className="bg-gradient-to-br from-orange-500 to-red-500 p-8 text-white">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Meet with Your producer</h3>
                    <p className="text-orange-100">Professional consultation</p>
                  </div>
                </div>
                
                {/* Selected appointment type display */}
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${APPOINTMENT_TYPES.find(t => t.value === selectedType)?.color || 'bg-white'}`} />
                    <span className="font-medium">{APPOINTMENT_TYPES.find(t => t.value === selectedType)?.label}</span>
                  </div>
                  <p className="text-sm text-orange-100">
                    {APPOINTMENT_TYPES.find(t => t.value === selectedType)?.duration} minutes
                  </p>
                </div>
              </div>

              {/* Simple Calendar Display */}
              <div className="space-y-4">
                <h4 className="font-semibold">Select Date</h4>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="bg-white/10 border-white/20 text-white placeholder-white/60"
                />
              </div>
            </div>

            {/* Time Selection Section */}
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">What time works best?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  All times shown in {appointmentData.timezone || 'America/New_York'}
                </p>
              </div>

              {/* Time Slots Grid */}
              <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {TIME_SLOTS.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
                      selectedTime === time
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {formatTimeSlot(time, appointmentData.timezone)}
                  </button>
                ))}
              </div>

              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={() => setStep('type')}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep('details')}
                  disabled={!selectedTime}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Continue to Details
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Lead Details */}
        {step === 'details' && (
          <div className="p-8">
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">Your Information</h3>
              <p className="text-gray-600 dark:text-gray-400">We'll use this to send you the meeting details</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="leadName">Full Name *</Label>
                <Input
                  id="leadName"
                  value={appointmentData.leadName || ''}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, leadName: e.target.value }))}
                  placeholder="Your full name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="leadPhone">Phone Number *</Label>
                <Input
                  id="leadPhone"
                  value={appointmentData.leadPhone || ''}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, leadPhone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="leadEmail">Email Address</Label>
                <Input
                  id="leadEmail"
                  type="email"
                  value={appointmentData.leadEmail || ''}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, leadEmail: e.target.value }))}
                  placeholder="your@email.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="leadCity">City</Label>
                <Input
                  id="leadCity"
                  value={appointmentData.leadCity || ''}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, leadCity: e.target.value }))}
                  placeholder="Your city"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="mt-6">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={appointmentData.notes || ''}
                onChange={(e) => setAppointmentData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Anything specific you'd like to discuss?"
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep('time')}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!appointmentData.leadName || !appointmentData.leadPhone || createAppointmentMutation.isPending}
                size="lg"
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              >
                {createAppointmentMutation.isPending ? 'Scheduling...' : 'Schedule Appointment'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
