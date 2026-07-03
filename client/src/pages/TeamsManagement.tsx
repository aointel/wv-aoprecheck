import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Edit, Trash2, Crown, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  managerName?: string;
  memberCount?: number;
}

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  teamId: string | null;
  roleId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface TeamStats {
  teamId: string;
  teamName: string;
  totalMembers: number;
  totalConnects: number;
  totalAppointments: number;
  totalSales: number;
  totalRevenue: number;
  weeklyConnects: number;
  averagePerformance: number;
}

export default function TeamsManagement() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch teams
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: () => apiRequest('GET', '/api/teams').then(res => res.json()),
  });

  // Fetch team members
  const { data: teamMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['/api/teams/members', selectedTeam],
    queryFn: () => apiRequest('GET', `/api/teams/${selectedTeam}/members`).then(res => res.json()),
    enabled: !!selectedTeam,
  });

  // Fetch team statistics
  const { data: teamStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['/api/teams/stats'],
    queryFn: () => apiRequest('GET', '/api/teams/stats').then(res => res.json()),
  });

  // Fetch all users for team assignment
  const { data: allUsers = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => apiRequest('GET', '/api/users').then(res => res.json()),
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: (teamData: { name: string; description?: string; managerId?: string }) =>
      apiRequest('POST', '/api/teams', teamData).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setIsCreateTeamOpen(false);
      toast({ title: 'Success', description: 'Team created successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create team', variant: 'destructive' });
    }
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: ({ id, ...teamData }: { id: string; name: string; description?: string; managerId?: string; isActive?: boolean }) =>
      apiRequest('PUT', `/api/teams/${id}`, teamData).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setIsEditTeamOpen(false);
      setEditingTeam(null);
      toast({ title: 'Success', description: 'Team updated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update team', variant: 'destructive' });
    }
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => apiRequest('DELETE', `/api/teams/${teamId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setSelectedTeam(null);
      toast({ title: 'Success', description: 'Team deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete team', variant: 'destructive' });
    }
  });

  // Assign member to team mutation
  const assignMemberMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      apiRequest('POST', `/api/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams/members', selectedTeam] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: 'Success', description: 'Member assigned to team' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to assign member', variant: 'destructive' });
    }
  });

  // Remove member from team mutation
  const removeMemberMutation = useMutation({
    mutationFn: ({ userId, teamId }: { userId: string; teamId: string }) =>
      apiRequest('DELETE', `/api/teams/${teamId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams/members', selectedTeam] });
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({ title: 'Success', description: 'Member removed from team' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove member', variant: 'destructive' });
    }
  });

  const CreateTeamDialog = () => {
    const [formData, setFormData] = useState({ name: '', description: '', managerId: '' });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      createTeamMutation.mutate({
        name: formData.name,
        description: formData.description || undefined,
        managerId: formData.managerId || undefined,
      });
    };

    return (
      <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="manager">Team Manager</Label>
              <Select value={formData.managerId} onValueChange={(value) => setFormData(prev => ({ ...prev, managerId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No manager</SelectItem>
                  {allUsers.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateTeamOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTeamMutation.isPending}>
                {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  const EditTeamDialog = () => {
    if (!editingTeam) return null;

    const [formData, setFormData] = useState({
      name: editingTeam.name,
      description: editingTeam.description || '',
      managerId: editingTeam.managerId || '',
      isActive: editingTeam.isActive,
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      updateTeamMutation.mutate({
        id: editingTeam.id,
        name: formData.name,
        description: formData.description || undefined,
        managerId: formData.managerId || undefined,
        isActive: formData.isActive,
      });
    };

    return (
      <Dialog open={isEditTeamOpen} onOpenChange={setIsEditTeamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Team Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-manager">Team Manager</Label>
              <Select value={formData.managerId} onValueChange={(value) => setFormData(prev => ({ ...prev, managerId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No manager</SelectItem>
                  {allUsers.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              />
              <Label htmlFor="edit-active">Active Team</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditTeamOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTeamMutation.isPending}>
                {updateTeamMutation.isPending ? 'Updating...' : 'Update Team'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  if (teamsLoading || statsLoading) {
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
            <p className="text-muted-foreground">Manage teams, members, and performance tracking</p>
          </div>
        </div>
        <Button onClick={() => setIsCreateTeamOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
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
                  {teams.filter((t: Team) => t.isActive).length} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teamStats.reduce((sum: number, team: TeamStats) => sum + team.totalMembers, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Across all teams</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Connects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {teamStats.reduce((sum: number, team: TeamStats) => sum + team.totalConnects, 0)}
                </div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${teamStats.reduce((sum: number, team: TeamStats) => sum + team.totalRevenue, 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">This month</p>
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
                    <TableHead>Team</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Connects</TableHead>
                    <TableHead>Appointments</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStats.map((team: TeamStats) => (
                    <TableRow key={team.teamId}>
                      <TableCell className="font-medium">{team.teamName}</TableCell>
                      <TableCell>{team.totalMembers}</TableCell>
                      <TableCell>{team.totalConnects}</TableCell>
                      <TableCell>{team.totalAppointments}</TableCell>
                      <TableCell>{team.totalSales}</TableCell>
                      <TableCell>${team.totalRevenue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Teams</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teams.map((team: Team) => (
                    <div
                      key={team.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTeam === team.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedTeam(team.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{team.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {team.memberCount || 0} members
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {team.isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTeam(team);
                                setIsEditTeamOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this team?')) {
                                  deleteTeamMutation.mutate(team.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {selectedTeam ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {membersLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">Members</h3>
                          <Select
                            onValueChange={(userId) => {
                              if (userId && selectedTeam) {
                                assignMemberMutation.mutate({ userId, teamId: selectedTeam });
                              }
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Add member..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allUsers
                                .filter((user: any) => !teamMembers.some((member: TeamMember) => member.id === user.id))
                                .map((user: any) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          {teamMembers.map((member: TeamMember) => (
                            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                  <Users className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="font-medium">
                                    {member.firstName && member.lastName 
                                      ? `${member.firstName} ${member.lastName}` 
                                      : member.email
                                    }
                                  </div>
                                  <div className="text-sm text-muted-foreground">{member.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {teams.find((t: Team) => t.id === selectedTeam)?.managerId === member.id && (
                                  <Badge variant="secondary">
                                    <Crown className="h-3 w-3 mr-1" />
                                    Manager
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (confirm('Remove this member from the team?')) {
                                      removeMemberMutation.mutate({ userId: member.id, teamId: selectedTeam! });
                                    }
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a team to view members</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamStats
              .sort((a: TeamStats, b: TeamStats) => b.totalConnects - a.totalConnects)
              .map((team: TeamStats, index: number) => (
                <Card key={team.teamId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{team.teamName}</CardTitle>
                      {index < 3 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">#{index + 1}</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Members</div>
                        <div className="font-semibold">{team.totalMembers}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Connects</div>
                        <div className="font-semibold">{team.totalConnects}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Appointments</div>
                        <div className="font-semibold">{team.totalAppointments}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sales</div>
                        <div className="font-semibold">{team.totalSales}</div>
                      </div>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="text-muted-foreground text-sm">Total Revenue</div>
                      <div className="text-lg font-bold text-green-600">
                        ${team.totalRevenue.toLocaleString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      <CreateTeamDialog />
      <EditTeamDialog />
    </div>
  );
}