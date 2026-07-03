import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface AOIConnectData {
  associate_id: string;
  name: string;
  best_month_value: number;
  best_month_name: string;
  march_performance: number;
  april_performance: number;
  may_performance: number;
  december_performance: number;
  january_performance: number;
  february_performance: number;
  qualified: boolean;
  progress_percentage: number;
}

interface AOIConnectStatusProps {
  userEmail?: string;
}

export function AOIConnectStatus({ userEmail = 'cnsysop@aoglobelife.com' }: AOIConnectStatusProps) {
  const { data: aoiData, isLoading, refetch } = useQuery({
    queryKey: ['/api/aoi-connect/status', userEmail, Date.now()], // Force unique cache key
    queryFn: async (): Promise<AOIConnectData> => {
      const response = await fetch(`/api/aoi-connect/status?userEmail=${encodeURIComponent(userEmail)}&ts=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch AOI Connect status');
      const data = await response.json();
      // Reduced logging for cleaner console
      return data;
    },
    refetchInterval: false, // No auto-refresh - contest data is static
    staleTime: 300000, // Data is fresh for 5 minutes  
    retry: false
  });

  // Force refresh on mount
  React.useEffect(() => {
    refetch();
  }, [userEmail, refetch]);

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            AOI Connect Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle case where no performance data is available
  if (!aoiData || aoiData.best_month_value === 0) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            AOI Connect Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              No Performance Data Available
            </h3>
            <p className="text-sm text-gray-500">
              Contest performance data not found for this user. Check with your administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const target = 6000;
  const progressPercentage = Math.min(((aoiData?.best_month_value || 0) / target) * 100, 100);
  const isQualified = (aoiData?.best_month_value || 0) >= target;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Main AOI Connect Status */}
      <Card className={`border-2 ${isQualified ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className={`h-5 w-5 ${isQualified ? 'text-green-600' : 'text-blue-600'}`} />
              AOI Connect Access
            </div>
            <Badge variant={isQualified ? 'default' : 'secondary'} className={isQualified ? 'bg-green-600' : 'bg-blue-600'}>
              {isQualified ? 'UNLOCKED' : 'IN PROGRESS'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progress to AOI Connect</span>
              <span className="text-sm font-bold">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Best Month</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(aoiData?.best_month_value || 0)}
              </div>
              <div className="text-sm text-gray-600">{aoiData?.best_month_name || 'N/A'}</div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Target</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(target)}
              </div>
              <div className="text-sm text-gray-600">For AOI Connect</div>
              {!isQualified && (
                <div className="text-sm font-medium text-red-600 mt-1">
                  {formatCurrency(Math.max(0, target - (aoiData?.best_month_value || 0)))} to go
                </div>
              )}
            </div>
          </div>

          {isQualified ? (
            <div className="flex items-center gap-2 p-3 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800">AOI Connect Qualified!</span>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">
                Keep pushing toward your AOI Connect qualification
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Recent Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { month: 'March 2024', amount: aoiData?.march_performance || 0 },
            { month: 'April 2024', amount: aoiData?.april_performance || 0 },
            { month: 'May 2024', amount: aoiData?.may_performance || 0 },
            { month: 'February 2024', amount: aoiData?.february_performance || 0 },
            { month: 'January 2024', amount: aoiData?.january_performance || 0 },
            { month: 'December 2023', amount: aoiData?.december_performance || 0 },
          ]
          .filter(performance => performance.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 3)
          .map((performance, index) => (
            <div key={performance.month} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{performance.month}</span>
              </div>
              <div className={`font-bold ${index === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                {formatCurrency(performance.amount)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}