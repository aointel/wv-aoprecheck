import React, { useState } from 'react';
import { Calendar, Clock, Plus, ChevronLeft, ChevronRight, MapPin, ExternalLink, Video, Mail, Phone, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppointmentScheduler } from './AppointmentScheduler';
import { AppointmentDetails } from './AppointmentDetails';
import type { Appointment } from '@shared/schema';

export function AppointmentCalendar() {
  const { authState } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Union type for both CRM appointments and Google Calendar events
  type CalendarEvent = Appointment | {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    isGoogleEvent: true;
    googleCalendarHtmlLink?: string;
    location?: string;
    leadName?: string;
    leadPhone?: string;
    leadEmail?: string;
    meetingLink?: string;
    description?: string;
    status?: string;
  };

  // Type guard to check if an event is a Google Calendar event
  const isGoogleEvent = (event: CalendarEvent): event is Extract<CalendarEvent, { isGoogleEvent: true }> => {
    return 'isGoogleEvent' in event && event.isGoogleEvent === true;
  };

  // Type guard to check if an event is a CRM appointment
  const isCRMAppointment = (event: CalendarEvent): event is Appointment => {
    return !isGoogleEvent(event);
  };

  const [selectedAppointment, setSelectedAppointment] = useState<CalendarEvent | null>(null);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('week');
  
  // Get current week start (Sunday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  };
  
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));

  // Fetch appointments
  const userEmail = authState.user?.email || 'cnsysop@aoglobelife.com';
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['/api/appointments', userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/appointments?agentEmail=${userEmail}`);
      if (!response.ok) throw new Error('Failed to fetch appointments');
      return response.json();
    },
    enabled: true,
  });

  // Fetch Google Calendar events
  const { data: googleEventsData } = useQuery({
    queryKey: ['/api/google-calendar/events', userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/google-calendar/events?agentEmail=${encodeURIComponent(userEmail)}`);
      if (!response.ok) throw new Error('Failed to fetch Google Calendar events');
      return response.json();
    },
    enabled: !!userEmail,
  });

  // Combine all events
  const allEvents = React.useMemo(() => {
    const crmEvents = appointments || [];
    const googleEvents = googleEventsData?.events || [];
    
    const formattedGoogleEvents = googleEvents.map((event: any) => ({
      ...event,
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      isGoogleEvent: true,
    }));
    
    return [...crmEvents, ...formattedGoogleEvents];
  }, [appointments, googleEventsData]);

  // Update appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Appointment> }) => {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update appointment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({ title: 'Appointment Updated', description: 'Status updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    }
  });

  // Generate week data
  const generateWeekData = () => {
    const weekData = [];
    const startDate = new Date(currentWeekStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayEvents = allEvents.filter((event: CalendarEvent) => {
        // Handle both CRM appointments and Google Calendar events
        let eventDate;
        if (event.startTime) {
          eventDate = new Date(event.startTime);
        } else if (isCRMAppointment(event) && 'appointmentDate' in event && event.appointmentDate) {
          eventDate = new Date(event.appointmentDate);
        } else {
          return false; // Skip events without a date
        }
        
        // Compare dates by DATE only (year, month, day) to avoid timezone issues
        // Convert the UTC event date to LOCAL timezone for display
        // This ensures events appear on the day they occur in the agent's timezone
        const eventLocalYear = eventDate.getFullYear();
        const eventLocalMonth = eventDate.getMonth();
        const eventLocalDay = eventDate.getDate();
        
        const dayYear = date.getFullYear();
        const dayMonth = date.getMonth();
        const dayDay = date.getDate();
        
        // Compare date components in local timezone
        return eventLocalYear === dayYear && eventLocalMonth === dayMonth && eventLocalDay === dayDay;
      }).sort((a: CalendarEvent, b: CalendarEvent) => {
        // Sort by start time, handling both date field types
        const aTime = a.startTime ? new Date(a.startTime).getTime() : (isCRMAppointment(a) && 'appointmentDate' in a && a.appointmentDate ? new Date(a.appointmentDate).getTime() : 0);
        const bTime = b.startTime ? new Date(b.startTime).getTime() : (isCRMAppointment(b) && 'appointmentDate' in b && b.appointmentDate ? new Date(b.appointmentDate).getTime() : 0);
        return aTime - bTime;
      });
      
      weekData.push({
        date: new Date(date),
        events: dayEvents,
        isToday: date.toDateString() === new Date().toDateString(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      });
    }
    
    return weekData;
  };

  // Generate month data
  const generateMonthData = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    const weeks = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentDate);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayEvents = allEvents.filter(event => {
          // Handle both CRM appointments and Google Calendar events
          let eventDate;
          if (event.startTime) {
            eventDate = new Date(event.startTime);
          } else if (event.appointmentDate) {
            eventDate = new Date(event.appointmentDate);
          } else {
            return false; // Skip events without a date
          }
          
          return eventDate >= dayStart && eventDate <= dayEnd;
        });
        
        week.push({
          date: new Date(date),
          events: dayEvents,
          isToday: date.toDateString() === new Date().toDateString(),
          isCurrentMonth: date.getMonth() === month,
          isWeekend: date.getDay() === 0 || date.getDay() === 6
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }
    
    return weeks;
  };

  // Generate day data
  const generateDayData = () => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dayEvents = allEvents.filter(event => {
      // Handle both CRM appointments and Google Calendar events
      let eventDate;
      if (event.startTime) {
        eventDate = new Date(event.startTime);
      } else if (event.appointmentDate) {
        eventDate = new Date(event.appointmentDate);
      } else {
        return false; // Skip events without a date
      }
      
      return eventDate >= dayStart && eventDate <= dayEnd;
    }).sort((a, b) => {
      // Sort by start time, handling both date field types
      const aTime = a.startTime ? new Date(a.startTime).getTime() : new Date(a.appointmentDate || 0).getTime();
      const bTime = b.startTime ? new Date(b.startTime).getTime() : new Date(b.appointmentDate || 0).getTime();
      return aTime - bTime;
    });
    
    return {
      date: new Date(selectedDate),
      events: dayEvents,
      isToday: selectedDate.toDateString() === new Date().toDateString()
    };
  };

  // Navigation functions
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(currentWeekStart);
    if (direction === 'prev') {
      newWeekStart.setDate(newWeekStart.getDate() - 7);
    } else {
      newWeekStart.setDate(newWeekStart.getDate() + 7);
    }
    setCurrentWeekStart(newWeekStart);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    if (currentView === 'week') {
      setCurrentWeekStart(getWeekStart(new Date()));
    } else {
      setSelectedDate(new Date());
    }
  };

  // Get view title
  const getViewTitle = () => {
    if (currentView === 'week') {
      const startOfWeek = new Date(currentWeekStart);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'long' })} ${startOfWeek.getDate()}-${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      } else {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${startOfWeek.getFullYear()}`;
      }
    } else if (currentView === 'month') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  // Get current data
  const weekData = currentView === 'week' ? generateWeekData() : [];
  const monthData = currentView === 'month' ? generateMonthData() : [];
  const dayData = currentView === 'day' ? generateDayData() : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📅 Appointment Calendar
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your schedule with CRM appointments and Google Calendar events
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              {/* View Selector */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {(['day', 'week', 'month'] as const).map((view) => (
                  <Button
                    key={view}
                    variant={currentView === view ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentView(view)}
                    className="px-3 py-1"
                  >
                    {view === 'day' && '📅'}
                    {view === 'week' && '📊'}
                    {view === 'month' && '📋'}
                    <span className="ml-1 capitalize">{view}</span>
                  </Button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentView === 'week') navigateWeek('prev');
                    else if (currentView === 'month') navigateMonth('prev');
                    else navigateDay('prev');
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Today
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentView === 'week') navigateWeek('next');
                    else if (currentView === 'month') navigateMonth('next');
                    else navigateDay('next');
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Title */}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {getViewTitle()}
              </h2>
            </div>
            
            <Dialog open={isSchedulerOpen} onOpenChange={setIsSchedulerOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <AppointmentScheduler onClose={() => setIsSchedulerOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span>CRM Appointments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-500"></div>
              <span>Google Calendar Events</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3 h-3" />
              <span>Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
          </div>
        </div>

        {/* Calendar Views */}
        {currentView === 'week' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Week Header */}
            <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-700"></div>
              
              {weekData.map((day, index) => (
                <div
                  key={index}
                  className={`p-4 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                    day.isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-bold mt-1 ${
                    day.isToday 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {day.date.getDate()}
                  </div>
                </div>
              ))}
            </div>

            {/* Week Grid */}
            <div className="grid grid-cols-8">
              {/* Time Column */}
              <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                {Array.from({ length: 18 }, (_, index) => {
                  const hour = index + 4; // Start at 4 AM, end at 9 PM (hour 21)
                  return (
                    <div
                      key={hour}
                      className="h-16 p-2 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center"
                    >
                      {hour === 4 ? '4 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                  );
                })}
              </div>

              {/* Day Columns */}
              {weekData.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                    day.isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                  }`}
                >
                  {Array.from({ length: 18 }, (_, hourIndex) => {
                    const hour = hourIndex + 4; // Start at 4 AM, end at 9 PM
                    return (
                      <div
                        key={hour}
                        className="h-16 border-b border-gray-200 dark:border-gray-700 relative"
                      >
                        {/* Events for this hour */}
                        {day.events
                          .filter(event => {
                            // Handle both CRM appointments and Google Calendar events
                            let eventHour;
                            if (event.startTime) {
                              eventHour = new Date(event.startTime).getHours();
                            } else if (event.appointmentDate) {
                              eventHour = new Date(event.appointmentDate).getHours();
                            } else {
                              return false;
                            }
                            return eventHour === hour;
                          })
                          .map((event, eventIndex) => (
                            <div
                              key={event.id}
                              className={`absolute left-1 right-1 top-1 bottom-1 rounded p-2 text-xs cursor-pointer ${
                                event.isGoogleEvent
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                              }`}
                              onClick={() => setSelectedAppointment(event)}
                            >
                              <div className="font-medium truncate">
                                {event.isGoogleEvent ? '📅 ' : ''}
                                {event.title || event.leadName}
                              </div>
                              <div className="text-xs opacity-75">
                                {new Date(event.startTime).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })}
                              </div>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'month' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Month Header */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="p-4 text-center text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Month Grid */}
            <div className="grid grid-rows-6">
              {monthData.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  {week.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={`min-h-[120px] p-2 border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                        !day.isCurrentMonth 
                          ? 'bg-gray-50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      } ${day.isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => setSelectedDate(day.date)}
                    >
                      {/* Date Number */}
                      <div className={`text-sm mb-2 ${
                        day.isToday
                          ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold'
                          : day.isCurrentMonth
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}>
                        {day.date.getDate()}
                      </div>

                      {/* Events */}
                      <div className="space-y-1">
                        {day.events.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs p-1 rounded truncate cursor-pointer ${
                              event.isGoogleEvent
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(event);
                            }}
                          >
                            {event.isGoogleEvent ? '📅 ' : ''}
                            {event.title || event.leadName}
                          </div>
                        ))}
                        {day.events.length > 3 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                            +{day.events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'day' && dayData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Day Header */}
            <div className="p-6 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {dayData.date.toLocaleDateString('en-US', { weekday: 'long' })}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {dayData.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  dayData.isToday
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {dayData.isToday ? 'Today' : 'Selected Date'}
                </div>
              </div>
            </div>

            {/* Day Schedule */}
            <div className="p-6">
              {dayData.events.length > 0 ? (
                <div className="space-y-4">
                  {dayData.events.map((event) => (
                    <Card key={event.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-3 h-3 rounded-full ${
                                event.isGoogleEvent ? 'bg-purple-500' : 'bg-blue-500'
                              }`}></div>
                              <h4 className="font-semibold text-lg text-gray-900 dark:text-white">
                                {event.isGoogleEvent ? (
                                  <span className="flex items-center gap-2">
                                    <span>📅</span>
                                    {event.title}
                                  </span>
                                ) : (
                                  event.leadName || event.title
                                )}
                              </h4>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>
                                  {new Date(event.startTime).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })} - {new Date(event.endTime).toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  })}
                                </span>
                              </div>
                              
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                            </div>

                            {event.description && (
                              <p className="text-gray-600 dark:text-gray-400 text-sm">
                                {event.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {!event.isGoogleEvent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentMutation.mutate({ 
                                  id: event.id, 
                                  updates: { status: 'completed' }
                                })}
                                disabled={updateAppointmentMutation.isPending}
                              >
                                Complete
                              </Button>
                            )}
                            
                            {event.googleCalendarHtmlLink && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => window.open(event.googleCalendarHtmlLink, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">📅</div>
                  <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Events</h3>
                  <p className="text-gray-500 dark:text-gray-500">You have no events scheduled for this day.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Event Details Modal */}
        {selectedAppointment && (
          <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
            <DialogContent className="max-w-2xl">
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Event Details
                  </h3>
                </div>

                {/* Event Info */}
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Title</label>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                          {isGoogleEvent(selectedAppointment) ? (
                            <span className="flex items-center gap-2">
                              <span>📅</span>
                              {selectedAppointment.title}
                            </span>
                          ) : (
                            selectedAppointment.leadName || selectedAppointment.title
                          )}
                        </p>
                  </div>

                  {/* Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Start Time</label>
                      <p className="text-gray-900 dark:text-white mt-1">
                        {(() => {
                          const startTime = selectedAppointment.startTime || selectedAppointment.appointmentDate;
                          if (startTime) {
                            return new Date(startTime).toLocaleString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            });
                          }
                          return 'Not specified';
                        })()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">End Time</label>
                      <p className="text-gray-900 dark:text-white mt-1">
                        {(() => {
                          const endTime = selectedAppointment.endTime;
                          if (endTime) {
                            return new Date(endTime).toLocaleString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            });
                          }
                          return 'Not specified';
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Lead Info (CRM only) */}
                  {!selectedAppointment.isGoogleEvent && (
                    <>
                      {selectedAppointment.leadPhone && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</label>
                          <p className="text-gray-900 dark:text-white mt-1">{selectedAppointment.leadPhone}</p>
                        </div>
                      )}
                      {selectedAppointment.leadEmail && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</label>
                          <p className="text-gray-900 dark:text-white mt-1">{selectedAppointment.leadEmail}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Location */}
                  {selectedAppointment.location && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Location</label>
                      <p className="text-gray-900 dark:text-white mt-1">{selectedAppointment.location}</p>
                    </div>
                  )}

                  {/* Description */}
                  {selectedAppointment.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</label>
                      <p className="text-gray-900 dark:text-white mt-1">{selectedAppointment.description}</p>
                    </div>
                  )}

                  {/* Status (CRM only) */}
                  {!selectedAppointment.isGoogleEvent && selectedAppointment.status && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedAppointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          selectedAppointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          selectedAppointment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          selectedAppointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedAppointment.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {/* Join Meeting - Only for CRM appointments with meeting links */}
                      {isCRMAppointment(selectedAppointment) && selectedAppointment.meetingLink && (
                        <Button
                          variant="default"
                          onClick={() => window.open(selectedAppointment.meetingLink, '_blank')}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Join Meeting
                        </Button>
                      )}

                      {/* Send Invite - Only for CRM appointments */}
                      {isCRMAppointment(selectedAppointment) && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Implement send invite functionality
                            console.log('Send invite for appointment:', selectedAppointment.id);
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Send Invite
                        </Button>
                      )}

                      {/* Contact - Only for CRM appointments */}
                      {isCRMAppointment(selectedAppointment) && selectedAppointment.leadPhone && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Implement contact functionality
                            console.log('Contact for appointment:', selectedAppointment.id);
                          }}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Contact
                        </Button>
                      )}

                      {/* Call - Only for CRM appointments */}
                      {isCRMAppointment(selectedAppointment) && selectedAppointment.leadPhone && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Implement call functionality
                            console.log('Call for appointment:', selectedAppointment.id);
                          }}
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call
                        </Button>
                      )}

                      {/* Reschedule - Only for CRM appointments */}
                      {isCRMAppointment(selectedAppointment) && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Implement reschedule functionality
                            console.log('Reschedule appointment:', selectedAppointment.id);
                          }}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          Reschedule
                        </Button>
                      )}

                      {/* Cancel - Only for CRM appointments */}
                      {isCRMAppointment(selectedAppointment) && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Implement cancel functionality
                            console.log('Cancel appointment:', selectedAppointment.id);
                          }}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      )}

                      {/* Mark Complete - Only for CRM appointments */}
                      {isCRMAppointment(selectedAppointment) && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            updateAppointmentMutation.mutate({
                              id: selectedAppointment.id,
                              updates: { status: 'completed' }
                            });
                            setSelectedAppointment(null);
                          }}
                          disabled={updateAppointmentMutation.isPending}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Mark Complete
                        </Button>
                      )}

                      {/* View in Google Calendar - Only for Google events */}
                      {isGoogleEvent(selectedAppointment) && selectedAppointment.googleCalendarHtmlLink && (
                        <Button
                          variant="outline"
                          onClick={() => window.open(selectedAppointment.googleCalendarHtmlLink, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View in Google Calendar
                        </Button>
                      )}

                      {/* Close button */}
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedAppointment(null)}
                      >
                        Close
                      </Button>
                    </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}