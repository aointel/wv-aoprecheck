import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MdCalendarToday, 
  MdSchedule, 
  MdPerson, 
  MdPhone, 
  MdEmail,
  MdVideoCall,
  MdLocationOn,
  MdAdd,
  MdSync,
  MdNotifications
} from 'react-icons/md';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';

interface SchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Appointment {
  id: string;
  title: string;
  client: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  type: 'connect' | 'recruit' | 'precheck';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

export default function SchedulingModal({ isOpen, onClose }: SchedulingModalProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'schedule' | 'sync'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [newAppointmentData, setNewAppointmentData] = useState({
    title: '',
    client: '',
    phone: '',
    email: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    type: 'connect' as const,
    notes: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch appointments from API
  const { data: appointmentsData, isLoading } = useQuery({
    queryKey: ['/api/appointments'],
    enabled: isOpen
  });

  const appointments: Appointment[] = appointmentsData?.appointments || [];

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      return await apiRequest('POST', '/api/appointments', appointmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      setShowNewAppointment(false);
      setNewAppointmentData({
        title: '',
        client: '',
        phone: '',
        email: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '',
        type: 'connect',
        notes: ''
      });
      toast({
        title: "Success",
        description: "Appointment created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create appointment",
        variant: "destructive",
      });
    }
  });

  const handleCreateAppointment = () => {
    if (!newAppointmentData.client || !newAppointmentData.time) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createAppointmentMutation.mutate(newAppointmentData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'connect': return 'bg-blue-600';
      case 'recruit': return 'bg-purple-600';
      case 'precheck': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  const getCurrentWeekDays = () => {
    const startDate = startOfWeek(selectedDate || new Date());
    return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 rounded-full">
              <MdCalendarToday className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                AO Intelligence Scheduling Suite
              </DialogTitle>
              <DialogDescription className="text-base">
                Enterprise-level appointment scheduling and calendar management
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar" className="flex items-center space-x-2">
              <MdCalendarToday className="w-4 h-4" />
              <span>Calendar View</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center space-x-2">
              <MdSchedule className="w-4 h-4" />
              <span>Schedule Appointment</span>
            </TabsTrigger>
            <TabsTrigger value="sync" className="flex items-center space-x-2">
              <MdSync className="w-4 h-4" />
              <span>Calendar Sync</span>
            </TabsTrigger>
          </TabsList>

          {/* Calendar View Tab */}
          <TabsContent value="calendar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Mini Calendar */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Calendar</CardTitle>
                  <CardDescription>Select a date to view appointments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="font-medium text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                    {getCurrentWeekDays().map((date) => (
                      <Button
                        key={date.toISOString()}
                        variant={format(date, 'yyyy-MM-dd') === format(selectedDate || new Date(), 'yyyy-MM-dd') ? 'default' : 'ghost'}
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => setSelectedDate(date)}
                      >
                        {format(date, 'd')}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    <Button
                      onClick={() => setSelectedDate(addWeeks(selectedDate || new Date(), -1))}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Previous Week
                    </Button>
                    <Button
                      onClick={() => setSelectedDate(addWeeks(selectedDate || new Date(), 1))}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Next Week
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Appointments List */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">
                        Appointments for {format(selectedDate || new Date(), 'EEEE, MMMM d, yyyy')}
                      </CardTitle>
                      <CardDescription>
                        {isLoading ? 'Loading...' : `${appointments.length} appointments scheduled`}
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowNewAppointment(true)} size="sm">
                      <MdAdd className="w-4 h-4 mr-2" />
                      New Appointment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading appointments...</p>
                    </div>
                  ) : appointments.length === 0 ? (
                    <div className="text-center py-8">
                      <MdCalendarToday className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No appointments scheduled for this date</p>
                      <Button onClick={() => setShowNewAppointment(true)} className="mt-4" size="sm">
                        <MdAdd className="w-4 h-4 mr-2" />
                        Schedule Appointment
                      </Button>
                    </div>
                  ) : (
                    appointments.map((appointment) => (
                    <Card key={appointment.id} className="border-l-4" style={{ borderLeftColor: getTypeColor(appointment.type).replace('bg-', '#') }}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <h4 className="font-semibold">{appointment.title}</h4>
                              <Badge variant="outline" className={getStatusColor(appointment.status)}>
                                {appointment.status}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {appointment.type.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <MdPerson className="w-4 h-4" />
                                <span>{appointment.client}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <MdSchedule className="w-4 h-4" />
                                <span>{appointment.time}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <MdPhone className="w-4 h-4" />
                                <span>{appointment.phone}</span>
                              </div>
                            </div>
                            {appointment.notes && (
                              <p className="text-sm text-muted-foreground italic">
                                {appointment.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <MdVideoCall className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <MdPhone className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Schedule Appointment Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule New Appointment</CardTitle>
                <CardDescription>
                  Create a new appointment for Connect, Recruit, or Precheck services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Appointment Type */}
                  <div className="space-y-2">
                    <Label htmlFor="appointment-type">Appointment Type</Label>
                    <Select value={newAppointmentData.type} onValueChange={(value) => setNewAppointmentData(prev => ({ ...prev, type: value as any }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select appointment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connect">AO Connect - Policy Verification</SelectItem>
                        <SelectItem value="recruit">AO Recruit - Agent Interview</SelectItem>
                        <SelectItem value="precheck">AO Precheck - Health Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Client Name */}
                  <div className="space-y-2">
                    <Label htmlFor="client-name">Client Name</Label>
                    <Input 
                      placeholder="Enter client name" 
                      value={newAppointmentData.client}
                      onChange={(e) => setNewAppointmentData(prev => ({ ...prev, client: e.target.value }))}
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      placeholder="+1 (555) 123-4567" 
                      value={newAppointmentData.phone}
                      onChange={(e) => setNewAppointmentData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      placeholder="client@example.com" 
                      type="email" 
                      value={newAppointmentData.email}
                      onChange={(e) => setNewAppointmentData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input 
                      type="date" 
                      value={newAppointmentData.date}
                      onChange={(e) => setNewAppointmentData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>

                  {/* Time */}
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input 
                      type="time" 
                      value={newAppointmentData.time}
                      onChange={(e) => setNewAppointmentData(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea 
                    placeholder="Add any additional notes about the appointment..."
                    rows={3}
                    value={newAppointmentData.notes}
                    onChange={(e) => setNewAppointmentData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setShowNewAppointment(false)} disabled={createAppointmentMutation.isPending}>
                    Cancel
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700"
                    onClick={handleCreateAppointment}
                    disabled={createAppointmentMutation.isPending}
                  >
                    {createAppointmentMutation.isPending ? 'Scheduling...' : 'Schedule Appointment'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Sync Tab */}
          <TabsContent value="sync" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calendar Integrations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MdSync className="w-5 h-5" />
                    <span>Calendar Integrations</span>
                  </CardTitle>
                  <CardDescription>
                    Sync with your existing calendar platforms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">G</span>
                      </div>
                      <div>
                        <p className="font-medium">Google Calendar</p>
                        <p className="text-sm text-muted-foreground">Sync bidirectionally</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-800 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">O</span>
                      </div>
                      <div>
                        <p className="font-medium">Outlook Calendar</p>
                        <p className="text-sm text-muted-foreground">Microsoft 365 integration</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">A</span>
                      </div>
                      <div>
                        <p className="font-medium">Apple Calendar</p>
                        <p className="text-sm text-muted-foreground">iCloud sync</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MdNotifications className="w-5 h-5" />
                    <span>Notification Settings</span>
                  </CardTitle>
                  <CardDescription>
                    Configure appointment reminders and alerts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Email Reminders</p>
                        <p className="text-sm text-muted-foreground">Send email notifications</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Enabled
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">SMS Notifications</p>
                        <p className="text-sm text-muted-foreground">Text message alerts</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Setup
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Browser Notifications</p>
                        <p className="text-sm text-muted-foreground">Desktop push notifications</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Enable
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Reminder Timing</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reminder time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15min">15 minutes before</SelectItem>
                          <SelectItem value="30min">30 minutes before</SelectItem>
                          <SelectItem value="1hour">1 hour before</SelectItem>
                          <SelectItem value="24hour">24 hours before</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}