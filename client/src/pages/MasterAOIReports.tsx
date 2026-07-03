import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface VDPCall {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  phone_number?: string;
  agent_email: string;
  created_at: string;
  call_duration?: number;
  cnresolution?: string;
  resolution_notes?: string;
  days_since_call: number;
  market?: string;
  taalk_lead_id?: string;
  status?: string;
  source?: string;
}

interface producerData {
  agent_email: string;
  outstanding_count: number;
  oldest_days: number;
  calls: VDPCall[];
}

const RESOLUTION_OPTIONS = [
  { value: 'sold', label: '✅ Sold', color: 'bg-green-100 text-green-800' },
  { value: 'appointment_set', label: '📅 Appointment Set', color: 'bg-blue-100 text-blue-800' },
  { value: 'not_interested', label: '❌ Not Interested', color: 'bg-red-100 text-red-800' },
  { value: 'callback_requested', label: '📞 Callback Requested', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'no_contact', label: '🚫 No Contact', color: 'bg-gray-100 text-gray-800' },
  { value: 'in_progress', label: '⏳ In Progress', color: 'bg-purple-100 text-purple-800' }
];

export default function MasterAOIReports() {
  const [selectedproducer, setSelectedproducer] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch master data - All producers' outstanding resolutions
  const { data: masterData, isLoading } = useQuery({
    queryKey: ['/api/aoi-reports/master'],
    refetchInterval: 30000,
  });

  // Resolution mutation (same as individual page)
  const resolutionMutation = useMutation({
    mutationFn: async ({ callId, resolution, notes }: {
      callId: string;
      resolution: string;
      notes?: string;
    }) => {
      return apiRequest('PUT', `/api/aoi-reports/resolve/${callId}`, {
        cnresolution: resolution,
        resolution_notes: notes
      });
    },
    onSuccess: () => {
      toast({
        title: "Resolution Saved",
        description: "Call resolution has been recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/aoi-reports'] });
      setResolutionNotes({});
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save resolution. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleResolution = (callId: string, resolution: string) => {
    const notes = resolutionNotes[callId] || '';
    resolutionMutation.mutate({ callId, resolution, notes });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResolutionOption = (status?: string) => {
    return RESOLUTION_OPTIONS.find(opt => opt.value === status);
  };

  const totalOutstanding = masterData?.reduce((sum, producer) => sum + producer.outstanding_count, 0) || 0;
  const producersWithOutstanding = masterData?.length || 0;
  const oldestOutstanding = masterData?.reduce((max, producer) => Math.max(max, producer.oldest_days), 0) || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Master AOI Reports - All producers Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Management oversight of all outstanding VDP call resolutions across All producers
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalOutstanding}</div>
              <p className="text-xs text-muted-foreground">Calls requiring resolution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">producers with Outstanding</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{producersWithOutstanding}</div>
              <p className="text-xs text-muted-foreground">Need to complete resolutions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Oldest Outstanding</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{oldestOutstanding}</div>
              <p className="text-xs text-muted-foreground">Days overdue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Active</div>
              <p className="text-xs text-muted-foreground">3-day tracking enabled</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">producer Overview</TabsTrigger>
            <TabsTrigger value="details">Detailed View</TabsTrigger>
          </TabsList>

          {/* Overview Tab - producer Summary */}
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>producer Outstanding Summary</CardTitle>
                <CardDescription>
                  producers sorted by number of outstanding resolutions (most to least)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {masterData?.map((producer) => (
                    <div 
                      key={producer.agent_email}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="font-medium">{producer.agent_email}</div>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {producer.outstanding_count} outstanding
                        </Badge>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          Oldest: {producer.oldest_days} days
                        </Badge>
                      </div>
                      <Button 
                        onClick={() => setSelectedproducer(producer.agent_email)}
                        variant="outline"
                        size="sm"
                      >
                        View Details
                      </Button>
                    </div>
                  ))}
                  
                  {masterData?.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      🎉 All producers are up to date! No outstanding resolutions.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Details Tab - Full Call List */}
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Outstanding Calls</CardTitle>
                <CardDescription>
                  All outstanding calls across All producers - resolve directly from this page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>producer</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Market</TableHead>
                      <TableHead>Taalk Lead ID</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Call Date</TableHead>
                      <TableHead>Days Outstanding</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masterData?.flatMap(producer => producer.calls).map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="font-medium">{call.agent_email}</TableCell>
                        <TableCell>{call.customer_name || 'Unknown'}</TableCell>
                        <TableCell>{call.phone_number || call.customer_phone || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                            {call.market || 'Unknown Market'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {call.taalk_lead_id || 'Unknown Lead ID'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${call.source === 'vdp_calls' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-purple-50 text-purple-800 border-purple-200'}`}
                          >
                            {call.source === 'vdp_calls' ? 'VDP' : call.source === 'masterlead' ? 'Master' : 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(call.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${call.days_since_call > 7 ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}
                          >
                            {call.days_since_call} days
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDuration(call.call_duration)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Select onValueChange={(value) => handleResolution(call.id, value)}>
                              <SelectTrigger className="w-48">
                                <SelectValue placeholder="Select resolution" />
                              </SelectTrigger>
                              <SelectContent>
                                {RESOLUTION_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Textarea
                              placeholder="Resolution notes (optional)"
                              value={resolutionNotes[call.id] || ''}
                              onChange={(e) => setResolutionNotes(prev => ({
                                ...prev,
                                [call.id]: e.target.value
                              }))}
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-gray-500">
                            Call ID: {call.id}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {masterData?.every(producer => producer.calls.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    🎉 All calls resolved! No outstanding resolutions found.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}