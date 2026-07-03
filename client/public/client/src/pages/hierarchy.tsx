import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Team, Role } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ChevronRight, 
  Users, 
  UserPlus, 
  Trash2, 
  Edit, 
  Plus, 
  Save, 
  X, 
  RefreshCw,
  Mail
} from "lucide-react";
import InviteUserDialog from "@/components/InviteUserDialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function Hierarchy() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("teams");
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isInvitingUser, setIsInvitingUser] = useState(false);
  
  // Direct user creation state
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: "",
    parentTeamId: null as number | null,
    managerId: null as number | null
  });
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    associateId: "",
    role: "AGENT" as Role,
    teamId: null as number | null,
    managerId: null as number | null
  });
  
  // Debug current state
  useEffect(() => {
    console.log("Current userForm state:", userForm);
  }, [userForm]);

  // Fetch teams and users data
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.statusText}`);
      }
      return await response.json();
    }
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }
      return await response.json();
    }
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (newTeam: Partial<Team>) => {
      return await apiRequest<Team>('/api/teams', {
        method: 'POST',
        body: JSON.stringify(newTeam),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setIsAddingTeam(false);
      setTeamForm({
        name: "",
        parentTeamId: null,
        managerId: null
      });
      toast({
        title: "Team created",
        description: "The team has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Team> }) => {
      return await apiRequest<Team>(`/api/teams/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setEditingTeam(null);
      toast({
        title: "Team updated",
        description: "The team has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update team. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<void>(`/api/teams/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({
        title: "Team deleted",
        description: "The team has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete team. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (newUser: Partial<User>) => {
      console.log("Creating user with data:", newUser);
      
      // Ensure the data matches exactly what the API expects
      const userPayload = {
        username: newUser.username || undefined,
        fullName: newUser.fullName,
        email: newUser.email,
        password: newUser.password,
        associateId: newUser.associateId,
        role: newUser.role,
        teamId: newUser.teamId === null ? null : newUser.teamId,
        managerId: newUser.managerId === null ? null : newUser.managerId
      };
      
      console.log("Submitting payload:", userPayload);
      
      // Use fetch directly for more control over the request
      const response = await fetch('/api/users/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userPayload)
      });
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Failed to create user: ${response.statusText}. ${errorText}`);
      }
      
      const data = await response.json();
      console.log("User creation response:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsAddingUser(false);
      setUserForm({
        username: "",
        password: "",
        fullName: "",
        email: "",
        associateId: "",
        role: "AGENT",
        teamId: null,
        managerId: null
      });
      toast({
        title: "User created",
        description: "The user has been successfully created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create user. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<User> }) => {
      return await apiRequest<User>(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditingUser(null);
      toast({
        title: "User updated",
        description: "The user has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest<void>(`/api/users/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "User deleted",
        description: "The user has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handle team form submission
  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    createTeamMutation.mutate(teamForm);
  };

  // Handle team update
  const handleUpdateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTeam) {
      const updateData = {
        name: teamForm.name,
        parentTeamId: teamForm.parentTeamId,
        managerId: teamForm.managerId
      };
      updateTeamMutation.mutate({ id: editingTeam.id, data: updateData });
    }
  };

  // Handle user form submission
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting user form:", userForm);
    
    // Make sure password is set
    if (!userForm.password || userForm.password.trim() === '') {
      toast({
        title: "Error",
        description: "Password is required",
        variant: "destructive",
      });
      return;
    }
    
    createUserMutation.mutate(userForm);
  };

  // Handle user update
  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updateData = {
        fullName: userForm.fullName,
        email: userForm.email,
        associateId: userForm.associateId,
        role: userForm.role,
        teamId: userForm.teamId,
        managerId: userForm.managerId
      };
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    }
  };

  // Start editing a team
  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      parentTeamId: team.parentTeamId,
      managerId: team.managerId,
    });
  };

  // Start editing a user
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      password: "",  // Don't set the password
      fullName: user.fullName,
      email: user.email,
      associateId: user.associateId || "",
      role: user.role as Role,
      teamId: user.teamId,
      managerId: user.managerId,
    });
  };

  // Helper function to find team name by ID
  const getTeamName = (teamId: number | null) => {
    if (!teamId) return "None";
    const team = teams.find((t: Team) => t.id === teamId);
    return team ? team.name : "Unknown";
  };

  // Helper function to find user name by ID
  const getUserName = (userId: number | null) => {
    if (!userId) return "None";
    const user = users.find((u: User) => u.id === userId);
    return user ? user.fullName : "Unknown";
  };

  // Helper function to get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-red-500";
      case "ADMIN":
        return "bg-orange-500";
      case "QUALITY_MANAGER":
        return "bg-yellow-500";
      case "RGA":
        return "bg-green-500";
      case "MGA":
        return "bg-teal-500";
      case "GA":
        return "bg-blue-500";
      case "SA":
        return "bg-indigo-500";
      case "AGENT":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Hierarchy Management</h1>
      
      <Tabs defaultValue="teams" onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="teams">Teams Management</TabsTrigger>
          <TabsTrigger value="users">Users Management</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy Visualization</TabsTrigger>
        </TabsList>
        
        {/* Teams Management Tab */}
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Teams</CardTitle>
                  <CardDescription>Manage your organization's teams and hierarchy</CardDescription>
                </div>
                <Button onClick={() => setIsAddingTeam(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Team
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTeams ? (
                <div className="flex justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableCaption>List of all teams in the organization</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent Team</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((team: Team) => (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium">{team.name}</TableCell>
                        <TableCell>{getTeamName(team.parentTeamId)}</TableCell>
                        <TableCell>{getUserName(team.managerId)}</TableCell>
                        <TableCell>{new Date(team.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditTeam(team)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this team?")) {
                                  deleteTeamMutation.mutate(team.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add Team Dialog */}
          <Dialog open={isAddingTeam} onOpenChange={setIsAddingTeam}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
                <DialogDescription>
                  Create a new team and assign it to the organizational hierarchy
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTeam}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Team Name</Label>
                    <Input 
                      id="name" 
                      value={teamForm.name} 
                      onChange={e => setTeamForm({...teamForm, name: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="parentTeam">Parent Team</Label>
                    <Select 
                      value={teamForm.parentTeamId?.toString() || ""} 
                      onValueChange={value => setTeamForm({
                        ...teamForm, 
                        parentTeamId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent team (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {teams.map((team: Team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="manager">Team Manager</Label>
                    <Select 
                      value={teamForm.managerId?.toString() || ""} 
                      onValueChange={value => setTeamForm({
                        ...teamForm, 
                        managerId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {users.map((user: User) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createTeamMutation.isPending}>
                    {createTeamMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Create Team
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Team Dialog */}
          <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Team</DialogTitle>
                <DialogDescription>
                  Update team information and hierarchy
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateTeam}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Team Name</Label>
                    <Input 
                      id="name" 
                      value={teamForm.name} 
                      onChange={e => setTeamForm({...teamForm, name: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="parentTeam">Parent Team</Label>
                    <Select 
                      value={teamForm.parentTeamId?.toString() || ""} 
                      onValueChange={value => setTeamForm({
                        ...teamForm, 
                        parentTeamId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent team (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {teams
                          .filter((team: Team) => editingTeam && team.id !== editingTeam.id)
                          .map((team: Team) => (
                            <SelectItem key={team.id} value={team.id.toString()}>
                              {team.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="manager">Team Manager</Label>
                    <Select 
                      value={teamForm.managerId?.toString() || ""} 
                      onValueChange={value => setTeamForm({
                        ...teamForm, 
                        managerId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {users.map((user: User) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateTeamMutation.isPending}>
                    {updateTeamMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Update Team
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
        
        {/* Users Management Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage users and their roles in the organization</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant={isCreatingUser ? "default" : "outline"}
                    onClick={() => {
                      setIsCreatingUser(!isCreatingUser);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {isCreatingUser ? "Cancel" : "Quick Add User"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // Use first user as current user for demo (normally would be logged in user)
                      if (users.length > 0) {
                        setCurrentUser(users[0]);
                        setIsInvitingUser(true);
                      } else {
                        toast({
                          title: "Error",
                          description: "You need at least one user to send invitations",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Invite User
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Quick user creation form */}
              {isCreatingUser && (
                <div className="mb-8 p-4 border rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Quick Add User</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label htmlFor="quickName">Full Name</Label>
                      <Input 
                        id="quickName"
                        placeholder="Full Name" 
                        value={userForm.fullName}
                        onChange={e => setUserForm({...userForm, fullName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quickUsername">Username (Optional)</Label>
                      <Input 
                        id="quickUsername"
                        placeholder="Username" 
                        value={userForm.username}
                        onChange={e => setUserForm({...userForm, username: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">
                        If left blank, will be auto-generated from email
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="quickEmail">Email</Label>
                      <Input 
                        id="quickEmail"
                        placeholder="Email" 
                        type="email"
                        value={userForm.email}
                        onChange={e => setUserForm({...userForm, email: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <Label htmlFor="quickAssociateId">Associate ID</Label>
                      <Input 
                        id="quickAssociateId"
                        placeholder="Associate ID" 
                        value={userForm.associateId}
                        onChange={e => setUserForm({...userForm, associateId: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <Label htmlFor="quickPassword">Password</Label>
                      <Input 
                        id="quickPassword"
                        placeholder="Password" 
                        type="password"
                        value={userForm.password}
                        onChange={e => setUserForm({...userForm, password: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 mb-4">
                    <Label htmlFor="quickRole">Role</Label>
                    <select 
                      id="quickRole"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value as Role})}
                    >
                      <option value="PARTNER">Partner</option>
                      <option value="RGA">Regional General Agent (RGA)</option>
                      <option value="MGA">Marketing General Agent (MGA)</option>
                      <option value="GA">General Agent (GA)</option>
                      <option value="SA">Sub Agent (SA)</option>
                      <option value="AGENT">Agent</option>
                      <option value="QUALITY_MANAGER">AO Quality Manager</option>
                    </select>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreatingUser(false);
                        setUserForm({
                          username: "",
                          password: "",
                          fullName: "",
                          email: "",
                          associateId: "",
                          role: "AGENT",
                          teamId: null,
                          managerId: null
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        if (!userForm.fullName || !userForm.email || !userForm.password) {
                          toast({
                            title: "Missing fields",
                            description: "Please fill in all required fields",
                            variant: "destructive"
                          });
                          return;
                        }
                        
                        // Use first team by default if not selected
                        const teamId = userForm.teamId || (teams.length > 0 ? teams[0].id : null);
                        
                        console.log("Creating user with data:", {
                          ...userForm, 
                          teamId
                        });
                        
                        // Use the direct user creation endpoint
                        createUserMutation.mutate({
                          ...userForm,
                          teamId
                        });
                      }}
                      disabled={createUserMutation.isPending}
                    >
                      {createUserMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                      Create User
                    </Button>
                  </div>
                </div>
              )}
            
              {isLoadingUsers ? (
                <div className="flex justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableCaption>List of all users in the organization</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Associate ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.associateId || "-"}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{getTeamName(user.teamId)}</TableCell>
                        <TableCell>{getUserName(user.managerId)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this user?")) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add User Dialog */}
          <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user and assign their role and team
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input 
                      id="fullName" 
                      value={userForm.fullName} 
                      onChange={e => setUserForm({...userForm, fullName: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      value={userForm.username} 
                      onChange={e => setUserForm({...userForm, username: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={userForm.email} 
                      onChange={e => setUserForm({...userForm, email: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="associateId">Associate ID</Label>
                    <Input 
                      id="associateId" 
                      value={userForm.associateId} 
                      onChange={e => setUserForm({...userForm, associateId: e.target.value})} 
                      placeholder="Unique identifier for the agent"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password"
                      value={userForm.password} 
                      onChange={e => setUserForm({...userForm, password: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={userForm.role} 
                      onValueChange={value => setUserForm({
                        ...userForm, 
                        role: value as Role
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="QUALITY_MANAGER">Quality Manager</SelectItem>
                        <SelectItem value="RGA">Regional General Agent (RGA)</SelectItem>
                        <SelectItem value="MGA">Marketing General Agent (MGA)</SelectItem>
                        <SelectItem value="GA">General Agent (GA)</SelectItem>
                        <SelectItem value="SA">Sub Agent (SA)</SelectItem>
                        <SelectItem value="AGENT">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="team">Team</Label>
                    <Select 
                      value={userForm.teamId?.toString() || ""} 
                      onValueChange={value => setUserForm({
                        ...userForm, 
                        teamId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {teams.map((team: Team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="manager">Manager</Label>
                    <Select 
                      value={userForm.managerId?.toString() || ""} 
                      onValueChange={value => setUserForm({
                        ...userForm, 
                        managerId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {users.map((user: User) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit User Dialog */}
          <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>
                  Update user information, role and team assignment
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateUser}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input 
                      id="fullName" 
                      value={userForm.fullName} 
                      onChange={e => setUserForm({...userForm, fullName: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      value={userForm.username} 
                      onChange={e => setUserForm({...userForm, username: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={userForm.email} 
                      onChange={e => setUserForm({...userForm, email: e.target.value})} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editAssociateId">Associate ID</Label>
                    <Input 
                      id="editAssociateId" 
                      value={userForm.associateId} 
                      onChange={e => setUserForm({...userForm, associateId: e.target.value})} 
                      placeholder="Unique identifier for the agent"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={userForm.role} 
                      onValueChange={value => setUserForm({
                        ...userForm, 
                        role: value as Role
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="QUALITY_MANAGER">Quality Manager</SelectItem>
                        <SelectItem value="RGA">Regional General Agent (RGA)</SelectItem>
                        <SelectItem value="MGA">Marketing General Agent (MGA)</SelectItem>
                        <SelectItem value="GA">General Agent (GA)</SelectItem>
                        <SelectItem value="SA">Sub Agent (SA)</SelectItem>
                        <SelectItem value="AGENT">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="team">Team</Label>
                    <Select 
                      value={userForm.teamId?.toString() || ""} 
                      onValueChange={value => setUserForm({
                        ...userForm, 
                        teamId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {teams.map((team: Team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="manager">Manager</Label>
                    <Select 
                      value={userForm.managerId?.toString() || ""} 
                      onValueChange={value => setUserForm({
                        ...userForm, 
                        managerId: value ? parseInt(value) : null
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select manager (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {users
                          .filter((user: User) => editingUser && user.id !== editingUser.id)
                          .map((user: User) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateUserMutation.isPending}>
                    {updateUserMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Update User
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
        
        {/* Hierarchy Visualization Tab */}
        <TabsContent value="hierarchy">
          <Card>
            <CardHeader>
              <CardTitle>Organizational Hierarchy</CardTitle>
              <CardDescription>Visualize your team structure and reporting lines</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTeams || isLoadingUsers ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-4">
                  <HierarchyTree teams={teams} users={users} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Invite User Dialog */}
      {currentUser && (
        <InviteUserDialog
          isOpen={isInvitingUser}
          onClose={() => setIsInvitingUser(false)}
          currentUser={currentUser}
          teams={teams}
        />
      )}
    </div>
  );
}

// Recursive component to render the hierarchical tree
function HierarchyTree({ teams, users }: { teams: Team[], users: User[] }) {
  // Find root teams (teams without parent)
  const rootTeams = teams.filter(team => !team.parentTeamId);
  
  if (rootTeams.length === 0) {
    return (
      <div className="text-center p-8 bg-muted rounded-lg">
        <h3 className="font-medium text-lg mb-2">No teams configured</h3>
        <p className="text-muted-foreground">Add teams to visualize your organization's hierarchy</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {rootTeams.map(team => (
        <TeamNode key={team.id} team={team} teams={teams} users={users} level={0} />
      ))}
    </div>
  );
}

// Component to render a team node in the hierarchy
function TeamNode({ team, teams, users, level }: { team: Team, teams: Team[], users: User[], level: number }) {
  const [expanded, setExpanded] = useState(true);
  
  // Find child teams
  const childTeams = teams.filter(t => t.parentTeamId === team.id);
  
  // Find team members
  const teamMembers = users.filter(user => user.teamId === team.id);
  
  // Find team manager
  const manager = users.find(user => user.id === team.managerId);
  
  return (
    <div className={`ml-${level * 4}`}>
      <div 
        className="flex items-center p-3 bg-accent rounded-lg mb-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`mr-2 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          <ChevronRight className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-lg">{team.name}</h3>
          {manager && (
            <p className="text-sm text-muted-foreground">
              Manager: {manager.fullName} 
              <Badge className="ml-2 bg-blue-500">{manager.role}</Badge>
            </p>
          )}
        </div>
        <Badge className="ml-2 bg-primary">
          <Users className="h-3 w-3 mr-1" />
          {teamMembers.length}
        </Badge>
      </div>
      
      {expanded && (
        <div className="pl-6 border-l-2 border-dashed border-muted-foreground ml-3 mt-2 mb-4">
          {/* Show team members */}
          {teamMembers.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Team Members</h4>
              <div className="space-y-2">
                {teamMembers.map(member => (
                  <div key={member.id} className="p-2 bg-background rounded border flex items-center">
                    <div className="flex-1">
                      <p className="font-medium">{member.fullName}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      {member.associateId && (
                        <p className="text-xs text-muted-foreground">ID: {member.associateId}</p>
                      )}
                    </div>
                    <Badge className={`ml-2 ${
                      member.role === 'SUPER_ADMIN' ? 'bg-red-500' :
                      member.role === 'ADMIN' ? 'bg-orange-500' :
                      member.role === 'QUALITY_MANAGER' ? 'bg-yellow-500' :
                      member.role === 'PARTNER' ? 'bg-emerald-500' :
                      member.role === 'RGA' ? 'bg-green-500' :
                      member.role === 'MGA' ? 'bg-teal-500' :
                      member.role === 'GA' ? 'bg-blue-500' :
                      member.role === 'SA' ? 'bg-indigo-500' :
                      'bg-purple-500'
                    }`}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Show child teams */}
          {childTeams.map(childTeam => (
            <TeamNode 
              key={childTeam.id} 
              team={childTeam} 
              teams={teams} 
              users={users} 
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}