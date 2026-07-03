import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';

import { useAuth } from '@/hooks/use-auth';
import { 
  BarChart3, 
  Phone, 
  Rocket,
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
  FileText,
  Bell,
  Trophy,
  Monitor
} from 'lucide-react';
import { CustomLoader } from '@/components/ui/custom-loader';
import { UpdateNotification } from '@/components/UpdateNotification';
import { DesktopAppPromo } from '@/components/DesktopAppPromo';
import { producerInstructions } from '@/components/AgentInstructions';
import { AOIScore } from '@/components/aoi/AOIScore';
import { BusinessMetricTiles } from '@/components/dashboard/BusinessMetricTiles';
import { AOIConnectStatus } from '@/components/dashboard/AOIConnectStatus';


import { LiveproducerTicker } from '@/components/dashboard/LiveproducerTicker';
import { EliteAccessTracker } from '@/components/dashboard/EliteAccessTracker';
import { TodaysSchedule } from '@/components/dashboard/TodaysSchedule';
import { NewsAlertsCard } from '@/components/dashboard/NewsAlertsCard';
import { WeeklySalesTotal } from '@/components/dashboard/WeeklySalesTotal';
import { AOIReportSection } from '@/components/dashboard/AOIReportSection';
import { GamificationStats } from '@/components/gamification/GamificationStats';
import { AOConnectBillingDashboard } from '@/components/dashboard/AOConnectBillingDashboard';
import CallConnectorPro from '@/components/outbound-dialer/CallConnectorPro';
import { VolumeControl } from '@/components/VolumeControl';


interface producerDashboardStats {
  // Connect (Calling) Stats
  connectCalls: number;
  connectCallsToday: number;
  connectCallsWeek: number;
  connectSuccessRate: number;
  connectAppointments: number;
  
  // AO Recruit Stats
  recruitLeads: number;
  recruitLeadsToday: number;
  recruitLeadsWeek: number;
  recruitConversions: number;
  recruitInterviews: number;
  
  // AO Precheck Stats
  precheckVerifications: number;
  precheckVerificationsToday: number;
  precheckVerificationsWeek: number;
  precheckSuccessRate: number;
  precheckCompletions: number;
  
  // Overall Producer Stats
  totalActivities: number;
  avgCallTime: string;
  creditsRemaining: number;
}

