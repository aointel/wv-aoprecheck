import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Phone, Users, Target, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface InboundCall {
  id: number;
  callerPhone: string;
  incomingCallSid: string;
  routedToAgent: string | null;
  routingReason: string;
  conferenceName: string | null;
  callStatus: string;
  callStartTime: string;
  callEndTime: string | null;
  notes: string | null;
}

interface CallbackStats {
  totalActiveCalls: number;
  callbackCalls: number;
  newCallerCalls: number;
  callbackPercentage: number;
  agentSpecificCallbacks: Record<string, number>;
}

interface ActiveCallsResponse {
  success: boolean;
  activeCalls: InboundCall[];
  count: number;
  timestamp: string;
}

interface StatsResponse {
  success: boolean;
  stats: CallbackStats;
  timestamp: string;
}

export function InboundCallMonitor() {
  const { data: activeCallsData, isLoading: isLoadingCalls, refetch: refetchCalls } = useQuery<ActiveCallsResponse>({
    queryKey: ['/api/inbound-calls/active'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: statsData, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<StatsResponse>({
    queryKey: ['/api/inbound-calls/callback-stats'],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const handleRefresh = () => {
    refetchCalls();
    refetchStats();
  };

  const getRoutingReasonBadge = (reason: string) => {
    switch (reason) {
      case 'callback':
        return <Badge variant="default" className="bg-green-500">🔄 Callback</Badge>;
      case 'new_caller':
        return <Badge variant="secondary">🆕 New Caller</Badge>;
      case 'manual_assignment':
        return <Badge variant="outline">🎯 Manual</Badge>;
      default:
        return <Badge variant="secondary">{reason}</Badge>;
    }
  };

  const getCallStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-blue-500">📞 Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">✅ Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">❌ Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoadingCalls && isLoadingStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Inbound Call Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading call monitoring data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Target className="h-5 w-5" />
            Intelligent Routing Statistics
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {statsData?.stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statsData.stats.totalActiveCalls}</div>
                <div className="text-sm text-muted-foreground">Total Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statsData.stats.callbackCalls}</div>
                <div className="text-sm text-muted-foreground">Callbacks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{statsData.stats.newCallerCalls}</div>
                <div className="text-sm text-muted-foreground">New Callers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{statsData.stats.callbackPercentage}%</div>
                <div className="text-sm text-muted-foreground">Callback Rate</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">No statistics available</div>
          )}
        </CardContent>
      </Card>

      {/* Active Calls List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Active Inbound Calls ({activeCallsData?.count || 0})
          </CardTitle>
          <CardDescription>
            Real-time monitoring of inbound calls with intelligent callback routing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCallsData?.activeCalls && activeCallsData.activeCalls.length > 0 ? (
            <div className="space-y-3">
              {activeCallsData.activeCalls.map((call) => (
                <div key={call.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-blue-500" />
                      <span className="font-mono text-sm">{call.callerPhone}</span>
                      {getRoutingReasonBadge(call.routingReason)}
                      {getCallStatusBadge(call.callStatus)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(call.callStartTime), { addSuffix: true })}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Agent:</span> {call.routedToAgent || 'Unassigned'}
                    </div>
                    <div>
                      <span className="font-medium">Conference:</span> {call.conferenceName || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Call SID:</span> 
                      <span className="font-mono text-xs ml-1">{call.incomingCallSid || 'N/A'}</span>
                    </div>
                  </div>

                  {call.notes && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Notes:</span> {call.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active inbound calls</p>
              <p className="text-sm text-muted-foreground mt-1">
                When leads call back, they'll be automatically routed to their original agent
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent-Specific Callback Distribution */}
      {statsData?.stats?.agentSpecificCallbacks && Object.keys(statsData.stats.agentSpecificCallbacks).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Callback Distribution by Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(statsData.stats.agentSpecificCallbacks).map(([agent, count]) => (
                <div key={agent} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm font-medium">{agent}</span>
                  <Badge variant="outline">{count} callback{count !== 1 ? 's' : ''}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}