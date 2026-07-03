import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Clock, 
  Video, 
  Phone, 
  MapPin, 
  User, 
  Music, 
  Globe, 
  Bot, 
  Send,
  Play,
  Pause,
  PhoneCall,
  MessageSquare,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface DemoLead {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  state: string;
  age: number;
  income: string;
  occupation: string;
  scenario: 'interested' | 'not_interested' | 'callback' | 'no_answer' | 'voicemail';
  script_prompt: string;
}

interface CallScenario {
  id: string;
  title: string;
  description: string;
  audio_clips: {
    greeting: string;
    response: string;
    objection?: string;
    closing: string;
  };
  expected_outcome: string;
}

export default function CallConnectorProDemo() {
  const [demoLeads] = useState<DemoLead[]>([
    {
      id: 1,
      first_name: "Sarah",
      last_name: "Johnson",
      phone: "(555) 123-4567",
      email: "sarah.johnson@email.com",
      state: "FL",
      age: 45,
      income: "$75,000",
      occupation: "Teacher",
      scenario: "interested",
      script_prompt: "Sarah is interested in life insurance and asks thoughtful questions about coverage options."
    },
    {
      id: 2,
      first_name: "Michael",
      last_name: "Davis",
      phone: "(555) 234-5678",
      email: "m.davis@email.com",
      state: "TX",
      age: 38,
      income: "$65,000",
      occupation: "Engineer",
      scenario: "not_interested",
      script_prompt: "Michael is polite but not interested. Practice handling objections professionally."
    },
    {
      id: 3,
      first_name: "Emma",
      last_name: "Wilson",
      phone: "(555) 345-6789",
      email: "emma.w@email.com",
      state: "CA",
      age: 52,
      income: "$90,000",
      occupation: "Manager",
      scenario: "callback",
      script_prompt: "Emma is interested but busy. She requests a callback for next week."
    },
    {
      id: 4,
      first_name: "Robert",
      last_name: "Brown",
      phone: "(555) 456-7890",
      email: "rbrown@email.com",
      state: "NY",
      age: 41,
      income: "$80,000",
      occupation: "Sales Rep",
      scenario: "voicemail",
      script_prompt: "Goes to voicemail. Practice leaving a professional, compelling message."
    }
  ]);

  const [currentLead, setCurrentLead] = useState<DemoLead | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [notes, setNotes] = useState('');
  const [disposition, setDisposition] = useState('');
  const [appointmentScheduled, setAppointmentScheduled] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [practiceFeedback, setPracticeFeedback] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Demo call timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const startDemoCall = (lead: DemoLead) => {
    setCurrentLead(lead);
    setCallStatus('dialing');
    setCallTimer(0);
    setNotes('');
    setDisposition('');
    setAppointmentScheduled(false);
    setPracticeFeedback([]);

    // Simulate call progression
    setTimeout(() => setCallStatus('ringing'), 1000);
    
    if (lead.scenario === 'no_answer') {
      setTimeout(() => {
        setCallStatus('ended');
        setPracticeFeedback(['No answer - Consider trying again at a different time']);
      }, 4000);
    } else if (lead.scenario === 'voicemail') {
      setTimeout(() => {
        setCallStatus('ended');
        setPracticeFeedback(['Voicemail reached - Practice your 30-second elevator pitch']);
      }, 3000);
    } else {
      setTimeout(() => {
        setCallStatus('connected');
        provideDemoFeedback(lead);
      }, 2500);
    }

    toast({
      title: "🎭 Demo Call Started",
      description: `Practicing with ${lead.first_name} ${lead.last_name} - ${lead.scenario} scenario`,
    });
  };

  const provideDemoFeedback = (lead: DemoLead) => {
    const feedbackMessages = {
      interested: [
        "✅ Great! Sarah seems engaged",
        "💡 Ask about her family situation",
        "🎯 Focus on benefits that matter to teachers",
        "📅 Look for appointment scheduling opportunity"
      ],
      not_interested: [
        "⚠️ Handle objections with empathy",
        "💡 Ask what their current concerns are",
        "🎯 Focus on protection, not sales",
        "🤝 Respect their decision gracefully"
      ],
      callback: [
        "⏰ Schedule callback immediately",
        "📝 Get their preferred time",
        "✅ Confirm contact information",
        "🎯 Set clear expectations"
      ]
    };

    const messages = feedbackMessages[lead.scenario as keyof typeof feedbackMessages] || [];
    
    messages.forEach((message, index) => {
      setTimeout(() => {
        setPracticeFeedback(prev => [...prev, message]);
      }, (index + 1) * 3000);
    });
  };

  const endDemoCall = () => {
    setCallStatus('ended');
    if (currentLead && callTimer > 0) {
      toast({
        title: "🎭 Demo Call Completed",
        description: `Call duration: ${Math.floor(callTimer / 60)}:${(callTimer % 60).toString().padStart(2, '0')}`,
      });
    }
  };

  const resetDemo = () => {
    setCurrentLead(null);
    setCallStatus('idle');
    setCallTimer(0);
    setNotes('');
    setDisposition('');
    setAppointmentScheduled(false);
    setPracticeFeedback([]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'dialing': return 'bg-yellow-500';
      case 'ringing': return 'bg-blue-500 animate-pulse';
      case 'connected': return 'bg-green-500';
      case 'ended': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Demo Header */}
      <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border-blue-400/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-white">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Phone className="h-6 w-6" />
            </div>
            Call Connector Pro - Demo Training
            <Badge className="bg-yellow-500/90 text-black font-semibold">PRACTICE MODE</Badge>
          </CardTitle>
          <p className="text-white/80">
            Safe practice environment with realistic scenarios. No real calls are made.
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Selection */}
        <Card className="bg-white/10 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Practice Leads</CardTitle>
            <p className="text-white/70 text-sm">Choose a scenario to practice</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoLeads.map((lead) => (
              <div
                key={lead.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  currentLead?.id === lead.id
                    ? 'border-blue-400 bg-blue-500/20'
                    : 'border-white/20 bg-white/5 hover:border-blue-400/50 hover:bg-white/10'
                }`}
                onClick={() => currentLead?.id !== lead.id && setCurrentLead(lead)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">
                    {lead.first_name} {lead.last_name}
                  </h3>
                  <Badge 
                    className={`text-xs ${
                      lead.scenario === 'interested' ? 'bg-green-500' :
                      lead.scenario === 'not_interested' ? 'bg-red-500' :
                      lead.scenario === 'callback' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}
                  >
                    {lead.scenario.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="text-white/70 text-sm space-y-1">
                  <p>{lead.phone} • {lead.state}</p>
                  <p>{lead.age} years • {lead.occupation}</p>
                  <p className="text-xs mt-2 italic">{lead.script_prompt}</p>
                </div>
                {callStatus === 'idle' && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      startDemoCall(lead);
                    }}
                    className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <PhoneCall className="w-4 h-4 mr-2" />
                    Start Practice Call
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Call Interface */}
        <Card className="bg-white/10 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <span>Call Interface</span>
              {callStatus !== 'idle' && (
                <div className={`px-3 py-1 rounded-full text-white text-sm ${getStatusColor()}`}>
                  {callStatus.toUpperCase()}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentLead ? (
              <>
                {/* Lead Info */}
                <div className="p-4 bg-white/5 rounded-lg">
                  <h3 className="text-white font-semibold text-lg">
                    {currentLead.first_name} {currentLead.last_name}
                  </h3>
                  <div className="text-white/70 text-sm mt-2 space-y-1">
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {currentLead.phone}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {currentLead.state}
                    </p>
                    <p className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {currentLead.age} years, {currentLead.occupation}
                    </p>
                  </div>
                </div>

                {/* Call Timer */}
                {callStatus === 'connected' && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {formatTime(callTimer)}
                    </div>
                    <p className="text-white/70 text-sm">Call Duration</p>
                  </div>
                )}

                {/* Call Controls */}
                <div className="flex gap-2">
                  {callStatus === 'idle' && (
                    <Button
                      onClick={() => startDemoCall(currentLead)}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Start Call
                    </Button>
                  )}
                  
                  {(callStatus === 'connected' || callStatus === 'ringing') && (
                    <Button
                      onClick={endDemoCall}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      End Call
                    </Button>
                  )}

                  {callStatus === 'ended' && (
                    <Button
                      onClick={resetDemo}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      New Practice
                    </Button>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-white">Call Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Take notes during your practice call..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    rows={3}
                  />
                </div>

                {/* Disposition */}
                {callStatus === 'ended' && (
                  <div className="space-y-2">
                    <Label className="text-white">Call Disposition</Label>
                    <Select value={disposition} onValueChange={setDisposition}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Select outcome..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="appointment">Appointment Scheduled</SelectItem>
                        <SelectItem value="callback">Callback Requested</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="no_answer">No Answer</SelectItem>
                        <SelectItem value="voicemail">Voicemail Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-white/70 py-8">
                <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a practice lead to begin training</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Feedback */}
        <Card className="bg-white/10 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-white">Training Feedback</CardTitle>
            <p className="text-white/70 text-sm">Real-time coaching tips</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {practiceFeedback.length > 0 ? (
              <>
                {practiceFeedback.map((feedback, index) => (
                  <div
                    key={index}
                    className="p-3 bg-blue-500/20 rounded-lg border border-blue-400/30"
                  >
                    <p className="text-white text-sm">{feedback}</p>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center text-white/70 py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start a practice call to receive coaching feedback</p>
              </div>
            )}

            {callStatus === 'ended' && currentLead && (
              <div className="mt-6 p-4 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
                <h4 className="text-emerald-300 font-semibold mb-2">Practice Complete!</h4>
                <div className="text-white/80 text-sm space-y-1">
                  <p>• Scenario: {currentLead.scenario.replace('_', ' ')}</p>
                  <p>• Duration: {formatTime(callTimer)}</p>
                  <p>• Notes taken: {notes.length > 0 ? 'Yes' : 'No'}</p>
                  <p>• Disposition set: {disposition ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Demo Instructions */}
      <Card className="bg-gradient-to-r from-emerald-500/20 to-green-600/20 backdrop-blur-sm border-emerald-400/50">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="text-white font-semibold text-lg mb-3">
              🎭 How Practice Mode Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white/80 text-sm">
              <div className="p-3 bg-white/10 rounded-lg">
                <CheckCircle className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                <p className="font-medium mb-1">Safe Environment</p>
                <p>No real calls made. Practice without consequences.</p>
              </div>
              <div className="p-3 bg-white/10 rounded-lg">
                <Bot className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                <p className="font-medium mb-1">AI Coaching</p>
                <p>Real-time feedback and tips during scenarios.</p>
              </div>
              <div className="p-3 bg-white/10 rounded-lg">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-purple-400" />
                <p className="font-medium mb-1">Multiple Scenarios</p>
                <p>Practice different lead types and outcomes.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}