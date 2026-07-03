import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneCall, PhoneOff, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface TaalkCallStatusProps {
  sessionId: string;
  onCallCompleted?: (callData: any) => void;
}

interface CallStatus {
  sessionId: string;
  taalkCallId: string | null;
  status: 'not_initiated' | 'initiated' | 'ringing' | 'answered' | 'completed' | 'failed';
  initiatedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  isCallCompleted: boolean;
  isCallActive: boolean;
}

export function TaalkCallStatus({ sessionId, onCallCompleted }: TaalkCallStatusProps) {
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll for call status updates
  useEffect(() => {
    if (!sessionId) return;

    const fetchCallStatus = async () => {
      try {
        const response = await fetch(`/api/verification/session/${sessionId}/call-status`);
        if (response.ok) {
          const status = await response.json();
          setCallStatus(status);
          setError(null);
          
          // Notify parent when call completes
          if (status.isCallCompleted && onCallCompleted) {
            onCallCompleted(status);
          }
        } else {
          setError('Failed to fetch call status');
        }
      } catch (err) {
        setError('Error fetching call status');
        console.error('Call status fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchCallStatus();

    // Poll every 5 seconds for updates
    const interval = setInterval(fetchCallStatus, 5000);

    return () => clearInterval(interval);
  }, [sessionId, onCallCompleted]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_initiated':
        return <Phone className="w-4 h-4" />;
      case 'initiated':
      case 'ringing':
        return <PhoneCall className="w-4 h-4 animate-pulse text-blue-500" />;
      case 'answered':
        return <PhoneCall className="w-4 h-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <PhoneOff className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_initiated':
        return <Badge variant="secondary">Not Started</Badge>;
      case 'initiated':
        return <Badge variant="outline" className="text-blue-600">Call Initiated</Badge>;
      case 'ringing':
        return <Badge variant="outline" className="text-blue-600 animate-pulse">Ringing</Badge>;
      case 'answered':
        return <Badge variant="outline" className="text-green-600">Call Active</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-700 bg-green-50">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (loading) {
    return (
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Taalk Call Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 animate-spin" />
            <span className="text-sm text-gray-600">Loading call status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            Call Status Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!callStatus) {
    return null;
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {getStatusIcon(callStatus.status)}
          Taalk Call Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status:</span>
          {getStatusBadge(callStatus.status)}
        </div>

        {callStatus.taalkCallId && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Call ID:</span>
            <span className="text-sm text-gray-600 font-mono">{callStatus.taalkCallId}</span>
          </div>
        )}

        {callStatus.initiatedAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Initiated:</span>
            <span className="text-sm text-gray-600">{formatTimestamp(callStatus.initiatedAt)}</span>
          </div>
        )}

        {callStatus.completedAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Completed:</span>
            <span className="text-sm text-gray-600">{formatTimestamp(callStatus.completedAt)}</span>
          </div>
        )}

        {callStatus.duration !== null && callStatus.duration > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Duration:</span>
            <span className="text-sm text-gray-600">{formatDuration(callStatus.duration)}</span>
          </div>
        )}

        {/* Live status indicators */}
        {callStatus.isCallActive && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-700 font-medium">Call is currently active</span>
            </div>
          </div>
        )}

        {callStatus.isCallCompleted && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">
                🎉 Call completed successfully!
              </span>
            </div>
            {callStatus.duration && (
              <p className="text-xs text-blue-600 mt-1">
                Total call time: {formatDuration(callStatus.duration)}
              </p>
            )}
          </div>
        )}

        {callStatus.status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <PhoneOff className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Call failed</span>
            </div>
            <p className="text-xs text-red-600 mt-1">
              Please try initiating the call again or contact support.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}