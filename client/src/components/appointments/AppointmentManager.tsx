import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  Calendar, 
  Clock, 
  Phone, 
  User, 
  MapPin, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  CalendarDays,
  ExternalLink,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isWithinInterval, addDays } from 'date-fns';

interface Appointment {
  id: string;
  leadName: string;
  leadPhone: string;
  leadEmail?: string;
  leadState?: string;
  leadCity?: string;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  agentEmail: string;
  createdAt: string;
  market?: string;
  // Google Calendar sync fields
  googleCalendarEventId?: string;
  googleCalendarSyncStatus?: 'pending' | 'synced' | 'failed';
  googleCalendarSyncedAt?: string;
  googleCalendarHtmlLink?: string;
  googleCalendarSyncError?: string;
}

interface Callback {
  id: string;
  leadName: string;
  leadPhone: string;
  leadState?: string;
  notes?: string;
  scheduledFor: string;
  status: 'pending' | 'completed' | 'cancelled';
  agentEmail: string;
  createdAt: string;
  market?: string;
  priority: 'low' | 'medium' | 'high';
}

export function AppointmentManager() {
  const { toast } = useToast();
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('appointments');

  // Use consistent user email (same as dashboard)
  const userEmail = authState?.user?.email || 'cnsysop@aoglobelife.com';

  // Fetch appointments with Google Calendar sync status
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['/api/appointments', userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/appointments?agentEmail=${encodeURIComponent(userEmail)}`);
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 30000, // Match dashboard refresh rate
    retry: 1,
    retryDelay: 1000
  });

  // Fetch Google Calendar events for display
  const { data: googleEventsData, isLoading: googleEventsLoading, refetch: refetchGoogleEvents } = useQuery({
    queryKey: ['/api/google-calendar/events', userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/google-calendar/events?agentEmail=${encodeURIComponent(userEmail)}`);
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 60000, // Refresh every minute
    retry: 1,
    retryDelay: 1000
  });

  // Fetch callbacks (sync with masterlead callback data)
  const { data: callbacksData, isLoading: callbacksLoading } = useQuery({
    queryKey: ['/api/callbacks', userEmail],
    queryFn: async () => {
      const response = await fetch('/api/callbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail })
      });
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 30000, // Match dashboard refresh rate
    retry: 1,
    retryDelay: 1000
  });



  // Update appointment status
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string; status: string }) => {
      const response = await fetch('/api/appointments/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, status })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({
        title: 'Appointment Updated',
        description: 'Appointment status updated successfully'
      });
    }
  });

  // Update callback status
  const updateCallbackMutation = useMutation({
    mutationFn: async ({ callbackId, status }: { callbackId: string; status: string }) => {
      const response = await fetch('/api/callbacks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackId, status })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/appointments'] });
      toast({
        title: 'Callback Updated',
        description: 'Callback status updated successfully'
      });
    }
  });

  const appointments: Appointment[] = appointmentsData?.appointments || [];
  const callbacks: Callback[] = callbacksData?.callbacks || [];
  
  console.log('📅 AppointmentManager Data:', {
    appointmentsCount: appointments.length,
    callbacksCount: callbacks.length,
    userEmail,
    appointmentsLoading,
    callbacksLoading
  });

  // Filter appointments by time periods (fix date parsing)
  const todayAppointments = appointments.filter(apt => {
    try {
      const aptDate = apt.appointmentDate ? parseISO(apt.appointmentDate) : (apt.startTime ? parseISO(apt.startTime) : new Date());
      return isToday(aptDate);
    } catch {
      return false;
    }
  });
  
  const tomorrowAppointments = appointments.filter(apt => {
    try {
      const aptDate = apt.appointmentDate ? parseISO(apt.appointmentDate) : (apt.startTime ? parseISO(apt.startTime) : new Date());
      return isTomorrow(aptDate);
    } catch {
      return false;
    }
  });
  
  const upcomingAppointments = appointments.filter(apt => {
    try {
      const aptDate = apt.appointmentDate ? parseISO(apt.appointmentDate) : (apt.startTime ? parseISO(apt.startTime) : new Date());
      return isWithinInterval(aptDate, { start: addDays(new Date(), 2), end: addDays(new Date(), 7) });
    } catch {
      return false;
    }
  });

  // Filter callbacks by priority and due date (fix date parsing)
  const overdueCallbacks = callbacks.filter(cb => {
    try {
      const dueDate = parseISO(cb.scheduledFor);
      return dueDate < new Date() && cb.status === 'pending';
    } catch {
      return false;
    }
  });
  
  const todayCallbacks = callbacks.filter(cb => {
    try {
      return isToday(parseISO(cb.scheduledFor)) && cb.status === 'pending';
    } catch {
      return false;
    }
  });
  
  const upcomingCallbacks = callbacks.filter(cb => {
    try {
      const dueDate = parseISO(cb.scheduledFor);
      return dueDate > new Date() && cb.status === 'pending';
    } catch {
      return false;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'confirmed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'no_show': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };



  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow duration-200 border-l-4 border-l-blue-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                {appointment.leadName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(appointment.status)}>
                  {appointment.status}
                </Badge>

              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {appointment.appointmentDate 
                ? `${format(parseISO(appointment.appointmentDate), 'MMM d')} at ${appointment.appointmentTime || ''}` 
                : appointment.startTime 
                  ? format(parseISO(appointment.startTime), 'MMM d, h:mm a')
                  : 'Date TBD'
              }
            </div>

          </div>
        </div>
        
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span className="font-medium">{appointment.leadPhone}</span>
          </div>
          {appointment.leadCity && appointment.leadState && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{appointment.leadCity}, {appointment.leadState}</span>
            </div>
          )}
          {appointment.notes && (
            <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
              <span className="font-medium">Notes:</span> {appointment.notes}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {appointment.status === 'scheduled' && (
            <Button 
              size="sm" 
              variant="outline"
              className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20"
              onClick={() => updateAppointmentMutation.mutate({ 
                appointmentId: appointment.id, 
                status: 'confirmed' 
              })}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm
            </Button>
          )}
          {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
            <Button 
              size="sm" 
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/20"
              onClick={() => updateAppointmentMutation.mutate({ 
                appointmentId: appointment.id, 
                status: 'completed' 
              })}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete
            </Button>
          )}

          {appointment.googleCalendarHtmlLink && (
            <Button 
              size="sm" 
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => window.open(appointment.googleCalendarHtmlLink, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View in Google
            </Button>
          )}
          <Button 
            size="sm" 
            variant="destructive"
            onClick={() => updateAppointmentMutation.mutate({ 
              appointmentId: appointment.id, 
              status: 'cancelled' 
            })}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const CallbackCard = ({ callback }: { callback: Callback }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow duration-200 border-l-4 border-l-orange-500">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-full">
              <Phone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                {callback.leadName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(callback.priority)}>
                  {callback.priority} priority
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {callback.scheduledFor 
                ? (() => {
                    try {
                      return format(parseISO(callback.scheduledFor), 'MMM d, h:mm a');
                    } catch {
                      return 'ASAP';
                    }
                  })()
                : 'ASAP'
              }
            </div>
          </div>
        </div>
        
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span className="font-medium">{callback.leadPhone}</span>
          </div>
          {callback.leadState && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>{callback.leadState}</span>
            </div>
          )}
          {callback.notes && (
            <div className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
              <span className="font-medium">Notes:</span> {callback.notes}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button 
            size="sm" 
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => {
              // Initiate call - you can integrate with your calling system
              window.open(`tel:${callback.leadPhone}`, '_self');
            }}
          >
            <Phone className="w-4 h-4 mr-2" />
            Call Now
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20"
            onClick={() => updateCallbackMutation.mutate({ 
              callbackId: callback.id, 
              status: 'completed' 
            })}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Complete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (appointmentsLoading || callbacksLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">


      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="appointments" className="flex items-center gap-2 text-base font-medium">
            <CalendarDays className="w-5 h-5" />
            Appointments ({appointments.length})
          </TabsTrigger>
          <TabsTrigger value="google-calendar" className="flex items-center gap-2 text-base font-medium">
            <Calendar className="w-5 h-5" />
            Google Calendar ({googleEventsData?.events?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="callbacks" className="flex items-center gap-2 text-base font-medium">
            <Phone className="w-5 h-5" />
            Callbacks ({callbacks.filter(cb => cb.status === 'pending').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-6 mt-6">
          {/* Today's Appointments */}
          {todayAppointments.length > 0 && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-green-700 dark:text-green-400">
                  <Calendar className="w-6 h-6" />
                  Today's Appointments ({todayAppointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayAppointments.map(appointment => (
                  <AppointmentCard key={appointment.id} appointment={appointment} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tomorrow's Appointments */}
          {tomorrowAppointments.length > 0 && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-blue-700 dark:text-blue-400">
                  <Calendar className="w-6 h-6" />
                  Tomorrow's Appointments ({tomorrowAppointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tomorrowAppointments.map(appointment => (
                  <AppointmentCard key={appointment.id} appointment={appointment} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Appointments */}
          {upcomingAppointments.length > 0 && (
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-purple-700 dark:text-purple-400">
                  <Calendar className="w-6 h-6" />
                  This Week ({upcomingAppointments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.map(appointment => (
                  <AppointmentCard key={appointment.id} appointment={appointment} />
                ))}
              </CardContent>
            </Card>
          )}

          {appointments.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No appointments scheduled</h3>
                <p className="text-gray-500 dark:text-gray-400">Your upcoming appointments will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="google-calendar" className="space-y-6 mt-6">
          {/* Google Calendar Events Section */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Google Calendar Events</h3>
            <Button 
              onClick={() => refetchGoogleEvents()}
              disabled={googleEventsLoading}
              variant="outline"
              size="sm"
            >
              {googleEventsLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Events
            </Button>
          </div>

          {googleEventsLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400">Loading Google Calendar events...</p>
            </div>
          ) : googleEventsData?.events?.length > 0 ? (
            <div className="space-y-4">
              {googleEventsData.events.map(event => (
                <Card key={event.id} className="border-l-4 border-l-purple-500">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full">
                          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                            {event.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                              Google Calendar
                            </Badge>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {event.attendees?.length > 0 ? `${event.attendees.length} attendees` : 'No attendees'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {format(parseISO(event.startTime), 'MMM d, h:mm a')}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Duration: {event.duration} min
                        </div>
                      </div>
                    </div>
                    
                    {event.description && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {event.description}
                      </div>
                    )}

                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {event.googleEventLink && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900/20"
                          onClick={() => window.open(event.googleEventLink, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View in Google
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Google Calendar Events</h3>
              <p className="text-gray-500 dark:text-gray-400">
                No events found in your Google Calendar for the next 30 days.
              </p>
              <Button 
                onClick={() => refetchGoogleEvents()}
                className="mt-4"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Events
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="callbacks" className="space-y-6 mt-6">
          {/* Overdue Callbacks */}
          {overdueCallbacks.length > 0 && (
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-6 h-6" />
                  Overdue Callbacks ({overdueCallbacks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overdueCallbacks.map(callback => (
                  <CallbackCard key={callback.id} callback={callback} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Today's Callbacks */}
          {todayCallbacks.length > 0 && (
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-orange-700 dark:text-orange-400">
                  <Clock className="w-6 h-6" />
                  Due Today ({todayCallbacks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayCallbacks.map(callback => (
                  <CallbackCard key={callback.id} callback={callback} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Callbacks */}
          {upcomingCallbacks.length > 0 && (
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-yellow-700 dark:text-yellow-400">
                  <Phone className="w-6 h-6" />
                  Upcoming ({upcomingCallbacks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingCallbacks.map(callback => (
                  <CallbackCard key={callback.id} callback={callback} />
                ))}
              </CardContent>
            </Card>
          )}

          {callbacks.filter(cb => cb.status === 'pending').length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No pending callbacks</h3>
                <p className="text-gray-500 dark:text-gray-400">Your callback reminders will appear here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}