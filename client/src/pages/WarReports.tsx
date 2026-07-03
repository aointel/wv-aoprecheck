import { useState, useEffect } from 'react';
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Users, TrendingUp, DollarSign, Phone, UserCheck, BookOpen, Presentation, Award } from 'lucide-react';

interface WarMetrics {
  dials: number;
  reached: number;
  booked: number;
  appointments: number;
  presentations: number;
  sales: number;
  alp: number;
}

interface WeeklyReport {
  agentEmail: string;
  agentName: string;
  teamName: string;
  weekStartDate: string;
  weekEndDate: string;
  marketType: string;
  dailyMetrics: {
    [day: string]: WarMetrics;
  };
  weeklyTotals: WarMetrics;
  ratios: {
    reachRate: number;
    bookingRate: number;
    appointmentRate: number;
    presentationRate: number;
    closeRate: number;
  };
}

interface Team {
  teamName: string;
  teamLeader: string;
  description: string;
}

export default function WarReports() {
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    return weekStart.toISOString().split('T')[0];
  });
  
  const [selectedproducer, setSelectedproducer] = useState('davidfulfer@aoglobelife.com');
  const [selectedTeam, setSelectedTeam] = useState('Globe Life Team');
  
  const queryClient = useQueryClient();

  // Query for teams
  const { data: teamsData } = useQuery({
    queryKey: ['/api/war/teams'],
    queryFn: async () => {
      const response = await fetch('/api/war/teams');
      const data = await response.json();
      return data.teams as Team[];
    }
  });

  // Query for team members
  const { data: membersData } = useQuery({
    queryKey: ['/api/war/teams', selectedTeam, 'members'],
    queryFn: async () => {
      const response = await fetch(`/api/war/teams/${encodeURIComponent(selectedTeam)}/members`);
      const data = await response.json();
      return data.members as Array<{ agentEmail: string; agentName: string; role: string }>;
    },
    enabled: !!selectedTeam
  });

  // Query for producer report
  const { data: producerReportData, isLoading: isLoadingproducer } = useQuery({
    queryKey: ['/api/war/agents', selectedproducer, 'report', selectedWeek],
    queryFn: async () => {
      const response = await fetch(`/api/war/agents/${encodeURIComponent(selectedproducer)}/report?weekStart=${selectedWeek}`);
      const data = await response.json();
      return data.reports as WeeklyReport[];
    },
    enabled: !!selectedproducer && !!selectedWeek
  });

  // Query for team report
  const { data: teamReportData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['/api/war/teams', selectedTeam, 'report', selectedWeek],
    queryFn: async () => {
      const response = await fetch(`/api/war/teams/${encodeURIComponent(selectedTeam)}/report?weekStart=${selectedWeek}`);
      const data = await response.json();
      return data.reports as WeeklyReport[];
    },
    enabled: !!selectedTeam && !!selectedWeek
  });

  // Mutation for generating sample data
  const generateSampleDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/war/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/war/agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/war/teams'] });
    }
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const marketColors = {
    plus: 'bg-blue-100 text-blue-800',
    veteran: 'bg-green-100 text-green-800', 
    globe: 'bg-purple-100 text-purple-800',
    willkit: 'bg-orange-100 text-orange-800'
  };

  // Create a clean table for market data
  const renderMarketTable = (reports: WeeklyReport[]) => {
    if (!reports || reports.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data available for selected period
        </div>
      );
    }

    // Group reports by market type
    const marketData = reports.reduce((acc, report) => {
      const market = report.marketType || 'Unknown';
      if (!acc[market]) {
        acc[market] = {
          marketType: market,
          weeklyTotals: { dials: 0, reached: 0, booked: 0, appointments: 0, presentations: 0, sales: 0, alp: 0 },
          dailyMetrics: {}
        };
      }
      
      // Aggregate totals
      acc[market].weeklyTotals.dials += report.weeklyTotals.dials || 0;
      acc[market].weeklyTotals.reached += report.weeklyTotals.reached || 0;
      acc[market].weeklyTotals.booked += report.weeklyTotals.booked || 0;
      acc[market].weeklyTotals.appointments += report.weeklyTotals.appointments || 0;
      acc[market].weeklyTotals.presentations += report.weeklyTotals.presentations || 0;
      acc[market].weeklyTotals.sales += report.weeklyTotals.sales || 0;
      acc[market].weeklyTotals.alp += report.weeklyTotals.alp || 0;
      
      // Aggregate daily metrics
      Object.keys(report.dailyMetrics || {}).forEach(day => {
        if (!acc[market].dailyMetrics[day]) {
          acc[market].dailyMetrics[day] = { dials: 0, reached: 0, booked: 0, appointments: 0, presentations: 0, sales: 0, alp: 0 };
        }
        const dayData = report.dailyMetrics[day];
        if (dayData) {
          acc[market].dailyMetrics[day].dials += dayData.dials || 0;
          acc[market].dailyMetrics[day].reached += dayData.reached || 0;
          acc[market].dailyMetrics[day].booked += dayData.booked || 0;
          acc[market].dailyMetrics[day].appointments += dayData.appointments || 0;
          acc[market].dailyMetrics[day].presentations += dayData.presentations || 0;
          acc[market].dailyMetrics[day].sales += dayData.sales || 0;
          acc[market].dailyMetrics[day].alp += dayData.alp || 0;
        }
      });
      
      return acc;
    }, {} as any);

    // Only show Plus and Veteran markets as requested
    const filteredMarkets = Object.values(marketData).filter((market: any) => 
      market.marketType.toLowerCase() === 'plus' || market.marketType.toLowerCase() === 'veteran'
    );

    return (
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm border">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-semibold text-gray-900">Market</th>
              {dayNames.map(day => (
                <th key={day} className="px-3 py-3 text-center font-semibold text-gray-900 min-w-[140px]">
                  <div className="text-sm">{day}</div>
                  <div className="text-xs text-gray-500 font-normal">D-R-B | A-P-S-ALP</div>
                </th>
              ))}
              <th className="px-4 py-3 text-center font-semibold text-gray-900 min-w-[140px]">
                <div className="text-sm">Week Total</div>
                <div className="text-xs text-gray-500 font-normal">D-R-B | A-P-S-ALP</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMarkets.map((market: any, index) => (
              <tr key={market.marketType} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-4 font-medium text-gray-900">
                  <Badge className={marketColors[market.marketType.toLowerCase() as keyof typeof marketColors] || 'bg-gray-100 text-gray-800'}>
                    {market.marketType}
                  </Badge>
                </td>
                {dayNames.map(day => {
                  const dayData = market.dailyMetrics[day] || { dials: 0, reached: 0, booked: 0, appointments: 0, presentations: 0, sales: 0, alp: 0 };
                  return (
                    <td key={day} className="px-3 py-4 text-center text-sm">
                      <div className="space-y-1">
                        <div className="text-blue-600 font-medium">
                          {dayData.dials}-{dayData.reached}-{dayData.booked}
                        </div>
                        <div className="text-green-600 font-medium">
                          {dayData.appointments}-{dayData.presentations}-{dayData.sales}-${dayData.alp}
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="px-4 py-4 text-center text-sm">
                  <div className="space-y-1">
                    <div className="text-blue-600 font-semibold">
                      {market.weeklyTotals.dials}-{market.weeklyTotals.reached}-{market.weeklyTotals.booked}
                    </div>
                    <div className="text-green-600 font-semibold">
                      {market.weeklyTotals.appointments}-{market.weeklyTotals.presentations}-{market.weeklyTotals.sales}-${market.weeklyTotals.alp}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getWeekDates = (weekStart: string) => {
    const startDate = new Date(weekStart);
    const dates = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push({
        dayName: dayNames[i],
        date: date.getDate(),
        month: date.getMonth() + 1
      });
    }
    return dates;
  };

  const renderMetricsTable = (reports: WeeklyReport[], title: string) => {
    if (!reports || reports.length === 0) {
      return (
        <div className="bg-white border p-3">
          <div className="text-center py-4 text-gray-500 text-sm">
            No data available for this week. 
            <Button 
              onClick={() => generateSampleDataMutation.mutate()}
              disabled={generateSampleDataMutation.isPending}
              className="ml-2"
              size="sm"
            >
              Generate Sample Data
            </Button>
          </div>
        </div>
      );
    }

    const weekDates = getWeekDates(selectedWeek);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Group reports by producer and market type
    const groupedReports = reports.reduce((acc, report) => {
      const key = report.agentEmail;
      if (!acc[key]) {
        acc[key] = {
          agentName: report.agentName,
          agentEmail: report.agentEmail,
          markets: {}
        };
      }
      acc[key].markets[report.marketType] = report;
      return acc;
    }, {} as any);

    return (
      <div className="space-y-6">
        {Object.entries(groupedReports).map(([agentEmail, producerData]: [string, any]) => {
          const markets = ['plus', 'veteran'];
          const marketLabels = {
            plus: 'Plus',
            veteran: 'Veteran'
          };

          return (
            <div key={agentEmail} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* producer Header */}
              <div className="bg-gray-800 text-white px-6 py-3">
                <h3 className="text-lg font-semibold">{producerData.agentName}</h3>
                <p className="text-sm text-gray-300">{agentEmail}</p>
              </div>

              {/* Simple Table - One Row Per Market */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  {/* Header Row */}
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-3 text-left w-32">Market</th>
                      {weekDates.map((day, index) => (
                        <th key={index} className="border border-gray-300 p-2 text-center min-w-24">
                          <div className="text-sm font-medium">{day.month}/{day.date}</div>
                          <div className="text-xs text-gray-600">{day.dayName}</div>
                          <div className="text-xs text-gray-800 font-medium mt-1">D-R-B | A-P-S-ALP</div>
                        </th>
                      ))}
                      <th className="border border-gray-300 p-3 text-center w-32">
                        <div>Weekly Total</div>
                        <div className="text-xs text-gray-800 font-medium mt-1">D-R-B | A-P-S-ALP</div>
                      </th>
                    </tr>
                  </thead>
                  
                  {/* Market Rows */}
                  <tbody>
                    {markets.map(market => {
                      const report = producerData.markets[market];
                      return (
                        <tr key={market} className="border-b border-gray-200">
                          {/* Market Label */}
                          <td className="border border-gray-300 p-3 bg-gray-50">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                market === 'plus' ? 'bg-emerald-500' : 
                                market === 'veteran' ? 'bg-blue-500' : 
                                market === 'globe' ? 'bg-purple-500' : 'bg-orange-500'
                              }`}></div>
                              <span className="text-sm font-medium">
                                {marketLabels[market as keyof typeof marketLabels]}
                              </span>
                            </div>
                          </td>
                          
                          {/* Daily Data */}
                          {dayNames.map((day, dayIndex) => {
                            const dayMetrics = report?.dailyMetrics[day] || { 
                              reached: 0, appointments: 0, presentations: 0, sales: 0, alp: 0 
                            };
                            
                            return (
                              <td key={dayIndex} className="border border-gray-300 p-1 text-center">
                                <div className="text-xs">
                                  <div className="flex justify-center gap-1 flex-wrap">
                                    <span className="bg-blue-100 text-blue-800 px-1 rounded">{dayMetrics.dials || 0}</span>
                                    <span className="bg-blue-200 text-blue-800 px-1 rounded">{dayMetrics.reached}</span>
                                    <span className="bg-blue-300 text-blue-800 px-1 rounded">{dayMetrics.booked || 0}</span>
                                    <span className="mx-1 text-gray-400 font-bold">|</span>
                                    <span className="bg-green-100 text-green-800 px-1 rounded">{dayMetrics.appointments}</span>
                                    <span className="bg-purple-100 text-purple-800 px-1 rounded">{dayMetrics.presentations}</span>
                                    <span className="bg-orange-100 text-orange-800 px-1 rounded">{dayMetrics.sales}</span>
                                    <span className="bg-emerald-100 text-emerald-800 px-1 rounded font-medium">
                                      ${dayMetrics.alp > 0 ? Math.round(dayMetrics.alp).toLocaleString() : '0'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                          
                          {/* Weekly Total */}
                          <td className="border border-gray-300 p-2 text-center bg-gray-50">
                            {report ? (
                              <div className="text-xs">
                                <div className="flex justify-center gap-1 flex-wrap">
                                  <span className="bg-blue-200 text-blue-900 px-1 rounded font-medium">{report.weeklyTotals.dials || 0}</span>
                                  <span className="bg-blue-300 text-blue-900 px-1 rounded font-medium">{report.weeklyTotals.reached}</span>
                                  <span className="bg-blue-400 text-blue-900 px-1 rounded font-medium">{report.weeklyTotals.booked || 0}</span>
                                  <span className="mx-1 text-gray-500 font-bold">|</span>
                                  <span className="bg-green-200 text-green-900 px-1 rounded font-medium">{report.weeklyTotals.appointments}</span>
                                  <span className="bg-purple-200 text-purple-900 px-1 rounded font-medium">{report.weeklyTotals.presentations}</span>
                                  <span className="bg-orange-200 text-orange-900 px-1 rounded font-medium">{report.weeklyTotals.sales}</span>
                                  <span className="bg-emerald-200 text-emerald-900 px-1 rounded font-bold">
                                    ${Math.round(report.weeklyTotals.alp).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">No data</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* producer Total Row */}
                    <tr className="bg-gray-200 border-t-2 border-gray-400">
                      <td className="border border-gray-300 p-3 font-bold">producer Total</td>
                      {dayNames.map((day, dayIndex) => {
                        const dailyTotals = markets.reduce((acc, market) => {
                          const report = producerData.markets[market];
                          const dayMetrics = report?.dailyMetrics[day] || { dials: 0, reached: 0, booked: 0, appointments: 0, presentations: 0, sales: 0, alp: 0 };
                          return {
                            dials: acc.dials + (dayMetrics.dials || 0),
                            reached: acc.reached + dayMetrics.reached,
                            booked: acc.booked + (dayMetrics.booked || 0),
                            appointments: acc.appointments + dayMetrics.appointments,
                            presentations: acc.presentations + dayMetrics.presentations,
                            sales: acc.sales + dayMetrics.sales,
                            alp: acc.alp + dayMetrics.alp
                          };
                        }, { dials: 0, reached: 0, booked: 0, appointments: 0, presentations: 0, sales: 0, alp: 0 });
                        
                        return (
                          <td key={dayIndex} className="border border-gray-300 p-1 text-center">
                            <div className="text-xs">
                              <div className="flex justify-center gap-1 flex-wrap">
                                <span className="bg-blue-200 text-blue-900 px-1 rounded font-bold">{dailyTotals.dials || 0}</span>
                                <span className="bg-blue-300 text-blue-900 px-1 rounded font-bold">{dailyTotals.reached}</span>
                                <span className="bg-blue-400 text-blue-900 px-1 rounded font-bold">{dailyTotals.booked || 0}</span>
                                <span className="mx-1 text-gray-500 font-bold">|</span>
                                <span className="bg-green-200 text-green-900 px-1 rounded font-bold">{dailyTotals.appointments}</span>
                                <span className="bg-purple-200 text-purple-900 px-1 rounded font-bold">{dailyTotals.presentations}</span>
                                <span className="bg-orange-200 text-orange-900 px-1 rounded font-bold">{dailyTotals.sales}</span>
                                <span className="bg-emerald-200 text-emerald-900 px-1 rounded font-bold">
                                  ${Math.round(dailyTotals.alp).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      
                      {/* Grand Total */}
                      <td className="border border-gray-300 p-2 text-center bg-gray-300">
                        {(() => {
                          const weeklyTotals = markets.reduce((acc, market) => {
                            const report = producerData.markets[market];
                            return {
                              dials: acc.dials + (report?.weeklyTotals.dials || 0),
                              reached: acc.reached + (report?.weeklyTotals.reached || 0),
                              booked: acc.booked + (report?.weeklyTotals.booked || 0),
                              appointments: acc.appointments + (report?.weeklyTotals.appointments || 0),
                              presentations: acc.presentations + (report?.weeklyTotals.presentations || 0),
                              sales: acc.sales + (report?.weeklyTotals.sales || 0),
                              alp: acc.alp + (report?.weeklyTotals.alp || 0)
                            };
                          }, { dials: 0, reached: 0, booked: 0, appointments: 0, presentations: 0, sales: 0, alp: 0 });
                          
                          return (
                            <div className="text-xs">
                              <div className="flex justify-center gap-1 flex-wrap">
                                <span className="bg-blue-300 text-blue-900 px-1 rounded font-bold">{weeklyTotals.dials}</span>
                                <span className="bg-blue-400 text-blue-900 px-1 rounded font-bold">{weeklyTotals.reached}</span>
                                <span className="bg-blue-500 text-white px-1 rounded font-bold">{weeklyTotals.booked}</span>
                                <span className="mx-1 text-gray-600 font-bold">|</span>
                                <span className="bg-green-300 text-green-900 px-1 rounded font-bold">{weeklyTotals.appointments}</span>
                                <span className="bg-purple-300 text-purple-900 px-1 rounded font-bold">{weeklyTotals.presentations}</span>
                                <span className="bg-orange-300 text-orange-900 px-1 rounded font-bold">{weeklyTotals.sales}</span>
                                <span className="bg-emerald-300 text-emerald-900 px-1 rounded font-bold">
                                  ${Math.round(weeklyTotals.alp).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full p-2 space-y-2 bg-gray-50 min-h-screen">
      {/* Compact Header */}
      <div className="bg-white border p-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">WAR Reports - Weekly Activity Report</h1>
          <p className="text-xs text-gray-600">Performance Analytics & Team Metrics</p>
        </div>
        <Button 
          onClick={() => generateSampleDataMutation.mutate()}
          disabled={generateSampleDataMutation.isPending}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          {generateSampleDataMutation.isPending ? 'Generating...' : 'Generate Sample Data'}
        </Button>
      </div>

      {/* Compact Controls */}
      <div className="bg-white border p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Week Starting</label>
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full text-xs rounded border border-gray-300 px-2 py-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full text-xs rounded border border-gray-300 px-2 py-1"
            >
              {teamsData?.map(team => (
                <option key={team.teamName} value={team.teamName}>
                  {team.teamName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">producer</label>
            <select
              value={selectedproducer}
              onChange={(e) => setSelectedproducer(e.target.value)}
              className="w-full text-xs rounded border border-gray-300 px-2 py-1"
            >
              {membersData?.map(member => (
                <option key={member.agentEmail} value={member.agentEmail}>
                  {member.agentName} ({member.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Compact Report Tabs */}
      <Tabs defaultValue="producer" className="space-y-2">
        <div className="bg-white border">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="producer" className="text-xs flex items-center gap-1">
              <Users className="h-3 w-3" />
              producer Report
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs flex items-center gap-1">
              <Users className="h-3 w-3" />
              Team Report
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="producer" className="space-y-2">
          {isLoadingproducer ? (
            <div className="bg-white border p-3">
              <div className="text-center py-4 text-sm text-gray-500">Loading producer report...</div>
            </div>
          ) : (
            renderMetricsTable(producerReportData || [], `${selectedproducer.split('@')[0]} - Weekly Performance`)
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-2">
          {isLoadingTeam ? (
            <div className="bg-white border p-3">
              <div className="text-center py-4 text-sm text-gray-500">Loading team report...</div>
            </div>
          ) : (
            renderMetricsTable(teamReportData || [], `${selectedTeam} - Team Performance`)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}