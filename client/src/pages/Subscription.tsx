import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { CheckoutForm } from '@/components/stripe/CheckoutForm';
import { 
  MdPhone, 
  MdTrendingUp, 
  MdCheck, 
  MdStar,
  MdBusinessCenter,
  MdDiamond,
  MdHistory,
  MdPayment,
  MdPeople,
  MdVerifiedUser
} from 'react-icons/md';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { UsageDisplay } from '@/components/billing/usage-display';
import { PhoneCall, PhoneOff, Calendar, Users, Shield, Star, Zap, Target, Undo2 } from 'lucide-react';
import { CreditsManagementSection } from '@/components/billing/credits-management';

interface CreditPackage {
  credits: number;
  price: number;
  savings?: number;
  perCreditCost: number;
  popular?: boolean;
}

interface ConnectionsData {
  answeredCalls: Array<{
    id: string;
    to_number: string;
    from_number: string;
    status: string;
    call_started_at: string;
    duration?: number;
  }>;
  missedCallCount: number;
  agentId: string;
  totalConnections: number;
}

interface CallTypeStats {
  aoiConnect: number;
  aoiMissed: number;
  aoiRecruit: number;
  recruitMissed: number;
  aoiPrecheck: number;
  hotleadConnect: number;
}

const callTypeConfig = {
  aoiConnect: {
    name: 'AOI Connect',
    icon: PhoneCall,
    color: 'blue',
    bgClass: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20',
    textClass: 'text-blue-600',
    iconClass: 'text-blue-600'
  },
  aoiMissed: {
    name: 'AOI Missed',
    icon: PhoneOff,
    color: 'red',
    bgClass: 'from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20',
    textClass: 'text-red-600',
    iconClass: 'text-red-600'
  },
  aoiRecruit: {
    name: 'AOI Recruit',
    icon: Users,
    color: 'green',
    bgClass: 'from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20',
    textClass: 'text-green-600',
    iconClass: 'text-green-600'
  },
  recruitMissed: {
    name: 'Recruit Missed',
    icon: Users,
    color: 'orange',
    bgClass: 'from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/20',
    textClass: 'text-orange-600',
    iconClass: 'text-orange-600'
  },
  aoiPrecheck: {
    name: 'AOI PreCheck',
    icon: Shield,
    color: 'purple',
    bgClass: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20',
    textClass: 'text-purple-600',
    iconClass: 'text-purple-600'
  },
  hotleadConnect: {
    name: 'HotLead Connect',
    icon: Target,
    color: 'amber',
    bgClass: 'from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20',
    textClass: 'text-amber-600',
    iconClass: 'text-amber-600'
  }
};

