import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Shield, 
  Settings, 
  Activity, 
  Search, 
  MoreVertical,
  UserPlus,
  Crown,
  Zap,
  Clock,
  CreditCard,
  Plus,
  Minus,
  DollarSign,
  RefreshCw,
  Database,
  Link,
  Edit,
  UserCheck,
  UserX,
  Save,
  X,
  Coins
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';

interface CustomerUser {
  COMPANY_EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  PHONE: string;
  STATUS: string;
  AGENTTYPE: string;
  MARKET: string;
  TEAM: string;
  RECRUITING_TRAINING_TYPE: string;
  PLUSACTIVE: string;
  RECRUITACTIVE: string;
  CREATED_DATE: string;
  UPDATED_DATE: string;
  MANAGER_EMAIL: string;
  REGION: string;
  STATE: string;
  ASSOCIATE_ID?: string;
  role?: {
    name: string;
    displayName: string;
    level: number;
  };
  permissions?: string[];
  accessLevel?: number;
}

interface CustomerEditData {
  ASSOCIATE_ID?: string;
  STATE: string;
  MARKET: string;
  AGENTTYPE?: string;
  MANAGER_EMAIL?: string;
  COMPANY_EMAIL?: string;
  FIRST_NAME?: string;
  LAST_NAME?: string;
  PERSONAL_EMAIL?: string;
  PHONE?: string;
  PRIMARY_MARKET?: string;
  SECONDARY_MARKET?: string;
  STATES?: string[];
  MARKETS?: string[];
  VDPACTIVE?: string;
  PLUSACTIVE?: string;
  RECRUITACTIVE?: string;
  AOICONNECT?: string;
}



