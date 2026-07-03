import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Video, ArrowRight, ArrowLeft, Users, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CallConnectorProFeatures } from './CallConnectorProFeatures';
import { SubscriptionUpgradeModal } from '@/components/stripe/SubscriptionUpgradeModal';
import type { PlanOption, SubscriptionPlan } from '@/components/outbound-dialer/types';
import { FiStar } from 'react-icons/fi';
import { useToast } from '@/hooks/use-toast';

interface CallConnectorProPrimerModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function CallConnectorProPrimerModal({ isOpen, onComplete }: CallConnectorProPrimerModalProps) {
  const { authState } = useAuth();
  const { toast } = useToast();
  const userEmail = authState?.user?.email;
  const userName = (authState?.user as { name?: string })?.name ?? undefined;
  
  const [step, setStep] = useState<'video' | 'features'>('video');
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<SubscriptionPlan | null>('professional');
  const [waitlistJoined, setWaitlistJoined] = useState(false);

  // Note: Access check is done in App.tsx before opening the modal
  // This component just renders the modal when isOpen is true

  // Get subscription status
  const { data: subscriptionData } = useQuery({
    queryKey: ['/api/billing/subscription/status'],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription/status');
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userEmail,
  });

  const subscription = subscriptionData?.subscription ?? null;
  const currentPlan = subscription?.plan as SubscriptionPlan | undefined;

  // Plan options for Call Connector Pro
  const planOptions: PlanOption[] = [
    {
      plan: 'professional',
      label: 'Professional',
      price: '$64.99',
      priceSuffix: '/month',
      tagline: 'Unlock unlimited outbound dialing',
      cardClass: 'border-2 border-blue-500 shadow-xl scale-[1.02]',
      gradientClass: 'bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30',
      bodyClass: 'bg-white/80 backdrop-blur',
      buttonClass:
        'bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white',
      icon: <FiStar className="h-5 w-5 text-blue-600" />,
      benefits: [
        'Unlimited outbound minutes',
        'Local Presence EVERY STATE.. Take your activity to the next level!',
        'Advanced call analytics & reporting',
        'Priority support response',
        'Unlimited dialing',
      ],
      ctaLabel: 'Upgrade Now',
      topBanner: 'Recommended',
    },
  ];

  // Mark primer as completed - save to DATABASE (Supabase) ONLY - no localStorage
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!userEmail) return;
      
      // Save to database (Supabase) - persists across browsers/devices
      // This is the source of truth, not browser localStorage
      try {
        const response = await fetch('/api/call-connector-pro/dismiss-primer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail: userEmail.toLowerCase() })
        });
        
        if (!response.ok) {
          console.error('❌ Failed to save dismissal to database');
          throw new Error('Failed to save dismissal');
        } else {
          console.log('✅ Primer dismissal saved to Supabase database - will persist across browsers');
        }
      } catch (error) {
        console.error('❌ Error saving dismissal to database:', error);
        throw error; // Re-throw so user knows it failed
      }
    },
    onSuccess: () => {
      onComplete();
    }
  });

  // Track video progress (optional, no blocking)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isOpen) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        setVideoProgress(progress);
      }
    };

    const handlePlay = () => {
      setVideoStarted(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
    };
  }, [isOpen]);

  // Join waitlist mutation
  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/call-connector-pro/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: userEmail?.toLowerCase(), userName: userName || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to join waitlist');
      return data;
    },
    onSuccess: (data) => {
      setWaitlistJoined(true);
      toast({
        title: "You're on the list!",
        description: data?.message || "We'll notify you when Call Connector Pro is available.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Could not join waitlist',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('video');
      setVideoStarted(false);
      setVideoProgress(0);
      setWaitlistJoined(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    console.log('🔒 CCPro primer modal closed, marking as completed');
    completeMutation.mutate(); // Mark as completed when closed
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose} modal={true}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          {step === 'video' && (
            <>
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-6 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                    <Video className="w-8 h-8" />
                    Try Call Connector Pro
                  </DialogTitle>
                  <DialogDescription className="text-blue-100 mt-2">
                    Watch this quick video to learn about Call Connector Pro
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-4">
                {/* Video Player */}
                <div className="bg-black rounded-lg overflow-hidden relative aspect-video">
                  <video
                    ref={videoRef}
                    className="w-full h-full"
                    controls
                    controlsList="nodownload"
                    playsInline
                    preload="metadata"
                    onError={(e) => {
                      console.error('Video failed to load:', e);
                    }}
                    onLoadedMetadata={() => {
                      console.log('Video metadata loaded');
                    }}
                    onCanPlay={() => {
                      console.log('Video can play');
                    }}
                  >
                    <source src="https://ycztjetxwpfgtrzeyytt.supabase.co/storage/v1/object/public/Video/micahel_s%20Video%20-%20Dec%2013%2C%202025-VEED.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  
                  {!videoStarted && (
                    <div 
                      className="absolute inset-0 bg-gradient-to-br from-blue-600/80 to-purple-600/80 flex items-center justify-center cursor-pointer hover:from-blue-700/80 hover:to-purple-700/80 transition-all z-10"
                      onClick={async () => {
                        try {
                          if (videoRef.current) {
                            await videoRef.current.play();
                            setVideoStarted(true);
                          }
                        } catch (error) {
                          console.error('Error playing video:', error);
                        }
                      }}
                    >
                      <div className="text-center text-white">
                        <Play className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-xl font-semibold">Click to start the video</p>
                        <p className="text-sm mt-2 text-blue-100">Learn about Call Connector Pro</p>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {videoStarted && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${videoProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-end">
                  <Button
                    onClick={() => setStep('features')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    size="lg"
                  >
                    View Features
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 'features' && (
            <>
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-6 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                    <Video className="w-8 h-8" />
                    Call Connector Pro Features
                  </DialogTitle>
                  <DialogDescription className="text-blue-100 mt-2">
                    Discover how Call Connector Pro makes outbound calling smarter and more efficient
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-6">
                <CallConnectorProFeatures 
                  onUpgrade={() => {
                    setSelectedPlanForUpgrade('professional');
                    setSubscriptionModalOpen(true);
                  }}
                />

                {/* Call Connector Pro Waitlist - signup option */}
                <div className="mt-6 p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Not ready to upgrade yet?
                  </p>
                  {waitlistJoined ? (
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <span>You&apos;re on the waitlist. We&apos;ll notify you when Call Connector Pro is available.</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
                      onClick={() => joinWaitlistMutation.mutate()}
                      disabled={joinWaitlistMutation.isPending || !userEmail}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      {joinWaitlistMutation.isPending ? 'Joining...' : 'Join the waitlist'}
                    </Button>
                  )}
                </div>
                
                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    onClick={() => setStep('video')}
                    variant="outline"
                    size="lg"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Video
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Stripe Subscription Upgrade Modal */}
      <SubscriptionUpgradeModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        planOptions={planOptions}
        currentPlan={currentPlan}
        initialPlan={selectedPlanForUpgrade}
        userEmail={userEmail}
        onCompleted={(subscription) => {
          console.log('✅ Subscription completed:', subscription);
          setSubscriptionModalOpen(false);
          // Optionally close the primer modal too
          handleClose();
        }}
      />
    </>
  );
}

