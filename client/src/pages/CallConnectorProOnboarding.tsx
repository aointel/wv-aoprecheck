import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Video, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

export default function CallConnectorProOnboarding() {
  const { authState } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userEmail = authState?.user?.email;
  const [isSubscribing, setIsSubscribing] = useState(false);

  // 🔥 BYPASS: These emails get FULL ACCESS - BYPASSES ALL CHECKS
  const bypassEmails = [
    'richiealtig@aoglobelife.com',
    'coopertyler@aoglobelife.com',
    'jacobnavarre@aoglobelife.com',
    'kaylar@aoglobelife.com',
    'ryancarrion@aoglobelife.com',
    'makelaoutlawalexander@aoglobelife.com',
    'langjames@aoglobelife.com',
    'vernawillbur@aoglobelife.com',
    'nicolasmahaffy@aoglobelife.com',
    'karamikovar@aoglobelife.com',
    'demarcusporter@aoglobelife.com'
  ];
  
  const isBypassEmail = userEmail && bypassEmails.includes(userEmail.toLowerCase().trim());

  // 🔥 BYPASS: Redirect bypass emails to Call Connector Pro immediately
  useEffect(() => {
    if (isBypassEmail) {
      console.log(`✅ CCPRO ONBOARDING BYPASS: ${userEmail} - Redirecting to Call Connector Pro`);
      setLocation('/dashboard/connect');
    }
  }, [isBypassEmail, userEmail, setLocation]);

  const handleSignup = async () => {
    if (!userEmail) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe",
        variant: "destructive"
      });
      return;
    }

    setIsSubscribing(true);

    try {
      // Create Stripe checkout session directly
      const response = await fetch('/api/billing/subscription/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: userEmail,
          plan: 'professional', // Default to professional plan
          successUrl: `${window.location.origin}/dashboard/connect?status=success`,
          cancelUrl: `${window.location.origin}/dashboard/call-connector-pro-onboarding?status=cancelled`,
        }),
      });

      const data = await response.json();

      if (data.success && data.url) {
        // Redirect to Stripe checkout (only redirect is to Stripe for payment)
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Subscription checkout error:', error);
      toast({
        title: "Subscription Failed",
        description: error.message || "Failed to start subscription. Please try again.",
        variant: "destructive"
      });
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900 p-4 flex items-center justify-center">
      <Card className="max-w-2xl w-full bg-gray-900/80 border-blue-500/30 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-blue-400" />
          </div>
          <CardTitle className="text-3xl font-bold text-white mb-2">
            Call Connector Pro
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Signup Message */}
          <div className="bg-blue-500/10 p-6 rounded-lg border border-blue-500/30 text-center">
            <p className="text-white text-lg font-medium mb-2">
              Get Professional Outbound Dialing
            </p>
            <p className="text-gray-300 text-base">
              Subscribe to Call Connector Pro to start making outbound calls with local presence in every state.
            </p>
          </div>

          {/* Signup Button */}
            <div className="text-center">
              <Button
              onClick={handleSignup}
              disabled={!userEmail || isSubscribing}
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg h-14"
              >
              {isSubscribing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Checkout...
                  </>
                ) : (
                'Subscribe to Call Connector Pro'
                )}
              </Button>
              {!userEmail && (
                <p className="text-gray-400 text-sm mt-2">
                Please log in to subscribe
                </p>
              )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
