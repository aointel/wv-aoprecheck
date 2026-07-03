import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { 
  Phone, 
  Users, 
  Clock,
  Search,
  Circle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  FastForward,
  User,
  Activity,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface AgentStatus {
  id?: string;
  name: string;
  email: string;
  status: 'idle' | 'dialing' | 'live' | 'presentation' | 'offline' | 'break' | 'online' | 'calling' | 'presenting' | 'active';
  currentCall?: {
    phoneNumber?: string;
    duration?: number;
    callSid?: string;
    clientName?: string;
    leadName?: string;
    direction?: string;
    callStatus?: string;
    startedAt?: string;
    answeredAt?: string;
  } | null;
  currentMeeting?: {
    type?: 'zoom' | 'aoi-meet';
    isActive?: boolean;
    title?: string;
    leadName?: string;
    joinUrl?: string;
    startTime?: Date | string;
    duration?: number;
  } | null;
  currentPresentation?: any;
  todayStats: {
    dialed: number;
    reached: number;
    booked: number;
    instantPresentation?: number;
    presentations?: number;
    sales?: number;
    alp?: number;
    connects?: number;
    missed?: number;
  };
  callTime?: number; // in seconds (from live_call_board table)
  connects?: number;
  lastActivity?: Date | string;
  breakReason?: string;
  breakDuration?: number; // in seconds
}

interface CallBoardStats {
  totalproducers: number;
  activeproducers: number;
  onlineproducers: number;
  callingproducers: number;
  totalCalls: number;
  activeCalls: number;
  totalDials: number;
  totalReached: number;
  totalBooked: number;
  totalConnects?: number;
  totalInstantPresentation?: number;
  totalMissedCalls?: number;
  avgCallTime: string;
}

// Format duration helper
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Format talk time helper
function formatTalkTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function LiveCallBoard() {
  const { authState } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeGranularity, setTimeGranularity] = useState<'days' | 'weeks' | 'months'>('days');

  // Fetch real-time call board statistics
  const { data: boardStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/live-call-board/stats'],
    queryFn: async (): Promise<CallBoardStats> => {
      const response = await fetch('/api/live-call-board/stats');
      if (!response.ok) throw new Error('Failed to fetch board stats');
      return response.json();
    },
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 0,
  });

  // Fetch real-time agent statuses
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/live-call-board/agents'],
    queryFn: async (): Promise<AgentStatus[]> => {
      const response = await fetch('/api/live-call-board/agents');
      if (!response.ok) throw new Error('Failed to fetch agent statuses');
      return response.json();
    },
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 0,
  });

  const defaultStats: CallBoardStats = {
    totalproducers: 0,
    activeproducers: 0,
    onlineproducers: 0,
    callingproducers: 0,
    totalCalls: 0,
    activeCalls: 0,
    totalDials: 0,
    totalReached: 0,
    totalBooked: 0,
    totalConnects: 0,
    totalInstantPresentation: 0,
    totalMissedCalls: 0,
    avgCallTime: '0:00',
    ...boardStats
  };

  // Calculate agent groups
  const agentsOnWork = agents?.filter(a => 
    a.status !== 'offline' && 
    a.status !== 'break' && 
    (a.status === 'online' || a.status === 'calling' || a.status === 'live' || a.status === 'dialing' || a.status === 'active' || a.status === 'presenting')
  ) || [];
  const agentsOnBreak = agents?.filter(a => a.status === 'break') || [];
  const agentsStartingCalls = agents?.filter(a => 
    a.status === 'dialing' || 
    (a.status === 'calling' && !a.currentCall)
  ) || [];
  const agentsOnCalls = agents?.filter(a => 
    (a.currentCall && a.currentCall.duration !== undefined) || 
    a.status === 'live' || 
    a.status === 'calling' ||
    a.status === 'presenting'
  ) || [];

  // Filter agents by search
  const filteredAgents = agents?.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  // Get user initials for avatar
  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get agent avatar color
  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500',
      'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'
    ];
    const index = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Call</h1>
              <p className="text-xs text-gray-500">Live Call Board</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Agent Status Summary */}
            <div className="flex items-center gap-3">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {agentsOnWork.slice(0, 3).map((agent, idx) => (
                    <div
                      key={idx}
                      className={`w-8 h-8 rounded-full ${getAvatarColor(agent.email)} flex items-center justify-center text-white text-xs font-medium border-2 border-white`}
                    >
                      {getUserInitials(agent.name)}
                    </div>
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {agentsOnWork.length} of {defaultStats.totalproducers} on work
                </span>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <span className="text-sm font-medium text-gray-700">
                  {agentsOnBreak.length} on break
                </span>
              </div>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium">
                {authState?.user?.email ? getUserInitials(authState.user.email.split('@')[0]) : 'U'}
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-900">
                  {authState?.user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-xs text-gray-500">Admin</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 p-6">
        {/* Main Content Area */}
        <div className="flex-1 space-y-6">
          {/* Statistics Section */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Statistics</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Date Selector */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                {Array.from({ length: 15 }, (_, i) => {
                  const date = new Date(selectedDate);
                  date.setDate(date.getDate() - 7 + i);
                  const isSelected = i === 7;
                  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = date.getDate();
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(date)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        isSelected
                          ? 'bg-teal-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="text-xs">{dayNum}</div>
                      <div className="text-xs">{dayName}</div>
                    </button>
                  );
                })}
              </div>

              {/* Time Granularity */}
              <div className="flex items-center gap-2 mb-4">
                {(['days', 'weeks', 'months'] as const).map((gran) => (
                  <button
                    key={gran}
                    onClick={() => setTimeGranularity(gran)}
                    className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                      timeGranularity === gran
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {gran.charAt(0).toUpperCase() + gran.slice(1)}
                  </button>
                ))}
                <div className="flex-1" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    className="pl-10 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Chart Placeholder */}
              <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Call activity chart</p>
                  <p className="text-xs mt-1">7am - 10pm</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ongoing Calls Section */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ongoing Calls</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agentsOnCalls.map((agent) => {
                  const callDuration = agent.currentCall?.duration || 0;
                  const totalTalkTime = agent.callTime || 0;
                  const agentId = agent.id || agent.email;
                  
                  return (
                    <div
                      key={agent.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {/* Agent Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-12 h-12 rounded-full ${getAvatarColor(agent.email)} flex items-center justify-center text-white font-semibold`}>
                          {getUserInitials(agent.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{agent.name}</div>
                          <div className="text-xs text-gray-500 truncate">{agent.email}</div>
                        </div>
                      </div>

                      {/* Current Call Duration */}
                      <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 rounded-lg">
                        <Phone className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-700">
                          {formatDuration(callDuration)}
                        </span>
                      </div>

                      {/* Call Statistics */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {agent.todayStats.dialed || 0}
                            </div>
                            <div className="text-xs text-gray-500">calls</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-red-600" />
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatTalkTime(totalTalkTime)}
                            </div>
                            <div className="text-xs text-gray-500">talk time</div>
                          </div>
                        </div>
                      </div>

                      {/* Associated Lead */}
                      {(agent.currentCall?.leadName || agent.currentCall?.clientName) && (
                        <div className="mb-3 p-2 bg-gray-50 rounded text-sm">
                          <div className="font-medium text-gray-900">
                            {agent.currentCall.leadName || agent.currentCall.clientName}
                          </div>
                          <div className="text-xs text-gray-500">Lead</div>
                        </div>
                      )}

                      {/* Status Indicators */}
                      <div className="flex items-center gap-1 mb-2">
                        <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                        <Circle className="h-2 w-2 fill-red-500 text-red-500" />
                        <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
                        <Circle className="h-2 w-2 fill-gray-400 text-gray-400" />
                      </div>

                      {/* ID */}
                      <div className="text-xs text-gray-400">ID {agentId.slice(-5)}</div>
                    </div>
                  );
                })}
              </div>

              {agentsOnCalls.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No ongoing calls</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 space-y-4">
          {/* Starting Calls */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Starting calls</h3>
              <div className="space-y-3">
                {agentsStartingCalls.slice(0, 5).map((agent) => {
                  const agentId = agent.id || agent.email;
                  return (
                  <div key={agentId} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(agent.email)} flex items-center justify-center text-white text-xs font-medium`}>
                      {getUserInitials(agent.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{agent.name}</div>
                      <div className="text-xs text-gray-500">Dialing...</div>
                    </div>
                  </div>
                  );
                })}
                {agentsStartingCalls.length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">No agents starting calls</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Break */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Break</h3>
              <div className="space-y-3">
                {agentsOnBreak.slice(0, 5).map((agent) => {
                  const agentId = agent.id || agent.email;
                  return (
                  <div key={agentId} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(agent.email)} flex items-center justify-center text-white text-xs font-medium`}>
                      {getUserInitials(agent.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{agent.name}</div>
                      <div className="text-xs text-gray-500">
                        {agent.breakDuration ? formatDuration(agent.breakDuration) : '00:00'} • {agent.breakReason || 'Break'}
                      </div>
                    </div>
                  </div>
                  );
                })}
                {agentsOnBreak.length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-4">No agents on break</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Today's Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Dialed</span>
                  <span className="font-semibold text-gray-900">{defaultStats.totalDials}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Reached</span>
                  <span className="font-semibold text-gray-900">{defaultStats.totalReached}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Booked</span>
                  <span className="font-semibold text-gray-900">{defaultStats.totalBooked}</span>
                </div>
                {(defaultStats.totalConnects !== undefined && defaultStats.totalConnects > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Connects</span>
                    <span className="font-semibold text-gray-900">{defaultStats.totalConnects}</span>
                  </div>
                )}
                {(defaultStats.totalInstantPresentation !== undefined && defaultStats.totalInstantPresentation > 0) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Instant</span>
                    <span className="font-semibold text-gray-900">{defaultStats.totalInstantPresentation}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Avg Call Time</span>
                  <span className="font-semibold text-gray-900">{defaultStats.avgCallTime}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
