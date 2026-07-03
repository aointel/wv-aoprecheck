import { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Rocket } from 'lucide-react';
import { Userpilot } from 'userpilot';

interface OnboardingGateProps {
  children: ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const [isListening, setIsListening] = useState(false);

  // Check if user has completed onboarding
  const { data: onboardingStatus, isLoading } = useQuery({
    queryKey: ['onboarding-status', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return { completed: false };
      
      const response = await fetch(`/api/user/onboarding-status?email=${encodeURIComponent(authState.user.email)}`);
      if (!response.ok) return { completed: false };
      
      return response.json();
    },
    enabled: !!authState.user?.email,
    refetchInterval: 5000 // Check every 5 seconds
  });

  // Mark onboarding as complete
  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-email': authState.user?.email || ''
        }
      });
      
      if (!response.ok) throw new Error('Failed to mark onboarding complete');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    }
  });

  // Listen for Userpilot completion events
  useEffect(() => {
    if (isListening || onboardingStatus?.completed) return;

    const handleUserpilotEvent = (event: any) => {
      console.log('📚 Userpilot event:', event);
      
      // Check for completion events
      if (
        event.type === 'checklist_completed' ||
        event.type === 'flow_completed' ||
        event.type === 'onboarding_completed'
      ) {
        console.log('✅ Onboarding completed! Unlocking app...');
        completeMutation.mutate();
      }
    };

    // Listen for Userpilot events
    try {
      // @ts-ignore - Userpilot event listener
      window.userpilot?.on?.('event', handleUserpilotEvent);
      setIsListening(true);
    } catch (error) {
      console.error('❌ Failed to setup Userpilot listener:', error);
    }

    return () => {
      // Cleanup
      try {
        // @ts-ignore
        window.userpilot?.off?.('event', handleUserpilotEvent);
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, [isListening, onboardingStatus?.completed]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center z-50">
        <div className="text-center text-white">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold">Loading AOI Platform...</p>
        </div>
      </div>
    );
  }

  // Show onboarding lockdown if not completed
  if (!onboardingStatus?.completed) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center z-50">
        <div className="max-w-2xl mx-auto p-8 text-center text-white">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl">
            <Rocket className="h-20 w-20 mx-auto mb-6 text-white" />
            <h1 className="text-4xl font-bold mb-4">Welcome to AO Intelligence! 🎉</h1>
            <p className="text-xl mb-6 text-white/90">
              Before you get started, let's take a quick tour to show you around the platform.
            </p>
            <p className="text-lg mb-8 text-white/80">
              Complete the walkthrough to unlock full access to:
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8 text-left">
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold mb-1">📞 Call Connector Pro</p>
                <p className="text-sm text-white/80">Smart lead dialing system</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold mb-1">🎯 Virtual Dialing Platform</p>
                <p className="text-sm text-white/80">Automated inbound calls</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold mb-1">📊 Live Call Board</p>
                <p className="text-sm text-white/80">Real-time team monitoring</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold mb-1">✅ AOI PreCheck</p>
                <p className="text-sm text-white/80">Verification management</p>
              </div>
            </div>
            <div className="bg-yellow-400 text-gray-900 rounded-lg p-4 mb-6">
              <p className="font-semibold">
                👆 Look for the Userpilot walkthrough that should appear on your screen
              </p>
              <p className="text-sm mt-2">
                If you don't see it, refresh the page or contact support
              </p>
            </div>
            <p className="text-sm text-white/70">
              This screen will automatically unlock once you complete the tour
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding complete - show normal app
  return <>{children}</>;
}

