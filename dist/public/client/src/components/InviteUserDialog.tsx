import { useState } from "react";
import { X, Mail, UserPlus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Team, User, RoleType } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InviteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  teams: Team[];
}

export default function InviteUserDialog({ isOpen, onClose, currentUser, teams }: InviteUserDialogProps) {
  // Shared state
  const [activeTab, setActiveTab] = useState<string>("create");
  const [role, setRole] = useState<string | undefined>();
  const [teamId, setTeamId] = useState<number | undefined>();
  
  // Create user directly states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [associateId, setAssociateId] = useState("");
  
  // Invitation email state
  const [inviteEmail, setInviteEmail] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation for sending email invitations
  const inviteMutation = useMutation({
    mutationFn: (data: { inviterId: number; email: string; role: string; teamId: number }) => {
      return apiRequest("POST", "/api/invitations", data);
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      });
      resetForm();
      onClose();
      // Refresh the users list
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send invitation",
        description: error.message || "Please try again",
      });
    },
  });
  
  // Mutation for creating users directly
  const createUserMutation = useMutation({
    mutationFn: (data: { 
      fullName: string; 
      email: string; 
      username?: string;
      associateId?: string;
      role: string; 
      teamId: number;
      managerId?: number;
    }) => {
      return apiRequest("POST", "/api/users/direct", data);
    },
    onSuccess: (data) => {
      toast({
        title: "User created",
        description: `${fullName} has been added as a new ${role?.toLowerCase()} user`,
      });
      resetForm();
      onClose();
      // Refresh the users list
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create user",
        description: error.message || "Please try again",
      });
    },
  });

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setInviteEmail("");
    setUsername("");
    setAssociateId("");
    setRole(undefined);
    setTeamId(undefined);
  };

  // Handle invitation email submission
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteEmail || !role || !teamId) {
      toast({
        variant: "destructive",
        title: "Invalid form data",
        description: "Please fill in all fields",
      });
      return;
    }
    
    inviteMutation.mutate({
      inviterId: currentUser.id,
      email: inviteEmail,
      role,
      teamId
    });
  };
  
  // Handle direct user creation submission
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || !email || !role || !teamId) {
      toast({
        variant: "destructive",
        title: "Invalid form data",
        description: "Please fill in all required fields",
      });
      return;
    }
    
    // Create the user directly
    createUserMutation.mutate({
      fullName,
      email,
      username: username || undefined, // Only include if provided
      associateId: associateId || undefined, // Only include if provided
      role,
      teamId,
      managerId: currentUser.id // Set current user as manager
    });
  };

  // Filter teams to ensure they're valid
  const availableTeams = teams
    .filter(team => team && team.id && team.name) // Ensure team objects are valid
    .slice(0, 20); // Limit to prevent too many options

  // Get filtered list of roles based on user role
  const getFilteredRoles = () => {
    switch(currentUser.role) {
      case "SUPER_ADMIN":
        return ["SUPER_ADMIN", "ADMIN", "QUALITY_MANAGER", "PARTNER", "RGA", "MGA", "GA", "SA", "AGENT"];
      case "ADMIN":
        return ["ADMIN", "QUALITY_MANAGER", "PARTNER", "RGA", "MGA", "GA", "SA", "AGENT"];
      case "QUALITY_MANAGER":
        return ["QUALITY_MANAGER", "PARTNER", "RGA", "MGA", "GA", "SA", "AGENT"];
      case "PARTNER":
        return ["PARTNER", "RGA", "MGA", "GA", "SA", "AGENT"];
      case "RGA":
        return ["RGA", "MGA", "GA", "SA", "AGENT"];
      case "MGA":
        return ["MGA", "GA", "SA", "AGENT"];
      case "GA":
        return ["GA", "SA", "AGENT"];
      case "SA":
        return ["SA", "AGENT"];
      default:
        return ["AGENT"];
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add New Team Member</DialogTitle>
          <DialogDescription>
            Create a new user or send an invitation email
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="create" value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">
              <UserPlus className="mr-2 h-4 w-4" />
              Create User
            </TabsTrigger>
            <TabsTrigger value="invite">
              <Mail className="mr-2 h-4 w-4" />
              Send Invitation
            </TabsTrigger>
          </TabsList>
          
          {/* Create User Form */}
          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="username">Username (Optional)</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                />
                <p className="text-xs text-muted-foreground">
                  If not provided, email prefix will be used
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="associateId">Associate ID (Optional)</Label>
                <Input
                  id="associateId"
                  value={associateId}
                  onChange={(e) => setAssociateId(e.target.value)}
                  placeholder="Enter associate ID"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole} required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredRoles().includes("AGENT") && <SelectItem value="AGENT">Agent</SelectItem>}
                    {getFilteredRoles().includes("SA") && <SelectItem value="SA">Sub Agent</SelectItem>}
                    {getFilteredRoles().includes("GA") && <SelectItem value="GA">General Agent</SelectItem>}
                    {getFilteredRoles().includes("MGA") && <SelectItem value="MGA">Marketing General Agent</SelectItem>}
                    {getFilteredRoles().includes("RGA") && <SelectItem value="RGA">Regional General Agent</SelectItem>}
                    {getFilteredRoles().includes("PARTNER") && <SelectItem value="PARTNER">Partner</SelectItem>}
                    {getFilteredRoles().includes("QUALITY_MANAGER") && <SelectItem value="QUALITY_MANAGER">Quality Manager</SelectItem>}
                    {getFilteredRoles().includes("ADMIN") && <SelectItem value="ADMIN">Admin</SelectItem>}
                    {getFilteredRoles().includes("SUPER_ADMIN") && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="team">Team</Label>
                <Select 
                  value={teamId?.toString()} 
                  onValueChange={(value) => setTeamId(parseInt(value))}
                  required
                >
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name || `Team ${team.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-4 flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </TabsContent>
          
          {/* Send Invitation Form */}
          <TabsContent value="invite" className="mt-4">
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="inviteRole">Role</Label>
                <Select value={role} onValueChange={setRole} required>
                  <SelectTrigger id="inviteRole">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredRoles().includes("AGENT") && <SelectItem value="AGENT">Agent</SelectItem>}
                    {getFilteredRoles().includes("SA") && <SelectItem value="SA">Sub Agent</SelectItem>}
                    {getFilteredRoles().includes("GA") && <SelectItem value="GA">General Agent</SelectItem>}
                    {getFilteredRoles().includes("MGA") && <SelectItem value="MGA">Marketing General Agent</SelectItem>}
                    {getFilteredRoles().includes("RGA") && <SelectItem value="RGA">Regional General Agent</SelectItem>}
                    {getFilteredRoles().includes("PARTNER") && <SelectItem value="PARTNER">Partner</SelectItem>}
                    {getFilteredRoles().includes("QUALITY_MANAGER") && <SelectItem value="QUALITY_MANAGER">Quality Manager</SelectItem>}
                    {getFilteredRoles().includes("ADMIN") && <SelectItem value="ADMIN">Admin</SelectItem>}
                    {getFilteredRoles().includes("SUPER_ADMIN") && <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="inviteTeam">Team</Label>
                <Select 
                  value={teamId?.toString()} 
                  onValueChange={(value) => setTeamId(parseInt(value))}
                  required
                >
                  <SelectTrigger id="inviteTeam">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name || `Team ${team.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="pt-4 flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={inviteMutation.isPending}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}