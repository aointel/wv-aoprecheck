import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, PlayCircle, Clock, ArrowRight, ArrowLeft, Users, Phone, CheckSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { WalkthroughVideoPlayer } from "@/components/WalkthroughVideoPlayer";

interface WalkthroughVideo {
  id: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  category: "general" | "call_connector_pro" | "ao_precheck";
  orderIndex: number;
  duration: number;
  isRequired: boolean;
  isActive: boolean;
}

interface UserProgress {
  id: number;
  videoId: number;
  userEmail: string;
  watchTimeSeconds: number;
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
}

interface CompletionStatus {
  callConnectorProCompleted: boolean;
  aoPreCheckCompleted: boolean;
  generalWalkthroughCompleted: boolean;
  isFullyCompleted: boolean;
  systemAccessGranted: boolean;
}

export default function GettingStarted() {
  const [currentStep, setCurrentStep] = useState<"requirements" | "training">("requirements");
  const [activeCategory, setActiveCategory] = useState<"general" | "call_connector_pro" | "ao_precheck">("general");
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user email from auth context (this would come from your auth system)
  const userEmail = "cnsysop@aoglobelife.com"; // This should come from your auth context

  // Fetch walkthrough videos
  const { data: videos = [], isLoading: videosLoading } = useQuery<WalkthroughVideo[]>({
    queryKey: ['/api/walkthrough/videos'],
  });

  // Fetch user progress
  const { data: progress = [], isLoading: progressLoading } = useQuery<UserProgress[]>({
    queryKey: ['/api/walkthrough/progress', userEmail],
  });

  // Fetch completion status
  const { data: completion, isLoading: completionLoading } = useQuery<CompletionStatus>({
    queryKey: ['/api/walkthrough/completion', userEmail],
  });

  // Mutations for video interactions
  const startVideoMutation = useMutation({
    mutationFn: (videoId: number) => 
      fetch('/api/walkthrough/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, userEmail })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/walkthrough/progress', userEmail] });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ videoId, watchTime }: { videoId: number; watchTime: number }) =>
      fetch('/api/walkthrough/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, userEmail, watchTimeSeconds: watchTime })
      }).then(res => res.json()),
  });

  const completeVideoMutation = useMutation({
    mutationFn: (videoId: number) =>
      fetch('/api/walkthrough/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, userEmail })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/walkthrough/progress', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['/api/walkthrough/completion', userEmail] });
      toast({
        title: "Video Completed!",
        description: "Great job! Your progress has been saved.",
      });
    },
  });

  // Video handlers
  const handleVideoStart = (videoId: number) => {
    startVideoMutation.mutate(videoId);
  };

  const handleVideoProgress = (videoId: number, watchTime: number) => {
    updateProgressMutation.mutate({ videoId, watchTime });
  };

  const handleVideoComplete = (videoId: number) => {
    completeVideoMutation.mutate(videoId);
  };

  // Helper functions
  const getVideosByCategory = (category: string) => {
    return videos.filter(video => video.category === category && video.isActive)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const isVideoCompleted = (videoId: number) => {
    return progress.some(p => p.videoId === videoId && p.isCompleted);
  };

  const getVideoProgress = (videoId: number) => {
    return progress.find(p => p.videoId === videoId);
  };

  const getCompletedVideos = () => {
    return progress.filter(p => p.isCompleted).map(p => p.videoId);
  };

  const getCategoryProgress = (category: string) => {
    const categoryVideos = getVideosByCategory(category);
    const completedCount = categoryVideos.filter(video => isVideoCompleted(video.id)).length;
    return categoryVideos.length > 0 ? Math.round((completedCount / categoryVideos.length) * 100) : 0;
  };

  const getOverallProgress = () => {
    const allVideos = videos.filter(v => v.isActive && v.isRequired);
    const completedCount = allVideos.filter(video => isVideoCompleted(video.id)).length;
    return allVideos.length > 0 ? Math.round((completedCount / allVideos.length) * 100) : 0;
  };

  const categories = [
    {
      id: "general" as const,
      label: "General Overview",
      description: "Platform basics & fundamentals",
      icon: Users,
      color: "blue"
    },
    {
      id: "call_connector_pro" as const,
      label: "Call Connector Pro",
      description: "Master the calling system",
      icon: Phone,
      color: "green"
    },
    {
      id: "ao_precheck" as const,
      label: "AO PreCheck",
      description: "Lead verification & quality",
      icon: CheckSquare,
      color: "purple"
    }
  ];

  if (videosLoading || progressLoading || completionLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading training modules...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show requirements step
  if (currentStep === "requirements") {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Getting Started with AO Intelligence
          </h1>
          <p className="text-muted-foreground text-xl">
            Welcome! Let's get you set up for success.
          </p>
        </div>

        {/* Critical Setup Requirements */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-3 text-red-800 text-2xl">
              🛑 STOP - Critical Setup Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-700 space-y-6">
              <p className="font-semibold text-xl mb-6">
                Before you continue, make sure ALL of the following are completed:
              </p>
              
              <div className="grid gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white text-lg flex items-center justify-center flex-shrink-0 mt-1">1</div>
                  <div>
                    <p className="font-bold text-lg">YOU ARE LOGGED IN ON YOUR @aoglobelife.com EMAIL</p>
                    <p className="text-red-600 mt-1">Ensure you're signed into Chrome with your company email address</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white text-lg flex items-center justify-center flex-shrink-0 mt-1">2</div>
                  <div>
                    <p className="font-bold text-lg">ALL FIREWALLS ARE DISABLED</p>
                    <p className="text-red-600 mt-1 mb-3">This includes Windows Defender, antivirus software, and corporate firewalls</p>
                    <a 
                      href="https://support.microsoft.com/en-us/windows/turn-microsoft-defender-firewall-on-or-off-ec0844f7-aebd-0583-67fe-601ecf5d774f" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800 font-medium"
                    >
                      → How to disable Windows Defender Firewall
                    </a>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white text-lg flex items-center justify-center flex-shrink-0 mt-1">3</div>
                  <div>
                    <p className="font-bold text-lg">CHROME MUST BE YOUR DEFAULT BROWSER</p>
                    <p className="text-red-600 mt-1 mb-3">Set Chrome as your default browser for optimal performance</p>
                    <a 
                      href="https://support.google.com/chrome/answer/95417" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800 font-medium"
                    >
                      → How to set Chrome as default browser
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-100 border border-red-300 rounded-lg p-6 mt-8">
                <p className="font-bold text-red-800 mb-3 text-lg">⚠️ IMPORTANT:</p>
                <p className="text-red-700 text-lg">
                  If ANY of these items were not already completed, you MUST REBOOT YOUR COMPUTER after making the changes, 
                  then restart this setup process from the beginning.
                </p>
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0">
            <div className="flex justify-center mt-8">
              <Button 
                size="lg" 
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 text-lg"
                onClick={() => setCurrentStep("training")}
                data-testid="continue-to-training"
              >
                ✅ I've Completed All Requirements - Continue to Training
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-sm"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-40 h-40 bg-white/5 rounded-full blur-sm"></div>
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/10 rounded-full blur-sm"></div>
      </div>

      <div className="container mx-auto p-6 max-w-7xl relative z-10">
        {/* Training Header */}
        <div className="mb-8 text-center">
          <Button 
            variant="ghost" 
            onClick={() => setCurrentStep("requirements")}
            className="mb-4 text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Requirements
          </Button>
          <h1 className="text-4xl font-bold text-white mb-2">
            AO Intelligence Training Center
          </h1>
          <p className="text-white/70 text-lg mb-6">
            Elite producer Certification Program - Master the Platform
          </p>
          
          {/* Overall Progress */}
          <Card className="bg-white/10 backdrop-blur-sm border-0 shadow-xl max-w-md mx-auto">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400 mb-2">{getOverallProgress()}%</div>
                <Progress value={getOverallProgress()} className="w-full mb-2 bg-white/20" />
                <p className="text-sm text-white/70">
                  {getCompletedVideos().length} of {videos.filter(v => v.isActive && v.isRequired).length} modules completed
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Training Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar - Categories */}
          <div className="lg:col-span-1">
            <Card className="bg-white/10 backdrop-blur-sm border-0 shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-white">Elite Training Modules</CardTitle>
                <p className="text-sm text-white/70">Master each section to become certified</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-2">
                  {categories.map((category) => {
                    const progress = getCategoryProgress(category.id);
                    const Icon = category.icon;
                    const colorMap = {
                      blue: { bg: 'bg-blue-600', border: 'border-l-blue-400', text: 'text-blue-400' },
                      green: { bg: 'bg-emerald-600', border: 'border-l-emerald-400', text: 'text-emerald-400' },
                      purple: { bg: 'bg-purple-600', border: 'border-l-purple-400', text: 'text-purple-400' }
                    };
                    const colors = colorMap[category.color as keyof typeof colorMap];
                    
                    return (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`w-full text-left px-6 py-4 transition-all duration-300 border-l-4 ${
                          activeCategory === category.id 
                            ? `${colors.bg} text-white ${colors.border} shadow-lg transform scale-[1.02]` 
                            : `hover:bg-white/5 border-l-transparent hover:${colors.border}`
                        }`}
                        data-testid={`category-${category.id}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className={`w-5 h-5 ${activeCategory === category.id ? 'text-white' : colors.text}`} />
                          <div className="font-semibold text-base text-white">{category.label}</div>
                        </div>
                        <div className={`text-sm mb-3 ${activeCategory === category.id ? 'text-white/80' : 'text-white/60'}`}>
                          {category.description}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className={`text-lg font-bold ${activeCategory === category.id ? 'text-white' : colors.text}`}>
                            {progress}%
                          </div>
                          <div className={`text-xs ${activeCategory === category.id ? 'text-white/70' : 'text-white/50'}`}>
                            {getVideosByCategory(category.id).filter(v => isVideoCompleted(v.id)).length} of {getVideosByCategory(category.id).length}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Video List */}
          <div className="lg:col-span-3">
            {currentVideoId ? (
              <Card className="bg-white/10 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Elite Training Session</CardTitle>
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentVideoId(null)}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Back to Module
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <WalkthroughVideoPlayer
                    videoUrl={videos.find(v => v.id === currentVideoId)?.videoUrl || ""}
                    title={videos.find(v => v.id === currentVideoId)?.title || ""}
                    description={videos.find(v => v.id === currentVideoId)?.description || ""}
                    duration={videos.find(v => v.id === currentVideoId)?.duration || 0}
                    onStart={() => handleVideoStart(currentVideoId)}
                    onProgress={(time) => handleVideoProgress(currentVideoId, time)}
                    onComplete={() => handleVideoComplete(currentVideoId)}
                    canSkip={false}
                    minWatchPercentage={90}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/10 backdrop-blur-sm border-0 shadow-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
                <CardHeader className="relative z-10 bg-gradient-to-r from-blue-600/30 to-purple-600/30 backdrop-blur-sm">
                  <CardTitle className="flex items-center justify-between text-xl text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        {activeCategory === 'general' && <Users className="w-6 h-6" />}
                        {activeCategory === 'call_connector_pro' && <Phone className="w-6 h-6" />}
                        {activeCategory === 'ao_precheck' && <CheckSquare className="w-6 h-6" />}
                      </div>
                      {categories.find(c => c.id === activeCategory)?.label}
                    </div>
                    <div className="text-lg font-bold bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
                      {getCategoryProgress(activeCategory)}% Complete
                    </div>
                  </CardTitle>
                  <p className="text-white/80 mt-2">
                    {categories.find(c => c.id === activeCategory)?.description}
                  </p>
                </CardHeader>
                <CardContent className="p-6 relative z-10">
                  <div className="space-y-4">
                    {getVideosByCategory(activeCategory).map((video, index) => {
                      const isCompleted = isVideoCompleted(video.id);
                      const videoProgress = getVideoProgress(video.id);
                      
                      return (
                        <div
                          key={video.id}
                          className={`group relative overflow-hidden p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                            isCompleted 
                              ? "border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20" 
                              : "border-white/20 bg-white/5 hover:border-blue-400/50 hover:bg-white/10"
                          }`}
                          onClick={() => setCurrentVideoId(video.id)}
                          data-testid={`video-${video.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg backdrop-blur-sm ${
                              isCompleted 
                                ? "bg-emerald-500" 
                                : "bg-blue-500 group-hover:bg-blue-600"
                            }`}>
                              {isCompleted ? (
                                <CheckCircle className="w-6 h-6" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="font-bold text-lg text-white">{video.title}</h3>
                                {video.isRequired && (
                                  <Badge className="bg-yellow-500/90 text-black font-semibold">REQUIRED</Badge>
                                )}
                              </div>
                              <p className="text-white/70 text-base mb-3 leading-relaxed">
                                {video.description}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-white/60">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')} min</span>
                                </div>
                                {videoProgress && (
                                  <div className="text-white/50">
                                    Watch time: {Math.floor(videoProgress.watchTimeSeconds / 60)}:{(videoProgress.watchTimeSeconds % 60).toString().padStart(2, '0')}
                                  </div>
                                )}
                                {isCompleted ? (
                                  <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Certified</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-blue-400 font-semibold group-hover:text-blue-300">
                                    <PlayCircle className="w-4 h-4" />
                                    <span>Begin Training</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Success Message */}
        {completion?.isFullyCompleted && (
          <Card className="mt-8 bg-gradient-to-r from-emerald-500/20 to-green-600/20 backdrop-blur-sm border-emerald-400/50 border-2 shadow-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-600/20"></div>
            <CardContent className="pt-6 relative z-10">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-full mb-6">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  🏆 Elite producer Certified!
                </h2>
                <p className="text-white/80 text-lg">
                  You have successfully completed the AO Intelligence Elite Training Program. 
                  You now have full platform access and are certified to maximize your earning potential.
                </p>
                <div className="mt-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                  <p className="text-emerald-300 font-semibold">
                    Welcome to the elite ranks of AO Intelligence producers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}