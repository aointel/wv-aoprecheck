import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar, 
  Phone, 
  MapPin, 
  User, 
  Clock,
  Briefcase,
  TrendingUp,
  Video,
  Shield,
  Share,
  Plus,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { AOIMeetModal } from '@/components/modals/AOIMeetModal';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  city: string;
  state: string;
  market: string;
  time: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  comments: number;
  attachments: number;
}

interface ScheduledEvent {
  id: string;
  title: string;
  time: string;
  color: 'green' | 'blue' | 'purple';
  participants: string[];
}

interface Note {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

// Demo Data
const DEMO_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    clientName: 'Richard Fisher',
    clientPhone: '989-724-8468',
    city: 'Caro',
    state: 'MI',
    market: 'Veteran',
    time: '10:00 AM',
    status: 'in_progress',
    comments: 3,
    attachments: 2
  },
  {
    id: '2',
    clientName: 'Sandra Johnson',
    clientPhone: '555-123-4567',
    city: 'Detroit',
    state: 'MI',
    market: 'Senior',
    time: '01:30 PM',
    status: 'scheduled',
    comments: 1,
    attachments: 1
  },
  {
    id: '3',
    clientName: 'Michael Brown',
    clientPhone: '555-987-6543',
    city: 'Grand Rapids',
    state: 'MI',
    market: 'Family',
    time: '03:00 PM',
    status: 'completed',
    comments: 5,
    attachments: 3
  }
];

const SCHEDULED_EVENTS: ScheduledEvent[] = [
  {
    id: '1',
    title: 'Richard Fisher - Veterans Presentation',
    time: '10:00 AM to 11:30 AM',
    color: 'green',
    participants: ['RF', 'VP']
  },
  {
    id: '2',
    title: 'Sandra Johnson - Medicare Review',
    time: '01:30 PM to 02:30 PM',
    color: 'blue',
    participants: ['SJ', 'VP']
  },
  {
    id: '3',
    title: 'Michael Brown - Final Health Plan',
    time: '03:00 PM to 04:30 PM',
    color: 'purple',
    participants: ['MB', 'VP']
  }
];

const NOTES: Note[] = [
  {
    id: '1',
    title: 'Follow up with Richard Fisher',
    description: 'Client interested in additional coverage for spouse. Schedule follow-up call next week.',
    completed: false
  },
  {
    id: '2',
    title: 'Send proposal to Sandra Johnson',
    description: 'Email detailed Medicare Advantage plan comparison by end of day.',
    completed: false
  },
  {
    id: '3',
    title: 'Complete verification for Michael Brown',
    description: 'Finalize AO Precheck and submit application to carrier.',
    completed: true
  }
];

