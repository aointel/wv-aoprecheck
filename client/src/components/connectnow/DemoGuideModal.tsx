import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Phone, PhoneIncoming, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void; // Called when guide is completed (user clicked Start Demo on last slide)
  agentPhoneNumber?: string;
  demoType?: 'aointel' | 'recruit' | 'callconnector';
}

const getDemoSteps = (demoType: 'aointel' | 'recruit' | 'callconnector') => {
  if (demoType === 'callconnector') {
    return [
      {
        id: 1,
        title: 'Step 1: View Your Demo Lead',
        description: 'You will see a lead in Call Connector Pro with your own information for practice.',
        icon: Phone,
      },
      {
        id: 2,
        title: 'Step 2: Click to Call',
        description: 'Click the call button to initiate a direct call to your registered phone number.',
        icon: ArrowRight,
      },
      {
        id: 3,
        title: 'Step 3: Receive Call',
        description: 'You will receive a direct call on your registered phone number. Answer the call to test the connection.',
        icon: Phone,
        phoneDisplay: true,
      },
      {
        id: 4,
        title: 'Step 4: Test Call Quality',
        description: 'Once connected, you can test the call quality and practice using Call Connector Pro features.',
        icon: PhoneIncoming,
      },
      {
        id: 5,
        title: 'Step 5: Complete Demo',
        description: 'When you\'re done testing, you can end the call and exit the demo.',
        icon: CheckCircle2,
      },
    ];
  }
  
  return [
    {
      id: 1,
      title: 'Step 1: Go Online',
      description: 'First, toggle the VDP status to "ONLINE" using the switch above.',
      icon: Phone,
    },
    {
      id: 2,
      title: 'Step 2: Start Demo',
      description: 'Click the "Start Demo" button to initiate the demo call process.',
      icon: ArrowRight,
    },
    {
      id: 3,
      title: 'Step 3: Receive Outbound Call',
      description: 'You will receive a call on your registered phone number. Answer the call and roleplay with the Virtual Assistant.',
      icon: Phone,
      phoneDisplay: true,
    },
    {
      id: 4,
      title: 'Step 4: Receive Incoming Call',
      description: `Shortly after, you will receive an incoming call through ${demoType === 'aointel' ? 'AO Intelligence' : 'AO Recruit'}. You should hear yourself on both your cell phone and through ${demoType === 'aointel' ? 'AO Intelligence' : 'AO Recruit'}.`,
      icon: PhoneIncoming,
    },
    {
      id: 5,
      title: 'Step 5: Complete Demo',
      description: `Once you can hear yourself on both your cell phone and through ${demoType === 'aointel' ? 'AO Intelligence' : 'AO Recruit'}, the testing is complete. You can exit the demo.`,
      icon: CheckCircle2,
    },
  ];
};

export function DemoGuideModal({ isOpen, onClose, onComplete, agentPhoneNumber, demoType = 'aointel' }: DemoGuideModalProps) {
  // Handle callconnector demo type
  const effectiveDemoType = demoType === 'callconnector' ? 'callconnector' : demoType;
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenGuide, setHasSeenGuide] = useState(false);
  const { authState } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState<string>('Your registered phone');

  // Fetch fresh phone number from profile API
  useEffect(() => {
    const fetchPhoneNumber = async () => {
      if (agentPhoneNumber) {
        setPhoneNumber(agentPhoneNumber);
        return;
      }
      
      try {
        const userEmail = authState.user?.email;
        if (userEmail) {
          const response = await fetch(`/api/agent/profile-direct?userEmail=${encodeURIComponent(userEmail)}`);
          if (response.ok) {
            const profile = await response.json();
            if (profile?.phone) {
              setPhoneNumber(profile.phone);
              return;
            }
          }
        }
        
        // Fallback to authState profile
        if (authState.profile?.phone) {
          setPhoneNumber(authState.profile.phone);
        }
      } catch (error) {
        console.error('Failed to fetch phone number:', error);
        // Fallback to authState profile
        if (authState.profile?.phone) {
          setPhoneNumber(authState.profile.phone);
        }
      }
    };
    
    if (isOpen) {
      fetchPhoneNumber();
    }
  }, [isOpen, agentPhoneNumber, authState.user?.email, authState.profile?.phone]);

  // Get steps based on demo type
  const DEMO_STEPS = getDemoSteps(demoType);

  useEffect(() => {
    // Check if user has seen the guide before
    const seen = localStorage.getItem('demo_guide_seen');
    if (seen === 'true') {
      setHasSeenGuide(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < DEMO_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartDemo = () => {
    localStorage.setItem('demo_guide_seen', 'true');
    setHasSeenGuide(true);
    onClose(); // Close the guide modal
    onComplete(); // Notify parent that guide is complete (doesn't start call, just closes guide)
  };

  const currentStepData = DEMO_STEPS[currentStep];
  const Icon = currentStepData.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <span>📚</span>
            Demo Call Guide
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Card className="p-8 min-h-[400px] flex flex-col items-center justify-center">
            <CardContent className="w-full space-y-6">
              {/* Step Number Indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {DEMO_STEPS.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center ${
                      index === currentStep
                        ? 'text-blue-600 scale-110'
                        : index < currentStep
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                        index === currentStep
                          ? 'bg-blue-600 text-white border-blue-600'
                          : index < currentStep
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-gray-100 border-gray-300'
                      }`}
                    >
                      {index < currentStep ? <CheckCircle2 className="w-6 h-6" /> : step.id}
                    </div>
                    {index < DEMO_STEPS.length - 1 && (
                      <div
                        className={`w-12 h-0.5 ${
                          index < currentStep ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Step Content */}
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                </div>

                <h2 className="text-3xl font-bold">{currentStepData.title}</h2>

                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  {currentStepData.description}
                </p>

                {/* Show phone number for step 3 */}
                {currentStepData.phoneDisplay && (
                  <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Your phone number:
                    </p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {phoneNumber}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {DEMO_STEPS.length}
            </span>
          </div>

          {currentStep === DEMO_STEPS.length - 1 ? (
            <Button onClick={handleStartDemo} className="gap-2 bg-green-600 hover:bg-green-700">
              Start Demo
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={handleNext} className="gap-2" disabled={currentStep >= DEMO_STEPS.length - 1}>
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

