import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckoutForm } from './CheckoutForm';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { apiRequest } from '@/lib/queryClient';

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CreditPackage {
  credits: number;
  price: number;
  popular?: boolean;
  savings?: string;
}

const creditPackages: CreditPackage[] = [
  { credits: 50, price: 10.00 },
  { credits: 100, price: 18.00, savings: 'Save $2' },
  { credits: 200, price: 32.00, popular: true, savings: 'Save $8' },
  { credits: 500, price: 75.00, savings: 'Save $25' }
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
  const { toast } = useToast();

  const handlePackageSelect = async (pkg: CreditPackage) => {
    setSelectedPackage(pkg);
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/payments/create-payment-intent', {
        amount: pkg.price,
        creditPackage: pkg.credits
      });

      const data = await response.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setShowCheckout(true);
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
    onClose();
  };

  const handleBackToPackages = () => {
    setShowCheckout(false);
    setSelectedPackage(null);
    setClientSecret('');
    setPaymentIntentId('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
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
            </div>

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

            <div className="text-center text-xs text-gray-500 dark:text-gray-400">
              Secure payment processed by Stripe • No subscription required
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {clientSecret && (
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
                  userEmail={userEmail}
                  creditPackage={selectedPackage}
                  onSuccess={handlePaymentSuccess}
                  onBack={handleBackToPackages}
                />
              </Elements>
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