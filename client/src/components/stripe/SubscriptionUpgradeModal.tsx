import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import type { PlanOption, SubscriptionPlan } from '@/components/outbound-dialer/types';
import { SubscriptionCheckoutForm } from './SubscriptionCheckoutForm';

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  planOptions: PlanOption[];
  currentPlan?: SubscriptionPlan;
  initialPlan?: SubscriptionPlan | null;
  userEmail?: string;
  onCompleted: (subscription: any) => void;
}

type ModalStep = 'select' | 'payment';

export function SubscriptionUpgradeModal({
  isOpen,
  onClose,
  planOptions,
  currentPlan,
  initialPlan = null,
  userEmail,
  onCompleted,
}: SubscriptionUpgradeModalProps) {
  const { toast } = useToast();
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [step, setStep] = useState<ModalStep>('select');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(initialPlan);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(initialPlan ? 'payment' : 'select');
      setSelectedPlan(initialPlan);
      if (!stripePromise) {
        initializeStripe();
      }
      if (!initialPlan) {
        resetPaymentState();
      }
    } else {
      resetPaymentState();
      setStep('select');
      setSelectedPlan(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialPlan && step === 'payment' && !clientSecret) {
      startCheckout(initialPlan).catch((error) => {
        console.error('Failed to start checkout:', error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlan, isOpen, step]);

  const initializeStripe = async () => {
    try {
      if (stripePromise) {
        // Wait for existing promise to resolve
        await stripePromise;
        setStripeReady(true);
        return;
      }

      let publishableKey: string | null = null;
      
      // Try to fetch from API first
      try {
        console.log('🔄 Fetching Stripe config from API...');
        const response = await apiRequest('GET', '/api/stripe/config');
        const data = await response.json();
        publishableKey = data?.publishableKey;
        console.log('✅ Stripe config fetched from API:', publishableKey ? 'Key received' : 'No key in response');
      } catch (apiError: any) {
        console.error('❌ Failed to fetch Stripe config from API:', apiError);
        console.error('   Error details:', {
          message: apiError?.message,
          status: apiError?.status,
          stack: apiError?.stack
        });
        // Fallback to hardcoded key (same as CreditPurchaseModal)
        publishableKey = 'pk_live_51QUWLbDB901D7nogTsLhaocdKc8HT8jWMs6F43v8CSeB9E8wUdg9RAh4K4ZpSUV0lY9eOVi6Sd8a5OrfaV9EnCtE00eKP0VSwF';
        console.log('✅ Using fallback hardcoded Stripe key');
      }

      if (!publishableKey) {
        throw new Error('Stripe publishable key not available');
      }

      console.log('🔄 Loading Stripe with publishable key...');
      const promise = loadStripe(publishableKey);
      setStripePromise(promise);
      // Wait for Stripe to load before marking as ready
      await promise;
      console.log('✅ Stripe loaded successfully');
      setStripeReady(true);
    } catch (error: any) {
      console.error('❌ Failed to initialize Stripe:', error);
      console.error('   Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      });
      setStripeReady(false);
      toast({
        title: 'Payment System Error',
        description: error?.message || 'Unable to initialize payment system. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const resetPaymentState = () => {
    setClientSecret('');
    setStep('select');
  };

  const startCheckout = async (plan: SubscriptionPlan) => {
    try {
      setIsLoading(true);
      await initializeStripe();

      const response = await apiRequest('POST', '/api/billing/subscription/setup-intent', {
        plan,
      }, userEmail);

      const data = await response.json();

      if (!data?.success || !data?.clientSecret) {
        throw new Error(data?.error || 'Failed to initialize upgrade checkout.');
      }

      setSelectedPlan(plan);
      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch (error: any) {
      console.error('Subscription setup error:', error);
      toast({
        title: 'Checkout Error',
        description: error?.message || 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPlanOption = useMemo(() => {
    if (!selectedPlan) return null;
    return planOptions.find((option) => option.plan === selectedPlan) || null;
  }, [planOptions, selectedPlan]);

  const handleClose = () => {
    if (isLoading) {
      return;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-800">
            Upgrade Call Connector Pro
          </DialogTitle>
          <p className="text-sm text-slate-500">
            Unlock unlimited outbound dialing with the Professional plan.
          </p>
        </DialogHeader>

        {step === 'select' && (
          <div className="grid gap-4 md:grid-cols-1">
            {planOptions.map((option) => {
              const isCurrent = currentPlan === option.plan;
              const isSelected = selectedPlan === option.plan;
              return (
                <Card
                  key={option.plan}
                  className={`relative overflow-hidden ${option.cardClass} ${
                    isSelected ? 'ring-2 ring-purple-500' : ''
                  } ${isCurrent ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  {option.topBanner && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white text-xs font-semibold tracking-widest uppercase py-2 text-center">
                      {option.topBanner}
                    </div>
                  )}
                  <CardHeader className={`${option.gradientClass} ${option.topBanner ? 'pt-12' : ''}`}>
                    <div className="flex items-center gap-3 text-slate-900">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/40 text-slate-900">
                        {option.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{option.label}</h3>
                        <p className="text-xs text-slate-600">{option.tagline}</p>
                      </div>
                    </div>
                    <div className="mt-4 text-3xl font-bold text-slate-900">
                      {option.price}
                      <span className="ml-2 text-sm font-medium text-slate-700">{option.priceSuffix}</span>
                    </div>
                  </CardHeader>
                  <CardContent className={`${option.bodyClass} space-y-3`}> 
                    <div className="space-y-2 text-sm text-slate-600">
                      {option.benefits.map((benefit) => (
                        <div key={benefit} className="flex items-start gap-2">
                          <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      className={`w-full ${option.buttonClass}`}
                      disabled={isCurrent || isLoading}
                      onClick={() => startCheckout(option.plan)}
                    >
                      {isCurrent ? 'Current Plan' : option.ctaLabel}
                    </Button>

                    {isCurrent && (
                      <Badge className="w-full justify-center bg-emerald-500 text-white">
                        Active Subscription
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {step === 'payment' && selectedPlanOption && clientSecret ? (
          stripePromise && stripeReady ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#7c3aed',
                  },
                },
              }}
            >
              <SubscriptionCheckoutForm
                planOption={selectedPlanOption}
                plan={selectedPlanOption.plan}
                userEmail={userEmail}
                onSuccess={(subscription) => {
                  toast({
                    title: 'Subscription Activated',
                    description: `${selectedPlanOption.label} plan is now active.`,
                  });
                  onCompleted(subscription);
                  handleClose();
                }}
                onBack={() => {
                  setStep('select');
                  setClientSecret('');
                }}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                {stripePromise ? 'Loading payment form…' : 'Initializing checkout…'}
              </span>
            </div>
          )
        ) : step === 'payment' && !clientSecret ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Preparing payment form…</span>
          </div>
        ) : null}

        {isLoading && (
          <div className="flex items-center justify-center p-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Preparing checkout…</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


