import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, Users, Clock, TrendingUp, PhoneOutgoing, Play, Presentation } from 'lucide-react';

interface producer {
  id: string;
  associateId: string;
  name: string;
  email: string;
  mgaTeam: string;
  status: 'online' | 'calling' | 'offline';
  currentCall?: {
    phoneNumber: string;
    duration: number;
    clientName?: string;
    direction: 'inbound' | 'outbound';
  };
  availableTime: number; // Time available today (not on calls)
  waitingTime: number; // Time since last call
  callTime: number; // Time on calls today
  connects: number; // Number of billable connects
}

export default function LiveCallBoardSimple() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // Fetch real-time producers
  const { data: producers, isLoading } = useQuery({
    queryKey: ['/api/live-call-board/agents'],
    queryFn: async (): Promise<producer[]> => {
      const response = await fetch('/api/live-call-board/agents');
      if (!response.ok) throw new Error('Failed to fetch producers');
      return response.json();
    },
    refetchInterval: 3000, // Real-time updates every 3 seconds
    staleTime: 0, // Always consider data stale - force fresh fetches // Real-time updates every 3 seconds
    staleTime: 0, // Always consider data stale - force fresh fetches
  });

  // Fetch VDP stats
  const { data: stats } = useQuery({
    queryKey: ['/api/live-call-board/stats'],
    queryFn: async (): Promise<{
      totalproducers: number;
      onlineproducers: number;
      callingproducers: number;
      avgCallTime: string;
      estimatedWaitTime: string;
    }> => {
      const response = await fetch('/api/live-call-board/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Fetch outbound calls
  const { data: outboundCalls } = useQuery({
    queryKey: ['/api/live-call-board/outbound-calls'],
    queryFn: async () => {
      const response = await fetch('/api/live-call-board/outbound-calls');
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 3000, // Real-time updates every 3 seconds
    staleTime: 0, // Always consider data stale - force fresh fetches
  });

  // Fetch outbound stats
  const { data: outboundStats } = useQuery({
    queryKey: ['/api/live-call-board/outbound-stats'],
    queryFn: async () => {
      const response = await fetch('/api/live-call-board/outbound-stats');
      if (!response.ok) return { totalDialed: 0, totalReached: 0, totalBooked: 0 };
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Fetch active presentations
  const { data: presentations } = useQuery({
    queryKey: ['/api/live-call-board/presentations'],
    queryFn: async () => {
      const response = await fetch('/api/live-call-board/presentations');
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 3000, // Real-time updates every 3 seconds
    staleTime: 0, // Always consider data stale - force fresh fetches
  });

  // Filter producers
  const filteredproducers = producers?.filter(producer =>
    producer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producer.mgaTeam.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Format time in seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🌐 Real-Time Activity Dashboard</h1>
            <p className="text-sm text-purple-100">Monitor all Producer Calls and presentations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <div className="text-2xl font-bold">{stats?.onlineproducers || 0}</div>
              <div className="text-xs">Online</div>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <div className="text-2xl font-bold text-red-300">{stats?.callingproducers || 0}</div>
              <div className="text-xs">VDP Calls</div>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2 border-l border-white/30">
              <div className="text-sm text-purple-100">Est. Wait</div>
              <div className="text-2xl font-bold text-yellow-300">{stats?.estimatedWaitTime || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Outbound Stats Bar */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneOutgoing className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">OUTBOUND ACTIVITY (TODAY)</h2>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{outboundStats?.totalDialed || 0}</div>
                <div className="text-xs text-gray-600">📞 Dialed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{outboundStats?.totalReached || 0}</div>
                <div className="text-xs text-gray-600">✅ Reached</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{outboundStats?.totalBooked || 0}</div>
                <div className="text-xs text-gray-600">📅 Booked</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search by Producer Name, email, or team..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* Active Outbound Calls */}
      {outboundCalls && outboundCalls.length > 0 && (
        <Card className="border-green-300 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
            <CardTitle className="flex items-center gap-2">
              <PhoneOutgoing className="w-5 h-5 text-green-600" />
              <span>ACTIVE OUTBOUND CALLS ({outboundCalls.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {outboundCalls.map((call: any) => (
                <Card key={call.callSid} className="border-2 border-green-400 bg-green-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Badge className={call.status === 'answered' ? 'bg-green-600' : 'bg-orange-500'}>
                          {call.status === 'answered' ? '🟢 LIVE' : '📞 DIALING'}
                        </Badge>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        {formatTime(call.duration || 0)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-gray-900">{call.agentName}</div>
                      <div className="text-sm text-gray-600">→ {call.leadName}</div>
                      <div className="text-xs font-mono text-gray-500">{call.leadPhone}</div>
                      {call.leadState && (
                        <div className="text-xs text-gray-500">📍 {call.leadState}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Presentations */}
      {presentations && presentations.length > 0 && (
        <Card className="border-purple-300 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="flex items-center gap-2">
              <Presentation className="w-5 h-5 text-purple-600" />
              <span>ACTIVE PRESENTATIONS ({presentations.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {presentations.map((pres: any) => (
                <Card key={pres.sessionId} className="border-2 border-purple-400 bg-purple-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Badge className="bg-purple-600">
                          🟣 {pres.presentationType.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        ⏱️ {formatTime(pres.duration || 0)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="font-bold text-gray-900">{pres.agentName}</div>
                      {pres.clientName && (
                        <div className="text-sm text-gray-700">
                          <span className="font-semibold">Client:</span> {pres.clientName}
                        </div>
                      )}
                      {pres.clientPhone && (
                        <div className="text-xs font-mono text-gray-600">{pres.clientPhone}</div>
                      )}
                      {pres.currentPhase && (
                        <div className="text-xs text-purple-700">
                          📊 Phase: {pres.currentPhase}
                        </div>
                      )}
                      {pres.latestScreenshot && (
                        <Button
                          size="sm"
                          className="w-full mt-2 bg-purple-600 hover:bg-purple-700"
                          onClick={() => setSelectedScreenshot(pres.latestScreenshot)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          View Current Slide
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VDP producers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Producers ({filteredproducers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    producer
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Team (MGA)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Current Client
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300" colSpan={3}>
                    Activity
                  </th>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <th colSpan={4}></th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-green-600 dark:text-green-400">
                    Available
                  </th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                    Waiting
                  </th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Connects
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredproducers.map((producer) => (
                  <tr
                    key={producer.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <Badge
                        variant={producer.status === 'calling' ? 'destructive' : producer.status === 'online' ? 'default' : 'secondary'}
                        className="animate-pulse"
                      >
                        {producer.status === 'calling' ? '🔴 ON CALL' : '🟢 ONLINE'}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {producer.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {producer.email}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {producer.mgaTeam}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {producer.currentCall ? (
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {producer.currentCall.clientName || 'Client'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {producer.currentCall.phoneNumber} • {formatTime(producer.currentCall.duration)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="text-sm font-mono font-semibold text-green-600 dark:text-green-400">
                        {formatTime(producer.availableTime || 0)}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="text-sm font-mono font-semibold text-yellow-600 dark:text-yellow-400">
                        {formatTime(producer.waitingTime || 0)}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {producer.connects || 0}
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredproducers.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      No Active Producers online
                    </td>
                  </tr>
                )}
                
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      Loading producers...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Online producers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">{stats?.onlineproducers || 0}</div>
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-xs text-slate-500 mt-1">of {stats?.totalproducers || 0} total</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Active Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-red-600">{stats?.callingproducers || 0}</div>
              <Phone className="h-8 w-8 text-red-400" />
            </div>
            <div className="text-xs text-slate-500 mt-1">live sessions</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Est. Wait Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-yellow-600">{stats?.estimatedWaitTime || '—'}</div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats?.estimatedWaitTime === '0:05' ? 'Immediate' : 
               stats?.estimatedWaitTime === 'N/A' ? 'No producers' : 'average'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Avg Call Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-600">{stats?.avgCallTime || '0:00'}</div>
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
            <div className="text-xs text-slate-500 mt-1">per call</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Total Connects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-purple-600">
                {producers?.reduce((sum, a) => sum + (a.connects || 0), 0) || 0}
              </div>
              <Users className="h-8 w-8 text-purple-400" />
            </div>
            <div className="text-xs text-slate-500 mt-1">today</div>
          </CardContent>
        </Card>
      </div>

      {/* Screenshot Viewer Modal */}
      <Dialog open={!!selectedScreenshot} onOpenChange={() => setSelectedScreenshot(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Current Presentation Slide</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {selectedScreenshot && (
              <img 
                src={selectedScreenshot} 
                alt="Presentation Screenshot" 
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

