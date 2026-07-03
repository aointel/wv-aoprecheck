import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Phone, 
  MapPin, 
  User, 
  ExternalLink,
  CheckCircle,
  Video,
  Presentation,
  TrendingUp,
  Award,
  Shield
} from 'lucide-react';
import { AOIMeetModal } from '@/components/modals/AOIMeetModal';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

type PresentationStage = 
  | 'appointment_scheduled'
  | 'introduction_sent'
  | 'presentation_started'
  | 'needs_analysis'
  | 'benefits_presented'
  | 'verification_started'
  | 'completed_sale'
  | 'completed_no_sale';

interface PresentationAppointment {
  id: string;
  clientName: string;
  clientPhone: string;
  clientCity: string;
  clientState: string;
  market: string; // e.g., "Veterans"
  appointmentTime: string;
  stage: PresentationStage;
  presentationResult?: 'sale' | 'no_sale' | 'follow_up' | null;
  alp?: number;
  agentName: string;
  agentEmail: string;
  scheduledFor: Date;
}

// Demo data - Today's upcoming appointments
const DEMO_APPOINTMENTS: PresentationAppointment[] = [
  {
    id: '1',
    clientName: 'Richard Fisher',
    clientPhone: '(989) 724-8468',
    clientCity: 'Standish',
    clientState: 'Michigan',
    market: 'Veterans',
    appointmentTime: '2:00 PM',
    stage: 'benefits_presented',
    presentationResult: null,
    agentName: 'Kristina Pleshakova',
    agentEmail: 'kristinapleshakova@aoglobelife.com',
    scheduledFor: new Date()
  },
  {
    id: '2',
    clientName: 'Mary Thompson',
    clientPhone: '(555) 234-5678',
    clientCity: 'Detroit',
    clientState: 'Michigan',
    market: 'Veterans',
    appointmentTime: '3:30 PM',
    stage: 'appointment_scheduled',
    presentationResult: null,
    agentName: 'Chris LaFond',
    agentEmail: 'chrislafond@aoglobelife.com',
    scheduledFor: new Date()
  },
  {
    id: '3',
    clientName: 'James Wilson',
    clientPhone: '(555) 345-6789',
    clientCity: 'Grand Rapids',
    clientState: 'Michigan',
    market: 'Veterans',
    appointmentTime: '4:00 PM',
    stage: 'completed_sale',
    presentationResult: 'sale',
    alp: 2400,
    agentName: 'Tabitha McDermid',
    agentEmail: 'tabithamcdermid@aoglobelife.com',
    scheduledFor: new Date()
  },
  {
    id: '4',
    clientName: 'Patricia Martinez',
    clientPhone: '(555) 456-7890',
    clientCity: 'Lansing',
    clientState: 'Michigan',
    market: 'Veterans',
    appointmentTime: '5:15 PM',
    stage: 'introduction_sent',
    presentationResult: null,
    agentName: 'Diana Blash',
    agentEmail: 'diankablash@aoglobelife.com',
    scheduledFor: new Date()
  },
  {
    id: '5',
    clientName: 'Robert Davis',
    clientPhone: '(555) 567-8901',
    clientCity: 'Ann Arbor',
    clientState: 'Michigan',
    market: 'Veterans',
    appointmentTime: '6:00 PM',
    stage: 'verification_started',
    presentationResult: null,
    agentName: 'Richard LaFond',
    agentEmail: 'richardlafond@aoglobelife.com',
    scheduledFor: new Date()
  },
  {
    id: '6',
    clientName: 'Susan Brown',
    clientPhone: '(555) 678-9012',
    clientCity: 'Flint',
    clientState: 'Michigan',
    market: 'Veterans',
    appointmentTime: '7:30 PM',
    stage: 'completed_no_sale',
    presentationResult: 'no_sale',
    agentName: 'Amanda Arrieta',
    agentEmail: 'amandaarrieta@aoglobelife.com',
    scheduledFor: new Date()
  }
];

const STAGE_INFO: Record<PresentationStage, { label: string; color: string; progress: number }> = {
  appointment_scheduled: { label: 'Appointment Scheduled', color: 'from-blue-500 to-cyan-500', progress: 15 },
  introduction_sent: { label: 'Introduction Sent', color: 'from-purple-500 to-blue-500', progress: 30 },
  presentation_started: { label: 'Presentation Started', color: 'from-indigo-500 to-purple-500', progress: 45 },
  needs_analysis: { label: 'Needs Analysis', color: 'from-pink-500 to-purple-500', progress: 60 },
  benefits_presented: { label: 'Benefits Presented', color: 'from-orange-500 to-pink-500', progress: 75 },
  verification_started: { label: 'Verification Started', color: 'from-yellow-500 to-orange-500', progress: 90 },
  completed_sale: { label: 'Sale Complete', color: 'from-green-500 to-emerald-500', progress: 100 },
  completed_no_sale: { label: 'No Sale', color: 'from-gray-400 to-gray-500', progress: 100 }
};

