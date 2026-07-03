import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Phone, 
  Video, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  User,
  FileText,
  Loader,
  PhoneCall,
  AlertCircle,
  Send
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Appointment {
  id: string;
  title: string;
  leadName: string;
  leadPhone: string;
  leadEmail?: string;
  startTime: string;
  endTime: string;
  duration: number;
  appointmentType: string;
  status: string;
  meetingPlatform: string;
  twilioRoomName?: string;
  notes?: string;
  leadCity?: string;
  leadState?: string;
  leadId?: string;
  agentEmail?: string;
  wherebyRoomUrl?: string;
  wherebyHostRoomUrl?: string;
  wherebyMeetingId?: string;
}

interface Callback {
  id: string;
  leadName: string;
  leadPhone: string;
  leadState: string;
  notes: string;
  scheduledFor: string;
  status: string;
  priority: string;
  agentEmail: string;
  createdAt: string;
}

interface ScheduleItem {
  id: string;
  type: 'callback' | 'appointment';
  leadId?: string;
  agentEmail?: string;
  zoomJoinUrl?: string;
  title: string;
  leadName: string;
  leadPhone: string;
  startTime: string;
  status: string;
  priority?: string;
  notes?: string;
  leadState?: string;
  meetingPlatform?: string;
  twilioRoomName?: string;
  appointmentType?: string;
  wherebyRoomUrl?: string;
  wherebyHostRoomUrl?: string;
  wherebyMeetingId?: string;
}

interface TodaysScheduleProps {
  className?: string;
}

