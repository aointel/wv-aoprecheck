import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PhoneOff, Phone, DollarSign, Clock, User, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, Target, Users, Shield, Calendar, FileText, Download, Printer, Building2, Wallet, Plus, UserCheck, Receipt, History } from 'lucide-react';
import { MdSwapHoriz, MdPeople, MdVerifiedUser, MdPhone, MdCheck, MdDiamond, MdStar } from 'react-icons/md';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Search, Check, ChevronsUpDown } from 'lucide-react';

// Manager Billing Service Configs
const SERVICE_CONFIGS = {
  connect: { name: 'AO Connect', icon: Phone, price: 8.00, color: 'blue' },
  recruit: { name: 'AO Recruit', icon: Users, price: 5.00, color: 'green' },
  precheck: { name: 'AO PreCheck', icon: Shield, price: 4.00, color: 'purple' },
  hotconnect: { name: 'HotConnect', icon: Target, price: 2.00, color: 'amber' }
};

interface TeamAgent {
  associate_id: number;
  agent_name: string;
  company_email: string;
  mga: string;
  rga: string;
}

interface ManagerAllocation {
  id: number;
  allocation_id: string;
  agent_email: string;
  agent_name: string;
  service_type: string;
  allocation_type: string;
  credits_allocated: number;
  credits_used: number;
  credits_remaining: number;
  total_amount_allocated: number;
  total_amount_used: number;
  status: string;
  start_date: string;
}

interface ManagerTransaction {
  id: number;
  transaction_id: string;
  agent_email: string;
  agent_name: string;
  service_type: string;
  amount_charged: number;
  lead_name?: string;
  lead_phone?: string;
  transaction_date: string;
  status: string;
}

interface DateRange {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

interface BillingCall {
  id: string;
  type: 'AOI_MISSED' | 'AOI_CONNECT' | 'HOTLEAD_CONNECT' | 'AOI_RECRUIT' | 'AOI_PRECHECK' | 'RECRUIT_MISSED';
  phone: string;
  leadName: string;
  agentId: string;
  agentName: string;
  billingAmount: number;
  callAttempts: Array<{
    cycle: number;
    timestamp: string;
    event: string;
    duration: string;
  }>;
  finalStatus: 'MISSED' | 'CONNECTED' | 'ASSIGNED';
  chargedAt: string;
  icon: string;
  color: string;
}

interface BillingCallCardProps {
  call: BillingCall;
}

function BillingCallCard({ call }: BillingCallCardProps) {
  const getServiceConfig = (type: string) => {
    switch (type) {
      case 'AOI_MISSED':
        return { 
          icon: '', 
          title: 'Missed Call', 
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-l-orange-500',
          iconBg: 'bg-orange-100 dark:bg-orange-900/30',
          textColor: 'text-orange-600'
        };
      case 'AOI_CONNECT':
        return { 
          icon: '', 
          title: 'Connect', 
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-l-blue-500',
          iconBg: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-600'
        };
      case 'HOTLEAD_CONNECT':
        return { 
          icon: '', 
          title: 'HotConnect', 
          bg: 'bg-amber-50 dark:bg-amber-900/20',
          borderColor: 'border-l-amber-500',
          iconBg: 'bg-amber-100 dark:bg-amber-900/30',
          textColor: 'text-amber-600'
        };
      case 'AOI_RECRUIT':
        return { 
          icon: '', 
          title: 'Recruit', 
          bg: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-l-green-500',
          iconBg: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-600'
        };
      case 'AOI_PRECHECK':
        return { 
          icon: '', 
          title: 'PreCheck', 
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          borderColor: 'border-l-purple-500',
          iconBg: 'bg-purple-100 dark:bg-purple-900/30',
          textColor: 'text-purple-600'
        };
      case 'RECRUIT_MISSED':
        return { 
          icon: '', 
          title: 'Recruit Missed', 
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-l-orange-500',
          iconBg: 'bg-orange-100 dark:bg-orange-900/30',
          textColor: 'text-orange-600'
        };
      default:
        return { 
          icon: '', 
          title: 'Unknown', 
          bg: 'bg-gray-50 dark:bg-gray-900/20',
          borderColor: 'border-l-gray-500',
          iconBg: 'bg-gray-100 dark:bg-gray-900/30',
          textColor: 'text-gray-600'
        };
    }
  };

  const config = getServiceConfig(call.type);
  
  return (
    <Card className={`mb-3 border-l-4 ${config.borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className={`p-2 rounded-full ${config.iconBg}`}>
              <span className="text-lg">{config.icon}</span>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Name</div>
                <div className="font-medium" data-testid={`text-lead-name-${call.phone}`}>
                  {call.leadName}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Phone</div>
                <div className="font-medium" data-testid={`text-call-phone-${call.phone}`}>
                  {call.phone}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Transaction Date</div>
                <div className="font-medium" data-testid={`text-charged-date-${call.phone}`}>
                  {call.chargedAt}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Credits Deducted</div>
                <div className={`font-bold text-lg ${config.textColor}`} data-testid={`text-credits-deducted-${call.phone}`}>
                  {call.type === 'AOI_PRECHECK' ? 'Free' : (call.creditsDeducted ?? call.billingAmount / 4)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingDashboard() {
  const { toast } = useToast();
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDateRange, setSelectedDateRange] = useState<string>('last7days');
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [mainTab, setMainTab] = useState<'individual' | 'team'>('individual');
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'billing' | 'subscription' | 'manager-billing'>('overview');
  
  // Manager Billing State
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [allocationAmount, setAllocationAmount] = useState<string>('100');
  const [allocationNotes, setAllocationNotes] = useState<string>('');
  const [allocationType, setAllocationType] = useState<'credits' | 'unlimited'>('credits');
  const [agentSearchOpen, setAgentSearchOpen] = useState(false);
  const [agentSearchTerm, setAgentSearchTerm] = useState('');
  
  // Resolve current user email across auth + legacy storage keys - get it IMMEDIATELY from localStorage
  const currentUserEmail = useMemo(() => {
    // First, try to get from localStorage immediately (synchronous, no waiting)
    let storedEmail = '';
    if (typeof window !== 'undefined') {
      const storedProducerRaw = localStorage.getItem('current_producer');
      const legacyUserEmail = localStorage.getItem('userEmail');
      if (storedProducerRaw) {
        try {
          storedEmail = JSON.parse(storedProducerRaw)?.email ?? '';
        } catch {
          storedEmail = '';
        }
      }
      storedEmail = storedEmail || legacyUserEmail || '';
    }

    // Then try auth (might be null initially, but that's ok)
    const authEmail = authState?.user?.email || authState?.profile?.email;

    return (storedEmail || authEmail || '').toLowerCase();
  }, [authState?.user?.email, authState?.profile?.email]);
  
  // Email is available immediately from localStorage
  const hasEmail = Boolean(currentUserEmail);

  const { data: userTeamInfo } = useQuery<{
    role: 'MGA' | 'RGA' | 'BOTH' | null;
    mgaAssociateId: number | null;
    managedMGAs: Array<{ associate_id: number; name: string }>;
  }>({
    queryKey: ['/api/live-call-board/user-team-info', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return { role: null, mgaAssociateId: null, managedMGAs: [] };
      const response = await fetch(`/api/live-call-board/user-team-info?email=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return { role: null, mgaAssociateId: null, managedMGAs: [] };
      return response.json();
    },
    staleTime: 60000,
    enabled: hasEmail,
  });

