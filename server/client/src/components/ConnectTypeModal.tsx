import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  DollarSign, 
  Users, 
  Clock, 
  Target,
  CheckCircle,
  AlertCircle,
  XCircle
} from "lucide-react";

interface ConnectTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  connect: any;
}

const connectTypeOptions = [
  { value: 'aoi_appointment', label: 'AOI Appointment', icon: Calendar, color: 'bg-purple-100 text-purple-800' },
  { value: 'press_sale', label: 'Press Sale', icon: DollarSign, color: 'bg-green-100 text-green-800' },
  { value: 'instant_presentation', label: 'Instant Presentation', icon: Users, color: 'bg-blue-100 text-blue-800' },
  { value: 'callback_scheduled', label: 'Callback Scheduled', icon: Clock, color: 'bg-orange-100 text-orange-800' },
  { value: 'other', label: 'Other Connect', icon: Target, color: 'bg-gray-100 text-gray-800' }
];

const productionStatusOptions = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800' },
  { value: 'no_show', label: 'No Show', icon: AlertCircle, color: 'bg-gray-100 text-gray-800' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'bg-emerald-100 text-emerald-800' }
];

export function ConnectTypeModal({ isOpen, onClose, connect }: ConnectTypeModalProps) {
  const [connectType, setConnectType] = useState(connect?.connectType || 'other');
  const [productionStatus, setProductionStatus] = useState(connect?.productionStatus || 'pending');
  const [immediateOutcome, setImmediateOutcome] = useState(connect?.immediateOutcome || '');
  const [notes, setNotes] = useState(connect?.notes || '');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation to update connect type and production status
  const updateConnectMutation = useMutation({
    mutationFn: async (data: {
      connectId: string;
      connectType: string;
      productionStatus: string;
      immediateOutcome?: string;
      notes?: string;
    }) => {
      return await apiRequest('POST', '/api/war/production-status', data);
    },
    onSuccess: () => {
      toast({
        title: "Connect Updated",
        description: "Connect type and production status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/war/daily-production'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!connect?.connectId) {
      toast({
        title: "Error",
        description: "Connect ID is missing",
        variant: "destructive",
      });
      return;
    }

    updateConnectMutation.mutate({
      connectId: connect.connectId,
      connectType,
      productionStatus,
      immediateOutcome,
      notes
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Update Connect Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connect Information */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="font-medium text-sm">{connect?.leadName}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {connect?.leadPhone} • {connect?.connectTime}
            </p>
          </div>

          {/* Connect Type Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Connect Type
            </label>
            <div className="grid grid-cols-1 gap-2">
              {connectTypeOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = connectType === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setConnectType(option.value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{option.label}</span>
                    {isSelected && <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Production Status Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Production Status
            </label>
            <div className="flex flex-wrap gap-2">
              {productionStatusOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = productionStatus === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setProductionStatus(option.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      isSelected 
                        ? 'ring-2 ring-blue-500 ' + option.color
                        : option.color + ' hover:opacity-80'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Immediate Outcome */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Immediate Outcome
            </label>
            <Textarea
              value={immediateOutcome}
              onChange={(e) => setImmediateOutcome(e.target.value)}
              placeholder="What was agreed to or discussed immediately?"
              className="h-20"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Additional Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details about this connect..."
              className="h-20"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateConnectMutation.isPending}
              className="flex-1"
            >
              {updateConnectMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}