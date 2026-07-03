import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Phone, TrendingUp, DollarSign, Calendar, PhoneCall, Filter } from 'lucide-react';

interface WeeklyUsageStats {
  agent_email: string;
  week_start_date: string;
  total_logins: number;
  unique_login_days: number;
  total_online_minutes: number;
  vdp_connects_received: number;
  vdp_available_minutes: number; // Time waiting for calls
  vdp_call_minutes: number; // Time actively on calls
  vdp_total_minutes: number; // Total VDP time (available + on calls)
  total_dials_made: number;
  total_call_minutes: number;
  appointments_scheduled: number;
  sales_made: number;
  total_alp: number;
}

export default function UsageReport() {
  // Filter for active agents only (default: true - show only agents with usage)
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['weekly-usage-stats-all'],
    queryFn: async () => {
      console.log('📊 Fetching weekly usage stats...');
      const response = await fetch('/api/usage/weekly-stats-all');
      console.log('📊 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch usage stats:', errorText);
        throw new Error('Failed to fetch usage stats');
      }
      
      const result = await response.json();
      console.log('📊 Usage stats result:', result);
      console.log('📊 Number of agents with data:', result.stats?.length || 0);
      
      return result.stats as WeeklyUsageStats[];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  console.log('📊 UsageReport render - isLoading:', isLoading, 'error:', error, 'stats count:', stats?.length || 0);

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getActivityBadge = (logins: number) => {
    if (logins >= 5) return <Badge className="bg-green-500">High Activity</Badge>;
    if (logins >= 3) return <Badge className="bg-yellow-500">Moderate</Badge>;
    return <Badge className="bg-red-500">Low Activity</Badge>;
  };

  // Filter to active agents only (agents with any usage)
  const isAgentActive = (stat: WeeklyUsageStats): boolean => {
    return (
      stat.total_logins > 0 ||
      stat.vdp_total_minutes > 0 ||
      stat.total_dials_made > 0 ||
      stat.appointments_scheduled > 0 ||
      stat.sales_made > 0 ||
      stat.total_online_minutes > 0
    );
  };

  // Apply active filter if enabled
  const filteredStats = showActiveOnly 
    ? stats?.filter(isAgentActive) || []
    : stats || [];

  // Calculate totals from filtered stats
  const totals = filteredStats.length > 0 ? filteredStats.reduce(
    (acc, stat) => ({
      total_logins: acc.total_logins + stat.total_logins,
      unique_login_days: acc.unique_login_days + stat.unique_login_days,
      total_online_minutes: acc.total_online_minutes + stat.total_online_minutes,
      vdp_connects_received: acc.vdp_connects_received + stat.vdp_connects_received,
      vdp_available_minutes: acc.vdp_available_minutes + (stat.vdp_available_minutes || 0),
      vdp_call_minutes: acc.vdp_call_minutes + (stat.vdp_call_minutes || 0),
      vdp_total_minutes: acc.vdp_total_minutes + stat.vdp_total_minutes,
      total_dials_made: acc.total_dials_made + stat.total_dials_made,
      total_call_minutes: acc.total_call_minutes + stat.total_call_minutes,
      appointments_scheduled: acc.appointments_scheduled + stat.appointments_scheduled,
      sales_made: acc.sales_made + stat.sales_made,
      total_alp: acc.total_alp + stat.total_alp,
    }),
    {
      total_logins: 0,
      unique_login_days: 0,
      total_online_minutes: 0,
      vdp_connects_received: 0,
      vdp_available_minutes: 0,
      vdp_call_minutes: 0,
      vdp_total_minutes: 0,
      total_dials_made: 0,
      total_call_minutes: 0,
      appointments_scheduled: 0,
      sales_made: 0,
      total_alp: 0,
    }
  ) : {
      total_logins: 0,
      unique_login_days: 0,
      total_online_minutes: 0,
      vdp_connects_received: 0,
      vdp_available_minutes: 0,
      vdp_call_minutes: 0,
      vdp_total_minutes: 0,
      total_dials_made: 0,
      total_call_minutes: 0,
      appointments_scheduled: 0,
      sales_made: 0,
      total_alp: 0,
    };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-gray-500">Loading usage stats...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Usage Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weekly Usage Report</h1>
          <p className="text-gray-600 mt-1">Agent activity and performance metrics for the current week</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showActiveOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            {showActiveOnly ? 'Active Agents Only' : 'All Agents'}
          </Button>
          {showActiveOnly && (
            <span className="text-sm text-gray-500">
              Showing {filteredStats.length} of {stats?.length || 0} agents
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Online Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totals?.total_online_minutes || 0)}</div>
            <p className="text-xs text-gray-500">{filteredStats.length} {showActiveOnly ? 'active' : ''} agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <PhoneCall className="w-4 h-4" />
              VDP Connects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.vdp_connects_received || 0}</div>
            <p className="text-xs text-gray-500">{formatHours(totals?.vdp_total_minutes || 0)} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              VDP Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totals?.vdp_available_minutes || 0)}</div>
            <p className="text-xs text-gray-500">waiting for calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              VDP On Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totals?.vdp_call_minutes || 0)}</div>
            <p className="text-xs text-gray-500">actively on calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Outbound Dials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.total_dials_made || 0}</div>
            <p className="text-xs text-gray-500">{formatHours(totals?.total_call_minutes || 0)} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.appointments_scheduled || 0}</div>
            <p className="text-xs text-gray-500">scheduled this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Sales / ALP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.sales_made || 0}</div>
            <p className="text-xs text-gray-500">{formatCurrency(totals?.total_alp || 0)} ALP</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Usage Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-center">Activity</TableHead>
                <TableHead className="text-center">Logins</TableHead>
                <TableHead className="text-center">Days Active</TableHead>
                <TableHead className="text-center">Online Time</TableHead>
                <TableHead className="text-center">VDP Connects</TableHead>
                <TableHead className="text-center">VDP Available</TableHead>
                <TableHead className="text-center">VDP On Calls</TableHead>
                <TableHead className="text-center">VDP Total</TableHead>
                <TableHead className="text-center">Dials</TableHead>
                <TableHead className="text-center">Call Time</TableHead>
                <TableHead className="text-center">Appointments</TableHead>
                <TableHead className="text-center">Sales</TableHead>
                <TableHead className="text-center">ALP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats && filteredStats.length > 0 ? (
                filteredStats
                  .sort((a, b) => b.total_logins - a.total_logins)
                  .map((stat) => (
                    <TableRow key={stat.agent_email}>
                      <TableCell className="font-medium">{stat.agent_email}</TableCell>
                      <TableCell className="text-center">{getActivityBadge(stat.total_logins)}</TableCell>
                      <TableCell className="text-center">{stat.total_logins}</TableCell>
                      <TableCell className="text-center">{stat.unique_login_days}/7</TableCell>
                      <TableCell className="text-center">{formatHours(stat.total_online_minutes)}</TableCell>
                      <TableCell className="text-center">{stat.vdp_connects_received}</TableCell>
                      <TableCell className="text-center">{formatHours(stat.vdp_available_minutes || 0)}</TableCell>
                      <TableCell className="text-center">{formatHours(stat.vdp_call_minutes || 0)}</TableCell>
                      <TableCell className="text-center">{formatHours(stat.vdp_total_minutes || 0)}</TableCell>
                      <TableCell className="text-center">{stat.total_dials_made}</TableCell>
                      <TableCell className="text-center">{formatHours(stat.total_call_minutes)}</TableCell>
                      <TableCell className="text-center">{stat.appointments_scheduled}</TableCell>
                      <TableCell className="text-center">{stat.sales_made}</TableCell>
                      <TableCell className="text-center">{formatCurrency(stat.total_alp)}</TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={14} className="text-center text-gray-500 py-8">
                    No usage data available for this week
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

