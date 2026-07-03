import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Phone, User, MapPin, Mail, Briefcase, ChevronLeft, ChevronRight, Power, PhoneOff, Bot, CheckCircle2, FileText, X } from 'lucide-react';
import { MdLocationOn, MdEmail, MdPhone, MdPerson, MdWork, MdSmartToy } from 'react-icons/md';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Candidate {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  position?: string;
  currentStageId?: number;
  status: string;
  notes?: string;
  source?: string;
}

export default function RecruitDialer() {
  const { authState } = useAuth();
  const { toast } = useToast();
  const userEmail = authState.user?.email;
  
  const [status, setStatus] = useState('Not Connected');
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [showScriptOverlay, setShowScriptOverlay] = useState(false);
  const [selectedScript, setSelectedScript] = useState<string>('');
  const [overlayPosition, setOverlayPosition] = useState({ x: window.innerWidth - 600, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const { data: candidatesData, isLoading } = useQuery({
    queryKey: ['/api/recruit/candidates', userEmail],
    queryFn: async () => {
      if (!userEmail) return { success: false, candidates: [] };
      const response = await fetch(`/api/recruit/candidates?email=${encodeURIComponent(userEmail)}`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Failed to fetch candidates');
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 30000
  });

  const { data: stagesData } = useQuery({
    queryKey: ['/api/recruit/stages']
  });

  // Candidates are already sorted by recency (most recent first) from the backend
  const candidates = (candidatesData as any)?.candidates || [];
  const stages = (stagesData as any)?.stages || [];
  
  console.log('🔍 RecruitDialer: Loaded', candidates.length, 'candidates');

  const currentCandidate = candidates[currentCandidateIndex];

  // Auto-set script to candidate's current stage when candidate changes
  useEffect(() => {
    if (currentCandidate && currentCandidate.currentStageId && stages.length > 0) {
      const currentStage = stages.find((s: any) => s.id === currentCandidate.currentStageId);
      if (currentStage) {
        setSelectedScript(currentStage.name);
      }
    }
  }, [currentCandidate, stages]);

  // Drag handlers for movable overlay
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - overlayPosition.x,
      y: e.clientY - overlayPosition.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setOverlayPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const getPipelineStats = () => {
    const stats = {
      aoRecruit: 0,
      firstInterview: 0,
      virtualOverview: 0,
      debrief: 0,
      groupFinal: 0,
      finalInterview: 0,
      hired: 0,
      total: candidates.length
    };

    stages.forEach((stage: any) => {
      const count = candidates.filter((c: Candidate) => c.currentStageId === stage.id).length;
      
      if (stage.name === 'AO Recruit') stats.aoRecruit = count;
      else if (stage.name === '1st Interview') stats.firstInterview = count;
      else if (stage.name === 'Virtual Overview') stats.virtualOverview = count;
      else if (stage.name === 'Debrief') stats.debrief = count;
      else if (stage.name === 'Group Final') stats.groupFinal = count;
      else if (stage.name === 'Final Interview') stats.finalInterview = count;
      else if (stage.name === 'Hired') stats.hired = count;
    });

    return stats;
  };

  const stats = getPipelineStats();

  // Get stage navigation info
  const getStageNavigation = () => {
    if (!currentCandidate || !currentCandidate.currentStageId) return null;
    
    const currentStageIndex = stages.findIndex((s: any) => s.id === currentCandidate.currentStageId);
    if (currentStageIndex === -1) return null;
    
    const currentStage = stages[currentStageIndex];
    const previousStage = currentStageIndex > 0 ? stages[currentStageIndex - 1] : null;
    const nextStage = currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;
    
    return { currentStage, previousStage, nextStage };
  };

  const stageNav = getStageNavigation();

  const moveCandidateStageMutation = useMutation({
    mutationFn: async ({ candidateId, stageId }: { candidateId: number, stageId: number }) => {
      return await apiRequest('POST', `/api/recruit/candidates/${candidateId}/move-stage`, { toStageId: stageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/stats'] });
      toast({
        title: "Stage Updated",
        description: "Candidate moved to new stage",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update stage",
        variant: "destructive",
      });
    }
  });

  const nextCandidate = () => {
    if (currentCandidateIndex < candidates.length - 1) {
      setCurrentCandidateIndex(currentCandidateIndex + 1);
      setNotes('');
    }
  };

  const previousCandidate = () => {
    if (currentCandidateIndex > 0) {
      setCurrentCandidateIndex(currentCandidateIndex - 1);
      setNotes('');
    }
  };

  const powerOn = async () => {
    console.log('🔌 Powering on Recruit Dialer...');
    setStatus('Ready');
    toast({
      title: "Dialer Ready",
      description: "Ready to call candidates",
    });
  };

  const powerOff = () => {
    setStatus('Not Connected');
    toast({
      title: "Dialer Offline",
      description: "Dialer powered off",
    });
  };

  const startCall = async () => {
    if (!currentCandidate) return;
    
    setStatus('Calling...');
    toast({
      title: "Calling",
      description: `Dialing ${currentCandidate.firstName} ${currentCandidate.lastName}`,
    });

    setTimeout(() => {
      setStatus('Connected');
      toast({
        title: "Connected",
        description: `Call connected`,
      });
    }, 2000);
  };

  const endCall = () => {
    setStatus('Ready');
    toast({
      title: "Call Ended",
      description: "Call disconnected",
    });
  };

  const saveNoteMutation = useMutation({
    mutationFn: async (data: { candidateId: number; content: string }) => {
      return await apiRequest('POST', '/api/recruit/notes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      setNotes('');
      toast({
        title: "Note Saved",
        description: "Call note saved successfully",
      });
    }
  });

  const saveNote = () => {
    if (!currentCandidate || !notes.trim()) return;
    saveNoteMutation.mutate({
      candidateId: currentCandidate.id,
      content: notes.trim()
    });
  };

  const isReady = status === 'Ready';
  const isConnected = status === 'Connected';
  const canCall = isReady && candidates.length > 0;

  const getTotalProgress = () => {
    if (stats.total === 0) return 0;
    const progressCount = stats.firstInterview + stats.virtualOverview + stats.debrief + 
                          stats.groupFinal + stats.finalInterview + stats.hired;
    return (progressCount / stats.total) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">AO Recruit Dialer</h2>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className={isReady || isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {status}
            </Badge>
            <Button
              onClick={() => setShowScriptOverlay(!showScriptOverlay)}
              variant="secondary"
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0"
              data-testid="button-toggle-script"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showScriptOverlay ? 'Hide Script' : 'View Script'}
            </Button>
            <Button 
              onClick={isReady || isConnected ? powerOff : powerOn}
              variant="secondary"
              size="sm"
              className={`${isReady || isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white border-0`}
              data-testid="button-power-toggle"
            >
              {isReady || isConnected ? (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Power Off
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Power On
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Pipeline Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recruitment Pipeline Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{Math.round(getTotalProgress())}%</span>
            </div>
            <Progress value={getTotalProgress()} className="h-2" />
          </div>

          <div className="grid grid-cols-7 gap-2">
            <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{stats.aoRecruit}</div>
              <div className="text-xs text-blue-600 font-medium">AO Recruit</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">{stats.firstInterview}</div>
              <div className="text-xs text-purple-600 font-medium">1st Interview</div>
            </div>
            <div className="text-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="text-2xl font-bold text-indigo-700">{stats.virtualOverview}</div>
              <div className="text-xs text-indigo-600 font-medium">Virtual Overview</div>
            </div>
            <div className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-200">
              <div className="text-2xl font-bold text-cyan-700">{stats.debrief}</div>
              <div className="text-xs text-cyan-600 font-medium">Debrief</div>
            </div>
            <div className="text-center p-3 bg-teal-50 rounded-lg border border-teal-200">
              <div className="text-2xl font-bold text-teal-700">{stats.groupFinal}</div>
              <div className="text-xs text-teal-600 font-medium">Group Final</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.finalInterview}</div>
              <div className="text-xs text-green-600 font-medium">Final Interview</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-700">{stats.hired}</div>
              <div className="text-xs text-emerald-600 font-medium">Hired</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Screening Results - Only show if current candidate has AI summary */}
      {currentCandidate && currentCandidate.aiSummary && (
        <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Bot className="h-6 w-6 text-blue-600" />
                AI Screening Results - First producer Interview
              </CardTitle>
              {currentCandidate.source && (
                <Badge className="bg-blue-600 text-white hover:bg-blue-700">
                  {currentCandidate.source}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const lines = currentCandidate.aiSummary.split('\n');
              const summaryData: Record<string, string> = {};
              
              lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed.includes(':')) {
                  const [key, ...valueParts] = trimmed.split(':');
                  summaryData[key.trim()] = valueParts.join(':').trim();
                }
              });

              return (
                <>
                  {summaryData['Background'] && (
                    <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-2 bg-blue-100 rounded-lg">
                          <User className="h-5 w-5 text-blue-700" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 mb-2">Candidate Background</h4>
                          <p className="text-gray-700 text-sm leading-relaxed">{summaryData['Background']}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {summaryData['Work From Home'] && (
                      <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 bg-green-100 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-green-700" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Work From Home</span>
                        </div>
                        <div className="text-lg font-bold text-green-700">{summaryData['Work From Home']}</div>
                      </div>
                    )}

                    {summaryData['Earning Interest'] && (
                      <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 bg-amber-100 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-amber-700" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Earning Interest</span>
                        </div>
                        <div className="text-lg font-bold text-amber-700">{summaryData['Earning Interest']}</div>
                      </div>
                    )}

                    {summaryData['Leadership Ready'] && (
                      <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 bg-purple-100 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-purple-700" />
                          </div>
                          <span className="text-xs font-medium text-gray-600">Leadership Ready</span>
                        </div>
                        <div className="text-lg font-bold text-purple-700">{summaryData['Leadership Ready']}</div>
                      </div>
                    )}
                  </div>

                  {summaryData['Status'] && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-900">{summaryData['Status']}</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Candidate List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Candidates ({candidates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="text-center py-4">Loading candidates...</div>
            ) : candidates.length > 0 ? (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {candidates.map((candidate: Candidate, index: number) => {
                  const isActive = index === 0;
                  const isSelected = currentCandidateIndex === index;
                  
                  return (
                  <div
                    key={candidate.id}
                    onClick={() => setCurrentCandidateIndex(index)}
                    className={`p-3 rounded-lg cursor-pointer transition-all border ${
                      isActive
                        ? isSelected
                          ? 'bg-green-100 border-green-500 shadow-md ring-2 ring-green-400'
                          : 'bg-green-50 border-green-400 shadow-sm hover:bg-green-100'
                        : isSelected
                        ? 'bg-purple-50 border-purple-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    data-testid={`candidate-item-${candidate.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {candidate.firstName} {candidate.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MdPhone className="h-3 w-3" />
                          {candidate.phone}
                        </div>
                        {candidate.position && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MdWork className="h-3 w-3" />
                            {candidate.position}
                          </div>
                        )}
                        {candidate.city && candidate.state && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MdLocationOn className="h-3 w-3" />
                            {candidate.city}, {candidate.state}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {isActive && (
                          <Badge className="bg-green-600 text-white border-0">Active</Badge>
                        )}
                        {isSelected && (
                          <Badge className="bg-purple-600 text-white border-0">Selected</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No candidates available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={startCall}
                disabled={!canCall || isConnected}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="button-start-call"
              >
                <Phone className="h-4 w-4 mr-2" />
                Start Call
              </Button>
              <Button
                onClick={endCall}
                disabled={!isConnected}
                variant="destructive"
                className="flex-1"
                data-testid="button-end-call"
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                End Call
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Call Notes</Label>
              <Textarea
                placeholder="Enter call notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                data-testid="input-call-notes"
              />
              <Button
                onClick={saveNote}
                disabled={!notes.trim() || !currentCandidate}
                className="w-full"
                variant="outline"
                data-testid="button-save-note"
              >
                Save Note
              </Button>
            </div>

            {/* Stage Navigation */}
            {stageNav && currentCandidate && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Move to Stage</Label>
                <div className="flex gap-2">
                  {stageNav.previousStage && (
                    <Button
                      onClick={() => moveCandidateStageMutation.mutate({ 
                        candidateId: currentCandidate.id, 
                        stageId: stageNav.previousStage.id 
                      })}
                      disabled={moveCandidateStageMutation.isPending}
                      variant="outline"
                      className="flex-1"
                      data-testid="button-move-stage-back"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {stageNav.previousStage.name}
                    </Button>
                  )}
                  {stageNav.nextStage && (
                    <Button
                      onClick={() => moveCandidateStageMutation.mutate({ 
                        candidateId: currentCandidate.id, 
                        stageId: stageNav.nextStage.id 
                      })}
                      disabled={moveCandidateStageMutation.isPending}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      data-testid="button-move-stage-forward"
                    >
                      {stageNav.nextStage.name}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isConnected && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="font-medium">Call in progress</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Script Overlay Panel - Draggable */}
      {showScriptOverlay && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div 
            className="absolute w-[600px] h-[80vh] bg-white dark:bg-gray-900 shadow-2xl rounded-lg overflow-hidden pointer-events-auto"
            style={{
              left: `${overlayPosition.x}px`,
              top: `${overlayPosition.y}px`,
              maxWidth: '600px',
              maxHeight: '80vh'
            }}
          >
            {/* Script Header - Drag Handle */}
            <div 
              className="bg-gradient-to-r from-orange-500 to-amber-600 p-5 flex items-center justify-between cursor-move"
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-white" />
                <h3 className="text-xl font-bold text-white">Interview Script</h3>
                <span className="text-xs text-white/70 ml-2">(drag to move)</span>
              </div>
              <Button
                onClick={() => setShowScriptOverlay(false)}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto h-[calc(80vh-80px)]">

              {/* Script Selector */}
              <div className="p-5 bg-orange-50 dark:bg-orange-900/20">
                <Select value={selectedScript} onValueChange={setSelectedScript}>
                  <SelectTrigger className="w-full h-12 bg-white dark:bg-gray-800 border-2 border-orange-400 dark:border-orange-600 text-lg font-semibold">
                    <SelectValue placeholder="Select interview stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.filter((s: any) => !s.isTerminal).map((stage: any) => (
                      <SelectItem key={stage.id} value={stage.name}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Script Content: Debrief */}
              {selectedScript === 'Debrief' && (
                <div className="p-4 space-y-3">
                {/* Opening */}
                <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                  <div className="mb-2 text-gray-900 dark:text-white">Opening</div>
                  <div className="text-gray-700 dark:text-gray-300">
                    Hi <span className="font-medium">{currentCandidate ? `${currentCandidate.firstName} ${currentCandidate.lastName}` : '[Candidate Name]'}</span>, this is [Your Name] calling with AO Globe Life. The reason I am calling is you watched a brief overview on our company and I wanted to get to know you a little better. How are you today? Great!
                  </div>
                </div>

                {/* Discovery */}
                <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                  <div className="mb-2 text-gray-900 dark:text-white">Discovery</div>
                  <div className="text-gray-700 dark:text-gray-300 space-y-2">
                    <div>"When you watched the company overview you expressed interest in moving forward in the interview process. What is it that stood out to you most about the opportunity? Anything else?"</div>
                    <div>"Do you currently hold a professional Life and Health insurance license in [State/Province]?"</div>
                    <div>If yes: "That's fantastic! Having your license already puts you in a great position to hit the ground running. Are you or have you ever been appointed with another insurance company before?"</div>
                    <div>If no: Walk through licensing process (40 hour online course, takes about a week to complete)</div>
                  </div>
                </div>

                {/* Qualifying */}
                <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                  <div className="mb-2 text-gray-900 dark:text-white">Qualifying</div>
                  <div className="text-gray-700 dark:text-gray-300">
                    "My question for you is why you? What sets you apart from everyone else applying for this position? Anything else?"
                  </div>
                </div>

                {/* Positive Feedback */}
                <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                  <div className="mb-2 text-gray-900 dark:text-white">Positive Feedback</div>
                  <div className="text-gray-700 dark:text-gray-300">
                    "Here are the things that stand out to me about you: [List what you like about the candidate]"
                  </div>
                </div>

                {/* Close - Group Final */}
                <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                  <div className="mb-2 text-gray-900 dark:text-white">Close: Group Final Interview</div>
                  <div className="text-gray-700 dark:text-gray-300 space-y-2">
                    <div>"After speaking with you, I feel comfortable moving forward with the interview process. The next step will be meeting with one of our top leaders in a Zoom interview. This interview will be with a few other candidates where we will go in depth about schedule, training, compensation, and promotion path."</div>
                    <div>"Right after, you will meet one-on-one with a senior leader to answer any additional questions you have and ultimately decide if this position is a mutual fit. This interview should take about an hour and our leadership team has time available [Day/Time]. I'd love to get you scheduled for that interview. How does that sound?"</div>
                    <div>Scheduling: "I'm going to send you a text message with a Calendly link. Click the link, select [Date/Time] and let me know once your spot has been confirmed!"</div>
                    <div>Reminders: Please dress professionally and join from a quiet space. Please join from a laptop or computer instead of your phone if you can. Please join five minutes early to check your audio and video settings.</div>
                  </div>
                </div>

                {/* Close - One-on-One Final */}
                <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                  <div className="mb-2 text-gray-900 dark:text-white">Close: One-on-One Final Interview</div>
                  <div className="text-gray-700 dark:text-gray-300 space-y-2">
                    <div>"After speaking with you, I feel comfortable moving forward with the interview process. What happens next is we set up a one-on-one zoom meeting where I will go in depth about schedule, training, compensation, promotion path, and address any questions you have. Once we go through this we will decide if this is a good mutual fit and come to a hiring decision."</div>
                    <div>"Now, I do have availability [Date/Time] or [Date/Time], which works best for you?"</div>
                    <div>Same scheduling process and reminders as above</div>
                  </div>
                  </div>
                </div>
              )}

              {/* Script Content: 1st Interview */}
              {selectedScript === '1st Interview' && (
                <div className="p-4 space-y-3">
                  {/* Opening */}
                  <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                    <div className="mb-2 text-gray-900 dark:text-white">Opening - INBOUND Call</div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Hi <span className="font-medium">{currentCandidate ? `${currentCandidate.firstName} ${currentCandidate.lastName}` : '[Candidate Name]'}</span>, thanks for reaching out to AO Globe Life! This is [Your Full Name] from our Human Resources department. I'm calling you back about the position you expressed interest in here in [City]. Is now still a good time to chat for a few minutes?
                    </div>
                  </div>

                  {/* Interest Check */}
                  <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                    <div className="mb-2 text-gray-900 dark:text-white">Resume Review</div>
                    <div className="text-gray-700 dark:text-gray-300">
                      Great! Our Regional Manager reviewed your background and was really impressed with your experience. They asked me to reach out to you directly to discuss moving forward with a personal interview. Before we do that, are you still actively looking for a new opportunity?
                    </div>
                  </div>

                  {/* Discovery Questions */}
                  <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                    <div className="mb-2 text-gray-900 dark:text-white">Discovery Questions</div>
                    <div className="text-gray-700 dark:text-gray-300 space-y-2">
                      <div>I have your resume, but can you tell me a little bit more about what you are doing now and what you are looking for?</div>
                      <div>Tell me about a time when you worked in a supervisory capacity or where you trained others. Were you actually responsible for other people's success? Tell me about that.</div>
                      <div>What would you say is your top strength?</div>
                      <div>You can imagine in my position, everybody says that. Can you please give me an example of when that has benefitted the bottom line of a company you worked for? Any other examples?</div>
                    </div>
                  </div>

                  {/* PEERS Checkpoint */}
                  <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                    <div className="mb-2 text-gray-900 dark:text-white">PEERS Checkpoint (3/5 to Proceed)</div>
                    <div className="text-gray-700 dark:text-gray-300 space-y-2">
                      <div>Positive and Professional</div>
                      <div>Energetic</div>
                      <div>Ethics and Work Ethic</div>
                      <div>Ready to Change</div>
                      <div>Super Attitude</div>
                    </div>
                  </div>

                  {/* Company Overview */}
                  <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                    <div className="mb-2 text-gray-900 dark:text-white">Company Overview</div>
                    <div className="text-gray-700 dark:text-gray-300 space-y-2">
                      <div>Well <span className="font-medium">{currentCandidate ? `${currentCandidate.firstName} ${currentCandidate.lastName}` : '[Name]'}</span>, you sound like a really nice person. At this point I'm not sure if you're the right fit for our company though.</div>
                      <div>Let me tell you a little bit about us. Again, our name is AO Globe Life. We work with an international company traded on the NYSE as Globe Life, with assets over several billion dollars. We work in the financial service industry providing personalized service to members of different groups throughout Canada, United States, New Zealand, Puerto Rico, Virgin Islands, and we just expanded our European operations.</div>
                      <div>More importantly, we are currently expanding here in [City] as a result of our explosive growth over the last ten years, particularly here in [State/Province]. Obviously we have multiple positions and permission to fill in our new division.</div>
                      <div>Now how long did you say you were at your last position?</div>
                    </div>
                  </div>

                  {/* Close */}
                  <div className="bg-white dark:bg-gray-800 p-4 border border-gray-300 dark:border-gray-600">
                    <div className="mb-2 text-gray-900 dark:text-white">Close - Virtual Overview</div>
                    <div className="text-gray-700 dark:text-gray-300 space-y-2">
                      <div>PAUSE 3 seconds</div>
                      <div>Now <span className="font-medium">{currentCandidate ? `${currentCandidate.firstName} ${currentCandidate.lastName}` : '[Name]'}</span>, it's a little difficult to go much further on the phone. But there's a few things in your background like [comment on work history and what they are looking for] that our manager would like to talk to you about.</div>
                      <div>What I'm going to do is send you a link to a Virtual Overview. It's about 12 minutes and will give you a detailed look at our company, the position, and what we offer. After you watch it, you'll just need to press Connect at the end, and we'll meet with you right afterwards to answer any questions and discuss next steps.</div>
                      <div>Does that work for you? Great! I'm sending that link to you now via text message. Watch for it and we'll talk to you soon!</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Placeholder for other scripts */}
              {selectedScript && selectedScript !== 'Debrief' && selectedScript !== '1st Interview' && (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold">Script for "{selectedScript}" coming soon</p>
                  <p className="text-sm mt-2">This interview script is being prepared</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
