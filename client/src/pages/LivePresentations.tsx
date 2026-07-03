import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface LivePresentation {
  id: string;
  agent_email: string;
  agent_name: string;
  associate_id?: number;
  presentation_type: string;
  client_name?: string;
  started_at: string;
  duration_seconds: number;
  current_slide_number: number;
  current_slide_title?: string;
  viewer_count: number;
  current_screenshot_url?: string;
}

export function LivePresentationsPage() {
  const [selectedPresentation, setSelectedPresentation] = useState<string | null>(null);

  // Fetch active presentations
  const { data: activePresentations, refetch } = useQuery({
    queryKey: ['active-presentations'],
    queryFn: async () => {
      const response = await apiRequest('/api/presentations/active');
      return response.presentations as LivePresentation[];
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Fetch selected presentation details
  const { data: selectedSession } = useQuery({
    queryKey: ['presentation-session', selectedPresentation],
    queryFn: async () => {
      if (!selectedPresentation) return null;
      const response = await apiRequest(`/api/presentations/${selectedPresentation}`);
      return response.session;
    },
    enabled: !!selectedPresentation,
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Live Presentations Monitor
          </h1>
          <p className="text-slate-600">
            Real-time monitoring of active HPPRO presentations
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-6">
              <div className="text-3xl font-bold">{activePresentations?.length || 0}</div>
              <div className="text-purple-100">Active Presentations</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-6">
              <div className="text-3xl font-bold">
                {activePresentations?.reduce((sum, p) => sum + p.viewer_count, 0) || 0}
              </div>
              <div className="text-blue-100">Total Viewers</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-0">
            <CardContent className="p-6">
              <div className="text-3xl font-bold">
                {activePresentations?.filter(p => p.presentation_type === 'hppro').length || 0}
              </div>
              <div className="text-cyan-100">HPPRO Sessions</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Presentations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activePresentations && activePresentations.length > 0 ? (
            activePresentations.map((presentation) => (
              <Card key={presentation.id} className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-purple-200"
                onClick={() => setSelectedPresentation(presentation.id)}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{presentation.agent_name}</CardTitle>
                    <Badge className="bg-red-500 text-white animate-pulse">
                      🔴 LIVE
                    </Badge>
                  </div>
                  <CardDescription className="text-sm text-slate-600">
                    {presentation.agent_email}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Live Screenshot */}
                  {presentation.current_screenshot_url && (
                    <div className="mb-4 rounded-lg overflow-hidden border-2 border-purple-300">
                      <img 
                        src={presentation.current_screenshot_url} 
                        alt="Live presentation" 
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  {/* Presentation Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Duration:</span>
                      <span className="font-semibold">{formatDuration(presentation.duration_seconds)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-slate-600">Current Slide:</span>
                      <span className="font-semibold">Slide {presentation.current_slide_number}</span>
                    </div>
                    
                    {presentation.current_slide_title && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Topic:</span>
                        <span className="font-semibold text-purple-600">{presentation.current_slide_title}</span>
                      </div>
                    )}
                    
                    {presentation.client_name && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Client:</span>
                        <span className="font-semibold">{presentation.client_name}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-slate-600">Type:</span>
                      <Badge variant="outline" className="uppercase">{presentation.presentation_type}</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Watching:</span>
                      <span className="font-semibold">{presentation.viewer_count} manager(s)</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPresentation(presentation.id);
                    }}
                  >
                    Watch Live 👁️
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-2">
              <Card className="bg-white/50 border-dashed border-2 border-slate-300">
                <CardContent className="p-12 text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">
                    No Active Presentations
                  </h3>
                  <p className="text-slate-500">
                    When producers start presenting with HPPRO, they'll appear here
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Presentation Detail Modal */}
        {selectedPresentation && selectedSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-auto">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Live Presentation - {selectedSession.agent_name}</CardTitle>
                    <CardDescription className="text-purple-100">
                      {selectedSession.agent_email}
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="text-white hover:bg-white/20"
                    onClick={() => setSelectedPresentation(null)}
                  >
                    Close ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Live Screenshot - Large */}
                {selectedSession.live?.[0]?.current_screenshot_url && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">Current Slide</h3>
                      <Badge className="bg-red-500 text-white animate-pulse">🔴 LIVE</Badge>
                    </div>
                    <div className="rounded-lg overflow-hidden border-4 border-purple-400">
                      <img 
                        src={selectedSession.live[0].current_screenshot_url} 
                        alt="Live presentation slide" 
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                )}

                {/* Presentation Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-sm text-purple-600">Duration</div>
                    <div className="text-2xl font-bold">{formatDuration(selectedSession.duration_seconds || 0)}</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-600">Slides Shown</div>
                    <div className="text-2xl font-bold">{selectedSession.screenshots?.length || 0}</div>
                  </div>
                  <div className="bg-cyan-50 p-4 rounded-lg">
                    <div className="text-sm text-cyan-600">Current Slide</div>
                    <div className="text-2xl font-bold">#{selectedSession.live?.[0]?.current_slide_number || 1}</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-green-600">Viewers</div>
                    <div className="text-2xl font-bold">{selectedSession.live?.[0]?.viewer_count || 0}</div>
                  </div>
                </div>

                {/* Screenshot Timeline */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Slide History</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
                    {selectedSession.screenshots?.map((screenshot: any, index: number) => (
                      <div key={screenshot.id} className="relative group">
                        <div className="aspect-video bg-slate-200 rounded overflow-hidden border-2 border-slate-300 hover:border-purple-500 transition-colors">
                          <img 
                            src={screenshot.screenshot_data} 
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          #{screenshot.sequence_number}
                        </div>
                        {screenshot.slide_title && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {screenshot.slide_title}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