function ConnectionsTab({ userEmail }: { userEmail?: string }) {
  const { data: callStats, isLoading } = useQuery({
    queryKey: ['/api/billing/call-stats', userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const response = await apiRequest('GET', `/api/billing/call-stats?userEmail=${encodeURIComponent(userEmail)}`);
      return response.json() as Promise<CallTypeStats>;
    },
    enabled: !!userEmail
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!callStats) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No call data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Call Service Usage</h2>
        <p className="text-muted-foreground">Track your usage across all AO Intelligence call services</p>
      </div>

      {/* Call Service Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(callTypeConfig).map(([key, config]) => {
          const callCount = callStats[key as keyof CallTypeStats] || 0;
          const IconComponent = config.icon;

          return (
            <Card key={key} className={`bg-gradient-to-br ${config.bgClass}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${config.textClass}`}>{config.name}</p>
                    <p className="text-3xl font-bold">{callCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {key.includes('Missed') ? 'Billed calls' : 'Connected calls'}
                    </p>
                  </div>
                  <IconComponent className={`h-8 w-8 ${config.iconClass}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Service Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MdPhone className="mr-2 h-5 w-5" />
            Service Breakdown
          </CardTitle>
          <CardDescription>
            Detailed usage by service type with billing information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(callTypeConfig).map(([key, config]) => {
              const callCount = callStats[key as keyof CallTypeStats] || 0;
              const IconComponent = config.icon;
              const cost = key.includes('Missed') ? callCount * 4.00 : callCount * 0.05;

              return (
                <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.bgClass} flex items-center justify-center`}>
                      <IconComponent className={`h-5 w-5 ${config.iconClass}`} />
                    </div>
                    <div>
                      <p className="font-medium">{config.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {key.includes('Missed') ? 'Missed call billing' : 'Successful connections'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{callCount} calls</p>
                    <p className="text-sm text-muted-foreground">
                      ${cost.toFixed(2)} total
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Subscription() {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last7days');
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const { toast } = useToast();
  const { user, authState } = useAuth();
  const queryClient = useQueryClient();
  
  // Get user email - try authState.user.email first (most reliable), then user context, then localStorage
  const currentUserEmail = authState?.user?.email || user?.email || localStorage.getItem('userEmail') || '';
  
  console.log('🔍 Email sources:', {
    authStateEmail: authState?.user?.email,
    userEmail: user?.email,
    localStorageEmail: localStorage.getItem('userEmail'),
    finalEmail: currentUserEmail
  });

  // Credit packages with $1 per credit pricing
  const creditPackages: CreditPackage[] = [
    {
      credits: 50,
      price: 50,
      perCreditCost: 1.00
    },
    {
      credits: 100,
      price: 100,
      perCreditCost: 1.00
    },
    {
      credits: 200,
      price: 200,
      perCreditCost: 1.00,
      popular: true
    },
    {
      credits: 500,
      price: 500,
      perCreditCost: 1.00
    }
  ];

  // Initialize Stripe lazily when needed
  const initializeStripe = async () => {
    try {
      if (stripePromise) {
        return;
      }

      const response = await apiRequest('GET', '/api/stripe/config');
      const data = await response.json();
      const publishableKey = data?.publishableKey;

      if (!publishableKey) {
        throw new Error('Stripe publishable key not configured.');
      }

      const promise = loadStripe(publishableKey);
      setStripePromise(promise);
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
      toast({
        title: 'Payment System Error',
        description: 'Unable to initialize payment system. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  // Initialize Stripe when checkout dialog opens
  useEffect(() => {
    if (isCheckoutOpen && !stripePromise) {
      initializeStripe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen]);

  const handleCreditPurchase = async (creditPackage: CreditPackage) => {
    if (!currentUserEmail) {
      toast({
        title: "Authentication Required",
        description: "Please log in to purchase credits",
        variant: "destructive"
      });
      return;
    }

    // Initialize Stripe before opening checkout
    await initializeStripe();

    setSelectedPackage(creditPackage);

    try {
      // Create payment intent with user billing details
      const response = await apiRequest('POST', '/api/payments/create-payment-intent', {
        amount: creditPackage.price,
        creditPackage: creditPackage.credits,
        userEmail: currentUserEmail,
        userName: user?.name || currentUserEmail.split('@')[0]
      });

      const data = await response.json();
      
      if (data.clientSecret && data.paymentIntentId) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setIsCheckoutOpen(true);
      } else {
        throw new Error('Failed to create payment intent');
      }
    } catch (error) {
      console.error('Payment setup error:', error);
      toast({
        title: "Payment Setup Failed",
        description: "Unable to setup payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePaymentSuccess = () => {
    setIsCheckoutOpen(false);
    setClientSecret('');
    setPaymentIntentId('');
    setSelectedPackage(null);
    
    // Refresh credits data
    queryClient.invalidateQueries({ queryKey: ['/api/connectnow/user-credits'] });
    
    toast({
      title: "Payment Successful!",
      description: `${selectedPackage?.credits} credits have been added to your account`,
    });
  };

  const handleCheckoutClose = () => {
    setIsCheckoutOpen(false);
    setClientSecret('');
    setPaymentIntentId('');
    setSelectedPackage(null);
  };

  // Query for current usage data - prevent double load
  const { data: usage } = useQuery({
    queryKey: ['/api/usage/current'],
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  // Query for real transaction history from billing API - prevent double load
  const { data: billingData, isLoading: isLoadingBilling } = useQuery({
    queryKey: ['/api/billing/all-charges', selectedDateRange, currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      console.log('🔍 Fetching billing data for:', currentUserEmail, 'Range:', selectedDateRange);
      const response = await fetch(`/api/billing/all-charges/${selectedDateRange}?userEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) {
        console.error('❌ Billing API failed:', response.status, response.statusText);
        return null;
      }
      const data = await response.json();
      console.log('✅ Billing data received:', data);
      return data;
    },
    enabled: !!currentUserEmail,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  // Query for subscription status to show cancel button
  const { data: subscriptionStatus, isLoading: isLoadingSubscription, refetch: refetchSubscription } = useQuery({
    queryKey: ['/api/billing/subscription/status', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/billing/subscription/status?userEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!currentUserEmail,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  });

  console.log('💳 Subscription page loaded - user:', user, 'currentUserEmail:', currentUserEmail, 'billingData:', billingData, 'isLoading:', isLoadingBilling);

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
          Billing Center
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Manage your credits, view usage, and purchase plans
        </p>
      </div>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="usage">Current Usage</TabsTrigger>
          <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-6">
          {/* Current Usage Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Call Minutes</p>
                    <p className="text-2xl font-bold">{usage?.minutesUsed || 847}</p>
                    <p className="text-xs text-muted-foreground">of {usage?.minutesTotal || 1000} available</p>
                  </div>
                  <MdPhone className="h-8 w-8 text-blue-600" />
                </div>
                <div className="mt-4">
                  <Progress value={(usage?.minutesUsed || 847) / (usage?.minutesTotal || 1000) * 100} className="w-full" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">AO Credits</p>
                    <p className="text-2xl font-bold">{usage?.aoCredits || 50}</p>
                    <p className="text-xs text-muted-foreground">For AO Recruit & Precheck</p>
                  </div>
                  <MdBusinessCenter className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            {/* Add Real-time Usage Display */}
            <div className="md:col-span-3">
              <UsageDisplay />
            </div>
            
          </div>

          {/* Credit Management Actions */}
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Purchase AO Credits</h3>
                <div className="space-y-3">
                  {creditPackages.map((pkg, index) => (
                    <div 
                      key={index}
                      onClick={() => handleCreditPurchase(pkg)}
                      className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors ${
                        pkg.popular 
                          ? 'border-2 border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20' 
                          : 'border hover:bg-gray-50 dark:hover:bg-gray-800'
                      } relative`}
                    >
                      <div>
                        <span className="font-medium">{pkg.credits} Credits</span>
                        {pkg.popular && (
                          <div className="text-xs text-blue-600 font-bold">Most Popular</div>
                        )}
                        <div className="text-xs text-muted-foreground">${pkg.perCreditCost.toFixed(2)} per credit</div>
                      </div>
                      <span className="font-bold">${pkg.price}</span>
                      {pkg.popular && (
                        <Badge className="absolute -top-2 -right-2 bg-blue-500">Popular</Badge>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-center text-muted-foreground mt-4">
                  Secure payment processed by Stripe • No subscription required
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-8">
          {/* Per-Use Services Section */}
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Pay-Per-Use Services</h2>
              <p className="text-muted-foreground">Charged only when you use the service</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Connects */}
              <Card className="relative overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MdPhone className="w-6 h-6 text-blue-600" />
                      <CardTitle className="text-xl">Connects</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-base">
                    Successful connections from VDP calls
                  </CardDescription>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-bold">$8</span>
                    <span className="text-lg text-muted-foreground">per connection</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Successful VDP call connections</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Real-time tracking & analytics</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Automatic billing</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AO Recruit */}
              <Card className="relative overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MdPeople className="w-6 h-6 text-green-600" />
                      <CardTitle className="text-xl">AO Recruit</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-base">
                    Recruiting pipeline and prospect management
                  </CardDescription>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-bold">$5</span>
                    <span className="text-lg text-muted-foreground">per connection</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Recruit call automation</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Prospect management</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Booking & onboarding</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AO Precheck */}
              <Card className="relative overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MdVerifiedUser className="w-6 h-6 text-purple-600" />
                      <CardTitle className="text-xl">AO Precheck</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-base">
                    Verification and pre-check services
                  </CardDescription>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-bold">$3</span>
                    <span className="text-lg text-muted-foreground">per check</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Policy verification</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Review & approval</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Submission management</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Monthly Subscriptions Section */}
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Monthly Subscriptions</h2>
              <p className="text-muted-foreground">Unlimited access with monthly billing</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Call Connector Pro */}
              <Card className="relative overflow-hidden border-2 border-primary shadow-xl">
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white text-center py-2 text-sm font-medium">
                  ⭐ MOST POPULAR
                </div>
                <CardHeader className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 pt-12">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MdDiamond className="w-6 h-6 text-primary" />
                      <CardTitle className="text-xl">Call Connector Pro</CardTitle>
                    </div>
                    {subscriptionStatus?.subscription?.hasActiveSubscription && 
                     (subscriptionStatus.subscription.plan === 'professional' || subscriptionStatus.subscription.plan === 'elite') && (
                      <Badge className="bg-green-500 text-white">
                        <MdCheck className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                    {(!subscriptionStatus?.subscription?.hasActiveSubscription || 
                      (subscriptionStatus.subscription.plan !== 'professional' && subscriptionStatus.subscription.plan !== 'elite')) && (
                      <Badge className="bg-primary text-primary-foreground">
                        <MdStar className="w-3 h-3 mr-1" />
                        Best Value
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-base">
                    Professional outbound dialing with local presence
                  </CardDescription>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-bold">$64.99</span>
                    <span className="text-lg text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Professional outbound dialing</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Local Presence EVERY STATE.. Take your activity to the next level!</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Advanced analytics</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">HotLead assignment</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Priority support</span>
                    </div>
                  </div>
                  {subscriptionStatus?.subscription?.hasActiveSubscription && 
                   (subscriptionStatus.subscription.plan === 'professional' || subscriptionStatus.subscription.plan === 'elite') ? (
                    <Button 
                      onClick={async () => {
                        if (!confirm('Are you sure you want to cancel your Call Connector Pro subscription? This will cancel your subscription immediately and you will lose access at the end of your billing period.')) {
                          return;
                        }
                        
                        try {
                          const response = await fetch('/api/billing/subscription/cancel', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          
                          const data = await response.json();
                          
                          if (data.success) {
                            toast({
                              title: "Subscription Canceled",
                              description: "Your Call Connector Pro subscription has been canceled successfully.",
                            });
                            refetchSubscription();
                            queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription/status'] });
                          } else {
                            throw new Error(data.error || 'Failed to cancel subscription');
                          }
                        } catch (error) {
                          console.error('Cancel subscription error:', error);
                          toast({
                            title: "Cancel Failed",
                            description: error instanceof Error ? error.message : "Failed to cancel subscription. Please try again.",
                            variant: "destructive"
                          });
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 mt-4"
                      variant="destructive"
                    >
                      Cancel Subscription
                    </Button>
                  ) : (
                    <Button 
                      onClick={async () => {
                        if (!currentUserEmail) {
                          toast({
                            title: "Authentication Required",
                            description: "Please log in to subscribe",
                            variant: "destructive"
                          });
                          return;
                        }

                        try {
                          // Create Stripe checkout session
                          const response = await fetch('/api/billing/subscription/checkout-session', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              userEmail: currentUserEmail,
                              plan: 'professional', // Default to professional plan
                              successUrl: `${window.location.origin}/dashboard/connect?status=success`,
                              cancelUrl: `${window.location.origin}/dashboard/billing-dashboard?status=cancelled`,
                            }),
                          });

                          const data = await response.json();

                          if (data.success && data.url) {
                            // Redirect to Stripe checkout
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
                        }
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 mt-4"
                    >
                      Subscribe Now
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* AO Meet */}
              <Card className="relative overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MdBusinessCenter className="w-6 h-6 text-amber-600" />
                      <CardTitle className="text-xl">AO Meet</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-base">
                    Video meeting and collaboration platform
                  </CardDescription>
                  <div className="flex items-baseline space-x-2 mt-2">
                    <span className="text-4xl font-bold">$15.00</span>
                    <span className="text-lg text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Video meeting platform</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Screen sharing</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Collaboration tools</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MdCheck className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Meeting scheduling</span>
                    </div>
                  </div>
                  <Button className="w-full bg-amber-600 hover:bg-amber-700 mt-4">
                    Subscribe Now
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {/* Header with Date Range Selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select 
                value={selectedDateRange} 
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm"
              >
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="thisweek">This Week</option>
                <option value="thismonth">This Month</option>
                <option value="lastmonth">Last Month</option>
              </select>
            </div>
          </div>

          {/* Transaction Data from billing_transactions */}
          <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">
                  All ({isLoadingBilling ? '...' : billingData?.calls?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="connect">
                  Connect ({isLoadingBilling ? '...' : billingData?.calls?.filter((c: any) => c.type === 'AOI_CONNECT').length || 0})
                </TabsTrigger>
                <TabsTrigger value="recruit">
                  Recruit ({isLoadingBilling ? '...' : billingData?.calls?.filter((c: any) => c.type === 'AOI_RECRUIT').length || 0})
                </TabsTrigger>
                <TabsTrigger value="precheck">
                  PreCheck ({isLoadingBilling ? '...' : billingData?.calls?.filter((c: any) => c.type === 'AOI_PRECHECK').length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                {isLoadingBilling ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading transaction history...</p>
                    </CardContent>
                  </Card>
                ) : !billingData?.calls || billingData.calls.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <MdHistory className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Transaction History</h3>
                      <p className="text-muted-foreground">
                        No billing transactions found for the selected time period.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                              <th className="text-left p-4 font-semibold text-sm">Type</th>
                              <th className="text-left p-4 font-semibold text-sm">Name</th>
                              <th className="text-left p-4 font-semibold text-sm">Phone</th>
                              <th className="text-left p-4 font-semibold text-sm">Date</th>
                              <th className="text-right p-4 font-semibold text-sm">Credits</th>
                              <th className="text-right p-4 font-semibold text-sm">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingData.calls.map((call: any) => {
                              const isRefund = call.type === 'REFUND' || call.isRefund;
                              const config = call.type === 'AOI_CONNECT' 
                                ? { color: 'blue', icon: PhoneCall, name: 'Connect', bgColor: 'bg-blue-50 dark:bg-blue-900/20' } :
                                call.type === 'AOI_RECRUIT' 
                                ? { color: 'green', icon: Users, name: 'Recruit', bgColor: 'bg-green-50 dark:bg-green-900/20' } :
                                call.type === 'AOI_PRECHECK'
                                ? { color: 'purple', icon: Shield, name: 'PreCheck', bgColor: 'bg-purple-50 dark:bg-purple-900/20' } :
                                call.type === 'REFUND' || isRefund
                                ? { color: 'green', icon: Undo2, name: 'Refund', bgColor: 'bg-green-50 dark:bg-green-900/20' } :
                                call.type === 'AOI_MISSED'
                                ? { color: 'orange', icon: PhoneOff, name: 'Missed Call', bgColor: 'bg-orange-50 dark:bg-orange-900/20' } :
                                { color: 'gray', icon: Shield, name: call.type, bgColor: 'bg-gray-50 dark:bg-gray-900/20' };
                              const IconComponent = config.icon;
                              
                              return (
                                <tr key={call.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}>
                                        <IconComponent className={`h-4 w-4 text-${config.color}-600`} />
                                      </div>
                                      <span className="font-medium text-sm">{config.name}</span>
                                    </div>
                                  </td>
                                  <td className="p-4 text-sm">{call.leadName || 'N/A'}</td>
                                  <td className="p-4 text-sm font-mono">{call.phone || 'N/A'}</td>
                                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{call.chargedAt || 'N/A'}</td>
                                  <td className="p-4 text-right">
                                    <span className={`font-bold ${isRefund ? 'text-green-600' : (call.type === 'AOI_PRECHECK' || call.type === 'AOI_RECRUIT') ? 'text-green-600' : `text-${config.color}-600`}`}>
                                      {isRefund 
                                        ? `${call.creditsDeducted || 0}` 
                                        : (call.type === 'AOI_PRECHECK' || call.type === 'AOI_RECRUIT') 
                                          ? 'Free' 
                                          : (call.creditsDeducted || 'N/A')}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right text-sm font-semibold">
                                    {isRefund 
                                      ? <span className="text-green-600">${Math.abs(call.billingAmount || 0).toFixed(2)}</span>
                                      : (call.type === 'AOI_PRECHECK' || call.type === 'AOI_RECRUIT') 
                                        ? <span className="text-green-600">Free</span> 
                                        : `$${call.billingAmount || '0.00'}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="connect" className="mt-4">
                {isLoadingBilling ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading connections...</p>
                    </CardContent>
                  </Card>
                ) : !billingData?.calls || billingData.calls.filter((c: any) => c.type === 'AOI_CONNECT').length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <PhoneCall className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Connect Transactions</h3>
                      <p className="text-muted-foreground">No connect transactions found for this period.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                              <th className="text-left p-4 font-semibold text-sm">Type</th>
                              <th className="text-left p-4 font-semibold text-sm">Name</th>
                              <th className="text-left p-4 font-semibold text-sm">Phone</th>
                              <th className="text-left p-4 font-semibold text-sm">Market</th>
                              <th className="text-left p-4 font-semibold text-sm">Date</th>
                              <th className="text-right p-4 font-semibold text-sm">Credits</th>
                              <th className="text-right p-4 font-semibold text-sm">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingData.calls
                              .filter((c: any) => c.type === 'AOI_CONNECT')
                              .map((call: any) => {
                                // Market is provided by backend
                                const market = call.market || 'Globe Market';
                                
                                return (
                                  <tr key={call.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="p-4">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                          <PhoneCall className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <span className="font-medium text-sm">Connect</span>
                                      </div>
                                    </td>
                                    <td className="p-4 text-sm">{call.leadName || 'N/A'}</td>
                                    <td className="p-4 text-sm font-mono">{call.phone || 'N/A'}</td>
                                    <td className="p-4 text-sm">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        market === 'Veteran' 
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' 
                                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                      }`}>
                                        {market}
                                      </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{call.chargedAt || 'N/A'}</td>
                                    <td className="p-4 text-right">
                                      <span className={`font-bold ${(call.type === 'AOI_PRECHECK' || call.type === 'AOI_RECRUIT') ? 'text-green-600' : 'text-blue-600'}`}>
                                        {call.type === 'AOI_PRECHECK' ? 'Free' : (call.creditsDeducted ?? 'N/A')}
                                      </span>
                                    </td>
                                    <td className="p-4 text-right text-sm font-semibold">
                                      {call.type === 'AOI_PRECHECK' ? <span className="text-green-600">Free</span> : `$${call.billingAmount || '0.00'}`}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="recruit" className="mt-4">
                {isLoadingBilling ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading recruits...</p>
                    </CardContent>
                  </Card>
                ) : !billingData?.calls || billingData.calls.filter((c: any) => c.type === 'AOI_RECRUIT').length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Recruit Transactions</h3>
                      <p className="text-muted-foreground">No recruit transactions found for this period.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                              <th className="text-left p-4 font-semibold text-sm">Type</th>
                              <th className="text-left p-4 font-semibold text-sm">Name</th>
                              <th className="text-left p-4 font-semibold text-sm">Phone</th>
                              <th className="text-left p-4 font-semibold text-sm">Date</th>
                              <th className="text-right p-4 font-semibold text-sm">Credits</th>
                              <th className="text-right p-4 font-semibold text-sm">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingData.calls
                              .filter((c: any) => c.type === 'AOI_RECRUIT')
                              .map((call: any) => (
                                <tr key={call.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-green-600" />
                                      </div>
                                      <span className="font-medium text-sm">Recruit</span>
                                    </div>
                                  </td>
                                  <td className="p-4 text-sm">{call.leadName || 'N/A'}</td>
                                  <td className="p-4 text-sm font-mono">{call.phone || 'N/A'}</td>
                                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{call.chargedAt || 'N/A'}</td>
                                  <td className="p-4 text-right">
                                    <span className="font-bold text-green-600">Free</span>
                                  </td>
                                  <td className="p-4 text-right text-sm font-semibold"><span className="text-green-600">Free</span></td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="precheck" className="mt-4">
                {isLoadingBilling ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading prechecks...</p>
                    </CardContent>
                  </Card>
                ) : !billingData?.calls || billingData.calls.filter((c: any) => c.type === 'AOI_PRECHECK').length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No PreCheck Transactions</h3>
                      <p className="text-muted-foreground">No precheck transactions found for this period.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                            <tr>
                              <th className="text-left p-4 font-semibold text-sm">Type</th>
                              <th className="text-left p-4 font-semibold text-sm">Name</th>
                              <th className="text-left p-4 font-semibold text-sm">Phone</th>
                              <th className="text-left p-4 font-semibold text-sm">Date</th>
                              <th className="text-right p-4 font-semibold text-sm">Credits</th>
                              <th className="text-right p-4 font-semibold text-sm">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billingData.calls
                              .filter((c: any) => c.type === 'AOI_PRECHECK')
                              .map((call: any) => (
                                <tr key={call.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="p-4">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                                        <Shield className="h-4 w-4 text-purple-600" />
                                      </div>
                                      <span className="font-medium text-sm">PreCheck</span>
                                    </div>
                                  </td>
                                  <td className="p-4 text-sm">{call.leadName || 'N/A'}</td>
                                  <td className="p-4 text-sm font-mono">{call.phone || 'N/A'}</td>
                                  <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{call.chargedAt || 'N/A'}</td>
                                  <td className="p-4 text-right">
                                    <span className="font-bold text-green-600">Free</span>
                                  </td>
                                  <td className="p-4 text-right text-sm font-semibold"><span className="text-green-600">Free</span></td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
        </TabsContent>

        <TabsContent value="credits" className="space-y-6">
          <CreditsManagementSection userEmail={currentUserEmail} />
        </TabsContent>
      </Tabs>

      {/* Stripe Checkout Modal */}
      <Dialog open={isCheckoutOpen} onOpenChange={handleCheckoutClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              Purchase Credits
            </DialogTitle>
          </DialogHeader>
          
          {clientSecret && selectedPackage && stripePromise && (
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret,
                appearance: {
                  theme: 'stripe'
                }
              }}
            >
              <CheckoutForm
                clientSecret={clientSecret}
                paymentIntentId={paymentIntentId}
                userEmail={user?.email}
                creditPackage={selectedPackage}
                onSuccess={handlePaymentSuccess}
                onBack={handleCheckoutClose}
              />
            </Elements>
          )}
          {clientSecret && selectedPackage && !stripePromise && (
            <div className="p-6 text-center">
              <p>Loading payment system...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}