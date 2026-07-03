import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { WarModal } from '@/components/WarModal';
import { 
  BarChart3, 
  Phone, 
  Users, 
  TrendingUp, 
  Clock, 
  Target,
  Calendar,
  DollarSign,
  UserPlus,
  Shield,
  CheckCircle,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { CustomLoader } from '@/components/ui/custom-loader';

interface AgentDashboardStats {
  // Connect (Calling) Stats
  connectCalls: number;
  connectCallsToday: number;
  connectCallsWeek: number;
  connectSuccessRate: number;
  connectRevenue: number;
  
  // AO Recruit Stats
  recruitLeads: number;
  recruitLeadsToday: number;
  recruitLeadsWeek: number;
  recruitConversions: number;
  recruitRevenue: number;
  
  // AO Precheck Stats
  precheckVerifications: number;
  precheckVerificationsToday: number;
  precheckVerificationsWeek: number;
  precheckSuccessRate: number;
  precheckRevenue: number;
  
  // Overall Agent Stats
  totalRevenue: number;
  totalActivities: number;
  avgCallTime: string;
  creditsRemaining: number;
}

export default function Dashboard() {
  // Add console log for navigation verification
  console.log('🏠 Dashboard page loaded');
  
  // WAR Modal state
  const [showWarModal, setShowWarModal] = useState(false);
  const [warWeekStart, setWarWeekStart] = useState('');
  const [warWeekEnd, setWarWeekEnd] = useState('');
  
  // Fetch agent dashboard statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/agent-stats'],
    queryFn: async (): Promise<AgentDashboardStats> => {
      const response = await fetch('/api/dashboard/agent-stats');
      if (!response.ok) throw new Error('Failed to fetch agent stats');
      return response.json();
    }
  });

  // Fetch recent performance data across all services
  const { data: performanceData } = useQuery({
    queryKey: ['/api/dashboard/agent-performance'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/agent-performance');
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Check WAR status - if agent needs to submit weekly report
  const { data: warStatus } = useQuery({
    queryKey: ['/api/war/status'],
    queryFn: async () => {
      const agentEmail = 'cnsysop@aoglobelife.com'; // TODO: Get from auth context
      const response = await fetch(`/api/war/status?agentEmail=${encodeURIComponent(agentEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 300000, // Check every 5 minutes
  });

  // Auto-show WAR modal if needed
  useEffect(() => {
    if (warStatus?.needsSubmission && !showWarModal) {
      setWarWeekStart(warStatus.weekStart);
      setWarWeekEnd(warStatus.weekEnd);
      setShowWarModal(true);
    }
  }, [warStatus, showWarModal]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <CustomLoader size="lg" text="Loading analytics..." />
      </div>
    );
  }

  const defaultStats: AgentDashboardStats = {
    connectCalls: 0,
    connectCallsToday: 0,
    connectCallsWeek: 0,
    connectSuccessRate: 0,
    connectRevenue: 0,
    recruitLeads: 0,
    recruitLeadsToday: 0,
    recruitLeadsWeek: 0,
    recruitConversions: 0,
    recruitRevenue: 0,
    precheckVerifications: 0,
    precheckVerificationsToday: 0,
    precheckVerificationsWeek: 0,
    precheckSuccessRate: 0,
    precheckRevenue: 0,
    totalRevenue: 0,
    totalActivities: 0,
    avgCallTime: '0:00',
    creditsRemaining: 0,
    ...stats
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Your performance across Connect, AO Recruit, and AO Precheck
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <DollarSign className="h-3 w-3" />
            {defaultStats.creditsRemaining} Credits
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Live
          </Badge>
        </div>
      </div>

      {/* Service Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connect Stats */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              Connect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Today</span>
              <span className="text-lg font-bold">{defaultStats.connectCallsToday}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">This Week</span>
              <span className="text-lg font-bold">{defaultStats.connectCallsWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Success Rate</span>
              <span className="text-lg font-bold text-green-600">{defaultStats.connectSuccessRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <span className="text-lg font-bold text-green-600">${defaultStats.connectRevenue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* AO Recruit Stats */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-purple-600" />
              AO Recruit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Today</span>
              <span className="text-lg font-bold">{defaultStats.recruitLeadsToday}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">This Week</span>
              <span className="text-lg font-bold">{defaultStats.recruitLeadsWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Conversions</span>
              <span className="text-lg font-bold text-green-600">{defaultStats.recruitConversions}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <span className="text-lg font-bold text-green-600">${defaultStats.recruitRevenue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* AO Precheck Stats */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              AO Precheck
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Today</span>
              <span className="text-lg font-bold">{defaultStats.precheckVerificationsToday}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">This Week</span>
              <span className="text-lg font-bold">{defaultStats.precheckVerificationsWeek}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Success Rate</span>
              <span className="text-lg font-bold text-green-600">{defaultStats.precheckSuccessRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <span className="text-lg font-bold text-green-600">${defaultStats.precheckRevenue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${defaultStats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              All services combined
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{defaultStats.totalActivities}</div>
            <p className="text-xs text-muted-foreground">
              Calls + Leads + Verifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Call Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{defaultStats.avgCallTime}</div>
            <p className="text-xs text-muted-foreground">
              Connect calls average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{defaultStats.creditsRemaining}</div>
            <p className="text-xs text-muted-foreground">
              Available for all services
            </p>
          </CardContent>
        </Card>
      </div>

      {/* WAR Status Alert */}
      {warStatus?.needsSubmission && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <AlertTriangle className="h-5 w-5" />
              Weekly Agency Report Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-orange-600 dark:text-orange-400">
                You have {warStatus.unreportedConnects} connects from this week and {warStatus.pendingConnects || 0} pending connects that require disposition reporting.
              </p>
              <p className="text-sm text-orange-600/80 dark:text-orange-400/80">
                Week: {new Date(warStatus.weekStart).toLocaleDateString()} - {new Date(warStatus.weekEnd).toLocaleDateString()}
              </p>
              <Button 
                onClick={() => setShowWarModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <FileText className="w-4 h-4 mr-2" />
                Complete WAR Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Start Calling</span>
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Recruit Agents</span>
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="font-medium">Verify Sale</span>
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WAR Modal */}
      <WarModal
        isOpen={showWarModal}
        onClose={() => setShowWarModal(false)}
        agentEmail="cnsysop@aoglobelife.com" // TODO: Get from auth context
        weekStart={warWeekStart}
        weekEnd={warWeekEnd}
      />
    </div>
  );
}