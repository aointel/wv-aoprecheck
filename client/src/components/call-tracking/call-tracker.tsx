import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Phone, Play, Square, DollarSign } from 'lucide-react';
import { useCallTracking } from '@/hooks/use-call-tracking';

interface CallTrackerProps {
  className?: string;
}

export function CallTracker({ className }: CallTrackerProps) {
  const { callTracking, startCallTracking, endCallTracking } = useCallTracking();
  const [localDuration, setLocalDuration] = useState(0);

  // Update local duration every second when tracking
  useEffect(() => {
    if (!callTracking.isTracking) return;

    const interval = setInterval(() => {
      if (callTracking.startTime) {
        const elapsed = Math.floor((Date.now() - callTracking.startTime.getTime()) / 1000);
        setLocalDuration(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [callTracking.isTracking, callTracking.startTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedCost = Math.ceil(localDuration / 60) * 0.10; // $0.10 per minute

  if (!callTracking.isTracking) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Call Tracking</span>
            </div>
            <Badge variant="outline" className="text-xs">
              Ready
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
            <span>Call in Progress</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={endCallTracking}
            className="ml-auto h-6 px-2"
          >
            <Square className="h-3 w-3 mr-1" />
            End
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm">Duration</span>
          </div>
          <Badge variant="secondary" className="font-mono">
            {formatDuration(localDuration)}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-sm">Est. Cost</span>
          </div>
          <span className="text-sm font-medium text-green-600">
            ${estimatedCost.toFixed(2)}
          </span>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Rate: $0.10/minute • ID: {callTracking.trackingId?.slice(-8)}
        </div>
      </CardContent>
    </Card>
  );
}

// Lightweight version for integration into existing interfaces
export function CallTrackingBadge() {
  const { callTracking } = useCallTracking();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!callTracking.isTracking) return;

    const interval = setInterval(() => {
      if (callTracking.startTime) {
        const elapsed = Math.floor((Date.now() - callTracking.startTime.getTime()) / 1000);
        setDuration(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [callTracking.isTracking, callTracking.startTime]);

  if (!callTracking.isTracking) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Badge variant="destructive" className="animate-pulse">
      <div className="h-1.5 w-1.5 bg-white rounded-full mr-1" />
      {formatTime(duration)}
    </Badge>
  );
}