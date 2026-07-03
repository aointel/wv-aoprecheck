import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, PhoneCall, CheckCircle, Clock, TrendingUp, Users, Calendar, CalendarDays } from 'lucide-react';

interface CallStats {
  email: string;
  name: string;
  dials: number;
  reached: number;
  booked: number;
  reachRate: number;
  bookRate: number;
}

interface AnalyticsData {
  timeRange: string;
  lastUpdated: string;
  totals: {
    total_dials: number;
    total_reached: number;
    total_booked: number;
  };
  producers: CallStats[];
  dataSource: string;
  status: string;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

export function RealTimeCallBoard() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Build query parameters based on selected date range
  const getDateRangeParams = () => {
    const params = new URLSearchParams();
    
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      params.set('startDate', customStartDate);
      params.set('endDate', customEndDate);
    } else {
      params.set('range', dateRange);
    }
    
    return params.toString();
  };

  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics/live-stats', dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const queryParams = getDateRangeParams();
      const url = `/api/analytics/live-stats${queryParams ? `?${queryParams}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch call data');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
    refetchIntervalInBackground: true,
  });

  // Get display text for the current date range
  const getDateRangeDisplayText = () => {
    switch (dateRange) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${customStartDate} to ${customEndDate}`;
        }
        return 'Custom Range';
      default:
        return 'Today';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📞 Real-Time Call Monitoring Board
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4 animate-spin" />
            Loading live data...
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Call Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Failed to load real-time call monitoring data</p>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  const { totals, producers, lastUpdated } = analytics;
  const activeproducers = producers.filter(producer => producer.dials > 0);
  const inactiveproducers = producers.filter(producer => producer.dials === 0);

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selection */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              📞 Real-Time Call Monitoring Board
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Live tracking of Producer Calls: dials, reached, and booked
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </div>
        </div>

        {/* Date Range Controls */}
        <Card className="bg-gray-50 dark:bg-gray-900">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
              </div>
              
              <div className="flex gap-2">
                {(['today', 'week', 'month', 'custom'] as DateRange[]).map((range) => (
                  <Button
                    key={range}
                    variant={dateRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateRange(range)}
                    className="capitalize"
                  >
                    {range === 'custom' ? 'Custom' : range}
                  </Button>
                ))}
              </div>

              {dateRange === 'custom' && (
                <div className="flex items-center gap-2 ml-4">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-40"
                    placeholder="Start Date"
                  />
                  <span className="text-gray-500">to</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-40"
                    placeholder="End Date"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 border-l pl-4">
                <CalendarDays className="h-4 w-4" />
                <span>Showing data for: <strong>{getDateRangeDisplayText()}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <Phone className="h-5 w-5" />
              Total Dials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.total_dials}</div>
            <p className="text-blue-100 text-sm">All outbound calls {getDateRangeDisplayText().toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <PhoneCall className="h-5 w-5" />
              Reached (30s+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.total_reached}</div>
            <p className="text-green-100 text-sm">
              {totals.total_dials > 0 ? Math.round((totals.total_reached / totals.total_dials) * 100) : 0}% reach rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-white">
              <CheckCircle className="h-5 w-5" />
              Booked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.total_booked}</div>
            <p className="text-purple-100 text-sm">
              {totals.total_dials > 0 ? Math.round((totals.total_booked / totals.total_dials) * 100) : 0}% book rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Producers */}
      {activeproducers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Producers {getDateRangeDisplayText()}
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              producers with call activity in the current period
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeproducers.map((producer) => (
                <Card key={producer.email} className="border border-gray-200 dark:border-gray-700">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {producer.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {producer.email}
                      </p>
                      
                      <div className="grid grid-cols-3 gap-2 text-center mb-2">
                        <div>
                          <div className="text-xl font-bold text-blue-600">{producer.dials}</div>
                          <div className="text-xs text-gray-500">Dials</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-green-600">{producer.reached}</div>
                          <div className="text-xs text-gray-500">Reached</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-purple-600">{producer.booked}</div>
                          <div className="text-xs text-gray-500">Booked</div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Reach Rate: <span className="font-medium">{producer.reachRate}%</span></div>
                        <div>Book Rate: <span className="font-medium">{producer.bookRate}%</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inactive producers */}
      {inactiveproducers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Users className="h-5 w-5" />
              No Activity {getDateRangeDisplayText()}
            </CardTitle>
            <p className="text-sm text-gray-500">
              producers with no call activity in the current period
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {inactiveproducers.map((producer) => (
                <div key={producer.email} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="font-medium text-gray-700 dark:text-gray-300 text-sm">
                    {producer.name}
                  </div>
                  <div className="text-xs text-gray-500">{producer.email}</div>
                  <div className="text-xs text-gray-400 mt-1">0 dials</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Info */}
      <div className="flex flex-wrap justify-between items-center text-sm text-gray-500 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="flex items-center gap-4">
          <span>📊 Data source: {analytics.dataSource}</span>
          <span>🔄 Auto-refresh every 10 seconds</span>
        </div>
        <div>
          🎯 Tracking: Dials, Reached (30s+), Booked
        </div>
      </div>
    </div>
  );
}