import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  Users, 
  DollarSign, 
  CreditCard, 
  Phone, 
  UserCheck,
  Shield,
  TrendingUp,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
  Wallet,
  Receipt,
  Settings,
  ArrowRight,
  Zap,
  Target,
  FileText,
  History
} from 'lucide-react';
import { format } from 'date-fns';

// Service type configurations
const SERVICE_CONFIGS = {
  connect: {
    name: 'AO Connect',
    icon: Phone,
    price: 8.00,
    color: 'blue',
    description: 'VDP call connections',
    bgGradient: 'from-blue-500/10 to-blue-600/5'
  },
  recruit: {
    name: 'AO Recruit',
    icon: Users,
    price: 5.00,
    color: 'green',
    description: 'Recruitment calls',
    bgGradient: 'from-green-500/10 to-green-600/5'
  },
  precheck: {
    name: 'AO PreCheck',
    icon: Shield,
    price: 4.00,
    color: 'purple',
    description: 'Policy verification',
    bgGradient: 'from-purple-500/10 to-purple-600/5'
  },
  hotconnect: {
    name: 'HotConnect',
    icon: Target,
    price: 2.00,
    color: 'amber',
    description: 'Hotlead assignments',
    bgGradient: 'from-amber-500/10 to-amber-600/5'
  }
};

interface TeamAgent {
  associate_id: number;
  agent_name: string;
  company_email: string;
  mga: string;
  rga: string;
  current_balance?: number;
}

interface Allocation {
  id: number;
  allocation_id: string;
  agent_email: string;
  agent_name: string;
  agent_associate_id: number;
  service_type: string;
  allocation_type: string;
  credits_allocated: number;
  credits_used: number;
  credits_remaining: number;
  total_amount_allocated: number;
  total_amount_used: number;
  status: string;
  start_date: string;
  end_date?: string;
  notes?: string;
}

interface Transaction {
  id: number;
  transaction_id: string;
  agent_email: string;
  agent_name: string;
  service_type: string;
  amount_charged: number;
  credits_deducted: number;
  lead_name?: string;
  lead_phone?: string;
  transaction_date: string;
  status: string;
}

