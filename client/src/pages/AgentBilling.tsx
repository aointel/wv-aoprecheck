import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CreditCard,
  DollarSign,
  Phone,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Building2,
  Bell,
  Mail,
  RefreshCw,
  Activity,
  AlertTriangle,
  Users,
  Plus,
  Shield,
  Calendar,
  Filter
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCreditNotifications } from "@/components/credit-notifications";
import { Link } from "wouter";
import { CreditPurchaseModal } from "@/components/stripe/CreditPurchaseModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Placeholder crystal image
const crystalBlue1 = 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=100&h=100&fit=crop';

interface producerCreditInfo {
  agentId: string;
  agentName: string;
  currentBalance: number;
  mga: string | null;
  rga: string | null;
  agentEmail: string | null;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
}

interface CreditTransaction {
  id: number;
  transactionType: string;
  serviceType?: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string;
  phoneNumber?: string;
  clientName?: string;
  connectDuration?: number;
  market?: string;
  createdAt: string;
}

interface VDPConnect {
  id: number;
  agentId: string;
  agentName: string;
  phoneNumber: string;
  clientName: string;
  duration: number;
  market: string;
  connectDate: string;
  pickupTime: string;
}

// Time filter options
type TimeFilterOption = 'today' | 'last7days' | 'thismonth' | 'thisquarter';

interface TimeFilter {
  value: TimeFilterOption;
  label: string;
  getDateRange: () => { startDate: string; endDate: string };
}

const TIME_FILTERS: TimeFilter[] = [
  {
    value: 'last7days',
    label: 'Last 7 Days',
    getDateRange: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    }
  },
  {
    value: 'today',
    label: 'Today',
    getDateRange: () => {
      const today = new Date();
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
    }
  },
  {
    value: 'thismonth',
    label: 'This Month',
    getDateRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    }
  },
  {
    value: 'thisquarter',
    label: 'This Quarter',
    getDateRange: () => {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    }
  }
];

