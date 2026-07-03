'use client';

import {
  CheckCircle,
  XCircle,
  Clock,
  PhoneOff,
  Ban,
  ArrowRight,
  Zap,
  Copy,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { DialerState, CallDisposition } from './types';

interface CallDispositionProps {
  state: DialerState;
  onDispositionChange: (disposition: CallDisposition) => void;
  onNotesChange: (notes: string) => void;
  onCompleteCall: (saleData?: { alp?: string; saleAmount?: string }) => void;
  onApplyDisposition?: (saleData?: { alp?: string; saleAmount?: string }) => void;
  dispositionApplied?: boolean; // Track if disposition has been applied to masterlead
  hasRecentCall?: boolean; // Whether agent called this lead in last 24 hours
  currentLead?: any; // Current lead data
}

// Booking flow state
interface BookingFlowState {
  platform: 'aoi' | 'planet' | '';
  service: string;
  date: string;
  time: string;
}

export default function CallDispositionComponent({
  state,
  onDispositionChange,
  onNotesChange,
  onCompleteCall,
  hasRecentCall = false,
  currentLead,
  onApplyDisposition,
  dispositionApplied = false,
}: CallDispositionProps) {
  // Allow disposition if there's an active call OR if there was a call in the last 24 hours
  const canDisposition = state.callDuration > 0 || hasRecentCall || currentLead?.hasRecentCall;
  const { toast } = useToast();
  const [saleData, setSaleData] = useState<SaleDispositionState>({ alp: '', saleAmount: '' });
  const [bookingData, setBookingData] = useState<BookingFlowState>({ 
    platform: '', 
    service: '', 
    date: '', 
    time: '' 
  });

  // Don't show disposition interface unless there's a current call
  if (!state.currentCall) {
    return null;
  }

  // Exempt dispositions (no connected call needed): no_answer, wrong_number - for when you didn't reach them
  // All others require a confirmed call (duration > 0)
  const canUseDisposition = (disposition: string, callDurationSeconds: number, _isConnected: boolean): boolean => {
    const disp = disposition.toLowerCase();
    const exempt = ['no_answer', 'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number', 'bad_number'];
    if (exempt.includes(disp)) return true;
    return callDurationSeconds > 0;
  };

  const callDurationSeconds = state.callDuration || 0;
  const hasActiveCall = state.currentCall !== null && callDurationSeconds > 0;

  const canBook = !!state.currentCall?.callSid;

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
    // Only include "booked" if call duration > 110s AND call_sid exists
    ...(canBook ? [{
      id: 'booked' as CallDisposition,
      label: 'Booked',
      icon: CheckCircle,
      color: 'green',
      gradient: 'from-green-600 to-green-500',
      hoverGradient: 'hover:from-green-500 hover:to-green-400',
      borderColor: 'border-green-400',
      textColor: 'text-green-400',
      bgColor: 'hover:bg-green-400/20'
    }] : []),
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
      id: 'sale' as CallDisposition,
      label: 'Sale',
      icon: DollarSign,
      color: 'emerald',
      gradient: 'from-emerald-600 to-emerald-500',
      hoverGradient: 'hover:from-emerald-500 hover:to-emerald-400',
      borderColor: 'border-emerald-400',
      textColor: 'text-emerald-400',
      bgColor: 'hover:bg-emerald-400/20'
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
      label: 'Already Been Seen',
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

  // Handle applying disposition (saves to masterlead but keeps lead visible)
  const handleApplyDisposition = async () => {
    if (!onApplyDisposition) {
      console.error('❌ onApplyDisposition handler not provided');
      toast({
        title: 'Error',
        description: 'Disposition handler not available. Please refresh the page.',
        variant: 'destructive'
      });
      return;
    }

    if (!state.selectedDisposition) {
      toast({
        title: 'Disposition Required',
        description: 'Please select a call disposition before applying',
        variant: 'destructive'
      });
      return;
    }

    // Validate ALP for sale disposition
    if (state.selectedDisposition === 'sale') {
      if (!saleData.alp || parseFloat(saleData.alp) <= 0) {
        toast({
          title: 'ALP Required',
          description: 'Please enter a valid Annual Life Premium (ALP) amount for the sale',
          variant: 'destructive'
        });
        return;
      }
    }

    // Booking details are optional - no validation required

    // Pass sale data if applicable and call onApplyDisposition
    try {
      const saleInfo = state.selectedDisposition === 'sale' ? saleData : undefined;
      await onApplyDisposition(saleInfo);
    } catch (error) {
      console.error('❌ Error applying disposition:', error);
      toast({
        title: 'Error Applying Disposition',
        description: error instanceof Error ? error.message : 'Failed to apply disposition. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleCompleteCall = async () => {
    // Button is already disabled if callDurationSeconds <= 0, so no need to check here
    
    // If disposition hasn't been applied yet, apply it first
    if (!dispositionApplied && state.selectedDisposition) {
      await handleApplyDisposition();
    }

    // Validate ALP for sale disposition
    if (state.selectedDisposition === 'sale') {
      if (!saleData.alp || parseFloat(saleData.alp) <= 0) {
        toast({
          title: 'ALP Required',
          description: 'Please enter a valid Annual Life Premium (ALP) amount for the sale',
          variant: 'destructive'
        });
        return;
      }
    }

    // Pass sale data if applicable
    const saleInfo = state.selectedDisposition === 'sale' ? saleData : undefined;
    onCompleteCall(saleInfo);
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
          disabled={!canDisposition}
        >
          <SelectTrigger className={`w-full h-9 ${!canDisposition ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}>
            <SelectValue placeholder={!canDisposition ? "Dial First" : "Select call outcome..."} />
          </SelectTrigger>
          <SelectContent>
            {dispositionOptions.map((option) => {
              const Icon = option.icon;
              const isEnabled = canUseDisposition(option.id, callDurationSeconds, hasActiveCall);
              return (
                <SelectItem 
                  key={option.id} 
                  value={option.id}
                  disabled={!isEnabled}
                  className={!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}
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

      {/* Sale ALP Input - Shows when Sale is selected */}
      {state.selectedDisposition === 'sale' && (
        <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
          <Label htmlFor="alp-amount" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2 block">
            Annual Life Premium (ALP) *
          </Label>
          <Input
            id="alp-amount"
            type="number"
            placeholder="Enter ALP amount"
            value={saleData.alp}
            onChange={(e) => setSaleData(prev => ({ ...prev, alp: e.target.value }))}
            className="w-full h-9 border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500"
            min="0"
            step="0.01"
          />
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            Required for sale disposition
          </p>
        </div>
      )}

      {/* Enhanced Booking Flow */}
      {state.selectedDisposition === 'booked' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-3 space-y-4">
          <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">Appointment Details</h4>
          
          {/* Platform Selection */}
          <div>
            <Label className="text-sm font-medium text-green-700 dark:text-green-300 mb-2 block">
              Platform Type
            </Label>
            <Select value={bookingData.platform} onValueChange={(value: 'aoi' | 'planet') => 
              setBookingData(prev => ({ ...prev, platform: value, service: '' }))
            }>
              <SelectTrigger className="w-full h-9 border-green-300 focus:border-green-500">
                <SelectValue placeholder="Select platform type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aoi">AO Intelligence</SelectItem>
                <SelectItem value="planet">Planet/Off Platform</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Selection */}
          {bookingData.platform && (
            <div>
              <Label className="text-sm font-medium text-green-700 dark:text-green-300 mb-2 block">
                Service Type
              </Label>
              <Select value={bookingData.service} onValueChange={(value) => 
                setBookingData(prev => ({ ...prev, service: value }))
              }>
                <SelectTrigger className="w-full h-9 border-green-300 focus:border-green-500">
                  <SelectValue placeholder="Select service..." />
                </SelectTrigger>
                <SelectContent>
                  {bookingData.platform === 'aoi' ? (
                    <>
                      <SelectItem value="aoi-connect">AOI Connect</SelectItem>
                      <SelectItem value="aoi-plus">AOI Plus</SelectItem>
                      <SelectItem value="aoi-recruit">AOI Recruit</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="aoi-meet">AOI Meet</SelectItem>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Selection */}
          {bookingData.service && (
            <div>
              <Label className="text-sm font-medium text-green-700 dark:text-green-300 mb-2 block">
                Appointment Date
              </Label>
              <Input
                type="date"
                value={bookingData.date}
                onChange={(e) => setBookingData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full h-9 border-green-300 focus:border-green-500 focus:ring-green-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          {/* Time Selection */}
          {bookingData.date && (
            <div>
              <Label className="text-sm font-medium text-green-700 dark:text-green-300 mb-2 block">
                Appointment Time
              </Label>
              <Input
                type="time"
                value={bookingData.time}
                onChange={(e) => setBookingData(prev => ({ ...prev, time: e.target.value }))}
                className="w-full h-9 border-green-300 focus:border-green-500 focus:ring-green-500"
              />
            </div>
          )}

          {bookingData.platform && bookingData.service && bookingData.date && bookingData.time && (
            <div className="bg-green-100 dark:bg-green-800/30 border border-green-300 dark:border-green-700 rounded p-2">
              <p className="text-xs text-green-700 dark:text-green-300">
                <strong>Summary:</strong> {bookingData.platform === 'aoi' ? 'AO Intelligence' : 'Planet/Off Platform'} • {bookingData.service} • {bookingData.date} at {bookingData.time}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Compact Call Notes */}
      <div className="mb-3">
        <Textarea
          placeholder="Add notes about this call..."
          value={state.callNotes || ''}
          onChange={(e) => onNotesChange(e.target.value)}
          className="min-h-[60px] resize-none text-sm"
        />
      </div>

      {/* APPLY Button - Shows when disposition selected but not yet applied AND onApplyDisposition is provided */}
      {state.selectedDisposition && !dispositionApplied && onApplyDisposition && (
        <Button
          onClick={handleApplyDisposition}
          disabled={
            (state.selectedDisposition === 'sale' && (!saleData.alp || parseFloat(saleData.alp) <= 0))
          }
          className="w-full h-9 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium text-sm mb-2"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          APPLY Disposition
        </Button>
      )}

      {/* Complete Call Button - Shows when disposition applied OR no disposition selected */}
      <Button
        onClick={handleCompleteCall}
        disabled={
          !state.selectedDisposition ||
          (state.selectedDisposition === 'sale' && (!saleData.alp || parseFloat(saleData.alp) <= 0))
        }
        className={`w-full h-9 font-medium text-sm ${
          dispositionApplied && state.selectedDisposition
            ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500'
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
        } text-white`}
      >
        <ArrowRight className="h-4 w-4 mr-2" />
        {dispositionApplied && state.selectedDisposition ? 'Complete Call & Dial Next' : 'Complete Call'}
      </Button>
    </div>
  );
}