export default function ManagerBillingPortal() {
  const { toast } = useToast();
  const { authState } = useAuth();
  const queryClient = useQueryClient();
  
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [allocationAmount, setAllocationAmount] = useState<string>('100');
  const [allocationNotes, setAllocationNotes] = useState<string>('');
  const [allocationType, setAllocationType] = useState<'credits' | 'unlimited'>('credits');
  
  // Get current user email
  const currentUserEmail = useMemo(() => {
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
    const authEmail = authState?.user?.email || authState?.profile?.email;
    return (storedEmail || authEmail || '').toLowerCase();
  }, [authState?.user?.email, authState?.profile?.email]);

  // Check if user is MGA/RGA
  const { data: managerInfo, isLoading: isLoadingManagerInfo } = useQuery({
    queryKey: ['/api/manager-billing/manager-info', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/manager-billing/manager-info?email=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!currentUserEmail
  });

  // Get team agents
  const { data: teamAgents = [], isLoading: isLoadingTeam } = useQuery<TeamAgent[]>({
    queryKey: ['/api/manager-billing/team-agents', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return [];
      const response = await fetch(`/api/manager-billing/team-agents?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.agents || [];
    },
    enabled: !!currentUserEmail && !!managerInfo?.isManager
  });

  // Get existing allocations
  const { data: allocations = [], isLoading: isLoadingAllocations, refetch: refetchAllocations } = useQuery<Allocation[]>({
    queryKey: ['/api/manager-billing/allocations', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return [];
      const response = await fetch(`/api/manager-billing/allocations?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.allocations || [];
    },
    enabled: !!currentUserEmail && !!managerInfo?.isManager
  });

  // Get recent transactions
  const { data: transactions = [], isLoading: isLoadingTransactions, refetch: refetchTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/manager-billing/transactions', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return [];
      const response = await fetch(`/api/manager-billing/transactions?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.transactions || [];
    },
    enabled: !!currentUserEmail && !!managerInfo?.isManager
  });

  // Get manager credit balance
  const { data: managerBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['/api/manager-billing/balance', currentUserEmail],
    queryFn: async () => {
      if (!currentUserEmail) return null;
      const response = await fetch(`/api/manager-billing/balance?managerEmail=${encodeURIComponent(currentUserEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!currentUserEmail && !!managerInfo?.isManager
  });

  // Create allocation mutation
  const createAllocationMutation = useMutation({
    mutationFn: async (data: {
      agentEmail: string;
      serviceType: string;
      allocationType: string;
      creditsAmount: number;
      notes: string;
    }) => {
      const response = await fetch('/api/manager-billing/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerEmail: currentUserEmail,
          ...data
        })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create allocation');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Allocation Created',
        description: 'Successfully allocated billing to agent.'
      });
      setIsAllocationDialogOpen(false);
      setSelectedAgent('');
      setSelectedService('');
      setAllocationAmount('100');
      setAllocationNotes('');
      refetchAllocations();
      refetchBalance();
    },
    onError: (error: Error) => {
      toast({
        title: 'Allocation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const activeAllocations = allocations.filter(a => a.status === 'active');
    const totalAllocated = activeAllocations.reduce((sum, a) => sum + (a.total_amount_allocated || 0), 0);
    const totalUsed = activeAllocations.reduce((sum, a) => sum + (a.total_amount_used || 0), 0);
    const totalCreditsAllocated = activeAllocations.reduce((sum, a) => sum + (a.credits_allocated || 0), 0);
    const totalCreditsUsed = activeAllocations.reduce((sum, a) => sum + (a.credits_used || 0), 0);
    
    return {
      activeAllocations: activeAllocations.length,
      totalAllocated,
      totalUsed,
      totalCreditsAllocated,
      totalCreditsUsed,
      agentsCovered: new Set(activeAllocations.map(a => a.agent_email)).size
    };
  }, [allocations]);

  const handleCreateAllocation = () => {
    if (!selectedAgent || !selectedService || !allocationAmount) {
      toast({
        title: 'Missing Information',
        description: 'Please select an agent, service type, and allocation amount.',
        variant: 'destructive'
      });
      return;
    }

    const agent = teamAgents.find(a => a.company_email === selectedAgent);
    
    createAllocationMutation.mutate({
      agentEmail: selectedAgent,
      serviceType: selectedService,
      allocationType,
      creditsAmount: parseInt(allocationAmount),
      notes: allocationNotes
    });
  };

  // Loading state
  if (isLoadingManagerInfo) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-muted-foreground">Loading manager portal...</p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!managerInfo?.isManager) {
    return (
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-amber-600" />
              <div>
                <CardTitle className="text-amber-800 dark:text-amber-200">Access Restricted</CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  This portal is only available to MGA and RGA managers.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-amber-700 dark:text-amber-300">
              If you believe you should have access to the Manager Billing Portal, please contact your administrator
              or ensure your account is properly registered as an MGA/RGA in the system.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 bg-clip-text text-transparent">
              Manager Billing Portal
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Allocate and pay for your team's call services. Bill charges directly to your MGA/RGA account.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800">
            <Building2 className="h-4 w-4 mr-1.5" />
            {managerInfo?.role || 'Manager'}
          </Badge>
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
                  Allocate credits or coverage for an agent's call services. Charges will be billed to your account.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Agent Selection */}
                <div className="space-y-2">
                  <Label htmlFor="agent">Select Agent</Label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an agent from your team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamAgents.map((agent) => (
                        <SelectItem key={agent.company_email} value={agent.company_email}>
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-green-600" />
                            <span>{agent.agent_name}</span>
                            <span className="text-muted-foreground text-xs">({agent.company_email})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                              ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-950/30` 
                              : 'border-border hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-4 w-4 ${isSelected ? `text-${config.color}-600` : 'text-muted-foreground'}`} />
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
                      <div className="text-sm text-muted-foreground">
                        Cover all charges for this service (no limit)
                      </div>
                    </div>
                    <Switch
                      checked={allocationType === 'unlimited'}
                      onCheckedChange={(checked) => setAllocationType(checked ? 'unlimited' : 'credits')}
                    />
                  </div>
                </div>

                {/* Credits Amount (only if not unlimited) */}
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
                    <p className="text-xs text-muted-foreground">
                      Each credit covers one {selectedService ? SERVICE_CONFIGS[selectedService as keyof typeof SERVICE_CONFIGS]?.name : 'service'} charge
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this allocation..."
                    value={allocationNotes}
                    onChange={(e) => setAllocationNotes(e.target.value)}
                    className="resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAllocationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateAllocation}
                  disabled={createAllocationMutation.isPending}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600"
                >
                  {createAllocationMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create Allocation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Manager Balance */}
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

        {/* Active Allocations */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Active Allocations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {summaryStats.activeAllocations}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Covering {summaryStats.agentsCovered} agents
            </div>
          </CardContent>
        </Card>

        {/* Total Allocated */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Total Allocated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {summaryStats.totalCreditsAllocated} Credits
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ≈ ${summaryStats.totalAllocated.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        {/* Total Used */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {summaryStats.totalCreditsUsed} Credits
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              ${summaryStats.totalUsed.toFixed(2)} billed
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="allocations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-muted/50">
          <TabsTrigger value="allocations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Agent Allocations
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Transaction History
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Team Overview
          </TabsTrigger>
        </TabsList>

        {/* Allocations Tab */}
        <TabsContent value="allocations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-indigo-600" />
                    Active Billing Allocations
                  </CardTitle>
                  <CardDescription>
                    Manage billing allocations for your team members
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => refetchAllocations()} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingAllocations ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading allocations...</p>
                </div>
              ) : allocations.length === 0 ? (
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
                  <Button onClick={() => setIsAllocationDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Allocation
                  </Button>
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
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((allocation) => {
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
                              <Icon className={`h-4 w-4 text-${serviceConfig?.color || 'gray'}-600`} />
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
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(allocation.start_date), 'MMM d, yyyy')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-indigo-600" />
                    Transaction History
                  </CardTitle>
                  <CardDescription>
                    All charges billed to your manager account
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => refetchTransactions()} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTransactions ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Receipt className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">No Transactions Yet</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Transactions will appear here when your agents use allocated services.
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const serviceConfig = SERVICE_CONFIGS[transaction.service_type as keyof typeof SERVICE_CONFIGS];
                      const Icon = serviceConfig?.icon || Phone;
                      
                      return (
                        <TableRow key={transaction.transaction_id}>
                          <TableCell className="text-sm">
                            {format(new Date(transaction.transaction_date), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{transaction.agent_name}</div>
                              <div className="text-xs text-muted-foreground">{transaction.agent_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 text-${serviceConfig?.color || 'gray'}-600`} />
                              <span>{serviceConfig?.name || transaction.service_type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {transaction.lead_name && (
                              <div>
                                <div className="font-medium">{transaction.lead_name}</div>
                                <div className="text-xs text-muted-foreground">{transaction.lead_phone}</div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-red-600">
                            {(transaction.service_type === 'precheck' || transaction.service_type === 'recruit') 
                              ? <span className="text-green-600 font-semibold">Free</span>
                              : `-$${transaction.amount_charged.toFixed(2)}`}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                              className={transaction.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                            >
                              {transaction.status}
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
        </TabsContent>

        {/* Team Overview Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Your Team ({teamAgents.length} Agents)
              </CardTitle>
              <CardDescription>
                View and manage billing for all agents under your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTeam ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading team...</p>
                </div>
              ) : teamAgents.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">No Team Members Found</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Your team members will appear here once they are assigned to your organization.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamAgents.map((agent) => {
                    const agentAllocations = allocations.filter(a => a.agent_email === agent.company_email && a.status === 'active');
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
                                      {allocation.allocation_type === 'unlimited' 
                                        ? '∞' 
                                        : `${allocation.credits_remaining}/${allocation.credits_allocated}`}
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
                                <Plus className="h-4 w-4 mr-2" />
                                Add Coverage
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
      </Tabs>
    </div>
  );
}







