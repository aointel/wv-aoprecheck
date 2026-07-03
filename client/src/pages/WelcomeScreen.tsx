import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  Users, 
  BarChart3, 
  Brain, 
  CheckCircle2, 
  Star,
  ArrowRight,
  Play,
  TrendingUp,
  Clock,
  Headphones,
  Zap,
  Target,
  Award,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Video,
  Settings,
  Download,
  Sparkles,
  Phone,
  CheckSquare,
  UserCheck,
  MessageSquare,
  Globe,
  Rocket
} from "lucide-react";

const onboardingSteps = [
  {
    id: 1,
    icon: Globe,
    title: "Welcome to AO Intelligence",
    subtitle: "Your Complete Insurance Platform",
    description: "AO Intelligence is the ultimate platform for insurance producers, combining cutting-edge technology with proven sales strategies. Get ready to revolutionize how you work.",
    features: [
      "Professional outbound calling system",
      "AI-powered lead management",
      "Client verification & compliance",
      "Recruitment & team building"
    ],
    color: "bg-gradient-to-br from-indigo-600 to-purple-700",
    action: "Let's Explore"
  },
  {
    id: 2,
    icon: Rocket,
    title: "Call Connector Pro",
    subtitle: "Professional WebRTC Dialing",
    description: "Make crystal-clear calls directly from your browser with our advanced WebRTC technology. No phone lines, no equipment - just professional calling at your fingertips.",
    features: [
      "Browser-based calling",
      "International capabilities",
      "Call recording & monitoring",
      "Lead progression tracking"
    ],
    color: "bg-gradient-to-br from-violet-600 to-indigo-700",
    action: "Start Calling",
    href: "/dashboard/connect"
  },
  {
    id: 3,
    icon: Shield,
    title: "AO Precheck",
    subtitle: "Client Verification & Compliance",
    description: "Streamlined client verification system that ensures compliance and builds trust. Verify prospects before they become clients with our automated precheck process.",
    features: [
      "Automated client verification",
      "Compliance documentation",
      "Trust-building process",
      "Risk assessment tools"
    ],
    color: "bg-gradient-to-br from-emerald-600 to-teal-700",
    action: "Learn More",
    href: "/dashboard/precheck"
  },
  {
    id: 4,
    icon: Users,
    title: "AO Recruit",
    subtitle: "Build Your Dream Team",
    description: "Recruit, onboard, and manage your insurance team with powerful tools designed specifically for the industry. Scale your business with the right people.",
    features: [
      "producer recruitment tools",
      "Team onboarding system",
      "Performance tracking",
      "Commission management"
    ],
    color: "bg-gradient-to-br from-blue-600 to-cyan-700",
    action: "Start Recruiting",
    href: "/dashboard/recruit"
  },
  {
    id: 5,
    icon: Brain,
    title: "Ask Alex",
    subtitle: "AI-Powered Assistant",
    description: "Get instant answers to underwriting questions, lead management help, and business insights with our GPT-5 powered AI assistant. Alex knows everything about ConnectNow and AO Globe Life.",
    features: [
      "Underwriting expertise",
      "Lead management guidance",
      "Business strategy insights",
      "24/7 AI assistance"
    ],
    color: "bg-gradient-to-br from-purple-600 to-pink-700",
    action: "Chat with Alex",
    href: "/dashboard/alex"
  },
  {
    id: 6,
    icon: BarChart3,
    title: "Analytics & Performance",
    subtitle: "Data-Driven Success",
    description: "Track your performance, monitor team metrics, and optimize your business with comprehensive analytics. See exactly what's working and what needs improvement.",
    features: [
      "Real-time performance metrics",
      "Team leaderboards",
      "Conversion tracking",
      "Revenue analytics"
    ],
    color: "bg-gradient-to-br from-orange-600 to-red-700",
    action: "View Analytics",
    href: "/analytics"
  },
  {
    id: 7,
    icon: CheckSquare,
    title: "You're All Set!",
    subtitle: "Ready to Dominate",
    description: "You now have access to the most powerful insurance platform available. AO Intelligence combines everything you need to succeed in one integrated system.",
    features: [
      "Complete platform access",
      "All features unlocked",
      "AI assistance ready",
      "Let's make some calls!"
    ],
    color: "bg-gradient-to-br from-green-600 to-emerald-700",
    action: "Go to Dashboard",
    href: "/dashboard"
  }
];

const quickActions = [
  {
    title: "Start Calling",
    description: "Jump into Call Connector Pro and start dialing leads",
    icon: Phone,
    href: "/dashboard/connect",
    color: "bg-gradient-to-r from-blue-600 to-purple-600"
  },
  {
    title: "Ask Alex",
    description: "Get AI-powered help with underwriting and leads",
    icon: Brain,
    href: "/dashboard/alex",
    color: "bg-gradient-to-r from-purple-600 to-pink-600"
  },
  {
    title: "View Analytics",
    description: "Check your performance metrics and progress",
    icon: BarChart3,
    href: "/analytics",
    color: "bg-gradient-to-r from-orange-600 to-red-600"
  }
];

