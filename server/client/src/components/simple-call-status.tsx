import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SimpleCallStatusProps {
  sessionId: string;
  clientName: string;
  onCallComplete: () => void;
}

export function SimpleCallStatus({ sessionId, clientName, onCallComplete }: SimpleCallStatusProps) {
  const [callStatus, setCallStatus] = useState<'waiting' | 'connected' | 'ended'>('waiting');
  const [callDuration, setCallDuration] = useState(0);
  const { toast } = useToast();
  
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Poll for active calls every 2 seconds
    const pollForCalls = setInterval(async () => {
      try {
        const response = await fetch(`/api/call-status`);
        if (response.ok) {
          const data = await response.json();
          console.log('Call status response:', data);
          
          if (data.callActive && callStatus === 'waiting') {
            setCallStatus('connected');
            startCallTimer();
            toast({
              title: "Call Connected",
              description: "Incoming call detected - conference active",
            });
          } else if (!data.callActive && callStatus === 'connected') {
            setCallStatus('waiting');
            if (callTimerRef.current) {
              clearInterval(callTimerRef.current);
              callTimerRef.current = null;
            }
            setCallDuration(0);
            toast({
              title: "Call Ended",
              description: "Conference call completed",
            });
          }
        }
      } catch (error) {
        console.warn('Call status polling error:', error);
      }
    }, 2000);

    return () => {
      clearInterval(pollForCalls);
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus, sessionId]);

  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMarkComplete = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    onCallComplete();
    toast({
      title: "Verification Complete",
      description: "Call verification marked as complete.",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Phone className="w-5 h-5" />
          Auto-Answer System
        </CardTitle>
        <p className="text-sm text-gray-600">Phone: +16052500834</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Call Status */}
        <div className="text-center">
          {callStatus === 'waiting' && (
            <div className="space-y-2">
              <Badge variant="outline" className="animate-pulse">Waiting for Call...</Badge>
              <p className="text-sm text-gray-500">System ready to auto-answer</p>
            </div>
          )}
          {callStatus === 'connected' && (
            <div className="space-y-2">
              <Badge variant="default" className="bg-green-500">Call Active</Badge>
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                <p className="text-lg font-mono">{formatDuration(callDuration)}</p>
              </div>
            </div>
          )}
          {callStatus === 'ended' && (
            <Badge variant="destructive">Call Ended</Badge>
          )}
        </div>

        {/* Waiting State */}
        {callStatus === 'waiting' && (
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <h4 className="font-semibold text-blue-900 mb-2">Ready for Calls</h4>
            <p className="text-sm text-blue-800">
              Taalk can call <strong>+16052500834</strong> anytime.<br/>
              Calls will be answered automatically.
            </p>
          </div>
        )}

        {/* Connected State */}
        {callStatus === 'connected' && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <h4 className="font-semibold text-green-900 mb-2">Call Active</h4>
              <p className="text-sm text-green-800">
                Verification call with {clientName} is active.<br/>
                System automatically handles conference connection.
              </p>
            </div>
            
            <Button 
              onClick={handleMarkComplete}
              className="w-full"
              variant="default"
            >
              Mark Verification Complete
            </Button>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 text-center mt-4">
          <p>No manual setup required - system handles everything automatically</p>
        </div>
      </CardContent>
    </Card>
  );
}