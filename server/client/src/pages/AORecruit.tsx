import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  MdPeople, 
  MdTrendingUp, 
  MdPhone,
  MdCalendarToday,
  MdWork,
  MdEmail,
  MdLocationOn,
  MdStar,
  MdSchedule,
  MdPersonAdd,
  MdBusinessCenter,
  MdAssignment,
  MdEdit,
  MdDelete,
  MdNotes,
  MdAdd
} from 'react-icons/md';
import { FiClock, FiUser, FiPhone } from 'react-icons/fi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import VDPStatus from '../components/connectnow/VDPStatus';
import VDPHeartbeat from '../components/connectnow/VDPHeartbeat';
import SchedulingModal from '../components/scheduling/SchedulingModal';
import { useAuth } from '@/hooks/use-auth';
import type { RecruitCandidate, InsertRecruitCandidate, UpdateRecruitCandidate } from '@shared/schema';

// Add/Edit Candidate Modal
function CandidateModal({ candidate, isOpen, onClose, onSave }: {
  candidate?: RecruitCandidate;
  isOpen: boolean;
  onClose: () => void;
  onSave: (candidate: InsertRecruitCandidate | UpdateRecruitCandidate, id?: number) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    zipCode: '',
    position: '',
    experience: '',
    status: 'new' as const,
    notes: '',
    appointmentDate: '',
    appointmentNotes: '',
  });

  useEffect(() => {
    if (candidate) {
      setFormData({
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        phone: candidate.phone,
        email: candidate.email,
        city: candidate.city || '',
        state: candidate.state || '',
        zipCode: candidate.zipCode || '',
        position: candidate.position || '',
        experience: candidate.experience || '',
        status: candidate.status,
        notes: candidate.notes || '',
        appointmentDate: candidate.appointmentDate ? new Date(candidate.appointmentDate).toISOString().slice(0, 16) : '',
        appointmentNotes: candidate.appointmentNotes || '',
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        city: '',
        state: '',
        zipCode: '',
        position: '',
        experience: '',
        status: 'new',
        notes: '',
        appointmentDate: '',
        appointmentNotes: '',
      });
    }
  }, [candidate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const candidateData = {
      ...formData,
      appointmentDate: formData.appointmentDate ? new Date(formData.appointmentDate) : undefined,
    };
    onSave(candidateData, candidate?.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
            {candidate ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="zipCode">Zip Code</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g. Sales Agent, Team Lead"
              />
            </div>
            <div>
              <Label htmlFor="experience">Experience</Label>
              <Input
                id="experience"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                placeholder="e.g. 5 years"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="interview">Interview</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="appointmentDate">Appointment Date & Time</Label>
            <Input
              id="appointmentDate"
              type="datetime-local"
              value={formData.appointmentDate}
              onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="appointmentNotes">Appointment Notes</Label>
            <Textarea
              id="appointmentNotes"
              value={formData.appointmentNotes}
              onChange={(e) => setFormData({ ...formData, appointmentNotes: e.target.value })}
              placeholder="Meeting details, interview questions, etc."
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about the candidate..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
              {candidate ? 'Update' : 'Create'} Candidate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



// Candidate Card Component
function CandidateCard({ candidate, onEdit, onDelete }: {
  candidate: RecruitCandidate;
  onEdit: (candidate: RecruitCandidate) => void;
  onDelete: (id: number) => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hired': return 'bg-green-100 text-green-800 border-green-300';
      case 'interview': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'contacted': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const initials = `${candidate.firstName.charAt(0)}${candidate.lastName.charAt(0)}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
              {initials}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{candidate.firstName} {candidate.lastName}</h3>
              <p className="text-xs text-muted-foreground">{candidate.position || 'No position specified'}</p>
            </div>
          </div>
          <Badge className={getStatusColor(candidate.status) + ' text-xs'}>
            {candidate.status}
          </Badge>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center space-x-2">
            <MdPhone className="w-3 h-3 text-muted-foreground" />
            <span>{candidate.phone}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MdEmail className="w-3 h-3 text-muted-foreground" />
            <span className="truncate">{candidate.email}</span>
          </div>
          {candidate.city && candidate.state && (
            <div className="flex items-center space-x-2">
              <MdLocationOn className="w-3 h-3 text-muted-foreground" />
              <span>{candidate.city}, {candidate.state}</span>
            </div>
          )}
          {candidate.experience && (
            <div className="flex items-center space-x-2">
              <MdWork className="w-3 h-3 text-muted-foreground" />
              <span>{candidate.experience} experience</span>
            </div>
          )}
          {candidate.appointmentDate && (
            <div className="flex items-center space-x-2">
              <MdCalendarToday className="w-3 h-3 text-muted-foreground" />
              <span>{new Date(candidate.appointmentDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {candidate.notes && (
          <div className="mt-3 p-2 bg-muted rounded text-xs">
            <div className="flex items-center space-x-1 mb-1">
              <MdNotes className="w-3 h-3" />
              <span className="font-medium">Notes:</span>
            </div>
            <p className="text-muted-foreground line-clamp-2">{candidate.notes}</p>
          </div>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(candidate)}
            className="h-7 px-2"
          >
            <MdEdit className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(candidate.id)}
            className="h-7 px-2 text-red-600 hover:text-red-700"
          >
            <MdDelete className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AORecruit() {
  console.log('🎯 AO Recruit page loaded');
  
  const [activeTab, setActiveTab] = useState<'candidates' | 'stats'>('candidates');
  const [selectedCandidate, setSelectedCandidate] = useState<RecruitCandidate | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get user email from auth context
  const { authState } = useAuth();
  const userEmail = authState.user?.email || "default@example.com";

  // Get all candidates
  const { data: candidatesData, isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['/api/recruit/candidates'],
    retry: false,
  });

  // Get recruit stats
  const { data: recruitStats } = useQuery({
    queryKey: ['/api/recruit/stats'],
    retry: false,
  });

  // Create candidate mutation
  const createCandidateMutation = useMutation({
    mutationFn: async (candidate: InsertRecruitCandidate) => {
      return await apiRequest('POST', '/api/recruit/candidates', candidate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/stats'] });
      toast({
        title: "Success",
        description: "Candidate created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create candidate",
        variant: "destructive",
      });
    },
  });

  // Update candidate mutation
  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateRecruitCandidate }) => {
      return await apiRequest('PATCH', `/api/recruit/candidates/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/stats'] });
      toast({
        title: "Success",
        description: "Candidate updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update candidate",
        variant: "destructive",
      });
    },
  });

  // Delete candidate mutation
  const deleteCandidateMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/recruit/candidates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/stats'] });
      toast({
        title: "Success",
        description: "Candidate deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete candidate",
        variant: "destructive",
      });
    },
  });

  const handleSaveCandidate = (candidateData: InsertRecruitCandidate | UpdateRecruitCandidate, id?: number) => {
    if (id) {
      updateCandidateMutation.mutate({ id, updates: candidateData as UpdateRecruitCandidate });
    } else {
      createCandidateMutation.mutate(candidateData as InsertRecruitCandidate);
    }
  };

  const handleEditCandidate = (candidate: RecruitCandidate) => {
    setSelectedCandidate(candidate);
    setIsModalOpen(true);
  };

  const handleDeleteCandidate = (id: number) => {
    if (confirm('Are you sure you want to delete this candidate?')) {
      deleteCandidateMutation.mutate(id);
    }
  };

  const handleAddCandidate = () => {
    setSelectedCandidate(undefined);
    setIsModalOpen(true);
  };

  const candidates = candidatesData?.candidates || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 rounded-full">
                <MdPeople className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">
                AO Recruit
              </h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Advanced recruitment and talent acquisition platform
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300">
              Live Status
            </Badge>
            <Button
              onClick={handleAddCandidate}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              <MdAdd className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <MdPeople className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{recruitStats?.stats?.totalCandidates || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Candidates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <MdTrendingUp className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{recruitStats?.stats?.interviewCandidates || 0}</p>
                  <p className="text-xs text-muted-foreground">Interviews</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <MdWork className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">{recruitStats?.stats?.hiredCandidates || 0}</p>
                  <p className="text-xs text-muted-foreground">Hired</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <MdSchedule className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{recruitStats?.stats?.upcomingAppointments || 0}</p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-320px)]">
          
          {/* Left Column - Navigation (2/12 columns) */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent font-bold">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => setActiveTab('candidates')}
                  variant={activeTab === 'candidates' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  size="sm"
                >
                  <MdPeople className="mr-2 h-4 w-4" />
                  Candidates
                </Button>
                
                <Button
                  onClick={() => setActiveTab('stats')}
                  variant={activeTab === 'stats' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  size="sm"
                >
                  <MdAssignment className="mr-2 h-4 w-4" />
                  Analytics
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Tab Content (7/12 columns) */}
          <div className="lg:col-span-7">
            <Card className="h-full">
              <CardContent className="p-6">

                {activeTab === 'candidates' ? (
                  <>
                    {isLoadingCandidates ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
                      </div>
                    ) : candidates.length === 0 ? (
                      <div className="py-12 text-center">
                        <MdPeople className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No candidates yet</h3>
                        <p className="text-muted-foreground mb-4">Start building your recruitment pipeline by adding your first candidate.</p>
                        <Button onClick={handleAddCandidate} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                          <MdAdd className="w-4 h-4 mr-2" />
                          Add First Candidate
                        </Button>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {candidates.map((candidate: RecruitCandidate) => (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onEdit={handleEditCandidate}
                            onDelete={handleDeleteCandidate}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="bg-gradient-to-r from-green-600 via-blue-600 to-green-700 bg-clip-text text-transparent">
                        Recruitment Analytics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-semibold mb-4">Status Breakdown</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">New</span>
                              <Badge className="bg-gray-100 text-gray-800">{recruitStats?.stats?.newCandidates || 0}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Contacted</span>
                              <Badge className="bg-orange-100 text-orange-800">{recruitStats?.stats?.contactedCandidates || 0}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Interview</span>
                              <Badge className="bg-blue-100 text-blue-800">{recruitStats?.stats?.interviewCandidates || 0}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Pending</span>
                              <Badge className="bg-yellow-100 text-yellow-800">{recruitStats?.stats?.pendingCandidates || 0}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Hired</span>
                              <Badge className="bg-green-100 text-green-800">{recruitStats?.stats?.hiredCandidates || 0}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Rejected</span>
                              <Badge className="bg-red-100 text-red-800">{recruitStats?.stats?.rejectedCandidates || 0}</Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-semibold mb-4">Pipeline & Performance</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span className="text-sm">Total Candidates</span>
                              <span className="font-medium">{recruitStats?.stats?.totalCandidates || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Active Interviews</span>
                              <span className="font-medium">{recruitStats?.stats?.interviewCandidates || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Upcoming Appointments</span>
                              <span className="font-medium">{recruitStats?.stats?.upcomingAppointments || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm">Successful Hires</span>
                              <span className="font-medium">{recruitStats?.stats?.hiredCandidates || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Interview Rate</span>
                              <div className="flex items-center space-x-2">
                                <Progress value={recruitStats?.stats?.totalCandidates ? (recruitStats.stats.interviewCandidates / recruitStats.stats.totalCandidates) * 100 : 0} className="w-16" />
                                <span className="text-sm font-medium">
                                  {recruitStats?.stats?.totalCandidates ? Math.round((recruitStats.stats.interviewCandidates / recruitStats.stats.totalCandidates) * 100) : 0}%
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Hire Rate</span>
                              <div className="flex items-center space-x-2">
                                <Progress value={recruitStats?.stats?.totalCandidates ? (recruitStats.stats.hiredCandidates / recruitStats.stats.totalCandidates) * 100 : 0} className="w-16" />
                                <span className="text-sm font-medium">
                                  {recruitStats?.stats?.totalCandidates ? Math.round((recruitStats.stats.hiredCandidates / recruitStats.stats.totalCandidates) * 100) : 0}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

              </CardContent>
            </Card>
          </div>

          {/* Right Column - VDP Sidebar (3/12 columns) */}
          <div className="lg:col-span-3">
            <VDPStatus 
              userEmail={userEmail} 
              context="recruit"
              title="AO Recruit VDP"
              description="Recruitment applicant flow management"
              cardClassName="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30"
              titleClassName="text-base bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent font-bold"
            />
          </div>
        </div>
      </div>

      {/* Add/Edit Candidate Modal */}
      <CandidateModal
        candidate={selectedCandidate}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCandidate}
      />
    </div>
  );
}

