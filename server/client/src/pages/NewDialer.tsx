import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  MdCall, 
  MdCallEnd, 
  MdMic, 
  MdMicOff, 
  MdVolumeUp,
  MdSkipNext,
  MdPhone
} from 'react-icons/md';
import { FaPause, FaPlay } from 'react-icons/fa';
import { useQuery, useMutation } from '@tanstack/react-query';

export default function NewDialer() {
  const [isDialing, setIsDialing] = useState(false);
  const [currentNumber, setCurrentNumber] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Fetch lead data
  const { data: currentLead } = useQuery({
    queryKey: ['/api/dialer/current-lead'],
  });

  const { data: dialerStats } = useQuery({
    queryKey: ['/api/dialer/stats'],
  });

  // Call mutations
  const startCallMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await fetch('/api/dialer/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      return response.json();
    },
    onSuccess: () => {
      setCallInProgress(true);
      setIsDialing(false);
    },
  });

  const endCallMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/dialer/end-call', {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      setCallInProgress(false);
      setCallDuration(0);
    },
  });

  const handleStartCall = () => {
    if (currentNumber || currentLead?.phone) {
      const phoneNumber = currentNumber || currentLead?.phone;
      setIsDialing(true);
      startCallMutation.mutate(phoneNumber);
    }
  };

  const handleEndCall = () => {
    endCallMutation.mutate();
  };

  const handleSkipLead = () => {
    // Skip to next lead
    setCurrentNumber('');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Call Connector Pro</h1>
          <p className="text-muted-foreground">
            Advanced calling interface
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline">
            WebRTC Ready
          </Badge>
          <Badge variant={callInProgress ? "default" : "secondary"}>
            {callInProgress ? "On Call" : "Available"}
          </Badge>
        </div>
      </div>

      {/* Main Dialer Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Call Controls</CardTitle>
            <CardDescription>
              Manage your calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone Number Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">Phone Number</label>
              <Input
                type="tel"
                placeholder="Enter phone number..."
                value={currentNumber}
                onChange={(e) => setCurrentNumber(e.target.value)}
                disabled={callInProgress}
              />
            </div>

            {/* Call Duration */}
            {callInProgress && (
              <div className="text-center py-4">
                <div className="text-2xl font-mono">
                  {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-sm text-muted-foreground">Call Duration</p>
              </div>
            )}

            {/* Main Call Button */}
            <div className="flex flex-col space-y-2">
              {!callInProgress ? (
                <Button
                  onClick={handleStartCall}
                  disabled={(!currentNumber && !currentLead?.phone) || isDialing}
                  className="w-full"
                  size="lg"
                >
                  {isDialing ? (
                    <>
                      <MdPhone className="mr-2 h-4 w-4 animate-pulse" />
                      Dialing...
                    </>
                  ) : (
                    <>
                      <MdCall className="mr-2 h-4 w-4" />
                      Start Call
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleEndCall}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                >
                  <MdCallEnd className="mr-2 h-4 w-4" />
                  End Call
                </Button>
              )}
            </div>

            {/* Call Controls */}
            {callInProgress && (
              <div className="flex space-x-2">
                <Button
                  onClick={toggleMute}
                  variant={isMuted ? "destructive" : "outline"}
                  className="flex-1"
                >
                  {isMuted ? <MdMicOff className="h-4 w-4" /> : <MdMic className="h-4 w-4" />}
                </Button>
                <Button variant="outline" className="flex-1">
                  <MdVolumeUp className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator />

            {/* Lead Controls */}
            <div className="space-y-2">
              <Button
                onClick={handleSkipLead}
                variant="outline"
                className="w-full"
                disabled={callInProgress}
              >
                <MdSkipNext className="mr-2 h-4 w-4" />
                Skip Lead
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lead Information */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Current Lead</CardTitle>
            <CardDescription>
              Lead information and details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentLead ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{currentLead.name}</h3>
                  <p className="text-muted-foreground">{currentLead.phone}</p>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Location:</span>
                    <span className="text-sm font-medium">{currentLead.location || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Lead Source:</span>
                    <span className="text-sm font-medium">{currentLead.source || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Priority:</span>
                    <Badge variant={currentLead.priority === 'High' ? 'destructive' : 'default'}>
                      {currentLead.priority || 'Medium'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">
                    {currentLead.notes || 'No notes available'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No lead data available</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Use manual dialing or load leads
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics and Power Controls */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Session Statistics</CardTitle>
            <CardDescription>
              Track your calling performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{dialerStats?.callsToday || 0}</div>
                <p className="text-sm text-muted-foreground">Calls Today</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{dialerStats?.connectRate || 0}%</div>
                <p className="text-sm text-muted-foreground">Connect Rate</p>
              </div>
            </div>

            <Separator />

            {/* Daily Progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Daily Goal</span>
                <span>{dialerStats?.callsToday || 0}/50</span>
              </div>
              <Progress value={((dialerStats?.callsToday || 0) / 50) * 100} />
            </div>

            <Separator />

            {/* Power Controls */}
            <div>
              <h4 className="font-medium mb-3">Power Controls</h4>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <FaPlay className="mr-2 h-4 w-4" />
                  Auto-Dial Mode
                </Button>
                <Button variant="outline" className="w-full justify-start" size="sm">
                  <FaPause className="mr-2 h-4 w-4" />
                  Pause Session
                </Button>
              </div>
            </div>

            <Separator />

            {/* Call History Quick View */}
            <div>
              <h4 className="font-medium mb-3">Recent Calls</h4>
              <div className="space-y-2">
                {dialerStats?.recentCalls?.slice(0, 3).map((call: any, index: number) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="truncate">{call.number}</span>
                    <Badge variant={call.status === 'connected' ? 'default' : 'secondary'} className="text-xs">
                      {call.status}
                    </Badge>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground">No recent calls</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Disposition */}
      {callInProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Call Disposition</CardTitle>
            <CardDescription>
              Record the outcome of this call
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" size="sm">Sale</Button>
              <Button variant="outline" size="sm">Callback</Button>
              <Button variant="outline" size="sm">Not Interested</Button>
              <Button variant="outline" size="sm">Wrong Number</Button>
              <Button variant="outline" size="sm">Voicemail</Button>
              <Button variant="outline" size="sm">Busy</Button>
              <Button variant="outline" size="sm">No Answer</Button>
              <Button variant="outline" size="sm">Do Not Call</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}