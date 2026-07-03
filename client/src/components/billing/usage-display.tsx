import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Phone, Video, CreditCard, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';

interface UsageData {
  totalMinutes: number;
  callMinutes: number;
  videoMinutes: number;
  creditsUsed: number;
  estimatedCost: number;
  billingRate: number;
}

export function UsageDisplay() {
  const { authState } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      if (!authState.user?.email) return;
      
      try {
        setLoading(true);
        const response = await apiRequest('GET', `/api/billing/current-usage/${authState.user.email}`, {});
        setUsage(response);
      } catch (error) {
        console.error('❌ Failed to fetch usage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [authState.user?.email]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Usage Data Unavailable
          </CardTitle>
          <CardDescription>
            Unable to load current usage statistics
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const costColor = usage.estimatedCost > 10 ? 'text-red-600' : usage.estimatedCost > 5 ? 'text-yellow-600' : 'text-green-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          This Month's Usage
        </CardTitle>
        <CardDescription>
          Real-time minute tracking and billing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">Voice Calls</div>
              <div className="text-lg font-bold">{formatMinutes(usage.callMinutes)}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-purple-500" />
            <div>
              <div className="text-sm font-medium">Video Meetings</div>
              <div className="text-lg font-bold">{formatMinutes(usage.videoMinutes)}</div>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Total Usage</span>
            </div>
            <Badge variant="outline">
              {formatMinutes(usage.totalMinutes)}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">Credits Used</span>
            <span className="text-sm font-medium">{usage.creditsUsed}</span>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-gray-600">Estimated Cost</span>
            <span className={`text-sm font-bold ${costColor}`}>
              ${usage.estimatedCost.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Rate: ${usage.billingRate?.toFixed(2) || '0.10'} per minute
        </div>
      </CardContent>
    </Card>
  );
}