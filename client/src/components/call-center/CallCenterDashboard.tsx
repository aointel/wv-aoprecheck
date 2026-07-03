import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, 
  PhoneCall, 
  Calendar, 
  Clock, 
  Users, 
  TrendingUp, 
  Activity,
  Headphones,
  Timer,
  Target
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface CallCenterStats {
  totalCalls: number;
  completedCalls: number;
  totalConnects: number;
  totalAppointments: number;
  averageDuration: number;
  totalTalkTime: number;
  connectRate: number;
  appointmentRate: number;
}

interface ActiveCall {
  id: number;
  twilioCallSid: string;
  leadName: string;
  leadPhone: string;
  callStatus: string;
  startTime: string;
  duration?: number;
  agentName?: string;
}

interface CallCenterOverview {
  activeCalls: number;
  todayStats: CallCenterStats;
  producerStats: Array<{
    agentEmail: string;
    agentName: string;
    totalCalls: number;
    totalConnects: number;
    totalAppointments: number;
    totalTalkTime: number;
  }>;
}

export function CallCenterDashboard() {
  const [timeRange, setTimeRange] = useState('today');
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const { authState } = useAuth();
  
  // Real-time call center overview
  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['/api/call-tracking/overview'],
    refetchInterval: 3000, // Refresh every 3 seconds for real-time updates
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Call center stats for selected time range
  const { data: statsData } = useQuery({
    queryKey: ['/api/call-tracking/dashboard', timeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (timeRange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.append('dateFrom', today.toISOString());
        params.append('dateTo', new Date().toISOString());
      } else if (timeRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.append('dateFrom', weekAgo.toISOString());
        params.append('dateTo', new Date().toISOString());
      } else if (timeRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.append('dateFrom', monthAgo.toISOString());
        params.append('dateTo', new Date().toISOString());
      }
      
      const response = await fetch(`/api/call-tracking/dashboard?${params}`);
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Active calls for current producer
  const { data: activeCallsData } = useQuery({
    queryKey: ['/api/call-tracking/active', authState.user?.email],
    enabled: !!authState.user?.email,
    refetchInterval: 2000, // Refresh every 2 seconds for active calls
  });

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString: string): string => {
    return new Date(dateString).toLocaleTimeString();
  };

  const stats = statsData?.stats || {};
  const activeCalls = activeCallsData?.activeCalls || [];
  const overviewData: CallCenterOverview = overview?.overview || { 
    activeCalls: 0, 
    todayStats: {}, 
    producerStats: [] 
  };

  return (
    <div className="space-y-6">
      {/* Header with Real-time Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            Call Center Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time call tracking and Producer Performance monitoring
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-500 animate-pulse" />
            <span className="text-sm font-medium">Live</span>
          </div>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Real-time Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <Phone className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {overviewData.activeCalls}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Calls</CardTitle>
            <PhoneCall className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewData.todayStats.totalCalls || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {overviewData.todayStats.totalConnects || 0} connects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connect Rate</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(overviewData.todayStats.connectRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Today's performance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewData.todayStats.totalAppointments || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {(overviewData.todayStats.appointmentRate || 0).toFixed(1)}% rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Calls Monitor */}
      {activeCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-green-500" />
              Your Active Calls
            </CardTitle>
            <CardDescription>
              Calls currently in progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeCalls.map((call: ActiveCall) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div>
                      <div className="font-medium">
                        {call.leadName}
                      </div>
                      <div className="text-sm text-muted-foreground font-mono">
                        {call.leadPhone}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {call.callStatus.toUpperCase()}
                    </Badge>
                    
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatTime(call.startTime)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {call.duration ? formatDuration(call.duration) : 'In progress...'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Performance Metrics
            </CardTitle>
            <CardDescription>
              {timeRange === 'today' ? "Today's" : timeRange === 'week' ? "This week's" : "This month's"} calling statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalCalls || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Calls</div>
              </div>
              
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalConnects || 0}
                </div>
                <div className="text-sm text-muted-foreground">Connects</div>
              </div>
              
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {(stats.connectRate || 0).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Connect Rate</div>
              </div>
              
              <div className="text-center p-3 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.totalAppointments || 0}
                </div>
                <div className="text-sm text-muted-foreground">Appointments</div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Talk Time:
                </span>
                <span className="font-medium">
                  {formatDuration(stats.totalTalkTime || 0)}
                </span>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-muted-foreground">
                  Average Duration:
                </span>
                <span className="font-medium">
                  {formatDuration(stats.averageDuration || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Team Performance
            </CardTitle>
            <CardDescription>
              Today's Producer Leaderboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overviewData.producerStats.slice(0, 5).map((producer, index) => (
                <div
                  key={producer.agentEmail}
                  className="flex items-center justify-between p-2 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">
                        {producer.agentName || producer.agentEmail.split('@')[0]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {producer.totalCalls} calls • {producer.totalConnects} connects
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-medium text-sm">
                      {producer.totalAppointments} appts
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDuration(producer.totalTalkTime)}
                    </div>
                  </div>
                </div>
              ))}
              
              {overviewData.producerStats.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No Producer Activity today
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}