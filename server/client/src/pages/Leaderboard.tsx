import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { FiPhone, FiUsers, FiTarget, FiTrendingUp } from 'react-icons/fi';

interface LeaderboardAgent {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  rank: number;
  revenue: number;
  calls: number;
  connections: number;
  appointments: number;
  streak: number;
  performance: number;
}

export default function Leaderboard() {
  console.log('🏆 Leaderboard page loaded');
  
  const [timeframe, setTimeframe] = useState('This Week');
  const [metric, setMetric] = useState('Annual Volume');

  // Fetch leaderboard data from API
  const { data: leaderboardResponse, isLoading, error } = useQuery({
    queryKey: ['/api/leaderboard/agents', timeframe, metric],
    enabled: true,
  });

  // Fallback to sample data if API fails
  const fallbackData: LeaderboardAgent[] = [
    {
      id: '1',
      name: 'Alfredo Gouse',
      email: 'alfredo@connectnow.com',
      avatar: '/api/placeholder/32/32',
      rank: 1,
      revenue: 18000,
      calls: 67,
      connections: 45,
      appointments: 23,
      streak: 5,
      performance: 92
    },
    {
      id: '2', 
      name: 'Marcus Kenter',
      email: 'marcus@connectnow.com',
      avatar: '/api/placeholder/32/32',
      rank: 2,
      revenue: 16000,
      calls: 58,
      connections: 38,
      appointments: 19,
      streak: 8,
      performance: 88
    },
    {
      id: '3',
      name: 'Alex Gilev',
      email: 'alex@connectnow.com', 
      avatar: '/api/placeholder/32/32',
      rank: 3,
      revenue: 14000,
      calls: 52,
      connections: 34,
      appointments: 17,
      streak: 3,
      performance: 85
    },
    {
      id: '4',
      name: 'Lincoln Aminoff',
      email: 'lincoln@connectnow.com',
      avatar: '/api/placeholder/32/32',
      rank: 4,
      revenue: 10000,
      calls: 43,
      connections: 28,
      appointments: 14,
      streak: 2,
      performance: 79
    },
    {
      id: '5',
      name: 'Craig Francis',
      email: 'craig@connectnow.com',
      avatar: '/api/placeholder/32/32',
      rank: 5,
      revenue: 10000,
      calls: 39,
      connections: 25,
      appointments: 12,
      streak: 4,
      performance: 76
    },
    {
      id: '6',
      name: 'Zaire Arcand',
      email: 'zaire@connectnow.com',
      avatar: '/api/placeholder/32/32',
      rank: 6,
      revenue: 6000,
      calls: 32,
      connections: 19,
      appointments: 8,
      streak: 1,
      performance: 71
    },
    {
      id: '7',
      name: 'Nolan Stanton',
      email: 'nolan@connectnow.com',
      avatar: '/api/placeholder/32/32',
      rank: 7,
      revenue: 3000,
      calls: 28,
      connections: 16,
      appointments: 6,
      streak: 2,
      performance: 68
    },
    {
      id: '8',
      name: 'Charles Miller',
      email: 'charles@connectnow.com',
      avatar: '/api/placeholder/32/32',
      rank: 8,
      revenue: 2400,
      calls: 24,
      connections: 14,
      appointments: 5,
      streak: 1,
      performance: 65
    }
  ];

  const leaderboardData = leaderboardResponse?.agents || fallbackData;
  const milestones = leaderboardResponse?.milestones || [10000, 14000, 16000, 18000];
  const topPerformers = leaderboardData.slice(0, 4);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: '🥇', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    if (rank === 2) return { icon: '🥈', bg: 'bg-gray-100 text-gray-800 border-gray-200' };
    if (rank === 3) return { icon: '🥉', bg: 'bg-orange-100 text-orange-800 border-orange-200' };
    return { icon: rank.toString(), bg: 'bg-blue-50 text-blue-700 border-blue-200' };
  };

  const getPerformanceIndicators = (agent: LeaderboardAgent) => {
    const indicators = [];
    if (agent.calls >= 50) indicators.push({ icon: <FiPhone className="w-3 h-3" />, count: agent.calls, color: 'text-blue-600' });
    if (agent.connections >= 30) indicators.push({ icon: <FiUsers className="w-3 h-3" />, count: agent.connections, color: 'text-green-600' });
    if (agent.appointments >= 15) indicators.push({ icon: <FiTarget className="w-3 h-3" />, count: agent.appointments, color: 'text-purple-600' });
    if (agent.streak >= 3) indicators.push({ icon: <FiTrendingUp className="w-3 h-3" />, count: agent.streak, color: 'text-orange-600' });
    return indicators.slice(0, 4);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
          <p className="text-muted-foreground">Track performance and celebrate achievements</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="This Week">This Week</SelectItem>
              <SelectItem value="This Month">This Month</SelectItem>
              <SelectItem value="This Quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={metric} onValueChange={setMetric}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Annual Volume">Annual Volume</SelectItem>
              <SelectItem value="Monthly Revenue">Monthly Revenue</SelectItem>
              <SelectItem value="Call Performance">Call Performance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progress Timeline */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold mb-1">Weekly Performance Goals</h2>
            <p className="text-sm text-muted-foreground">Aug 14-18</p>
          </div>
          
          {/* Horizontal Progress Timeline */}
          <div className="relative mb-6">
            <div className="absolute top-8 left-0 w-full h-0.5 bg-border rounded-full"></div>
            <div className="flex justify-between items-start relative">
              {milestones.map((milestone, index) => {
                const achieved = topPerformers[index]?.revenue >= milestone;
                const agent = topPerformers[index];
                return (
                  <div key={milestone} className="flex flex-col items-center min-w-0 flex-1">
                    {/* Agent Avatar and Info - Above the line */}
                    {agent && (
                      <div className="flex flex-col items-center mb-3">
                        <Avatar className="w-8 h-8 mb-1">
                          <AvatarFallback className="text-xs">
                            {agent.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-xs text-muted-foreground text-center">
                          ${agent.revenue.toLocaleString()}
                        </div>
                      </div>
                    )}
                    
                    {/* Progress Dot - On the line */}
                    <div className={`w-6 h-6 rounded-full border-2 ${achieved ? 'bg-primary border-primary' : 'bg-background border-border'} flex items-center justify-center relative z-10 mb-3`}>
                      {achieved && <div className="w-2 h-2 bg-primary-foreground rounded-full"></div>}
                    </div>
                    
                    {/* Milestone Label - Below the line */}
                    <div className="text-center">
                      <div className={`text-sm font-bold ${achieved ? 'text-primary' : 'text-muted-foreground'}`}>
                        ${milestone.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking List */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {leaderboardData.map((agent, index) => {
              const rankBadge = getRankBadge(agent.rank);
              const indicators = getPerformanceIndicators(agent);
              
              return (
                <div key={agent.id} className={`flex items-center justify-between p-4 ${index !== leaderboardData.length - 1 ? 'border-b' : ''} hover:bg-accent transition-colors`}>
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Rank */}
                    <Badge variant={agent.rank <= 3 ? "default" : "secondary"} className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                      {rankBadge.icon}
                    </Badge>
                    
                    {/* Avatar & Info */}
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>
                          {agent.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{agent.name}</h3>
                        <div className="flex items-center space-x-3 mt-1">
                          {indicators.map((indicator, i) => (
                            <div key={i} className={`flex items-center space-x-1 ${indicator.color}`}>
                              {indicator.icon}
                              <span className="text-xs font-medium">{indicator.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Revenue */}
                  <div className="text-right">
                    <div className="text-xl font-bold text-primary">
                      ${agent.revenue.toLocaleString()}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {agent.performance}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}