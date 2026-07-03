import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Video, Users, Clock, CheckCircle, X, ChevronRight, StickyNote, UserCircle, FileText, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import type { RecruitCandidate } from '@shared/schema';
import { HorizontalJourneyTracker } from './HorizontalJourneyTracker';

// Live Timer Component - Updates every second
function LiveWaitingTimer({ startTime }: { startTime: Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calculateElapsed = () => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      return Math.floor((now - start) / 1000); // seconds
    };

    setElapsed(calculateElapsed());

    const interval = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (mins === 0) {
      return `${secs}s`;
    } else if (mins < 60) {
      return `${mins}m ${secs}s`;
    } else {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
  };

  const getTimerColor = () => {
    if (elapsed < 60) return 'text-green-600 dark:text-green-400'; // < 1 min - green
    if (elapsed < 300) return 'text-yellow-600 dark:text-yellow-400'; // < 5 min - yellow
    if (elapsed < 600) return 'text-orange-600 dark:text-orange-400'; // < 10 min - orange
    return 'text-red-600 dark:text-red-400'; // 10+ min - red
  };

  return (
    <div className="flex items-center gap-1.5">
      <Timer className={`h-4 w-4 ${getTimerColor()}`} />
      <span className={`font-mono font-semibold ${getTimerColor()}`}>
        {formatTime(elapsed)}
      </span>
    </div>
  );
}

interface RecruitConnection {
  id: number;
  candidateId: number;
  candidateName: string;
  candidatePhone: string | null;
  wherebyHostUrl: string;
  wherebyRoomUrl: string;
  questionnaireAnswers: string;
  createdAt: Date;
  status: string;
  videoSection1Watched?: boolean;
  videoSection2Watched?: boolean;
  question1Answered?: boolean;
  question2Answered?: boolean;
  question3Answered?: boolean;
  currentVideoChapter?: number;
  videoProgressPercent?: number;
}

interface RecruitConnectionQueueProps {
  agentEmail: string;
}

