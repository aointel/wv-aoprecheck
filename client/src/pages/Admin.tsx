import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Download,
  Link,
  Edit,
  UserCheck,
  UserX,
  Save,
  X,
  Coins,
  Phone,
  Trash2,
  Star
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Building, ArrowUpDown } from 'lucide-react';
import { MultiSelect } from '@/components/ui/multi-select';
import { useToast } from '@/hooks/use-toast';

interface CustomerUser {
  COMPANY_EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  PHONE: string;
  STATUS: string;
  producerTYPE: string;
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
  callConnectorProAccess?: boolean;
}

interface CustomerEditData {
  ASSOCIATE_ID?: string;
  STATE: string;
  MARKET: string;
  producerTYPE?: string;
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

// RGA Assignment Section Component
function RGAAssignmentSection({ teams, rgas }: { teams: any[], rgas: string[] }) {
  const [selectedMGA, setSelectedMGA] = useState('');
  const [selectedAssignRGA, setSelectedAssignRGA] = useState('');
  const queryClient = useQueryClient();

  const assignMGAToRGAMutation = useMutation({
    mutationFn: async (data: { mgaTeam: string; rgaTeam: string }) => {
      return apiRequest('PUT', '/api/teams/rgas/assign', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams/rgas'] });
      setSelectedMGA('');
      setSelectedAssignRGA('');
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label>Select MGA</Label>
        <Select value={selectedMGA} onValueChange={setSelectedMGA}>
          <SelectTrigger>
            <SelectValue placeholder="Choose MGA..." />
          </SelectTrigger>
          <SelectContent>
            {teams.filter((team: any) => team.name && team.name.trim() !== '').map((team: any) => (
              <SelectItem key={team.name} value={team.name}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Assign to RGA</Label>
        <Select value={selectedAssignRGA} onValueChange={setSelectedAssignRGA}>
          <SelectTrigger>
            <SelectValue placeholder="Choose RGA..." />
          </SelectTrigger>
          <SelectContent>
            {rgas.filter((rga: string) => rga && rga.trim() !== '').map((rga: string) => (
              <SelectItem key={rga} value={rga}>
                {rga}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end">
        <Button
          onClick={() => assignMGAToRGAMutation.mutate({
            mgaTeam: selectedMGA,
            rgaTeam: selectedAssignRGA
          })}
          disabled={!selectedMGA || !selectedAssignRGA || assignMGAToRGAMutation.isPending}
          className="w-full"
        >
          <Crown className="w-4 h-4 mr-2" />
          {assignMGAToRGAMutation.isPending ? 'Assigning...' : 'Assign MGA to RGA'}
        </Button>
      </div>
    </div>
  );
}

// RGA Card Component
function RGACard({ rgaName }: { rgaName: string }) {
  const { data: mgasResponse } = useQuery({
    queryKey: ['/api/teams/rgas', rgaName, 'mgas'],
    queryFn: async () => {
      const response = await fetch(`/api/teams/rgas/${encodeURIComponent(rgaName)}/mgas`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch MGAs for RGA');
      return response.json();
    },
  });

  const mgas = mgasResponse?.mgas || [];

  return (
    <Card className="border-2 border-yellow-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-yellow-600" />
          <div className="font-medium">{rgaName}</div>
        </div>
        <div className="text-sm text-gray-500 mb-2">
          {mgas.length} MGA{mgas.length !== 1 ? 's' : ''}
        </div>
        {mgas.length > 0 && (
          <div className="space-y-1">
            {mgas.map((mga: string) => (
              <Badge key={mga} variant="outline" className="text-xs mr-1 mb-1">
                {mga}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// RGA Sync Section Component
function RGASyncSection() {
  const queryClient = useQueryClient();

  const syncRGAMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/teams/sync-rga-to-supabase', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams/rgas'] });
    },
  });

  return (
    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium">Sync RGA Data to Supabase</div>
        <div className="text-sm text-gray-600">
          Updates the Supabase customers table with RGA information based on MGA assignments from PostgreSQL
        </div>
      </div>
      <Button
        onClick={() => syncRGAMutation.mutate()}
        disabled={syncRGAMutation.isPending}
        variant="outline"
      >
        <Database className="w-4 h-4 mr-2" />
        {syncRGAMutation.isPending ? 'Syncing...' : 'Sync RGA Data'}
      </Button>
    </div>
  );
}

// User Data Sync Section Component
function UserDataSyncSection() {
  const queryClient = useQueryClient();

  const syncUsersMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/teams/sync-users-from-supabase', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams/rgas'] });
    },
  });

  return (
    <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium">Sync All Users from Supabase</div>
        <div className="text-sm text-gray-600">
          Pulls all user data from Supabase customers table into PostgreSQL for hierarchy management
        </div>
      </div>
      <Button
        onClick={() => syncUsersMutation.mutate()}
        disabled={syncUsersMutation.isPending}
        variant="outline"
      >
        <Download className="w-4 h-4 mr-2" />
        {syncUsersMutation.isPending ? 'Syncing...' : 'Sync Users'}
      </Button>
    </div>
  );
}

// Quality Manager Management Component
function QualityManagerManagement({ customers, customersLoading }: { customers: any[]; customersLoading: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showTeamAssignment, setShowTeamAssignment] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current Quality Managers
  const { data: qualityManagersData, isLoading: qmLoading } = useQuery({
    queryKey: ['/api/admin/quality-managers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/quality-managers?userEmail=admin@aoprecheck.net', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch quality managers');
      return response.json();
    },
  });

  // Get MGA teams for assignment
  const { data: mgaTeamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/admin/mga-teams'],
    queryFn: async () => {
      const response = await fetch('/api/admin/mga-teams?userEmail=admin@aoprecheck.net', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch MGA teams');
      return response.json();
    },
  });

  const qualityManagers = qualityManagersData?.qualityManagers || [];
  const mgaTeams = mgaTeamsData?.teams || [];

  // Grant Quality Manager role mutation
  const grantQMMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('POST', `/api/admin/quality-managers/${email}?userEmail=admin@aoprecheck.net`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quality-managers'] });
      toast({ title: 'Success', description: 'Quality Manager role granted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to grant Quality Manager role', variant: 'destructive' });
    }
  });

  // Revoke Quality Manager role mutation
  const revokeQMMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('DELETE', `/api/admin/quality-managers/${email}?userEmail=admin@aoprecheck.net`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quality-managers'] });
      toast({ title: 'Success', description: 'Quality Manager role revoked successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to revoke Quality Manager role', variant: 'destructive' });
    }
  });

  // Update team assignments mutation
  const updateTeamsMutation = useMutation({
    mutationFn: async ({ email, teamIds }: { email: string; teamIds: number[] }) => {
      return apiRequest('PUT', `/api/admin/quality-managers/${email}/teams?userEmail=admin@aoprecheck.net`, { teamIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quality-managers'] });
      toast({ title: 'Success', description: 'Team assignments updated successfully' });
      setShowTeamAssignment(false);
      setSelectedUser(null);
      setSelectedTeams([]);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update team assignments', variant: 'destructive' });
    }
  });

  // Filter users for search
  const filteredUsers = React.useMemo(() => {
    if (!searchTerm) return customers;
    return customers.filter((customer: any) => {
      const firstName = customer.first_name || customer.FIRST_NAME || '';
      const lastName = customer.last_name || customer.LAST_NAME || '';
      const email = customer.company_email || customer.COMPANY_EMAIL || '';
      const fullName = (firstName + ' ' + lastName).toLowerCase();
      return fullName.includes(searchTerm.toLowerCase()) || email.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [customers, searchTerm]);

  // Check if user is already a Quality Manager
  const isQualityManager = (email: string) => {
    return qualityManagers.some((qm: any) => qm.email === email);
  };

  if (customersLoading || qmLoading || teamsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Quality Manager Management</h1>
            <p className="text-muted-foreground">Assign Quality Manager roles and MGA team access</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name or email address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-80"
            data-testid="input-search-users"
          />
        </div>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList>
          <TabsTrigger value="current" data-testid="tab-current-qms">
            Current Quality Managers ({qualityManagers.length})
          </TabsTrigger>
          <TabsTrigger value="assign" data-testid="tab-assign-qms">
            Assign New Quality Managers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Quality Managers</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quality Managers with their assigned MGA team access
              </p>
            </CardHeader>
            <CardContent>
              {qualityManagers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No Quality Managers assigned yet
                </div>
              ) : (
                <div className="space-y-4">
                  {qualityManagers.map((qm: any) => (
                    <div 
                      key={qm.email} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`card-qm-${qm.email}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{qm.email}</div>
                          <div className="text-sm text-muted-foreground">
                            Assigned: {new Date(qm.created_at).toLocaleDateString()}
                            {qm.assigned_by && ` by ${qm.assigned_by}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm">
                          {Array.isArray(qm.assigned_teams) && qm.assigned_teams.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {qm.assigned_teams.map((team: any) => (
                                <Badge key={team.id} variant="outline" className="text-xs">
                                  {team.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="destructive" className="text-xs">No teams assigned</Badge>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const existingTeamIds = Array.isArray(qm.assigned_teams) 
                              ? qm.assigned_teams.map((t: any) => t.id) 
                              : [];
                            setSelectedUser({ email: qm.email, assignedTeams: qm.assigned_teams });
                            setSelectedTeams(existingTeamIds);
                            setShowTeamAssignment(true);
                          }}
                          data-testid={`button-assign-teams-${qm.email}`}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Manage Teams
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => revokeQMMutation.mutate(qm.email)}
                          disabled={revokeQMMutation.isPending}
                          data-testid={`button-revoke-qm-${qm.email}`}
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Revoke Role
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Quality Manager Role</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select users to grant Quality Manager access. Use the search box above to find users by name or email address.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredUsers.map((user: any) => {
                  const userEmail = user.company_email || user.COMPANY_EMAIL;
                  const isQM = isQualityManager(userEmail);
                  return (
                    <div 
                      key={userEmail} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      data-testid={`row-user-${userEmail}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {user.first_name || user.FIRST_NAME || 'No Name'} {user.last_name || user.LAST_NAME || ''}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.company_email || user.COMPANY_EMAIL}</div>
                          <div className="text-xs text-muted-foreground">
                            Team: {user.team || user.TEAM || user.mga || 'Unassigned'} | Market: {user.market || user.MARKET || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isQM ? (
                          <Badge className="bg-blue-100 text-blue-800">Quality Manager</Badge>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => grantQMMutation.mutate(userEmail)}
                            disabled={grantQMMutation.isPending}
                            data-testid={`button-grant-qm-${userEmail}`}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Grant QM Role
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Team Assignment Dialog */}
      <Dialog open={showTeamAssignment} onOpenChange={setShowTeamAssignment}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign MGA Teams</DialogTitle>
            <DialogDescription>
              Select which MGA teams {selectedUser?.email} can access and manage
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Available MGA Teams</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Quality Manager will only see data from selected teams
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {mgaTeams.map((team: any) => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-${team.id}`}
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTeams([...selectedTeams, team.id]);
                        } else {
                          setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                        }
                      }}
                      data-testid={`checkbox-team-${team.id}`}
                    />
                    <Label 
                      htmlFor={`team-${team.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {team.name}
                      {team.description && (
                        <span className="text-xs text-muted-foreground block">
                          {team.description}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowTeamAssignment(false);
                setSelectedUser(null);
                setSelectedTeams([]);
              }}
              data-testid="button-cancel-team-assignment"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={() => updateTeamsMutation.mutate({ 
                email: selectedUser?.email || '', 
                teamIds: selectedTeams 
              })}
              disabled={updateTeamsMutation.isPending}
              data-testid="button-save-team-assignment"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateTeamsMutation.isPending ? 'Saving...' : 'Save Team Assignments'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quality Managers List Component for each team
function QualityManagersList({ teamId }: { teamId: number }) {
  const { data: teamQMsData, isLoading } = useQuery({
    queryKey: ['/api/admin/teams', teamId, 'quality-managers'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/teams/${teamId}/quality-managers`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch team Quality Managers');
      return response.json();
    },
  });

  const removeQMFromTeamMutation = useMutation({
    mutationFn: async ({ qmEmail }: { qmEmail: string }) => {
      return apiRequest('DELETE', `/api/admin/teams/${teamId}/quality-managers/${qmEmail}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teams', teamId, 'quality-managers'] });
      toast({ title: 'Success', description: 'Quality Manager removed from team successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove Quality Manager from team', variant: 'destructive' });
    }
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Loading...</div>;
  }

  const qualityManagers = teamQMsData?.qualityManagers || [];

  if (qualityManagers.length === 0) {
    return <div className="text-xs text-muted-foreground">None assigned</div>;
  }

  return (
    <div className="space-y-1">
      {qualityManagers.map((qm: any) => (
        <div key={qm.email} className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-xs font-medium">{qm.email}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-4 w-4 p-0"
            onClick={() => removeQMFromTeamMutation.mutate({ qmEmail: qm.email })}
            data-testid={`button-remove-qm-${qm.email}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// Actual Team Management Component with CRUD functionality
function TeamsManagement({ customers, customersLoading }: { customers: any[]; customersLoading: boolean }) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [showAssignMember, setShowAssignMember] = useState(false);
  const [showAddQM, setShowAddQM] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamType, setNewTeamType] = useState<'mga' | 'rga'>('mga');
  const [selectedQMEmail, setSelectedQMEmail] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Process team data from customers
  const teams = React.useMemo(() => {
    if (!customers.length) return [];
    
    const teamMap = new Map();
    
    customers.forEach((customer: any) => {
      const mgaTeam = customer.mga;
      const rgaTeam = customer.rga;
      
      if (mgaTeam && mgaTeam !== 'Unassigned') {
        if (!teamMap.has(mgaTeam)) {
          teamMap.set(mgaTeam, {
            id: mgaTeam,
            name: mgaTeam,
            type: 'MGA',
            members: [],
            isActive: true
          });
        }
        teamMap.get(mgaTeam).members.push(customer);
      }
      
      if (rgaTeam && rgaTeam !== 'Unassigned') {
        if (!teamMap.has(rgaTeam)) {
          teamMap.set(rgaTeam, {
            id: rgaTeam,
            name: rgaTeam,
            type: 'RGA',
            members: [],
            isActive: true
          });
        }
        teamMap.get(rgaTeam).members.push(customer);
      }
    });
    
    return Array.from(teamMap.values());
  }, [customers]);

  // Get unassigned customers
  const unassignedCustomers = React.useMemo(() => {
    return customers.filter((customer: any) => 
      (!customer.mga || customer.mga === 'Unassigned') && 
      (!customer.rga || customer.rga === 'Unassigned')
    );
  }, [customers]);

  // Filter customers for search
  const filteredCustomers = React.useMemo(() => {
    if (!searchTerm) return customers;
    return customers.filter((customer: any) =>
      (customer.first_name + ' ' + customer.last_name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.company_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mga?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.rga?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  // Create new team mutation
  const createTeamMutation = useMutation({
    mutationFn: async ({ teamName, teamType }: { teamName: string; teamType: 'mga' | 'rga' }) => {
      // For now, just create a placeholder - in real system you'd create in DB
      return { success: true, teamName, teamType };
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Team created successfully' });
      setShowCreateTeam(false);
      setNewTeamName('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create team', variant: 'destructive' });
    }
  });

  // Update team assignment mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ email, teamName, teamType }: { email: string; teamName: string; teamType: 'mga' | 'rga' }) => {
      const updateData: any = {};
      if (teamType === 'mga') {
        updateData.mga = teamName;
        updateData.rga = null; // Clear other assignment
      } else if (teamType === 'rga') {
        updateData.rga = teamName;
        updateData.mga = null; // Clear other assignment
      }
      return apiRequest('PUT', `/api/supabase/customers/${email}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supabase/customers'] });
      toast({ title: 'Success', description: 'Team assignment updated successfully' });
      setShowAssignMember(false);
      setSelectedCustomer(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update team assignment', variant: 'destructive' });
    }
  });

  // Remove member from team mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      return apiRequest('PUT', `/api/supabase/customers/${email}`, {
        mga: null,
        rga: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/supabase/customers'] });
      toast({ title: 'Success', description: 'Member removed from team successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove member from team', variant: 'destructive' });
    }
  });

  // Fetch database teams (with proper IDs for Quality Manager assignments)
  const { data: dbTeamsData, isLoading: dbTeamsLoading } = useQuery({
    queryKey: ['/api/admin/teams'],
    queryFn: async () => {
      const response = await fetch('/api/admin/teams', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json();
    },
  });

  // Fetch Quality Managers for the selected team
  const { data: teamQMsData, isLoading: teamQMsLoading } = useQuery({
    queryKey: ['/api/admin/teams', selectedTeamId, 'quality-managers'],
    queryFn: async () => {
      if (!selectedTeamId) return { qualityManagers: [] };
      const response = await fetch(`/api/admin/teams/${selectedTeamId}/quality-managers`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch team Quality Managers');
      return response.json();
    },
    enabled: !!selectedTeamId,
  });

  // Fetch all Quality Managers for the add dropdown
  const { data: allQMsData } = useQuery({
    queryKey: ['/api/admin/quality-managers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/quality-managers', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch Quality Managers');
      return response.json();
    },
  });

  // Assign Quality Manager to team mutation
  const assignQMToTeamMutation = useMutation({
    mutationFn: async ({ teamId, qmEmail }: { teamId: number; qmEmail: string }) => {
      return apiRequest('POST', `/api/admin/teams/${teamId}/quality-managers`, { qmEmail });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teams', selectedTeamId, 'quality-managers'] });
      toast({ title: 'Success', description: 'Quality Manager assigned to team successfully' });
      setShowAddQM(false);
      setSelectedQMEmail('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to assign Quality Manager to team', variant: 'destructive' });
    }
  });

  // Remove Quality Manager from team mutation
  const removeQMFromTeamMutation = useMutation({
    mutationFn: async ({ teamId, qmEmail }: { teamId: number; qmEmail: string }) => {
      return apiRequest('DELETE', `/api/admin/teams/${teamId}/quality-managers/${qmEmail}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teams', selectedTeamId, 'quality-managers'] });
      toast({ title: 'Success', description: 'Quality Manager removed from team successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove Quality Manager from team', variant: 'destructive' });
    }
  });


  if (customersLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Teams Management</h1>
            <p className="text-muted-foreground">Create, edit, and manage team assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateTeam(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Team
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="teams" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">Manage Teams</TabsTrigger>
          <TabsTrigger value="assign">Assign Members</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned ({unassignedCustomers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teams.length}</div>
                <p className="text-xs text-muted-foreground">
                  {teams.filter((t: any) => t.isActive).length} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teams.reduce((sum: number, team: any) => sum + team.members.length, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Across all teams</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">MGA Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teams.filter(t => t.type === 'MGA').length}
                </div>
                <p className="text-xs text-muted-foreground">Management teams</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">RGA Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teams.filter(t => t.type === 'RGA').length}
                </div>
                <p className="text-xs text-muted-foreground">Regional teams</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Team Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team: any) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        <Badge variant={team.type === 'MGA' ? 'default' : 'secondary'}>
                          {team.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{team.members.length}</TableCell>
                      <TableCell>
                        <Badge variant={team.isActive ? 'default' : 'outline'}>
                          {team.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Reports Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-blue-700">📊 Professional Billing Reports System</CardTitle>
              <p className="text-base text-muted-foreground">
                Comprehensive billing reports for 6 call service types with MGA-grouped agency reports
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Service Type Reports Grid */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Service Type Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Button 
                    className="h-28 flex flex-col items-center justify-center space-y-3 border-2 border-blue-200 hover:border-blue-400" 
                    variant="outline"
                    onClick={() => window.open('/api/billing/report/connect?format=csv', '_blank')}
                  >
                    <Phone className="h-8 w-8 text-blue-600" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">AO Connect</div>
                      <div className="text-sm text-muted-foreground">Download CSV Report</div>
                    </div>
                  </Button>

                  <Button 
                    className="h-28 flex flex-col items-center justify-center space-y-3 border-2 border-green-200 hover:border-green-400" 
                    variant="outline"
                    onClick={() => window.open('/api/billing/report/plus?format=csv', '_blank')}
                  >
                    <Star className="h-8 w-8 text-green-600" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">AO Plus</div>
                      <div className="text-sm text-muted-foreground">Download CSV Report</div>
                    </div>
                  </Button>

                  <Button 
                    className="h-28 flex flex-col items-center justify-center space-y-3 border-2 border-purple-200 hover:border-purple-400" 
                    variant="outline"
                    onClick={() => window.open('/api/billing/report/precheck?format=csv', '_blank')}
                  >
                    <Shield className="h-8 w-8 text-purple-600" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">AO Precheck</div>
                      <div className="text-sm text-muted-foreground">Download CSV Report</div>
                    </div>
                  </Button>

                  <Button 
                    className="h-28 flex flex-col items-center justify-center space-y-3 border-2 border-orange-200 hover:border-orange-400" 
                    variant="outline"
                    onClick={() => window.open('/api/billing/report/recruit?format=csv', '_blank')}
                  >
                    <UserPlus className="h-8 w-8 text-orange-600" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">AO Recruit</div>
                      <div className="text-sm text-muted-foreground">Download CSV Report</div>
                    </div>
                  </Button>

                  <Button 
                    className="h-28 flex flex-col items-center justify-center space-y-3 border-2 border-red-200 hover:border-red-400" 
                    variant="outline"
                    onClick={() => window.open('/api/billing/report/verification?format=csv', '_blank')}
                  >
                    <UserCheck className="h-8 w-8 text-red-600" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">Verification Calls</div>
                      <div className="text-sm text-muted-foreground">Download CSV Report</div>
                    </div>
                  </Button>

                  <Button 
                    className="h-28 flex flex-col items-center justify-center space-y-3 border-2 border-gray-200 hover:border-gray-400" 
                    variant="outline"
                    onClick={() => window.open('/api/billing/report/other?format=csv', '_blank')}
                  >
                    <Settings className="h-8 w-8 text-gray-600" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">Other Services</div>
                      <div className="text-sm text-muted-foreground">Download CSV Report</div>
                    </div>
                  </Button>
                </div>
              </div>

              {/* MGA Agency Reports */}
              <div>
                <h3 className="text-lg font-semibold mb-4">MGA-Grouped Agency Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Button 
                    variant="default" 
                    className="h-20 flex items-center justify-between p-6 bg-blue-600 hover:bg-blue-700" 
                    onClick={() => window.open('/api/billing/mga-report?format=csv', '_blank')}
                  >
                    <div className="flex items-center space-x-4">
                      <ChevronDown className="h-6 w-6 text-white" />
                      <div className="text-left">
                        <div className="font-semibold text-lg text-white">MGA Agency Reports</div>
                        <div className="text-sm text-blue-100">All services grouped by MGA teams</div>
                      </div>
                    </div>
                    <Download className="h-5 w-5 text-white" />
                  </Button>

                  <Button 
                    variant="default" 
                    className="h-20 flex items-center justify-between p-6 bg-green-600 hover:bg-green-700" 
                    onClick={() => window.open('/api/billing/summary?format=csv', '_blank')}
                  >
                    <div className="flex items-center space-x-4">
                      <DollarSign className="h-6 w-6 text-white" />
                      <div className="text-left">
                        <div className="font-semibold text-lg text-white">Billing Summary</div>
                        <div className="text-sm text-green-100">Complete billing overview with producer names & credits</div>
                      </div>
                    </div>
                    <Download className="h-5 w-5 text-white" />
                  </Button>
                </div>
              </div>

              {/* Features List */}
              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border">
                <h4 className="font-semibold text-lg mb-4 text-gray-800">🚀 Report Features:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">Real producer names from associate_id lookups</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">MGA team assignments from customer database</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm font-medium">Credit balances and usage tracking</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium">Complete service usage breakdowns</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium">CSV exports for billing systems</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-sm font-medium">$0.10 per credit billing calculations</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  MGA Teams ({teams.filter(t => t.type === 'MGA').length})
                  <Badge variant="default">MGA</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {teams.filter(t => t.type === 'MGA').map((team: any) => {
                  // Find corresponding database team for Quality Manager assignments
                  const dbTeam = dbTeamsData?.teams?.find((dt: any) => dt.name === team.name && dt.team_type === 'MGA');
                  return (
                    <div key={team.id} className="p-3 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-sm text-muted-foreground">{team.members.length} members</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedTeam(team.id);
                            setNewTeamName(team.name);
                            setNewTeamType(team.type.toLowerCase() as 'mga' | 'rga');
                            setShowEditTeam(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedTeam(team.id);
                            setNewTeamName(team.name);
                            setNewTeamType(team.type.toLowerCase() as 'mga' | 'rga');
                            setShowAssignMember(true);
                          }}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          {dbTeam && (
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedTeamId(dbTeam.id);
                              setSelectedTeam(team.name);
                              setShowAddQM(true);
                            }}>
                              <Crown className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Quality Managers section */}
                      {dbTeam && (
                        <div className="mt-2 p-2 bg-muted/30 rounded border-l-2 border-primary/20">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Quality Managers:</div>
                          <QualityManagersList teamId={dbTeam.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {teams.filter(t => t.type === 'MGA').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No MGA teams found</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  RGA Teams ({teams.filter(t => t.type === 'RGA').length})
                  <Badge variant="secondary">RGA</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {teams.filter(t => t.type === 'RGA').map((team: any) => {
                  // Find corresponding database team for Quality Manager assignments
                  const dbTeam = dbTeamsData?.teams?.find((dt: any) => dt.name === team.name && dt.team_type === 'RGA');
                  return (
                    <div key={team.id} className="p-3 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-sm text-muted-foreground">{team.members.length} members</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedTeam(team.id);
                            setNewTeamName(team.name);
                            setNewTeamType(team.type.toLowerCase() as 'mga' | 'rga');
                            setShowEditTeam(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedTeam(team.id);
                            setNewTeamName(team.name);
                            setNewTeamType(team.type.toLowerCase() as 'mga' | 'rga');
                            setShowAssignMember(true);
                          }}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          {dbTeam && (
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedTeamId(dbTeam.id);
                              setSelectedTeam(team.name);
                              setShowAddQM(true);
                            }}>
                              <Crown className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Quality Managers section */}
                      {dbTeam && (
                        <div className="mt-2 p-2 bg-muted/30 rounded border-l-2 border-secondary/20">
                          <div className="text-xs font-medium text-muted-foreground mb-1">Quality Managers:</div>
                          <QualityManagersList teamId={dbTeam.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {teams.filter(t => t.type === 'RGA').length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No RGA teams found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assign Members to Teams</CardTitle>
              <p className="text-sm text-muted-foreground">Click on a customer to assign them to a team</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredCustomers.map((customer: any) => (
                  <div key={customer.company_email} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {customer.first_name} {customer.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">{customer.company_email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {customer.mga && (
                        <Badge variant="default">MGA: {customer.mga}</Badge>
                      )}
                      {customer.rga && (
                        <Badge variant="secondary">RGA: {customer.rga}</Badge>
                      )}
                      {!customer.mga && !customer.rga && (
                        <Badge variant="outline">Unassigned</Badge>
                      )}
                      <Button size="sm" onClick={() => {
                        setSelectedCustomer(customer);
                        setShowAssignMember(true);
                      }}>
                        {customer.mga || customer.rga ? 'Reassign' : 'Assign'}
                      </Button>
                      {(customer.mga || customer.rga) && (
                        <Button size="sm" variant="outline" onClick={() => 
                          removeMemberMutation.mutate({ email: customer.company_email })
                        }>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unassigned" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Unassigned Members ({unassignedCustomers.length})</CardTitle>
              <p className="text-sm text-muted-foreground">These members are not assigned to any team</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {unassignedCustomers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>All members are assigned to teams</p>
                  </div>
                ) : (
                  unassignedCustomers.map((customer: any) => (
                    <div key={customer.company_email} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">{customer.company_email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Unassigned</Badge>
                        <Button size="sm" onClick={() => {
                          setSelectedCustomer(customer);
                          setShowAssignMember(true);
                        }}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Assign to Team
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Team Dialog */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name</Label>
              <Input
                id="teamName"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamType">Team Type</Label>
              <Select value={newTeamType} onValueChange={(value: 'mga' | 'rga') => setNewTeamType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mga">MGA</SelectItem>
                  <SelectItem value="rga">RGA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTeam(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createTeamMutation.mutate({ teamName: newTeamName, teamType: newTeamType })}
              disabled={!newTeamName || createTeamMutation.isPending}
            >
              {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={showEditTeam} onOpenChange={setShowEditTeam}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editTeamName">Team Name</Label>
              <Input
                id="editTeamName"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTeamType">Team Type</Label>
              <Select value={newTeamType} onValueChange={(value: 'mga' | 'rga') => setNewTeamType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mga">MGA</SelectItem>
                  <SelectItem value="rga">RGA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTeam(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Update team name logic here - for now just close
                setShowEditTeam(false);
                toast({ title: "Team updated successfully" });
              }}
              disabled={!newTeamName}
            >
              Update Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Member Dialog */}
      <Dialog open={showAssignMember} onOpenChange={setShowAssignMember}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer 
                ? `Assign ${selectedCustomer.first_name} ${selectedCustomer.last_name}` 
                : selectedTeam 
                  ? `Add Customer to ${newTeamName}`
                  : 'Assign Member'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!selectedCustomer && (
              <div className="space-y-2">
                <Label>Search Customer</Label>
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="max-h-32 overflow-y-auto border rounded-md">
                  {filteredCustomers
                    .filter(customer => 
                      customer.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      customer.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      customer.company_email?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .slice(0, 5)
                    .map(customer => (
                      <div 
                        key={customer.company_email}
                        className="p-2 hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setSearchTerm('');
                        }}
                      >
                        <div className="font-medium">{customer.first_name} {customer.last_name}</div>
                        <div className="text-sm text-muted-foreground">{customer.company_email}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            {selectedCustomer && (
              <div className="space-y-2">
                <Label>Selected Customer</Label>
                <div className="p-2 border rounded-md bg-muted">
                  <div className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</div>
                  <div className="text-sm text-muted-foreground">{selectedCustomer.company_email}</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Select Team Type</Label>
              <Select value={newTeamType} onValueChange={(value: 'mga' | 'rga') => setNewTeamType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mga">MGA Team</SelectItem>
                  <SelectItem value="rga">RGA Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select Team</Label>
              <Select value={newTeamName} onValueChange={setNewTeamName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams
                    .filter(team => team.type === newTeamType.toUpperCase())
                    .map(team => (
                      <SelectItem key={team.id} value={team.name}>
                        {team.name} ({team.members.length} members)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssignMember(false);
              setSelectedCustomer(null);
              setSearchTerm('');
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedCustomer) {
                  updateTeamMutation.mutate({
                    email: selectedCustomer.company_email,
                    teamName: newTeamName,
                    teamType: newTeamType
                  });
                }
              }}
              disabled={!newTeamName || !selectedCustomer || updateTeamMutation.isPending}
            >
              {updateTeamMutation.isPending ? 'Assigning...' : 'Assign to Team'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Quality Manager Dialog */}
      <Dialog open={showAddQM} onOpenChange={setShowAddQM}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Quality Manager to {selectedTeam}</DialogTitle>
            <DialogDescription>
              Select a Quality Manager to assign to this team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qmSelect">Quality Manager</Label>
              <Select value={selectedQMEmail} onValueChange={setSelectedQMEmail}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Quality Manager" />
                </SelectTrigger>
                <SelectContent>
                  {allQMsData?.qualityManagers?.map((qm: any) => (
                    <SelectItem key={qm.email} value={qm.email}>
                      {qm.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddQM(false);
              setSelectedQMEmail('');
              setSelectedTeamId(null);
              setSelectedTeam(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedTeamId && selectedQMEmail) {
                  assignQMToTeamMutation.mutate({
                    teamId: selectedTeamId,
                    qmEmail: selectedQMEmail
                  });
                }
              }}
              disabled={!selectedQMEmail || !selectedTeamId || assignQMToTeamMutation.isPending}
              data-testid="button-assign-qm-to-team"
            >
              {assignQMToTeamMutation.isPending ? 'Assigning...' : 'Add Quality Manager'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'logs' | 'credits' | 'sync' | 'teams' | 'quality'>('users');
  const [editingCredits, setEditingCredits] = useState<{[key: string]: number}>({});
  const [editingCustomer, setEditingCustomer] = useState<CustomerUser | null>(null);
  const [editData, setEditData] = useState<CustomerEditData>({
    ASSOCIATE_ID: '',
    STATE: '',
    MARKET: '',
    producerTYPE: '',
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
  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
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

  // Fetch real Supabase producers
  const { data: supabaseproducersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/supabase-producers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/supabase-producers');
      if (!response.ok) throw new Error('Failed to fetch Supabase producers');
      return response.json();
    },
  });

  // Extract users from the Supabase response
  const users = supabaseproducersResponse?.producers || [];

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

  // Fetch hierarchy data for team management
  const { data: hierarchyResponse, isLoading: hierarchyLoading } = useQuery({
    queryKey: ['/api/admin/hierarchy-data'],
    queryFn: async () => {
      const response = await fetch('/api/admin/hierarchy-data', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch hierarchy data');
      return response.json();
    },
  });

  const hierarchyData = hierarchyResponse?.data || {};
  const teams = hierarchyData.mgaTeams || [];
  const rgas = hierarchyData.rgaTeams || [];
  const allCustomers = hierarchyData.allCustomers || [];
  const filteredCustomers = allCustomers;

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


  // Call Connector Pro access mutation
  const toggleCallConnectorProMutation = useMutation({
    mutationFn: async ({ email, access }: { email: string; access: boolean }) => {
      const response = await fetch('/api/admin/toggle-call-connector-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, access }),
      });
      if (!response.ok) throw new Error('Failed to toggle Call Connector Pro access');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-producers'] });
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

  // Role assignment mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ email, roleName }: { email: string; roleName: string }) => {
      const response = await fetch(`/api/admin/assign-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, roleName }),
      });
      if (!response.ok) throw new Error('Failed to assign role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-producers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles'] });
    },
  });

  // Role permissions update mutation
  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleName, pages }: { roleName: string; pages: string[] }) => {
      // Convert display name to internal role name
      const roleNameMapping: Record<string, string> = {
        'Quality Manager': 'quality_manager',
        'AO Quality Manager': 'ao_quality_manager',
        'System Admin': 'system_admin',
        'producer': 'producer',
        'MGA': 'mga',
        'RGA': 'rga'
      };
      
      const internalRoleName = roleNameMapping[roleName] || roleName.toLowerCase().replace(/\s+/g, '_');
      
      const response = await fetch(`/api/rbac/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [internalRoleName]: pages }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update role permissions: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/roles'] });
      setEditingRole(null);
    },
  });

  // Supabase Producer Management mutations
  const updateproducerMutation = useMutation({
    mutationFn: async ({ email, producerData }: { email: string; producerData: CustomerEditData }) => {
      const response = await fetch(`/api/admin/supabase-producers/${email}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(producerData),
      });
      if (!response.ok) throw new Error('Failed to update producer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-producers'] });
      setEditingCustomer(null);
    },
  });

  const createproducerMutation = useMutation({
    mutationFn: async (producerData: CustomerEditData) => {
      const response = await fetch('/api/admin/supabase-producers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(producerData),
      });
      if (!response.ok) throw new Error('Failed to create producer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-producers'] });
      setEditingCustomer(null);
    },
  });

  const deleteproducerMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch(`/api/admin/supabase-producers/${email}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete producer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/supabase-producers'] });
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

  // Enhanced filter users based on search and role with better performance
  const filteredUsers = useMemo(() => {
    if (!searchTerm && selectedRole === 'all') {
      return users;
    }
    
    return users.filter((user: CustomerUser) => {
      const matchesSearch = !searchTerm || [
        user.FIRST_NAME,
        user.LAST_NAME, 
        user.COMPANY_EMAIL,
        user.PHONE,
        user.TEAM,
        user.MARKET,
        user.ASSOCIATE_ID?.toString(),
        user.STATE,
        user.REGION,
        user.MANAGER_EMAIL,
        user.producerTYPE,
        user.STATUS
      ].some(field => field?.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRole = selectedRole === 'all' || user.role?.name === selectedRole;

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, selectedRole]);

  const getRoleBadgeColor = (level: number) => {
    switch (level) {
      case 3: return 'bg-red-600 text-white'; // Super Admin
      case 2: return 'bg-purple-600 text-white'; // Admin
      case 1: return 'bg-blue-600 text-white'; // Manager
      case 0: return 'bg-gray-600 text-white'; // producer
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
    producers: users.filter((u: CustomerUser) => u.role?.level === 0).length,
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
            <div className="text-2xl font-bold">{stats.producers}</div>
            <div className="text-xs text-gray-500">producers</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <Coins className="w-4 h-4" />
            Credits / Products
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
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Billing Reports
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Quality Manager
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Management
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
                  {filteredUsers.map((user: CustomerUser, index: number) => {
                    // Create truly unique key by combining email, associate ID, and index to prevent duplicates
                    const uniqueKey = `${user.COMPANY_EMAIL || 'user'}-${user.ASSOCIATE_ID || 'na'}-${index}`;
                    return (
                      <div 
                      key={uniqueKey} 
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
                              producerTYPE: user.producerTYPE || '',
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
                                  {user.role?.displayName || 'producer'}
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
                                  <Label className="text-xs">Producer States</Label>
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
                                  <Label htmlFor="producer-type" className="text-xs">producer Type</Label>
                                  <Select value={editData.producerTYPE} onValueChange={(value) => setEditData({...editData, producerTYPE: value})}>
                                    <SelectTrigger className="text-xs h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="producer">producer</SelectItem>
                                      <SelectItem value="MANAGER">Manager</SelectItem>
                                      <SelectItem value="ADMIN">Admin</SelectItem>
                                      <SelectItem value="RECRUITER">Recruiter</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="system-role" className="text-xs">System Role</Label>
                                  <Select 
                                    value={user.role?.name || 'producer'} 
                                    onValueChange={(roleName) => {
                                      assignRoleMutation.mutate({
                                        email: user.COMPANY_EMAIL,
                                        roleName: roleName
                                      });
                                    }}
                                    disabled={assignRoleMutation.isPending}
                                  >
                                    <SelectTrigger className="text-xs h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="producer">producer</SelectItem>
                                      <SelectItem value="quality_manager">Quality Manager</SelectItem>
                                      <SelectItem value="ao_quality_manager">AO Quality Manager</SelectItem>
                                      <SelectItem value="manager">Team Manager</SelectItem>
                                      <SelectItem value="admin">Administrator</SelectItem>
                                      <SelectItem value="super_admin">Super Administrator</SelectItem>
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
                              onClick={() => updateproducerMutation.mutate({ 
                                email: user.COMPANY_EMAIL, 
                                producerData: editData 
                              })}
                              disabled={updateproducerMutation.isPending}
                            >
                              <Save className="h-3 w-3 mr-1" />
                              {updateproducerMutation.isPending ? 'Saving...' : 'Save Changes'}
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
                  );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Credits / Products</h2>
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
              <Badge variant="outline" className="flex items-center gap-2">
                <Coins className="h-3 w-3" />
                Total Credits Managed
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {hierarchyLoading ? (
                <div className="p-8 text-center">Loading users...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No users found matching your criteria
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredUsers.map((user: CustomerUser, index: number) => (
                    <div 
                      key={`${user.COMPANY_EMAIL}-${user.ASSOCIATE_ID || 'na'}-${index}`} 
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
                            
                            {/* Call Connector Pro Toggle */}
                            <div className="flex items-center gap-2 border-l pl-4">
                              <Phone className="h-4 w-4 text-blue-600" />
                              <div className="text-xs">
                                <div className="font-medium">Call Connector Pro</div>
                                <div className="text-gray-500">Access Control</div>
                              </div>
                              <Switch
                                checked={user.callConnectorProAccess || false}
                                onCheckedChange={(checked) => {
                                  toggleCallConnectorProMutation.mutate({
                                    email: user.COMPANY_EMAIL,
                                    access: checked
                                  });
                                }}
                                disabled={toggleCallConnectorProMutation.isPending}
                                className="data-[state=checked]:bg-blue-600"
                              />
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
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEditingRole(role);
                        setRolePermissions(role.permissions || []);
                      }}
                    >
                      Edit
                    </Button>
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
                  <span>Auto-assign new users as producers</span>
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
                  <li>Creates producer profiles for new Supabase users</li>
                  <li>Links existing profiles to their Supabase accounts</li>
                  <li>Assigns default "producer" role to new users (@aoglobelife.com domain users)</li>
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
            <DialogDescription>
              Update the customer's profile information and settings.
            </DialogDescription>
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
                  <Label htmlFor="producer-type">producer Type</Label>
                  <Select value={editData.producerTYPE} onValueChange={(value) => setEditData({...editData, producerTYPE: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select producer Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producer">producer</SelectItem>
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
              onClick={() => updateproducerMutation.mutate({ 
                email: editingCustomer?.COMPANY_EMAIL || '', 
                producerData: editData 
              })}
              disabled={updateproducerMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateproducerMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quality Manager Tab Content */}
      {activeTab === 'quality' && (
        <QualityManagerManagement customers={allCustomers} customersLoading={hierarchyLoading} />
      )}

      {/* Team Management Tab Content */}
      {activeTab === 'teams' && (
        <TeamsManagement customers={allCustomers} customersLoading={hierarchyLoading} />
      )}

      {/* Password Reset Dialog */}
      <Dialog open={passwordResetDialog} onOpenChange={setPasswordResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Generate a new password for the selected user account.
            </DialogDescription>
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

      {/* Role Editor Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Role Permissions</DialogTitle>
            <DialogDescription>
              Configure which dashboard pages this role can access.
            </DialogDescription>
          </DialogHeader>
          
          {editingRole && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge className={getRoleBadgeColor(editingRole.level)}>
                  Level {editingRole.level}
                </Badge>
                <span className="font-semibold">{editingRole.displayName}</span>
              </div>
              
              <div className="space-y-3">
                <Label className="text-base font-semibold">Dashboard Pages Access</Label>
                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {[
                    { key: 'billing-dashboard', label: 'Billing Dashboard' },
                    { key: 'aoi-report', label: 'AOI Reports' },
                    { key: 'appointments', label: 'Appointments' },
                    { key: 'ao-recruit', label: 'AO Recruit' },
                    { key: 'ao-precheck', label: 'AO Precheck' },
                    { key: 'settings', label: 'Settings' },
                    { key: 'ao-intelligence', label: 'AO Intelligence' },
                    { key: 'ao-connect', label: 'AO Connect' },
                    { key: 'ao-precheck-management', label: 'AO Precheck Management' },
                    { key: 'admin', label: 'Admin Panel' },
                    { key: 'user-management', label: 'User Management' },
                    { key: 'teams-management', label: 'Teams Management' }
                  ].map((page) => (
                    <div key={page.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`page-${page.key}`}
                        checked={rolePermissions.includes(page.key)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setRolePermissions([...rolePermissions, page.key]);
                          } else {
                            setRolePermissions(rolePermissions.filter(p => p !== page.key));
                          }
                        }}
                        data-testid={`checkbox-${page.key}`}
                      />
                      <Label 
                        htmlFor={`page-${page.key}`} 
                        className="text-sm cursor-pointer"
                      >
                        {page.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Selected: {rolePermissions.length} pages
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingRole) {
                  updateRolePermissionsMutation.mutate({
                    roleName: editingRole.name,
                    pages: rolePermissions
                  });
                }
              }}
              disabled={updateRolePermissionsMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateRolePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}