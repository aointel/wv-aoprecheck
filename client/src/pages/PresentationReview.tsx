import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Play, Pause, SkipBack, SkipForward, Download } from 'lucide-react';

interface PresentationSession {
  id: string;
  agent_email: string;
  agent_name: string;
  associate_id?: number;
  presentation_type: string;
  presentation_url: string;
  client_name?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  total_slides_shown: number;
  status: string;
  ai_summary?: string;
  key_topics?: string[];
  engagement_score?: number;
  screenshots?: any[];
  kpis?: any[];
}

export function PresentationReviewPage() {
  const { authState } = useAuth();
  const [selectedproducer, setSelectedproducer] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<PresentationSession | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per slide

  // Fetch producer's own presentations or all (for managers)
  const { data: presentations, refetch } = useQuery({
    queryKey: ['producer-presentations', selectedproducer],
    queryFn: async () => {
      const email = selectedproducer === 'all' ? authState.user?.email : selectedproducer;
      if (!email) return [];
      
      const response = await apiRequest(`/api/presentations/agent/${email}`);
      return response.presentations as PresentationSession[];
    },
    enabled: !!authState.user?.email
  });

  // Auto-play slideshow
  useEffect(() => {
    if (!isPlaying || !selectedSession) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prev) => {
        if (prev >= (selectedSession.screenshots?.length || 0) - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, selectedSession, playbackSpeed]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredPresentations = presentations?.filter(p => 
    !searchTerm || 
    p.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSlide = selectedSession?.screenshots?.[currentSlideIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Presentation Review & Analytics
          </h1>
          <p className="text-slate-600">
            Review past presentations with AI-powered insights
          </p>
        </div>

        {!selectedSession ? (
          <>
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search</label>
                    <Input 
                      placeholder="Search by producer or client name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Filter by producer</label>
                    <Select value={selectedproducer} onValueChange={setSelectedproducer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select producer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All producers</SelectItem>
                        {/* Add Producer List here */}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Presentations List */}
            <div className="grid grid-cols-1 gap-4">
              {filteredPresentations && filteredPresentations.length > 0 ? (
                filteredPresentations.map((presentation) => (
                  <Card key={presentation.id} className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-400"
                    onClick={() => setSelectedSession(presentation)}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{presentation.agent_name}</h3>
                            <Badge variant={presentation.status === 'completed' ? 'default' : 'secondary'}>
                              {presentation.status}
                            </Badge>
                            {presentation.presentation_type === 'hppro' && (
                              <Badge className="bg-purple-600">HPPRO</Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-slate-500">Client:</span>
                              <div className="font-medium">{presentation.client_name || 'Not specified'}</div>
                            </div>
                            <div>
                              <span className="text-slate-500">Date:</span>
                              <div className="font-medium">{formatDate(presentation.started_at)}</div>
                            </div>
                            <div>
                              <span className="text-slate-500">Duration:</span>
                              <div className="font-medium">{formatDuration(presentation.duration_seconds)}</div>
                            </div>
                            <div>
                              <span className="text-slate-500">Slides:</span>
                              <div className="font-medium">{presentation.total_slides_shown} slides</div>
                            </div>
                          </div>

                          {presentation.ai_summary && (
                            <div className="bg-blue-50 p-3 rounded-lg mb-2">
                              <div className="text-xs text-blue-600 font-medium mb-1">AI Summary</div>
                              <p className="text-sm text-slate-700">{presentation.ai_summary}</p>
                            </div>
                          )}

                          {presentation.key_topics && presentation.key_topics.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              <span className="text-xs text-slate-500">Products:</span>
                              {presentation.key_topics.map((topic, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Thumbnail Preview */}
                        {presentation.screenshots && presentation.screenshots.length > 0 && (
                          <div className="ml-4">
                            <img 
                              src={presentation.screenshots[0].screenshot_data}
                              alt="First slide"
                              className="w-32 h-24 object-cover rounded border-2 border-slate-300"
                            />
                          </div>
                        )}
                      </div>

                      <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700">
                        Review Presentation →
                      </Button>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-white/50 border-dashed border-2">
                  <CardContent className="p-12 text-center">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      No Presentations Found
                    </h3>
                    <p className="text-slate-500">
                      Start presenting with HPPRO to see presentations here
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : (
          /* Presentation Player */
          <div className="space-y-6">
            <Button 
              variant="outline" 
              onClick={() => {
                setSelectedSession(null);
                setCurrentSlideIndex(0);
                setIsPlaying(false);
              }}
              className="mb-4"
            >
              ← Back to List
            </Button>

            <Card>
              <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedSession.agent_name}'s Presentation</CardTitle>
                    <div className="text-purple-100 mt-1">
                      {selectedSession.client_name && `Client: ${selectedSession.client_name} • `}
                      {formatDate(selectedSession.started_at)} • {formatDuration(selectedSession.duration_seconds)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">{selectedSession.total_slides_shown}</div>
                    <div className="text-purple-100 text-sm">Total Slides</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* Main Slide Viewer */}
                <div className="mb-6">
                  <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden border-4 border-purple-400 mb-4">
                    {currentSlide ? (
                      <img 
                        src={currentSlide.screenshot_data}
                        alt={`Slide ${currentSlideIndex + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        No slide available
                      </div>
                    )}
                  </div>

                  {/* Slide Info */}
                  {currentSlide && (
                    <div className="bg-slate-50 p-4 rounded-lg mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">
                          Slide {currentSlideIndex + 1} of {selectedSession.screenshots?.length || 0}
                        </h3>
                        <Badge className="bg-purple-600">{currentSlide.slide_type || 'Unknown'}</Badge>
                      </div>
                      
                      {currentSlide.slide_title && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-slate-600">Title: </span>
                          <span className="text-slate-900">{currentSlide.slide_title}</span>
                        </div>
                      )}

                      {currentSlide.slide_content && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-slate-600">Content: </span>
                          <p className="text-sm text-slate-700 mt-1">{currentSlide.slide_content}</p>
                        </div>
                      )}

                      {currentSlide.detected_products && currentSlide.detected_products.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          <span className="text-sm font-medium text-slate-600">Products:</span>
                          {currentSlide.detected_products.map((product: string, i: number) => (
                            <Badge key={i} variant="outline">{product}</Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 text-xs text-slate-500">
                        Time: {Math.floor(currentSlide.time_offset_seconds / 60)}:{(currentSlide.time_offset_seconds % 60).toString().padStart(2, '0')} into presentation
                      </div>
                    </div>
                  )}

                  {/* Playback Controls */}
                  <div className="flex items-center gap-4 bg-slate-100 p-4 rounded-lg">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                      disabled={currentSlideIndex === 0}
                    >
                      <SkipBack className="w-4 h-4" />
                    </Button>

                    <Button 
                      size="sm"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span className="ml-2">{isPlaying ? 'Pause' : 'Play'}</span>
                    </Button>

                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setCurrentSlideIndex(Math.min((selectedSession.screenshots?.length || 1) - 1, currentSlideIndex + 1))}
                      disabled={currentSlideIndex >= (selectedSession.screenshots?.length || 0) - 1}
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>

                    <div className="flex-1">
                      <div className="text-sm text-slate-600 mb-1">Slide {currentSlideIndex + 1} / {selectedSession.screenshots?.length || 0}</div>
                      <div className="w-full bg-slate-300 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${((currentSlideIndex + 1) / (selectedSession.screenshots?.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>

                    <Select value={playbackSpeed.toString()} onValueChange={(v) => setPlaybackSpeed(parseInt(v))}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="500">2x Speed</SelectItem>
                        <SelectItem value="1000">1x Speed</SelectItem>
                        <SelectItem value="2000">0.5x Speed</SelectItem>
                        <SelectItem value="5000">Slow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* KPIs and Analytics */}
                {selectedSession.kpis && selectedSession.kpis.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-lg mb-4">Presentation Analytics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-sm text-purple-600">Avg Time/Slide</div>
                        <div className="text-2xl font-bold">
                          {selectedSession.kpis[0].average_time_per_slide?.toFixed(1)}s
                        </div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-sm text-blue-600">Pricing Slides</div>
                        <div className="text-2xl font-bold">
                          {selectedSession.kpis[0].pricing_slides_shown || 0}
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-sm text-green-600">Flow Score</div>
                        <div className="text-2xl font-bold">
                          {((selectedSession.kpis[0].presentation_flow_score || 0) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="text-sm text-orange-600">Completion</div>
                        <div className="text-2xl font-bold">
                          {selectedSession.kpis[0].completion_percentage || 0}%
                        </div>
                      </div>
                    </div>

                    {selectedSession.kpis[0].products_covered && (
                      <div className="mt-4 bg-slate-50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-slate-600 mb-2">Products Covered</div>
                        <div className="flex gap-2 flex-wrap">
                          {selectedSession.kpis[0].products_covered.map((product: string, i: number) => (
                            <Badge key={i} className="bg-purple-600">{product}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Summary */}
                {selectedSession.ai_summary && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-lg mb-3">AI Analysis Summary</h3>
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg border-2 border-purple-200">
                      <p className="text-slate-800 leading-relaxed">{selectedSession.ai_summary}</p>
                    </div>
                  </div>
                )}

                {/* Slide Thumbnails Grid */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">All Slides ({selectedSession.screenshots?.length || 0})</h3>
                  <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-96 overflow-y-auto p-2">
                    {selectedSession.screenshots?.map((screenshot: any, index: number) => (
                      <div 
                        key={screenshot.id} 
                        className={`relative group cursor-pointer ${index === currentSlideIndex ? 'ring-4 ring-purple-500' : ''}`}
                        onClick={() => setCurrentSlideIndex(index)}
                      >
                        <div className="aspect-video bg-slate-200 rounded overflow-hidden border-2 border-slate-300 hover:border-purple-500 transition-colors">
                          <img 
                            src={screenshot.screenshot_data} 
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          #{index + 1}
                        </div>
                        {screenshot.slide_title && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {screenshot.slide_title}
                          </div>
                        )}
                        {screenshot.slide_type && (
                          <div className="absolute top-1 right-1 bg-purple-600 text-white text-xs px-1 py-0.5 rounded">
                            {screenshot.slide_type}
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

