import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Clock, User, Calendar, Search, Filter } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Hotlead {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  duration_seconds: number;
  hot_lead_reason: string;
  call_date: string;
  status: string;
  assigned_to?: string;
  priority_score: number;
  follow_up_status: string;
  created_at: string;
}

export default function HotleadsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: hotleads = [], isLoading } = useQuery({
    queryKey: ['/api/hotleads'],
    queryFn: () => fetch('/api/hotleads').then(res => res.json())
  });

  const assignHotlead = useMutation({
    mutationFn: ({ id, agentEmail }: { id: number; agentEmail: string }) =>
      apiRequest(`/api/hotleads/${id}/assign`, {
        method: 'POST',
        body: { agentEmail }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hotleads'] });
    }
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/hotleads/${id}/status`, {
        method: 'PATCH',
        body: { status }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hotleads'] });
    }
  });

  const filteredHotleads = hotleads.filter((lead: Hotlead) => {
    const matchesSearch = 
      lead.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesAssigned = assignedFilter === 'all' || 
      (assignedFilter === 'unassigned' && !lead.assigned_to) ||
      (assignedFilter === 'assigned' && lead.assigned_to);
    
    return matchesSearch && matchesStatus && matchesAssigned;
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  const getPriorityBadge = (score: number) => {
    if (score >= 8) return <Badge variant="destructive">High</Badge>;
    if (score >= 6) return <Badge variant="default">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Badge variant="default">New</Badge>;
      case 'CONTACTED':
        return <Badge variant="secondary">Contacted</Badge>;
      case 'SCHEDULED':
        return <Badge variant="outline">Scheduled</Badge>;
      case 'CONVERTED':
        return <Badge variant="destructive">Converted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading hotleads...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Hotleads Management</h1>
        <p className="text-muted-foreground">
          Real-time hotleads synced from Taalk API - People who answered but weren't transferred
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hotleads</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hotleads.length}</div>
            <p className="text-xs text-muted-foreground">
              Synced from Taalk API
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hotleads.filter((lead: Hotlead) => !lead.assigned_to).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hotleads.filter((lead: Hotlead) => lead.priority_score >= 8).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Score 8+
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sync</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hotleads.filter((lead: Hotlead) => 
                new Date(lead.created_at).toDateString() === new Date().toDateString()
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              New today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignments</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAssignedFilter('all');
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hotleads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Hotleads ({filteredHotleads.length})</CardTitle>
          <CardDescription>
            Real people who answered calls but weren't transferred to producers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Call Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHotleads.map((lead: Hotlead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {lead.first_name} {lead.last_name}
                        </div>
                        {lead.email && (
                          <div className="text-sm text-muted-foreground">
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                        {lead.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        {formatDuration(lead.duration_seconds)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getPriorityBadge(lead.priority_score)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(lead.status)}
                    </TableCell>
                    <TableCell>
                      {lead.assigned_to ? (
                        <Badge variant="outline">{lead.assigned_to}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(lead.call_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!lead.assigned_to && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const email = prompt('Enter Producer Email to assign:');
                              if (email) {
                                assignHotlead.mutate({ id: lead.id, agentEmail: email });
                              }
                            }}
                          >
                            Assign
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const status = prompt('Enter new status (NEW, CONTACTED, SCHEDULED, CONVERTED):');
                            if (status) {
                              updateStatus.mutate({ id: lead.id, status: status.toUpperCase() });
                            }
                          }}
                        >
                          Update
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredHotleads.length === 0 && (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No hotleads found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || assignedFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Hotleads will appear here as they are synced from Taalk API'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}