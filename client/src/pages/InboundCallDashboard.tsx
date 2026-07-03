import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Phone, Users, Clock, Activity, TrendingUp, PhoneCall, UserCheck, UserX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface InboundCall {
  id: string;
  callerPhone: string;
  incomingCallSid: string;
  routedToAgent: string | null;
  routingReason: string;
  conferenceName: string | null;
  callStatus: string;
  callStartTime: string;
  callEndTime: string | null;
  waitTimeSeconds?: number;
  waitTimeFormatted?: string;
  notes: string | null;
}

interface QueueStats {
  waitingCount: number;
  averageWaitTimeSeconds: number;
  averageWaitTimeFormatted: string;
  longestWaitTimeSeconds: number;
  longestWaitTimeFormatted: string;
  totalCallsToday: number;
  queuePosition: number;
}

interface AgentAvailability {
  email: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  availabilityReason?: string;
  isVDPOnline: boolean;
  isCCActive: boolean;
  currentCall: {
    type: 'inbound' | 'outbound';
    phoneNumber: string;
    leadName?: string;
    startTime: string;
    duration: number;
  } | null;
  debug?: {
    hasHeartbeat: boolean;
    hasActiveCall: boolean;
    callStatuses: string[];
    hasTwilioCalls: boolean;
  };
}

interface ActiveCallsResponse {
  success: boolean;
  activeCalls: InboundCall[];
  waitingCalls: InboundCall[];
  answeredCalls: InboundCall[];
  count: number;
  waitingCount: number;
  answeredCount: number;
  timestamp: string;
}

interface QueueStatsResponse {
  success: boolean;
  queueStats: QueueStats;
  timestamp: string;
}

interface AgentAvailabilityResponse {
  success: boolean;
  agents: AgentAvailability[];
  summary: {
    total: number;
    available: number;
    busy: number;
    offline: number;
  };
  timestamp: string;
}

interface CallbackStatsResponse {
  success: boolean;
  stats: {
    totalActiveCalls: number;
    callbackCalls: number;
    newCallerCalls: number;
    callbackPercentage: number;
    agentSpecificCallbacks: Record<string, number>;
  };
  timestamp: string;
}

