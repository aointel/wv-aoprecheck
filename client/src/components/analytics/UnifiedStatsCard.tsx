import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Phone, UserCheck, Calendar } from 'lucide-react';

interface producer {
  email: string;
  name: string;
  dials: number;
  reached: number;
  booked: number;
  sales: number;
  reachRate: number;
  bookRate: number;
}

interface UnifiedStats {
  timeRange: string;
  lastUpdated: string;
  totals: {
    total_dials: number;
    total_reached: number;
    total_booked: number;
    total_sales: number;
  };
  producers: producer[];
}

interface UnifiedStatsCardProps {
  timeRange?: 'today' | 'week' | 'month';
}

export function UnifiedStatsCard({ timeRange = 'today' }: UnifiedStatsCardProps) {
  const { data: stats, isLoading, error, refetch } = useQuery<UnifiedStats>({
    queryKey: ['/api/analytics/live-stats'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/analytics/live-stats', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch live stats: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('🎯 LIVE stats received:', data);
        return data;
      } catch (error) {
        console.error('❌ Live stats error:', error);
        throw error;
      }
    },
    refetchInterval: 15000, // Real-time monitoring - refresh every 15 seconds
    refetchIntervalInBackground: true
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            LIVE Call Monitoring...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 mb-4">Failed to load team statistics</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const { totals, producers } = stats;
  const totalReachRate = totals.total_dials > 0 ? Math.round((totals.total_reached / totals.total_dials) * 100) : 0;
  const totalBookRate = totals.total_reached > 0 ? Math.round((totals.total_booked / totals.total_reached) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Team Totals Card */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">
            🎯 PERMANENT CALL MONITORING - LIVE DATA
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
            </span>
            <Button onClick={handleRefresh} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Phone className="h-6 w-6 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{totals.total_dials}</div>
              <div className="text-sm text-gray-500">Total Dials</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <UserCheck className="h-6 w-6 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">{totals.total_reached}</div>
              <div className="text-sm text-gray-500">Reached 30+s ({totalReachRate}%)</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Calendar className="h-6 w-6 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-600">{totals.total_booked}</div>
              <div className="text-sm text-gray-500">Booked ({totalBookRate}%)</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-6 w-6 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-orange-600">{totals.total_sales}</div>
              <div className="text-sm text-gray-500">Sales</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Producer Stats */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Individual Producer Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {producers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No Producer Activity found for {timeRange}
            </div>
          ) : (
            <div className="space-y-4">
              {producers.map((producer) => (
                <div key={producer.email} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{producer.name}</h3>
                      <p className="text-sm text-gray-500">{producer.email}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Reach Rate</div>
                      <div className="font-semibold">{producer.reachRate}%</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{producer.dials}</div>
                      <div className="text-xs text-gray-500">Dials</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">{producer.reached}</div>
                      <div className="text-xs text-gray-500">Reached</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">{producer.booked}</div>
                      <div className="text-xs text-gray-500">Booked</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-orange-600">{producer.sales}</div>
                      <div className="text-xs text-gray-500">Sales</div>
                    </div>
                  </div>
                  
                  {/* Progress bars */}
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Reach Rate: {producer.reachRate}%</span>
                      <span>Book Rate: {producer.bookRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${producer.reachRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}