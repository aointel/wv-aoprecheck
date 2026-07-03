import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
import { useQuery } from '@tanstack/react-query';

export default function Subscription() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Query for current usage data
  const { data: usage } = useQuery({
    queryKey: ['/api/usage/current']
  });

  // Query for transaction history
  const { data: transactions } = useQuery({
    queryKey: ['/api/transactions/history']
  });

  console.log('💳 Subscription page loaded');

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
          Call Connector Pro
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Professional outbound dialing with local presence and advanced analytics
        </p>
      </div>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usage">Current Usage</TabsTrigger>
          <TabsTrigger value="plans">Plans & Pricing</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
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
            
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Success Rate</p>
                    <p className="text-2xl font-bold">84%</p>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </div>
                  <MdTrendingUp className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Purchase AO Credits</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>25 credits</span>
                    <span className="font-bold">$15</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>50 credits</span>
                    <span className="font-bold">$25</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>100 credits</span>
                    <span className="font-bold">$45</span>
                  </div>
                </div>
                <Button className="w-full mt-4">
                  Purchase Credits
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-muted p-1 rounded-lg">
              <Button
                variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('monthly')}
                className="rounded-md"
              >
                Monthly
              </Button>
              <Button
                variant={billingCycle === 'annual' ? 'default' : 'ghost'}
                onClick={() => setBillingCycle('annual')}
                className="rounded-md"
              >
                Annual
                <Badge variant="secondary" className="ml-2 text-xs">
                  Save 20%
                </Badge>
              </Button>
            </div>
          </div>

          {/* Pricing Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            
            {/* Connects */}
            <Card className="relative overflow-hidden">
              <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MdPhone className="w-6 h-6 text-blue-600" />
                    <CardTitle className="text-xl">Connects</CardTitle>
                  </div>
                  <Badge variant="outline" className="border-blue-600 text-blue-600">
                    Per Connection
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  Successful connections from VDP calls
                </CardDescription>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold">$8</span>
                  <span className="text-lg text-muted-foreground">per connection</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Successful VDP call connections</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Real-time connection tracking</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Detailed call analytics</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Automatic billing per connection</span>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Learn More
                </Button>
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
                  <Badge variant="outline" className="border-green-600 text-green-600">
                    Per Call
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  Recruiting pipeline and prospect management
                </CardDescription>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold">$5</span>
                  <span className="text-lg text-muted-foreground">per call</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Recruit call automation</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Prospect list management</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Follow-up and onboarding flow</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Recruit call booking system</span>
                  </div>
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Learn More
                </Button>
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
                  <Badge variant="outline" className="border-purple-600 text-purple-600">
                    Per Check
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  Verification and pre-check services
                </CardDescription>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold">$3</span>
                  <span className="text-lg text-muted-foreground">per check</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Policy verification checks</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Review and approval process</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Submission management</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Escalation path tracking</span>
                  </div>
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  Learn More
                </Button>
              </CardContent>
            </Card>

            {/* Call Connector Pro */}
            <Card className="relative overflow-hidden border-2 border-primary scale-105 shadow-xl">
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white text-center py-2 text-sm font-medium">
                ⭐ MOST POPULAR
              </div>
              <CardHeader className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 pt-12">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MdDiamond className="w-6 h-6 text-primary" />
                    <CardTitle className="text-xl">Call Connector Pro</CardTitle>
                  </div>
                  <Badge className="bg-primary text-primary-foreground">
                    <MdStar className="w-3 h-3 mr-1" />
                    Best Value
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  Professional outbound dialing with local presence
                </CardDescription>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold">$64.99</span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Professional outbound dialing</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Local presence dialing (37 states)</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Advanced call analytics</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">HotLead assignment system</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Priority support</span>
                  </div>
                </div>
                <Button className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800">
                  Subscribe Now
                </Button>
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
                  <Badge variant="outline" className="border-amber-600 text-amber-600">
                    Monthly
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  Video meeting and collaboration platform
                </CardDescription>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold">$15.00</span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Video meeting platform</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Screen sharing capabilities</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Collaboration tools</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MdCheck className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Meeting scheduling</span>
                  </div>
                </div>
                <Button className="w-full bg-amber-600 hover:bg-amber-700">
                  Subscribe Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MdHistory className="mr-2 h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription>
                Complete history of purchases and usage charges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Mock transaction data - replace with real data from API */}
                {[
                  { id: 1, type: 'purchase', description: 'Call Minutes - 1,000 minutes', amount: '+1,000 min', cost: '$45.00', date: '2025-01-27', status: 'completed' },
                  { id: 2, type: 'usage', description: 'AO Recruit - Client Interview', amount: '-1 credit', cost: '$0.50', date: '2025-01-27', status: 'completed' },
                  { id: 3, type: 'usage', description: 'Call Connector Pro - Outbound Call', amount: '-12 min', cost: '$0.54', date: '2025-01-27', status: 'completed' },
                  { id: 4, type: 'purchase', description: 'AO Credits - 50 credits', amount: '+50 credits', cost: '$25.00', date: '2025-01-26', status: 'completed' },
                  { id: 5, type: 'usage', description: 'AO Precheck - Policy Verification', amount: '-1 credit', cost: '$0.50', date: '2025-01-26', status: 'completed' }
                ].map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${transaction.type === 'purchase' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">{transaction.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${transaction.type === 'purchase' ? 'text-green-600' : 'text-blue-600'}`}>
                        {transaction.amount}
                      </p>
                      <p className="text-sm text-muted-foreground">{transaction.cost}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}