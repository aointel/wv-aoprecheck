import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { segmentedFetch } from '@/lib/queryClient';
import { 
  Phone, 
  Users, 
  Calendar, 
  Clock,
  Activity,
  TrendingUp
} from 'lucide-react';

interface DailyStats {
  total_dialed: number;
  reached: number;
  booked: number;
  timestamp: string;
}

interface LiveCallTrackerProps {
  userEmail?: string;
}

export function LiveCallTracker({ userEmail }: LiveCallTrackerProps) {
  // Fetch SYSTEM-WIDE live daily stats with frequent updates - ALL USERS
  const { data: stats, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['/api/outbound-dialer/system-wide-stats'],
    queryFn: async (): Promise<DailyStats> => {
      const response = await segmentedFetch('/api/outbound-dialer/system-wide-stats');
      if (!response.ok) throw new Error('Failed to fetch system-wide daily stats');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
    enabled: true, // Always enabled to show system-wide stats
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const calculateContactRate = (reached: number, dialed: number) => {
    if (dialed === 0) return 0;
    return Math.round((reached / dialed) * 100);
  };

  const calculateBookingRate = (booked: number, reached: number) => {
    if (reached === 0) return 0;
    return Math.round((booked / reached) * 100);
  };

  return (
    <Card className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white border-slate-600">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Phone className="h-5 w-5" />
          System-Wide Call Tracker
          <Badge variant="secondary" className="ml-2 text-xs">
            ALL USERS
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Scrolling ticker format */}
        <div className="overflow-hidden whitespace-nowrap">
          <div className="inline-block animate-pulse">
            <span className="text-sm font-semibold">
              📞 Dialed: {isLoading ? '--' : stats?.total_dialed || 0}
              {' • '}
              🎯 Reached: {isLoading ? '--' : stats?.reached || 0}
              {' • '}
              📅 Booked: {isLoading ? '--' : stats?.booked || 0}
              {stats && (
                <>
                  {' • '}
                  Contact Rate: {calculateContactRate(stats.reached, stats.total_dialed)}%
                  {' • '}
                  Booking Rate: {calculateBookingRate(stats.booked, stats.reached)}%
                </>
              )}
            </span>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center justify-center mt-3 text-xs opacity-80">
          <div className={`w-2 h-2 rounded-full mr-2 ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          Last updated: {stats ? formatTime(stats.timestamp) : '--'}
        </div>
      </CardContent>
    </Card>
  );
}