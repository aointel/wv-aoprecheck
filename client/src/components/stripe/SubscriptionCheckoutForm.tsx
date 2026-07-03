import { useState, useEffect, useRef } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, CreditCard, Shield } from 'lucide-react';
import type { PlanOption, SubscriptionPlan } from '@/components/outbound-dialer/types';

interface SubscriptionCheckoutFormProps {
  userEmail?: string;
  planOption: PlanOption;
  plan: SubscriptionPlan;
  onSuccess: (subscription: any) => void;
  onBack: () => void;
}

export function SubscriptionCheckoutForm({
  userEmail,
  planOption,
  plan,
  onSuccess,
  onBack,
}: SubscriptionCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [discountCode, setDiscountCode] = useState('');
  const [discountStatus, setDiscountStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [discountAmountOffCents, setDiscountAmountOffCents] = useState<number | null>(null);
  const [discountErrorDetail, setDiscountErrorDetail] = useState<string | null>(null);
  const [discountAutoApplied, setDiscountAutoApplied] = useState(false);
  const userEditedDiscountRef = useRef(false);

  useEffect(() => {
    if (!userEmail || userEmail === 'default@example.com') {
      return;
    }
    userEditedDiscountRef.current = false;
    let cancelled = false;
    (async () => {
      setDiscountStatus('checking');
      setDiscountAutoApplied(false);
      try {
        const params = new URLSearchParams({ userEmail });
        const res = await fetch(`/api/billing/associate-discount/autodetect?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'x-user-email': userEmail },
        });
        const data = await res.json();
        if (cancelled || userEditedDiscountRef.current) return;
        if (res.ok && data.valid && typeof data.associateId === 'string' && data.associateId.trim()) {
          setDiscountCode(data.associateId.trim());
          setDiscountStatus('valid');
          setDiscountPercent(typeof data.discountPercent === 'number' ? data.discountPercent : null);
          setDiscountAmountOffCents(
            typeof data.discountAmountOffCents === 'number' ? data.discountAmountOffCents : null,
          );
          setDiscountErrorDetail(null);
          setDiscountAutoApplied(true);
        } else if (!userEditedDiscountRef.current) {
          setDiscountStatus('idle');
          setDiscountCode('');
          setDiscountPercent(null);
          setDiscountAmountOffCents(null);
        } else {
          setDiscountStatus('idle');
        }
      } catch {
        if (!cancelled && !userEditedDiscountRef.current) {
          setDiscountStatus('idle');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !userEmail) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          payment_method_data: {
            billing_details: {
              email: userEmail,
              name: userEmail.split('@')[0],
            },
          },
        },
      });

      if (error) {
        toast({
          title: 'Payment Failed',
          description: error.message || 'Unable to confirm payment method.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      const paymentMethodId = (setupIntent?.payment_method as string) || null;

      if (!paymentMethodId) {
        toast({
          title: 'Payment Error',
          description: 'Stripe did not return a payment method. Please try again.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      const response = await apiRequest('POST', '/api/billing/subscription/activate', {
        plan,
        paymentMethodId,
        setupIntentId: setupIntent?.id,
        userEmail: userEmail,
        couponCode:
          discountStatus === 'valid' && discountCode.trim() ? discountCode.trim() : undefined,
      }, userEmail);

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to activate subscription.');
      }

      onSuccess(data.subscription);
    } catch (err: any) {
      console.error('Subscription activation error:', err);
      toast({
        title: 'Upgrade Failed',
        description: err?.message || 'Unable to activate subscription. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Plan Summary</h3>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {planOption.label} Plan
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {planOption.price} {planOption.priceSuffix}
          </span>
        </div>
        <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
          {planOption.benefits.slice(0, 3).map((benefit) => (
            <div key={benefit} className="text-xs text-gray-500 dark:text-gray-400">
              {benefit}
            </div>
          ))}
          {planOption.benefits.length > 3 && (
            <div className="text-[11px] text-gray-400 dark:text-gray-500">
              + {planOption.benefits.length - 3} more premium features
            </div>
          )}
        </div>
        <div className="flex justify-between items-center pt-2 mt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Billing</span>
          <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
            Cancel anytime
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CreditCard className="h-4 w-4" />
            <span>Payment Method</span>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <PaymentElement
              options={{
                layout: 'tabs',
                defaultValues: {
                  billingDetails: {
                    email: userEmail,
                    name: userEmail?.split('@')[0] || '',
                  },
                },
              }}
            />
          </div>
        </div>



        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Your payment method is stored securely by Stripe and will be charged when you subscribe.</span>
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            type="submit"
            disabled={!stripe || isProcessing}
            className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Activating...
              </div>
            ) : (
              'Subscribe & Activate Plan'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}


