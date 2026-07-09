import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, TrendingUp, TrendingDown, Users, Phone, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

// Utility function to format producer names with proper capitalization
function formatAgentName(name: string): string {
  if (!name) return 'Unknown Producer';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Utility function to format client names with proper capitalization
function formatClientName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface AnalyticsData {
  overview: {
    totalCalls: number;
    completedCalls: number;
    completionRate: number;
    avgCallDuration: string;
    topAgent: string;
    topOffice: string;
  };
  trends: Array<{
    date: string;
    calls: number;
    completed: number;
    completionRate: number;
  }>;
  agentPerformance: Array<{
    agentName: string;
    totalCalls: number;
    completedCalls: number;
    completionRate: number;
    avgDuration: string;
  }>;
  officePerformance: Array<{
    office: string;
    totalCalls: number;
    completedCalls: number;
    completionRate: number;
  }>;
  callStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  transcriptionQuality: {
    withTranscription: number;
    withoutTranscription: number;
    spanishCalls: number;
    averageCallLength: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const [selectedOffice, setSelectedOffice] = useState("all");

  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', timeRange, selectedOffice],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeRange,
        office: selectedOffice
      });
      const response = await fetch(`/api/analytics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    }
  });

  const { data: offices } = useQuery({
    queryKey: ['/api/offices'],
    queryFn: async () => {
      const response = await fetch('/api/offices');
      if (!response.ok) throw new Error('Failed to fetch offices');
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-500">No analytics data available</div>
      </div>
    );
  }

  // Format agent names in the analytics data
  const formattedAnalyticsData = {
    ...analyticsData,
    agentPerformance: analyticsData.agentPerformance.map(agent => ({
      ...agent,
      agentName: formatAgentName(agent.agentName)
    }))
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Call Analytics</h1>
          <p className="text-gray-600 mt-1">Verification call trends and performance metrics</p>
        </div>
        
        <div className="flex gap-3">
          <Select value={selectedOffice} onValueChange={setSelectedOffice}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Office" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offices</SelectItem>
              {offices?.map((office: any) => (
                <SelectItem key={office.id} value={office.name}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedAnalyticsData.overview.totalCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Verification calls recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedAnalyticsData.overview.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {formattedAnalyticsData.overview.completedCalls} of {formattedAnalyticsData.overview.totalCalls} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedAnalyticsData.overview.avgCallDuration}</div>
            <p className="text-xs text-muted-foreground">
              Average call length
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Producer</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAgentName(formattedAnalyticsData.overview.topAgent)}</div>
            <p className="text-xs text-muted-foreground">
              Highest completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Call Volume Trends</CardTitle>
            <CardDescription>Daily verification call volume and completion rates</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="calls" stroke="#8884d8" name="Total Calls" />
                <Line type="monotone" dataKey="completed" stroke="#82ca9d" name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Call Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Call Status Distribution</CardTitle>
            <CardDescription>Breakdown of call completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.callStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analyticsData.callStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Producer Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Producer Performance</CardTitle>
          <CardDescription>Individual producer metrics and completion rates</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={formattedAnalyticsData.agentPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agentName" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalCalls" fill="#8884d8" name="Total Calls" />
              <Bar dataKey="completedCalls" fill="#82ca9d" name="Completed Calls" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Office Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Office Performance</CardTitle>
          <CardDescription>Performance metrics by office location</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Office</th>
                  <th className="text-right p-2">Total Calls</th>
                  <th className="text-right p-2">Completed</th>
                  <th className="text-right p-2">Completion Rate</th>
                  <th className="text-right p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {formattedAnalyticsData.officePerformance.map((office, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 font-medium">{office.office}</td>
                    <td className="text-right p-2">{office.totalCalls}</td>
                    <td className="text-right p-2">{office.completedCalls}</td>
                    <td className="text-right p-2">{office.completionRate.toFixed(1)}%</td>
                    <td className="text-right p-2">
                      <Badge variant={office.completionRate >= 80 ? "default" : office.completionRate >= 60 ? "secondary" : "destructive"}>
                        {office.completionRate >= 80 ? "Excellent" : office.completionRate >= 60 ? "Good" : "Needs Improvement"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Producer Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Producer Performance</CardTitle>
          <CardDescription>Performance metrics by individual producer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Producer</th>
                  <th className="text-left p-2">Office</th>
                  <th className="text-right p-2">Total Calls</th>
                  <th className="text-right p-2">Completed</th>
                  <th className="text-right p-2">Completion Rate</th>
                  <th className="text-right p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {formattedAnalyticsData.agentPerformance.map((producer, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2 font-medium">{formatAgentName(producer.agentName)}</td>
                    <td className="p-2 text-gray-600">{producer.office}</td>
                    <td className="text-right p-2">{producer.totalCalls}</td>
                    <td className="text-right p-2">{producer.completedCalls}</td>
                    <td className="text-right p-2">{producer.completionRate.toFixed(1)}%</td>
                    <td className="text-right p-2">
                      <Badge variant={producer.completionRate >= 80 ? "default" : producer.completionRate >= 60 ? "secondary" : "destructive"}>
                        {producer.completionRate >= 80 ? "Excellent" : producer.completionRate >= 60 ? "Good" : "Needs Improvement"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transcription Quality */}
      <Card>
        <CardHeader>
          <CardTitle>Transcription Quality Metrics</CardTitle>
          <CardDescription>Analysis of call transcription coverage and quality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formattedAnalyticsData.transcriptionQuality.withTranscription}</div>
              <div className="text-sm text-gray-600">With Transcription</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{formattedAnalyticsData.transcriptionQuality.withoutTranscription}</div>
              <div className="text-sm text-gray-600">Missing Transcription</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formattedAnalyticsData.transcriptionQuality.spanishCalls}</div>
              <div className="text-sm text-gray-600">Spanish Calls Detected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formattedAnalyticsData.transcriptionQuality.averageCallLength}s</div>
              <div className="text-sm text-gray-600">Avg Call Length</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}