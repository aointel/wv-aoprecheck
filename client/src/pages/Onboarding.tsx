import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Circle,
  Phone,
  Target,
  ArrowRight,
  HelpCircle,
  Video,
  Users,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  VideoIcon,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// ─── Video Placeholder ────────────────────────────────────────────────────────

function VideoPlaceholder({ title }: { title: string }) {
  return (
    <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden mb-6 flex flex-col items-center justify-center gap-4">
      <VideoIcon className="h-16 w-16 text-slate-600" />
      <p className="text-white text-lg font-semibold">{title}</p>
      <p className="text-slate-500 text-sm">Training video coming soon</p>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingStep {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  completed: boolean;
  subSection: string;
  isHelp?: boolean;
}

interface SubSection {
  id: string;
  label: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const CCP_SUBSECTIONS: SubSection[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'leads', label: 'Leads' },
  { id: 'dialing', label: 'Dialing' },
  { id: 'booking', label: 'Booking' },
  { id: 'calendar', label: 'My Calendar' },
  { id: 'resolving', label: 'Resolving' },
];

const INITIAL_STEPS: TrainingStep[] = [
  // ── Intro ──────────────────────────────────────────────────────────────────
  {
    id: 'intro-welcome',
    title: 'Welcome to Call Connector Pro',
    description: 'What CCP is and how it fits into your workflow',
    videoUrl: '',
    completed: false,
    subSection: 'intro',
  },
  {
    id: 'intro-dashboard',
    title: 'Your Dashboard Overview',
    description: 'Tour of the main interface: lead count, dialer button, status indicators',
    videoUrl: '',
    completed: false,
    subSection: 'intro',
  },
  {
    id: 'intro-profile',
    title: 'Setting Up Your Profile',
    description: 'Making sure your name, phone, and states are configured correctly',
    videoUrl: '',
    completed: false,
    subSection: 'intro',
  },

  // ── Leads ──────────────────────────────────────────────────────────────────
  {
    id: 'leads-queue',
    title: 'Understanding Your Lead Queue',
    description: 'Where leads come from, what the queue means, hot vs plus leads',
    videoUrl: '',
    completed: false,
    subSection: 'leads',
  },
  {
    id: 'leads-info',
    title: 'Lead Information',
    description: 'Reading a lead card: name, phone, state, market, lead type',
    videoUrl: '',
    completed: false,
    subSection: 'leads',
  },
  {
    id: 'leads-priorities',
    title: 'Lead Priorities & Types',
    description: 'Priority 99 leads, hot leads, plus leads — what to focus on first',
    videoUrl: '',
    completed: false,
    subSection: 'leads',
  },

  // ── Dialing ────────────────────────────────────────────────────────────────
  {
    id: 'dialing-first-call',
    title: 'Making Your First Call',
    description: 'Click to dial, what happens when the call connects',
    videoUrl: '',
    completed: false,
    subSection: 'dialing',
  },
  {
    id: 'dialing-during',
    title: 'During the Call',
    description: 'Navigating the UI while on a call: mute, notes, timer',
    videoUrl: '',
    completed: false,
    subSection: 'dialing',
  },
  {
    id: 'dialing-controls',
    title: 'Call Controls & Transfers',
    description: 'How transfers work when a lead is interested',
    videoUrl: '',
    completed: false,
    subSection: 'dialing',
  },

  // ── Booking ────────────────────────────────────────────────────────────────
  {
    id: 'booking-appointment',
    title: 'Booking an Appointment',
    description: 'When and how to book: the booking flow inside CCP',
    videoUrl: '',
    completed: false,
    subSection: 'booking',
  },
  {
    id: 'booking-details',
    title: 'Sending Meeting Details',
    description: 'How the confirmation goes out to the client',
    videoUrl: '',
    completed: false,
    subSection: 'booking',
  },
  {
    id: 'booking-instant',
    title: 'Instant Presentations',
    description: 'When to do an instant vs schedule for later',
    videoUrl: '',
    completed: false,
    subSection: 'booking',
  },

  // ── My Calendar ────────────────────────────────────────────────────────────
  {
    id: 'calendar-overview',
    title: 'Your Appointment Calendar',
    description: 'Where to find your booked appointments',
    videoUrl: '',
    completed: false,
    subSection: 'calendar',
  },
  {
    id: 'calendar-managing',
    title: 'Managing Appointments',
    description: 'Rescheduling, cancelling, and confirming',
    videoUrl: '',
    completed: false,
    subSection: 'calendar',
  },
  {
    id: 'calendar-integrations',
    title: 'Calendar Integrations',
    description: 'Google Calendar sync and how it works',
    videoUrl: '',
    completed: false,
    subSection: 'calendar',
  },

  // ── Resolving ──────────────────────────────────────────────────────────────
  {
    id: 'resolving-dispositions',
    title: 'Call Dispositions',
    description: 'How to mark calls: No Answer, Callback, Not Interested, Wrong Number, DNC',
    videoUrl: '',
    completed: false,
    subSection: 'resolving',
  },
  {
    id: 'resolving-callbacks',
    title: 'Handling Callbacks',
    description: 'Setting callback times and following up',
    videoUrl: '',
    completed: false,
    subSection: 'resolving',
  },
  {
    id: 'resolving-dnc',
    title: 'DNC & Compliance',
    description: 'Do Not Call rules, FTC restrictions on call times',
    videoUrl: '',
    completed: false,
    subSection: 'resolving',
  },

  // ── Getting Help ───────────────────────────────────────────────────────────
  {
    id: 'help-tickets',
    title: 'How to Get Help',
    description: 'How to submit a support ticket, what to include',
    videoUrl: '',
    completed: false,
    subSection: 'help',
    isHelp: true,
  },
  {
    id: 'help-common',
    title: 'Common Issues',
    description: 'Audio problems, leads not loading, can\'t log in',
    videoUrl: '',
    completed: false,
    subSection: 'help',
    isHelp: true,
  },
  {
    id: 'help-states',
    title: 'Add Licensed States',
    description: 'How to add states to your profile',
    videoUrl: 'https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/GetsupportAddStates.mp4',
    completed: false,
    subSection: 'help',
    isHelp: true,
  },
  {
    id: 'help-market',
    title: 'Change Your Market',
    description: 'How to switch markets',
    videoUrl: 'https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/getsupportChangemarket.mp4',
    completed: false,
    subSection: 'help',
    isHelp: true,
  },
];

const COMING_SOON_SECTIONS = [
  { id: 'ao-intelligence', title: 'AO Intelligence', icon: Target, color: 'purple' },
  { id: 'ao-meet', title: 'AO Meet', icon: Video, color: 'blue' },
  { id: 'ao-precheck', title: 'AO Precheck', icon: ShieldCheck, color: 'orange' },
  { id: 'ao-recruit', title: 'AO Recruit', icon: Users, color: 'indigo' },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [steps, setSteps] = useState<TrainingStep[]>(INITIAL_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  const ccpSteps = steps.filter(s => !s.isHelp);
  const helpSteps = steps.filter(s => s.isHelp);
  const allCountedSteps = steps; // both CCP and help count toward progress

  const completedCount = allCountedSteps.filter(s => s.completed).length;
  const progressPercent = (completedCount / allCountedSteps.length) * 100;

  const currentStepData = steps[currentStep];

  const toggleSection = (id: string) => {
    setCollapsedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const isSectionCollapsed = (id: string) => collapsedSections.includes(id);

  const markStepComplete = (stepId: string) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, completed: true } : s));
  };

  const handleFinish = () => {
    setLocation('/dashboard/connect');
  };

  const renderVideoContent = (step: TrainingStep) => {
    const isPlaceholder = !step.videoUrl || step.videoUrl === 'PLACEHOLDER';
    if (isPlaceholder) {
      return <VideoPlaceholder title={step.title} />;
    }
    if (step.videoUrl.includes('.mp4')) {
      return (
        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden mb-6">
          <video
            src={step.videoUrl}
            className="w-full h-full"
            controls
            controlsList="nodownload"
            playsInline
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    return (
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden mb-6">
        <iframe
          src={step.videoUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  };

  // ── Sidebar step button renderer ──────────────────────────────────────────
  const StepButton = ({ step }: { step: TrainingStep }) => {
    const idx = steps.indexOf(step);
    const isCurrent = idx === currentStep;
    return (
      <button
        key={step.id}
        onClick={() => setCurrentStep(idx)}
        className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left ${
          isCurrent
            ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500'
            : step.completed
            ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        {step.completed ? (
          <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
        ) : (
          <Circle className="h-3 w-3 text-gray-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${
            isCurrent ? 'text-purple-900 dark:text-purple-100' :
            step.completed ? 'text-green-900 dark:text-green-100' :
            'text-gray-700 dark:text-gray-300'
          }`}>
            {step.title}
          </p>
          <span className={`text-xs ${
            step.completed ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
          }`}>
            {step.completed ? 'Complete' : 'Incomplete'}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3 bg-white dark:bg-gray-800 rounded-full px-6 py-3 shadow-lg mb-4">
          <Phone className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Call Connector Pro Training
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Your step-by-step guide to mastering Call Connector Pro
        </p>
      </div>

      {/* Progress Bar */}
      <Card className="mb-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Training Progress: {completedCount} of {allCountedSteps.length} completed
            </span>
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              {Math.round(progressPercent)}% Complete
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-3 max-h-[90vh] overflow-y-auto pr-2">

          {/* Call Connector Pro — active */}
          <Card className="border-2 border-green-200 dark:border-green-800 shadow-sm">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors py-3"
              onClick={() => toggleSection('ccp')}
            >
              <div className="flex items-center gap-3">
                {isSectionCollapsed('ccp') ? (
                  <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600 flex-shrink-0" />
                )}
                <Phone className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <CardTitle className="text-base font-bold">Call Connector Pro</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    {ccpSteps.filter(s => s.completed).length}/{ccpSteps.length} steps
                  </p>
                </div>
              </div>
            </CardHeader>

            {!isSectionCollapsed('ccp') && (
              <CardContent className="space-y-3 pt-0 pb-3">
                {CCP_SUBSECTIONS.map(sub => {
                  const subSteps = ccpSteps.filter(s => s.subSection === sub.id);
                  const subCollapsed = isSectionCollapsed(`ccp-${sub.id}`);
                  return (
                    <div key={sub.id}>
                      <button
                        onClick={() => toggleSection(`ccp-${sub.id}`)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {subCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                          {sub.label}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          {subSteps.filter(s => s.completed).length}/{subSteps.length}
                        </span>
                      </button>
                      {!subCollapsed && (
                        <div className="space-y-1 mt-1 ml-2">
                          {subSteps.map(step => <StepButton key={step.id} step={step} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>

          {/* Coming Soon sections */}
          {COMING_SOON_SECTIONS.map(section => {
            const Icon = section.icon;
            return (
              <Card
                key={section.id}
                className="border-2 border-gray-200 dark:border-gray-700 shadow-sm opacity-50"
              >
                <CardHeader className="py-3 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <Icon className="h-6 w-6 text-gray-400 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold text-gray-400">{section.title}</CardTitle>
                        <Badge variant="outline" className="text-xs text-gray-400 border-gray-300 bg-gray-100 dark:bg-gray-800">
                          Coming Soon
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}

          {/* Getting Help — always active */}
          <Card className="border-2 border-red-200 dark:border-red-800 shadow-sm">
            <CardHeader
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors py-3"
              onClick={() => toggleSection('help')}
            >
              <div className="flex items-center gap-3">
                {isSectionCollapsed('help') ? (
                  <ChevronRight className="h-5 w-5 text-gray-600 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600 flex-shrink-0" />
                )}
                <HelpCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <CardTitle className="text-base font-bold">Getting Help</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    {helpSteps.filter(s => s.completed).length}/{helpSteps.length} steps
                  </p>
                </div>
              </div>
            </CardHeader>

            {!isSectionCollapsed('help') && (
              <CardContent className="space-y-1 pt-0 pb-3">
                {helpSteps.map(step => <StepButton key={step.id} step={step} />)}
              </CardContent>
            )}
          </Card>
        </div>

        {/* ── Content Area ───────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentStepData?.isHelp ? (
                    <HelpCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <Phone className="h-6 w-6 text-green-600" />
                  )}
                  <CardTitle className="text-2xl">{currentStepData?.title}</CardTitle>
                </div>
                <Badge className="bg-purple-600">
                  Step {currentStep + 1} of {steps.length}
                </Badge>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {currentStepData?.description}
              </p>
            </CardHeader>

            <CardContent>
              {currentStepData && renderVideoContent(currentStepData)}

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                >
                  Previous
                </Button>

                <div className="flex items-center gap-3">
                  {!currentStepData?.completed && (
                    <Button
                      variant="outline"
                      onClick={() => markStepComplete(currentStepData.id)}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark Complete
                    </Button>
                  )}

                  {currentStep < steps.length - 1 ? (
                    <Button
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      Next Step
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleFinish}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                      disabled={completedCount < allCountedSteps.length}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Finish Training
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* All Complete Banner */}
      {completedCount === allCountedSteps.length && (
        <Card className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
                <div>
                  <h3 className="text-xl font-bold text-green-900 dark:text-green-100">
                    Training Complete!
                  </h3>
                  <p className="text-green-700 dark:text-green-300">
                    You've completed all training modules. You're ready to start!
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                onClick={handleFinish}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
