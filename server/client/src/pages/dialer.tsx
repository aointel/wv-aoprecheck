import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Play,
  Pause,
  SkipForward,
  Clock,
  User,
  MapPin,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
  age: number;
  premium: number;
  status: 'new' | 'contacted' | 'qualified' | 'not_interested';
}

interface CallSession {
  id: string;
  status: 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended';
  startTime: Date | null;
  duration: number;
  lead: Lead | null;
}

export default function Dialer() {
  const [callSession, setCallSession] = useState<CallSession>({
    id: '',
    status: 'idle',
    startTime: null,
    duration: 0,
    lead: null
  });

  const [audioSettings, setAudioSettings] = useState({
    micMuted: false,
    speakerMuted: false,
    volume: 80
  });

  const [dialerState, setDialerState] = useState({
    isActive: false,
    isPaused: false,
    callsToday: 0,
    leadsRemaining: 15,
    successRate: 0
  });

  const [currentLead, setCurrentLead] = useState<Lead>({
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    phone: '+15551234567',
    city: 'Portland',
    state: 'OR',
    age: 45,
    premium: 125.50,
    status: 'new'
  });

  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (callSession.status === 'connected' && callSession.startTime) {
      intervalRef.current = setInterval(() => {
        setCallSession(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - (prev.startTime?.getTime() || 0)) / 1000)
        }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [callSession.status, callSession.startTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startDialer = () => {
    setDialerState(prev => ({ ...prev, isActive: true, isPaused: false }));
    toast({
      title: "Dialer Started",
      description: "Beginning outbound calling session",
    });
  };

  const pauseDialer = () => {
    setDialerState(prev => ({ ...prev, isPaused: !prev.isPaused }));
    toast({
      title: dialerState.isPaused ? "Dialer Resumed" : "Dialer Paused",
      description: dialerState.isPaused ? "Continuing calls" : "Pausing between calls",
    });
  };

  const stopDialer = () => {
    setDialerState(prev => ({ ...prev, isActive: false, isPaused: false }));
    if (callSession.status === 'connected') {
      endCall();
    }
    toast({
      title: "Dialer Stopped",
      description: "Ending dialing session",
    });
  };

  const makeCall = async () => {
    setCallSession({
      id: `call-${Date.now()}`,
      status: 'connecting',
      startTime: null,
      duration: 0,
      lead: currentLead
    });

    // Simulate call progression
    setTimeout(() => {
      setCallSession(prev => ({ ...prev, status: 'ringing' }));
    }, 1000);

    setTimeout(() => {
      setCallSession(prev => ({ 
        ...prev, 
        status: 'connected',
        startTime: new Date()
      }));
      toast({
        title: "Call Connected",
        description: `Connected to ${currentLead.firstName} ${currentLead.lastName}`,
      });
    }, 3000);
  };

  const endCall = () => {
    setCallSession(prev => ({ ...prev, status: 'ended' }));
    setTimeout(() => {
      setCallSession({
        id: '',
        status: 'idle',
        startTime: null,
        duration: 0,
        lead: null
      });
      setDialerState(prev => ({ 
        ...prev, 
        callsToday: prev.callsToday + 1,
        leadsRemaining: prev.leadsRemaining - 1
      }));
    }, 2000);
  };

  const toggleMic = () => {
    setAudioSettings(prev => ({ ...prev, micMuted: !prev.micMuted }));
  };

  const toggleSpeaker = () => {
    setAudioSettings(prev => ({ ...prev, speakerMuted: !prev.speakerMuted }));
  };

  const dispositionCall = (disposition: 'qualified' | 'not_interested' | 'callback') => {
    toast({
      title: "Call Disposition Set",
      description: `Marked as ${disposition.replace('_', ' ')}`,
    });
    endCall();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Dialer</h1>
            <p className="text-gray-600">Outbound calling with WebRTC technology</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant={dialerState.isActive ? "default" : "secondary"}>
              {dialerState.isActive ? (dialerState.isPaused ? "Paused" : "Active") : "Stopped"}
            </Badge>
            <div className="text-sm text-gray-600">
              {dialerState.callsToday} calls today • {dialerState.leadsRemaining} leads remaining
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Call Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dialer Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="w-5 h-5 mr-2" />
                  Power Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  {!dialerState.isActive ? (
                    <Button onClick={startDialer} className="bg-green-600 hover:bg-green-700">
                      <Play className="w-4 h-4 mr-2" />
                      Start Dialer
                    </Button>
                  ) : (
                    <>
                      <Button 
                        onClick={pauseDialer} 
                        variant={dialerState.isPaused ? "default" : "outline"}
                      >
                        {dialerState.isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                        {dialerState.isPaused ? "Resume" : "Pause"}
                      </Button>
                      <Button onClick={stopDialer} variant="destructive">
                        <PhoneOff className="w-4 h-4 mr-2" />
                        Stop Dialer
                      </Button>
                    </>
                  )}
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress Today</span>
                    <span>{dialerState.callsToday} / {dialerState.callsToday + dialerState.leadsRemaining}</span>
                  </div>
                  <Progress 
                    value={(dialerState.callsToday / (dialerState.callsToday + dialerState.leadsRemaining)) * 100} 
                    className="mt-2" 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Active Call Interface */}
            {callSession.status !== 'idle' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Phone className="w-5 h-5 mr-2" />
                    Active Call
                    {callSession.status === 'connecting' && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${
                        callSession.status === 'connected' ? 'bg-green-500' :
                        callSession.status === 'ringing' ? 'bg-yellow-500 animate-pulse' :
                        'bg-blue-500'
                      }`}></div>
                      <span className="font-medium">
                        {callSession.status === 'connecting' && 'Connecting...'}
                        {callSession.status === 'ringing' && 'Ringing...'}
                        {callSession.status === 'connected' && 'Connected'}
                        {callSession.status === 'ended' && 'Call Ended'}
                      </span>
                    </div>
                    {callSession.status === 'connected' && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        {formatDuration(callSession.duration)}
                      </div>
                    )}
                  </div>

                  {callSession.status === 'connected' && (
                    <div className="flex items-center justify-center space-x-4">
                      <Button
                        variant={audioSettings.micMuted ? "destructive" : "outline"}
                        size="lg"
                        onClick={toggleMic}
                      >
                        {audioSettings.micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </Button>
                      
                      <Button onClick={endCall} variant="destructive" size="lg">
                        <PhoneOff className="w-5 h-5" />
                      </Button>
                      
                      <Button
                        variant={audioSettings.speakerMuted ? "destructive" : "outline"}
                        size="lg"
                        onClick={toggleSpeaker}
                      >
                        {audioSettings.speakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </Button>
                    </div>
                  )}

                  {callSession.status === 'connected' && (
                    <div className="border-t pt-4">
                      <div className="text-sm font-medium mb-3">Quick Disposition</div>
                      <div className="flex space-x-2">
                        <Button 
                          onClick={() => dispositionCall('qualified')} 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Qualified
                        </Button>
                        <Button 
                          onClick={() => dispositionCall('not_interested')} 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Not Interested
                        </Button>
                        <Button 
                          onClick={() => dispositionCall('callback')} 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                        >
                          <SkipForward className="w-4 h-4 mr-1" />
                          Callback
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Manual Dial */}
            {!dialerState.isActive && callSession.status === 'idle' && (
              <Card>
                <CardHeader>
                  <CardTitle>Manual Call</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={makeCall} className="w-full">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Current Lead
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Lead Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Current Lead
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{currentLead.firstName} {currentLead.lastName}</h3>
                  <p className="text-gray-600">{currentLead.phone}</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{currentLead.city}, {currentLead.state}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{currentLead.age} years old</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">${currentLead.premium}/month premium</span>
                  </div>
                </div>

                <Badge variant={currentLead.status === 'new' ? 'default' : 'secondary'}>
                  {currentLead.status.replace('_', ' ')}
                </Badge>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">WebRTC Connection</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-600">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">VDP System</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-600">Online</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Lead Queue</span>
                  <Badge variant="secondary">{dialerState.leadsRemaining} ready</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}