export default function Dashboard() {
  // Add console log for navigation verification
  console.log('🏠 Dashboard page loaded');
  console.log('🔥 DASHBOARD: Loading with direct dialer access for hotleads');
  
  // Get authenticated user
  const { authState } = useAuth();
  const userEmail = authState.user?.email || 'cnsysop@aoglobelife.com';
  
  // Check if user is admin (for Live Call Board access)
  const isAdmin = userEmail === 'cnsysop@aoglobelife.com' || userEmail === 'robhay@aoglobelife.com' || userEmail === 'chrislafond@aoglobelife.com' || userEmail === 'tabithamcdermid@aoglobelife.com' || userEmail === 'diankablash@aoglobelife.com';
  


  
  // Fetch Producer Dashboard statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/agent-stats'],
    queryFn: async (): Promise<producerDashboardStats> => {
      const response = await fetch('/api/dashboard/agent-stats');
      if (!response.ok) throw new Error('Failed to fetch Producer Stats');
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



  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <CustomLoader size="lg" text="Loading analytics..." />
      </div>
    );
  }

  const defaultStats: producerDashboardStats = {
    connectCalls: 0,
    connectCallsToday: 0,
    connectCallsWeek: 0,
    connectSuccessRate: 0,
    connectAppointments: 0,
    recruitLeads: 0,
    recruitLeadsToday: 0,
    recruitLeadsWeek: 0,
    recruitConversions: 0,
    recruitInterviews: 0,
    precheckVerifications: 0,
    precheckVerificationsToday: 0,
    precheckVerificationsWeek: 0,
    precheckSuccessRate: 0,
    precheckCompletions: 0,
    totalActivities: 0,
    avgCallTime: '0:00',
    creditsRemaining: 0,
    ...stats
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="p-6 space-y-8">
        {/* Update Notification - DISABLED - using Chrome browser only */}
        {/* <UpdateNotification /> */}
        {/* Desktop App Promo - DISABLED - using Chrome browser only */}
        {/* {!window.location.search.includes('desktop=true') && !navigator.userproducer.includes('ConnectNow') && (
          <DesktopAppPromo />
        )} */}
        
        {/* Enhanced Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700 rounded-3xl p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="flex-1 mb-6 lg:mb-0">
                <h1 className="text-5xl font-bold mb-3 tracking-tight">AO Intelligence</h1>
                <p className="text-xl text-blue-100 font-medium mb-4">Dashboard</p>
              </div>
              
              {/* Live Status Metrics - Real-time Data */}
              <div className="flex-shrink-0 mb-6 lg:mb-0">
                <BusinessMetricTiles agentEmail={userEmail} />
              </div>

              {/* AOI ALP - Right Side */}
              <div className="flex-shrink-0">
                <WeeklySalesTotal agentEmail={userEmail} />
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-sm"></div>
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-white/5 rounded-full blur-sm"></div>
          <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/10 rounded-full blur-sm"></div>
        </div>


        {/* Live Producer Performance Ticker */}
        <LiveproducerTicker />

        {/* Gamification Progress */}
        <GamificationStats />





        {/* Main Layout with AOI Score on Right */}
        <div className="flex gap-8 mb-6">
          {/* Left Side Content */}
          <div className="flex-1">
            {/* Top Row: AOI Report, Schedule and Quick Start */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
              {/* Today's Schedule - Appointments (Moderately Wider) */}
              <div className="lg:col-span-3 space-y-6">
                {/* AOI Report Section - Top Priority */}
                <AOIReportSection />
                
                {/* Volume Control - Only shows in Electron */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5" />
                      Audio Control
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VolumeControl 
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      showLabel={true}
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Control system volume directly from the app (Electron only)
                    </p>
                  </CardContent>
                </Card>
                
                {/* Today's Schedule - Below AOI Report */}
                <TodaysSchedule />
              </div>

              {/* Quick Start */}
              <div className="lg:col-span-2">
                <div className="h-full space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Quick Start
                    </h3>
                    <div className="space-y-3">
                      <Link href="/dashboard/connect">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors">
                          <Phone className="h-4 w-4 mr-2" />
                          Connect
                        </Button>
                      </Link>
                      <Link href="/dashboard/recruit">
                        <Button className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Recruit
                        </Button>
                      </Link>
                      <Link href="/dashboard/precheck">
                        <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors">
                          <Shield className="h-4 w-4 mr-2" />
                          Precheck
                        </Button>
                      </Link>
                    </div>
                  </div>
                  
                  {/* News & Alerts Card */}
                  <div className="flex-1">
                    <NewsAlertsCard />
                  </div>
                </div>
              </div>
            </div>



            {/* AOI Connect Status Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                AOI Connect Performance
              </h3>
              <AOIConnectStatus userEmail={userEmail} />
            </div>



          </div>

          {/* Middle: Elite Access Tracker */}
          <div className="w-[300px] flex-shrink-0">
            <EliteAccessTracker agentEmail={userEmail} className="h-full" />
          </div>

          {/* AOI Score - Right Side (spans full height) */}
          <div className="w-[552px] flex-shrink-0">
            <AOIScore agentEmail={userEmail} className="h-full min-h-[594px]" />
          </div>
        </div>

        {/* Gamification Preview - DEVELOPMENT */}
        <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl border-yellow-300">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-600/20"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-xl flex items-center gap-3 text-yellow-700 dark:text-yellow-300">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-xl">
                <Trophy className="h-6 w-6 text-yellow-600" />
              </div>
              Dial Streak Gamification (Preview)
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50/50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                  Visual mockup of daily dial streak system
                </p>
                <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80 mt-2">
                  Achievement badges, progress tracking, and XP rewards
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = '/gamification-mockup'}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium transition-colors"
              >
                <Trophy className="w-4 h-4 mr-2" />
                View Mockup Design
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Live Call Board Access - ADMIN ONLY */}
        {isAdmin && (
          <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-600/20"></div>
            <CardHeader className="relative z-10">
              <CardTitle className="text-xl flex items-center gap-3 text-green-700 dark:text-green-300">
                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-xl">
                  <Monitor className="h-6 w-6 text-green-600" />
                </div>
                🔴 Live Call Board - MGA Monitor
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-4">
                <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 font-medium">
                    Real-time producer monitoring dashboard with live call status
                  </p>
                  <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-2">
                    Monitor dial/reached/booked, Twilio calls, Zoom meetings, and join capabilities
                  </p>
                </div>
                <Button 
                  onClick={() => window.location.href = '/dashboard/live-call-board'}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  Open Live Call Board
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* WAR Reports Access - PROMINENT */}
        <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/20"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-xl flex items-center gap-3 text-blue-700 dark:text-blue-300">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              Weekly Activity Reports (WAR)
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-blue-700 dark:text-blue-300 font-medium">
                  View team performance with D-R-B | A-P-S-ALP metrics
                </p>
                <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-2">
                  Track daily activities and results for Plus and Veteran markets
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = '/dashboard/war-reports'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View WAR Reports
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* HOTLEADS DIALER - DIRECT ACCESS */}
        <Card className="relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl lg:col-span-2">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-orange-600/20"></div>
          <CardHeader className="relative z-10">
            <CardTitle className="text-xl flex items-center gap-3 text-red-700 dark:text-red-300">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl">
                <Rocket className="h-6 w-6 text-red-600" />
              </div>
              🔥 Call Connector Pro - Hotleads
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <CallConnectorPro />
          </CardContent>
        </Card>






      </div>
    </div>
  );
}