export default function InboundCallDashboard() {
  const { data: activeCallsData, isLoading: isLoadingCalls, refetch: refetchCalls } = useQuery<ActiveCallsResponse>({
    queryKey: ['/api/inbound-calls/active'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: queueStatsData, isLoading: isLoadingQueue, refetch: refetchQueue } = useQuery<QueueStatsResponse>({
    queryKey: ['/api/inbound-calls/queue-stats'],
    refetchInterval: 5000,
  });

  const { data: agentAvailabilityData, isLoading: isLoadingAgents, error: agentError, refetch: refetchAgents } = useQuery<AgentAvailabilityResponse>({
    queryKey: ['/api/inbound-calls/agent-availability'],
    refetchInterval: 5000,
    retry: 2,
  });

  const { data: callbackStatsData, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<CallbackStatsResponse>({
    queryKey: ['/api/inbound-calls/callback-stats'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleRefresh = () => {
    refetchCalls();
    refetchQueue();
    refetchAgents();
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
      case 'ringing':
      case 'incoming':
        return <Badge variant="default" className="bg-yellow-500">⏳ Waiting</Badge>;
      case 'answered':
      case 'connected':
        return <Badge variant="default" className="bg-blue-500">📞 Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">✅ Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">❌ Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAgentStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-green-500">Available</Badge>;
      case 'busy':
        return <Badge variant="default" className="bg-red-500">Busy</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (isLoadingCalls && isLoadingQueue && isLoadingAgents && isLoadingStats) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Inbound Call Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading dashboard data...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PhoneCall className="h-8 w-8" />
            Inbound Call Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of inbound calls, queues, and agent availability
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStatsData?.queueStats.totalCallsToday || 0}</div>
            <p className="text-xs text-muted-foreground">Inbound calls received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waiting in Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {activeCallsData?.waitingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg wait: {queueStatsData?.queueStats.averageWaitTimeFormatted || '0s'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activeCallsData?.answeredCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {agentAvailabilityData?.summary.available || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {agentAvailabilityData?.summary.busy || 0} busy, {agentAvailabilityData?.summary.offline || 0} offline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Call Queue ({activeCallsData?.waitingCount || 0} waiting)
          </CardTitle>
          <CardDescription>
            Calls waiting to be answered, sorted by wait time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCallsData?.waitingCalls && activeCallsData.waitingCalls.length > 0 ? (
            <div className="space-y-3">
              {activeCallsData.waitingCalls
                .sort((a, b) => (b.waitTimeSeconds || 0) - (a.waitTimeSeconds || 0))
                .map((call) => (
                  <div key={call.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-yellow-500" />
                        <span className="font-mono text-sm font-semibold">{call.callerPhone}</span>
                        {getRoutingReasonBadge(call.routingReason)}
                        {getCallStatusBadge(call.callStatus)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-yellow-600">
                          {call.waitTimeFormatted || '0s'}
                        </span>
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
                        <span className="font-medium">Started:</span>{' '}
                        {call.callStartTime
                          ? formatDistanceToNow(new Date(call.callStartTime), { addSuffix: true })
                          : 'N/A'}
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
              <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No calls waiting in queue</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Calls Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Active Calls ({activeCallsData?.answeredCount || 0})
          </CardTitle>
          <CardDescription>
            Currently connected inbound calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCallsData?.answeredCalls && activeCallsData.answeredCalls.length > 0 ? (
            <div className="space-y-3">
              {activeCallsData.answeredCalls.map((call) => (
                <div key={call.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-blue-500" />
                      <span className="font-mono text-sm font-semibold">{call.callerPhone}</span>
                      {getRoutingReasonBadge(call.routingReason)}
                      {getCallStatusBadge(call.callStatus)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {call.callStartTime
                        ? formatDistanceToNow(new Date(call.callStartTime), { addSuffix: true })
                        : 'N/A'}
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
                      <span className="font-medium">Duration:</span>{' '}
                      {call.callDuration ? formatDuration(call.callDuration) : 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active calls</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Availability Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Agent Availability ({agentAvailabilityData?.summary?.total || 0} agents)
          </CardTitle>
          <CardDescription>
            Real-time agent status and availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agentError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <strong>Error loading agents:</strong> {agentError instanceof Error ? agentError.message : 'Unknown error'}
              <br />
              <span className="text-xs">Check server logs for details</span>
            </div>
          )}
          {agentAvailabilityData?.agents && agentAvailabilityData.agents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Agent</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">VDP</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">CC Pro</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Current Call</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                  {agentAvailabilityData.agents.map((agent) => (
                    <tr key={agent.email} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {agent.status === 'available' ? (
                            <UserCheck className="h-4 w-4 text-green-500" />
                          ) : agent.status === 'busy' ? (
                            <UserX className="h-4 w-4 text-red-500" />
                          ) : (
                            <Users className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{agent.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{agent.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {getAgentStatusBadge(agent.status)}
                          {agent.availabilityReason && (
                            <span className="text-xs text-muted-foreground text-center max-w-[150px]">
                              {agent.availabilityReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Badge variant={agent.isVDPOnline ? 'default' : 'secondary'} className="text-xs">
                          {agent.isVDPOnline ? 'Online' : 'Offline'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Badge variant={agent.isCCActive ? 'default' : 'secondary'} className="text-xs">
                          {agent.isCCActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {agent.currentCall ? (
                          <div className="text-sm">
                            <div className="font-medium text-blue-600">
                              {agent.currentCall.type === 'inbound' ? 'Inbound' : 'Outbound'} Call
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {agent.currentCall.leadName || agent.currentCall.phoneNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Duration: {formatDuration(agent.currentCall.duration)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No active call</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !isLoadingAgents ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No agents found</p>
              <p className="text-xs text-muted-foreground mt-2">
                Agents making outbound calls via Call Connector Pro should appear here
              </p>
              {agentAvailabilityData && (
                <div className="mt-4 text-xs text-muted-foreground">
                  <p>Response received: {agentAvailabilityData.success ? '✅' : '❌'}</p>
                  <p>Agents array length: {agentAvailabilityData.agents?.length || 0}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading agents...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Callback Statistics */}
      {callbackStatsData?.stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Callback Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {callbackStatsData.stats.totalActiveCalls}
                </div>
                <div className="text-sm text-muted-foreground">Total Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {callbackStatsData.stats.callbackCalls}
                </div>
                <div className="text-sm text-muted-foreground">Callbacks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {callbackStatsData.stats.newCallerCalls}
                </div>
                <div className="text-sm text-muted-foreground">New Callers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {callbackStatsData.stats.callbackPercentage}%
                </div>
                <div className="text-sm text-muted-foreground">Callback Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
