import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  FileText,
  TrendingUp
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Connect {
  id: string;
  agentEmail: string;
  leadName: string;
  leadPhone: string;
  connectDate: string;
  connectTime: string;
  duration: number;
  leadSource: string;
  market: string;
  state: string;
  disposition?: string;
  appointmentSet?: boolean;
  appointmentDate?: string;
  saleAmount?: number;
  notes?: string;
  reportedAt?: string;
}

interface WarModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentEmail: string;
  weekStart: string;
  weekEnd: string;
}

const dispositionOptions = [
  { value: 'appointment', label: 'Appointment Set', icon: Calendar, color: 'bg-green-100 text-green-800' },
  { value: 'sale', label: 'Sale Made', icon: DollarSign, color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cant_afford', label: "Can't Afford", icon: XCircle, color: 'bg-red-100 text-red-800' },
  { value: 'medically_uninsurable', label: 'Medically Uninsurable', icon: AlertCircle, color: 'bg-orange-100 text-orange-800' },
  { value: 'not_interested', label: 'Not Interested', icon: XCircle, color: 'bg-gray-100 text-gray-800' },
  { value: 'pending', label: 'Pending Follow-up', icon: Clock, color: 'bg-blue-100 text-blue-800' }
];

export function WarModal({ isOpen, onClose, agentEmail, weekStart, weekEnd }: WarModalProps) {
  const [selectedConnect, setSelectedConnect] = useState<Connect | null>(null);
  const [disposition, setDisposition] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  const queryClient = useQueryClient();

  // Fetch connects for the week
  const { data: connects, isLoading } = useQuery({
    queryKey: ['/api/war/connects', agentEmail, weekStart, weekEnd],
    enabled: isOpen,
  });

  // Submit disposition mutation
  const submitDispositionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/war/disposition', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/war/connects'] });
      resetForm();
    },
  });

  // Submit all dispositions (complete WAR)
  const completeWarMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/war/complete', {
        agentEmail,
        weekStart,
        weekEnd
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/war/connects'] });
      onClose();
    },
  });

  const resetForm = () => {
    setSelectedConnect(null);
    setDisposition('');
    setAppointmentDate('');
    setSaleAmount('');
    setNotes('');
  };

  const handleSubmitDisposition = () => {
    if (!selectedConnect || !disposition) return;

    submitDispositionMutation.mutate({
      connectId: selectedConnect.id,
      disposition,
      appointmentDate: disposition === 'appointment' ? appointmentDate : null,
      saleAmount: disposition === 'sale' ? parseFloat(saleAmount) || 0 : null,
      notes
    });
  };

  const getDispositionBadge = (connect: Connect) => {
    if (!connect.disposition) return null;
    
    const option = dispositionOptions.find(opt => opt.value === connect.disposition);
    if (!option) return null;

    const Icon = option.icon;
    return (
      <Badge className={option.color} variant="secondary">
        <Icon className="w-3 h-3 mr-1" />
        {option.label}
      </Badge>
    );
  };

  const unreportedConnects = connects?.filter((c: Connect) => !c.disposition) || [];
  const reportedConnects = connects?.filter((c: Connect) => c.disposition) || [];
  const allReported = unreportedConnects.length === 0;

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Loading Weekly Agency Report...
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Weekly Agency Report (WAR)
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Week of {new Date(weekStart).toLocaleDateString()} - {new Date(weekEnd).toLocaleDateString()}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Total Connects</span>
                </div>
                <p className="text-2xl font-bold">{connects?.length || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium">Reported</span>
                </div>
                <p className="text-2xl font-bold">{reportedConnects.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <p className="text-2xl font-bold">{unreportedConnects.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Indicator */}
          {connects?.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Reporting Progress</span>
                <span>{reportedConnects.length} of {connects.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(reportedConnects.length / connects.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Unreported Connects */}
            {unreportedConnects.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-orange-600">
                    Connects Requiring Disposition ({unreportedConnects.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {unreportedConnects.map((connect: Connect) => (
                    <div 
                      key={connect.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedConnect?.id === connect.id 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedConnect(connect)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{connect.leadName}</p>
                          <p className="text-sm text-gray-600">{connect.leadPhone}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(connect.connectDate).toLocaleDateString()} at {connect.connectTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{connect.market}</p>
                          <p className="text-xs text-gray-500">{connect.state}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Disposition Form */}
            {selectedConnect && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Report Disposition - {selectedConnect.leadName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>What happened with this connect?</Label>
                    <Select value={disposition} onValueChange={setDisposition}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select disposition..." />
                      </SelectTrigger>
                      <SelectContent>
                        {dispositionOptions.map((option) => {
                          const Icon = option.icon;
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {option.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {disposition === 'appointment' && (
                    <div>
                      <Label>Appointment Date</Label>
                      <Input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => setAppointmentDate(e.target.value)}
                      />
                    </div>
                  )}

                  {disposition === 'sale' && (
                    <div>
                      <Label>Sale Amount ($)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={saleAmount}
                        onChange={(e) => setSaleAmount(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      placeholder="Additional details about this connect..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button
                    onClick={handleSubmitDisposition}
                    disabled={!disposition || submitDispositionMutation.isPending}
                    className="w-full"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {submitDispositionMutation.isPending ? 'Saving...' : 'Submit Disposition'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Reported Connects */}
            {reportedConnects.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg text-green-600">
                    Completed Reports ({reportedConnects.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {reportedConnects.map((connect: Connect) => (
                      <div key={connect.id} className="p-3 border rounded-lg bg-green-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{connect.leadName}</p>
                            <p className="text-sm text-gray-600">{connect.leadPhone}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(connect.connectDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            {getDispositionBadge(connect)}
                            {connect.saleAmount && (
                              <p className="text-sm font-medium text-green-600 mt-1">
                                ${connect.saleAmount.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {connect.notes && (
                          <p className="text-sm text-gray-600 mt-2 italic">"{connect.notes}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Complete WAR Button */}
          {allReported && connects?.length > 0 && (
            <div className="flex justify-center pt-4 border-t">
              <Button
                onClick={() => completeWarMutation.mutate()}
                disabled={completeWarMutation.isPending}
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {completeWarMutation.isPending ? 'Completing...' : 'Complete Weekly Report'}
              </Button>
            </div>
          )}

          {connects?.length === 0 && (
            <div className="text-center p-8 text-gray-500">
              <Phone className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No connects recorded for this week</p>
              <p className="text-sm">Great job staying consistent with your outreach!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}