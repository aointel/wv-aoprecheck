import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CreditCard, XCircle, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { CreditPurchaseModal } from '@/components/stripe/CreditPurchaseModal';
import { useQueryClient } from '@tanstack/react-query';

// VDP Credit Alert Component - Shows alerts for low/negative credits
export function VDPCreditAlert() {
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const userEmail = authState.profile?.email || '';
  const [isCreditPurchaseOpen, setIsCreditPurchaseOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if dismissed in localStorage
  useEffect(() => {
    if (userEmail) {
      const dismissedKey = `vdp_credit_alert_dismissed_${userEmail}`;
      const dismissed = localStorage.getItem(dismissedKey);
      setIsDismissed(dismissed === 'true');
    }
  }, [userEmail]);

  const handleDismiss = () => {
    if (userEmail) {
      const dismissedKey = `vdp_credit_alert_dismissed_${userEmail}`;
      localStorage.setItem(dismissedKey, 'true');
      setIsDismissed(true);
    }
  };

  const handleCreditsAdded = () => {
    setIsCreditPurchaseOpen(false);
    // Clear dismissal when credits are added
    if (userEmail) {
      const dismissedKey = `vdp_credit_alert_dismissed_${userEmail}`;
      localStorage.removeItem(dismissedKey);
      setIsDismissed(false);
    }
    // Refresh credit status
    queryClient.invalidateQueries({ queryKey: ['/api/user/credit-status'] });
    queryClient.invalidateQueries({ queryKey: ['/api/connectnow/user-credits'] });
  };

  // Check user's credit status and VDP status
  const { data: creditStatus } = useQuery<{
    credits_remaining: number;
    vdpActive: boolean;
    vdpDisabledDueToCredits: boolean;
  }>({
    queryKey: ['/api/user/credit-status', userEmail],
    queryFn: async () => {
      if (!userEmail) return { credits_remaining: 0, vdpActive: false, vdpDisabledDueToCredits: false };
      
      const response = await fetch(`/api/user/credit-status?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) return { credits_remaining: 0, vdpActive: false, vdpDisabledDueToCredits: false };
      return response.json();
    },
    refetchInterval: 60000, // Check every minute
    enabled: !!userEmail
  });

  // Don't show if credits are positive or if dismissed
  if (!creditStatus || creditStatus.credits_remaining >= 0 || isDismissed) {
    return (
      <>
        <CreditPurchaseModal
          isOpen={isCreditPurchaseOpen}
          onClose={() => setIsCreditPurchaseOpen(false)}
          userEmail={authState.user?.email || authState.profile?.email}
          onCreditsAdded={handleCreditsAdded}
        />
      </>
    );
  }

  // Show critical alert if VDP is disabled due to negative credits
  if (creditStatus.vdpDisabledDueToCredits) {
    return (
      <>
        <div className="fixed top-20 left-0 right-0 z-50 px-4 py-2">
          <Alert variant="destructive" className="max-w-4xl mx-auto border-2 border-red-600 bg-red-50 shadow-2xl relative">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded-full transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4 text-red-700" />
            </button>
            <XCircle className="h-6 w-6" />
            <AlertTitle className="text-xl font-bold">VDP DISABLED - OUT OF CREDITS</AlertTitle>
            <AlertDescription className="text-base">
              <div className="space-y-2">
                <p className="font-semibold">
                  Your VDP (Virtual Dialer Pro) has been automatically disabled because your credit balance is <span className="text-red-700 font-bold">{creditStatus.credits_remaining} credits</span>.
                </p>
                <p>
                  <strong>What this means:</strong> You will NOT receive any inbound calls until you purchase more credits.
                </p>
                <div className="flex gap-3 mt-4">
                  <Button 
                    asChild
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-5 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white border-none hover:from-green-700 hover:to-green-800 text-lg font-semibold"
                    title="Purchase Credits"
                    data-testid="button-buy-credits"
                  >
                    <Link href="/dashboard/billing-dashboard">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Purchase Credits Now
                    </Link>
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
        <CreditPurchaseModal
          isOpen={isCreditPurchaseOpen}
          onClose={() => setIsCreditPurchaseOpen(false)}
          userEmail={authState.user?.email || authState.profile?.email}
          onCreditsAdded={handleCreditsAdded}
        />
      </>
    );
  }

  // Show warning if credits are low but VDP still active
  if (creditStatus.credits_remaining < 10 && creditStatus.vdpActive) {
    return (
      <>
        <div className="fixed top-20 left-0 right-0 z-50 px-4 py-2">
          <Alert className="max-w-4xl mx-auto border-2 border-orange-500 bg-orange-50 shadow-lg relative">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 hover:bg-orange-100 rounded-full transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4 text-orange-700" />
            </button>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <AlertTitle className="text-lg font-bold text-orange-900">Low Credits Warning</AlertTitle>
            <AlertDescription className="text-base text-orange-800">
              <div className="space-y-2">
                <p>
                  Your credit balance is low: <span className="font-bold">{creditStatus.credits_remaining} credits</span>. 
                  VDP will be automatically disabled when credits reach 0 or below.
                </p>
                <Button 
                  asChild
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-5 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white border-none hover:from-green-700 hover:to-green-800 text-lg font-semibold mt-2"
                  title="Purchase Credits"
                  data-testid="button-buy-credits"
                >
                  <Link href="/dashboard/billing-dashboard">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Purchase Credits
                  </Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
        <CreditPurchaseModal
          isOpen={isCreditPurchaseOpen}
          onClose={() => setIsCreditPurchaseOpen(false)}
          userEmail={authState.user?.email || authState.profile?.email}
          onCreditsAdded={handleCreditsAdded}
        />
      </>
    );
  }

  return (
    <>
      <CreditPurchaseModal
        isOpen={isCreditPurchaseOpen}
        onClose={() => setIsCreditPurchaseOpen(false)}
        userEmail={authState.user?.email || authState.profile?.email}
        onCreditsAdded={handleCreditsAdded}
      />
    </>
  );
}

