import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Video, User, Plus, Settings, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { AppointmentScheduler } from './AppointmentScheduler';
import type { Appointment } from '@shared/schema';

interface FullCalendarViewProps {
  className?: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const APPOINTMENT_TYPE_COLORS = {
  'consultation': 'bg-blue-500',
  'follow-up': 'bg-green-500',
  'presentation': 'bg-purple-500',
  'closing': 'bg-orange-500',
};

export function FullCalendarView({ className = '' }: FullCalendarViewProps) {
  const { authState } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  // Fetch appointments for the current month
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments', authState.user?.email, currentDate.getFullYear(), currentDate.getMonth()],
    enabled: !!authState.user?.email,
  });

  // Fetch external calendar events (Outlook/Gmail)
  const { data: externalEvents } = useQuery({
    queryKey: ['/api/calendar/external-events', authState.user?.email, currentDate.getFullYear(), currentDate.getMonth()],
    enabled: !!authState.user?.email,
  });

  // Get calendar data for the month
  const getCalendarData = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= lastDay || current.getDay() !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return { days, firstDay, lastDay };
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = (date: Date) => {
    if (!appointments) return [];
    return appointments.filter(apt => {
      const aptDate = new Date(apt.startTime);
      // Compare by date components (year, month, day) to avoid timezone issues
      const aptYear = aptDate.getFullYear();
      const aptMonth = aptDate.getMonth();
      const aptDay = aptDate.getDate();
      
      const dateYear = date.getFullYear();
      const dateMonth = date.getMonth();
      const dateDay = date.getDate();
      
      return aptYear === dateYear && aptMonth === dateMonth && aptDay === dateDay;
    });
  };

  // Get external events for a specific date
  const getExternalEventsForDate = (date: Date) => {
    if (!externalEvents) return [];
    return externalEvents.filter((event: any) => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Navigate calendar
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Format time
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Join meeting - producer interface like AOI Meet in Call Connector Pro
  const joinMeeting = async (appointment: Appointment) => {
    if (appointment.meetingPlatform === 'zoom' && appointment.zoomJoinUrl) {
      window.open(appointment.zoomJoinUrl, '_blank');
      toast({
        title: "Zoom Meeting Opened",
        description: "Joining Zoom meeting",
      });
    } else {
      try {
        // Create new Whereby meeting for this appointment
        const response = await fetch('/api/whereby/create-meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: `full-cal-${appointment.id}` })
        });
        
        if (!response.ok) throw new Error('Failed to create Whereby meeting');
        
        const meeting = await response.json();
        console.log('📅 FullCalendarView: Created Whereby meeting for appointment:', appointment.id, meeting);
        
        // Open host room URL for producer (full control)
        window.open(meeting.hostRoomUrl, 'producer-video', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
        toast({
          title: "Whereby Meeting Started",
          description: "Opening professional video meeting room",
        });
      } catch (error) {
        console.error('❌ Failed to create Whereby meeting for appointment:', error);
        toast({
          title: "Meeting Failed",
          description: "Could not create video meeting",
          variant: "destructive"
        });
      }
    }
  };

  const { days } = getCalendarData();
  const isCurrentMonth = (date: Date) => date.getMonth() === currentDate.getMonth();
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Schedule Appointment */}
          <Dialog open={isSchedulerOpen} onOpenChange={setIsSchedulerOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <AppointmentScheduler 
                preSelectedDate={selectedDate?.toISOString().split('T')[0]}
                onClose={() => setIsSchedulerOpen(false)} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="p-4 text-center font-semibold text-gray-600 dark:text-gray-400 border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {days.map((date, index) => {
              const dayAppointments = getAppointmentsForDate(date);
              const externalEvents = getExternalEventsForDate(date);
              const hasEvents = dayAppointments.length > 0 || externalEvents.length > 0;

              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border-r border-b last:border-r-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    !isCurrentMonth(date) ? 'bg-gray-50 dark:bg-gray-900 text-gray-400' : ''
                  } ${isToday(date) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200' : ''}`}
                  onClick={() => {
                    setSelectedDate(date);
                    setIsSchedulerOpen(true);
                  }}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday(date) ? 'text-blue-600 font-bold' : ''}`}>
                    {date.getDate()}
                  </div>

                  {/* Appointments */}
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map(appointment => (
                      <div
                        key={appointment.id}
                        className={`text-xs p-1 rounded text-white cursor-pointer hover:opacity-80 ${
                          APPOINTMENT_TYPE_COLORS[appointment.appointmentType as keyof typeof APPOINTMENT_TYPE_COLORS] || 'bg-gray-400'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          joinMeeting(appointment);
                        }}
                      >
                        <div className="flex items-center gap-1 truncate">
                          <Clock className="h-2 w-2 flex-shrink-0" />
                          <span>{formatTime(appointment.startTime)}</span>
                        </div>
                        <div className="truncate font-medium">{appointment.leadName}</div>
                      </div>
                    ))}

                    {/* External calendar events */}
                    {externalEvents.slice(0, 2).map((event: any, idx: number) => (
                      <div
                        key={`external-${idx}`}
                        className="text-xs p-1 rounded bg-gray-400 text-white cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (event.webLink) {
                            window.open(event.webLink, '_blank');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1 truncate">
                          <ExternalLink className="h-2 w-2 flex-shrink-0" />
                          <span>{event.start && formatTime(event.start)}</span>
                        </div>
                        <div className="truncate font-medium">{event.subject || event.summary}</div>
                      </div>
                    ))}

                    {/* Show more indicator */}
                    {(dayAppointments.length + externalEvents.length) > 3 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{(dayAppointments.length + externalEvents.length) - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span>Consultation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span>Follow-up</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500"></div>
          <span>Presentation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500"></div>
          <span>Closing</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-400"></div>
          <span>External Events</span>
        </div>
      </div>
    </div>
  );
}