export function RecruitConnectionQueue({ agentEmail }: RecruitConnectionQueueProps) {
  const { toast } = useToast();
  const [activeCall, setActiveCall] = useState<RecruitConnection | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [quickNote, setQuickNote] = useState('');
  const [showFullCard, setShowFullCard] = useState(false);
  const [showScriptOverlay, setShowScriptOverlay] = useState(false);
  const [selectedScript, setSelectedScript] = useState<string>('');
  const [overlayPosition, setOverlayPosition] = useState({ x: window.innerWidth - 600, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Fetch full candidate data when in active call
  const { data: candidateData } = useQuery({
    queryKey: ['/api/recruit/candidates', activeCall?.candidateId],
    enabled: !!activeCall?.candidateId,
  });

  // Fetch pipeline stages
  const { data: stagesData } = useQuery({
    queryKey: ['/api/recruit/stages'],
    enabled: !!activeCall,
  });

  const stages = (stagesData as any)?.stages || [];
  const candidate: RecruitCandidate | undefined = (candidateData as any)?.candidates?.find(
    (c: RecruitCandidate) => c.id === activeCall?.candidateId
  );

  // Auto-set script to candidate's current stage when call starts
  useEffect(() => {
    if (candidate && candidate.currentStageId && !selectedScript) {
      const currentStage = stages.find((s: any) => s.id === candidate.currentStageId);
      if (currentStage) {
        setSelectedScript(currentStage.name);
      }
    }
  }, [candidate, stages, selectedScript]);

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

  // Poll for pending connections every 10 seconds
  const { data: connectionsData, isLoading } = useQuery({
    queryKey: ['/api/recruit/pending-connections', agentEmail],
    queryFn: async () => {
      const response = await fetch(`/api/recruit/pending-connections/${encodeURIComponent(agentEmail)}`);
      if (!response.ok) throw new Error('Failed to fetch connections');
      return response.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds
    enabled: !!agentEmail
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/recruit/update-connection-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/pending-connections', agentEmail] });
    }
  });

  const handleJoinRoom = (connection: RecruitConnection) => {
    // Mark as ready first (this triggers candidate's waiting room to auto-open Whereby)
    updateStatusMutation.mutate({ id: connection.id, status: 'ready' }, {
      onSuccess: (data) => {
        // Invalidate candidates query to refresh with newly created candidate
        queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
        
        // If a new candidate was created, update the connection with candidate ID
        if (data?.candidateId) {
          connection.candidateId = data.candidateId;
        }
        
        // Open embedded video room with client info
        setActiveCall(connection);
        toast({
          title: 'Joining video call',
          description: `Connecting with ${connection.candidateName}`,
        });
      }
    });
  };

  const handleDismiss = (connection: RecruitConnection) => {
    updateStatusMutation.mutate({ id: connection.id, status: 'cancelled' });
    toast({
      title: 'Connection dismissed',
      description: `${connection.candidateName} has been removed from queue`,
    });
  };

  const handleMoveStage = async () => {
    if (!candidate || !selectedStage) return;
    
    try {
      await apiRequest('POST', `/api/recruit/candidates/${candidate.id}/move-stage`, {
        toStageId: parseInt(selectedStage)
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      toast({
        title: 'Stage updated',
        description: 'Candidate moved to new stage',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update stage',
        variant: 'destructive',
      });
    }
  };

  const handleAddNote = async () => {
    if (!candidate || !quickNote.trim()) return;
    
    try {
      await apiRequest('POST', `/api/recruit/candidates/${candidate.id}/notes`, {
        content: quickNote,
        authorEmail: agentEmail,
      });
      setQuickNote('');
      toast({
        title: 'Note added',
        description: 'Call note saved successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add note',
        variant: 'destructive',
      });
    }
  };

  const connections: RecruitConnection[] = connectionsData?.connections || [];
  const pendingCount = connections.length;

  if (isLoading) {
    return (
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600 animate-pulse" />
            <CardTitle className="text-lg">Recruit Waiting Room</CardTitle>
          </div>
          <CardDescription>Loading candidates...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Recruit Waiting Room
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge className="bg-purple-600 text-white animate-pulse" data-testid="badge-waiting-count">
                {pendingCount} waiting
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          Candidates ready to connect with you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingCount === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400" data-testid="text-no-waiting">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No candidates waiting</p>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((connection) => {
              const answers = connection.questionnaireAnswers 
                ? JSON.parse(connection.questionnaireAnswers) 
                : {};
              
              return (
                <div
                  key={connection.id}
                  className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-purple-200 dark:border-purple-700 shadow-sm hover:shadow-md transition-shadow"
                  data-testid={`connection-card-${connection.id}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100" data-testid={`text-candidate-name-${connection.id}`}>
                          {connection.candidateName}
                        </h3>
                        {connection.candidatePhone && (
                          <p className="text-sm text-gray-600 dark:text-gray-400" data-testid={`text-candidate-phone-${connection.id}`}>
                            {connection.candidatePhone}
                          </p>
                        )}
                        <div className="mt-2" data-testid={`text-waiting-time-${connection.id}`}>
                          <LiveWaitingTimer startTime={new Date(connection.createdAt)} />
                        </div>
                      </div>
                    </div>

                    {/* Horizontal Journey Tracker - matches candidate experience */}
                    <div className="mt-3 pt-3 border-t border-purple-100 dark:border-purple-800">
                      <HorizontalJourneyTracker
                        videoSection1Watched={connection.videoSection1Watched}
                        videoSection2Watched={connection.videoSection2Watched}
                        question1Answered={connection.question1Answered}
                        question2Answered={connection.question2Answered}
                        question3Answered={connection.question3Answered}
                        currentVideoChapter={connection.currentVideoChapter}
                        videoProgress={connection.videoProgressPercent}
                      />
                    </div>

                    {/* Questionnaire Preview */}
                    {Object.keys(answers).length > 0 && (
                      <div className="text-xs space-y-1 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                        {answers.stoodOut && (
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Stood out:</span> {answers.stoodOut}
                          </p>
                        )}
                        {answers.goodFit && (
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Good fit:</span> {answers.goodFit}
                          </p>
                        )}
                        {answers.licensingInvestment && (
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Licensing investment:</span> {answers.licensingInvestment}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleJoinRoom(connection)}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                        data-testid={`button-join-${connection.id}`}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Join Now
                      </Button>
                      <Button
                        onClick={() => handleDismiss(connection)}
                        variant="outline"
                        className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                        data-testid={`button-dismiss-${connection.id}`}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Video Call Dialog with Client Info */}
      <Dialog open={!!activeCall} onOpenChange={(open) => !open && setActiveCall(null)}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0">
          <div className="flex h-full">
            {/* Client Info Sidebar */}
            <div className="w-96 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-purple-600" />
                  Candidate Info
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCall(null)}
                  data-testid="button-close-video"
                  className="hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-6 space-y-5">
              
              {activeCall && (
                <>
                  {/* Candidate Header Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {activeCall.candidateName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-xl text-gray-900 dark:text-white">
                          {activeCall.candidateName}
                        </h4>
                        {activeCall.candidatePhone && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                            <span className="text-gray-400">📞</span>
                            {activeCall.candidatePhone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pipeline Progress */}
                  {candidate && candidate.currentStageId && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border-l-4 border-blue-500 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                          Current Stage
                        </p>
                      </div>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-1">
                        {stages.find((s: any) => s.id === candidate.currentStageId)?.name || 'Unknown'}
                      </p>
                      {candidate.stageEnteredAt && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Since {new Date(candidate.stageEnteredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )}

                  {/* AI Summary - Simplified */}
                  {candidate?.aiSummary && (() => {
                    const summaryText = typeof candidate.aiSummary === 'string' 
                      ? candidate.aiSummary 
                      : String(candidate.aiSummary || '');
                    
                    if (!summaryText || !summaryText.trim()) {
                      return null;
                    }
                    
                    // Extract plain text from summary (handle JSON if needed)
                    let plainText = summaryText;
                    try {
                      const trimmed = summaryText.trim();
                      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                        const jsonData = JSON.parse(trimmed);
                        // Extract text from JSON structure
                        if (Array.isArray(jsonData)) {
                          plainText = jsonData
                            .map((item: any) => {
                              if (typeof item === 'string') return item;
                              if (item?.value) return item.value;
                              if (item?.key && item?.value) return `${item.key}: ${item.value}`;
                              return JSON.stringify(item);
                            })
                            .filter(Boolean)
                            .join('\n');
                        } else if (typeof jsonData === 'object') {
                          plainText = Object.entries(jsonData)
                            .filter(([_, v]) => v && typeof v === 'string')
                            .map(([k, v]) => `${k}: ${v}`)
                            .join('\n') || summaryText;
                        }
                      }
                    } catch (e) {
                      // Keep original text if parsing fails
                    }
                    
                    // Clean up the text - remove excessive formatting
                    plainText = plainText
                      .replace(/\*\*/g, '') // Remove bold markers
                      .replace(/^#+\s*/gm, '') // Remove markdown headers
                      .replace(/^[\-\*\•]\s*/gm, '') // Remove bullet points
                      .trim();
                    
                    return (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🤖</span>
                          <h5 className="font-semibold text-sm text-gray-900 dark:text-white">
                            AI Summary
                          </h5>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {plainText}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Questionnaire Answers */}
                  {activeCall.questionnaireAnswers && (() => {
                    const answers = JSON.parse(activeCall.questionnaireAnswers);
                    return Object.keys(answers).length > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                        <h5 className="font-bold text-base text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-green-500 flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-white" />
                          </div>
                          Questionnaire Results
                        </h5>
                        <div className="space-y-3">
                          {answers.stoodOut && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800">
                              <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1.5 uppercase tracking-wide">
                                What stood out about this opportunity?
                              </p>
                              <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                                {answers.stoodOut}
                              </p>
                            </div>
                          )}
                          {answers.goodFit && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
                              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1.5 uppercase tracking-wide">
                                Why would you be a good fit?
                              </p>
                              <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
                                {answers.goodFit}
                              </p>
                            </div>
                          )}
                          {answers.licensingInvestment && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800">
                              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5 uppercase tracking-wide">
                                Licensing investment readiness
                              </p>
                              <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed font-medium">
                                {answers.licensingInvestment}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white dark:bg-gray-800 px-3 text-gray-500 font-medium">
                        ACTIONS
                      </span>
                    </div>
                  </div>

                  {/* Pipeline Stage Control */}
                  {candidate && stages.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                      <h5 className="font-bold text-base text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <ChevronRight className="h-5 w-5 text-indigo-600" />
                        Move to Stage
                      </h5>
                      <div className="space-y-3">
                        <Select value={selectedStage} onValueChange={setSelectedStage}>
                          <SelectTrigger className="w-full h-11 bg-gray-50 dark:bg-gray-900" data-testid="select-pipeline-stage">
                            <SelectValue placeholder="Select stage..." />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map((stage: any) => (
                              <SelectItem key={stage.id} value={stage.id.toString()}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleMoveStage}
                          disabled={!selectedStage}
                          className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-md"
                          data-testid="button-move-stage"
                        >
                          <ChevronRight className="h-5 w-5 mr-2" />
                          Move to Stage
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Quick Note */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                    <h5 className="font-bold text-base text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <StickyNote className="h-5 w-5 text-amber-600" />
                      Quick Note
                    </h5>
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Add call notes..."
                        value={quickNote}
                        onChange={(e) => setQuickNote(e.target.value)}
                        rows={3}
                        className="text-sm bg-gray-50 dark:bg-gray-900 resize-none"
                        data-testid="textarea-quick-note"
                      />
                      <Button
                        onClick={handleAddNote}
                        disabled={!quickNote.trim()}
                        variant="outline"
                        className="w-full h-11 border-2 border-amber-600 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="button-add-note"
                      >
                        <StickyNote className="h-5 w-5 mr-2" />
                        Save Note
                      </Button>
                    </div>
                  </div>

                  {/* View Full Card */}
                  {candidate && (
                    <Button
                      onClick={() => {
                        setShowFullCard(true);
                        window.open(`/ao-recruit?candidateId=${candidate.id}`, '_blank');
                      }}
                      variant="outline"
                      className="w-full h-12 border-2 border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-semibold text-gray-900 dark:text-white shadow-sm"
                      data-testid="button-view-full-card"
                    >
                      <UserCircle className="h-5 w-5 mr-2" />
                      View Full Candidate Card
                    </Button>
                  )}
                </>
              )}
              </div>
            </div>

            {/* Whereby Video Embed */}
            <div className="flex-1 relative">
              {activeCall && (
                <iframe
                  src={activeCall.wherebyHostUrl}
                  allow="camera; microphone; fullscreen; speaker; display-capture"
                  className="w-full h-full"
                  data-testid="iframe-whereby-video"
                />
              )}

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
                              Hi <span className="font-medium">{activeCall ? activeCall.candidateName : (candidate ? `${candidate.firstName} ${candidate.lastName}` : '[Candidate Name]')}</span>, this is [Your Name] calling with AO Globe Life. The reason I am calling is you watched a brief overview on our company and I wanted to get to know you a little better. How are you today? Great!
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
                              Hi <span className="font-medium">{activeCall ? activeCall.candidateName : (candidate ? `${candidate.firstName} ${candidate.lastName}` : '[Candidate Name]')}</span>, thanks for reaching out to AO Globe Life! This is [Your Full Name] from our Human Resources department. I'm calling you back about the position you expressed interest in here in [City]. Is now still a good time to chat for a few minutes?
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
                              <div>Well <span className="font-medium">{activeCall ? activeCall.candidateName : (candidate ? `${candidate.firstName} ${candidate.lastName}` : '[Name]')}</span>, you sound like a really nice person. At this point I'm not sure if you're the right fit for our company though.</div>
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
                              <div>Now <span className="font-medium">{activeCall ? activeCall.candidateName : (candidate ? `${candidate.firstName} ${candidate.lastName}` : '[Name]')}</span>, it's a little difficult to go much further on the phone. But there's a few things in your background like [comment on work history and what they are looking for] that our manager would like to talk to you about.</div>
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
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