export default function WelcomeScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (isAutoPlay) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % onboardingSteps.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [isAutoPlay]);

  const nextStep = () => {
    setIsAutoPlay(false);
    setCurrentStep((prev) => (prev + 1) % onboardingSteps.length);
  };

  const prevStep = () => {
    setIsAutoPlay(false);
    setCurrentStep((prev) => (prev - 1 + onboardingSteps.length) % onboardingSteps.length);
  };

  const goToStep = (index: number) => {
    setIsAutoPlay(false);
    setCurrentStep(index);
  };

  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Modern animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/2 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-2000" />
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Modern Header */}
        <div className="bg-white/10 backdrop-blur-xl border-b border-white/20 px-6 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-2xl">
                  <span className="text-white font-bold text-lg">AO</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">AO Intelligence</h1>
                  <p className="text-blue-200 text-sm">Complete Insurance Platform</p>
                </div>
              </div>
              <Badge variant="secondary" className="px-4 py-2 bg-white/20 text-white border-white/30 text-sm font-medium">
                Step {currentStep + 1} of {onboardingSteps.length}
              </Badge>
            </div>
            <Progress value={progress} className="h-3 bg-white/20" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <Card className="overflow-hidden bg-white/10 backdrop-blur-xl shadow-2xl border-white/20">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 xl:grid-cols-2 min-h-[600px]">
                      {/* Content Side */}
                      <div className="p-10 flex flex-col justify-center">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <div className="flex items-center space-x-4 mb-8">
                            <div className={`w-16 h-16 ${onboardingSteps[currentStep].color} rounded-2xl flex items-center justify-center shadow-2xl`}>
                              {(() => {
                                const IconComponent = onboardingSteps[currentStep].icon;
                                return <IconComponent className="w-8 h-8 text-white" />;
                              })()}
                            </div>
                            <div>
                              <h2 className="text-3xl font-bold text-white mb-2">
                                {onboardingSteps[currentStep].title}
                              </h2>
                              <p className="text-lg text-blue-200">
                                {onboardingSteps[currentStep].subtitle}
                              </p>
                            </div>
                          </div>

                          <p className="text-gray-200 mb-8 leading-relaxed text-lg">
                            {onboardingSteps[currentStep].description}
                          </p>

                          <div className="space-y-4 mb-10">
                            {onboardingSteps[currentStep].features.map((feature, index) => (
                              <motion.div
                                key={index}
                                className="flex items-center space-x-4"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + index * 0.1 }}
                              >
                                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                  <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-gray-200 text-lg">{feature}</span>
                              </motion.div>
                            ))}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4">
                            {onboardingSteps[currentStep].href ? (
                              <Link href={onboardingSteps[currentStep].href!}>
                                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-3">
                                  {onboardingSteps[currentStep].action}
                                  <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                              </Link>
                            ) : (
                              <Button 
                                size="lg" 
                                onClick={nextStep}
                                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-3"
                              >
                                {onboardingSteps[currentStep].action}
                                <ArrowRight className="ml-2 w-5 h-5" />
                              </Button>
                            )}
                            {currentStep > 0 && (
                              <Button variant="outline" size="lg" onClick={prevStep} className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-3">
                                <ChevronLeft className="mr-2 w-5 h-5" />
                                Previous
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      </div>

                      {/* Visual Side */}
                      <div className={`${onboardingSteps[currentStep].color} p-10 flex items-center justify-center relative overflow-hidden`}>
                        <motion.div
                          className="text-center relative z-10"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5, duration: 0.8 }}
                        >
                          <motion.div
                            animate={{ 
                              y: [0, -15, 0],
                              rotate: [0, 3, 0]
                            }}
                            transition={{ 
                              duration: 6,
                              repeat: Infinity,
                              repeatType: "reverse"
                            }}
                          >
                            {(() => {
                              const IconComponent = onboardingSteps[currentStep].icon;
                              return <IconComponent className="w-40 h-40 text-white/90 mx-auto mb-8 drop-shadow-2xl" />;
                            })()}
                          </motion.div>
                          
                          <motion.div
                            className="space-y-6"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                          >
                            {/* Floating feature icons */}
                            <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
                              {[Shield, Users, Brain, BarChart3].map((Icon, index) => (
                                <motion.div
                                  key={index}
                                  className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30"
                                  animate={{ 
                                    scale: [1, 1.1, 1],
                                    opacity: [0.7, 1, 0.7]
                                  }}
                                  transition={{ 
                                    duration: 3,
                                    repeat: Infinity,
                                    delay: index * 0.8
                                  }}
                                >
                                  <Icon className="w-8 h-8 text-white" />
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        </motion.div>

                        {/* Enhanced decorative elements */}
                        <div className="absolute top-8 right-8 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
                        <div className="absolute bottom-8 left-8 w-24 h-24 bg-white/10 rounded-full blur-2xl animate-pulse delay-1000" />
                        <div className="absolute top-1/2 left-4 w-20 h-20 bg-white/5 rounded-full blur-xl animate-pulse delay-2000" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-xl border-t border-white/20 px-6 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-white mb-2">Quick Actions</h3>
              <p className="text-blue-200">Jump straight to what you need</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                >
                  <Link href={action.href}>
                    <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer group">
                      <CardContent className="p-6 text-center">
                        <div className={`w-16 h-16 ${action.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                          <action.icon className="w-8 h-8 text-white" />
                        </div>
                        <h4 className="text-lg font-semibold text-white mb-2">{action.title}</h4>
                        <p className="text-blue-200 text-sm">{action.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="bg-white/10 backdrop-blur-xl border-t border-white/20 px-6 py-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex space-x-3">
              {onboardingSteps.map((_, index) => (
                <button
                  key={index}
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    index === currentStep 
                      ? 'bg-blue-500 scale-125 shadow-lg shadow-blue-500/50' 
                      : index < currentStep 
                        ? 'bg-green-500' 
                        : 'bg-white/30 hover:bg-white/50'
                  }`}
                  onClick={() => goToStep(index)}
                />
              ))}
            </div>

            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className="text-white hover:bg-white/10 border-white/30"
              >
                {isAutoPlay ? 'Pause Tour' : 'Resume Tour'}
              </Button>
              
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10">
                  Skip Tour
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}