import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  User,
  MessageCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface CallStatus {
  sessionId: string;
  taalkCallId: string | null;
  status: string;
  initiatedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  isCallCompleted: boolean;
  isCallActive: boolean;
}

interface CallStatusDisplayProps {
  sessionId: string;
  onCallCompleted?: () => void;
  onCallFailed?: () => void;
}

const CallStatusDisplay: React.FC<CallStatusDisplayProps> = ({
  sessionId,
  onCallCompleted,
  onCallFailed
}) => {
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callDurationRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch call status
  const fetchCallStatus = async () => {
    try {
      const response = await fetch(`/api/verification/session/${sessionId}/call-status`);
      if (response.ok) {
        const status = await response.json();
        setCallStatus(status);
        setLastUpdate(new Date());
        setError(null);
        
        // Handle call completion
        if (status.isCallCompleted && onCallCompleted) {
          onCallCompleted();
        }
        
        // Handle call failure
        if (status.status === 'failed' && onCallFailed) {
          onCallFailed();
        }
      } else {
        throw new Error('Failed to fetch call status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      console.error('Error fetching call status:', err);
    }
  };

  // Start polling for call status
  const startPolling = () => {
    setIsPolling(true);
    fetchCallStatus(); // Initial fetch
    
    // Poll every 3 seconds
    pollIntervalRef.current = setInterval(fetchCallStatus, 3000);
  };

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCallStatus();
    setIsRefreshing(false);
  };

  // Start call duration timer when call is active
  useEffect(() => {
    if (callStatus?.isCallActive && !callDurationRef.current) {
      callDurationRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (!callStatus?.isCallActive && callDurationRef.current) {
      clearInterval(callDurationRef.current);
      callDurationRef.current = null;
    }
  }, [callStatus?.isCallActive]);

  // Start polling when component mounts
  useEffect(() => {
    startPolling();
    
    return () => {
      stopPolling();
      if (callDurationRef.current) {
        clearInterval(callDurationRef.current);
      }
    };
  }, [sessionId]);

  // Get status icon and color
  const getStatusDisplay = () => {
    if (!callStatus) return { icon: Phone, color: 'text-gray-400', bg: 'bg-gray-100' };
    
    switch (callStatus.status) {
      case 'initiated':
        return { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'ringing':
        return { icon: PhoneCall, color: 'text-yellow-600', bg: 'bg-yellow-100' };
      case 'answered':
        return { icon: PhoneCall, color: 'text-green-600', bg: 'bg-green-100' };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
      case 'failed':
        return { icon: PhoneOff, color: 'text-red-600', bg: 'bg-red-100' };
      default:
        return { icon: Phone, color: 'text-gray-400', bg: 'bg-gray-100' };
    }
  };

  // Get status text
  const getStatusText = () => {
    if (!callStatus) return 'Unknown';
    
    switch (callStatus.status) {
      case 'initiated': return 'Call Initiated';
      case 'ringing': return 'Ringing...';
      case 'answered': return 'Call Active';
      case 'completed': return 'Call Completed';
      case 'failed': return 'Call Failed';
      default: return 'Unknown Status';
    }
  };

  // Get progress percentage
  const getProgressPercentage = () => {
    if (!callStatus) return 0;
    
    switch (callStatus.status) {
      case 'initiated': return 25;
      case 'ringing': return 50;
      case 'answered': return 75;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  if (!callStatus) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading call status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <StatusIcon className={`w-5 h-5 ${statusDisplay.color}`} />
            <span>Verification Call Status</span>
          </span>
          <div className="flex items-center space-x-2">
            <Badge variant={callStatus.isCallActive ? "default" : "secondary"}>
              {callStatus.isCallActive ? "LIVE" : "STATIC"}
            </Badge>
            {isPolling && (
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Wifi className="w-3 h-3" />
                <span>Live</span>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg ${statusDisplay.bg} border`}>
            <div className="flex items-center space-x-2">
              <StatusIcon className={`w-5 h-5 ${statusDisplay.color}`} />
              <div>
                <p className="text-sm font-medium text-gray-700">Status</p>
                <p className={`text-lg font-semibold ${statusDisplay.color}`}>
                  {getStatusText()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-gray-50 border">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Duration</p>
                <p className="text-lg font-semibold text-gray-900">
                  {callStatus.duration ? 
                    `${Math.floor(callStatus.duration / 60)}:${(callStatus.duration % 60).toString().padStart(2, '0')}` :
                    callStatus.isCallActive ?
                    `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, '0')}` :
                    '--:--'
                  }
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-gray-50 border">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">Call ID</p>
                <p className="text-sm font-mono text-gray-900 truncate">
                  {callStatus.taalkCallId || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Call Progress</span>
            <span className="text-gray-500">{getProgressPercentage()}%</span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Initiated</span>
            <span>Ringing</span>
            <span>Active</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Call Timeline */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Call Timeline</h4>
          <div className="space-y-2">
            {callStatus.initiatedAt && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">Call initiated</span>
                <span className="text-gray-400 text-xs">
                  {new Date(callStatus.initiatedAt).toLocaleTimeString()}
                </span>
              </div>
            )}
            
            {callStatus.status === 'ringing' && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600">Call ringing...</span>
                <span className="text-gray-400 text-xs">Now</span>
              </div>
            )}
            
            {callStatus.status === 'answered' && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Call answered</span>
                <span className="text-gray-400 text-xs">Now</span>
              </div>
            )}
            
            {callStatus.completedAt && (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-gray-600">Call completed</span>
                <span className="text-gray-400 text-xs">
                  {new Date(callStatus.completedAt).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* producer Controls */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>Last updated:</span>
            <span className="font-mono">
              {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={isPolling ? stopPolling : startPolling}
              className={`flex items-center space-x-2 ${
                isPolling ? 'bg-green-50 border-green-200 text-green-700' : ''
              }`}
            >
              {isPolling ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>{isPolling ? 'Live' : 'Manual'}</span>
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CallStatusDisplay;
