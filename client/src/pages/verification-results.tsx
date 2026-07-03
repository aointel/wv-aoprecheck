import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, Users, Phone, MessageSquare, Globe, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

// Utility function to format dates
function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Utility function to format duration
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

interface VerificationResultsData {
  overview: {
    totalSessions: number;
    completedSessions: number;
    pendingSessions: number;
    failedSessions: number;
    completionRate: number;
    englishSessions: number;
    spanishSessions: number;
  };
  trends: Array<{
    date: string;
    total: number;
    completed: number;
    completionRate: number;
  }>;
  producerPerformance: Array<{
    agentName: string;
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
  }>;
  methodBreakdown: Array<{
    method: string;
    count: number;
    percentage: number;
  }>;
  smsStats: {
    sent: number;
    approved: number;
    denied: number;
    pending: number;
  };
  taalkStats: {
    callsInitiated: number;
    callsCompleted: number;
    callsFailed: number;
    totalDuration: number;
  };
  recentSessions: Array<any>;
  timestamp: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function VerificationResults() {
  const [timeframe, setTimeframe] = useState("30d");
  
  const { data, isLoading, error, refetch } = useQuery<VerificationResultsData>({
    queryKey: ['/api/admin/verification-results', timeframe],
    queryFn: async () => {
      const response = await fetch('/api/admin/verification-results');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch verification results');
      }
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">
          {error instanceof Error ? error.message : 'You do not have permission to view verification results.'}
        </p>
        <Button onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Verification Results</h1>
            <p className="text-muted-foreground">
              Comprehensive verification session analytics and performance tracking
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => refetch()}>
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.totalSessions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +{Math.round((data.overview.completedSessions / data.overview.totalSessions) * 100)}% completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.completionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {data.overview.completedSessions} of {data.overview.totalSessions} sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMS Approvals</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.smsStats.approved}</div>
              <p className="text-xs text-muted-foreground">
                {data.smsStats.sent} SMS sent, {data.smsStats.denied} denied
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taalk Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.taalkStats.callsCompleted}</div>
              <p className="text-xs text-muted-foreground">
                {data.taalkStats.callsInitiated} initiated, {formatDuration(data.taalkStats.totalDuration)} total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Language Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Language Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    English Sessions
                    <Badge variant="outline">{data.overview.englishSessions}</Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((data.overview.englishSessions / data.overview.totalSessions) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Spanish Sessions
                    <Badge variant="outline">{data.overview.spanishSessions}</Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((data.overview.spanishSessions / data.overview.totalSessions) * 100)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.methodBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ method, percentage }) => `${method}: ${percentage}%`}
                    >
                      {data.methodBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Trends (Last 30 Days)</CardTitle>
            <CardDescription>
              Daily verification session activity and completion rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="total" fill="#8884d8" name="Total Sessions" />
                  <Bar yAxisId="left" dataKey="completed" fill="#82ca9d" name="Completed Sessions" />
                  <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#ff7300" name="Completion Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Producer Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Producer Performance</CardTitle>
            <CardDescription>
              Verification session performance by producer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.producerPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agentName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="totalSessions" fill="#8884d8" name="Total Sessions" />
                  <Bar dataKey="completedSessions" fill="#82ca9d" name="Completed Sessions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Verification Sessions</CardTitle>
            <CardDescription>
              Latest 50 verification sessions with detailed status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>producer</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>SMS Status</TableHead>
                  <TableHead>Taalk Call</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSessions.slice(0, 20).map((session) => (
                  <TableRow key={session.sessionId}>
                    <TableCell className="font-medium">
                      {session.firstName} {session.lastName}
                      {session.spouseName && (
                        <div className="text-xs text-muted-foreground">
                          Spouse: {session.spouseName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.producerFirstName} {session.producerLastName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.language === 'es' ? 'default' : 'secondary'}>
                        {session.language === 'es' ? 'Spanish' : 'English'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {session.verificationMethod || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(session.status)}>
                        {getStatusIcon(session.status)}
                        <span className="ml-1">{session.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        session.clientApprovalStatus === 'approved' ? 'default' :
                        session.clientApprovalStatus === 'denied' ? 'destructive' :
                        'secondary'
                      }>
                        {session.clientApprovalStatus || 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {session.taalkCallStatus ? (
                        <Badge variant={
                          session.taalkCallStatus === 'completed' ? 'default' :
                          session.taalkCallStatus === 'failed' ? 'destructive' :
                          'secondary'
                        }>
                          {session.taalkCallStatus}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(session.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {formatDate(data.timestamp)}
        </div>
      </div>
    </div>
  );
}