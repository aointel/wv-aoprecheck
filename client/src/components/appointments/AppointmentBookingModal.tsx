import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, User, Phone, MapPin, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { InsertAppointment } from '@shared/schema';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  state?: string;
  city?: string;
  market?: string;
}

interface AppointmentBookingModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onBookingComplete?: (appointment: any) => void;
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

export function AppointmentBookingModal({ lead, isOpen, onClose, onBookingComplete }: AppointmentBookingModalProps) {
  console.log('🔵 AppointmentBookingModal render - isOpen:', isOpen, 'lead:', lead?.firstName, lead?.lastName);
  const { authState } = useAuth();
  const { toast } = useToast();
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Form state
  const [appointmentData, setAppointmentData] = useState<Partial<InsertAppointment>>({
    appointmentType: 'consultation',
    duration: 60,
    meetingPlatform: 'whereby',
    timezone: 'America/New_York',
    agentId: authState.user?.email || '',
    agentEmail: authState.user?.email || '',
    agentName: authState.profile ? `${authState.profile.firstName} ${authState.profile.lastName}` : '',
    leadName: `${lead.firstName} ${lead.lastName}`,
    leadPhone: lead.phone,
    leadEmail: lead.email || '',
  });

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('10:00');

  // Check producer's zoom connection status
  const { data: calendarConnections = {} } = useQuery({
    queryKey: ['/api/calendar/connections', authState.user?.email],
    enabled: !!authState.user?.email,
  });

  // Fetch existing appointments for conflict checking
  const { data: existingAppointments = [] } = useQuery({
    queryKey: ['/api/appointments', authState.user?.email, selectedDate],
    enabled: !!authState.user?.email,
  });

  // Lookup lead data from master leads table
  const { data: masterLeadData = {} } = useQuery({
    queryKey: ['/api/master-leads/lookup', lead.phone, authState.user?.email],
    enabled: !!authState.user?.email && !!lead.phone,
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointment: InsertAppointment) => {
      return apiRequest('POST', '/api/appointments', appointment);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({
        title: "Appointment Scheduled",
        description: `Appointment scheduled with ${lead.firstName} ${lead.lastName}`,
      });
      
      // Call the callback with appointment data
      if (onBookingComplete) {
        onBookingComplete({
          date: selectedDate,
          time: selectedTime,
          lead: lead,
          appointment: data
        });
      }
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Scheduling Failed",
        description: error.message || "Could not schedule appointment",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsScheduling(false);
    },
  });

  // Update form when master lead data is loaded
  useEffect(() => {
    if (masterLeadData) {
      setAppointmentData(prev => ({
        ...prev,
        leadEmail: (masterLeadData as any)?.email || prev.leadEmail,
        description: prev.description || `Meeting with ${lead.firstName} ${lead.lastName} from ${(masterLeadData as any)?.city || lead.city}, ${(masterLeadData as any)?.state || lead.state}`,
      }));
    }
  }, [masterLeadData, lead]);

  // Check if selected time slot has conflicts
  const hasTimeConflict = (time: string) => {
    if (!existingAppointments) return false;
    
    const selectedDateTime = new Date(`${selectedDate}T${time}:00`);
    const duration = appointmentData.duration || 60;
    const endTime = new Date(selectedDateTime.getTime() + duration * 60000);
    
    return Array.isArray(existingAppointments) && existingAppointments.some((apt: any) => {
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      return (selectedDateTime < aptEnd && endTime > aptStart);
    });
  };

  // Handle form submission
  const handleSubmit = async () => {
    setIsScheduling(true);
    
    const startDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const duration = appointmentData.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    
    // Generate room name for AOI Meet
    let twilioRoomName = '';
    let zoomJoinUrl = '';
    
    let meetingData = {};
    let meetingLink = '';
    
    if (appointmentData.meetingPlatform === 'whereby') {
      // Create Whereby meeting via API
      try {
        const wherebyResponse = await apiRequest('POST', '/api/whereby/create-meeting', {
          agentEmail: authState.user?.email,
          leadName: appointmentData.leadName,
          leadId: lead.id || `apt-${Date.now()}`,
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
        console.error('❌ Whereby meeting creation failed:', error);
        toast({
          title: "Whereby Meeting Failed",
          description: "Could not create video meeting. Please try again.",
          variant: "destructive",
        });
        setIsScheduling(false);
        return;
      }
    }
    
    // Create Zoom meeting if selected and connected
    if (appointmentData.meetingPlatform === 'zoom') {
      const zoomTokens = localStorage.getItem('zoomTokens');
      if (!zoomTokens) {
        toast({
          title: "Zoom Not Connected",
          description: "Please connect your Zoom account first",
          variant: "destructive",
        });
        setIsScheduling(false);
        return;
      }

      try {
        const tokens = JSON.parse(zoomTokens);
        const zoomResponse = await apiRequest('POST', '/api/zoom/create-meeting', {
          appointmentData: {
            title: `${appointmentData.appointmentType} with ${appointmentData.leadName}`,
            startTime: startDateTime,
            duration: duration,
            timezone: appointmentData.timezone,
            description: appointmentData.notes,
            leadName: appointmentData.leadName
          },
          tokens
        });

        if (zoomResponse.success) {
          zoomJoinUrl = zoomResponse.meeting.join_url;
          meetingLink = zoomJoinUrl;
          meetingData = {
            platform: 'zoom',
            joinUrl: zoomJoinUrl,
            meetingId: zoomResponse.meeting.id,
            hostUrl: zoomResponse.meeting.start_url
          };
          console.log('✅ Zoom meeting created:', zoomResponse.meeting);
        } else {
          throw new Error('Failed to create Zoom meeting');
        }
      } catch (error) {
        console.error('❌ Zoom meeting creation failed:', error);
        toast({
          title: "Zoom Meeting Failed",
          description: "Could not create Zoom meeting. Please try again.",
          variant: "destructive",
        });
        setIsScheduling(false);
        return;
      }
    }
    
    const appointmentToCreate: InsertAppointment = {
      ...appointmentData,
      startTime: startDateTime,
      endTime: endDateTime,
      meetingLink,
      meetingData,
      twilioRoomName,
      zoomJoinUrl,
      status: 'scheduled',
      title: `${appointmentData.appointmentType} with ${appointmentData.leadName}`,
      agentId: appointmentData.agentId || authState.user?.email || '',
      agentName: appointmentData.agentName || (authState.profile ? `${authState.profile.firstName} ${authState.profile.lastName}` : ''),
      leadPhone: appointmentData.leadPhone || lead.phone,
      leadId: `apt-${Date.now()}`,
      meetingPlatform: appointmentData.meetingPlatform || 'whereby'
    } as InsertAppointment;
    
    createAppointmentMutation.mutate(appointmentToCreate);
  };

  const hasZoomConnection = localStorage.getItem('zoomTokens') !== null;

  // Function to connect to Zoom
  const connectToZoom = () => {
    const authWindow = window.open('/api/zoom/auth-url', 'zoom-auth', 'width=500,height=600');
    
    // Listen for auth completion
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ZOOM_AUTH_SUCCESS') {
        localStorage.setItem('zoomTokens', JSON.stringify(event.data.tokens));
        setAppointmentData(prev => ({ ...prev, meetingPlatform: 'zoom' })); // Auto-select Zoom
        toast({
          title: "Zoom Connected",
          description: "Your Zoom account has been connected successfully",
        });
        window.removeEventListener('message', handleMessage);
        if (authWindow) authWindow.close();
      } else if (event.data.type === 'ZOOM_AUTH_ERROR') {
        toast({
          title: "Zoom Connection Failed",
          description: event.data.error || "Failed to connect to Zoom",
          variant: "destructive",
        });
        window.removeEventListener('message', handleMessage);
        if (authWindow) authWindow.close();
      }
    };
    
    window.addEventListener('message', handleMessage);
  };

  if (!isOpen) {
    console.log('🔵 Modal not rendering - isOpen is false');
    return null;
  }
  
  console.log('🔵 Modal rendering - isOpen is true, lead:', lead);
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[9999] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Schedule Appointment with {lead.firstName} {lead.lastName}
          </DialogTitle>
          <DialogDescription>
            Select a date, time, and meeting type for your appointment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lead Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{lead.firstName} {lead.lastName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="font-mono">{lead.phone}</span>
                </div>
                {lead?.email && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
                    <span>{lead.email}</span>
                  </div>
                )}
                {(lead?.city || lead?.state) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span>{lead.city}, {lead.state}</span>
                  </div>
                )}
              </div>
              {lead.market && (
                <Badge variant="outline">{lead.market}</Badge>
              )}
            </CardContent>
          </Card>

          {/* Appointment Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="appointmentType">Appointment Type</Label>
              <Select
                value={appointmentData.appointmentType}
                onValueChange={(value) => {
                  const type = APPOINTMENT_TYPES.find(t => t.value === value);
                  setAppointmentData(prev => ({
                    ...prev,
                    appointmentType: value as any,
                    duration: type?.duration || 60
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${type.color}`}></div>
                        <span>{type.label} ({type.duration} min)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(time => (
                      <SelectItem 
                        key={time} 
                        value={time}
                        disabled={hasTimeConflict(time)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{formatTimeSlot(time, appointmentData.timezone)}</span>
                          {hasTimeConflict(time) && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Conflict
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="platform">Meeting Platform</Label>
              <Select
                value={appointmentData.meetingPlatform}
                onValueChange={(value) => setAppointmentData(prev => ({ ...prev, meetingPlatform: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whereby">
                    <div className="flex items-center gap-2">
                      <Video className="h-3 w-3" />
                      <span>Whereby Video Meetings (Recommended)</span>
                      <Badge variant="default" className="text-xs">Default</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="zoom">
                    <div className="flex items-center gap-2">
                      <Video className="h-3 w-3" />
                      <span>Zoom</span>
                      {hasZoomConnection ? (
                        <Badge variant="default" className="text-xs">Connected</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Connect Required</Badge>
                      )}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {!hasZoomConnection && appointmentData.meetingPlatform === 'zoom' && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                    Connect your Zoom account to schedule Zoom meetings
                  </p>
                  <Button 
                    onClick={connectToZoom}
                    size="sm" 
                    variant="outline"
                    className="text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Connect Zoom Account
                  </Button>
                </div>
              )}
              
              {hasZoomConnection && appointmentData.meetingPlatform === 'zoom' && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✅ Zoom connected - meetings will be created automatically
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any specific notes or agenda items for this appointment"
                value={appointmentData.notes || ''}
                onChange={(e) => setAppointmentData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          {/* Schedule Button */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isScheduling || hasTimeConflict(selectedTime)}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isScheduling ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}