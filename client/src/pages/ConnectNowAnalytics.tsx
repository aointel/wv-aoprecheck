import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, ChevronDown, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, parse, startOfWeek } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';

interface KPIData {
  connected: number;
  transferred: number;
  percentTransferred: number;
  agentAnswered: number;
  percentAnswered: number;
  ringDuration: number;
  billed: number;
  percentBilled: number;
  missedWithAgent: number;
  percentMissedAgent: number;
  missedNoAgent: number;
  percentMissedNoAgent: number;
  totalMissed: number;
  percentTotalMissed: number;
}

interface CampaignKPIs {
  campaignId: string;
  market: string;
  campaignType: string;
  totalNew: number;
  kpis: KPIData;
}

interface DayKPIs {
  date: string;
  dayName: string;
  campaigns: CampaignKPIs[];
  billing?: {
    precheckBilled: number;
    precheckSignUps: number;
    callConnectorProActiveAccounts: number;
    callConnectorProSignUps: number;
  } | null;
}

interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  days: DayKPIs[];
}

// Campaign display names
const CAMPAIGN_NAMES: Record<string, string> = {
  '68b754c3c28f053a2f7fe514': 'Veteran Inbound',
  '67544a63e481235740fb4b73': 'Veteran Outbound',
  '66c761e81e1037849aa6968f': 'Globe Market Outbound',
  '68b77991c2401b0d72318ba4': 'Globe Market Inbound',
  '68cc2498f67f5aeafec293cb': 'aorecruit (Inbound/Outbound)',
};

const AORECRUIT_CAMPAIGN_ID = '68cc2498f67f5aeafec293cb';

// Helper function to get Thursday of a given week (rolling week starts on Thursday)
function getThursdayOfWeek(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 4 = Thursday
  const daysSinceThursday = (dayOfWeek + 3) % 7; // Days since last Thursday
  const thursday = new Date(date);
  if (daysSinceThursday > 0) {
    thursday.setDate(date.getDate() - daysSinceThursday);
  }
  thursday.setHours(0, 0, 0, 0);
  return thursday;
}

// Helper function to get current rolling week Thursday
function getCurrentRollingWeekThursday(): Date {
  const now = new Date();
  return getThursdayOfWeek(now);
}

