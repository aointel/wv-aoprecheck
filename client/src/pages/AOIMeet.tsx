import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Video, Users, MessageSquare, Settings, Copy, Share, Play, Pause, UserPlus, Clock, Phone, Monitor, Bot, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AOIVerificationModal } from '@/components/verification/AOIVerificationModal';

interface Participant {
  id: string;
  name: string;
  type: 'client' | 'producer';
  joinedAt: Date;
  status: 'waiting' | 'in-meeting' | 'left';
}

export default function AOIMeet() {
  const { authState } = useAuth();
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [meetingActive, setMeetingActive] = useState(false);
  const [meetingStartTime, setMeetingStartTime] = useState<Date | null>(null);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [customMessage, setCustomMessage] = useState('Welcome to your AOI Connect meeting. Please wait while the host prepares the meeting room.');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [roomId, setRoomId] = useState('');
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);

  // Generate room ID based on Producer Email
  useEffect(() => {
    if (authState.user?.email) {
      const producerPrefix = authState.user.email.split('@')[0];
      setRoomId(producerPrefix);
    }
  }, [authState.user]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || (window.location.hostname || 'localhost') + (window.location.port ? ':' + window.location.port : ':5000');
    const wsUrl = `${protocol}//${host}/ws`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('🎥 AOI Meet WebSocket connected');
      // Join as meeting host
      websocket.send(JSON.stringify({
        type: 'join-room',
        roomId: roomId,
        participantName: authState.user?.email?.split('@')[0] || 'Host',
        participantType: 'host'
      }));
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('📡 AOI Meet received:', message);

      switch (message.type) {
        case 'user-joined':
          if (message.participantType !== 'host') {
            setParticipants(prev => [...prev, {
              id: Date.now().toString(),
              name: message.participantName || 'Unknown',
              type: message.participantType === 'producer' ? 'producer' : 'client',
              joinedAt: new Date(),
              status: 'waiting'
            }]);
            
            toast({
              title: "New Participant",
              description: `${message.participantName} joined the waiting room`,
            });
          }
          break;
          
        case 'user-left':
          setParticipants(prev => prev.map(p => 
            p.name === message.participantName 
              ? { ...p, status: 'left' as const }
              : p
          ));
          break;
      }
    };

    websocket.onclose = () => {
      console.log('🔌 AOI Meet WebSocket disconnected');
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [roomId, authState.user]);

  const startMeeting = async () => {
    try {
      const response = await fetch('/api/whereby/create-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomName: roomId,
          agentEmail: authState.user?.email
        })
      });
      
      if (!response.ok) throw new Error('Failed to create Whereby meeting');
      
      const meeting = await response.json();
      console.log('🎥 AOIMeet: Created Whereby meeting:', meeting);
      
      // Open host room URL for producer (full control)
      window.open(meeting.hostRoomUrl, 'whereby-meeting', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      
      setMeetingActive(true);
      setMeetingStartTime(new Date());
      
      // Admit all waiting participants
      setParticipants(prev => prev.map(p => 
        p.status === 'waiting' ? { ...p, status: 'in-meeting' } : p
      ));
      
      toast({
        title: "Whereby Meeting Started",
        description: "Professional video meeting room opened",
      });
    } catch (error) {
      console.error('❌ Failed to create Whereby meeting:', error);
      toast({
        title: "Meeting Failed",
        description: "Could not create video meeting",
        variant: "destructive"
      });
    }
  };

  const endMeeting = () => {
    setMeetingActive(false);
    setMeetingStartTime(null);
    setParticipants([]);
    
    toast({
      title: "Meeting Ended",
      description: "The meeting has been terminated",
    });
  };

  const admitParticipant = (participantId: string) => {
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, status: 'in-meeting' } : p
    ));
    
    const participant = participants.find(p => p.id === participantId);
    toast({
      title: "Participant Admitted",
      description: `${participant?.name} has been admitted to the meeting`,
    });
  };

  const removeParticipant = (participantId: string) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    
    const participant = participants.find(p => p.id === participantId);
    toast({
      title: "Participant Removed",
      description: `${participant?.name} has been removed from the meeting`,
    });
  };

  const sendMessage = () => {
    if (ws && customMessage.trim()) {
      ws.send(JSON.stringify({
        type: 'agent_message',
        roomId: roomId,
        message: customMessage,
        senderName: authState.user?.email?.split('@')[0] || 'Host'
      }));
      
      toast({
        title: "Message Sent",
        description: "Your message has been sent to the waiting room",
      });
    }
  };

  const copyMeetingLink = async () => {
    try {
      // Create a Whereby meeting for the link
      const response = await fetch('/api/whereby/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to create Whereby meeting');
      
      const meeting = await response.json();
      const meetingUrl = meeting.roomUrl;
      navigator.clipboard.writeText(meetingUrl);
      
      toast({
        title: "Whereby Link Copied",
        description: "Professional meeting link copied to clipboard",
      });
    } catch (error) {
      console.error('❌ Failed to create Whereby link:', error);
      toast({
        title: "Link Failed",
        description: "Could not create meeting link",
        variant: "destructive"
      });
    }
  };

  const waitingParticipants = participants.filter(p => p.status === 'waiting');
  const activeParticipants = participants.filter(p => p.status === 'in-meeting');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Video className="h-8 w-8 text-blue-600" />
              AOI Meet
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Professional video conferencing for {authState.user?.email?.split('@')[0] || 'Host'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant={meetingActive ? "default" : "secondary"} className="px-3 py-1">
              {meetingActive ? (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Live Meeting
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Not Started
                </>
              )}
            </Badge>
            
            {meetingStartTime && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Clock className="h-4 w-4" />
                {Math.floor((Date.now() - meetingStartTime.getTime()) / 1000 / 60)}m
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meeting Controls */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {producerMode ? "producer Meeting Controls" : "Meeting Controls"}
                  {producerMode && (
                    <Badge variant="outline" className="ml-2 bg-purple-50 text-purple-700 border-purple-200">
                      <Shield className="h-3 w-3 mr-1" />
                      producer Mode
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {producerMode ? (
                    <>
                      producer Room: <code className="font-mono bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded text-purple-700 dark:text-purple-300">{roomId}-producer</code>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        ✨ Enhanced permissions • Recording enabled • Full meeting control
                      </div>
                    </>
                  ) : (
                    <>
                      Room ID: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{roomId}</code>
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={copyMeetingLink}
                    variant="outline" 
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Meeting Link
                  </Button>
                  
                  <Button 
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/whereby/create-meeting', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            roomName: `quick-join-${roomId}`,
                            agentEmail: authState.user?.email
                          })
                        });
                        if (!response.ok) throw new Error('Failed to create meeting');
                        const meeting = await response.json();
                        window.open(meeting.hostRoomUrl, '_blank');
                      } catch (error) {
                        toast({
                          title: "Meeting Failed",
                          description: "Could not create video meeting",
                          variant: "destructive"
                        });
                      }
                    }}
                    variant="outline" 
                    className="w-full"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Join Whereby Meeting
                  </Button>
                </div>
                
                <Separator />
                
                <div className="flex gap-2">
                  {!meetingActive ? (
                    <Button 
                      onClick={startMeeting} 
                      className={`flex-1 ${producerMode ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {producerMode ? "Start producer Meeting" : "Start Meeting"}
                    </Button>
                  ) : (
                    <Button onClick={endMeeting} variant="destructive" className="flex-1">
                      <Pause className="h-4 w-4 mr-2" />
                      {producerMode ? "End producer Meeting" : "End Meeting"}
                    </Button>
                  )}
                </div>
                
                <Separator />
                
                {/* producer-Specific Features */}
                {producerMode && (
                  <div className="space-y-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">producer Features</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                        <Bot className="h-3 w-3" />
                        <span>Recording Active</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                        <Monitor className="h-3 w-3" />
                        <span>Screen Share</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                        <Users className="h-3 w-3" />
                        <span>Participant Control</span>
                      </div>
                      <div className="flex items-center gap-1 text-purple-700 dark:text-purple-400">
                        <Video className="h-3 w-3" />
                        <span>Meeting Analytics</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verification Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Call Verification
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Add compliance bot to verify your current call
                  </p>
                  <Button 
                    onClick={() => setVerificationModalOpen(true)}
                    variant="outline" 
                    className="w-full"
                    disabled={!meetingActive}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Verify Current Call
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Waiting Room Message</label>
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Enter message for waiting participants..."
                    rows={3}
                  />
                  <Button onClick={sendMessage} size="sm" className="w-full">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Participants Management */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Waiting Room */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Waiting Room
                    </span>
                    <Badge variant="secondary">{waitingParticipants.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Participants waiting to join the meeting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {waitingParticipants.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No participants waiting</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {waitingParticipants.map((participant) => (
                        <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-sm text-gray-500">
                              Waiting • {participant.joinedAt.toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => admitParticipant(participant.id)}
                            >
                              Admit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeParticipant(participant.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Active Meeting */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      In Meeting
                    </span>
                    <Badge variant="default">{activeParticipants.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Participants currently in the meeting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeParticipants.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active participants</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeParticipants.map((participant) => (
                        <div key={participant.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div>
                            <p className="font-medium">{participant.name}</p>
                            <p className="text-sm text-green-600 dark:text-green-400">
                              In meeting • {participant.joinedAt.toLocaleTimeString()}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeParticipant(participant.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Meeting Statistics */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Meeting Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{participants.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Participants</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{waitingParticipants.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Waiting</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{activeParticipants.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">In Meeting</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {meetingStartTime ? Math.floor((Date.now() - meetingStartTime.getTime()) / 1000 / 60) : 0}m
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Duration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Verification Modal */}
      <AOIVerificationModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        roomName={roomId}
        sessionType="video"
        leadName="Current Client"
        leadPhone="+15551234567"
        leadCity="Unknown City"
        leadState="Unknown State"
      />
    </div>
  );
}