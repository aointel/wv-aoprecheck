import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Phone, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Plus,
  TrendingUp,
  Target,
  Award,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WarConnect {
  id: string;
  connectId: string;
  agentEmail: string;
  leadName: string;
  leadPhone: string;
  connectDate: string;
  connectTime: string;
  duration: number;
  leadSource: string;
  market: string;
  state: string;
  connectType: 'aoi_appointment' | 'press_sale' | 'instant_presentation' | 'callback_scheduled' | 'other';
  immediateOutcome?: string;
  productionStatus: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed';
  disposition?: string;
  appointmentSet?: boolean;
  appointmentDate?: string;
  saleAmount?: string;
  notes?: string;
  followUpRequired?: boolean;
  nextContactDate?: string;
  priorityLevel: 'low' | 'normal' | 'high' | 'urgent';
  tags?: string;
}

interface WarCardsProps {
  userEmail: string;
}

const connectTypeIcons = {
  aoi_appointment: Calendar,
  press_sale: DollarSign,
  instant_presentation: Zap,
  callback_scheduled: Phone,
  other: User
};

const connectTypeColors = {
  aoi_appointment: 'bg-blue-100 text-blue-800',
  press_sale: 'bg-green-100 text-green-800',
  instant_presentation: 'bg-purple-100 text-purple-800',
  callback_scheduled: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800'
};

const productionStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-red-100 text-red-800',
  completed: 'bg-emerald-100 text-emerald-800'
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
};