export default function AOPresent() {
  const [, setLocation] = useLocation();
  const { authState } = useAuth();
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = useState<PresentationAppointment | null>(null);
  const [isAOIMeetOpen, setIsAOIMeetOpen] = useState(false);

  const handleSendMeetInvite = (appointment: PresentationAppointment) => {
    setSelectedAppointment(appointment);
    setIsAOIMeetOpen(true);
  };

  const handleStartHPPRO = () => {
    const hpproUrl = 'https://hppro.planetaltig.com/#/';
    
    // If running in Electron, open externally (Electron will monitor it)
    if (window.isElectron && window.electronAPI) {
      console.log('🖥️ Opening HPPRO in Electron - screen capture will be available');
      window.electronAPI.openExternal(hpproUrl);
      
      toast({
        title: "HP Pro Opened",
        description: "Sales presentation platform opened - screen capture active",
        duration: 3000
      });
      return;
    }
    
    // Web browser fallback
    const popup = window.open(
      hpproUrl,
      'HPProSalesPlatform',
      'width=1600,height=1000,resizable=yes,scrollbars=yes'
    );

    if (popup) {
      try {
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const left = Math.max(0, (screenWidth - 1600) / 2);
        const top = Math.max(0, (screenHeight - 1000) / 2);
        popup.moveTo(left, top);
        popup.focus();
      } catch (e) {
        popup.focus();
      }

      toast({
        title: "HP Pro Opened",
        description: "⚠️ Web mode - screenshots not available. Use desktop app for full tracking.",
        duration: 5000
      });
    } else {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups and try again",
        variant: "destructive"
      });
    }
  };

  const handleCompleteVerification = () => {
    setLocation('/dashboard/verification-start');
  };

  const todayAppointments = DEMO_APPOINTMENTS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="container mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Presentation className="h-10 w-10 text-blue-600" />
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                AO Meet
              </h1>
              <p className="text-slate-600">
                Upcoming Appointments & Presentations
              </p>
            </div>
          </div>
        </div>

        {/* Appointments List - Full Width Rectangles with Infinite Scroll */}
        <div className="relative">
          {/* Fade overlay for infinite scroll effect */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
          
          <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
          {todayAppointments.map((appointment) => {
            const stageInfo = STAGE_INFO[appointment.stage];
            
            return (
              <Card 
                key={appointment.id} 
                className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-lg bg-white/80 backdrop-blur-sm"
                style={{
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)'
                }}
              >
                {/* Progress Header with AO Recruit Gradient */}
                <div className="h-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />
                
                <CardContent className="p-4">
                  
                  {/* Single Row - Full Width */}
                  <div className="flex items-center justify-between gap-4">
                    
                    {/* Client Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-900">
                          {appointment.clientName}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white border-0 font-semibold"
                        >
                          {appointment.appointmentTime}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-blue-500" />
                          <span className="font-mono">{appointment.clientPhone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-500" />
                          <span>{appointment.clientCity}, {appointment.clientState}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-purple-500" />
                          <span className="font-semibold text-purple-700">{appointment.market}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Tracker - AO Recruit Style */}
                    <div className="w-48">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {stageInfo.label}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {Math.round(stageInfo.progress)}%
                        </span>
                      </div>
                      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 transition-all duration-500"
                          style={{ width: `${stageInfo.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons - Compact Inline */}
                    <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSendMeetInvite(appointment)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-xs"
                    >
                      <Video className="w-3 h-3 mr-1" />
                      AO Meet
                    </Button>
                    
                    <Button
                      size="sm"
                      onClick={handleStartHPPRO}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      HP Pro
                    </Button>
                    
                    <Button
                      size="sm"
                      onClick={handleCompleteVerification}
                      variant="outline"
                      className="flex-1 border-2 border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      AO Precheck
                    </Button>
                  </div>
                  </div>

                </CardContent>
              </Card>
            );
          })}
          </div>
        </div>

        {/* Empty State */}
        {todayAppointments.length === 0 && (
          <Card className="p-12 text-center bg-white/80 backdrop-blur-sm shadow-lg">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No Appointments Today
            </h3>
            <p className="text-slate-500">
              Your upcoming presentations will appear here
            </p>
          </Card>
        )}

      </div>

      {/* AO Meet Modal */}
      {selectedAppointment && (
        <AOIMeetModal
          isOpen={isAOIMeetOpen}
          onClose={() => {
            setIsAOIMeetOpen(false);
            setSelectedAppointment(null);
          }}
          agentName={selectedAppointment.agentName}
          producerPhone={selectedAppointment.clientPhone}
        />
      )}
    </div>
  );
}