export default function producerBilling() {
  const { authState } = useAuth();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isCreditPurchaseOpen, setIsCreditPurchaseOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>('last7days');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { notifications } = useCreditNotifications();

  // Get current user's associate ID from auth context
  useEffect(() => {
    console.log('🔍 Auth state user:', authState.user);
    if (authState.user?.associateId) {
      console.log('✅ Setting Producer ID to:', authState.user.associateId);
      setAgentId(authState.user.associateId.toString());
    } else if (authState.user?.email) {
      // If no associateId, try to get it from the user profile
      console.log('⚠️ No associateId found, fetching from profile for:', authState.user.email);
      // For now, we'll let the API handle the lookup by email
      setAgentId('email:' + authState.user.email);
    }
  }, [authState.user]);

  // Get current time filter configuration
  const currentFilter = TIME_FILTERS.find(f => f.value === timeFilter) || TIME_FILTERS[0];
  const { startDate, endDate } = currentFilter.getDateRange();

  // Get producer billing dashboard data with time filter
  const { data: billingData, isLoading: isLoadingBilling, error: billingError } = useQuery({
    queryKey: ['/api/agent-billing', agentId, timeFilter, startDate, endDate],
    queryFn: () => {
      console.log('🔍 Fetching billing data for producer:', agentId);
      return apiRequest("GET", `/api/agent-billing/${agentId}?filter=${timeFilter}&startDate=${startDate}&endDate=${endDate}`).then(res => res.json());
    },
    enabled: !!agentId && agentId !== null,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
  });

  const creditInfo = billingData?.data?.creditInfo;
  const transactions = billingData?.data?.transactions || [];
  const vdpConnects = billingData?.data?.vdpConnects || [];
  const aoiBilling = billingData?.data?.aoiBilling;
  const aoiConnects = aoiBilling?.connects || [];
  const dashboardStats = billingData?.data?.dashboardStats;

  // Format currency
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get service type badge - matches navbar styling
  const getServiceTypeBadge = (serviceType?: string) => {
    if (!serviceType) return null;

    const configs = {
      // Main AOI Services
      'aoi_connect': { label: 'AOI Connect', variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-700 text-white' },
      'aoi_hotconnect': { label: 'HotConnect', variant: 'secondary' as const, className: 'bg-amber-600 hover:bg-amber-700 text-white' },
      'aoi_recruit': { label: 'AOI Recruit', variant: 'secondary' as const, className: 'bg-green-600 hover:bg-green-700 text-white' },
      'aoi_precheck': { label: 'AOI PreCheck', variant: 'secondary' as const, className: 'bg-purple-600 hover:bg-purple-700 text-white' },

      // Missed Call Variants
      'aoi_missed': { label: 'AOI Missed', variant: 'destructive' as const, className: 'bg-red-600 hover:bg-red-700 text-white' },
      'aoi_recruit_missed': { label: 'Recruit Missed', variant: 'destructive' as const, className: 'bg-orange-700 hover:bg-orange-800 text-white' },
    };

    const config = configs[serviceType as keyof typeof configs];
    if (!config) return null;

    return (
      <Badge variant={config.variant} className={`text-xs ${config.className}`}>
        {config.label}
      </Badge>
    );
  };

  if (!agentId || isLoadingBilling) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">
            {!agentId ? 'Getting user information...' : 'Loading billing data...'}
          </p>
        </div>
      </div>
    );
  }

  if (billingError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load billing data. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <img src={crystalBlue1} alt="Credits" className="w-6 h-6" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                  producer Billing Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Time Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={timeFilter} onValueChange={(value: TimeFilterOption) => setTimeFilter(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {filter.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                asChild
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Link href="/dashboard/billing-dashboard">
                  <Plus className="h-4 w-4 mr-2" />
                  Buy Credits
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        {/* Credit Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(creditInfo?.currentBalance || 0)}
              </div>
              {creditInfo?.isLowBalance && (
                <p className="text-xs text-destructive mt-1">
                  ⚠️ Low balance threshold reached
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(dashboardStats?.totalSpent || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg daily: {formatCurrency(dashboardStats?.avgDailySpend || 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connects Today</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {dashboardStats?.connectsToday || 0}
              </div>
              <div className="flex gap-1 mt-1">
                {dashboardStats?.serviceBreakdown && (
                  <>
                    <Badge variant="outline" className="text-xs">
                      Connect: {dashboardStats.serviceBreakdown.aoiConnect}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Recruit: {dashboardStats.serviceBreakdown.aoiRecruit}
                    </Badge>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AOI Service Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* AOI Connect */}
          <Card className="border-border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AOI Connect</CardTitle>
              <Phone className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{aoiBilling?.totalConnects || 0}</div>
              <p className="text-xs text-blue-600 mt-1">
                {formatCurrency(aoiBilling?.totalBilling || 0)} @ $8.00
              </p>
            </CardContent>
          </Card>

          {/* AOI HotConnect */}
          <Card className="border-border bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">HotConnect</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">0</div>
              <p className="text-xs text-amber-600 mt-1">
                $0.00 @ TBD rate
              </p>
            </CardContent>
          </Card>

          {/* AOI Recruit */}
          <Card className="border-border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AOI Recruit</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">0</div>
              <p className="text-xs text-green-600 mt-1">
                $0.00 @ $5.00
              </p>
            </CardContent>
          </Card>

          {/* AOI PreCheck */}
          <Card className="border-border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AOI PreCheck</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">0</div>
              <p className="text-xs text-purple-600 mt-1">
                $0.00 @ $4.00
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Missed Calls Summary - Single Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* AOI Missed */}
          <Card className="border-border bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AOI Missed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">{aoiBilling?.missedCallsCount || 0}</div>
              <p className="text-xs text-red-600 mt-1">
                ${formatCurrency(aoiBilling?.missedCallsBilling || 0)} @ $4.00
              </p>
            </CardContent>
          </Card>

          {/* Recruit Missed */}
          <Card className="border-border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recruit Missed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                {aoiBilling?.missedCalls?.filter(call => call.serviceType === 'aoi_recruit_missed').length || 0}
              </div>
              <p className="text-xs text-orange-600 mt-1">
                $0.00 @ $5.00
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <Tabs defaultValue="aoi-connects" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="aoi-connects" className="text-xs">AOI Connects</TabsTrigger>
            <TabsTrigger value="hotconnects" className="text-xs">HotConnects</TabsTrigger>
            <TabsTrigger value="recruits" className="text-xs">AOI Recruit</TabsTrigger>
            <TabsTrigger value="prechecks" className="text-xs">AOI PreCheck</TabsTrigger>
            <TabsTrigger value="missed-calls" className="text-xs">Missed Calls</TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="aoi-connects" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  AOI Connect History ({aoiConnects.length} connects - {formatCurrency(aoiBilling?.totalBilling || 0)})
                </CardTitle>
                <CardDescription>
                  Recent AOI connects with complete client information and billing details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aoiConnects.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No AOI connects found</p>
                  ) : (
                    aoiConnects.map((connect: any) => (
                      <div key={connect.id} className="p-4 border rounded-lg bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 hover:shadow-md transition-all duration-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Phone className="h-4 w-4 text-white" />
                              </div>
                              <Badge variant="outline" className="text-xs px-1 py-0 font-mono">
                                {connect.leadId}
                              </Badge>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-foreground truncate">{connect.clientName}</h3>
                                <Badge variant="secondary" className="text-xs">
                                  {connect.market}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span className="font-mono">{connect.durationHuman}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <span className="font-mono">{connect.clientPhone}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end gap-1">
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                              ${connect.billingAmount}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              <div>{connect.callDate}</div>
                              <div>{connect.callTime}</div>
                            </div>
                            {!connect.billed && (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                Unbilled
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HotConnects Tab */}
          <TabsContent value="hotconnects" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                  HotConnect Billing Records
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    Coming Soon
                  </Badge>
                </CardTitle>
                <CardDescription>
                  HotConnect calls from hotlead assignments - Awaiting Supabase connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="mx-auto h-12 w-12 text-amber-400 mb-4" />
                  <h3 className="text-lg font-semibold text-amber-700 mb-2">HotConnect Data Pending</h3>
                  <p className="text-amber-600 mb-4">Supabase integration will provide hotlead call data here.</p>
                  <div className="text-sm text-muted-foreground">
                    Expected fields: leadid, firstname, lastname, market, duration, producer
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AOI Recruit Tab */}
          <TabsContent value="recruits" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  AOI Recruit Billing Records
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Coming Soon
                  </Badge>
                </CardTitle>
                <CardDescription>
                  AOI Recruit service calls @ $5.00 each - Awaiting Supabase connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-green-400 mb-4" />
                  <h3 className="text-lg font-semibold text-green-700 mb-2">AOI Recruit Data Pending</h3>
                  <p className="text-green-600 mb-4">Supabase integration will provide recruit call data here.</p>
                  <div className="text-sm text-muted-foreground">
                    Expected fields: leadid, firstname, lastname, market, duration, producer
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AOI PreCheck Tab */}
          <TabsContent value="prechecks" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-600" />
                  AOI PreCheck Billing Records
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    Coming Soon
                  </Badge>
                </CardTitle>
                <CardDescription>
                  AOI PreCheck service calls @ $4.00 each - Awaiting Supabase connection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-purple-400 mb-4" />
                  <h3 className="text-lg font-semibold text-purple-700 mb-2">AOI PreCheck Data Pending</h3>
                  <p className="text-purple-600 mb-4">Supabase integration will provide precheck call data here.</p>
                  <div className="text-sm text-muted-foreground">
                    Expected fields: leadid, firstname, lastname, market, duration, producer
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Missed Calls Tab */}
          <TabsContent value="missed-calls" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Detailed Missed Call Records
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    All Services
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Individual missed call records with client details and billing information
                </CardDescription>
              </CardHeader>
              <CardContent>
                {aoiBilling?.missedCalls && aoiBilling.missedCalls.length > 0 ? (
                  <div className="space-y-3">
                    {aoiBilling.missedCalls.map((call: any, index: number) => (
                      <div key={index} className="border border-border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              Lead #{call.leadId || 'Unknown'}
                            </span>
                            {getServiceTypeBadge(call.serviceType)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {call.callDate} {call.callTime}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Client:</span>
                            <br />
                            <span className="text-foreground">{call.clientName || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Market:</span>
                            <br />
                            <span className="text-foreground">{call.market || 'Not specified'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Duration:</span>
                            <br />
                            <span className="text-foreground font-mono">{call.durationHuman || '0:00'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertTriangle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
                    <h3 className="text-lg font-semibold text-orange-700 mb-2">No Missed Calls Found</h3>
                    <p className="text-orange-600 mb-4">No missed call records found for this producer.</p>
                    <div className="text-sm text-muted-foreground">
                      Shows data from Supabase vdp_calls_missed table
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Transaction History
                </CardTitle>
                <CardDescription>
                  Recent credit transactions with service-specific billing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No transactions found</p>
                  ) : (
                    transactions.map((transaction: CreditTransaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${transaction.transactionType === 'usage' ? 'bg-red-500' : 'bg-green-500'}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{transaction.description}</p>
                              {getServiceTypeBadge(transaction.serviceType)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(transaction.createdAt)}
                              {transaction.clientName && ` • ${transaction.clientName}`}
                              {transaction.phoneNumber && ` • ${transaction.phoneNumber}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${transaction.transactionType === 'usage' ? 'text-red-600' : 'text-green-600'}`}>
                            {transaction.transactionType === 'usage' ? '' : '+'}{formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Balance: {formatCurrency(transaction.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connects" className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Legacy VDP Connect History
                </CardTitle>
                <CardDescription>
                  Historical VDP connects (legacy format)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vdpConnects.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No legacy VDP connects found</p>
                  ) : (
                    vdpConnects.map((connect: VDPConnect) => (
                      <div key={connect.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-blue-500" />
                          <div>
                            <p className="font-medium text-sm">{connect.clientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {connect.phoneNumber} • {connect.market} • {connect.duration}s
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatDate(connect.pickupTime)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={isCreditPurchaseOpen}
        onClose={() => setIsCreditPurchaseOpen(false)}
        userEmail={authState.user?.email}
        onCreditsAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/agent-billing', agentId] });
          toast({
            title: "Credits Added",
            description: "Your credits have been successfully added to your account.",
          });
        }}
      />
    </div>
  );
}