// User Credits Display Component
function UserCreditsDisplay({ email }: { email: string }) {
  const { data: credits, isLoading } = useQuery({
    queryKey: ['/api/admin/credits', email],
    queryFn: async () => {
      const response = await fetch(`/api/admin/credits/${email}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { creditsRemaining: 0, creditsUsed: 0, creditsPurchased: 0 };
        }
        throw new Error('Failed to fetch user credits');
      }
      return response.json();
    },
    retry: false,
  });

  if (isLoading) return <span className="text-xs">Loading...</span>;
  
  const remaining = credits?.creditsRemaining || 0;
  const used = credits?.creditsUsed || 0;
  const purchased = credits?.creditsPurchased || 0;
  
  return (
    <div className="text-xs space-y-1">
      <div className="flex justify-between">
        <span className="text-gray-500">Purchased:</span>
        <span className="font-medium">{purchased}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Used:</span>
        <span className="text-orange-600">{used}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Remaining:</span>
        <span className="text-green-600 font-semibold">{remaining}</span>
      </div>
    </div>
  );
}

interface AdminRole {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  level: number;
  isActive: boolean;
}

interface UserCredits {
  email: string;
  credits_remaining: number;
  credits_used: number;
  credits_purchased: number;
  created_at: string;
  updated_at: string;
}

interface SyncStats {
  supabaseUsers: number;
  localProfiles: number;
  linkedProfiles: number;
  unlinkedProfiles: number;
  lastSyncDate?: string;
}

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'logs' | 'credits' | 'sync'>('users');
  const [editingCredits, setEditingCredits] = useState<{[key: string]: number}>({});
  const [editingCustomer, setEditingCustomer] = useState<CustomerUser | null>(null);
  const [editData, setEditData] = useState<CustomerEditData>({
    ASSOCIATE_ID: '',
    STATE: '',
    MARKET: '',
    AGENTTYPE: '',
    MANAGER_EMAIL: '',
    COMPANY_EMAIL: '',
    FIRST_NAME: '',
    LAST_NAME: '',
    PERSONAL_EMAIL: '',
    PHONE: '',
    PRIMARY_MARKET: '',
    SECONDARY_MARKET: '',
    STATES: [],
    MARKETS: [],
    VDPACTIVE: '',
    PLUSACTIVE: '',
    RECRUITACTIVE: '',
    AOICONNECT: ''
  });
  const [creditInputs, setCreditInputs] = useState<{[key: string]: string}>({});
  const [passwordResetDialog, setPasswordResetDialog] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<CustomerUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const queryClient = useQueryClient();

  // Available options for multi-select
  const availableStates = [
    'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 
    'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 
    'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'
  ];

  const availableMarkets = [
    'Veteran', 'Globe Market', 'Will Kit', 'ConnectNowRC', 'ConnectNowLT'
  ];

  // Fetch real Supabase agents
  const { data: supabaseAgentsResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/supabase-agents'],
    queryFn: async () => {
      const response = await fetch('/api/admin/supabase-agents');
      if (!response.ok) throw new Error('Failed to fetch Supabase agents');
      return response.json();
    },
  });

  // Extract users from the Supabase response
  const users = supabaseAgentsResponse?.agents || [];

  // Fetch all roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => {
      const response = await fetch('/api/admin/roles');
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
    },
  });

  // Fetch admin logs
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['/api/admin/logs'],
    queryFn: async () => {
      const response = await fetch('/api/admin/logs');
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
  });

  // Fetch user credits
  const { data: userCredits = [], isLoading: creditsLoading } = useQuery({
    queryKey: ['/api/admin/credits'],
    queryFn: async () => {
      const response = await fetch('/api/admin/credits');
      if (!response.ok) throw new Error('Failed to fetch user credits');
      return response.json();
    },
  });

  // Fetch sync statistics
  const { data: syncStats, isLoading: syncStatsLoading } = useQuery({
    queryKey: ['/api/admin/sync-stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/sync-stats');
      if (!response.ok) throw new Error('Failed to fetch sync stats');
      return response.json();
    },
    staleTime: 10000,
  });

  // Sync users mutation
  const syncUsersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/sync-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to sync users');
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ Sync completed:', data);
      // Refresh user data and sync stats after successful sync
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/logs'] });
    },
    onError: (error) => {
      console.error('❌ Sync failed:', error);
    },
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ email, data }: { email: string; data: CustomerEditData }) => {
      const response = await fetch(`/api/admin/customers/${email}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update customer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditingCustomer(null);
    },
    onError: (error) => {
      console.error('Failed to update customer:', error);
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ email, roleName }: { email: string; roleName: string }) => {
      const response = await fetch('/api/admin/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, roleName }),
      });
      if (!response.ok) throw new Error('Failed to assign role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
  });

  // Credit management mutations
  const updateCreditsMutation = useMutation({
    mutationFn: async ({ email, credits }: { email: string; credits: number }) => {
      const response = await fetch(`/api/admin/credits/${email}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credits }),
      });
      if (!response.ok) throw new Error('Failed to update credits');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits'] });
      setEditingCredits({});
    },
  });

  const addCreditsMutation = useMutation({
    mutationFn: async ({ email, credits }: { email: string; credits: number }) => {
      const response = await fetch(`/api/admin/credits/${email}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credits }),
      });
      if (!response.ok) throw new Error('Failed to add credits');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits'] });
      // Clear the credit input for this user
      const email = selectedUserForReset?.COMPANY_EMAIL;
      if (email) {
        setCreditInputs(prev => ({ ...prev, [email]: '' }));
      }
    },
  });

  // Password reset mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await fetch(`/api/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error('Failed to reset password');
      return response.json();
    },
    onSuccess: () => {
      setPasswordResetDialog(false);
      setSelectedUserForReset(null);
      setNewPassword('');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/logs'] });
    },
  });

  // Supabase agent management mutations
  const updateAgentMutation = useMutation({
    mutationFn: async ({ email, agentData }: { email: string; agentData: CustomerEditData }) => {
      const response = await fetch(`/api/admin/supabase-agents/${email}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(agentData),
      });
      if (!response.ok) throw new Error('Failed to update agent');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-agents'] });
      setEditingCustomer(null);
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async (agentData: CustomerEditData) => {
      const response = await fetch('/api/admin/supabase-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(agentData),
      });
      if (!response.ok) throw new Error('Failed to create agent');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-agents'] });
      setEditingCustomer(null);
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`/api/admin/supabase-agents/${email}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete agent');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-agents'] });
    },
  });

  const createCreditsMutation = useMutation({
    mutationFn: async ({ email, credits }: { email: string; credits: number }) => {
      const response = await fetch(`/api/admin/credits/${email}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credits }),
      });
      if (!response.ok) throw new Error('Failed to create credits');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/credits'] });
    },
  });

  // Filter users based on search and role
  const filteredUsers = users.filter((user: CustomerUser) => {
    const matchesSearch = 
      user.FIRST_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.LAST_NAME?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.COMPANY_EMAIL?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.TEAM?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = selectedRole === 'all' || 
      user.role?.name === selectedRole;

    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (level: number) => {
    switch (level) {
      case 3: return 'bg-red-600 text-white'; // Super Admin
      case 2: return 'bg-purple-600 text-white'; // Admin
      case 1: return 'bg-blue-600 text-white'; // Manager
      case 0: return 'bg-gray-600 text-white'; // Agent
      default: return 'bg-gray-400 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'INACTIVE': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // Calculate statistics
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u: CustomerUser) => u.STATUS === 'ACTIVE').length,
    superAdmins: users.filter((u: CustomerUser) => u.role?.level === 3).length,
    admins: users.filter((u: CustomerUser) => u.role?.level === 2).length,
    managers: users.filter((u: CustomerUser) => u.role?.level === 1).length,
    agents: users.filter((u: CustomerUser) => u.role?.level === 0).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage users, roles, permissions, and system settings
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Shield className="h-3 w-3" />
            Super Admin Access
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            System Operational
          </Badge>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="text-xs text-gray-500">Total Users</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <div className="text-xs text-gray-500">Active</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Crown className="h-5 w-5 text-red-600" />
            </div>
            <div className="text-2xl font-bold">{stats.superAdmins}</div>
            <div className="text-xs text-gray-500">Super Admins</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-2xl font-bold">{stats.admins}</div>
            <div className="text-xs text-gray-500">Admins</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold">{stats.managers}</div>
            <div className="text-xs text-gray-500">Managers</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-gray-600" />
            </div>
            <div className="text-2xl font-bold">{stats.agents}</div>
            <div className="text-xs text-gray-500">Agents</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Credits
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            User Sync
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity Logs
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-80"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="all">All Roles</option>
                {roles.map((role: AdminRole) => (
                  <option key={role.id} value={role.name}>
                    {role.displayName}
                  </option>
                ))}
              </select>
            </div>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="p-8 text-center">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No users found matching your criteria
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredUsers.map((user: CustomerUser, index: number) => (
                    <div 
                      key={user.COMPANY_EMAIL} 
                      className={`border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                        editingCustomer?.COMPANY_EMAIL === user.COMPANY_EMAIL ? 'bg-blue-50 dark:bg-blue-900/20' : 
                        index % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/50' : 'bg-white dark:bg-gray-950'
                      }`}
                    >
                      {/* Main Row */}
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => {
                          if (editingCustomer?.COMPANY_EMAIL === user.COMPANY_EMAIL) {
                            setEditingCustomer(null);
                          } else {
                            setEditingCustomer(user);
                            // Extract states and markets from Supabase data properly
                            const userStates = (user as any).STATES || (user as any).states || [];
                            const userMarkets = (user as any).MARKETS || (user as any).market || (user as any).markets || [];
                            
                            // Ensure arrays are properly formatted
                            const statesArray = Array.isArray(userStates) ? userStates : 
                              (typeof userStates === 'string' ? userStates.split(',').map(s => s.trim()).filter(s => s) : []);
                            const marketsArray = Array.isArray(userMarkets) ? userMarkets : 
                              (typeof userMarkets === 'string' ? userMarkets.split(',').map(m => m.trim()).filter(m => m) : []);
                            
                            setEditData({
                              ASSOCIATE_ID: user.ASSOCIATE_ID || '',
                              STATE: user.STATE || '',
                              MARKET: user.MARKET || '',
                              AGENTTYPE: user.AGENTTYPE || '',
                              MANAGER_EMAIL: user.MANAGER_EMAIL || '',
                              COMPANY_EMAIL: user.COMPANY_EMAIL || '',
                              FIRST_NAME: user.FIRST_NAME || '',
                              LAST_NAME: user.LAST_NAME || '',
                              PERSONAL_EMAIL: (user as any).PERSONAL_EMAIL || '',
                              PHONE: user.PHONE || '',
                              PRIMARY_MARKET: (user as any).PRIMARY_MARKET || marketsArray[0] || '',
                              SECONDARY_MARKET: (user as any).SECONDARY_MARKET || marketsArray[1] || 'No Secondary',
                              STATES: statesArray,
                              MARKETS: marketsArray,
                              VDPACTIVE: user.PLUSACTIVE || 'INACTIVE',
                              PLUSACTIVE: user.PLUSACTIVE || 'INACTIVE',
                              RECRUITACTIVE: user.RECRUITACTIVE || 'INACTIVE',
                              AOICONNECT: (user as any).AOICONNECT || 'INACTIVE'
                            });
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                              {user.FIRST_NAME?.[0]}{user.LAST_NAME?.[0]}
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{user.FIRST_NAME} {user.LAST_NAME}</span>
                                <Badge className={getRoleBadgeColor(user.role?.level || 0)} variant="secondary">
                                  {user.role?.displayName || 'Agent'}
                                </Badge>
                                <Badge variant="outline" className={getStatusColor(user.STATUS)}>
                                  {user.STATUS || 'Unknown'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                <span>{user.COMPANY_EMAIL}</span>
                                <span>{user.TEAM || 'N/A'}</span>
                                <span>{user.MARKET || 'N/A'}</span>
                                <span>{user.STATE || 'N/A'}</span>
                                {user.ASSOCIATE_ID && <span>ID: {user.ASSOCIATE_ID}</span>}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <UserCreditsDisplay email={user.COMPANY_EMAIL} />
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUserForReset(user);
                                setPasswordResetDialog(true);
                              }}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded Edit Section */}
                      {editingCustomer?.COMPANY_EMAIL === user.COMPANY_EMAIL && (
                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* User Information */}
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm">User Information</h4>
                              <div className="space-y-2">
                                <div>
                                  <Label htmlFor="company-email" className="text-xs">Company Email</Label>
                                  <Input
                                    id="company-email"
                                    value={editData.COMPANY_EMAIL}
                                    onChange={(e) => setEditData({...editData, COMPANY_EMAIL: e.target.value})}
                                    className="text-xs h-8"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="associate-id" className="text-xs">Associate ID</Label>
                                  <Input
                                    id="associate-id"
                                    value={editData.ASSOCIATE_ID}
                                    onChange={(e) => setEditData({...editData, ASSOCIATE_ID: e.target.value})}
                                    className="text-xs h-8"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="manager-email" className="text-xs">MGA</Label>
                                  <Input
                                    id="manager-email"
                                    value={editData.MANAGER_EMAIL}
                                    onChange={(e) => setEditData({...editData, MANAGER_EMAIL: e.target.value})}
                                    className="text-xs h-8"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Location & Market */}
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm">Location & Market</h4>
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-xs">Licensed States</Label>
                                  <MultiSelect
                                    options={availableStates}
                                    selected={editData.STATES || []}
                                    onChange={(states) => setEditData({...editData, STATES: states, STATE: states.join(', ')})}
                                    placeholder="Select states..."
                                    label="States"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Markets</Label>
                                  <MultiSelect
                                    options={availableMarkets}
                                    selected={editData.MARKETS || []}
                                    onChange={(markets) => setEditData({...editData, MARKETS: markets, MARKET: markets[0] || '', PRIMARY_MARKET: markets[0] || '', SECONDARY_MARKET: markets[1] || 'No Secondary'})}
                                    placeholder="Select markets..."
                                    label="Markets"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="agent-type" className="text-xs">Agent Type</Label>
                                  <Select value={editData.AGENTTYPE} onValueChange={(value) => setEditData({...editData, AGENTTYPE: value})}>
                                    <SelectTrigger className="text-xs h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="AGENT">Agent</SelectItem>
                                      <SelectItem value="MANAGER">Manager</SelectItem>
                                      <SelectItem value="ADMIN">Admin</SelectItem>
                                      <SelectItem value="RECRUITER">Recruiter</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                            
                            {/* Platform Access & Credits */}
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm">Platform Access</h4>
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">VDP Active</Label>
                                    <Select value={editData.VDPACTIVE} onValueChange={(value) => setEditData({...editData, VDPACTIVE: value})}>
                                      <SelectTrigger className="text-xs h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Plus Active</Label>
                                    <Select value={editData.PLUSACTIVE} onValueChange={(value) => setEditData({...editData, PLUSACTIVE: value})}>
                                      <SelectTrigger className="text-xs h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Recruit Active</Label>
                                    <Select value={editData.RECRUITACTIVE} onValueChange={(value) => setEditData({...editData, RECRUITACTIVE: value})}>
                                      <SelectTrigger className="text-xs h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">AOI Connect</Label>
                                    <Select value={editData.AOICONNECT} onValueChange={(value) => setEditData({...editData, AOICONNECT: value})}>
                                      <SelectTrigger className="text-xs h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                  <Input
                                    type="number"
                                    placeholder="Add credits"
                                    value={creditInputs[user.COMPANY_EMAIL] || ''}
                                    onChange={(e) => setCreditInputs(prev => ({ 
                                      ...prev, 
                                      [user.COMPANY_EMAIL]: e.target.value 
                                    }))}
                                    className="text-xs h-8 flex-1"
                                    min="0"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-8"
                                    onClick={() => {
                                      const credits = parseInt(creditInputs[user.COMPANY_EMAIL] || '0');
                                      if (credits > 0) {
                                        addCreditsMutation.mutate({
                                          email: user.COMPANY_EMAIL,
                                          credits: credits
                                        });
                                      }
                                    }}
                                    disabled={!creditInputs[user.COMPANY_EMAIL] || parseInt(creditInputs[user.COMPANY_EMAIL]) <= 0}
                                  >
                                    Add
                                  </Button>
                                </div>
                                <div className="text-xs text-gray-500">
                                  Current: <UserCreditsDisplay email={user.COMPANY_EMAIL} />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              size="sm"
                              onClick={() => updateAgentMutation.mutate({ 
                                email: user.COMPANY_EMAIL, 
                                agentData: editData 
                              })}
                              disabled={updateAgentMutation.isPending}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              {updateAgentMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCustomer(null)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Credit Management</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-2">
                <Coins className="h-3 w-3" />
                Total Credits Managed
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="p-8 text-center">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No users found matching your criteria
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredUsers.map((user: CustomerUser, index: number) => (
                    <div 
                      key={user.COMPANY_EMAIL} 
                      className={`border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                        index % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/50' : 'bg-white dark:bg-gray-950'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                              {user.FIRST_NAME?.[0]}{user.LAST_NAME?.[0]}
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{user.FIRST_NAME} {user.LAST_NAME}</span>
                                <Badge variant="outline" className={getStatusColor(user.STATUS)}>
                                  {user.STATUS || 'Unknown'}
                                </Badge>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {user.COMPANY_EMAIL}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <UserCreditsDisplay email={user.COMPANY_EMAIL} />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="Add credits"
                                value={creditInputs[user.COMPANY_EMAIL] || ''}
                                onChange={(e) => setCreditInputs(prev => ({ 
                                  ...prev, 
                                  [user.COMPANY_EMAIL]: e.target.value 
                                }))}
                                className="text-xs h-8 w-24"
                                min="0"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8"
                                onClick={() => {
                                  const credits = parseInt(creditInputs[user.COMPANY_EMAIL] || '0');
                                  if (credits > 0) {
                                    addCreditsMutation.mutate({
                                      email: user.COMPANY_EMAIL,
                                      credits: credits
                                    });
                                  }
                                }}
                                disabled={!creditInputs[user.COMPANY_EMAIL] || parseInt(creditInputs[user.COMPANY_EMAIL]) <= 0}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">System Roles</h2>
            <Button>Add Custom Role</Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role: AdminRole) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Badge className={getRoleBadgeColor(role.level)}>
                        Level {role.level}
                      </Badge>
                      {role.displayName}
                    </CardTitle>
                    <Button size="sm" variant="outline">Edit</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {role.description}
                  </p>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Permissions:</div>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 5).map((permission, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                      {role.permissions.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{role.permissions.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <h2 className="text-xl font-semibold">System Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Auto-assign new users as Agents</span>
                  <Button size="sm" variant="outline">Enabled</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Require email verification</span>
                  <Button size="sm" variant="outline">Disabled</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Allow self-registration</span>
                  <Button size="sm" variant="outline">Enabled</Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Two-factor authentication</span>
                  <Button size="sm" variant="outline">Optional</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span>Session timeout (hours)</span>
                  <Input className="w-20" value="24" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Password requirements</span>
                  <Button size="sm" variant="outline">Standard</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>



        {/* User Sync Tab */}
        <TabsContent value="sync" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Supabase User Synchronization</h2>
            <Button
              onClick={() => syncUsersMutation.mutate()}
              disabled={syncUsersMutation.isPending}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncUsersMutation.isPending ? 'animate-spin' : ''}`} />
              {syncUsersMutation.isPending ? 'Syncing...' : 'Sync Users'}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Sync Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Sync Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {syncStatsLoading ? (
                  <div className="text-center py-4">Loading sync statistics...</div>
                ) : syncStats ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Supabase Users:</span>
                      <Badge variant="outline">{syncStats.supabaseUsers}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Local Profiles:</span>
                      <Badge variant="outline">{syncStats.localProfiles}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Linked Profiles:</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        <Link className="w-3 h-3 mr-1" />
                        {syncStats.linkedProfiles}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Unlinked Profiles:</span>
                      <Badge variant="destructive" className={syncStats.unlinkedProfiles > 0 ? '' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}>
                        {syncStats.unlinkedProfiles}
                      </Badge>
                    </div>
                    {syncStats.lastSyncDate && (
                      <div className="pt-2 border-t">
                        <div className="text-xs text-gray-500">
                          Last sync: {new Date(syncStats.lastSyncDate).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">No sync data available</div>
                )}
              </CardContent>
            </Card>

            {/* Sync Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Sync Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {syncUsersMutation.isPending ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Synchronizing users...</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  </div>
                ) : syncUsersMutation.isSuccess ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <UserCheck className="w-4 h-4" />
                      <span className="text-sm font-medium">Sync completed successfully</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {syncUsersMutation.data?.message || 'Users synchronized'}
                    </div>
                    {syncUsersMutation.data?.errors?.length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs font-medium text-orange-600 mb-1">Warnings:</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          {syncUsersMutation.data.errors.slice(0, 3).map((error: string, index: number) => (
                            <div key={index} className="truncate">{error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : syncUsersMutation.isError ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-600">
                      <UserX className="w-4 h-4" />
                      <span className="text-sm font-medium">Sync failed</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {syncUsersMutation.error?.message || 'An error occurred during synchronization'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Database className="w-4 h-4" />
                      <span className="text-sm">Ready to sync</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Click "Sync Users" to synchronize all Supabase authentication users with the admin panel.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sync Description */}
          <Card>
            <CardHeader>
              <CardTitle>How User Sync Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <strong>User Synchronization</strong> pulls all authenticated users from Supabase and creates corresponding profiles in the admin panel system.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Creates agent profiles for new Supabase users</li>
                  <li>Links existing profiles to their Supabase accounts</li>
                  <li>Assigns default "agent" role to new users (@aoglobelife.com domain users)</li>
                  <li>Preserves existing role assignments and user data</li>
                  <li>Logs all sync activity for audit purposes</li>
                </ul>
                <p className="text-xs text-gray-500">
                  Safe to run multiple times - existing data will not be duplicated or overwritten.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <Card>
            <CardContent className="p-0">
              <div className="space-y-0">
                {logsLoading ? (
                  <div className="p-4 text-center">Loading activity logs...</div>
                ) : logs.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No recent activity</div>
                ) : (
                  logs.slice(0, 20).map((log: any, index: number) => (
                    <div key={log.id} className={`p-4 border-b border-gray-100 dark:border-gray-800 ${index % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-900/50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{log.action}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            by {log.adminEmail} {log.targetUserEmail && `→ ${log.targetUserEmail}`}
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Edit Modal */}
      <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer Information</DialogTitle>
          </DialogHeader>
          
          {editingCustomer && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Editing: {editingCustomer.FIRST_NAME} {editingCustomer.LAST_NAME} ({editingCustomer.COMPANY_EMAIL})
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="associate-id">Associate ID</Label>
                  <Input
                    id="associate-id"
                    value={editData.ASSOCIATE_ID}
                    onChange={(e) => setEditData({...editData, ASSOCIATE_ID: e.target.value})}
                    placeholder="Enter Associate ID"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={editData.STATE}
                    onChange={(e) => setEditData({...editData, STATE: e.target.value})}
                    placeholder="Enter State (e.g., TX, CA, NY)"
                  />
                </div>

                <div>
                  <Label htmlFor="market">Market</Label>
                  <Select value={editData.MARKET} onValueChange={(value) => setEditData({...editData, MARKET: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Market" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Globe">Globe</SelectItem>
                      <SelectItem value="Veteran">Veteran</SelectItem>
                      <SelectItem value="Plus">Plus</SelectItem>
                      <SelectItem value="Will Kit">Will Kit</SelectItem>
                      <SelectItem value="UNKNOWN">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="agent-type">Agent Type</Label>
                  <Select value={editData.AGENTTYPE} onValueChange={(value) => setEditData({...editData, AGENTTYPE: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Agent Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGENT">Agent</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="RECRUITER">Recruiter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="company-email">Company Email</Label>
                  <Input
                    id="company-email"
                    value={editData.COMPANY_EMAIL}
                    onChange={(e) => setEditData({...editData, COMPANY_EMAIL: e.target.value})}
                    placeholder="user@aoglobelife.com"
                  />
                </div>

                <div>
                  <Label htmlFor="manager-email">Manager Email</Label>
                  <Input
                    id="manager-email"
                    value={editData.MANAGER_EMAIL}
                    onChange={(e) => setEditData({...editData, MANAGER_EMAIL: e.target.value})}
                    placeholder="manager@aoglobelife.com"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomer(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={() => updateAgentMutation.mutate({ 
                email: editingCustomer?.COMPANY_EMAIL || '', 
                agentData: editData 
              })}
              disabled={updateAgentMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateAgentMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={passwordResetDialog} onOpenChange={setPasswordResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
          </DialogHeader>
          
          {selectedUserForReset && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Reset password for: {selectedUserForReset.FIRST_NAME} {selectedUserForReset.LAST_NAME} ({selectedUserForReset.COMPANY_EMAIL})
              </div>
              
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 8 characters long
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordResetDialog(false);
              setSelectedUserForReset(null);
              setNewPassword('');
            }}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={() => resetPasswordMutation.mutate({ 
                email: selectedUserForReset?.COMPANY_EMAIL || '', 
                password: newPassword 
              })}
              disabled={resetPasswordMutation.isPending || newPassword.length < 8}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}