export function WarCards({ userEmail }: WarCardsProps) {
  const [selectedConnect, setSelectedConnect] = useState<WarConnect | null>(null);
  const [dispositionModal, setDispositionModal] = useState(false);
  const [disposition, setDisposition] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch today's connects
  const { data: dailyProduction, isLoading } = useQuery({
    queryKey: ['/api/war/daily-production', userEmail],
    queryFn: () => apiRequest(`/api/war/daily-production?agentEmail=${userEmail}`),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Add demo cards mutation
  const addDemoCardsMutation = useMutation({
    mutationFn: () => apiRequest('/api/war/add-demo-cards', {
      method: 'POST',
      body: JSON.stringify({ agentEmail: userEmail }),
    }),
    onSuccess: () => {
      toast({
        title: "Demo Cards Added",
        description: "5 demo AOI cards have been added to your WAR tracker",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/war/daily-production'] });
    },
  });

  // Update disposition mutation
  const updateDispositionMutation = useMutation({
    mutationFn: (data: {
      connectId: string;
      disposition: string;
      appointmentDate?: string;
      saleAmount?: number;
      notes?: string;
    }) => apiRequest('/api/war/disposition', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({
        title: "Disposition Updated",
        description: "Connect disposition has been recorded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/war/daily-production'] });
      setDispositionModal(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setSelectedConnect(null);
    setDisposition('');
    setAppointmentDate('');
    setSaleAmount('');
    setNotes('');
  };

  const handleDisposition = (connect: WarConnect) => {
    setSelectedConnect(connect);
    setDisposition(connect.disposition || '');
    setAppointmentDate(connect.appointmentDate || '');
    setSaleAmount(connect.saleAmount || '');
    setNotes(connect.notes || '');
    setDispositionModal(true);
  };

  const submitDisposition = () => {
    if (!selectedConnect || !disposition) return;

    updateDispositionMutation.mutate({
      connectId: selectedConnect.connectId,
      disposition,
      appointmentDate: appointmentDate || undefined,
      saleAmount: saleAmount ? parseFloat(saleAmount) : undefined,
      notes: notes || undefined
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Loading WAR cards...</span>
      </div>
    );
  }

  const production = dailyProduction || {
    aoiAppointments: [],
    pressSales: [],
    instantPresentations: [],
    callbacks: [],
    totalConnects: 0,
    pendingFollowUps: 0,
    confirmedAppointments: 0,
    completedSales: 0
  };

  const allConnects = [
    ...production.aoiAppointments,
    ...production.pressSales,
    ...production.instantPresentations,
    ...production.callbacks
  ].sort((a, b) => new Date(b.connectDate).getTime() - new Date(a.connectDate).getTime());

  return (
    <div className="flex items-center space-x-3">
      {/* Quick Stats */}
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="text-xs">
          <Target className="h-3 w-3 mr-1" />
          {production.totalConnects} Connects
        </Badge>
        <Badge variant="outline" className="text-xs">
          <Award className="h-3 w-3 mr-1" />
          {production.confirmedAppointments} Confirmed
        </Badge>
        <Badge variant="outline" className="text-xs">
          <TrendingUp className="h-3 w-3 mr-1" />
          {production.completedSales} Sales
        </Badge>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center space-x-1">
        {allConnects.slice(0, 3).map((connect) => {
          const Icon = connectTypeIcons[connect.connectType];
          const needsDisposition = !connect.disposition || connect.disposition === 'pending';
          
          return (
            <Button
              key={connect.id}
              variant={needsDisposition ? "default" : "outline"}
              size="sm"
              className={`text-xs ${needsDisposition ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
              onClick={() => handleDisposition(connect)}
              title={`${connect.leadName} - ${connect.connectType.replace('_', ' ').toUpperCase()}`}
            >
              <Icon className="h-3 w-3 mr-1" />
              {connect.leadName.split(' ')[0]}
              {needsDisposition && (
                <AlertCircle className="h-3 w-3 ml-1 text-orange-200" />
              )}
            </Button>
          );
        })}

        {production.totalConnects === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => addDemoCardsMutation.mutate()}
            disabled={addDemoCardsMutation.isPending}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Demo Cards
          </Button>
        )}
      </div>

      {/* Disposition Modal */}
      <Dialog open={dispositionModal} onOpenChange={setDispositionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Disposition: {selectedConnect?.leadName}
            </DialogTitle>
          </DialogHeader>

          {selectedConnect && (
            <div className="space-y-4">
              {/* Connect Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{selectedConnect.leadName}</span>
                    <Badge className={connectTypeColors[selectedConnect.connectType]}>
                      {selectedConnect.connectType.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {selectedConnect.leadPhone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {selectedConnect.connectTime} ({selectedConnect.duration}s)
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={productionStatusColors[selectedConnect.productionStatus]}>
                        {selectedConnect.productionStatus.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge className={priorityColors[selectedConnect.priorityLevel]}>
                        {selectedConnect.priorityLevel.toUpperCase()}
                      </Badge>
                    </div>
                    {selectedConnect.immediateOutcome && (
                      <p className="text-xs mt-2 p-2 bg-blue-50 rounded">
                        "{selectedConnect.immediateOutcome}"
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Disposition Form */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="disposition">Final Disposition</Label>
                  <Select value={disposition} onValueChange={setDisposition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select disposition..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appointment">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Appointment Set
                        </div>
                      </SelectItem>
                      <SelectItem value="sale">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3 w-3" />
                          Sale Made
                        </div>
                      </SelectItem>
                      <SelectItem value="cant_afford">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-3 w-3" />
                          Can't Afford
                        </div>
                      </SelectItem>
                      <SelectItem value="not_interested">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-3 w-3" />
                          Not Interested
                        </div>
                      </SelectItem>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Pending Follow-up
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {disposition === 'appointment' && (
                  <div>
                    <Label htmlFor="appointmentDate">Appointment Date</Label>
                    <Input
                      id="appointmentDate"
                      type="datetime-local"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                    />
                  </div>
                )}

                {disposition === 'sale' && (
                  <div>
                    <Label htmlFor="saleAmount">Sale Amount ($)</Label>
                    <Input
                      id="saleAmount"
                      type="number"
                      placeholder="0.00"
                      value={saleAmount}
                      onChange={(e) => setSaleAmount(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes about this connect..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={submitDisposition}
                  disabled={!disposition || updateDispositionMutation.isPending}
                  className="flex-1"
                >
                  {updateDispositionMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3 mr-2" />
                      Save Disposition
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setDispositionModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}