import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Clock, User, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';

interface VDPCall {
  id: number;
  leadId: string;
  phoneNumber: string;
  leadFirstName: string;
  leadLastName: string;
  leadCity?: string;
  leadState?: string;
  callType: string;
  callStartedAt: string;
  twilioCallSid: string;
  requiresDisposition: boolean;
}

interface VDPCallHandlerProps {
  agentEmail: string;
}

const DISPOSITION_OPTIONS = [
  { value: 'booked', label: 'Appointment Booked', color: 'bg-green-500' },
  { value: 'call_back', label: 'Call Back Requested', color: 'bg-blue-500' },
  { value: 'not_interested', label: 'Not Interested', color: 'bg-red-500' },
  { value: 'medically_uninsurable', label: 'Medically Uninsurable', color: 'bg-orange-500' },
  { value: 'already_been_sold', label: 'Already Been Seen', color: 'bg-purple-500' },
  { value: 'duplicate', label: 'Duplicate Lead', color: 'bg-gray-500' },
  { value: 'no_answer_vm', label: 'No Answer / Voicemail', color: 'bg-yellow-500' },
  { value: 'do_not_call', label: 'Do Not Call', color: 'bg-red-700' },
  { value: 'over_age', label: 'Over Age', color: 'bg-amber-500' }
];

export function VDPCallHandler({ agentEmail }: VDPCallHandlerProps) {
  const [selectedCall, setSelectedCall] = useState<VDPCall | null>(null);
  const [disposition, setDisposition] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isDispositionModalOpen, setIsDispositionModalOpen] = useState(false);

  const queryClient = useQueryClient();

  // Fetch active VDP calls requiring disposition
  const { data: activeCalls, refetch: refetchCalls } = useQuery({
    queryKey: ['/api/vdp/active-calls', agentEmail],
    queryFn: async () => {
      const response = await fetch(`/api/vdp/active-calls/${agentEmail}`);
      if (!response.ok) throw new Error('Failed to fetch active calls');
      const data = await response.json();
      return data.activeCalls || [];
    },
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
    enabled: !!agentEmail
  });

  // Set call disposition mutation
  const setDispositionMutation = useMutation({
    mutationFn: async ({ callId, disposition, notes }: { callId: number; disposition: string; notes: string }) => {
      return apiRequest(`/api/vdp/disposition/${callId}`, {
        method: 'POST',
        body: { disposition, notes, agentEmail }
      });
    },
    onSuccess: () => {
      toast({
        title: "Disposition Recorded",
        description: "Call disposition has been saved successfully.",
      });
      
      setIsDispositionModalOpen(false);
      setSelectedCall(null);
      setDisposition('');
      setNotes('');
      refetchCalls();
      
      // Refresh any related queries
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/outbound-calls'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record disposition",
        variant: "destructive"
      });
    }
  });

  const handleDispositionSubmit = () => {
    if (!selectedCall || !disposition) {
      toast({
        title: "Missing Information",
        description: "Please select a disposition",
        variant: "destructive"
      });
      return;
    }

    setDispositionMutation.mutate({
      callId: selectedCall.id,
      disposition,
      notes
    });
  };

  const openDispositionModal = (call: VDPCall) => {
    setSelectedCall(call);
    setIsDispositionModalOpen(true);
    setDisposition('');
    setNotes('');
  };

  if (!activeCalls || activeCalls.length === 0) {
    return null; // Don't show component if no active calls
  }

  return (
    <>
      {/* Active VDP Calls Requiring Disposition */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-semibold">VDP Calls Requiring Disposition</h3>
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            {activeCalls.length} pending
          </Badge>
        </div>

        {activeCalls.map((call: VDPCall) => (
          <Card key={call.id} className="border-l-4 border-l-orange-500 bg-orange-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="text-lg">
                    {call.leadFirstName} {call.leadLastName}
                  </span>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    VDP Call
                  </Badge>
                </div>
                <Button
                  onClick={() => openDispositionModal(call)}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Set Disposition
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-gray-500" />
                  <span>{call.phoneNumber}</span>
                </div>
                
                {(call.leadCity || call.leadState) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-gray-500" />
                    <span>{call.leadCity}, {call.leadState}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-gray-500" />
                  <span>{format(new Date(call.callStartedAt), 'PPp')}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-gray-500" />
                  <span className="capitalize">{call.callType.replace('_', ' ')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Disposition Modal */}
      <Dialog open={isDispositionModalOpen} onOpenChange={setIsDispositionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Set Call Disposition
            </DialogTitle>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-4">
              {/* Call Information */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <h4 className="font-semibold mb-2">Call Details</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Client:</strong> {selectedCall.leadFirstName} {selectedCall.leadLastName}</p>
                  <p><strong>Phone:</strong> {selectedCall.phoneNumber}</p>
                  {selectedCall.leadCity && (
                    <p><strong>Location:</strong> {selectedCall.leadCity}, {selectedCall.leadState}</p>
                  )}
                  <p><strong>Call Time:</strong> {format(new Date(selectedCall.callStartedAt), 'PPp')}</p>
                </div>
              </div>

              {/* Disposition Selection */}
              <div>
                <Label htmlFor="disposition">Call Disposition *</Label>
                <Select value={disposition} onValueChange={setDisposition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select disposition..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPOSITION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about the call..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDispositionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDispositionSubmit}
                  disabled={setDispositionMutation.isPending || !disposition}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {setDispositionMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Disposition
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}