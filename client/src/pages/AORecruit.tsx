import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import VDPStatus from '../components/connectnow/VDPStatus';
import VDPHeartbeat from '../components/connectnow/VDPHeartbeat';
import SchedulingModal from '../components/scheduling/SchedulingModal';
import { useAuth } from '@/hooks/use-auth';
import { ExamFXPanel } from '../components/recruit/ExamFXPanel';
import RecruitDialer from '../components/recruit/RecruitDialer';
import { RecruitOutboundDialerInterface } from '../components/outbound-dialer/RecruitOutboundDialerInterface';
import { RecruitInboundConnectPanel } from '../components/recruit/RecruitInboundConnectPanel';
import { VirtualOverviewProgress } from '../components/recruit/VirtualOverviewProgress';
import { HorizontalJourneyTracker } from '../components/recruit/HorizontalJourneyTracker';
import { StageProgressTracker } from '../components/recruit/StageProgressTracker';
import type { RecruitCandidate, InsertRecruitCandidate, UpdateRecruitCandidate } from '@shared/schema';
import { PricingHoverCard } from '@/components/pricing/PricingHoverCard';
import { DemoCertificationModal } from '@/components/connectnow/DemoCertificationModal';
import { useDemo } from '@/contexts/DemoContext';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Bot, Search, Filter, Settings, GripVertical, Users, Phone, Calendar, Briefcase, Mail, MapPin, Star, Clock, UserPlus, ClipboardList, Pencil, Trash2, FileText, Plus, CheckCircle2, Paperclip, MessageCircle, Video, MessageSquare, TrendingUp, User, Check, X, LayoutGrid, BarChart2, AlertTriangle } from 'lucide-react';
import { SMSMessengerModal } from '../components/recruit/SMSMessengerModal';
import { AppointmentScheduleModal } from '../components/recruit/AppointmentScheduleModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Draggable Candidate Card Component
function DraggableCandidateCard({
  candidate,
  onDelete,
}: {
  candidate: RecruitCandidate;
  onDelete: (candidateId: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: candidate.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isNewCandidate = candidate.createdAt && (Date.now() - new Date(candidate.createdAt).getTime() < 2 * 60 * 1000);
  const updatedAt = (candidate.updatedAt || candidate.createdAt) ? new Date((candidate.updatedAt || candidate.createdAt) as any).toLocaleString() : 'No timestamp';
  const candidateState = String((candidate as any).state || '').trim() || '—';

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 border hover:border-purple-200 transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-lg' : isNewCandidate ? 'border-green-500 border-2 bg-green-50 animate-pulse' : 'border-gray-100'
      }`}
    >
      <div className="space-y-1.5">
        <h4 className="font-medium text-sm truncate">
          {candidate.firstName} {candidate.lastName}
        </h4>
        <p className="text-xs text-muted-foreground truncate">{candidate.phone || 'No phone'}</p>
        <p className="text-xs text-muted-foreground">State: {candidateState}</p>
        <p className="text-xs text-muted-foreground">Last updated: {updatedAt}</p>
      </div>
      <div className="pt-2 mt-2 border-t border-gray-200 flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(candidate.id);
          }}
          className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Remove candidate"
        >
          X
        </Button>
      </div>
    </Card>
  );
}

// Droppable Pipeline Stage Component
function DroppableStage({ 
  id, 
  title, 
  candidates, 
  onDelete,
  stageClass,
  selectedCandidate
}: { 
  id: string;
  title: string; 
  candidates: RecruitCandidate[];
  onDelete: (candidateId: number) => void;
  stageClass: string;
  selectedCandidate?: RecruitCandidate;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  // Check if this stage contains the selected candidate
  const isSelectedStage = selectedCandidate && selectedCandidate.currentStageId?.toString() === id;

  const style = {
    opacity: isOver ? 0.8 : 1,
    backgroundColor: isOver ? 'rgba(99, 102, 241, 0.1)' : undefined,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`${stageClass} p-4 rounded-lg min-h-[400px] transition-all duration-200 ${
        isOver ? 'ring-2 ring-indigo-400 ring-opacity-50' : ''
      } ${
        isSelectedStage ? 'ring-4 ring-purple-500 ring-offset-2 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="outline" className="text-xs">
          {candidates.length}
        </Badge>
      </div>
      <SortableContext items={candidates.map(c => c.id.toString())} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {candidates.map((candidate) => (
            <DraggableCandidateCard 
              key={candidate.id} 
              candidate={candidate} 
              onDelete={onDelete}
            />
          ))}
          {candidates.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <div className="w-8 h-8 mx-auto mb-2 opacity-50 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs">📋</span>
              </div>
              <p className="text-xs">Drop candidates here</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Candidate Detail Sheet - Comprehensive view with Notes, Tasks, Interviews, Files
function CandidateDetailSheet({ candidate, isOpen, onClose, userEmail }: {
  candidate: RecruitCandidate | null;
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [newNote, setNewNote] = useState('');
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', priority: 'medium' });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!candidate) return null;

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await apiRequest('POST', `/api/recruit/candidates/${candidate.id}/notes`, { content: newNote });
      setNewNote('');
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      toast({ title: 'Note added successfully' });
    } catch (error) {
      toast({ title: 'Failed to add note', variant: 'destructive' });
    }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      await apiRequest('POST', `/api/recruit/candidates/${candidate.id}/tasks`, newTask);
      setNewTask({ title: '', dueDate: '', priority: 'medium' });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      toast({ title: 'Task added successfully' });
    } catch (error) {
      toast({ title: 'Failed to add task', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            {candidate.firstName} {candidate.lastName}
          </SheetTitle>
          <SheetDescription>
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4" />
                {candidate.email}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4" />
                {candidate.phone}
              </div>
              {candidate.city && candidate.state && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4" />
                  {candidate.city}, {candidate.state}
                </div>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="interviews">Interviews</TabsTrigger>
            <TabsTrigger value="examfx">ExamFX</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Candidate Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Position</Label>
                    <p className="font-medium">{candidate.position || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Experience</Label>
                    <p className="font-medium">{candidate.experience || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge className="mt-1">{candidate.status}</Badge>
                  </div>
                  {candidate.appointmentDate && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Next Appointment</Label>
                      <p className="font-medium">{new Date(candidate.appointmentDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                {candidate.notes && (
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <p className="text-sm mt-1">{candidate.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Add Note
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Add a note about this candidate..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <Button onClick={addNote} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>
            <div className="text-center text-muted-foreground text-sm py-4">
              No notes yet — add the first one above.
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Add Task
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  />
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addTask} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </CardContent>
            </Card>
            <div className="text-center text-muted-foreground text-sm py-4">
              No tasks yet — create one above.
            </div>
          </TabsContent>

          <TabsContent value="interviews" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Schedule Interview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center py-8 text-muted-foreground">
                  <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Interview scheduling will be available here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="examfx" className="mt-4">
            <ExamFXPanel candidate={candidate} userEmail={userEmail} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

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
    e.stopPropagation();  // Prevent event bubbling
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
                placeholder="e.g. Sales producer, Team Lead"
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

// Helper function to parse AI summary
function parseAISummary(aiSummary: any): { label: string; content: string; color: string }[] {
  if (!aiSummary) return [];
  
  const summaryText = typeof aiSummary === 'string' ? aiSummary : String(aiSummary || '');
  if (!summaryText || !summaryText.trim()) return [];
  
  let parsedSections: { label: string; content: string; color: string }[] = [];
  
  try {
    const trimmedSummary = summaryText.trim();
    
    if (trimmedSummary.startsWith('[') || trimmedSummary.startsWith('{')) {
      const jsonData = JSON.parse(trimmedSummary);
      
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        jsonData.forEach((item: any) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            if ('key' in item && 'value' in item) {
              const label = String(item.key || '').trim();
              const content = String(item.value || '').trim();
              
              if (label && content) {
                let color = 'purple';
                const labelLower = label.toLowerCase();
                if (labelLower.includes('recap') || labelLower.includes('summary of key topics')) color = 'blue';
                else if (labelLower.includes('next steps') || labelLower.includes('steps')) color = 'green';
                else if (labelLower.includes('background') || labelLower.includes('goals')) color = 'yellow';
                else if (labelLower.includes('screening') || labelLower.includes('status')) color = 'indigo';
                else if (labelLower.includes('sentiment') || labelLower.includes('rate')) color = 'pink';
                else if (labelLower.includes('topics')) color = 'blue';
                
                parsedSections.push({ label, content, color });
              }
            } else {
              Object.entries(item).forEach(([key, value]) => {
                if (key !== 'key' && key !== 'value' && value !== null && value !== undefined) {
                  const valStr = String(value).trim();
                  if (valStr) {
                    parsedSections.push({ 
                      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), 
                      content: valStr, 
                      color: 'purple' 
                    });
                  }
                }
              });
            }
          }
        });
      } else if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
        if ('key' in jsonData && 'value' in jsonData) {
          const label = String(jsonData.key || '').trim();
          const content = String(jsonData.value || '').trim();
          if (label && content) {
            parsedSections.push({ label, content, color: 'purple' });
          }
        } else {
          Object.entries(jsonData).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              const valStr = String(value).trim();
              if (valStr) {
                parsedSections.push({ 
                  label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), 
                  content: valStr, 
                  color: 'purple' 
                });
              }
            }
          });
        }
      }
    } else {
      const sections = summaryText.split('\n').filter(s => s.trim());
      sections.forEach(section => {
        if (section.includes(':')) {
          const [label, ...contentParts] = section.split(':');
          const content = contentParts.join(':').trim();
          if (label.trim() && content) {
            parsedSections.push({ label: label.trim(), content, color: 'purple' });
          }
        } else if (section.trim()) {
          parsedSections.push({ label: 'Summary', content: section.trim(), color: 'purple' });
        }
      });
    }
  } catch (e) {
    const sections = summaryText.split('\n').filter(s => s.trim());
    sections.forEach(section => {
      if (section.includes(':')) {
        const [label, ...contentParts] = section.split(':');
        const content = contentParts.join(':').trim();
        if (label.trim() && content) {
          parsedSections.push({ label: label.trim(), content, color: 'purple' });
        }
      } else if (section.trim()) {
        parsedSections.push({ label: 'Summary', content: section.trim(), color: 'purple' });
      }
    });
  }
  
  return parsedSections;
}

type RecruitGateBlocker = {
  candidateId: number;
  candidateName: string;
  currentStageId: number | null;
  currentStageName: string | null;
  blockingStageId: number;
  blockingStageName: string;
  reason: string;
  latestAppointmentId: number | null;
  latestOutcome: string | null;
  latestAppointmentAt: string | null;
};

const RECRUIT_GATE_OUTCOME_OPTIONS = [
  { value: 'sale', label: 'Sale' },
  { value: 'no_sale', label: 'No Sale' },
  { value: 'no_show', label: 'No Show' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'cannot_afford', label: 'Cannot Afford' },
  { value: 'medically_uninsurable', label: 'Medically Uninsurable' },
  { value: 'policy_issued', label: 'Policy Issued' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type RecruitGateOutcomeValue = typeof RECRUIT_GATE_OUTCOME_OPTIONS[number]['value'];

const getSemanticStageColor = (stageName: string) => {
  const lower = (stageName || '').toLowerCase();
  if (lower === 'hired') return 'bg-green-100 text-green-800';
  if (lower === 'not interested' || lower === 'rejected') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-100 text-blue-800';
};

export default function AORecruit() {
  const [activeTab, setActiveTab] = useState<'candidates' | 'pipeline' | 'connect' | 'virtual-overview' | 'stats'>('connect');
  const [showCallConnectorPro, setShowCallConnectorPro] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'candidates' | 'pipeline' | 'virtual-overview' | 'analytics' | 'call-connector-pro'>('candidates');
  const [selectedCandidate, setSelectedCandidate] = useState<RecruitCandidate | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDragCandidate, setActiveDragCandidate] = useState<RecruitCandidate | null>(null);
  const [detailSheetCandidate, setDetailSheetCandidate] = useState<RecruitCandidate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<any | null>(null);
  const [isPipelineStageModalOpen, setIsPipelineStageModalOpen] = useState(false);
  const [customPipelineOrder, setCustomPipelineOrder] = useState<number[]>([]);
  const [customStageNames, setCustomStageNames] = useState<Record<number, string>>({});
  const [stageUrls, setStageUrls] = useState<Record<number, string>>({});
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
  const [smsCandidate, setSmsCandidate] = useState<RecruitCandidate | null>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentCandidate, setAppointmentCandidate] = useState<RecruitCandidate | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get user email from auth context
  const { authState } = useAuth();
  const userEmail = authState.user?.email;
  const { isDemoMode, demoProduct, exitDemoMode } = useDemo();
  const isRecruitDemo = isDemoMode && demoProduct === 'recruit';
  const [showCertification, setShowCertification] = useState(false);
  const [demoCallStarted, setDemoCallStarted] = useState(false);

  // AO Recruit heartbeat - sends every 10 seconds when on this page
  useEffect(() => {
    if (!userEmail) return;

    const sendRecruitHeartbeat = async () => {
      try {
        await fetch('/api/ao-recruit/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentEmail: userEmail,
            isActive: true,
            timestamp: new Date().toISOString()
          })
        });
        console.log('💓 AO Recruit heartbeat sent for', userEmail);
      } catch (error) {
        console.error('❌ Failed to send AO Recruit heartbeat:', error);
      }
    };

    // Send initial heartbeat
    sendRecruitHeartbeat();

    // Send heartbeat every 10 seconds
    const heartbeatInterval = setInterval(sendRecruitHeartbeat, 10000);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [userEmail]);

  // Get all candidates - auto-refresh every 5 seconds (silent background refresh)
  const { data: candidatesData, isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['/api/recruit/candidates', userEmail],
    queryFn: async () => {
      if (!userEmail) {
        console.log('❌ No userEmail available, skipping candidates fetch');
        return { success: false, candidates: [] };
      }
      console.log('🔍 Fetching candidates for:', userEmail);
      const response = await fetch(`/api/recruit/candidates?email=${encodeURIComponent(userEmail)}`, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) {
        console.error('❌ API error:', response.status, response.statusText);
        throw new Error('Failed to fetch candidates');
      }
      const data = await response.json();
      console.log('✅ Received candidates:', data);
      console.log('✅ First candidate currentStageId:', data.candidates?.[0]?.currentStageId);
      return data;
    },
    retry: false,
    refetchInterval: 5000, // Auto-refresh candidates every 5 seconds
    refetchIntervalInBackground: true, // Keep refreshing even when tab not focused
    refetchOnWindowFocus: false, // Don't refetch when user switches back to tab
    refetchOnMount: false, // Don't refetch on component mount (use cached data)
    staleTime: 4000, // Consider data fresh for 4 seconds (prevents unnecessary re-renders)
    enabled: !!userEmail && userEmail !== "default@example.com",
  });

  // Get recruit stats - refresh only on mount and mutations
  const { data: recruitStats } = useQuery({
    queryKey: ['/api/recruit/stats', userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/recruit/stats?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    retry: false,
    // Removed refetchInterval - only refresh on user action or mutation
    enabled: !!userEmail,
  });

  const { data: recruitGateData, isLoading: isCheckingRecruitGate, refetch: refetchRecruitGate } = useQuery({
    queryKey: ['/api/recruit/accountability/check-blocking', userEmail],
    queryFn: async () => {
      if (!userEmail) return { success: true, isBlocked: false, pendingCount: 0, blockers: [] };
      const response = await fetch(`/api/recruit/accountability/check-blocking/${encodeURIComponent(userEmail)}`);
      if (!response.ok) throw new Error('Failed to check recruit accountability gate');
      return response.json();
    },
    enabled: !!userEmail,
    retry: false,
    refetchInterval: 15000,
  });

  // Get pipeline stages
  const { data: stagesData } = useQuery({
    queryKey: ['/api/recruit/stages'],
    retry: false,
  });

  const stages = stagesData?.stages || [];
  const [gateResolutionByKey, setGateResolutionByKey] = useState<Record<string, {
    outcome: RecruitGateOutcomeValue | '';
    notes: string;
    alp: string;
    saving: boolean;
    saved: boolean;
  }>>({});

  const getGateRowKey = (blocker: RecruitGateBlocker) =>
    `${blocker.candidateId}-${blocker.blockingStageId}-${blocker.latestAppointmentId ?? 'none'}`;

  const getGateRow = (key: string) =>
    gateResolutionByKey[key] ?? { outcome: '', notes: '', alp: '', saving: false, saved: false };

  const setGateRow = (key: string, patch: Partial<{
    outcome: RecruitGateOutcomeValue | '';
    notes: string;
    alp: string;
    saving: boolean;
    saved: boolean;
  }>) =>
    setGateResolutionByKey((prev) => ({
      ...prev,
      [key]: {
        outcome: '',
        notes: '',
        alp: '',
        saving: false,
        saved: false,
        ...(prev[key] || {}),
        ...patch,
      },
    }));

  const handleResolveRecruitGateBlocker = async (blocker: RecruitGateBlocker) => {
    const rowKey = getGateRowKey(blocker);
    const row = getGateRow(rowKey);
    if (!blocker.latestAppointmentId) {
      toast({
        title: 'Missing appointment',
        description: 'No linked appointment was found for this stage. Create one in My Calendar first.',
        variant: 'destructive',
      });
      return;
    }
    if (!row.outcome) {
      toast({
        title: 'Select an outcome',
        description: 'Pick an outcome before resolving this stage.',
        variant: 'destructive',
      });
      return;
    }
    if (row.outcome === 'sale') {
      const cleanAlp = row.alp.replace(/[^0-9.]/g, '');
      if (!cleanAlp || Number(cleanAlp) <= 0) {
        toast({
          title: 'ALP required',
          description: 'Enter a valid ALP amount for sale outcomes.',
          variant: 'destructive',
        });
        return;
      }
    }

    setGateRow(rowKey, { saving: true });
    try {
      const cleanAlp = row.alp.replace(/[^0-9.]/g, '');
      const outcomeNotes = [
        `Recruit Stage: ${blocker.blockingStageName}`,
        row.outcome === 'sale' && cleanAlp ? `ALP: $${cleanAlp}` : '',
        row.notes.trim(),
      ]
        .filter(Boolean)
        .join('\n');

      const res = await fetch(`/api/appointments/${blocker.latestAppointmentId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: row.outcome, outcomeNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to resolve stage outcome');
      }

      setGateRow(rowKey, { saving: false, saved: true });
      toast({
        title: 'Stage resolved',
        description: `${blocker.candidateName} - ${blocker.blockingStageName}`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/recruit/accountability/check-blocking', userEmail] }),
        queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates', userEmail] }),
        queryClient.invalidateQueries({ queryKey: ['/api/recruit/stats', userEmail] }),
      ]);
      await refetchRecruitGate();
    } catch (error: any) {
      setGateRow(rowKey, { saving: false });
      toast({
        title: 'Failed to resolve',
        description: error?.message || 'Could not save outcome right now.',
        variant: 'destructive',
      });
    }
  };

  // Get user settings
  const { data: settingsData } = useQuery({
    queryKey: ['/api/recruit/settings', userEmail],
    queryFn: async () => {
      if (!userEmail) return { success: false, settings: null };
      const response = await fetch('/api/recruit/settings', {
        headers: { 'x-user-email': userEmail }
      });
      if (!response.ok) return { success: false, settings: null };
      return response.json();
    },
    enabled: !!userEmail,
    retry: false,
  });

  // Load settings into state when fetched
  useEffect(() => {
    if (settingsData?.settings) {
      setCustomPipelineOrder(settingsData.settings.pipeline_order || []);
      setCustomStageNames(settingsData.settings.custom_stage_names || {});
      // Load stage URLs from individual fields or from stageUrls object
      const urls: Record<number, string> = {};
      if (settingsData.settings.virtual_overview_url) urls[3] = settingsData.settings.virtual_overview_url;
      if (settingsData.settings.group_final_url) urls[5] = settingsData.settings.group_final_url;
      if (settingsData.settings.final_interview_url) urls[6] = settingsData.settings.final_interview_url;
      if (settingsData.settings.stage_urls) {
        Object.assign(urls, settingsData.settings.stage_urls);
      }
      setStageUrls(urls);
    }
  }, [settingsData]);

  // Apply custom pipeline order and names to stages
  const orderedStages = useMemo(() => {
    if (!stages.length) return [];
    
    // Apply custom names first
    const stagesWithCustomNames = stages.map((stage: any) => ({
      ...stage,
      displayName: customStageNames[stage.id] || stage.name,
      originalName: stage.name
    }));
    
    if (customPipelineOrder.length === 0) return stagesWithCustomNames;
    
    // Create a map for quick lookup
    const stageMap = new Map(stagesWithCustomNames.map(s => [s.id, s]));
    const ordered: typeof stagesWithCustomNames = [];
    
    // Add stages in custom order
    customPipelineOrder.forEach(id => {
      const stage = stageMap.get(id);
      if (stage) {
        ordered.push(stage);
        stageMap.delete(id);
      }
    });
    
    // Add any remaining stages that weren't in custom order
    stageMap.forEach(stage => ordered.push(stage));
    
    return ordered;
  }, [stages, customPipelineOrder, customStageNames]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: {
      pipelineOrder: number[];
      customStageNames?: Record<string, string>;
      stageUrls?: Record<number, string>;
    }) => {
      const response = await apiRequest('POST', '/api/recruit/settings', settings, userEmail);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save settings' }));
        throw new Error(errorData.error || 'Failed to save settings');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Settings saved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/settings', userEmail] });
      setIsSettingsOpen(false);
    },
    onError: (error: any) => {
      console.error('Failed to save settings:', error);
      toast({ 
        title: "Failed to save settings", 
        description: error.message || 'Please check the console for details',
        variant: "destructive" 
      });
    }
  });

  // Initialize stages if empty
  React.useEffect(() => {
    if (stagesData && stages.length === 0) {
      apiRequest('POST', '/api/recruit/stages/initialize', {})
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/recruit/stages'] });
        })
        .catch((err) => {
          console.error('Failed to initialize stages:', err);
        });
    }
  }, [stagesData, stages.length, queryClient]);

  // Create candidate mutation
  const createCandidateMutation = useMutation({
    mutationFn: async (candidate: InsertRecruitCandidate) => {
      console.log('🚀 Creating candidate with userEmail:', userEmail);
      console.log('📝 Candidate data:', candidate);
      return await apiRequest('POST', '/api/recruit/candidates', candidate, userEmail);
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
      console.error('❌ Failed to create candidate:', error);
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
      console.log('✏️ Updating candidate', id, 'with userEmail:', userEmail);
      return await apiRequest('PATCH', `/api/recruit/candidates/${id}`, updates, userEmail);
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
      console.error('❌ Failed to update candidate:', error);
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
      console.log('🗑️ Deleting candidate', id, 'with userEmail:', userEmail);
      return await apiRequest('DELETE', `/api/recruit/candidates/${id}`, undefined, userEmail);
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
      console.error('❌ Failed to delete candidate:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete candidate",
        variant: "destructive",
      });
    },
  });

  // Move candidate to new stage mutation
  const moveStageMutation = useMutation({
    mutationFn: async ({ candidateId, toStageId }: { candidateId: number; toStageId: number }) => {
      return await apiRequest('POST', `/api/recruit/candidates/${candidateId}/move-stage`, { toStageId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/stats'] });
      toast({
        title: "Success",
        description: "Candidate moved to new stage",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move candidate",
        variant: "destructive",
      });
    },
  });

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const candidate = candidates?.find(c => c.id.toString() === event.active.id);
    setActiveDragCandidate(candidate || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragCandidate(null);
    
    const { active, over } = event;
    
    if (!over || !active) return;
    
    const candidateId = parseInt(active.id as string);
    if (!Number.isFinite(candidateId)) return;
    const overId = parseInt(over.id as string);
    if (!Number.isFinite(overId)) return;
    const validStages = (orderedStages.length > 0 ? orderedStages : stages).map((s: any) => Number(s.id));
    const overCandidate = candidates.find((c: RecruitCandidate) => c.id === overId);
    const toStageId = validStages.includes(overId)
      ? overId
      : Number(overCandidate?.currentStageId || 0);
    if (!Number.isFinite(toStageId) || toStageId <= 0) return;
    const movingCandidate = candidates.find((c: RecruitCandidate) => c.id === candidateId);
    if (Number(movingCandidate?.currentStageId || 0) === toStageId) return;
    moveStageMutation.mutate({ candidateId, toStageId });
  };

  const handleSaveCandidate = (candidateData: InsertRecruitCandidate | UpdateRecruitCandidate, id?: number) => {
    if (id) {
      updateCandidateMutation.mutate({ id, updates: candidateData as UpdateRecruitCandidate });
    } else {
      createCandidateMutation.mutate(candidateData as InsertRecruitCandidate);
    }
    // Close modal after mutation starts
    setIsModalOpen(false);
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

  // Filter candidates based on search and filters
  const filteredCandidates = useMemo(() => {
    if (!candidates || candidates.length === 0) return [];
    
    return candidates.filter((candidate: RecruitCandidate) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const candidateStageName = stages?.find(s => s.id === candidate.currentStageId)?.name || '';
        const matchesSearch = 
          candidate.firstName?.toLowerCase().includes(searchLower) ||
          candidate.lastName?.toLowerCase().includes(searchLower) ||
          candidate.email?.toLowerCase().includes(searchLower) ||
          candidate.phone?.toLowerCase().includes(searchLower) ||
          candidateStageName.toLowerCase().includes(searchLower) ||
          candidate.status?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Stage filter - compare currentStageId with selected stage ID
      if (stageFilter !== 'all') {
        const filterStageId = parseInt(stageFilter);
        if (isNaN(filterStageId) || candidate.currentStageId !== filterStageId) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && candidate.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [candidates, searchTerm, stageFilter, statusFilter, stages]);

  // Get unique statuses for filters
  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(candidates.map((c: RecruitCandidate) => c.status).filter(Boolean)));
  }, [candidates]);

  const recruitPlatformBlocked = Boolean(recruitGateData?.isBlocked);
  const recruitBlockers: RecruitGateBlocker[] = Array.isArray(recruitGateData?.blockers) ? recruitGateData.blockers : [];

  if (recruitPlatformBlocked && !isCheckingRecruitGate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-50 bg-red-600 text-white px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm">Platform Locked — resolve previous stage outcomes to continue</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-white border-white hover:bg-red-700 hover:text-white"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/recruit/accountability/check-blocking', userEmail] })}
          >
            Recheck
          </Button>
        </div>
        <div className="px-6 py-8">
        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle className="text-xl text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Resolve Previous Stage Outcomes
            </CardTitle>
            <CardDescription>
              Submit what happened at each required stage before continuing in AO Recruit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-red-200 bg-white p-4">
              <p className="text-sm font-semibold text-red-700">
                {recruitGateData?.pendingCount || recruitBlockers.length} unresolved stage outcome(s) found.
              </p>
            </div>
            <div className="space-y-3">
              {recruitBlockers.slice(0, 12).map((typedBlocker, idx: number) => (
                (() => {
                  const rowKey = getGateRowKey(typedBlocker);
                  const row = getGateRow(rowKey);
                  return (
                    <div key={`${typedBlocker.candidateId}-${typedBlocker.blockingStageId}-${idx}`} className="rounded-md border bg-white p-3 text-sm space-y-3">
                      <div>
                        <div className="font-semibold">{typedBlocker.candidateName}</div>
                        <div className="text-muted-foreground">
                          Current: {typedBlocker.currentStageName || 'Unknown'} | Missing outcome: {typedBlocker.blockingStageName}
                        </div>
                        {typedBlocker.latestAppointmentAt ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            Appointment: {new Date(typedBlocker.latestAppointmentAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="md:col-span-1">
                          <Select
                            value={row.outcome}
                            onValueChange={(value) => setGateRow(rowKey, { outcome: value as RecruitGateOutcomeValue, saved: false })}
                            disabled={!typedBlocker.latestAppointmentId || row.saving}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select outcome" />
                            </SelectTrigger>
                            <SelectContent>
                              {RECRUIT_GATE_OUTCOME_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2">
                          <Textarea
                            value={row.notes}
                            onChange={(e) => setGateRow(rowKey, { notes: e.target.value, saved: false })}
                            placeholder="Outcome notes (optional)"
                            disabled={!typedBlocker.latestAppointmentId || row.saving}
                            className="min-h-[68px]"
                          />
                        </div>
                      </div>

                      {row.outcome === 'sale' ? (
                        <Input
                          value={row.alp}
                          onChange={(e) => setGateRow(rowKey, { alp: e.target.value, saved: false })}
                          placeholder="ALP amount (required for sale)"
                          disabled={!typedBlocker.latestAppointmentId || row.saving}
                        />
                      ) : null}

                      <div className="flex items-center gap-2">
                        <Button
                          className="bg-red-600 hover:bg-red-700"
                          disabled={!typedBlocker.latestAppointmentId || !row.outcome || row.saving}
                          onClick={() => void handleResolveRecruitGateBlocker(typedBlocker)}
                        >
                          {row.saving ? 'Saving...' : 'Resolve Stage Outcome'}
                        </Button>
                        {row.saved ? (
                          <span className="text-xs font-semibold text-emerald-700">Saved. Rechecking gate...</span>
                        ) : null}
                        {!typedBlocker.latestAppointmentId ? (
                          <span className="text-xs font-semibold text-amber-700">No appointment found for this stage yet.</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => window.dispatchEvent(new CustomEvent('aoirail-open-calendar'))}
              >
                Open My Calendar to Resolve Outcomes
              </Button>
              <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/recruit/accountability/check-blocking', userEmail] })}>
                Recheck
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 rounded-full">
                <Users className="w-6 h-6 text-white" />
              </div>
              <PricingHoverCard type="ao-recruit">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent cursor-help">
                  AO Recruit
                </h1>
              </PricingHoverCard>
            </div>
          </div>
          <Button onClick={handleAddCandidate} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
        </div>
      </div>

      {/* Main Content - Connect View */}
      <div className="px-6">
        <div className="flex gap-6 min-h-[calc(100vh-320px)]">

          {/* Slim Nav Rail */}
          <div className="w-[72px] shrink-0 flex flex-col gap-2 pt-1">
            <div
              onClick={() => setRightPanelTab('candidates')}
              className={rightPanelTab === 'candidates' ? 'flex flex-col items-center gap-1 p-2 rounded-lg bg-purple-100 text-purple-700 cursor-pointer' : 'flex flex-col items-center gap-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer'}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] font-medium text-center">Candidates</span>
            </div>
            <div
              onClick={() => setRightPanelTab('pipeline')}
              className={rightPanelTab === 'pipeline' ? 'flex flex-col items-center gap-1 p-2 rounded-lg bg-purple-100 text-purple-700 cursor-pointer' : 'flex flex-col items-center gap-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer'}
            >
              <LayoutGrid className="w-5 h-5" />
              <span className="text-[10px] font-medium text-center">Recruitng Pipeline</span>
            </div>
            <div
              onClick={() => setRightPanelTab('virtual-overview')}
              data-testid="button-tab-virtual-overview"
              className={rightPanelTab === 'virtual-overview' ? 'flex flex-col items-center gap-1 p-2 rounded-lg bg-purple-100 text-purple-700 cursor-pointer' : 'flex flex-col items-center gap-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer'}
            >
              <Video className="w-5 h-5" />
              <span className="text-[10px] font-medium text-center">Virtual</span>
            </div>
            <div
              onClick={() => setRightPanelTab('analytics')}
              className={rightPanelTab === 'analytics' ? 'flex flex-col items-center gap-1 p-2 rounded-lg bg-purple-100 text-purple-700 cursor-pointer' : 'flex flex-col items-center gap-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer'}
            >
              <BarChart2 className="w-5 h-5" />
              <span className="text-[10px] font-medium text-center">Analytics</span>
            </div>
            <div
              onClick={() => setRightPanelTab('call-connector-pro')}
              className={rightPanelTab === 'call-connector-pro' ? 'flex flex-col items-center gap-1 p-2 rounded-lg bg-purple-100 text-purple-700 cursor-pointer' : 'flex flex-col items-center gap-1 p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer'}
            >
              <Phone className="w-5 h-5" />
              <span className="text-[10px] font-medium text-center">Call Pro</span>
            </div>
          </div>

          {/* Main + VDP row: same flex + fixed VDP width as /connect (OutboundDialerInterface) */}
          <div
            className={`flex-1 min-w-0 min-h-[calc(100vh-280px)] ${
              rightPanelTab === 'call-connector-pro'
                ? 'w-full min-w-0'
                : 'flex flex-col lg:flex-row gap-6 w-full min-w-0'
            }`}
          >
            {rightPanelTab === 'call-connector-pro' ? (
              <div className="w-full min-w-0 min-h-[calc(100vh-280px)] pl-0 pr-0 pt-0 pb-0">
                <RecruitOutboundDialerInterface />
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0 min-h-0">
                  <Card className="h-full">
                    <CardContent className="p-0 overflow-hidden">
                {/* Candidates Tab */}
                {rightPanelTab === 'candidates' && (
                  <>
                    {isLoadingCandidates ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
                      </div>
                    ) : filteredCandidates.length === 0 ? (
                      candidates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6">
                            <Users className="w-10 h-10 text-purple-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">No candidates yet</h3>
                          <p className="text-gray-500 mb-6 max-w-sm">Start building your recruitment pipeline by adding your first candidate</p>
                          <Button onClick={handleAddCandidate} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                            <Plus className="w-4 h-4 mr-2" />Add Candidate
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                            <Search className="w-10 h-10 text-gray-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">No candidates match your filters</h3>
                          <p className="text-gray-500 mb-6">Try adjusting your search or clearing the filters</p>
                          <Button variant="outline" onClick={() => { setSearchTerm(''); setStageFilter('all'); }}>
                            <Filter className="w-4 h-4 mr-2" />Clear Filters
                          </Button>
                        </div>
                      )
                    ) : (
                      <div className="w-full -mx-4 px-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>
                              My Candidates ({filteredCandidates.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {/* Search and Filter */}
                            <div className="mb-4 pb-4 border-b">
                              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                                <div className="relative flex-1 flex items-center gap-2">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 z-10 pointer-events-none" />
                                  <Input
                                    placeholder="Search candidates (name, email, phone...)"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 w-full"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="shrink-0"
                                    title="Pipeline Settings"
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                </div>

                                <Select value={stageFilter} onValueChange={setStageFilter}>
                                  <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="All Stages" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Stages</SelectItem>
                                    {(orderedStages.length > 0 ? orderedStages : stages).map((stage) => (
                                      <SelectItem key={stage.id} value={stage.id.toString()}>
                                        {stage.displayName || stage.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Button
                                  onClick={() => {
                                    setSearchTerm('');
                                    setStageFilter('all');
                                  }}
                                  variant="outline"
                                  className="w-full md:w-auto whitespace-nowrap"
                                >
                                  <Filter className="h-4 w-4 mr-2" />
                                  Clear
                                </Button>
                              </div>
                            </div>
                            
                            <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead className="sticky top-0 z-10">
                                  <tr className="border-b bg-slate-50 dark:bg-slate-800">
                                    <th className="text-left py-2 px-2 font-semibold w-48 bg-slate-50 dark:bg-slate-800">Candidate</th>
                                    <th className="text-left py-2 px-2 font-semibold w-56 bg-slate-50 dark:bg-slate-800">Contact</th>
                                    <th className="text-left py-2 px-2 font-semibold w-32 bg-slate-50 dark:bg-slate-800">Date</th>
                                    <th className="text-center py-2 px-2 font-semibold w-24 bg-slate-50 dark:bg-slate-800">AI Summary</th>
                                    <th className="text-left py-2 px-2 font-semibold w-40 bg-slate-50 dark:bg-slate-800">Stage</th>
                                    <th className="text-left py-2 px-2 font-semibold w-24 bg-slate-50 dark:bg-slate-800">ExamFX</th>
                                    <th className="text-left py-2 px-2 font-semibold w-32 bg-slate-50 dark:bg-slate-800">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredCandidates.map((candidate: RecruitCandidate) => {
                                    const initials = `${candidate.firstName.charAt(0)}${candidate.lastName.charAt(0)}`;
                                    const aiSections = parseAISummary(candidate.aiSummary);
                                    
                                    return (
                                      <tr key={candidate.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800">
                                        {/* Candidate Name */}
                                        <td className="py-2 px-2">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                                              {initials}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                                {candidate.firstName} {candidate.lastName}
                                              </div>
                                              {candidate.position && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                  {candidate.position}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        
                                        {/* Contact Info */}
                                        <td className="py-2 px-2">
                                          <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                              <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                              <span className="truncate max-w-[200px]">{candidate.email}</span>
                                            </div>
                                            {candidate.phone && (
                                              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                <span>{candidate.phone}</span>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        
                                        {/* Date */}
                                        <td className="py-2 px-2">
                                          <div className="text-xs text-slate-600 dark:text-slate-400">
                                            {candidate.createdAt ? (
                                              new Date(candidate.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                              })
                                            ) : (
                                              <span className="text-slate-400">—</span>
                                            )}
                                          </div>
                                        </td>
                                    
                                    {/* AI Summary with Hover Card */}
                                    <td className="py-2 px-2">
                                      <div className="flex justify-center">
                                        {aiSections.length > 0 ? (
                                          <HoverCard>
                                            <HoverCardTrigger asChild>
                                              <button className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-purple-100 border-purple-200 text-purple-600 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400">
                                                  <Bot className="h-4 w-4" />
                                                </div>
                                              </button>
                                            </HoverCardTrigger>
                                            <HoverCardContent className="w-96 p-4" side="right" align="start" sideOffset={10}>
                                              <div className="space-y-3">
                                                <div className="flex items-center gap-2 border-b pb-2">
                                                  <Bot className="w-4 h-4 text-purple-600" />
                                                  <h3 className="font-bold text-base">AI Summary</h3>
                                                </div>
                                                {aiSections.map((section, index) => {
                                                  const colorClasses: Record<string, string> = {
                                                    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
                                                    green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                                                    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
                                                    indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
                                                    pink: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800',
                                                    purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
                                                  };
                                                  return (
                                                    <div key={index} className={`p-3 rounded-lg border ${colorClasses[section.color] || colorClasses.purple}`}>
                                                      <h5 className="font-semibold mb-1 text-xs">{section.label}</h5>
                                                      <p className="text-xs text-slate-900 dark:text-slate-100">{section.content}</p>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </HoverCardContent>
                                          </HoverCard>
                                        ) : (
                                          <span className="text-xs text-slate-400">—</span>
                                        )}
                                      </div>
                                    </td>
                                    
                                    {/* Stage Dropdown */}
                                    <td className="py-2 px-2">
                                      <Select
                                        value={candidate.currentStageId?.toString()}
                                        onValueChange={(stageId) => {
                                          moveStageMutation.mutate({
                                            candidateId: candidate.id,
                                            toStageId: parseInt(stageId)
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-xs w-full">
                                          <SelectValue placeholder="Select stage" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(orderedStages.length > 0 ? orderedStages : stages).map((stage) => (
                                            <SelectItem key={stage.id} value={stage.id.toString()}>
                                              {stage.displayName || stage.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>

                                    <td className="py-2 px-2">
                                      {(() => {
                                        const efxStatus = (candidate as any).examfx_status;
                                        if (!efxStatus || efxStatus === 'not_enrolled') return <span className="text-xs text-gray-300">—</span>;
                                        const cfg: Record<string, string> = {
                                          enrolled: 'bg-blue-100 text-blue-700',
                                          studying: 'bg-indigo-100 text-indigo-700',
                                          exam_scheduled: 'bg-amber-100 text-amber-700',
                                          passed: 'bg-green-100 text-green-700',
                                          failed: 'bg-red-100 text-red-700',
                                        };
                                        const labels: Record<string, string> = {
                                          enrolled: 'Enrolled',
                                          studying: 'Studying',
                                          exam_scheduled: 'Exam Set',
                                          passed: '✓ Passed',
                                          failed: 'Failed',
                                        };
                                        return (
                                          <Badge className={`${cfg[efxStatus] || 'bg-gray-100 text-gray-600'} text-xs`}>
                                            {labels[efxStatus] || efxStatus}
                                          </Badge>
                                        );
                                      })()}
                                    </td>

                                    {/* Actions */}
                                    <td className="py-2 px-2">
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditCandidate(candidate)}
                                          className="h-6 w-6 p-0"
                                          title="Edit candidate"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setSmsCandidate(candidate);
                                            setIsSMSModalOpen(true);
                                          }}
                                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                          title="Send SMS"
                                        >
                                          <MessageSquare className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setAppointmentCandidate(candidate);
                                            setIsAppointmentModalOpen(true);
                                          }}
                                          className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          title="Schedule Appointment"
                                        >
                                          <Calendar className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteCandidate(candidate.id)}
                                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                          title="Delete candidate"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </>
                )}

                {/* Pipeline Tab — Kanban board */}
                {rightPanelTab === 'pipeline' && (
                  <div className="p-4 h-full">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
                        {(orderedStages.length > 0 ? orderedStages : stages)
                          .filter((stage: any) => {
                            const stageName = String(stage.originalName || stage.name || '').toLowerCase();
                            return stageName !== 'debrief' && stageName !== 'not interested';
                          })
                          .map((stage: any) => {
                          const stageCandidates = candidates.filter((c: RecruitCandidate) => c.currentStageId === stage.id);
                          const stageColorMap: Record<string, string> = {
                            'AO Recruit': 'bg-purple-50',
                            '1st Interview': 'bg-blue-50',
                            'Virtual Overview': 'bg-indigo-50',
                            'Group Final': 'bg-teal-50',
                            'Final Interview': 'bg-emerald-50',
                            'Hired': 'bg-green-50',
                            'ExamFX Enrolled': 'bg-violet-50',
                            'Exam Passed': 'bg-green-50',
                            'Exam Failed': 'bg-red-50',
                          };
                          const stageClass = stageColorMap[stage.originalName || stage.name] || 'bg-gray-50';
                          return (
                            <div key={stage.id} className="w-56 shrink-0">
                              <DroppableStage
                                id={stage.id.toString()}
                                title={stage.displayName || stage.name}
                                candidates={stageCandidates}
                                onDelete={handleDeleteCandidate}
                                stageClass={stageClass}
                                selectedCandidate={selectedCandidate}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <DragOverlay>
                        {activeDragCandidate && (
                          <DraggableCandidateCard candidate={activeDragCandidate} onDelete={handleDeleteCandidate} />
                        )}
                      </DragOverlay>
                    </DndContext>
                  </div>
                )}

                {/* Virtual Overview Tab */}
                {rightPanelTab === 'virtual-overview' && (
                  <div>
                    <h3 className="font-semibold text-sm mb-4">Virtual Overview Progress</h3>
                    <VirtualOverviewProgress agentEmail={userEmail} />
                  </div>
                )}

                {/* Analytics Tab */}
                {rightPanelTab === 'analytics' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-sm mb-3">Stage Breakdown</h3>
                      <div className="space-y-2">
                        {(orderedStages.length > 0 ? orderedStages : stages).map((stage: any) => {
                          const count = recruitStats?.stats?.stageCounts?.[stage.originalName || stage.name] || 0;
                          return (
                            <div key={stage.id} className="flex justify-between items-center">
                              <span className="text-xs">{stage.displayName || stage.name}</span>
                              <Badge className={getSemanticStageColor(stage.originalName || stage.name)} variant="secondary">{count}</Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-sm mb-3">Performance Metrics</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-xs">Total Candidates</span>
                          <span className="font-medium text-sm">{recruitStats?.stats?.totalCandidates || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs">Upcoming Appointments</span>
                          <span className="font-medium text-sm">{recruitStats?.stats?.upcomingAppointments || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs">Successful Hires</span>
                          <span className="font-medium text-sm">{recruitStats?.stats?.stageCounts?.['Hired'] || 0}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs">Hire Rate</span>
                            <span className="text-xs font-medium">
                              {recruitStats?.stats?.totalCandidates ? Math.round(((recruitStats.stats.stageCounts?.['Hired'] || 0) / recruitStats.stats.totalCandidates) * 100) : 0}%
                            </span>
                          </div>
                          <Progress value={recruitStats?.stats?.totalCandidates ? ((recruitStats.stats.stageCounts?.['Hired'] || 0) / recruitStats.stats.totalCandidates) * 100 : 0} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                    </CardContent>
                  </Card>
                </div>

                {/* VDP + inbound + live queue — same as /connect: fixed rail width, no forced viewport height (that was blowing Taalk to full screen) */}
                <div className="w-full max-w-[380px] lg:max-w-none lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col gap-3 min-h-0 self-start">
                  <div className="min-h-0 flex flex-col w-full">
                    <RecruitInboundConnectPanel userEmail={userEmail ?? ''} />
                  </div>
                </div>
              </>
            )}
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

      {/* Pipeline Stage Candidates Modal */}
      <Dialog open={isPipelineStageModalOpen} onOpenChange={setIsPipelineStageModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedPipelineStage ? `${selectedPipelineStage.displayName || selectedPipelineStage.name} Candidates` : 'Stage Candidates'}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-1 space-y-2">
            {selectedPipelineStage &&
              candidates
                .filter((c: RecruitCandidate) => c.currentStageId === selectedPipelineStage.id)
                .sort((a: RecruitCandidate, b: RecruitCandidate) => {
                  const aTime = new Date((a.updatedAt || a.createdAt || 0) as any).getTime();
                  const bTime = new Date((b.updatedAt || b.createdAt || 0) as any).getTime();
                  return bTime - aTime;
                })
                .map((candidate: RecruitCandidate) => {
                  const sortDate = candidate.updatedAt || candidate.createdAt;
                  return (
                    <div
                      key={`pipeline-modal-candidate-${selectedPipelineStage.id}-${candidate.id}`}
                      className="rounded border border-slate-200 px-3 py-2 bg-white"
                    >
                      <div className="font-medium text-sm text-slate-900">
                        {candidate.firstName} {candidate.lastName}
                      </div>
                      <div className="text-xs text-slate-600">{(candidate.phone || '').toString() || 'No phone'}</div>
                      <div className="text-xs text-slate-500">
                        {sortDate ? `Updated ${new Date(sortDate as any).toLocaleString()}` : 'No timestamp'}
                      </div>
                    </div>
                  );
                })}
            {selectedPipelineStage &&
              candidates.filter((c: RecruitCandidate) => c.currentStageId === selectedPipelineStage.id).length === 0 && (
                <div className="text-sm text-muted-foreground py-2">No candidates in this stage.</div>
              )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Demo Certification Modal */}
      {isRecruitDemo && (
        <DemoCertificationModal
          isOpen={showCertification}
          onCertify={() => {
            setShowCertification(false);
            setDemoCallStarted(false);
            (window as any).__vdpDemoCallStarted = false;
            exitDemoMode();
            toast({
              title: 'Demo Certified',
              description: 'Thank you for completing the demo certification.',
              duration: 3000,
            });
            if ((window as any).__demoExitHandler) {
              (window as any).__demoExitHandler();
            } else {
              window.location.href = '/onboarding';
            }
          }}
          onCancel={() => {
            setShowCertification(false);
            // User canceled certification, still allow exit
            exitDemoMode();
            if ((window as any).__demoExitHandler) {
              (window as any).__demoExitHandler();
            } else {
              window.location.href = '/onboarding';
            }
          }}
          demoType="recruit"
        />
      )}

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pipeline Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Pipeline Order Customization */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Pipeline Order</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop stages to customize the order for your pipeline view
              </p>
              
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event;
                  if (over && active.id !== over.id) {
                    const oldIndex = stages.findIndex((s: any) => s.id.toString() === active.id);
                    const newIndex = stages.findIndex((s: any) => s.id.toString() === over.id);
                    const newOrder = arrayMove(stages, oldIndex, newIndex);
                    setCustomPipelineOrder(newOrder.map((s: any) => s.id));
                  }
                }}
              >
                <SortableContext items={stages.map((s: any) => s.id.toString())} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {(customPipelineOrder.length > 0 ? 
                      customPipelineOrder.map((id) => stages.find((s: any) => s.id === id)).filter(Boolean) : 
                      stages
                    ).map((stage: any) => (
                      <SortableStageItem 
                        key={stage.id} 
                        stage={stage}
                        customName={customStageNames[stage.id]}
                        stageUrl={stageUrls[stage.id] || ''}
                        onNameChange={(stageId, newName) => {
                          setCustomStageNames(prev => ({
                            ...prev,
                            [stageId]: newName
                          }));
                        }}
                        onUrlChange={(stageId, newUrl) => {
                          setStageUrls(prev => ({
                            ...prev,
                            [stageId]: newUrl
                          }));
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSettingsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                saveSettingsMutation.mutate({
                  pipelineOrder: customPipelineOrder.length > 0 ? customPipelineOrder : stages.map((s: any) => s.id),
                  customStageNames,
                  stageUrls,
                });
              }}
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Messenger Modal */}
      <SMSMessengerModal
        open={isSMSModalOpen}
        onOpenChange={setIsSMSModalOpen}
        candidate={smsCandidate}
        userEmail={userEmail}
      />

      {/* Appointment Schedule Modal */}
      {appointmentCandidate && (
        <AppointmentScheduleModal
          open={isAppointmentModalOpen}
          onOpenChange={setIsAppointmentModalOpen}
          candidate={appointmentCandidate}
          userEmail={userEmail}
          currentStageId={appointmentCandidate.currentStageId || undefined}
          stageName={(() => {
            if (!appointmentCandidate.currentStageId) return undefined;
            const stage = stages.find((s: any) => s.id === appointmentCandidate.currentStageId);
            if (!stage) return undefined;
            return customStageNames[stage.id] || stage.name;
          })()}
          stageUrl={(() => {
            if (!appointmentCandidate.currentStageId) return undefined;
            const stageId = appointmentCandidate.currentStageId;
            // Check for custom URL in stageUrls
            if (stageUrls[stageId]) {
              return stageUrls[stageId];
            }
            // Virtual Overview (stage 3) has hardcoded URL
            if (stageId === 3) {
              return undefined; // Will be generated in modal
            }
            return undefined;
          })()}
          onAppointmentSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates', userEmail] });
          }}
        />
      )}

      {/* Removed CandidateDetailSheet - annoying popup */}
    </div>
  );
}

// Sortable Stage Item Component for Settings Modal
function SortableStageItem({ 
  stage, 
  customName, 
  stageUrl,
  onNameChange,
  onUrlChange
}: { 
  stage: any; 
  customName?: string; 
  stageUrl?: string;
  onNameChange: (stageId: number, newName: string) => void;
  onUrlChange: (stageId: number, newUrl: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const displayName = customName || stage.name;
  const isVirtualOverview = stage.id === 3; // Virtual Overview stage ID is 3

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-white hover:bg-gray-50"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={displayName}
            onChange={(e) => onNameChange(stage.id, e.target.value)}
            className="flex-1 font-medium"
            placeholder={stage.name}
          />
          {stage.isTerminal && (
            <Badge variant="outline" className="text-xs">End</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-20">SMS URL:</Label>
          <Input
            value={isVirtualOverview ? '' : (stageUrl || '')}
            onChange={(e) => onUrlChange(stage.id, e.target.value)}
            placeholder={isVirtualOverview ? 'Hardcoded (not editable)' : 'https://example.com/stage-url'}
            className="flex-1 text-sm"
            disabled={isVirtualOverview}
            readOnly={isVirtualOverview}
          />
        </div>
      </div>
    </div>
  );
}

