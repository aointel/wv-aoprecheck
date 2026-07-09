import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Building2, Mail } from "lucide-react";

type Office = {
  id: number;
  name: string;
  region?: string;
  managerId?: number;
  createdAt: Date;
  updatedAt: Date;
};

type User = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  office?: string;
  associateId?: string;
};

const ROLES = [
  "SUPER_ADMIN",
  "ADMIN", 
  "QUALITY_MANAGER",
  "PARTNER",
  "RGA",
  "MGA", 
  "GA",
  "SA",
  "AGENT"
];

export default function HierarchyManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isOfficeDialogOpen, setIsOfficeDialogOpen] = useState(false);

  // Fetch offices
  const { data: offices = [], isLoading: officesLoading } = useQuery<Office[]>({
    queryKey: ["/api/offices"],
  });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Create office mutation
  const createOfficeMutation = useMutation({
    mutationFn: async (office: { name: string; region?: string }) => {
      const response = await fetch("/api/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(office),
      });
      if (!response.ok) throw new Error("Failed to create office");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/offices"] });
      setIsOfficeDialogOpen(false);
      toast({
        title: "Success",
        description: "Office created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: { 
      username: string;
      password: string;
      fullName: string;
      email: string; 
      role: string; 
      office: string; 
    }) => {
      const response = await fetch("/api/users/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error("Failed to create user");
      return response.json();
    },
    onSuccess: () => {
      setIsInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateOffice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const region = formData.get("region") as string;

    if (!name) return;

    createOfficeMutation.mutate({
      name,
      region: region || undefined,
    });
  };

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const office = formData.get("office") as string;

    if (!username || !password || !fullName || !email || !role || !office) return;

    createUserMutation.mutate({
      username,
      password,
      fullName,
      email,
      role,
      office,
    });
  };

  // Group users by office
  const usersByOffice = users.reduce((acc, user) => {
    const office = user.office || "Unassigned";
    if (!acc[office]) acc[office] = [];
    acc[office].push(user);
    return acc;
  }, {} as Record<string, User[]>);

  if (officesLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading hierarchy data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hierarchy Management</h1>
          <p className="text-muted-foreground">
            Manage offices, users, and access control
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isOfficeDialogOpen} onOpenChange={setIsOfficeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Building2 className="w-4 h-4 mr-2" />
                Add Office
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Office</DialogTitle>
                <DialogDescription>
                  Add a new office to the hierarchy system
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOffice} className="space-y-4">
                <div>
                  <Label htmlFor="name">Office Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter office name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="region">Region (Optional)</Label>
                  <Input
                    id="region"
                    name="region"
                    placeholder="Enter region"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={createOfficeMutation.isPending}
                  className="w-full"
                >
                  {createOfficeMutation.isPending ? "Creating..." : "Create Office"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Users className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with login credentials
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter password"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select name="role" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="office">Office Assignment</Label>
                  <Select name="office" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an office" />
                    </SelectTrigger>
                    <SelectContent>
                      {offices.map((office) => (
                        <SelectItem key={office.id} value={office.name}>
                          {office.name} {office.region && `(${office.region})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                  className="w-full"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Offices Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offices.map((office) => (
          <Card key={office.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {office.name}
              </CardTitle>
              {office.region && (
                <CardDescription>{office.region}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">
                  {usersByOffice[office.name]?.length || 0} users
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users by Office */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Users by Office</h2>
        {Object.entries(usersByOffice).map(([officeName, officeUsers]) => (
          <Card key={officeName}>
            <CardHeader>
              <CardTitle>{officeName}</CardTitle>
              <CardDescription>
                {officeUsers.length} user{officeUsers.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {officeUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{user.fullName}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.email}
                      </div>
                      {user.associateId && (
                        <div className="text-xs text-muted-foreground">
                          ID: {user.associateId}
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {user.role.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}