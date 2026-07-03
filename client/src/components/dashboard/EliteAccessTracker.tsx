import React from 'react';
import { Crown, Lock, Unlock, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface MonthPerformance {
  month: string;
  year: number;
  alp: number;
  rank: number;
}

interface ElitePerformanceData {
  success: boolean;
  topMonths: MonthPerformance[];
  hasEliteAccess: boolean;
  targetALP: number;
}

interface EliteAccessTrackerProps {
  agentEmail: string;
  className?: string;
}

export function EliteAccessTracker({ agentEmail, className = "" }: EliteAccessTrackerProps) {
  console.log('🔄 EliteAccessTracker loading - Clean minimal design version');
  
  // Restore elite performance tracking
  const { data: eliteData, isLoading } = useQuery<ElitePerformanceData>({
    queryKey: [`/api/gamification/elite-performance`, agentEmail],
    enabled: !!agentEmail,
    refetchInterval: 60000, // Check every minute
  });

  if (isLoading) {
    return (
      <Card className={`relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl h-full ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-600/20"></div>
        <CardHeader className="relative z-10">
          <CardTitle className="text-xl flex items-center gap-3 text-purple-700 dark:text-purple-300">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
              <Crown className="h-6 w-6 text-purple-600" />
            </div>
            AOI Connect Access
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3">
          <div className="h-4 bg-white/60 dark:bg-slate-700/60 rounded animate-pulse"></div>
          <div className="h-4 bg-white/60 dark:bg-slate-700/60 rounded animate-pulse w-3/4"></div>
        </CardContent>
      </Card>
    );
  }

  const performanceData = eliteData?.topMonths || [];
  const TARGET_ALP = eliteData?.targetALP || 6000;
  const bestMonth = performanceData[0];
  const hasEliteAccess = eliteData?.hasEliteAccess || false;

  const progressPercentage = bestMonth ? Math.min((bestMonth.alp / TARGET_ALP) * 100, 100) : 0;
  const remainingAmount = bestMonth ? Math.max(TARGET_ALP - bestMonth.alp, 0) : TARGET_ALP;

  return (
    <Card className={`relative overflow-hidden bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-0 shadow-xl h-full ${className}`}>
      <div className={`absolute inset-0 ${
        hasEliteAccess 
          ? 'bg-gradient-to-br from-yellow-500/10 to-amber-600/20' 
          : 'bg-gradient-to-br from-purple-500/10 to-pink-600/20'
      }`}></div>
      
      {/* Subtle lock pattern overlay when locked */}
      {!hasEliteAccess && (
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-4 right-4 text-slate-600 dark:text-slate-400">
            <Lock className="h-24 w-24" />
          </div>
          <div className="absolute bottom-8 left-6 text-slate-600 dark:text-slate-400">
            <Lock className="h-16 w-16" />
          </div>
          <div className="absolute top-1/2 left-1/3 text-slate-600 dark:text-slate-400">
            <Lock className="h-12 w-12" />
          </div>
        </div>
      )}
      
      <CardHeader className="relative z-10">
        <CardTitle className={`text-xl flex items-center gap-3 ${
          hasEliteAccess 
            ? 'text-yellow-700 dark:text-yellow-300' 
            : 'text-purple-700 dark:text-purple-300'
        }`}>
          <div className={`p-2 rounded-xl ${
            hasEliteAccess 
              ? 'bg-yellow-100 dark:bg-yellow-900/50' 
              : 'bg-purple-100 dark:bg-purple-900/50'
          }`}>
            <Crown className={`h-6 w-6 ${
              hasEliteAccess ? 'text-yellow-600' : 'text-purple-600'
            }`} />
          </div>
          AOI Connect Access
          {hasEliteAccess && (
            <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
              UNLOCKED
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="relative z-10 space-y-6">
        {/* Progress Bar with Enhanced Design */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Progress to AOI Connect
            </span>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
              {progressPercentage.toFixed(0)}%
            </span>
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="relative h-4 bg-white/60 dark:bg-slate-700/60 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${
                hasEliteAccess 
                  ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-600' 
                  : 'bg-gradient-to-r from-purple-400 via-purple-500 to-pink-600'
              }`}
              style={{ width: `${progressPercentage}%` }}
            >
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
            </div>
            
            {/* Goal marker - clean version without lock icon */}
            <div className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
              <div className={`w-6 h-6 rounded-full border-2 shadow-md ${
                hasEliteAccess 
                  ? 'bg-yellow-500 border-yellow-400 shadow-yellow-300/50' 
                  : 'bg-slate-300 border-slate-400 shadow-slate-300/50'
              }`}></div>
            </div>
          </div>
        </div>

        {/* Performance Stats with Enhanced Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Best Month</div>
            <div className="font-bold text-xl text-slate-800 dark:text-slate-200">
              ${bestMonth ? bestMonth.alp.toLocaleString() : '0'}
            </div>
            {bestMonth && (
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {bestMonth.month} {bestMonth.year}
              </div>
            )}
          </div>
          
          <div className="bg-white/50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">Target</div>
            <div className="font-bold text-xl text-slate-800 dark:text-slate-200">
              ${TARGET_ALP.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              For AOI Connect
            </div>
          </div>
        </div>

        {/* Enhanced Status Message */}
        <div className={`text-center p-4 rounded-lg shadow-sm ${
          hasEliteAccess 
            ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800' 
            : 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
        }`}>
          {hasEliteAccess ? (
            <div className="flex items-center justify-center gap-2">
              <Unlock className="h-5 w-5" />
              <span className="font-bold text-lg">AOI Connect Qualified!</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <span className="font-bold text-lg">${remainingAmount.toLocaleString()} to go</span>
              </div>
              <div className="text-sm opacity-90 font-medium">
                Keep pushing toward your AOI Connect qualification
              </div>
            </div>
          )}
        </div>

        {/* Recent Performance with Enhanced Styling */}
        {performanceData.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Performance
            </div>
            <div className="space-y-2">
              {performanceData.slice(0, 3).map((month: MonthPerformance, index: number) => (
                <div key={`${month.month}-${month.year}`} className="flex items-center justify-between text-sm p-3 bg-white/40 dark:bg-slate-700/40 hover:bg-white/60 dark:hover:bg-slate-600/50 rounded-lg transition-colors border border-white/30 dark:border-slate-600/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-yellow-500 shadow-sm' : 
                      index === 1 ? 'bg-blue-500 shadow-sm' : 'bg-slate-400 shadow-sm'
                    }`}></div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {month.month} {month.year}
                    </span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    ${month.alp.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}