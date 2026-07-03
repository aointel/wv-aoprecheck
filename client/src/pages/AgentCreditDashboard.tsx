import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, TrendingDown, TrendingUp, Bell, RefreshCw, CreditCard, Phone, AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface CreditInfo {
  agentId: string;
  agentName: string;
  currentBalance: number;
  mga: string;
  rga: string;
  agentEmail: string;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
}

interface Transaction {
  id: number;
  transactionType: string;
  amount: string;
  description: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
  phoneNumber?: string;
  clientName?: string;
  connectDuration?: number;
  market?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  amount: number;
  timestamp: string;
  read: boolean;
  priority: string;
}

interface DashboardStats {
  totalSpent: number;
  totalEarned: number;
  connectsToday: number;
  avgDailySpend: string;
}

interface producerBillingData {
  creditInfo: CreditInfo;
  transactions: Transaction[];
  notifications: Notification[];
  dashboardStats: DashboardStats;
}

export default function producerCreditDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'transactions' | 'notifications'>('overview');
  
  // Get current user info - this would come from auth in a real app
  const agentId = '409'; // Chris's Producer ID for demo
  
  // Fetch producer billing dashboard data
  const { data: billingData, isLoading, refetch } = useQuery<{ success: boolean; data: producerBillingData }>({
    queryKey: ['/api/agent-billing', agentId],
    queryFn: async () => {
      const response = await fetch(`/api/agent-billing/${agentId}`);
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  useEffect(() => {
    // Show toast notifications for recent credit deductions
    if (billingData?.data?.notifications) {
      const recentNotifications = billingData.data.notifications
        .filter(n => !n.read && n.type === 'credit_deducted')
        .slice(0, 3); // Show max 3 recent notifications

      recentNotifications.forEach(notification => {
        if (new Date(notification.timestamp).getTime() > Date.now() - 5 * 60 * 1000) { // Last 5 minutes
          toast({
            title: notification.title,
            description: notification.message,
            variant: notification.priority === 'high' ? 'destructive' : 'default',
          });
        }
      });
    }
  }, [billingData, toast]);

  const creditInfo = billingData?.data?.creditInfo;
  const transactions = billingData?.data?.transactions || [];
  const notifications = billingData?.data?.notifications || [];
  const stats = billingData?.data?.dashboardStats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-muted-foreground">Loading your credit dashboard...</p>
        </div>
      </div>
    );
  }

  if (!creditInfo) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Credit Account Not Found</h3>
            <p className="text-muted-foreground">
              Your credit account is being initialized. Please try again in a moment.
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            producer Credit Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Real-time credit balance and AOI connect billing for {creditInfo.agentName}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => refetch()}
            variant="outline"
            className="flex items-center space-x-2"
            data-testid="button-refresh-credits"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </Button>
          {notifications.filter(n => !n.read).length > 0 && (
            <Button 
              onClick={() => setSelectedTab('notifications')}
              variant="outline"
              className="flex items-center space-x-2"
              data-testid="button-view-notifications"
            >
              <Bell className="h-4 w-4" />
              <span>{notifications.filter(n => !n.read).length} New</span>
            </Button>
          )}
        </div>
      </div>

      {/* Balance Alert */}
      {creditInfo.isLowBalance && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Low Balance Warning</span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Your credit balance (${creditInfo.currentBalance.toFixed(2)}) is below the threshold (${creditInfo.lowBalanceThreshold.toFixed(2)}). 
            Please add credits to continue making AOI connects.
          </p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className={`border-l-4 ${creditInfo.isLowBalance ? 'border-l-amber-500' : 'border-l-green-500'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${creditInfo.isLowBalance ? 'text-amber-600' : 'text-green-600'}`} data-testid="text-current-balance">
              ${creditInfo.currentBalance.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Threshold: ${creditInfo.lowBalanceThreshold.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <TrendingDown className="h-4 w-4 mr-2" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-spent">
              ${stats?.totalSpent?.toFixed(2) || '0.00'}
            </div>
            <div className="text-xs text-muted-foreground">All-time usage</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Phone className="h-4 w-4 mr-2" />
              Connects Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-connects-today">
              {stats?.connectsToday || 0}
            </div>
            <div className="text-xs text-muted-foreground">AOI connects</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Avg Daily Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600" data-testid="text-avg-daily-spend">
              ${stats?.avgDailySpend || '0.00'}
            </div>
            <div className="text-xs text-muted-foreground">Last 30 days</div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-4 mb-6">
        <Button 
          variant={selectedTab === 'overview' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('overview')}
          data-testid="tab-overview"
        >
          Overview
        </Button>
        <Button 
          variant={selectedTab === 'transactions' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('transactions')}
          data-testid="tab-transactions"
        >
          Transactions ({transactions.length})
        </Button>
        <Button 
          variant={selectedTab === 'notifications' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('notifications')}
          data-testid="tab-notifications"
        >
          Notifications
          {notifications.filter(n => !n.read).length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {notifications.filter(n => !n.read).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>producer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Producer ID</label>
                  <p className="font-medium">{creditInfo.agentId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Producer Name</label>
                  <p className="font-medium">{creditInfo.agentName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">MGA</label>
                  <p className="font-medium">{creditInfo.mga}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">RGA</label>
                  <p className="font-medium">{creditInfo.rga}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Last 5 transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center space-x-3">
                    {transaction.transactionType === 'usage' ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${transaction.transactionType === 'usage' ? 'text-red-600' : 'text-green-600'}`}>
                      {transaction.transactionType === 'usage' ? '-' : '+'}${Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance: ${parseFloat(transaction.balanceAfter).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Complete history of all credit transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 border rounded-lg" data-testid={`transaction-${transaction.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {transaction.transactionType === 'usage' ? (
                        <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        {transaction.phoneNumber && (
                          <p className="text-sm text-muted-foreground">
                            📞 {transaction.phoneNumber} • {transaction.clientName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transaction.createdAt), 'MMMM dd, yyyy at HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${transaction.transactionType === 'usage' ? 'text-red-600' : 'text-green-600'}`}>
                        {transaction.transactionType === 'usage' ? '-' : '+'}${Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${parseFloat(transaction.balanceBefore).toFixed(2)} → ${parseFloat(transaction.balanceAfter).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              
              {transactions.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Transactions Yet</h3>
                  <p className="text-muted-foreground">
                    Your transaction history will appear here once you start making AOI connects.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Credit alerts and transaction notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 border rounded-lg ${!notification.read ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${notification.type === 'credit_deducted' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                        {notification.type === 'credit_deducted' ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(notification.timestamp), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!notification.read && (
                        <Badge variant="secondary">New</Badge>
                      )}
                      <Badge variant={notification.priority === 'high' ? 'destructive' : 'secondary'}>
                        {notification.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
              
              {notifications.length === 0 && (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
                  <p className="text-muted-foreground">
                    You'll see credit alerts and transaction notifications here.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}