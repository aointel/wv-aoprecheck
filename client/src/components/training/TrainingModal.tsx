import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  Clock, 
  User, 
  Phone, 
  CheckSquare,
  X,
  ArrowRight,
  Trophy,
  ClipboardList,
  ExternalLink
} from 'lucide-react';
import { ProducerSetupModal } from '@/components/modals/AgentSetupModal';

interface TrainingTopic {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'interactive' | 'quiz';
  completed: boolean;
  content: string;
}

interface TrainingModule {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  topics: TrainingTopic[];
}

interface TrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: TrainingModule | null;
  onComplete: () => void;
}

interface VideoProgress {
  [topicId: string]: {
    watched: boolean;
    currentTime: number;
    duration: number;
    percentWatched: number;
  };
}

export function TrainingModal({ isOpen, onClose, module, onComplete }: TrainingModalProps) {
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [videoProgress, setVideoProgress] = useState<VideoProgress>({});
  const [isproducerSetupOpen, setIsproducerSetupOpen] = useState(false);

  if (!module) return null;

  const currentTopic = module.topics[activeTopicIndex];
  const Icon = module.icon;
  const allTopicsCompleted = module.topics.every(topic => completedTopics.includes(topic.id));

  const handleTopicComplete = (topicId: string) => {
    if (!completedTopics.includes(topicId)) {
      setCompletedTopics([...completedTopics, topicId]);
    }
    
    // Move to next topic if available
    if (activeTopicIndex < module.topics.length - 1) {
      setActiveTopicIndex(activeTopicIndex + 1);
    }
  };

  const handleModuleComplete = () => {
    onComplete();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-6xl h-[80vh] p-0 overflow-hidden border-4 border-transparent bg-gradient-to-r ${module.gradient} bg-clip-border`}>
        <div className="bg-white m-1 rounded-lg flex h-full overflow-hidden">
          {/* Left Sidebar - Topic Playlist */}
          <div className="w-80 bg-gray-50 border-r flex flex-col">
            {/* Header */}
            <div className={`p-6 bg-gradient-to-r ${module.gradient} text-white`}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{module.title}</h3>
                  <p className="text-white/80 text-sm">{module.subtitle}</p>
                </div>
              </div>
              
              <div className="text-sm text-white/90">
                {completedTopics.length} of {module.topics.length} topics completed
              </div>
              
              {/* Progress Bar */}
              <div className="mt-2 bg-white/20 rounded-full h-2">
                <div 
                  className="bg-white rounded-full h-2 transition-all duration-300"
                  style={{ width: `${(completedTopics.length / module.topics.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Topic List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {module.topics.map((topic, index) => {
                const isActive = index === activeTopicIndex;
                const isCompleted = completedTopics.includes(topic.id);
                const isAvailable = true; // All sections visible and accessible
                
                return (
                  <Card 
                    key={topic.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : isCompleted
                        ? 'bg-green-50 border-green-200'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setActiveTopicIndex(index)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted 
                              ? 'bg-green-500 text-white' 
                              : isActive 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <span className="text-xs font-semibold">{index + 1}</span>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium text-sm ${isActive ? 'text-blue-700' : ''}`}>
                              {topic.title}
                            </h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {topic.type}
                              </Badge>
                              <div className="flex items-center text-xs text-gray-500">
                                <Clock className="w-3 h-3 mr-1" />
                                {topic.duration}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {isActive && !isCompleted && (
                          <Play className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Module Complete Button */}
            {allTopicsCompleted && (
              <div className="p-4 border-t bg-white">
                <Button 
                  onClick={handleModuleComplete}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Complete {module.title}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Content Header */}
            <div className="p-6 border-b bg-white flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{currentTopic?.title}</h2>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <Badge variant="outline">{currentTopic?.type}</Badge>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {currentTopic?.duration}
                  </div>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="p-8">
                {currentTopic?.type === 'video' && (
                  <div className="space-y-6">
                    {/* Video Player */}
                    <div className="bg-black rounded-lg aspect-video overflow-hidden">
                      {currentTopic.type === 'video' ? (
                        <video 
                          className="w-full h-full"
                          controls
                          preload="metadata"
                          onError={(e) => console.error('Video error:', e)}
                          onLoadStart={() => console.log('Video loading started')}
                          onCanPlay={() => console.log('Video can play')}
                          onTimeUpdate={(e) => {
                            const video = e.target as HTMLVideoElement;
                            const currentTime = video.currentTime;
                            const duration = video.duration;
                            const percentWatched = (currentTime / duration) * 100;
                            
                            setVideoProgress(prev => ({
                              ...prev,
                              [currentTopic.id]: {
                                watched: percentWatched >= 95, // Consider 95% as watched
                                currentTime,
                                duration,
                                percentWatched
                              }
                            }));
                          }}
                          onEnded={() => {
                            setVideoProgress(prev => ({
                              ...prev,
                              [currentTopic.id]: {
                                ...prev[currentTopic.id],
                                watched: true,
                                percentWatched: 100
                              }
                            }));
                          }}
                        >
                          <source src={
                            module?.id === 'ao_precheck' && currentTopic.id === 'verification_overview'
                              ? "/AOI%20Pre-Check%20(ALPHA)-VEED%20(3)_1757097774423.mp4"
                              : "/ao_promo.mp4"
                          } type="video/mp4" />
                          <p>Your browser does not support the video tag. <a href={
                            module?.id === 'ao_precheck' && currentTopic.id === 'verification_overview'
                              ? "/AOI%20Pre-Check%20(ALPHA)-VEED%20(3)_1757097774423.mp4"
                              : "/ao_promo.mp4"
                          } target="_blank">Download the video</a></p>
                        </video>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center text-white">
                            <Play className="w-16 h-16 mx-auto mb-4 opacity-70" />
                            <p className="text-lg font-semibold">{currentTopic.title}</p>
                            <p className="text-gray-300">Click to play video content</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Video Description */}
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-gray-700 leading-relaxed">
                          {currentTopic.content}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {currentTopic?.type === 'interactive' && (
                  <Card>
                    <CardContent className="p-8">
                      {/* AOI Meet Interactive Content */}
                      {module.id === 'aoi_meet' && currentTopic.id === 'aoi_meet_practice' ? (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                            <Video className="w-8 h-8 text-purple-600" />
                          </div>
                          <h3 className="text-xl font-semibold">{currentTopic.title}</h3>
                          <p className="text-gray-600 max-w-md mx-auto">
                            {currentTopic.content}
                          </p>
                          <div className="mt-6">
                            <Button 
                              onClick={() => {
                                console.log('Opening AOI Meet Demo');
                                // Close training modal and navigate to a video conference demo
                                onClose();
                                window.open('https://whereby.com/aoi-meet-demo', '_blank');
                              }}
                              className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-90 text-white px-8 py-3 rounded-lg font-semibold"
                            >
                              <Video className="w-5 h-5 mr-2" />
                              Try Video Meeting Demo
                              <ExternalLink className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Opens a demo video meeting room for hands-on practice
                          </p>
                        </div>
                      ) : module.id === 'aoi_meet' ? (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                            <Video className="w-8 h-8 text-purple-600" />
                          </div>
                          <h3 className="text-xl font-semibold">{currentTopic.title}</h3>
                          <p className="text-gray-600 max-w-md mx-auto">
                            {currentTopic.content}
                          </p>
                          <div className="space-y-3 mt-6">
                            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                              <span>Camera & Audio Setup</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                              <span>Screen Sharing</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                              <span>Meeting Controls</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                              <span>Professional Etiquette</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                          </div>
                        </div>
                      ) : module.id === 'aoi_reporting' && currentTopic.id === 'aoi_report_practice' ? (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                            <ClipboardList className="w-8 h-8 text-orange-600" />
                          </div>
                          <h3 className="text-xl font-semibold">{currentTopic.title}</h3>
                          <p className="text-gray-600 max-w-md mx-auto">
                            {currentTopic.content}
                          </p>
                          <div className="mt-6">
                            <Button 
                              onClick={() => {
                                console.log('Opening AOI Report Page');
                                // Close training modal and navigate to AOI Report
                                onClose();
                                window.location.href = '/dashboard/aoi-report';
                              }}
                              className="bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-90 text-white px-8 py-3 rounded-lg font-semibold"
                            >
                              <ClipboardList className="w-5 h-5 mr-2" />
                              Practice with AOI Report
                              <ExternalLink className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Opens the AOI Report page with demo data for hands-on practice
                          </p>
                        </div>
                      ) : module.id === 'aoi_reporting' ? (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                            <ClipboardList className="w-8 h-8 text-orange-600" />
                          </div>
                          <h3 className="text-xl font-semibold">{currentTopic.title}</h3>
                          <p className="text-gray-600 max-w-md mx-auto">
                            {currentTopic.content}
                          </p>
                          <div className="space-y-3 mt-6">
                            <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                              <span>Sales Dispositions</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                              <span>Refusal Types</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                              <span>Follow-up Actions</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                              <span>ALP Entry Process</span>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                            <User className="w-8 h-8 text-amber-600" />
                          </div>
                          <h3 className="text-xl font-semibold">{currentTopic.title}</h3>
                          <p className="text-gray-600 max-w-md mx-auto">
                            {currentTopic.content}
                          </p>
                          <div className="space-y-3 mt-6">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span>Personal Information</span>
                              <Clock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span>Profile Picture Upload</span>
                              <Clock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                              <span>Communication Preferences</span>
                              <Clock className="w-5 h-5 text-amber-500" />
                            </div>
                          </div>
                          <div className="mt-6">
                            <Button 
                              onClick={() => {
                                console.log('Opening Producer Setup Modal');
                                setIsproducerSetupOpen(true);
                              }}
                              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white px-8 py-3 rounded-lg font-semibold"
                            >
                              <User className="w-5 h-5 mr-2" />
                              Open Producer Setup
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {currentTopic?.type === 'quiz' && (
                  <Card>
                    <CardContent className="p-8">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                          <CheckSquare className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold">{currentTopic.title}</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                          {currentTopic.content}
                        </p>
                        <Button className="mt-6 bg-green-600 hover:bg-green-700">
                          Take Quiz
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Bottom Action Area */}
              <div className="p-6 border-t bg-white">
                {!completedTopics.includes(currentTopic?.id) ? (
                  <div className="space-y-4">
                    {/* Video Progress Indicator */}
                    {currentTopic?.type === 'video' && (
                      <div className="text-center">
                        {videoProgress[currentTopic.id]?.watched ? (
                          <div className="text-green-600 font-semibold flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Video Completed - Ready to Continue!
                          </div>
                        ) : (
                          <div className="text-amber-600 font-medium flex items-center justify-center">
                            <Clock className="w-5 h-5 mr-2" />
                            Watch the complete video to continue
                            {videoProgress[currentTopic.id]?.percentWatched && (
                              <span className="ml-2">
                                ({Math.round(videoProgress[currentTopic.id].percentWatched)}% watched)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <Button 
                      onClick={() => handleTopicComplete(currentTopic.id)}
                      disabled={currentTopic?.type === 'video' && !videoProgress[currentTopic.id]?.watched}
                      className={`w-full py-3 text-lg font-semibold shadow-lg ${
                        currentTopic?.type === 'video' && !videoProgress[currentTopic.id]?.watched
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300'
                          : `bg-gradient-to-r ${module.gradient} hover:opacity-90 text-white`
                      }`}
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Mark Complete & Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-green-600 font-semibold">
                    <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                    Topic Completed!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      
      {/* Producer Setup Modal */}
      <ProducerSetupModal 
        isOpen={isproducerSetupOpen} 
        onClose={() => setIsproducerSetupOpen(false)}
      />
    </Dialog>
  );
}