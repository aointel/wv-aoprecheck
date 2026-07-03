import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { segmentedFetch } from '@/lib/queryClient';
import { 
  Phone, 
  Calendar, 
  BarChart3, 
  Target,
  Users,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface BusinessMetricTilesProps {
  agentEmail?: string;
}

interface DailyStats {
  total_dialed: number;
  reached: number;
  booked: number;
  presentations: number;
  sales: number;
  plus_leads: number;
  trends: {
    dialed: number;
    reached: number;
    booked: number;
    presentations: number;
    sales: number;
    plus_leads: number;
  };
}

export function BusinessMetricTiles({ agentEmail = 'cnsysop@aoglobelife.com' }: BusinessMetricTilesProps) {
  // Fetch live daily stats from the API - USER SPECIFIC
  const { data: dailyStats, isLoading } = useQuery({
    queryKey: ['/api/outbound-dialer/daily-stats', agentEmail],
    queryFn: async (): Promise<DailyStats> => {
      const queryParam = agentEmail ? `?userEmail=${encodeURIComponent(agentEmail)}` : '';
      const response = await segmentedFetch(`/api/outbound-dialer/daily-stats${queryParam}`);
      if (!response.ok) throw new Error('Failed to fetch daily stats');
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for live updates
    enabled: !!agentEmail, // Only run query if agentEmail is provided
  });

  // Use live data from enhanced API with real trends
  const businessMetrics = {
    dailyDials: dailyStats?.total_dialed || 0,
    dailyConnects: dailyStats?.reached || 0,
    appointmentsBooked: dailyStats?.booked || 0,
    presentationsCompleted: dailyStats?.presentations || 0, // Real data from accountability system
    policiesSold: dailyStats?.sales || 0, // Real data from accountability system
    plusLeadsCollected: dailyStats?.plus_leads || 0, // Real data from accountability system
    trends: {
      dials: dailyStats?.trends?.dialed || 0, // Real trend vs last week
      connects: dailyStats?.trends?.reached || 0, // Real trend vs last week
      appointments: dailyStats?.trends?.booked || 0, // Real trend vs last week
      presentations: dailyStats?.trends?.presentations || 0, // Real trend vs last week
      sales: dailyStats?.trends?.sales || 0, // Real trend vs last week
      plus_leads: dailyStats?.trends?.plus_leads || 0 // Real trend vs last week
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />;
  };

  const getTrendText = (trend: number) => {
    if (trend > 0) return `+${trend}`;
    if (trend < 0) return `${trend}`;
    return '0';
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="grid grid-cols-6 gap-4">
      {/* Dialed */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Dialed {isLoading && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-blue-800 dark:text-blue-200">
              {businessMetrics.dailyDials}
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(businessMetrics.trends.dials)}
              <span className={`text-sm font-semibold ${getTrendColor(businessMetrics.trends.dials)}`}>
                {getTrendText(businessMetrics.trends.dials)}
              </span>
            </div>
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            vs last week
          </div>
        </CardContent>
      </Card>

      {/* Reached */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Reached {isLoading && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-green-800 dark:text-green-200">
              {businessMetrics.dailyConnects}
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(businessMetrics.trends.connects)}
              <span className={`text-sm font-semibold ${getTrendColor(businessMetrics.trends.connects)}`}>
                {getTrendText(businessMetrics.trends.connects)}
              </span>
            </div>
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            vs last week
          </div>
        </CardContent>
      </Card>

      {/* Booked */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Booked {isLoading && <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-purple-800 dark:text-purple-200">
              {businessMetrics.appointmentsBooked}
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(businessMetrics.trends.appointments)}
              <span className={`text-sm font-semibold ${getTrendColor(businessMetrics.trends.appointments)}`}>
                {getTrendText(businessMetrics.trends.appointments)}
              </span>
            </div>
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            vs last week
          </div>
        </CardContent>
      </Card>

      {/* Presentations */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Presentations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-orange-800 dark:text-orange-200">
              {businessMetrics.presentationsCompleted}
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(businessMetrics.trends.presentations)}
              <span className={`text-sm font-semibold ${getTrendColor(businessMetrics.trends.presentations)}`}>
                {getTrendText(businessMetrics.trends.presentations)}
              </span>
            </div>
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
            vs last week
          </div>
        </CardContent>
      </Card>

      {/* Sales */}
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-200">
              {businessMetrics.policiesSold}
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(businessMetrics.trends.sales)}
              <span className={`text-sm font-semibold ${getTrendColor(businessMetrics.trends.sales)}`}>
                {getTrendText(businessMetrics.trends.sales)}
              </span>
            </div>
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            vs last week
          </div>
        </CardContent>
      </Card>

      {/* Plus Leads */}
      <Card className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 border-pink-200 dark:border-pink-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-pink-700 dark:text-pink-300 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Plus Leads {isLoading && <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-pink-800 dark:text-pink-200">
              {businessMetrics.plusLeadsCollected}
            </div>
            <div className="flex items-center gap-1">
              {getTrendIcon(businessMetrics.trends.plus_leads)}
              <span className={`text-sm font-semibold ${getTrendColor(businessMetrics.trends.plus_leads)}`}>
                {getTrendText(businessMetrics.trends.plus_leads)}
              </span>
            </div>
          </div>
          <div className="text-xs text-pink-600 dark:text-pink-400 mt-1">
            vs last week
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BusinessMetricTiles;