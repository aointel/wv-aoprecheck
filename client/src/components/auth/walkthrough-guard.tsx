import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface WalkthroughCompletion {
  userEmail: string;
  callConnectorProCompleted: boolean;
  aoPreCheckCompleted: boolean;
  generalWalkthroughCompleted: boolean;
  isFullyCompleted: boolean;
  systemAccessGranted: boolean;
  completedAt?: string;
  firstAccessAt?: string;
}

interface WalkthroughGuardProps {
  children: React.ReactNode;
}

export function WalkthroughGuard({ children }: WalkthroughGuardProps) {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();
  const [completion, setCompletion] = useState<WalkthroughCompletion | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!authState.user?.email) {
      setIsChecking(false);
      return;
    }

    checkWalkthroughCompletion();
  }, [authState.user?.email]);

  const checkWalkthroughCompletion = async () => {
    try {
      setIsChecking(true);
      
      const response = await fetch(`/api/walkthrough/completion/${encodeURIComponent(authState.user!.email!)}`);
      
      if (!response.ok) {
        console.error("❌ Failed to check walkthrough completion");
        setIsChecking(false);
        return;
      }

      const completionData: WalkthroughCompletion = await response.json();
      setCompletion(completionData);

      // If user hasn't been granted system access, redirect to getting started
      if (!completionData.systemAccessGranted) {
        setLocation('/getting-started');
        return;
      }

      setIsChecking(false);
    } catch (error) {
      console.error("❌ Error checking walkthrough completion:", error);
      setIsChecking(false);
    }
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Checking training requirements...</p>
        </div>
      </div>
    );
  }

  // If no user, let the auth system handle it
  if (!authState.user?.email) {
    return <>{children}</>;
  }

  // If user hasn't completed walkthrough or been granted access, they'll be redirected
  // This component will only render children if user has proper access
  if (completion && completion.systemAccessGranted) {
    return <>{children}</>;
  }

  // Fallback - redirect to getting started
  setLocation('/getting-started');
  return null;
}