export function TodaysSchedule({ className = "" }: TodaysScheduleProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();
  const { authState } = useAuth();

  // Use authenticated user's email, fallback to system default
  const userEmail = authState.user?.email || 'cnsysop@aoglobelife.com';

  // Fetch callbacks (priority items)
  const { data: callbacksData, isLoading: callbacksLoading } = useQuery({
    queryKey: ['/api/callbacks', userEmail],
    queryFn: async (): Promise<{ success: boolean; callbacks: Callback[] }> => {
      const response = await apiRequest('POST', '/api/callbacks', { userEmail });
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch appointments
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['/api/appointments', userEmail],
    queryFn: async () => {
      console.log('🗓️ TodaysSchedule: Fetching appointments for user:', userEmail);
      const response = await fetch(`/api/appointments?agentEmail=${encodeURIComponent(userEmail)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }
      const data = await response.json();
      console.log('🗓️ TodaysSchedule: Received appointments:', data.length, 'items for', userEmail);
      return data;
    },
    refetchInterval: 30000,
    retry: 1,
    retryDelay: 1000,
  });

  const isLoading = callbacksLoading || appointmentsLoading;
  const callbacks: Callback[] = callbacksData?.callbacks || [];
  const appointments: Appointment[] = appointmentsData || [];

  // Combine and prioritize callbacks over appointments
  const todaysSchedule: ScheduleItem[] = [
    // Callbacks first (high priority)
    ...callbacks.map(callback => ({
      id: callback.id,
      type: 'callback' as const,
      title: `Callback - ${callback.notes || 'Follow up'}`,
      leadName: callback.leadName,
      leadPhone: callback.leadPhone,
      startTime: callback.scheduledFor ? new Date(callback.scheduledFor).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      }) : 'ASAP',
      status: callback.status,
      priority: callback.priority,
      notes: callback.notes,
      leadState: callback.leadState
    })),
    // Then appointments
    ...appointments.map(appt => ({
      id: appt.id,
      type: 'appointment' as const,
      title: appt.title,
      leadName: appt.leadName,
      leadPhone: appt.leadPhone,
      startTime: appt.startTime,
      status: appt.status,
      notes: appt.notes,
      leadState: appt.leadState,
      meetingPlatform: appt.meetingPlatform,
      twilioRoomName: appt.twilioRoomName,
      appointmentType: appt.appointmentType,
      leadId: appt.leadId,
      agentEmail: appt.agentEmail,
      wherebyRoomUrl: appt.wherebyRoomUrl,
      wherebyHostRoomUrl: appt.wherebyHostRoomUrl,
      wherebyMeetingId: appt.wherebyMeetingId
    }))
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rescheduled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (item: ScheduleItem) => {
    if (item.type === 'callback') {
      switch (item.priority) {
        case 'high': return 'bg-red-50 text-red-700 border-red-200';
        case 'medium': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'low': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        default: return 'bg-red-50 text-red-700 border-red-200'; // Default callbacks to high priority
      }
    } else {
      switch (item.appointmentType) {
        case 'consultation': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'presentation': return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'follow-up': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'closing': return 'bg-green-50 text-green-700 border-green-200';
        default: return 'bg-blue-50 text-blue-700 border-blue-200';
      }
    }
  };

  const getItemIcon = (item: ScheduleItem) => {
    if (item.type === 'callback') {
      return item.priority === 'high' ? <AlertCircle className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />;
    } else {
      return <Video className="h-4 w-4" />;
    }
  };

  const startVideoMeeting = async (item: ScheduleItem) => {
    if (item.type === 'appointment') {
      try {
        console.log('📅 TodaysSchedule: Starting meeting for appointment:', item.id, {
          meetingPlatform: item.meetingPlatform,
          meetingLink: item.meetingLink,
          wherebyHostRoomUrl: item.wherebyHostRoomUrl
        });

        // If appointment has existing meeting URL, use it
        if (item.wherebyHostRoomUrl) {
          console.log('📅 Using existing Whereby host URL');
          // Open in external browser for Electron screen sharing support
          if ((window as any).require) {
            const { shell } = (window as any).require('electron');
            shell.openExternal(item.wherebyHostRoomUrl);
          } else {
            window.open(item.wherebyHostRoomUrl, '_blank');
          }
          
          toast({
            title: "AOI Meet Opened",
            description: `Opening meeting room for ${item.leadName}`,
          });
          return;
        }

        if (item.meetingLink) {
          console.log('📅 Using existing meeting link');
          // Open in external browser for Electron screen sharing support
          if ((window as any).require) {
            const { shell } = (window as any).require('electron');
            shell.openExternal(item.meetingLink);
          } else {
            window.open(item.meetingLink, '_blank');
          }
          
          toast({
            title: "Meeting Opened",
            description: `Opening meeting room for ${item.leadName}`,
          });
          return;
        }
        
        // No existing meeting URL - create new Whereby meeting
        console.log('📅 Creating new Whereby meeting for appointment');
        const response = await fetch('/api/whereby/create-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: `appointment-${item.id}-${Date.now()}` })
        });
        
        if (!response.ok) throw new Error('Failed to create Whereby meeting');
        
        const meeting = await response.json();
        console.log('📅 TodaysSchedule: Created new Whereby meeting:', meeting);
        
        // Open host room URL for producer (full control) - ALWAYS in external browser for Electron screen sharing
        if ((window as any).require) {
          const { shell } = (window as any).require('electron');
          shell.openExternal(meeting.hostRoomUrl);
        } else {
          window.open(meeting.hostRoomUrl, '_blank');
        }
        
        toast({
          title: "AOI Meet Started",
          description: `Created new meeting room for ${item.leadName}`,
        });
      } catch (error) {
        console.error('❌ Failed to open/create meeting for appointment:', error);
        toast({
          title: "Meeting Failed",
          description: "Could not open video meeting",
          variant: "destructive"
        });
      }
    }
  };

  const makeCallback = (item: ScheduleItem) => {
    // Initiate callback through dialer
    if (item.leadPhone) {
      window.open(`/connect?phone=${encodeURIComponent(item.leadPhone)}&lead=${encodeURIComponent(item.leadName)}`, '_blank');
    }
  };

  const sendMeetingInvite = async (item: ScheduleItem) => {
    if (item.type !== 'appointment' || !item.leadPhone) {
      toast({
        title: 'Error',
        description: 'Unable to send invite - missing phone number',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Use existing meeting link or create new one
      let meetingLink = '';
      
      // For existing AOI Meet appointments, use the meeting link directly
      if ((item.meetingPlatform === 'AOI Meet' || item.meetingPlatform === 'AOI Meet - Immediate') && item.meetingLink) {
        meetingLink = item.meetingLink;
      } else if (item.meetingPlatform === 'Zoom' && item.zoomJoinUrl) {
        meetingLink = item.zoomJoinUrl;
      } else if (item.meetingPlatform === 'whereby' && item.wherebyRoomUrl) {
        // Use client room URL for SMS invites
        meetingLink = item.wherebyRoomUrl;
      } else {
        // Create a new Whereby meeting for the invite
        const response = await fetch('/api/whereby/create-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: `invite-${item.id}` })
        });
        
        if (!response.ok) throw new Error('Failed to create Whereby meeting');
        
        const meeting = await response.json();
        meetingLink = meeting.roomUrl; // Use client URL for SMS
      }

      console.log(`📱 Sending meeting invite to ${item.leadName} at ${item.leadPhone}`);
      
      const response = await fetch('/api/sms/appointment-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: item.leadPhone,
          clientName: item.leadName,
          agentName: item.agentEmail?.split('@')[0] || 'Your producer',
          meetingLink: meetingLink,
          appointmentTime: item.startTime
        })
      });

      if (response.ok) {
        toast({
          title: 'Meeting Invite Sent',
          description: `SMS invite sent to ${item.leadName} at ${item.leadPhone}`,
        });
      } else {
        throw new Error('Failed to send SMS invite');
      }
    } catch (error) {
      console.error('Error sending meeting invite:', error);
      toast({
        title: 'Error Sending Invite',
        description: 'Failed to send meeting invite via SMS',
        variant: 'destructive'
      });
    }
  };

  const callClient = (item: ScheduleItem) => {
    if (item.leadPhone) {
      window.open(`/connect?phone=${encodeURIComponent(item.leadPhone)}&lead=${encodeURIComponent(item.leadName)}`, '_blank');
    }
  };

  const rescheduleAppointment = async (item: ScheduleItem) => {
    if (item.type !== 'appointment' || !item.id) {
      toast({
        title: 'Error',
        description: 'Cannot reschedule this item',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Open appointment scheduler in reschedule mode - correct path within dashboard
      window.open(`/dashboard/appointments/edit/${item.id}`, '_blank');
      
      toast({
        title: 'Opening Reschedule',
        description: `Opening reschedule page for ${item.leadName}`,
      });
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      toast({
        title: 'Error',
        description: 'Failed to open reschedule dialog',
        variant: 'destructive'
      });
    }
  };

  const cancelAppointment = async (item: ScheduleItem) => {
    if (item.type !== 'appointment' || !item.id) {
      toast({
        title: 'Error',
        description: 'Cannot cancel this item',
        variant: 'destructive'
      });
      return;
    }

    if (!confirm(`Are you sure you want to cancel the appointment with ${item.leadName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/appointments/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'cancelled',
          notes: `Cancelled by producer on ${new Date().toISOString()}`
        })
      });

      if (response.ok) {
        toast({
          title: 'Appointment Cancelled',
          description: `Appointment with ${item.leadName} has been cancelled`,
        });
        
        // Refresh the schedule
        window.location.reload();
      } else {
        throw new Error('Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel appointment',
        variant: 'destructive'
      });
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedId(expandedId === itemId ? null : itemId);
  };

  return (
    <Card className={`relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl h-full ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-600/20"></div>
      <CardHeader className="relative z-10">
        <CardTitle className="text-xl flex items-center gap-3 text-blue-700 dark:text-blue-300">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          Today's Schedule
          {callbacks.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {callbacks.length} Callback{callbacks.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Loader className="h-8 w-8 mx-auto mb-3 animate-spin opacity-50" />
            <p>Loading appointments...</p>
          </div>
        ) : todaysSchedule.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No callbacks or appointments scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaysSchedule.map((item, index) => {
              const colors = item.type === 'callback' ? ['red', 'orange', 'yellow'] : ['blue', 'purple', 'green'];
              const color = colors[index % colors.length];
              
              return (
                <div key={item.id}>
                  {/* Main schedule item display */}
                  <div 
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      item.type === 'callback' 
                        ? 'bg-red-50/70 dark:bg-red-900/20 border border-red-200/50 hover:bg-red-100/70 dark:hover:bg-red-900/30' 
                        : 'bg-white/50 dark:bg-slate-700/50 hover:bg-white/70 dark:hover:bg-slate-600/50'
                    }`}
                    onClick={() => toggleExpanded(item.id)}
                  >
                    <div className={`w-2 h-8 bg-${color}-500 rounded-full flex-shrink-0`}></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                            {getItemIcon(item)}
                            <span className={item.type === 'callback' ? 'text-red-700 dark:text-red-300' : ''}>
                              {item.startTime} - {item.leadName}
                            </span>
                            {item.type === 'callback' && (
                              <Badge variant="destructive" className="text-xs">
                                CALLBACK
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {item.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.type === 'callback' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                makeCallback(item);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white h-8 px-2"
                            >
                              <PhoneCall className="h-3 w-3 mr-1" />
                              Call Now
                            </Button>
                          )}
                          {item.type === 'appointment' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startVideoMeeting(item);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white h-8 px-2"
                            >
                              <Video className="h-3 w-3 mr-1" />
                              Join Meeting
                            </Button>
                          )}
                          <Badge className={getStatusColor(item.status)}>
                            {item.status || 'pending'}
                          </Badge>
                          {expandedId === item.id ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedId === item.id && (
                    <div className={`mt-2 p-3 rounded-lg border ${
                      item.type === 'callback' 
                        ? 'bg-red-50/60 dark:bg-red-900/20 border-red-200/30 dark:border-red-700/30' 
                        : 'bg-white/40 dark:bg-slate-700/40 border-white/30 dark:border-slate-600/30'
                    }`}>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                            <Phone className="h-4 w-4" />
                            Contact
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-700 dark:text-slate-300 font-mono">{item.leadPhone}</div>
                            {item.type === 'callback' && item.priority && (
                              <Badge className={getTypeColor(item)} variant="outline">
                                {item.priority.toUpperCase()} PRIORITY
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                            <MapPin className="h-4 w-4" />
                            {item.type === 'callback' ? 'State' : 'Location'}
                          </div>
                          <div className="text-slate-700 dark:text-slate-300">
                            {item.leadState || 'Not specified'}
                          </div>
                        </div>
                      </div>
                      
                      {item.notes && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-1">
                            <FileText className="h-4 w-4" />
                            {item.type === 'callback' ? 'Callback Reason' : 'Notes'}
                          </div>
                          <div className={`text-sm text-slate-700 dark:text-slate-300 p-2 rounded ${
                            item.type === 'callback' 
                              ? 'bg-red-100/60 dark:bg-red-800/30' 
                              : 'bg-white/60 dark:bg-slate-600/60'
                          }`}>
                            {item.notes}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        {item.type === 'callback' ? (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => makeCallback(item)}
                              className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs"
                            >
                              <PhoneCall className="h-3 w-3 mr-1" />
                              Call Now
                            </Button>
                            <Button size="sm" variant="outline" className="text-slate-600 h-7 text-xs">
                              Reschedule Callback
                            </Button>
                            <Button size="sm" variant="outline" className="text-slate-600 h-7 text-xs">
                              Mark Complete
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-slate-600 h-7 text-xs hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => callClient(item)}
                            >
                              <Phone className="h-3 w-3 mr-1" />
                              Call
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-slate-600 h-7 text-xs hover:bg-orange-50 hover:text-orange-700"
                              onClick={() => rescheduleAppointment(item)}
                            >
                              Reschedule
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-slate-600 h-7 text-xs hover:bg-red-50 hover:text-red-700"
                              onClick={() => cancelAppointment(item)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                              onClick={() => sendMeetingInvite(item)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Send Invite
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}