  const isMgaOrRga = userTeamInfo?.role === 'MGA' || userTeamInfo?.role === 'RGA' || userTeamInfo?.role === 'BOTH';
  
  const dateRanges: DateRange[] = [
    { label: 'Last 7 Days', value: 'last7days', startDate: subDays(new Date(), 7), endDate: new Date() },
    { label: 'Last 30 Days', value: 'last30days', startDate: subDays(new Date(), 30), endDate: new Date() },
    { label: 'This Week', value: 'thisweek', startDate: startOfWeek(new Date()), endDate: endOfWeek(new Date()) },
    { label: 'This Month', value: 'thismonth', startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()) },
    { label: 'Last Month', value: 'lastmonth', startDate: startOfMonth(subDays(new Date(), 30)), endDate: endOfMonth(subDays(new Date(), 30)) }
  ];
  
  const currentDateRange = dateRanges.find(range => range.value === selectedDateRange) || dateRanges[0];
  
  // Fetch INDIVIDUAL billing data - ALWAYS RUN ON MOUNT, don't wait for anything
  const { data: billingData = {}, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/billing/all-charges', selectedDateRange, currentUserEmail],
    queryFn: async () => {
      const emailToUse = currentUserEmail || (typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || JSON.parse(localStorage.getItem('current_producer') || '{}')?.email || '') : '');
      
      if (!emailToUse) {
        console.error('❌ BillingDashboard: No user email available');
        throw new Error('No user email available');
      }
      console.log('🔍 BillingDashboard: Fetching billing data for:', emailToUse, 'Range:', selectedDateRange);
      const response = await fetch(`/api/billing/all-charges/${selectedDateRange}?userEmail=${encodeURIComponent(emailToUse)}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ BillingDashboard: API error:', response.status, errorText);
        throw new Error(`Failed to fetch billing data: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log('✅ BillingDashboard: Data received:', data);
      return data;
    },
    staleTime: 0,
    refetchInterval: 30000, // Refetch every 30 seconds to get new transactions
    refetchOnMount: 'always',
    refetchOnWindowFocus: true, // Refetch when user comes back to tab
    enabled: mainTab === 'individual', // Always enabled for individual tab, queryFn will get email from localStorage if needed
    retry: 3,
    retryDelay: 1000,
  });

  // Refetch when date range changes
  useEffect(() => {
    if (mainTab === 'individual') {
      console.log('🔄 BillingDashboard: Date range changed, refetching...');
      refetch();
    }
  }, [selectedDateRange, mainTab, refetch]);

  // Fetch TEAM billing data (for MGAs/RGAs) - run immediately when email is available
  const { data: teamBillingData = {}, isLoading: isLoadingTeam, refetch: refetchTeam } = useQuery({
    queryKey: ['/api/billing/team-charges', selectedDateRange, currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) throw new Error('No user email available');
      const response = await fetch(`/api/billing/team-charges/${selectedDateRange}?userEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch team billing data: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 0,
    refetchInterval: 30000, // Refetch every 30 seconds to get new transactions
    refetchOnMount: 'always',
    refetchOnWindowFocus: true, // Refetch when user comes back to tab
    enabled: mainTab === 'team' && isMgaOrRga && hasEmail,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Refetch team data when date range changes
  useEffect(() => {
    if (mainTab === 'team' && isMgaOrRga) {
      console.log('🔄 BillingDashboard: Date range changed, refetching team data...');
      refetchTeam();
    }
  }, [selectedDateRange, mainTab, isMgaOrRga, refetchTeam]);

  // Fetch subscription status for Call Connector Pro
  const { data: subscriptionStatus, isLoading: isLoadingSubscription, refetch: refetchSubscription } = useQuery({
    queryKey: ['/api/billing/subscription/status', currentUserEmail],
    queryFn: async () => {
      const emailToUse = currentUserEmail || (typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || JSON.parse(localStorage.getItem('current_producer') || '{}')?.email || '') : '');
      if (!emailToUse) return null;
      const response = await fetch(`/api/billing/subscription/status?userEmail=${encodeURIComponent(emailToUse)}`);
      if (!response.ok) return null;
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
    enabled: hasEmail,
  });

  const subscription = subscriptionStatus?.subscription;
  const hasActiveSubscription = subscription?.hasActiveSubscription && (subscription?.plan === 'professional' || subscription?.plan === 'elite');

  // ============ MANAGER BILLING QUERIES (for MGA/RGA) ============
  
  // Check if user is a manager
  const { data: managerInfo } = useQuery({
    queryKey: ['/api/manager-billing/manager-info', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/manager-billing/manager-info?email=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: hasEmail
  });

  const isManager = managerInfo?.isManager || false;
  const isCnsysop = currentUserEmail === 'cnsysop@aoglobelife.com';
  const canAccessManagerBilling = isManager || isCnsysop;

  // Get team agents for manager
  // Fetch ALL customers for search/allocation dropdown
  const { data: allCustomersForSearch = [], isLoading: isLoadingAllCustomers, error: allCustomersError } = useQuery<TeamAgent[]>({
    queryKey: ['/api/manager-billing/team-agents', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) {
        console.log('⚠️ No current user email, skipping all customers fetch');
        return [];
      }
      console.log(`🔍 Fetching all customers for search/allocation: ${currentUserEmail}`);
      const response = await fetch(`/api/manager-billing/team-agents?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to fetch all customers: ${response.status} ${errorText}`);
        return [];
      }
      const data = await response.json();
      console.log(`✅ Received ${data.agents?.length || 0} customers from API`);
      return data.agents || [];
    },
    enabled: hasEmail && canAccessManagerBilling,
    retry: 2
  });

  // Fetch actual team members (filtered by MGA/RGA hierarchy and billing transactions)
  const { data: teamAgents = [], isLoading: isLoadingTeamAgents, error: teamAgentsError } = useQuery<TeamAgent[]>({
    queryKey: ['/api/manager-billing/actual-team-agents', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) {
        console.log('⚠️ No current user email, skipping actual team agents fetch');
        return [];
      }
      console.log(`🔍 Fetching actual team members for: ${currentUserEmail}`);
      const response = await fetch(`/api/manager-billing/actual-team-agents?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to fetch actual team agents: ${response.status} ${errorText}`);
        return [];
      }
      const data = await response.json();
      console.log(`✅ Received ${data.agents?.length || 0} actual team members from API`);
      return data.agents || [];
    },
    enabled: hasEmail && canAccessManagerBilling,
    retry: 2
  });

  // Get manager's allocations
  const { data: managerAllocations = [], isLoading: isLoadingManagerAllocations, refetch: refetchManagerAllocations } = useQuery<ManagerAllocation[]>({
    queryKey: ['/api/manager-billing/allocations', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return [];
      const response = await fetch(`/api/manager-billing/allocations?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.allocations || [];
    },
    enabled: hasEmail && canAccessManagerBilling
  });

  // Get manager's transactions
  const { data: managerTransactions = [], isLoading: isLoadingManagerTransactions, refetch: refetchManagerTransactions } = useQuery<ManagerTransaction[]>({
    queryKey: ['/api/manager-billing/transactions', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return [];
      const response = await fetch(`/api/manager-billing/transactions?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.transactions || [];
    },
    enabled: hasEmail && canAccessManagerBilling
  });

  // Get manager's balance
  const { data: managerBalance, refetch: refetchManagerBalance } = useQuery({
    queryKey: ['/api/manager-billing/balance', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/manager-billing/balance?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: hasEmail && canAccessManagerBilling
  });

  // Create allocation mutation
  const createAllocationMutation = useMutation({
    mutationFn: async (data: { agentEmail: string; serviceType: string; allocationType: string; creditsAmount: number; notes: string }) => {
      const response = await fetch('/api/manager-billing/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerEmail: currentUserEmail, ...data })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create allocation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Allocation Created', description: 'Successfully allocated billing to agent.' });
      setIsAllocationDialogOpen(false);
      setSelectedAgent('');
      setSelectedService('');
      setAllocationAmount('100');
      setAllocationNotes('');
      refetchManagerAllocations();
      refetchManagerBalance();
    },
    onError: (error: Error) => {
      toast({ title: 'Allocation Failed', description: error.message, variant: 'destructive' });
    }
  });

  const handleCreateAllocation = () => {
    if (!selectedAgent || !selectedService || !allocationAmount) {
      toast({ title: 'Missing Information', description: 'Please select an agent, service type, and allocation amount.', variant: 'destructive' });
      return;
    }
    createAllocationMutation.mutate({
      agentEmail: selectedAgent,
      serviceType: selectedService,
      allocationType,
      creditsAmount: parseInt(allocationAmount),
      notes: allocationNotes
    });
  };

  // Manager billing summary stats
  const managerSummaryStats = useMemo(() => {
    const activeAllocations = managerAllocations.filter(a => a.status === 'active');
    return {
      activeAllocations: activeAllocations.length,
      totalAllocated: activeAllocations.reduce((sum, a) => sum + (a.total_amount_allocated || 0), 0),
      totalUsed: activeAllocations.reduce((sum, a) => sum + (a.total_amount_used || 0), 0),
      totalCreditsAllocated: activeAllocations.reduce((sum, a) => sum + (a.credits_allocated || 0), 0),
      totalCreditsUsed: activeAllocations.reduce((sum, a) => sum + (a.credits_used || 0), 0),
      agentsCovered: new Set(activeAllocations.map(a => a.agent_email)).size
    };
  }, [managerAllocations]);
  
  const generateInvoice = async () => {
    setIsGeneratingInvoice(true);
    try {
      const response = await fetch('/api/billing/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: selectedDateRange,
          agentEmail: currentUserEmail,
          calls: billingData?.calls || []
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `billing-invoice-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Invoice Generated",
          description: "Your billing invoice has been downloaded."
        });
      } else {
        throw new Error('Failed to generate invoice');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };
  
  const printInvoice = () => {
    window.print();
  };

  // Use the correct data source based on main tab
  const currentData = mainTab === 'individual' ? billingData : teamBillingData;
  const currentIsLoading = mainTab === 'individual' ? isLoading : isLoadingTeam;
  const currentIsError = mainTab === 'individual' ? isError : false;
  const currentError = mainTab === 'individual' ? error : null;

  // Parse API response structure
  const apiCalls = currentData?.calls || [];
  const missedCalls = apiCalls.filter((call: BillingCall) => call.type === 'AOI_MISSED');
  const aoiConnectCalls = apiCalls.filter((call: BillingCall) => call.type === 'AOI_CONNECT');
  const hotleadCalls = apiCalls.filter((call: BillingCall) => call.type === 'HOTLEAD_CONNECT');
  const aoiRecruitCalls = apiCalls.filter((call: BillingCall) => call.type === 'AOI_RECRUIT');
  const aoiPrecheckCalls = apiCalls.filter((call: BillingCall) => call.type === 'AOI_PRECHECK');
  const recruitMissedCalls = apiCalls.filter((call: BillingCall) => call.type === 'RECRUIT_MISSED');
  
  const summary = {
    totalCharges: currentData?.totalCalls || 0,
    totalAmount: currentData?.totalCharges || 0,
    totalCreditsUsed: currentData?.totalCreditsUsed || 0,
    totalCreditsEarned: currentData?.totalCreditsEarned || 0
  };

  // Combine all calls for "All Charges" view (include missed calls)
  const allCalls = [...aoiConnectCalls, ...aoiRecruitCalls, ...aoiPrecheckCalls, ...missedCalls];

  if (!hasEmail) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-muted-foreground">Loading user information...</p>
        </div>
      </div>
    );
  }

  if (currentIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-muted-foreground">Loading billing data from all systems...</p>
        </div>
      </div>
    );
  }

  if (currentIsError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <XCircle className="h-8 w-8 mx-auto text-red-600" />
          <p className="text-red-600 font-semibold">Failed to load billing data</p>
          <p className="text-muted-foreground text-sm">{currentError?.message || 'Unknown error'}</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            Billing Center
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Track your real-time billing charges from all call services with detailed breakdowns
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger className="w-[180px]" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRanges.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <Button 
            onClick={generateInvoice}
            variant="outline" 
            size="sm"
            className="flex items-center space-x-2"
            disabled={isGeneratingInvoice || !billingData?.totalCalls}
            data-testid="button-generate-invoice"
          >
            <Download className="h-4 w-4" />
            <span>{isGeneratingInvoice ? 'Generating...' : 'Download Invoice'}</span>
          </Button>
          <Button 
            onClick={printInvoice}
            variant="outline" 
            size="sm"
            className="flex items-center space-x-2"
            disabled={!billingData?.totalCalls}
            data-testid="button-print-invoice"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'overview' | 'billing' | 'subscription' | 'manager-billing')} className="w-full mb-6">
        <TabsList className={`grid w-full ${canAccessManagerBilling ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Billing Details
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <MdDiamond className="h-4 w-4" />
            Subscription
          </TabsTrigger>
          {canAccessManagerBilling && (
            <TabsTrigger value="manager-billing" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Manager Billing
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Summary Stats */}
          <div>
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Remaining Credits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-remaining-credits">
                  {(currentData?.remainingCredits !== undefined) ? currentData.remainingCredits : 'N/A'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pricing Cards Section */}
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Service Pricing</h2>
              <p className="text-muted-foreground">Pay-per-use services and monthly subscriptions</p>
            </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <div className="mt-2">
                <span className="text-lg font-semibold text-muted-foreground">No Cost.. price TBA</span>
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
              <div className="mt-2">
                <span className="text-lg font-semibold text-muted-foreground">No Cost.. price TBA</span>
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
                <Badge className="bg-primary text-primary-foreground">
                  <MdStar className="w-3 h-3 mr-1" />
                  Best Value
                </Badge>
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
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        {/* Billing Details Tab */}
        <TabsContent value="billing" className="space-y-6 mt-6">
          {/* Main Tab Selector - Individual vs Team Billing */}
          {isMgaOrRga && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-700">View:</span>
                  <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'individual' | 'team')} className="w-auto">
                    <TabsList>
                      <TabsTrigger value="individual" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        My Billing
                      </TabsTrigger>
                      <TabsTrigger value="team" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Team Billing
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Refresh Button */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {mainTab === 'individual' ? 'My Billing Details by Service' : 'Team Billing Details by Service'}
            </h2>
            <Button 
              onClick={() => mainTab === 'individual' ? refetch() : refetchTeam()}
              variant="outline"
              className="gap-2"
              data-testid="button-refresh-billing"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh All Data
            </Button>
          </div>

          {/* Date Range Display */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Date Range</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Showing billing data from <strong>{format(currentDateRange.startDate, 'MMM dd, yyyy')}</strong> to <strong>{format(currentDateRange.endDate, 'MMM dd, yyyy')}</strong>
            </p>
          </div>

          {/* Service Tabs */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All Charges ({allCalls.length})</TabsTrigger>
              <TabsTrigger value="aoi-connect" className="flex items-center gap-2">
                <MdSwapHoriz className="h-4 w-4" />
                Connect
              </TabsTrigger>
              <TabsTrigger value="recruit" className="flex items-center gap-2">
                <MdPeople className="h-4 w-4" />
                Recruit
              </TabsTrigger>
              <TabsTrigger value="precheck" className="flex items-center gap-2">
                <MdVerifiedUser className="h-4 w-4" />
                PreCheck
              </TabsTrigger>
              <TabsTrigger value="missed" className="flex items-center gap-2">
                <PhoneOff className="h-4 w-4" />
                Missed ({missedCalls.length})
              </TabsTrigger>
            </TabsList>

        <TabsContent value="all" className="space-y-4 mt-6">
          {allCalls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Billing Charges</h3>
                <p className="text-muted-foreground">
                  No billable calls found in the last 7 days across all services.
                </p>
              </CardContent>
            </Card>
          ) : (
            allCalls.map((call: BillingCall) => (
              <BillingCallCard key={call.id} call={call} />
            ))
          )}
        </TabsContent>

        <TabsContent value="aoi-connect" className="space-y-4 mt-6">
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">📱 Connect - $8.00</h3>
          </div>
          {aoiConnectCalls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <XCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Connects</h3>
                <p className="text-muted-foreground">No successful connections in the selected time period.</p>
              </CardContent>
            </Card>
          ) : (
            aoiConnectCalls.map((call: BillingCall) => (
              <BillingCallCard key={call.id} call={call} />
            ))
          )}
        </TabsContent>

        <TabsContent value="hotlead" className="space-y-4 mt-6">
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-2">🎯 HotLead Connects - $2.00</h3>
          </div>
          {hotleadCalls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 text-amber-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No HotLead Assignments</h3>
                <p className="text-muted-foreground">No hotleads assigned in the last 7 days.</p>
              </CardContent>
            </Card>
          ) : (
            hotleadCalls.map((call: BillingCall) => (
              <BillingCallCard key={call.id} call={call} />
            ))
          )}
        </TabsContent>

        <TabsContent value="recruit" className="space-y-4 mt-6">
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">👥 Recruit - $5.00</h3>
          </div>
          {aoiRecruitCalls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Recruit Calls</h3>
                <p className="text-muted-foreground">No recruitment calls in the selected time period.</p>
              </CardContent>
            </Card>
          ) : (
            aoiRecruitCalls.map((call: BillingCall) => (
              <BillingCallCard key={call.id} call={call} />
            ))
          )}
        </TabsContent>

        <TabsContent value="precheck" className="space-y-4 mt-6">
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">🛡️ PreCheck - $4.00</h3>
          </div>
          {aoiPrecheckCalls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No PreCheck Calls</h3>
                <p className="text-muted-foreground">No precheck calls in the selected time period.</p>
              </CardContent>
            </Card>
          ) : (
            aoiPrecheckCalls.map((call: BillingCall) => (
              <BillingCallCard key={call.id} call={call} />
            ))
          )}
        </TabsContent>

        <TabsContent value="missed" className="space-y-4 mt-6">
          <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <h3 className="font-semibold text-orange-700 dark:text-orange-300 mb-2">📞 Missed Calls - $4.00</h3>
          </div>
          {missedCalls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <PhoneOff className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Missed Calls</h3>
                <p className="text-muted-foreground">No missed calls in the selected time period.</p>
              </CardContent>
            </Card>
          ) : (
            missedCalls.map((call: BillingCall) => (
              <BillingCallCard key={call.id} call={call} />
            ))
          )}
        </TabsContent>

        <TabsContent value="recruit-missed" className="space-y-4 mt-6">
          <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <h3 className="font-semibold text-orange-700 dark:text-orange-300 mb-2">❌ Recruit Missed - $4.00 - 1 Credit per miss</h3>
          </div>
          {recruitMissedCalls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <XCircle className="h-12 w-12 text-orange-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Recruit Missed</h3>
                <p className="text-muted-foreground">No missed recruitment calls in the selected time period.</p>
              </CardContent>
            </Card>
          ) : (
            recruitMissedCalls.map((call: BillingCall) => (
              <BillingCallCard key={call.id} call={call} />
            ))
          )}
        </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6 mt-6">
          {/* Call Connector Pro Subscription Management - Always Visible */}
          <Card className="border-2 border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MdDiamond className="w-8 h-8 text-primary" />
                  <div>
                    <CardTitle className="text-2xl">Call Connector Pro Subscription</CardTitle>
                    <CardDescription className="text-base mt-1">
                      {hasActiveSubscription ? 'Manage your Call Connector Pro subscription' : 'Subscribe to Call Connector Pro for professional outbound dialing'}
                    </CardDescription>
                  </div>
                </div>
                {hasActiveSubscription && (
                  <Badge className="bg-green-600 text-white text-sm px-3 py-1">
                    Active
                  </Badge>
                )}
                {!hasActiveSubscription && !isLoadingSubscription && (
                  <Badge className="bg-gray-500 text-white text-sm px-3 py-1">
                    Not Subscribed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingSubscription ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">Loading subscription status...</p>
                </div>
              ) : hasActiveSubscription ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Plan</div>
                      <div className="text-lg font-semibold capitalize">
                        {subscription?.plan || 'Professional'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Status</div>
                      <div className="text-lg font-semibold capitalize">
                        {subscription?.status || 'Active'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Next Billing Date</div>
                      <div className="text-lg font-semibold">
                        {subscription?.currentPeriodEnd 
                          ? format(new Date(subscription.currentPeriodEnd * 1000), 'MMM dd, yyyy')
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Manage your subscription, payment methods, and billing history through Stripe.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            const emailToUse = currentUserEmail || (typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || JSON.parse(localStorage.getItem('current_producer') || '{}')?.email || '') : '');
                            const response = await fetch('/api/billing/subscription/billing-portal', {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'x-user-email': emailToUse
                              },
                              body: JSON.stringify({ 
                                userEmail: emailToUse,
                                returnUrl: `${window.location.origin}/dashboard/billing-dashboard?tab=subscription`
                              })
                            });
                            
                            const data = await response.json();
                            
                            if (data.success && data.url) {
                              window.location.href = data.url;
                            } else {
                              throw new Error(data.error || 'Failed to open billing portal');
                            }
                          } catch (error) {
                            console.error('Billing portal error:', error);
                            toast({
                              title: "Error",
                              description: error instanceof Error ? error.message : "Failed to open billing portal. Please try again.",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        Manage Billing & Subscriptions
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Get professional outbound dialing with local presence in every state. Start your subscription today!
                  </p>
                  <p className="text-xs text-muted-foreground italic">
                    Note: Call Connector Pro sign ups are only available for Globe Market agents.
                  </p>
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
                        const response = await fetch('/api/billing/subscription/checkout-session', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            userEmail: currentUserEmail,
                            plan: 'professional',
                            successUrl: `${window.location.origin}/dashboard/billing-dashboard?tab=subscription&status=success`,
                            cancelUrl: `${window.location.origin}/dashboard/billing-dashboard?tab=subscription&status=cancelled`,
                          }),
                        });

                        const data = await response.json();

                        if (data.success && data.url) {
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
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    size="lg"
                  >
                    <MdDiamond className="w-5 h-5 mr-2" />
                    Subscribe to Call Connector Pro
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manager Billing Tab - Only for MGA/RGA or cnsysop */}
        {canAccessManagerBilling && (
          <TabsContent value="manager-billing" className="space-y-6 mt-6">
            {/* Manager Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-indigo-600 flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Your Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                    {managerBalance?.credits_balance || 0} Credits
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${(managerBalance?.dollar_balance || 0).toFixed(2)} available
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Active Allocations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {managerSummaryStats.activeAllocations}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Covering {managerSummaryStats.agentsCovered} agents
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Total Allocated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {managerSummaryStats.totalCreditsAllocated} Credits
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ≈ ${managerSummaryStats.totalAllocated.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Total Used
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {managerSummaryStats.totalCreditsUsed} Credits
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ${managerSummaryStats.totalUsed.toFixed(2)} billed
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Pay for Agent Calls</h2>
                <p className="text-muted-foreground text-sm">Allocate billing to your team members - charges bill to your MGA/RGA account</p>
              </div>
              <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Allocation
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-indigo-600" />
                      Create Billing Allocation
                    </DialogTitle>
                    <DialogDescription>
                      Allocate credits for any customer's call services. Search all customers below. Charges will be billed to your account.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6 py-4">
                    {/* Agent Selection - Searchable */}
                    <div className="space-y-2">
                      <Label htmlFor="agent">Select Agent</Label>
                      <Popover open={agentSearchOpen} onOpenChange={setAgentSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={agentSearchOpen}
                            className="w-full justify-between"
                          >
                            {selectedAgent
                              ? allCustomersForSearch.find((agent) => agent.company_email === selectedAgent)?.agent_name || 'Select agent...'
                              : 'Search all customers...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput 
                              placeholder="Search all customers by name or email..." 
                              value={agentSearchTerm}
                              onValueChange={setAgentSearchTerm}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {isLoadingAllCustomers
                                  ? 'Loading customers...' 
                                  : allCustomersError 
                                    ? 'Error loading customers. Please refresh.'
                                    : allCustomersForSearch.length === 0
                                      ? 'No customers found in database.'
                                      : 'No customers match your search. Try a different term.'}
                              </CommandEmpty>
                              <CommandGroup>
                                {(() => {
                                  if (isLoadingAllCustomers) {
                                    return (
                                      <div className="p-4 text-center text-sm text-muted-foreground">
                                        Loading customers...
                              </div>
                                    );
                                  }
                                  
                                  if (allCustomersForSearch.length === 0) {
                                    return (
                                      <div className="p-4 text-center text-sm text-muted-foreground">
                                        No customers found. Check console for errors.
                                      </div>
                                    );
                                  }
                                  
                                  // Filter customers based on search term
                                  const filtered = allCustomersForSearch.filter((agent) => {
                                    if (!agentSearchTerm.trim()) {
                                      // Show all customers when search is empty (limit to 500 for performance)
                                      return true;
                                    }
                                    const term = agentSearchTerm.toLowerCase();
                                    const name = (agent.agent_name || '').toLowerCase();
                                    const email = (agent.company_email || '').toLowerCase();
                                    const mga = (agent.mga || '').toLowerCase();
                                    const rga = (agent.rga || '').toLowerCase();
                                    
                                    return (
                                      name.includes(term) ||
                                      email.includes(term) ||
                                      mga.includes(term) ||
                                      rga.includes(term)
                                    );
                                  });
                                  
                                  // Show up to 500 results when no search, 200 when searching
                                  const limit = agentSearchTerm.trim() ? 200 : 500;
                                  return filtered.slice(0, limit).map((agent) => (
                                    <CommandItem
                                      key={agent.company_email}
                                      value={agent.company_email}
                                      onSelect={() => {
                                        setSelectedAgent(agent.company_email);
                                        setAgentSearchOpen(false);
                                        setAgentSearchTerm('');
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          selectedAgent === agent.company_email ? 'opacity-100' : 'opacity-0'
                                        }`}
                                      />
                                      <div className="flex flex-col">
                                        <span className="font-medium">{agent.agent_name}</span>
                                        <span className="text-xs text-muted-foreground">{agent.company_email}</span>
                                        {(agent.mga || agent.rga) && (
                                          <span className="text-xs text-muted-foreground">
                                            {agent.mga && `MGA: ${agent.mga}`}
                                            {agent.mga && agent.rga && ' • '}
                                            {agent.rga && `RGA: ${agent.rga}`}
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ));
                                })()}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <p className="text-xs text-muted-foreground">
                        Search and select from all customers. Charges will be billed to your account.
                      </p>
                    </div>

                    {/* Service Type Selection */}
                    <div className="space-y-2">
                      <Label>Service Type</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(SERVICE_CONFIGS).map(([key, config]) => {
                          const Icon = config.icon;
                          const isSelected = selectedService === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedService(key)}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${
                                isSelected 
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' 
                                  : 'border-border hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Icon className={`h-4 w-4 ${isSelected ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                                <span className="font-medium text-sm">{config.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">${config.price.toFixed(2)} per call</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Allocation Type */}
                    <div className="space-y-3">
                      <Label>Allocation Type</Label>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div>
                          <div className="font-medium">Unlimited Coverage</div>
                          <div className="text-sm text-muted-foreground">Cover all charges (no limit)</div>
                        </div>
                        <Switch
                          checked={allocationType === 'unlimited'}
                          onCheckedChange={(checked) => setAllocationType(checked ? 'unlimited' : 'credits')}
                        />
                      </div>
                    </div>

                    {/* Credits Amount */}
                    {allocationType === 'credits' && (
                      <div className="space-y-2">
                        <Label htmlFor="amount">Credits to Allocate</Label>
                        <div className="flex items-center gap-3">
                          <Input
                            id="amount"
                            type="number"
                            min="1"
                            max="10000"
                            value={allocationAmount}
                            onChange={(e) => setAllocationAmount(e.target.value)}
                            className="flex-1"
                          />
                          <div className="text-sm text-muted-foreground whitespace-nowrap">
                            ≈ ${selectedService ? (parseInt(allocationAmount || '0') * (SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS]?.price || 0)).toFixed(2) : '0.00'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Add any notes..."
                        value={allocationNotes}
                        onChange={(e) => setAllocationNotes(e.target.value)}
                        className="resize-none"
                        rows={2}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAllocationDialogOpen(false)}>Cancel</Button>
                    <Button 
                      onClick={handleCreateAllocation}
                      disabled={createAllocationMutation.isPending}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600"
                    >
                      {createAllocationMutation.isPending ? (
                        <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                      ) : (
                        <><CheckCircle className="h-4 w-4 mr-2" />Create Allocation</>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Allocations Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-indigo-600" />
                      Active Billing Allocations
                    </CardTitle>
                    <CardDescription>Agents you're covering for call charges</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => refetchManagerAllocations()} size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingManagerAllocations ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Loading allocations...</p>
                  </div>
                ) : managerAllocations.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">No Allocations Yet</h3>
                      <p className="text-muted-foreground text-sm max-w-md mx-auto">
                        Create your first allocation to start covering your agents' call charges.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Credits</TableHead>
                        <TableHead className="text-center">Used</TableHead>
                        <TableHead className="text-right">Amount Used</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managerAllocations.map((allocation) => {
                        const serviceConfig = SERVICE_CONFIGS[allocation.service_type as keyof typeof SERVICE_CONFIGS];
                        const Icon = serviceConfig?.icon || Phone;
                        const usagePercent = allocation.credits_allocated > 0 
                          ? (allocation.credits_used / allocation.credits_allocated) * 100 
                          : 0;
                        
                        return (
                          <TableRow key={allocation.allocation_id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{allocation.agent_name}</div>
                                <div className="text-xs text-muted-foreground">{allocation.agent_email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <span>{serviceConfig?.name || allocation.service_type}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {allocation.allocation_type === 'unlimited' ? '∞ Unlimited' : 'Credits'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              {allocation.allocation_type === 'unlimited' ? '∞' : allocation.credits_allocated}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="space-y-1">
                                <span className="font-mono">{allocation.credits_used}</span>
                                {allocation.allocation_type !== 'unlimited' && (
                                  <div className="w-full bg-muted rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${allocation.total_amount_used.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={allocation.status === 'active' ? 'default' : 'secondary'}
                                className={allocation.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                              >
                                {allocation.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Team Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  Your Team ({teamAgents.length} Agents)
                </CardTitle>
                <CardDescription>Quick view of all agents under your organization</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTeamAgents ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : teamAgents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No team members found
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teamAgents.slice(0, 9).map((agent) => {
                      const agentAllocations = managerAllocations.filter(a => a.agent_email === agent.company_email && a.status === 'active');
                      const hasCoverage = agentAllocations.length > 0;
                      
                      return (
                        <Card key={agent.company_email} className={`${hasCoverage ? 'border-green-200 bg-green-50/30 dark:bg-green-950/10' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasCoverage ? 'bg-green-100' : 'bg-muted'}`}>
                                  <UserCheck className={`h-5 w-5 ${hasCoverage ? 'text-green-600' : 'text-muted-foreground'}`} />
                                </div>
                                <div>
                                  <div className="font-medium">{agent.agent_name}</div>
                                  <div className="text-xs text-muted-foreground">{agent.company_email}</div>
                                </div>
                              </div>
                              {hasCoverage && (
                                <Badge className="bg-green-100 text-green-700">Covered</Badge>
                              )}
                            </div>
                            
                            {agentAllocations.length > 0 && (
                              <div className="mt-3 pt-3 border-t space-y-1">
                                {agentAllocations.map(allocation => {
                                  const config = SERVICE_CONFIGS[allocation.service_type as keyof typeof SERVICE_CONFIGS];
                                  return (
                                    <div key={allocation.allocation_id} className="flex items-center justify-between text-sm">
                                      <span className="text-muted-foreground">{config?.name || allocation.service_type}</span>
                                      <span className="font-mono">
                                        {allocation.allocation_type === 'unlimited' ? '∞' : `${allocation.credits_remaining}/${allocation.credits_allocated}`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            {!hasCoverage && (
                              <div className="mt-3 pt-3 border-t">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => {
                                    setSelectedAgent(agent.company_email);
                                    setIsAllocationDialogOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />Add Coverage
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}