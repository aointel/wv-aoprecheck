import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  CheckSquare, 
  Users, 
  Trophy,
  Play,
  Lock,
  Shield,
  Target,
  BookOpen,
  ArrowRight,
  Video,
  HelpCircle,
  User,
  CheckCircle,
  Clock,
  Star,
  ClipboardList
} from 'lucide-react';
import { HelpModal } from '@/components/training/HelpModal';
import { TrainingModal } from '@/components/training/TrainingModal';
import { ConnectNowLayout } from '@/components/layouts/ConnectNowLayout';

export default function TrainingPractice() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<any>(null);

  const trainingModules = [
    {
      id: 'welcome',
      title: 'Welcome',
      subtitle: 'Welcome to AO Intelligence',
      description: 'Your journey to success begins here - complete training foundation',
      duration: '17 min training',
      type: 'Foundation Training',
      status: 'available',
      gradient: 'from-blue-500 via-purple-600 to-indigo-700',
      icon: Star,
      features: [
        'Welcome message',
        'Company mission',
        'Platform optimization',
        'Credit management'
      ],
      topics: [
        {
          id: 'welcome_video',
          title: 'Welcome to AO Intelligence',
          duration: '3 min',
          type: 'video' as const,
          completed: false,
          content: 'Welcome to AO Intelligence! Your journey to success starts here.',
          videoRequired: true
        },
        {
          id: 'mission_video',
          title: 'Our Mission',
          duration: '4 min',
          type: 'video' as const,
          completed: false,
          content: 'Discover our mission and commitment to your success in the insurance industry.',
          videoRequired: true
        },
        {
          id: 'getting_most_video',
          title: 'Getting the Most out of AO Intelligence',
          duration: '5 min',
          type: 'video' as const,
          completed: false,
          content: 'Learn how to maximize your success using all AO Intelligence features and tools.',
          videoRequired: true
        },
        {
          id: 'credits_video',
          title: 'Understanding Credits',
          duration: '3 min',
          type: 'video' as const,
          completed: false,
          content: 'Master the credit system and learn how to manage your account efficiently.',
          videoRequired: true
        },
        {
          id: 'section_overview',
          title: 'Section Overview',
          duration: '2 min',
          type: 'video' as const,
          completed: false,
          content: 'Complete overview of what you\'ll learn and accomplish in your training journey.',
          videoRequired: true
        }
      ]
    },
    {
      id: 'agent_setup',
      title: 'Producer Setup',
      subtitle: 'Configure your profile',
      description: 'Set up your complete Producer Profile including personal information and preferences',
      duration: '5 min setup',
      type: 'Interactive Setup',
      status: 'available',
      gradient: 'from-amber-500 via-orange-600 to-red-700',
      icon: User,
      features: [
        'Personal information',
        'Profile picture upload',
        'Communication setup',
        'Preferences'
      ],
      topics: [
        {
          id: 'agent_setup_interactive',
          title: 'Complete Producer Setup',
          duration: '5 min',
          type: 'interactive' as const,
          completed: false,
          content: 'Set up your Producer Profile with personal information, profile picture, and communication preferences.'
        }
      ]
    },
    {
      id: 'call_connector_pro',
      title: 'Call Connector Pro',
      subtitle: 'AO Intelligence Platform',
      description: 'Master outbound calling and lead management with advanced AI-powered tools',
      duration: '30 min training',
      type: 'Core Training',
      status: 'available',
      gradient: 'from-blue-500 via-purple-600 to-indigo-700',
      icon: Phone,
      features: [
        'Lead management system',
        'Calling best practices',
        'Real-time coaching',
        'Performance analytics'
      ],
      topics: [
        {
          id: 'platform_overview',
          title: 'Platform Overview',
          duration: '5 min',
          type: 'video' as const,
          completed: false,
          content: 'Get familiar with the AO Intelligence interface, lead lists, and calling dashboard.'
        },
        {
          id: 'calling_best_practices',
          title: 'Calling Best Practices',
          duration: '8 min',
          type: 'video' as const,
          completed: false,
          content: 'Learn proven techniques for opening conversations, building rapport, and handling objections.'
        },
        {
          id: 'lead_management',
          title: 'Lead Management System',
          duration: '6 min',
          type: 'interactive' as const,
          completed: false,
          content: 'Master the lead workflow: filtering, prioritizing, and tracking your progress through the pipeline.'
        },
        {
          id: 'practice_calls',
          title: 'Practice Scenarios',
          duration: '10 min',
          type: 'interactive' as const,
          completed: false,
          content: 'Practice with realistic call scenarios and receive feedback on your performance.'
        },
        {
          id: 'knowledge_check',
          title: 'Knowledge Check',
          duration: '3 min',
          type: 'quiz' as const,
          completed: false,
          content: 'Test your understanding of the platform and calling techniques.'
        }
      ]
    },
    {
      id: 'ao_precheck',
      title: 'AO Pre-Check',
      subtitle: 'Verification & Compliance',
      description: 'The Pre-check process',
      duration: '15 min training',
      type: 'Verification Training',
      status: 'available',
      gradient: 'from-green-500 via-teal-600 to-blue-700',
      icon: Shield,
      features: [
        'The Pre-check process'
      ],
      topics: [
        {
          id: 'verification_overview',
          title: 'Verification Process Overview',
          duration: '4 min',
          type: 'video' as const,
          completed: false,
          content: 'AOI Pre-Check verification training video.'
        }
      ]
    },
    {
      id: 'aoi_meet',
      title: 'AOI: Meet',
      subtitle: 'Video Conferencing System',
      description: 'Learn the AOI Meet video conferencing system for conducting professional client meetings',
      duration: '12 min training',
      type: 'Meeting Training',
      status: 'available',
      gradient: 'from-purple-500 via-violet-600 to-indigo-700',
      icon: Video,
      features: [
        'Video conferencing basics',
        'Client meeting setup',
        'Professional presentation',
        'Meeting management'
      ],
      topics: [
        {
          id: 'aoi_meet_overview',
          title: 'AOI Meet Overview',
          duration: '6 min',
          type: 'video' as const,
          completed: false,
          content: 'Introduction to AOI Meet video conferencing features and professional meeting setup.'
        },
        {
          id: 'aoi_meet_practice',
          title: 'Meeting Practice',
          duration: '6 min',
          type: 'interactive' as const,
          completed: false,
          content: 'Hands-on practice with AOI Meet interface and client meeting workflows.'
        }
      ]
    },
    {
      id: 'aoi_reporting',
      title: 'AOI - Reporting',
      subtitle: 'Appointment Outcome Reporting',
      description: 'Master the AOI Report system for tracking appointment outcomes and maintaining accountability',
      duration: '7 min training',
      type: 'Accountability Training',
      status: 'available',
      gradient: 'from-orange-500 via-red-600 to-pink-700',
      icon: ClipboardList,
      features: [
        'Accountability system overview',
        'Report outcome types',
        'Disposition management',
        'ALP entry tracking'
      ],
      topics: [
        {
          id: 'aoi_report_overview',
          title: 'AOI Report System Overview',
          duration: '2 min',
          type: 'video' as const,
          completed: false,
          content: 'Understanding the accountability system and why accurate reporting is essential for success.',
          videoRequired: true
        },
        {
          id: 'report_types',
          title: 'Report Types & Outcomes',
          duration: '2 min',
          type: 'interactive' as const,
          completed: false,
          content: 'Learn about different appointment outcomes: sales, refusals, thinkers, no-shows, and more.'
        },
        {
          id: 'aoi_report_practice',
          title: 'Practice Reporting',
          duration: '3 min',
          type: 'interactive' as const,
          completed: false,
          content: 'Hands-on practice with the AOI Report interface using demo appointment data.'
        }
      ]
    }
  ];

  return (
    <ConnectNowLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-br from-blue-400/10 to-purple-600/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-br from-emerald-400/10 to-teal-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-end mb-8">
            <Button 
              onClick={() => setHelpModalOpen(true)}
              variant="outline"
              className="bg-white/70 backdrop-blur-sm border-white/20 hover:bg-white/80 text-slate-700 shadow-lg"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Get Help
            </Button>
          </div>

          <div className="space-y-6">
            <h1 className="text-7xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-indigo-800 bg-clip-text text-transparent mb-8 mt-8 pt-4 pb-4 leading-tight">
              Welcome to AO Intelligence
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Begin your journey with comprehensive training designed to maximize your success
            </p>
            
          </div>
        </div>

        {/* Training Modules Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {trainingModules.map((module, index) => {
            const Icon = module.icon;
            
            const isCompleted = completedModules.includes(module.id);
            const isLocked = false; // All modules visible and accessible
            
            return (
              <Card 
                key={module.id}
                className={`group relative overflow-hidden border-0 shadow-xl transition-all duration-500 ${
                  isLocked 
                    ? 'bg-gray-100/80 backdrop-blur-sm opacity-60 cursor-not-allowed' 
                    : isCompleted
                    ? 'bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:scale-[1.02] ring-2 ring-green-400/50'
                    : 'bg-white/80 backdrop-blur-sm hover:shadow-2xl hover:scale-[1.02]'
                }`}
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${module.gradient} ${
                  isLocked ? 'opacity-30' : 'opacity-90'
                }`}></div>
                
                {/* Lock Overlay */}
                {isLocked && (
                  <div className="absolute inset-0 bg-gray-500/50 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Lock className="w-12 h-12 mx-auto mb-2 opacity-80" />
                      <p className="font-semibold">Complete Previous Module</p>
                    </div>
                  </div>
                )}
                
                {/* Completed Badge */}
                {isCompleted && (
                  <div className="absolute top-4 right-4 z-30">
                    <div className="bg-green-500 text-white rounded-full p-2 shadow-lg">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  </div>
                )}
                
                {/* Content */}
                <div className="relative z-10 p-8 text-white h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <Badge className="bg-white/20 text-white border-0 text-xs font-medium mb-2">
                          {module.type}
                        </Badge>
                        <div className="flex items-center text-white/80 text-sm">
                          <Clock className="w-4 h-4 mr-1" />
                          {module.duration}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold mb-1">{module.title}</h3>
                    <p className="text-white/80 font-medium">{module.subtitle}</p>
                  </div>

                  {/* Description */}
                  <p className="text-white/90 text-sm leading-relaxed mb-6 flex-grow">
                    {module.description}
                  </p>

                  {/* Features */}
                  <div className="space-y-2 mb-8">
                    {module.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center text-sm text-white/90">
                        <CheckCircle className="w-4 h-4 mr-2 text-white/70" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <Button 
                    disabled={isLocked}
                    onClick={() => {
                      setActiveModule(module);
                      setTrainingModalOpen(true);
                    }}
                    className={`w-full font-semibold py-3 backdrop-blur-sm transition-all duration-300 ${
                      isLocked 
                        ? 'bg-gray-400/50 text-gray-300 cursor-not-allowed' 
                        : isCompleted
                        ? 'bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 text-white'
                        : 'bg-white/20 hover:bg-white/30 border border-white/30 text-white group-hover:bg-white/25'
                    }`}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="w-5 h-5 mr-2" />
                        Locked
                      </>
                    ) : isCompleted ? (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Completed
                        <Trophy className="w-5 h-5 ml-2" />
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Start Training
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-4 right-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                <div className="absolute bottom-4 left-4 w-16 h-16 bg-white/5 rounded-full blur-lg"></div>
              </Card>
            );
          })}
        </div>


        {/* Help Modal */}
        <HelpModal 
          isOpen={helpModalOpen} 
          onClose={() => setHelpModalOpen(false)}
        />

        {/* Training Modal */}
        <TrainingModal
          isOpen={trainingModalOpen}
          onClose={() => setTrainingModalOpen(false)}
          module={activeModule}
          onComplete={() => {
            if (activeModule && !completedModules.includes(activeModule.id)) {
              setCompletedModules([...completedModules, activeModule.id]);
            }
          }}
        />
        </div>
      </div>
    </ConnectNowLayout>
  );
}