export default function AOPresent() {
  const { authState } = useAuth();
  const { toast } = useToast();
  const [isAOIMeetOpen, setIsAOIMeetOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [notes, setNotes] = useState(NOTES);

  const today = new Date();
  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const currentDay = today.getDay();

  const handleSendMeetInvite = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsAOIMeetOpen(true);
  };

  const handleStartHPPRO = () => {
    // Use SPA entrypoint through proxy; legacy login shell can render blank when its bundles 404.
    const hpproProxyUrl = '/api/hppro/#/StartPresentation';
    
    if (window.isElectron && window.electronAPI) {
      // In Electron: open the proxy URL in a new window
      window.electronAPI.openExternal(window.location.origin + hpproProxyUrl);
      toast({ title: "HP Pro Opened", description: "Presentation platform opened via proxy", duration: 3000 });
      return;
    }
    
    window.open(hpproProxyUrl, '_blank', 'width=1600,height=1000');
    toast({ title: "HP Pro Opened", description: "Presentation platform opened", duration: 2000 });
  };

  const toggleNoteComplete = (noteId: string) => {
    setNotes(notes.map(note => 
      note.id === noteId ? { ...note, completed: !note.completed } : note
    ));
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      'in_progress': 'bg-green-100 text-green-700 border-green-200',
      'scheduled': 'bg-purple-100 text-purple-700 border-purple-200',
      'completed': 'bg-blue-100 text-blue-700 border-blue-200'
    };
    
    const labels = {
      'in_progress': 'In Progress',
      'scheduled': 'Scheduled',
      'completed': 'Completed'
    };
    
    return (
      <Badge className={`${styles[status as keyof typeof styles]} border`}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                {today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="text-3xl font-bold text-gray-900">
                Good {today.getHours() < 12 ? 'Morning' : today.getHours() < 17 ? 'Afternoon' : 'Evening'}! {authState?.profile?.firstName || 'Agent'},
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">12</p>
                  <p className="text-sm text-gray-600">Presentations Today</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                  <p className="text-sm text-gray-600">Sales Completed</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">$4,800</p>
                  <p className="text-sm text-gray-600">Total ALP</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Appointments Table - Takes up 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-gray-600" />
                    <h2 className="text-xl font-bold text-gray-900">Today's Appointments</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm">
                      This Week
                    </Button>
                    <Button variant="ghost" size="sm" className="text-sm text-gray-600">
                      See All
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-4 pb-3 border-b text-sm font-medium text-gray-600">
                    <div className="col-span-5 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Client Name
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Time
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Location
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Status
                    </div>
                  </div>

                  {/* Rows */}
                  {DEMO_APPOINTMENTS.map((appointment) => (
                    <div key={appointment.id} className="grid grid-cols-12 gap-4 py-4 border-b hover:bg-gray-50 transition-colors">
                      <div className="col-span-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600">
                            <AvatarFallback className="text-white text-xs font-semibold">
                              {appointment.clientName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{appointment.clientName}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> {appointment.comments}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" /> {appointment.attachments}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3 flex items-center">
                        <span className="text-sm text-gray-700">{appointment.time}</span>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm text-gray-600">{appointment.city}, {appointment.state}</span>
                      </div>
                      <div className="col-span-2 flex items-center">
                        {getStatusBadge(appointment.status)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-3 mt-6 pt-4 border-t">
                  <Button 
                    onClick={() => DEMO_APPOINTMENTS[0] && handleSendMeetInvite(DEMO_APPOINTMENTS[0])}
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Send AO Meet
                  </Button>
                  <Button 
                    onClick={handleStartHPPRO}
                    variant="outline" 
                    size="sm"
                    className="flex-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <Briefcase className="w-4 h-4 mr-2" />
                    Start HPPRO
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    AO Precheck
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Schedule Card */}
            <Card className="bg-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <h2 className="text-xl font-bold text-gray-900">Schedule</h2>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>

                {/* Week Calendar */}
                <div className="flex items-center gap-2 mb-6">
                  {weekDays.map((day, index) => {
                    const dayDate = today.getDate() - currentDay + index + 1;
                    const isToday = index + 1 === currentDay;
                    
                    return (
                      <div 
                        key={day}
                        className={`flex-1 text-center py-3 rounded-lg transition-colors ${
                          isToday 
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <p className="text-xs font-medium">{day}</p>
                        <p className="text-sm font-bold mt-1">{dayDate}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Events List */}
                <div className="space-y-4">
                  {SCHEDULED_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className={`w-1 h-20 rounded-full ${
                        event.color === 'green' ? 'bg-green-500' :
                        event.color === 'blue' ? 'bg-blue-500' :
                        'bg-purple-500'
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{event.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{event.time}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {event.participants.map((initial, i) => (
                            <Avatar key={i} className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600">
                              <AvatarFallback className="text-white text-xs font-semibold">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes Section - 1 column */}
          <div className="lg:col-span-1">
            <Card className="bg-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                  <h2 className="text-xl font-bold text-gray-900">Notes & Follow-ups</h2>
                </div>

                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="space-y-2">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleNoteComplete(note.id)}
                          className="mt-1"
                        >
                          {note.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-purple-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <div className="flex-1">
                          <p className={`font-medium ${note.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {note.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {note.description}
                          </p>
                        </div>
                      </div>
                      {note.id !== notes[notes.length - 1].id && (
                        <div className="border-b" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AOIMeetModal
        isOpen={isAOIMeetOpen}
        onClose={() => setIsAOIMeetOpen(false)}
        agentName={`${authState?.profile?.firstName || ''} ${authState?.profile?.lastName || ''}`.trim()}
        producerPhone={authState?.profile?.phone || ''}
        clientName={selectedAppointment?.clientName}
        clientPhone={selectedAppointment?.clientPhone}
      />
    </div>
  );
}

