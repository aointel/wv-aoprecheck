'use client';

import {
  CheckCircle,
  XCircle,
  Clock,
  PhoneOff,
  Ban,
  ArrowRight,
  Zap,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DialerState, CallDisposition } from './types';

interface CallDispositionProps {
  state: DialerState;
  onDispositionChange: (disposition: CallDisposition) => void;
  onNotesChange: (notes: string) => void;
  onCompleteCall: () => void;
}

export default function CallDispositionComponent({
  state,
  onDispositionChange,
  onNotesChange,
  onCompleteCall
}: CallDispositionProps) {
  const { toast } = useToast();

  // Don't show disposition interface unless there's a current call
  if (!state.currentCall) {
    return null;
  }

  const dispositionOptions = [
    {
      id: 'no_answer_vm' as CallDisposition,
      label: 'No Answer / VM',
      icon: PhoneOff,
      color: 'gray',
      gradient: 'from-gray-600 to-gray-500',
      hoverGradient: 'hover:from-gray-500 hover:to-gray-400',
      borderColor: 'border-gray-400',
      textColor: 'text-gray-400',
      bgColor: 'hover:bg-gray-400/20'
    },
    {
      id: 'booked' as CallDisposition,
      label: 'Booked',
      icon: CheckCircle,
      color: 'green',
      gradient: 'from-green-600 to-green-500',
      hoverGradient: 'hover:from-green-500 hover:to-green-400',
      borderColor: 'border-green-400',
      textColor: 'text-green-400',
      bgColor: 'hover:bg-green-400/20'
    },
    {
      id: 'instant_presentation' as CallDisposition,
      label: 'Instant Presentation',
      icon: Zap,
      color: 'blue',
      gradient: 'from-blue-600 to-blue-500',
      hoverGradient: 'hover:from-blue-500 hover:to-blue-400',
      borderColor: 'border-blue-400',
      textColor: 'text-blue-400',
      bgColor: 'hover:bg-blue-400/20'
    },
    {
      id: 'call_back' as CallDisposition,
      label: 'Call Back',
      icon: Clock,
      color: 'yellow',
      gradient: 'from-yellow-600 to-yellow-500',
      hoverGradient: 'hover:from-yellow-500 hover:to-yellow-400',
      borderColor: 'border-yellow-400',
      textColor: 'text-yellow-400',
      bgColor: 'hover:bg-yellow-400/20'
    },
    {
      id: 'not_interested' as CallDisposition,
      label: 'Not Interested',
      icon: XCircle,
      color: 'red',
      gradient: 'from-red-600 to-red-500',
      hoverGradient: 'hover:from-red-500 hover:to-red-400',
      borderColor: 'border-red-400',
      textColor: 'text-red-400',
      bgColor: 'hover:bg-red-400/20'
    },
    {
      id: 'medically_uninsurable' as CallDisposition,
      label: 'Medically Uninsurable',
      icon: Ban,
      color: 'purple',
      gradient: 'from-purple-600 to-purple-500',
      hoverGradient: 'hover:from-purple-500 hover:to-purple-400',
      borderColor: 'border-purple-400',
      textColor: 'text-purple-400',
      bgColor: 'hover:bg-purple-400/20'
    },
    {
      id: 'duplicate' as CallDisposition,
      label: 'Duplicate',
      icon: Copy,
      color: 'orange',
      gradient: 'from-orange-600 to-orange-500',
      hoverGradient: 'hover:from-orange-500 hover:to-orange-400',
      borderColor: 'border-orange-400',
      textColor: 'text-orange-400',
      bgColor: 'hover:bg-orange-400/20'
    },
    {
      id: 'do_not_call' as CallDisposition,
      label: 'Do Not Call',
      icon: Ban,
      color: 'red',
      gradient: 'from-red-700 to-red-600',
      hoverGradient: 'hover:from-red-600 hover:to-red-500',
      borderColor: 'border-red-500',
      textColor: 'text-red-500',
      bgColor: 'hover:bg-red-500/20'
    },
    {
      id: 'already_been_sold' as CallDisposition,
      label: 'Already Been Sold',
      icon: CheckCircle,
      color: 'indigo',
      gradient: 'from-indigo-600 to-indigo-500',
      hoverGradient: 'hover:from-indigo-500 hover:to-indigo-400',
      borderColor: 'border-indigo-400',
      textColor: 'text-indigo-400',
      bgColor: 'hover:bg-indigo-400/20'
    },
    {
      id: 'pending' as CallDisposition,
      label: 'Pending',
      icon: Clock,
      color: 'blue',
      gradient: 'from-blue-600 to-blue-500',
      hoverGradient: 'hover:from-blue-500 hover:to-blue-400',
      borderColor: 'border-blue-400',
      textColor: 'text-blue-400',
      bgColor: 'hover:bg-blue-400/20'
    }
  ];

  const handleCompleteCall = async () => {
    if (!state.selectedDisposition) {
      toast({
        title: 'Disposition Required',
        description: 'Please select a call disposition before completing',
        variant: 'destructive'
      });
      return;
    }

    onCompleteCall();
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 h-fit">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Call Disposition</h3>
      </div>

      {/* Compact Disposition Dropdown */}
      <div className="mb-3">
        <Select 
          value={state.selectedDisposition} 
          onValueChange={onDispositionChange}
        >
          <SelectTrigger className="w-full h-9">
            <SelectValue placeholder="Select call outcome..." />
          </SelectTrigger>
          <SelectContent>
            {dispositionOptions.map((option) => {
              const Icon = option.icon;
              return (
                <SelectItem 
                  key={option.id} 
                  value={option.id}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Compact Call Notes */}
      <div className="mb-3">
        <Textarea
          placeholder="Add notes about this call..."
          value={state.callNotes || ''}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[60px] resize-none text-sm"
        />
      </div>

      {/* Complete Call Button */}
      <Button
        onClick={handleCompleteCall}
        disabled={!state.selectedDisposition}
        className="w-full h-9 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium text-sm"
      >
        <ArrowRight className="h-4 w-4 mr-2" />
        Complete Call
      </Button>
    </div>
  );
}