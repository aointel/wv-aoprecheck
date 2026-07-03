import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, CreditCard, Shield } from 'lucide-react';

interface CreditPackage {
  credits: number;
  price: number;
}

interface CheckoutFormProps {
  clientSecret: string;
  paymentIntentId: string;
  userEmail?: string;
  creditPackage: CreditPackage | null;
  onSuccess: () => void;
  onBack: () => void;
}

export function CheckoutForm({ 
  clientSecret, 
  paymentIntentId, 
  userEmail, 
  creditPackage, 
  onSuccess, 
  onBack 
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !userEmail || !creditPackage) {
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm payment with Stripe and pre-fill billing details
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          payment_method_data: {
            billing_details: {
              email: userEmail,
              name: userEmail.split('@')[0] // Use email prefix as name
            }
          }
        }
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Get current credits before confirmation
        let creditsBefore = 0;
        try {
          const creditsResponse = await fetch(`/api/connectnow/user-credits/${userEmail}`, {
            credentials: 'include'
          });
          if (creditsResponse.ok) {
            const creditsData = await creditsResponse.json();
            creditsBefore = creditsData.credits_remaining || 0;
          }
        } catch (e) {
          console.warn('Could not fetch credits before confirmation:', e);
        }

        // Confirm payment with our backend and add credits
        try {
          const response = await apiRequest('POST', '/api/payments/confirm-payment', {
            paymentIntentId: paymentIntent.id,
            userEmail: userEmail
          });

          const result = await response.json();
          
          if (result.success) {
            onSuccess();
            return;
          } else {
            throw new Error(result.error || 'Failed to add credits');
          }
        } catch (backendError: any) {
          console.error('Backend confirmation error:', backendError);
          
          // Check if credits were actually added (webhook might have processed it)
          try {
            // Wait a moment for webhook to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const creditsResponse = await fetch(`/api/connectnow/user-credits/${userEmail}`, {
              credentials: 'include'
            });
            if (creditsResponse.ok) {
              const creditsData = await creditsResponse.json();
              const creditsAfter = creditsData.credits_remaining || 0;
              
              // If credits increased, webhook processed it successfully
              if (creditsAfter > creditsBefore) {
                console.log('✅ Credits were added by webhook, showing success');
                toast({
                  title: "Payment Successful",
                  description: `Payment processed successfully. ${creditsAfter - creditsBefore} credits added to your account.`,
                  variant: "default",
                });
                onSuccess();
                return;
              }
            }
          } catch (checkError) {
            console.warn('Could not verify credits after payment:', checkError);
          }
          
          // If we can't verify credits were added, show warning but not error
          toast({
            title: "Payment Processed",
            description: "Payment successful. Credits should be added shortly. If you don't see them, please refresh the page or contact support.",
            variant: "default",
          });
          // Still call onSuccess to close the modal
          setTimeout(() => onSuccess(), 2000);
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!creditPackage) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Order Summary</h3>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {creditPackage.credits} Credits
          </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            ${creditPackage.price}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Total</span>
          <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
            ${creditPackage.price}
          </span>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CreditCard className="h-4 w-4" />
            <span>Payment Information</span>
          </div>
          
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <PaymentElement 
              options={{
                layout: 'tabs',
                defaultValues: {
                  billingDetails: {
                    email: userEmail,
                    name: userEmail?.split('@')[0] || ''
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span>Your payment is secured by Stripe with 256-bit SSL encryption</span>
        </div>

        {/* Action Buttons */}
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
            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </div>
            ) : (
              `Complete Purchase - $${creditPackage.price}`
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}