// Component to render campaign table
function CampaignTable({ campaign, report }: { campaign: { days: Map<string, CampaignKPIs>; totals: KPIData; campaignName: string }; report: WeeklyReport }) {
  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
      <CardContent className="p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                <TableHead className="w-[180px] font-semibold text-blue-900 dark:text-blue-100">Metric</TableHead>
                {report.days.map((day) => (
                  <TableHead key={day.date} className="text-center min-w-[100px] font-semibold text-blue-900 dark:text-blue-100">
                    {day.dayName.substring(0, 3)}
                    <br />
                    <span className="text-xs font-normal text-blue-700 dark:text-blue-300">{day.date}</span>
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[100px] font-semibold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Connected</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.connected : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.connected}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Transferred</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.transferred : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.transferred}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">% Transferred</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? `${dayCampaign.kpis.percentTransferred.toFixed(1)}%` : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.percentTransferred.toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Agent Answered</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.agentAnswered : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.agentAnswered}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">% Answered</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? `${dayCampaign.kpis.percentAnswered.toFixed(1)}%` : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.percentAnswered.toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Ring Duration (avg)</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.ringDuration.toFixed(1) : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.ringDuration.toFixed(1)}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Billed</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.billed : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.billed}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">% Billed</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? `${dayCampaign.kpis.percentBilled.toFixed(1)}%` : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.percentBilled.toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Missed w/ Agent</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.missedWithAgent : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.missedWithAgent}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">% Missed Agent</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? `${dayCampaign.kpis.percentMissedAgent.toFixed(1)}%` : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.percentMissedAgent.toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Missed NO AGENT</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.missedNoAgent : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.missedNoAgent}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">% Missed NO AGENT</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? `${dayCampaign.kpis.percentMissedNoAgent.toFixed(1)}%` : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {campaign.totals.percentMissedNoAgent.toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="font-semibold bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                <TableCell className="text-blue-900 dark:text-blue-100">Total Missed</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.kpis.totalMissed : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                  {campaign.totals.totalMissed}
                </TableCell>
              </TableRow>
              <TableRow className="font-semibold bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                <TableCell className="text-blue-900 dark:text-blue-100">% Total Missed</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? `${dayCampaign.kpis.percentTotalMissed.toFixed(1)}%` : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                  {campaign.totals.percentTotalMissed.toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                <TableCell className="font-medium">Total NEW Calls</TableCell>
                {report.days.map((day) => {
                  const dayCampaign = campaign.days.get(day.date);
                  return (
                    <TableCell key={day.date} className="text-center">
                      {dayCampaign ? dayCampaign.totalNew : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                  {Array.from(campaign.days.values()).reduce((sum, c) => sum + c.totalNew, 0)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConnectNowAnalytics() {
  const { authState } = useAuth();

  // Check if user has access
  const allowedUsers = ['cnsysop@aoglobelife.com', 'cnysops@aoglobelife.com', 'richiealtig@aoglobelife.com'];
  const hasAccess = authState.user?.email && allowedUsers.includes(authState.user.email.toLowerCase());

  // Week selection state - store the Thursday of the selected week
  const [selectedWeekThursday, setSelectedWeekThursday] = useState<Date>(getCurrentRollingWeekThursday());

  // Navigate to previous week
  const goToPreviousWeek = () => {
    setSelectedWeekThursday(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  };

  // Navigate to next week
  const goToNextWeek = () => {
    setSelectedWeekThursday(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setSelectedWeekThursday(getCurrentRollingWeekThursday());
  };

  // Format week Thursday for API (YYYY-MM-DD)
  const weekParam = format(selectedWeekThursday, 'yyyy-MM-dd');

  // Fetch weekly analytics data
  const { data: report, isLoading, error, refetch } = useQuery<WeeklyReport>({
    queryKey: ['/api/connectnow-analytics/weekly-report', weekParam],
    queryFn: async () => {
      console.log('📊 Fetching data for week:', weekParam, 'from Thursday:', format(selectedWeekThursday, 'M/d/yyyy'));
      const response = await apiRequest('GET', `/api/connectnow-analytics/weekly-report?week=${weekParam}`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. This page is restricted to authorized users only.');
        }
        throw new Error('Failed to fetch analytics data');
      }
      const data = await response.json();
      console.log('📊 Received report data:', {
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        daysCount: data.days?.length || 0,
        expectedWeekStart: format(selectedWeekThursday, 'M/d/yyyy'),
        expectedWeekEnd: format(addDays(selectedWeekThursday, 6), 'M/d/yyyy')
      });
      // Debug billing data
      if (data.days && data.days.length > 0) {
        console.log('💰 First day billing data:', {
          date: data.days[0].date,
          dayName: data.days[0].dayName,
          billing: data.days[0].billing,
          hasBilling: !!data.days[0].billing
        });
      }
      return data;
    },
    enabled: hasAccess,
    staleTime: 0, // Always refetch when week changes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Fetch billing summary data (Pre-Check and Call Connector Pro)
  const { data: billingSummary, error: billingError } = useQuery<{ 
    precheckBilled: number; 
    callConnectorProBilled: number;
    precheckSignUps: number;
    callConnectorProSignUps: number;
    weeklyIncome: number;
  }>({
    queryKey: ['/api/connectnow-analytics/billing-summary', weekParam],
    queryFn: async () => {
      console.log('💰 Fetching billing summary for week:', weekParam);
      try {
        const userEmail = authState.user?.email;
        const response = await apiRequest('GET', `/api/connectnow-analytics/billing-summary?week=${weekParam}`, undefined, userEmail);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Billing summary API error:', response.status, errorText);
          return { 
            precheckBilled: 0, 
            callConnectorProBilled: 0,
            precheckSignUps: 0,
            callConnectorProSignUps: 0,
            weeklyIncome: 0,
          };
        }
        const data = await response.json();
        console.log('💰 Billing summary data received:', data);
        return data;
      } catch (error) {
        console.error('❌ Billing summary query error:', error);
        return { 
          precheckBilled: 0, 
          callConnectorProBilled: 0,
          precheckSignUps: 0,
          callConnectorProSignUps: 0,
          weeklyIncome: 0,
        };
      }
    },
    enabled: hasAccess,
    staleTime: 0, // Always refetch - no caching
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 60000, // Refetch every 60 seconds to get latest data
  });

  // Log when week changes to debug
  useEffect(() => {
    console.log('📅 Week changed to:', format(selectedWeekThursday, 'M/d/yyyy'), 'weekParam:', weekParam);
    if (hasAccess) {
      refetch();
    }
  }, [weekParam, hasAccess, refetch]);

  // Group campaigns by market and campaign type, with days as columns
  const campaignData = React.useMemo(() => {
    if (!report?.days) {
      console.log('📊 ConnectNow Analytics: No days in report');
      return { byMarket: {}, allCampaigns: [] };
    }
    
    console.log('📊 ConnectNow Analytics: Processing report with', report.days.length, 'days');
    
    const campaignsMap = new Map<string, {
      market: string;
      campaignId: string;
      campaignName: string;
      campaignType: string;
      days: Map<string, CampaignKPIs>;
      totals: KPIData;
    }>();
    
    // Process each day
    for (const day of report.days) {
      for (const campaign of day.campaigns) {
        const key = `${campaign.market}-${campaign.campaignId}`;
        
        if (!campaignsMap.has(key)) {
          campaignsMap.set(key, {
            market: campaign.market,
            campaignId: campaign.campaignId,
            campaignName: CAMPAIGN_NAMES[campaign.campaignId] || `${campaign.market} ${campaign.campaignType}`,
            campaignType: campaign.campaignType,
            days: new Map(),
            totals: {
              connected: 0,
              transferred: 0,
              percentTransferred: 0,
              agentAnswered: 0,
              percentAnswered: 0,
              ringDuration: 0,
              billed: 0,
              percentBilled: 0,
              missedWithAgent: 0,
              percentMissedAgent: 0,
              missedNoAgent: 0,
              percentMissedNoAgent: 0,
              totalMissed: 0,
              percentTotalMissed: 0,
            },
          });
        }
        
        const campaignData = campaignsMap.get(key)!;
        campaignData.days.set(day.date, campaign);
        
        // Accumulate totals
        campaignData.totals.connected += campaign.kpis.connected;
        campaignData.totals.transferred += campaign.kpis.transferred;
        campaignData.totals.agentAnswered += campaign.kpis.agentAnswered;
        campaignData.totals.billed += campaign.kpis.billed;
        campaignData.totals.missedWithAgent += campaign.kpis.missedWithAgent;
        campaignData.totals.missedNoAgent += campaign.kpis.missedNoAgent;
        campaignData.totals.totalMissed += campaign.kpis.totalMissed;
        campaignData.totals.ringDuration += campaign.kpis.ringDuration;
      }
    }
    
    // Calculate percentages and averages for totals
    const allCampaigns = Array.from(campaignsMap.values());
    for (const campaign of allCampaigns) {
      const totalNew = Array.from(campaign.days.values()).reduce((sum, c) => sum + c.totalNew, 0);
      const dayCount = campaign.days.size;
      
      campaign.totals.percentTransferred = campaign.totals.agentAnswered > 0 
        ? (campaign.totals.transferred / campaign.totals.agentAnswered) * 100 
        : 0;
      campaign.totals.percentAnswered = totalNew > 0 
        ? (campaign.totals.agentAnswered / totalNew) * 100 
        : 0;
      campaign.totals.percentBilled = totalNew > 0 
        ? (campaign.totals.billed / totalNew) * 100 
        : 0;
      campaign.totals.percentMissedAgent = totalNew > 0 
        ? (campaign.totals.missedWithAgent / totalNew) * 100 
        : 0;
      campaign.totals.percentMissedNoAgent = totalNew > 0 
        ? (campaign.totals.missedNoAgent / totalNew) * 100 
        : 0;
      campaign.totals.percentTotalMissed = totalNew > 0 
        ? (campaign.totals.totalMissed / totalNew) * 100 
        : 0;
      campaign.totals.ringDuration = dayCount > 0 
        ? campaign.totals.ringDuration / dayCount 
        : 0;
    }
    
    // Group by market
    const byMarket: Record<string, typeof allCampaigns> = {};
    for (const campaign of allCampaigns) {
      if (!byMarket[campaign.market]) {
        byMarket[campaign.market] = [];
      }
      byMarket[campaign.market].push(campaign);
    }
    
    return { byMarket, allCampaigns };
  }, [report]);

  // Calculate Master totals (all campaigns except aorecruit)
  const masterData = React.useMemo(() => {
    if (!report?.days || !campaignData.allCampaigns) {
      return null;
    }

    // Filter out aorecruit campaigns
    const masterCampaigns = campaignData.allCampaigns.filter(
      c => c.campaignId !== AORECRUIT_CAMPAIGN_ID
    );

    // Aggregate all master campaigns by day
    const masterDays = new Map<string, {
      connected: number;
      transferred: number;
      agentAnswered: number;
      billed: number;
      missedWithAgent: number;
      missedNoAgent: number;
      totalMissed: number;
      ringDuration: number;
      totalNew: number;
    }>();

    // Aggregate by day across all master campaigns
    for (const day of report.days) {
      let dayData = masterDays.get(day.date) || {
        connected: 0,
        transferred: 0,
        agentAnswered: 0,
        billed: 0,
        missedWithAgent: 0,
        missedNoAgent: 0,
        totalMissed: 0,
        ringDuration: 0,
        totalNew: 0,
      };

      for (const campaign of day.campaigns) {
        if (campaign.campaignId !== AORECRUIT_CAMPAIGN_ID) {
          dayData.connected += campaign.kpis.connected;
          dayData.transferred += campaign.kpis.transferred;
          dayData.agentAnswered += campaign.kpis.agentAnswered;
          dayData.billed += campaign.kpis.billed;
          dayData.missedWithAgent += campaign.kpis.missedWithAgent;
          dayData.missedNoAgent += campaign.kpis.missedNoAgent;
          dayData.totalMissed += campaign.kpis.totalMissed;
          dayData.ringDuration += campaign.kpis.ringDuration;
          dayData.totalNew += campaign.totalNew;
        }
      }

      masterDays.set(day.date, dayData);
    }

    // Calculate totals
    const totals: KPIData = {
      connected: masterCampaigns.reduce((sum, c) => sum + c.totals.connected, 0),
      transferred: masterCampaigns.reduce((sum, c) => sum + c.totals.transferred, 0),
      percentTransferred: 0,
      agentAnswered: masterCampaigns.reduce((sum, c) => sum + c.totals.agentAnswered, 0),
      percentAnswered: 0,
      ringDuration: 0,
      billed: masterCampaigns.reduce((sum, c) => sum + c.totals.billed, 0),
      percentBilled: 0,
      missedWithAgent: masterCampaigns.reduce((sum, c) => sum + c.totals.missedWithAgent, 0),
      percentMissedAgent: 0,
      missedNoAgent: masterCampaigns.reduce((sum, c) => sum + c.totals.missedNoAgent, 0),
      percentMissedNoAgent: 0,
      totalMissed: masterCampaigns.reduce((sum, c) => sum + c.totals.totalMissed, 0),
      percentTotalMissed: 0,
    };

    const totalNew = masterCampaigns.reduce((sum, c) => {
      return sum + Array.from(c.days.values()).reduce((daySum, dayC) => daySum + dayC.totalNew, 0);
    }, 0);

    totals.percentTransferred = totals.agentAnswered > 0 ? (totals.transferred / totals.agentAnswered) * 100 : 0;
    totals.percentAnswered = totalNew > 0 ? (totals.agentAnswered / totalNew) * 100 : 0;
    totals.percentBilled = totalNew > 0 ? (totals.billed / totalNew) * 100 : 0;
    totals.percentMissedAgent = totalNew > 0 ? (totals.missedWithAgent / totalNew) * 100 : 0;
    totals.percentMissedNoAgent = totalNew > 0 ? (totals.missedNoAgent / totalNew) * 100 : 0;
    totals.percentTotalMissed = totalNew > 0 ? (totals.totalMissed / totalNew) * 100 : 0;

    const dayCount = masterDays.size;
    totals.ringDuration = dayCount > 0
      ? Array.from(masterDays.values()).reduce((sum, d) => sum + d.ringDuration, 0) / dayCount
      : 0;

    return {
      days: masterDays,
      totals,
      totalNew,
    };
  }, [report, campaignData.allCampaigns]);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <Card className="max-w-2xl mx-auto mt-20">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
            <p className="text-slate-600 dark:text-slate-400">
              This page is restricted to authorized users only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900 p-6">
      <div className="container mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              ConnectNow Analytics
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Rolling Week Report (Thursday - Wednesday PST) - AO Intelligence Call KPIs by Market and Campaign
            </p>
            {report && (
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                Week: {format(selectedWeekThursday, 'M/d/yyyy')} to {format(addDays(selectedWeekThursday, 6), 'M/d/yyyy')} PST
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={goToCurrentWeek}
              disabled={isLoading}
              title="Go to current week"
            >
              Today
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousWeek}
                disabled={isLoading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous Week
              </Button>
              
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Select Week
                  </label>
                  <input
                    type="date"
                    value={format(selectedWeekThursday, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value) {
                        const selectedDate = new Date(e.target.value + 'T12:00:00');
                        setSelectedWeekThursday(getThursdayOfWeek(selectedDate));
                      }
                    }}
                    className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {format(selectedWeekThursday, 'M/d/yyyy')} - {format(addDays(selectedWeekThursday, 6), 'M/d/yyyy')}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">PST</p>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextWeek}
                disabled={isLoading}
              >
                Next Week
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
              <p className="text-slate-600 dark:text-slate-400">Loading analytics data...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                  <span className="text-red-600 dark:text-red-400">!</span>
                </div>
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">Error Loading Data</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error instanceof Error ? error.message : 'Failed to load analytics data'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Summary Tile */}
        {!isLoading && !error && report && masterData && campaignData && (() => {
          // Calculate billing totals
          const veteranBilled = campaignData.byMarket['Veteran']?.reduce((sum, c) => sum + c.totals.billed, 0) || 0;
          const globeBilled = campaignData.byMarket['Globe Market']?.reduce((sum, c) => sum + c.totals.billed, 0) || 0;
          const aorecruitBilled = campaignData.byMarket['aorecruit']?.reduce((sum, c) => sum + c.totals.billed, 0) || 0;
          
          // Calculate missed calls with agent (all campaigns)
          const totalMissedWithAgent = campaignData.allCampaigns.reduce((sum, c) => sum + c.totals.missedWithAgent, 0);
          const missedCallsBilling = totalMissedWithAgent * 4; // $4 per missed call
          
          // Calculate billing amounts (AO Recruit = $5, others = $8)
          const veteranBilling = veteranBilled * 8;
          const globeBilling = globeBilled * 8;
          const aorecruitBilling = aorecruitBilled * 5;
          
          // Pre-Check and Call Connector Pro from billing summary API
          // Use billingSummary data if available, otherwise default to 0
          const precheckBilled = (billingSummary && typeof billingSummary.precheckBilled === 'number') ? billingSummary.precheckBilled : 0;
          const precheckBilling = precheckBilled * 5;
          const precheckSignUps = (billingSummary && typeof billingSummary.precheckSignUps === 'number') ? billingSummary.precheckSignUps : 0;
          
          const callConnectorProBilled = (billingSummary && typeof billingSummary.callConnectorProBilled === 'number') ? billingSummary.callConnectorProBilled : 0;
          const callConnectorProBilling = callConnectorProBilled * 8;
          const callConnectorProSignUps = (billingSummary && typeof billingSummary.callConnectorProSignUps === 'number') ? billingSummary.callConnectorProSignUps : 0;
          const weeklyIncome = (billingSummary && typeof billingSummary.weeklyIncome === 'number') ? billingSummary.weeklyIncome : 0;
          
          // Debug logging
          if (billingError) {
            console.error('❌ Billing summary error:', billingError);
          }
          if (!billingSummary) {
            console.warn('⚠️ Billing summary data not available yet');
          } else {
            console.log('✅ Billing summary loaded:', billingSummary);
          }
          
          const totalBilling = veteranBilling + globeBilling + aorecruitBilling + precheckBilling + callConnectorProBilling + missedCallsBilling;
          
          return (
            <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
              <CardHeader>
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                  Billing Summary Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                  {/* Total */}
                  <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50 rounded-lg p-4 border-2 border-blue-300 dark:border-blue-700">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Total</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">${totalBilling.toFixed(2)}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Week: {format(selectedWeekThursday, 'M/d/yyyy')} - {format(addDays(selectedWeekThursday, 6), 'M/d/yyyy')}
                    </p>
                  </div>
                  
                  {/* Veteran */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Veteran</p>
                    <p className="text-xl font-bold text-blue-900 dark:text-blue-100">${veteranBilling.toFixed(2)}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {veteranBilled} billed @ $8
                    </p>
                  </div>
                  
                  {/* Globe Market */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Globe Market</p>
                    <p className="text-xl font-bold text-blue-900 dark:text-blue-100">${globeBilling.toFixed(2)}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {globeBilled} billed @ $8
                    </p>
                  </div>
                  
                  {/* AO Recruit */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">AO Recruit</p>
                    <p className="text-xl font-bold text-purple-900 dark:text-purple-100">${aorecruitBilling.toFixed(2)}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {aorecruitBilled} billed @ $5
                    </p>
                  </div>
                  
                  {/* Pre-Check */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Pre-Check</p>
                    <p className="text-xl font-bold text-purple-900 dark:text-purple-100">${precheckBilling.toFixed(2)}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      {precheckBilled} billed @ $5
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 border-t border-purple-200 dark:border-purple-700 pt-1">
                      {precheckSignUps} sign-ups
                    </p>
                  </div>
                  
                  {/* Call Connector Pro */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Call Connector Pro</p>
                    <p className="text-xl font-bold text-blue-900 dark:text-blue-100">${callConnectorProBilling.toFixed(2)}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {callConnectorProBilled} active accounts @ $8
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 border-t border-blue-200 dark:border-blue-700 pt-1">
                      {callConnectorProSignUps} sign-ups
                    </p>
                  </div>
                  
                  {/* Missed Calls */}
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">Missed Calls</p>
                    <p className="text-xl font-bold text-orange-900 dark:text-orange-100">${missedCallsBilling.toFixed(2)}</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                      {totalMissedWithAgent} missed @ $4
                    </p>
                  </div>
                </div>
                
                {/* Weekly Income Section */}
                {weeklyIncome > 0 && (
                  <div className="mt-6 pt-6 border-t border-blue-200 dark:border-blue-800">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-4 border-2 border-green-300 dark:border-green-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Call Connector Pro Weekly Income</p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            ({callConnectorProBilled} active accounts × $64.99) ÷ 4.3
                          </p>
                        </div>
                        <p className="text-3xl font-bold text-green-900 dark:text-green-100">${weeklyIncome.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Weekly Report with Tabs */}
        {!isLoading && !error && report && masterData && (
          <Tabs defaultValue="master" className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
              <TabsTrigger value="master" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">Master</TabsTrigger>
              <TabsTrigger value="veteran" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">Veteran</TabsTrigger>
              <TabsTrigger value="globe" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">Globe Market</TabsTrigger>
              <TabsTrigger value="aorecruit" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">aorecruit</TabsTrigger>
              <TabsTrigger value="precheck" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">Pre-Check</TabsTrigger>
              <TabsTrigger value="callconnectorpro" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white">Call Connector Pro</TabsTrigger>
            </TabsList>

            {/* Master Tab - Aggregated summary excluding aorecruit */}
            <TabsContent value="master" className="mt-4">
              <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
                <CardHeader>
                  <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                    Master Summary (All Campaigns Except aorecruit)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                          <TableHead className="w-[180px] font-semibold text-blue-900 dark:text-blue-100">Metric</TableHead>
                          {report.days.map((day) => (
                            <TableHead key={day.date} className="text-center min-w-[100px] font-semibold text-blue-900 dark:text-blue-100">
                              {day.dayName.substring(0, 3)}
                              <br />
                              <span className="text-xs font-normal text-blue-700 dark:text-blue-300">{day.date}</span>
                            </TableHead>
                          ))}
                          <TableHead className="text-center min-w-[100px] font-semibold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                            Total
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Connected</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.connected : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.connected}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Transferred</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.transferred : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.transferred}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">% Transferred</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            const percent = dayData && dayData.agentAnswered > 0
                              ? (dayData.transferred / dayData.agentAnswered) * 100
                              : 0;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? `${percent.toFixed(1)}%` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.percentTransferred.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Agent Answered</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.agentAnswered : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.agentAnswered}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">% Answered</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            const percent = dayData && dayData.totalNew > 0
                              ? (dayData.agentAnswered / dayData.totalNew) * 100
                              : 0;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? `${percent.toFixed(1)}%` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.percentAnswered.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Ring Duration (avg)</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.ringDuration.toFixed(1) : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.ringDuration.toFixed(1)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Billed</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.billed : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.billed}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">% Billed</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            const percent = dayData && dayData.totalNew > 0
                              ? (dayData.billed / dayData.totalNew) * 100
                              : 0;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? `${percent.toFixed(1)}%` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.percentBilled.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Missed w/ Agent</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.missedWithAgent : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.missedWithAgent}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">% Missed Agent</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            const percent = dayData && dayData.totalNew > 0
                              ? (dayData.missedWithAgent / dayData.totalNew) * 100
                              : 0;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? `${percent.toFixed(1)}%` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.percentMissedAgent.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Missed NO AGENT</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.missedNoAgent : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.missedNoAgent}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">% Missed NO AGENT</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            const percent = dayData && dayData.totalNew > 0
                              ? (dayData.missedNoAgent / dayData.totalNew) * 100
                              : 0;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? `${percent.toFixed(1)}%` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totals.percentMissedNoAgent.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        <TableRow className="font-semibold bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                          <TableCell className="text-blue-900 dark:text-blue-100">Total Missed</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.totalMissed : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                            {masterData.totals.totalMissed}
                          </TableCell>
                        </TableRow>
                        <TableRow className="font-semibold bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                          <TableCell className="text-blue-900 dark:text-blue-100">% Total Missed</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            const percent = dayData && dayData.totalNew > 0
                              ? (dayData.totalMissed / dayData.totalNew) * 100
                              : 0;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? `${percent.toFixed(1)}%` : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                            {masterData.totals.percentTotalMissed.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Total NEW Calls</TableCell>
                          {report.days.map((day) => {
                            const dayData = masterData.days.get(day.date);
                            return (
                              <TableCell key={day.date} className="text-center">
                                {dayData ? dayData.totalNew : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {masterData.totalNew}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20 border-t-2 border-blue-300 dark:border-blue-700">
                          <TableCell className="font-medium">Pre-Check Sessions</TableCell>
                          {report.days.map((day) => {
                            const billing = day.billing;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {billing ? billing.precheckBilled : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {report.days.reduce((sum, day) => sum + (day.billing?.precheckBilled || 0), 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                          <TableCell className="font-medium">Call Connector Pro Accounts</TableCell>
                          {report.days.map((day) => {
                            const billing = day.billing;
                            return (
                              <TableCell key={day.date} className="text-center">
                                {billing ? billing.callConnectorProActiveAccounts : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                            {report.days.reduce((sum, day) => {
                              // For accounts, we want the max value (since it's a snapshot, not a sum)
                              const accounts = day.billing?.callConnectorProActiveAccounts || 0;
                              return accounts > sum ? accounts : sum;
                            }, 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Veteran Tab */}
            <TabsContent value="veteran" className="mt-4">
              {campaignData.byMarket['Veteran'] && (
                <Accordion type="multiple" className="w-full">
                  {campaignData.byMarket['Veteran'].map((campaign) => (
                    <AccordionItem key={`${campaign.market}-${campaign.campaignId}`} value={`${campaign.market}-${campaign.campaignId}`} className="border-2 border-blue-200 dark:border-blue-800 rounded-lg mb-4 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                          {campaign.campaignName}
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <CampaignTable campaign={campaign} report={report} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

            {/* Globe Market Tab */}
            <TabsContent value="globe" className="mt-4">
              {campaignData.byMarket['Globe Market'] && (
                <Accordion type="multiple" className="w-full">
                  {campaignData.byMarket['Globe Market'].map((campaign) => (
                    <AccordionItem key={`${campaign.market}-${campaign.campaignId}`} value={`${campaign.market}-${campaign.campaignId}`} className="border-2 border-blue-200 dark:border-blue-800 rounded-lg mb-4 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                          {campaign.campaignName}
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <CampaignTable campaign={campaign} report={report} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

            {/* aorecruit Tab */}
            <TabsContent value="aorecruit" className="mt-4">
              {campaignData.byMarket['aorecruit'] && (
                <Accordion type="multiple" className="w-full">
                  {campaignData.byMarket['aorecruit'].map((campaign) => (
                    <AccordionItem key={`${campaign.market}-${campaign.campaignId}`} value={`${campaign.market}-${campaign.campaignId}`} className="border-2 border-blue-200 dark:border-blue-800 rounded-lg mb-4 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                          {campaign.campaignName}
                        </h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <CampaignTable campaign={campaign} report={report} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </TabsContent>

            {/* Pre-Check Tab */}
            <TabsContent value="precheck" className="mt-4">
              {report && (
                <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                      Pre-Check Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                            <TableHead className="w-[180px] font-semibold text-blue-900 dark:text-blue-100">Metric</TableHead>
                            {report.days.map((day) => (
                              <TableHead key={day.date} className="text-center min-w-[100px] font-semibold text-blue-900 dark:text-blue-100">
                                {day.dayName.substring(0, 3)}
                                <br />
                                <span className="text-xs font-normal text-blue-700 dark:text-blue-300">{day.date}</span>
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[100px] font-semibold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                            <TableCell className="font-medium">Sessions</TableCell>
                            {report.days.map((day) => {
                              const billing = day.billing;
                              if (!billing) {
                                console.warn(`⚠️ No billing data for day ${day.date}`, day);
                              }
                              return (
                                <TableCell key={day.date} className="text-center">
                                  {billing ? billing.precheckBilled : '-'}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                              {report.days.reduce((sum, day) => sum + (day.billing?.precheckBilled || 0), 0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Call Connector Pro Tab */}
            <TabsContent value="callconnectorpro" className="mt-4">
              {report && (
                <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-blue-50/50 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                      Call Connector Pro Accounts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-blue-100 via-purple-100 to-blue-100 dark:from-blue-900/50 dark:via-purple-900/50 dark:to-blue-900/50">
                            <TableHead className="w-[180px] font-semibold text-blue-900 dark:text-blue-100">Metric</TableHead>
                            {report.days.map((day) => (
                              <TableHead key={day.date} className="text-center min-w-[100px] font-semibold text-blue-900 dark:text-blue-100">
                                {day.dayName.substring(0, 3)}
                                <br />
                                <span className="text-xs font-normal text-blue-700 dark:text-blue-300">{day.date}</span>
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[100px] font-semibold bg-gradient-to-r from-blue-200 via-purple-200 to-blue-200 dark:from-blue-800 dark:via-purple-800 dark:to-blue-800 text-blue-900 dark:text-blue-100">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-purple-50/50 hover:to-blue-50/50 dark:hover:from-blue-900/20 dark:hover:via-purple-900/20 dark:hover:to-blue-900/20">
                            <TableCell className="font-medium">Accounts</TableCell>
                            {report.days.map((day) => {
                              const billing = day.billing;
                              return (
                                <TableCell key={day.date} className="text-center">
                                  {billing ? billing.callConnectorProActiveAccounts : '-'}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-semibold bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                              {report.days.reduce((sum, day) => {
                                // For accounts, we want the max value (since it's a snapshot, not a sum)
                                const accounts = day.billing?.callConnectorProActiveAccounts || 0;
                                return accounts > sum ? accounts : sum;
                              }, 0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* No Data State */}
        {!isLoading && !error && report && report.days.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No Data Available</h3>
              <p className="text-slate-600 dark:text-slate-400">
                No analytics data found for the current week.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
