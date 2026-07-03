import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { CheckoutForm } from './CheckoutForm';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

// Stripe promise will be initialized after fetching the public key
let stripePromise: Promise<any> | null = null;

interface CreditPackage {
  credits: number;
  price: number;
  popular?: boolean;
  savings?: string;
}

const creditPackages: CreditPackage[] = [
  { credits: 50, price: 50.00 },
  { credits: 100, price: 100.00 },
  { credits: 200, price: 200.00, popular: true },
  { credits: 500, price: 500.00 }
];

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  onCreditsAdded?: () => void;
}

export function CreditPurchaseModal({ isOpen, onClose, userEmail, onCreditsAdded }: CreditPurchaseModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [customCredits, setCustomCredits] = useState<string>('');
  const { toast } = useToast();
  const { authState } = useAuth();
  
  // Get userEmail from props, auth state, or localStorage
  const effectiveUserEmail = userEmail || authState?.user?.email || localStorage.getItem('userEmail') || '';

  // Fetch current credit balance
  const { data: creditsData } = useQuery({
    queryKey: ['/api/user/credits', effectiveUserEmail],
    queryFn: async () => {
      if (!effectiveUserEmail) return null;
      const headers: HeadersInit = {};
      if (effectiveUserEmail) {
        headers['x-user-email'] = effectiveUserEmail;
      }
      const response = await fetch('/api/user/credits', { headers });
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    enabled: isOpen && !!effectiveUserEmail,
  });

  const creditsRemaining = (creditsData as any)?.credits_remaining ?? (creditsData as any)?.creditsRemaining ?? 0;
  const creditsNeeded = creditsRemaining < 0 ? Math.abs(creditsRemaining) : 0;

  // Initialize Stripe when modal opens
  useEffect(() => {
    if (isOpen && !stripePromise) {
      initializeStripe();
    }
  }, [isOpen]);

  const initializeStripe = async () => {
    try {
      // Use hardcoded Stripe public key for now since the API endpoint isn't accessible
      const stripePublicKey = 'pk_live_51QUWLbDB901D7nogTsLhaocdKc8HT8jWMs6F43v8CSeB9E8wUdg9RAh4K4ZpSUV0lY9eOVi6Sd8a5OrfaV9EnCtE00eKP0VSwF';
      
      if (stripePublicKey) {
        stripePromise = loadStripe(stripePublicKey);
        setStripeReady(true);
        console.log('✅ Stripe initialized with hardcoded public key');
      } else {
        throw new Error('No Stripe public key available');
      }
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      toast({
        title: 'Payment System Error',
        description: 'Unable to initialize payment system. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const handlePackageSelect = async (pkg: CreditPackage) => {
    if (!effectiveUserEmail) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to purchase credits',
        variant: 'destructive',
      });
      return;
    }

    setSelectedPackage(pkg);
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/payments/create-payment-intent', {
        amount: pkg.price,
        creditPackage: pkg.credits,
        userEmail: effectiveUserEmail,
        userName: effectiveUserEmail.split('@')[0]
      });

      const data = await response.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setShowCheckout(true);
        setShowCustomAmount(false);
      } else {
        throw new Error('Failed to create payment intent');
      }
    } catch (error) {
      console.error('Payment setup error:', error);
      toast({
        title: 'Payment Error',
        description: 'Failed to initialize payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomAmount = async () => {
    if (!effectiveUserEmail) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to purchase credits',
        variant: 'destructive',
      });
      return;
    }

    const credits = parseInt(customCredits);
    if (isNaN(credits) || credits < 1) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid number of credits (minimum 1)',
        variant: 'destructive',
      });
      return;
    }

    if (credits > 10000) {
      toast({
        title: 'Amount Too Large',
        description: 'Maximum purchase is 10,000 credits at a time',
        variant: 'destructive',
      });
      return;
    }

    const price = credits; // $1 per credit
    const customPackage: CreditPackage = { credits, price };

    setSelectedPackage(customPackage);
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/payments/create-payment-intent', {
        amount: price,
        creditPackage: credits,
        userEmail: effectiveUserEmail,
        userName: effectiveUserEmail.split('@')[0]
      });

      const data = await response.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setShowCheckout(true);
        setShowCustomAmount(false);
      } else {
        throw new Error('Failed to create payment intent');
      }
    } catch (error) {
      console.error('Payment setup error:', error);
      toast({
        title: 'Payment Error',
        description: 'Failed to initialize payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast({
      title: 'Payment Successful!',
      description: `${selectedPackage?.credits} credits have been added to your account.`,
    });
    onCreditsAdded?.();
    handleClose();
  };

  const handleClose = () => {
    setSelectedPackage(null);
    setClientSecret('');
    setPaymentIntentId('');
    setShowCheckout(false);
    setShowCustomAmount(false);
    setCustomCredits('');
    onClose();
  };

  const handleBackToPackages = () => {
    setShowCheckout(false);
    setSelectedPackage(null);
    setClientSecret('');
    setPaymentIntentId('');
    setShowCustomAmount(false);
    setCustomCredits('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl z-[10050]"
        overlayClassName="z-[10040]"
      >
        <DialogHeader>
          <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-blue-700 rounded-lg p-4 text-white mb-4">
            <DialogTitle className="text-xl font-bold">
              {showCheckout ? 'Complete Purchase' : 'Purchase Credits'}
            </DialogTitle>
            <p className="text-sm text-white/90 mt-1">
              {showCheckout 
                ? `${selectedPackage?.credits} Credits - $${selectedPackage?.price}`
                : 'Choose a credit package to continue using AO Intelligence'
              }
            </p>
          </div>
        </DialogHeader>

        {!showCheckout ? (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Select Credit Package
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Credits are used for outbound calling, VDP access, and platform features
              </p>
              {creditsRemaining < 0 && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    <strong>Current Balance:</strong> {creditsRemaining} credits
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                    Purchase <strong>{creditsNeeded}</strong> credits to bring your account current
                  </p>
                </div>
              )}
            </div>

            {!showCustomAmount ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {creditPackages.map((pkg) => (
                    <Card 
                      key={pkg.credits}
                      className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        pkg.popular ? 'ring-2 ring-blue-500 scale-105' : 'hover:ring-1 hover:ring-gray-300'
                      }`}
                      onClick={() => handlePackageSelect(pkg)}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-blue-500 text-white text-xs px-3 py-1">
                            Most Popular
                          </Badge>
                        </div>
                      )}
                      
                      <CardContent className="p-6 text-center">
                        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {pkg.credits}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          Credits
                        </div>
                        
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                          ${pkg.price}
                        </div>
                        
                        {pkg.savings && (
                          <Badge variant="secondary" className="text-xs mb-3">
                            {pkg.savings}
                          </Badge>
                        )}
                        
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ${(pkg.price / pkg.credits).toFixed(2)} per credit
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative flex-1 max-w-xs">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">or</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      setShowCustomAmount(true);
                      if (creditsNeeded > 0) {
                        setCustomCredits(creditsNeeded.toString());
                      }
                    }}
                    variant="outline"
                    className="w-full max-w-xs"
                  >
                    Purchase Custom Amount
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="text-center">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Enter Custom Credit Amount
                  </h4>
                  {creditsNeeded > 0 && (
                    <p className="text-sm text-orange-600 dark:text-orange-400 mb-4">
                      Suggested: {creditsNeeded} credits to bring your account current
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customCredits">Number of Credits</Label>
                  <Input
                    id="customCredits"
                    type="number"
                    min="1"
                    max="10000"
                    value={customCredits}
                    onChange={(e) => setCustomCredits(e.target.value)}
                    placeholder={creditsNeeded > 0 ? creditsNeeded.toString() : "Enter amount"}
                    className="text-lg"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ${customCredits ? (parseInt(customCredits) || 0).toFixed(2) : '0.00'} total ($1.00 per credit)
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCustomAmount}
                    disabled={!customCredits || parseInt(customCredits) < 1}
                    className="flex-1"
                  >
                    Continue to Payment
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCustomAmount(false);
                      setCustomCredits('');
                    }}
                    variant="outline"
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              Secure payment processed by Stripe • No subscription required
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!stripeReady ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Initializing payment system...
                </span>
              </div>
            ) : clientSecret && stripePromise ? (
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#3b82f6',
                    },
                  },
                }}
              >
                <CheckoutForm 
                  clientSecret={clientSecret}
                  paymentIntentId={paymentIntentId}
                  userEmail={effectiveUserEmail}
                  creditPackage={selectedPackage}
                  onSuccess={handlePaymentSuccess}
                  onBack={handleBackToPackages}
                />
              </Elements>
            ) : (
              <div className="text-center p-4 text-red-600 dark:text-red-400">
                Failed to initialize payment system. Please try again.
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Setting up payment...
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}