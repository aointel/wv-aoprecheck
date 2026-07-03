import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  CheckCircle, 
  ArrowRight, 
  Clock, 
  Video, 
  Target,
  BookOpen,
  Trophy,
  Settings,
  User
} from 'lucide-react';
import { ProducerSetupModal } from '../modals/AgentSetupModal';
import { useAuth } from '@/hooks/use-auth';

interface VideoTrainingModuleProps {
  module: {
    id: string;
    title: string;
    description: string;
    videoUrl: string;
    videoDuration: string;
    estimatedPracticeTime: string;
    color: string;
  };
  onStartPractice: () => void;
  isCompleted?: boolean;
}

export function VideoTrainingModule({ module, onStartPractice, isCompleted = false }: VideoTrainingModuleProps) {
  const { authState } = useAuth();
  const [currentStep, setCurrentStep] = useState<'setup' | 'video' | 'practice' | 'completed'>('setup');
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [isProducerSetupModalOpen, setIsProducerSetupModalOpen] = useState(false);
  const [producerSetupCompleted, setproducerSetupCompleted] = useState(false);

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: {
        bg: 'from-blue-50 to-blue-100',
        border: 'border-blue-200',
        icon: 'bg-blue-100',
        button: 'bg-blue-600 hover:bg-blue-700',
        accent: 'text-blue-600'
      },
      emerald: {
        bg: 'from-emerald-50 to-emerald-100',
        border: 'border-emerald-200',
        icon: 'bg-emerald-100',
        button: 'bg-emerald-600 hover:bg-emerald-700',
        accent: 'text-emerald-600'
      },
      purple: {
        bg: 'from-purple-50 to-purple-100',
        border: 'border-purple-200',
        icon: 'bg-purple-100',
        button: 'bg-purple-600 hover:bg-purple-700',
        accent: 'text-purple-600'
      },
      orange: {
        bg: 'from-orange-50 to-orange-100',
        border: 'border-orange-200',
        icon: 'bg-orange-100',
        button: 'bg-orange-600 hover:bg-orange-700',
        accent: 'text-orange-600'
      }
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const colors = getColorClasses(module.color);

  // Check if Producer Setup is completed on load
  useEffect(() => {
    checkproducerSetup();
  }, [authState.user?.email]);

  const checkproducerSetup = async () => {
    try {
      const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(authState.user?.email || 'cnsysop@aoglobelife.com')}`);
      if (response.ok) {
        const profile = await response.json();
        if (profile && profile.firstName && profile.lastName && profile.phone) {
          setproducerSetupCompleted(true);
          setCurrentStep('video');
        }
      }
    } catch (error) {
      console.error('Failed to check Producer Setup:', error);
    }
  };

  const handleVideoComplete = () => {
    setVideoWatched(true);
    setVideoProgress(100);
    setCurrentStep('practice');
  };

  const handlePracticeStart = () => {
    onStartPractice();
  };

  const handleproducerSetupComplete = () => {
    setIsProducerSetupModalOpen(false);
    setproducerSetupCompleted(true);
    setCurrentStep('video');
  };

  const steps = [
    { id: 'setup', label: 'Producer Setup', icon: Settings, completed: producerSetupCompleted },
    { id: 'video', label: 'Watch Tutorial', icon: Video, completed: videoWatched },
    { id: 'practice', label: 'Practice Demo', icon: Target, completed: isCompleted },
    { id: 'completed', label: 'Mastery Achieved', icon: Trophy, completed: isCompleted }
  ];

  return (
    <Card className={`bg-gradient-to-br ${colors.bg} border-2 ${colors.border} shadow-lg overflow-hidden`}>
      
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center justify-between text-gray-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${colors.icon} rounded-xl flex items-center justify-center`}>
              <Video className={`w-6 h-6 ${colors.accent}`} />
            </div>
            {module.title}
          </div>
          {isCompleted && (
            <Badge className="bg-green-500 text-white font-semibold">
              <Trophy className="w-4 h-4 mr-1" />
              Mastered
            </Badge>
          )}
        </CardTitle>
        <p className="text-gray-600 mt-2">
          {module.description}
        </p>
      </CardHeader>

      <CardContent className="relative z-10 space-y-6">
        {/* Progress Steps - Horizontal Timeline */}
        <div className="space-y-4">
          <h4 className="text-gray-800 font-semibold">Training Progress</h4>
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0"></div>
            <div 
              className={`absolute top-4 left-4 h-0.5 ${colors.button.split(' ')[0]} z-0 transition-all duration-500`}
              style={{ 
                width: `${Math.max(0, (steps.findIndex(s => s.id === currentStep) / (steps.length - 1)) * 100)}%` 
              }}
            ></div>
            
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              
              return (
                <div key={step.id} className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white ${
                    step.completed ? 'bg-green-500 border-green-500' : 
                    isActive ? `${colors.button.split(' ')[0]} border-current` : 'bg-white border-gray-300'
                  }`}>
                    {step.completed ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <StepIcon className={`w-4 h-4 ${
                        isActive ? 'text-white' : 'text-gray-400'
                      }`} />
                    )}
                  </div>
                  <span className={`font-medium text-xs mt-2 text-center max-w-16 ${
                    step.completed ? 'text-green-600' :
                    isActive ? colors.accent : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                  {isActive && !step.completed && (
                    <Badge className="bg-yellow-500 text-black text-xs font-semibold mt-1">
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Producer Setup Section */}
        {currentStep === 'setup' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4 text-amber-600" />
                <p className="text-amber-800 font-medium text-sm">Producer Setup Required</p>
              </div>
              <p className="text-amber-700 text-xs mb-3">
                Complete your profile before starting training
              </p>
              <Button
                onClick={() => setIsProducerSetupModalOpen(true)}
                size="sm"
                className={`w-full ${colors.button} text-white`}
              >
                <User className="w-3 h-3 mr-2" />
                Setup Profile
              </Button>
            </div>
          </div>
        )}

        {/* Video Section */}
        {currentStep === 'video' && (
          <div className="space-y-3">
            <div className="p-3 bg-white/60 rounded-lg border border-gray-200">
              <h4 className="text-gray-800 font-medium text-sm mb-3">📹 Tutorial Video</h4>
              
              {/* Compact Video Player */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video 
                  className="w-full h-full"
                  controls
                  onTimeUpdate={(e) => {
                    const video = e.target as HTMLVideoElement;
                    const progress = (video.currentTime / video.duration) * 100;
                    setVideoProgress(progress);
                  }}
                  onEnded={handleVideoComplete}
                  poster="/api/placeholder/640/360"
                >
                  <source src={module.videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Compact video overlay */}
                {videoProgress === 0 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Play className="w-12 h-12 mx-auto mb-2 opacity-80" />
                      <p className="text-sm font-medium">{module.videoDuration}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Compact Video Progress */}
              {videoProgress > 0 && (
                <div className="mt-2">
                  <Progress value={videoProgress} className="h-1" />
                  <p className="text-xs text-gray-500 mt-1">{Math.round(videoProgress)}% complete</p>
                </div>
              )}
            </div>

            {/* Next Step Button */}
            {videoWatched && (
              <Button
                onClick={() => setCurrentStep('practice')}
                size="sm"
                className={`w-full ${colors.button} text-white`}
              >
                <Target className="w-3 h-3 mr-2" />
                Ready for Practice
              </Button>
            )}
          </div>
        )}

        {/* Practice Section */}
        {currentStep === 'practice' && (
          <div className="space-y-4">
            <div className="p-4 bg-white/10 rounded-lg">
              <h4 className="text-white font-semibold mb-3">🎯 Hands-On Practice</h4>
              <p className="text-white/80 mb-4">
                Now that you've watched the tutorial, it's time to practice! You'll work with realistic scenarios in a safe environment.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/70 mb-4">
                <div className="p-3 bg-white/10 rounded-lg text-center">
                  <div className={`w-8 h-8 ${colors.icon} rounded-full flex items-center justify-center mx-auto mb-2`}>
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-medium text-white">Interactive Practice</p>
                  <p>Real scenarios, no consequences</p>
                </div>
                <div className="p-3 bg-white/10 rounded-lg text-center">
                  <div className={`w-8 h-8 ${colors.icon} rounded-full flex items-center justify-center mx-auto mb-2`}>
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-medium text-white">Guided Learning</p>
                  <p>Step-by-step instructions</p>
                </div>
                <div className="p-3 bg-white/10 rounded-lg text-center">
                  <div className={`w-8 h-8 ${colors.icon} rounded-full flex items-center justify-center mx-auto mb-2`}>
                    <Trophy className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-medium text-white">Skill Building</p>
                  <p>Master through repetition</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handlePracticeStart}
              className={`w-full ${colors.button} text-white font-semibold text-lg py-6`}
            >
              <Play className="w-5 h-5 mr-3" />
              Start Practice Demo
              <ArrowRight className="w-5 h-5 ml-3" />
            </Button>
          </div>
        )}

        {/* Completion Section */}
        {currentStep === 'completed' && isCompleted && (
          <div className="text-center space-y-4">
            <div className="p-6 bg-green-500/20 rounded-lg border border-green-400/30">
              <Trophy className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-300 mb-2">Module Mastered!</h3>
              <p className="text-white/80">
                Excellent work! You've completed both the tutorial and practice sections.
              </p>
            </div>
            
            <Button
              onClick={handlePracticeStart}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Practice Again
            </Button>
          </div>
        )}
      </CardContent>
      
      {/* Producer Setup Modal */}
      <ProducerSetupModal 
        isOpen={isProducerSetupModalOpen} 
        onClose={handleproducerSetupComplete}
      />
    </Card>
  );
}