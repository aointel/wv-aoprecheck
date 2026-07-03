import { FiPhone, FiPhoneOff, FiSkipForward, FiPlay } from 'react-icons/fi';
import { ChevronDown, CheckCircle, XCircle, Clock, PhoneOff, Ban, ArrowRight, Phone, Video, Calendar, Zap, DollarSign, Users, RotateCcw, Circle, Grid3x3, Power, Mic } from 'lucide-react';
import { DialerState, CallDisposition } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleAppointmentModal } from '@/components/appointments/SimpleAppointmentModal';
import { AOIMeetModal } from '@/components/modals/AOIMeetModal';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { segmentedFetch } from '@/lib/queryClient';

import React, { useState, useRef, useEffect } from 'react';

interface CallControlsProps {
  state: DialerState;
  currentLead?: any; // VDP-aware current lead data
  vdpOnline?: boolean; // VDP online/offline status - used for status indicator
  onStartCall: () => void;
  onEndCall: () => void;
  onSkipLead: () => void;
  onPowerToggle?: () => void; // Power button handler
  duplicateSession?: boolean; // Another tab has the same Twilio identity registered
  onDispositionSelect?: (disposition: CallDisposition) => void;
  onPauseDialing?: () => void;
  onStartDialing?: () => void;
  onCompleteCall?: () => void;
  onDialNextLead?: () => void;
  onRedial?: () => void;
  onPreviousLead?: () => void;
  onNextLead?: () => void;
  selectedDisposition?: CallDisposition | string | null; // Current selected disposition
  dispositionApplied?: boolean; // Track if disposition has been applied to masterlead
  onApplyDisposition?: () => void; // Handler to apply disposition to masterlead
  onUndo?: () => void; // Handler to undo last disposition and go back to previous lead
  canUndo?: boolean; // Whether undo is available
  userEmail?: string;
  callDurationSeconds?: number; // Call timer in seconds
  dailyStats?: { total_dialed?: number; reached?: number; booked?: number }; // Daily stats
  hasRecentCall?: boolean; // Whether agent called this lead in last 24 hours
  producerSummary?: { associateId?: string; market?: string | string[]; states?: string[] } | null; // Producer row (moved to VDP panel header)
  onQueueModeChange?: (mode: 'standard' | 'hotlead') => void; // Parent can track Standard vs Hot Lead for shortcuts etc.
  queueMode?: 'standard' | 'hotlead'; // Controlled from parent (toggle lives above VDP panel)
  /** When set, main Complete button calls this instead of onCompleteCall+onDialNextLead (e.g. double-dial: redial then next). */
  onCompleteAndContinue?: () => Promise<void> | void;
  /** Double-dial mode: first Complete = redial same, second = dial next. */
  doubleDialMode?: boolean;
  onDoubleDialModeChange?: (checked: boolean) => void;
  /** When double-dial mode is on, true = next Complete will redial; false = will dial next. Used for button label. */
  completeNextIsRedial?: boolean;
  /** When true, show Mic icon and flash blue (mic permission issue); otherwise show Power icon for WebRTC on/off. */
  micIssue?: boolean;
  /** Visible throttle after each dial starts; Complete/Dial Next is disabled while > 0. */
  completeCooldownSeconds?: number;
}

export default function CallControls({ 
  state, 
  currentLead: propCurrentLead,
  vdpOnline = false, // Default to false if not provided
  onStartCall, 
  onEndCall, 
  onSkipLead,
  onPowerToggle,
  duplicateSession,
  onDispositionSelect,
  onPauseDialing,
  onStartDialing,
  onCompleteCall,
  onDialNextLead,
  onRedial,
  onPreviousLead,
  onNextLead,
  selectedDisposition,
  dispositionApplied = false,
  onApplyDisposition,
  onUndo,
  canUndo = false,
  userEmail,
  callDurationSeconds = 0,
  dailyStats,
  hasRecentCall = false,
  producerSummary,
  onQueueModeChange,
  queueMode: propQueueMode = 'hotlead',
  onCompleteAndContinue,
  doubleDialMode = false,
  onDoubleDialModeChange,
  completeNextIsRedial,
  micIssue = false,
  completeCooldownSeconds = 0,
}: CallControlsProps) {

  const { toast } = useToast();
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isAOIMeetOpen, setIsAOIMeetOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [showStatsPopover, setShowStatsPopover] = useState(false);
  const [localCooldownSeconds, setLocalCooldownSeconds] = useState(0);
  const mainActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const combinedActionInFlightRef = useRef(false);
  const localCooldownTimerRef = useRef<number | null>(null);
  const queueMode = propQueueMode;

  const startLocalCooldown = (seconds = 3) => {
    if (localCooldownTimerRef.current) {
      window.clearInterval(localCooldownTimerRef.current);
      localCooldownTimerRef.current = null;
    }
    setLocalCooldownSeconds(seconds);
    localCooldownTimerRef.current = window.setInterval(() => {
      setLocalCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (localCooldownTimerRef.current) {
            window.clearInterval(localCooldownTimerRef.current);
            localCooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => {
    if (localCooldownTimerRef.current) {
      window.clearInterval(localCooldownTimerRef.current);
    }
  }, []);
  
  // Fetch detailed stats by associate/veteran and by state
  const { data: detailedStats } = useQuery({
    queryKey: ['/api/outbound-dialer/detailed-stats', userEmail],
    queryFn: async () => {
      if (!userEmail) return null;
      const response = await segmentedFetch(`/api/outbound-dialer/detailed-stats?userEmail=${encodeURIComponent(userEmail)}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!userEmail && showStatsPopover,
    refetchInterval: 300000, // 5 min
  });
  // Use VDP-aware current lead from prop, fallback to state-based lead
  const currentLead = propCurrentLead || state.availableLeads[state.currentLeadIndex];
  const isHotLead = currentLead?.isHotLead || currentLead?.market === 'Hot Lead';
  
  // Check if this is a recruit candidate (AO Recruit market or has recruit-specific fields)
  const isRecruit = currentLead?.market === 'AO Recruit' || 
                    currentLead?.market === 'aorecruit' ||
                    currentLead?.candidateId !== undefined ||
                    currentLead?.current_stage_id !== undefined ||
                    currentLead?.currentStageId !== undefined;
  
  // Allow disposition ONLY when a call was made (dialed/attempted) - not on lead view alone
  const hadCallAttempt = state.currentCall !== null ||
                         state.dialingStatus === 'dialing' ||
                         state.dialingStatus === 'ringing' ||
                         state.dialingStatus === 'in_progress' ||
                         state.callStatus === 'connected' ||
                         state.callStatus === 'in_call' ||
                         state.webRTCConferenceActive;
  const canDisposition = hadCallAttempt || callDurationSeconds > 0 || hasRecentCall || currentLead?.hasRecentCall;

  
  // Active call RIGHT NOW (for main button: END CALL vs START DIALING). Use only dialing/call status.
  // Do NOT use currentCall or callDuration here – after hangup we keep lead + duration for disposition,
  // but the main button must switch to START DIALING.
  const isConnected = state.dialingStatus === 'connected' || 
                      state.dialingStatus === 'in_progress' ||
                      state.callStatus === 'connected' ||
                      state.callStatus === 'in_call' ||
                      state.callStatus === 'connected_direct' ||
                     // Inbound call accepted: dialingStatus stays 'idle' but inboundCallInfo is set
                     !!state.inboundCallInfo;
  const isCallStarting = state.dialingStatus === 'ringing' ||
                     state.dialingStatus === 'dialing' ||
                      state.callStatus === 'calling_direct' ||
                      state.callStatus === 'connecting_direct' ||
                     state.callStatus === 'dialing_lead';
  
  // Button enables ONLY when there was an actual call (active or just ended).
  const canUseCompleteButton = callDurationSeconds > 0 || hadCallAttempt;
  
  // CRITICAL FIX: Allow dialing when there are regular leads OR when there's an active VDP call
  const hasVdpCall = propCurrentLead?.isVDPCall === true;
  // WebRTC (Power On) and TaskRouter (Online/Offline) are SEPARATE. Start Dialing = WebRTC powered only.
  // Do NOT tie canDial to vdpOnline/queueMode — that's inbound. Outbound = Power On.
  const canDial = !!userEmail && state.powered && (state.availableLeads.length > 0 || hasVdpCall);
  // Redial: allow when canDial OR when on an active call with a current lead that has a phone (e.g. inbound)
  const canRedial = canDial || (isConnected && !!propCurrentLead?.phone);

  // After an attempted dial, agents must be able to resolve the lead even if
  // the call never connected and duration stayed at zero.
  const canUseDisposition = (disposition: string, callDurationSeconds: number, _isConnected: boolean): boolean => {
    const disp = disposition.toLowerCase();
    const exempt = ['no_answer', 'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number', 'bad_number'];
    if (exempt.includes(disp)) return true;
    return canDisposition || callDurationSeconds > 0;
  };
  
  // Disposition options - different for recruit vs sales
  // ALL options are included - they will be grayed out if duration requirements aren't met
  const baseRecruitOptions = [
    // RECRUIT/INTERVIEW DISPOSITIONS
    { id: 'call_back' as CallDisposition, label: 'Callback', icon: Clock, color: 'text-yellow-600' },
    { id: 'no_answer_vm' as CallDisposition, label: 'No Answer / Voicemail', icon: PhoneOff, color: 'text-gray-600' },
    { id: 'booked' as CallDisposition, label: 'Interview Scheduled', icon: CheckCircle, color: 'text-green-600' },
    { id: 'instant_presentation' as CallDisposition, label: 'Qualified / Interested', icon: Zap, color: 'text-blue-600' },
    { id: 'sale' as CallDisposition, label: 'Hired', icon: DollarSign, color: 'text-green-600' },
    { id: 'not_interested' as CallDisposition, label: 'Not Interested', icon: XCircle, color: 'text-red-600' },
    { id: 'already_been_sold' as CallDisposition, label: 'Already Interviewed', icon: CheckCircle, color: 'text-purple-600' },
    { id: 'medically_uninsurable' as CallDisposition, label: 'Not Qualified', icon: XCircle, color: 'text-orange-600' },
    { id: 'dnc' as CallDisposition, label: 'Do Not Call', icon: Ban, color: 'text-red-600' },
    { id: 'wrong_number' as CallDisposition, label: 'Wrong Number', icon: Phone, color: 'text-orange-600' }
  ];
  
  const baseSalesOptions = [
    // SALES DISPOSITIONS (original)
    { id: 'call_back' as CallDisposition, label: 'Callback', icon: Clock, color: 'text-yellow-600' },
    { id: 'no_answer_vm' as CallDisposition, label: 'No Answer / Voicemail', icon: PhoneOff, color: 'text-gray-600' },
    { id: 'booked' as CallDisposition, label: 'Booked', icon: CheckCircle, color: 'text-green-600' },
    { id: 'instant_presentation' as CallDisposition, label: 'Instant Presentation', icon: Zap, color: 'text-blue-600' },
    { id: 'sale' as CallDisposition, label: 'Sale', icon: DollarSign, color: 'text-green-600' },
    { id: 'not_interested' as CallDisposition, label: 'Not Interested', icon: XCircle, color: 'text-red-600' },
    { id: 'already_been_sold' as CallDisposition, label: 'Already Been Seen', icon: CheckCircle, color: 'text-purple-600' },
    { id: 'over_age' as CallDisposition, label: 'Over Age', icon: Clock, color: 'text-amber-600' },
    { id: 'dnc' as CallDisposition, label: 'Do Not Call', icon: Ban, color: 'text-red-600' },
    { id: 'wrong_number' as CallDisposition, label: 'Wrong Number', icon: Phone, color: 'text-orange-600' }
  ];
  
  const dispositionOptions = isRecruit ? baseRecruitOptions : baseSalesOptions;

  // Main action button handler (power and Online/Offline stay in sync via same handler)
  const handleMainAction = () => {
    console.log('State check:', { 
      webRTCConferenceActive: state.webRTCConferenceActive,
      powered: state.powered,
      campaignActive: state.campaignActive, 
      canDial,
      isConnected,
      dialingStatus: state.dialingStatus,
      currentCall: state.currentCall
    });
    
    // Check for active call/dialing FIRST
    const isDialing = state.dialingStatus === 'dialing' || state.dialingStatus === 'ringing';
    
    if (isConnected || isDialing) {
      console.log('-> Calling onEndCall (call is active/dialing)');
      onEndCall();
      return;
    }
    
    if (canDial || state.campaignActive) {
      console.log('-> Calling onStartDialing (including VDP calls)');
      onStartDialing?.();
    } else if (hasVdpCall) {
      console.log('-> VDP call available, calling onStartDialing');
      onStartDialing?.();
    }
  };

  // Get main action button state
  const getMainActionButton = () => {
    // Check for active call/dialing FIRST
    const isDialing = isCallStarting;
    
    if (isConnected || isDialing) {
      return {
        label: isDialing ? 'CALL STARTING...' : 'END CALL',
        icon: isDialing ? Clock : FiPhoneOff,
        bgColor: isDialing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700',
        textColor: 'text-white'
      };
    }
    
    // START DIALING – disabled when no leads
    return {
      label: 'START DIALING',
      icon: FiPhone,
      bgColor: 'bg-green-600 hover:bg-green-700',
      textColor: 'text-white'
    };
  };

  // Determine aura state for button (similar to boost aura)
  const isDialing = isCallStarting || state.campaignActive;
  const mainAction = getMainActionButton();
  const MainIcon = mainAction.icon;
  const showCompleteAction = isConnected || isDialing || canUseCompleteButton;
  const displayedCooldownSeconds = Math.max(completeCooldownSeconds, localCooldownSeconds);
  const completeCoolingDown = displayedCooldownSeconds > 0;
  const showDialingAura = isDialing && !isConnected;
  const showOnCallAura = isConnected;

  // Combined handler: starts dialing or completes call and dials next (or redial when double-dial).
  // WebRTC should already be auto-started by the page; this button should not power it on itself.
  // CRITICAL: Only Accept answers an incoming call. Ringing = End only; connected = Complete + dial next.
  const handleCombinedAction = async () => {
    if (combinedActionInFlightRef.current) return;
    if (completeCoolingDown) return;
    combinedActionInFlightRef.current = true;
    try {
    startLocalCooldown(3);
    // Once a call attempt exists, the main action is always Complete & Dial Next.
    // That includes ringing/connecting calls after the 3-second throttle.
    if (showCompleteAction) {
      if (onCompleteAndContinue) {
        await onCompleteAndContinue();
        return;
      }
      await onCompleteCall?.();
      onDialNextLead?.();
      return;
    }

    if (onStartDialing) {
      await onStartDialing();
    } else {
      onStartCall?.();
    }
    } finally {
      window.setTimeout(() => {
        combinedActionInFlightRef.current = false;
      }, 150);
    }
  };

  useEffect(() => {
    const node = mainActionButtonRef.current;
    if (!node) return;
    const nativeHandler = (event: MouseEvent) => {
      event.preventDefault();
      void handleCombinedAction();
    };
    node.addEventListener('click', nativeHandler);
    return () => node.removeEventListener('click', nativeHandler);
  }, [handleCombinedAction]);

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-white to-blue-50/40 border-l border-blue-100 shadow-lg rounded-lg overflow-hidden">
      {/* Top accent strip */}
      <div className="h-0.5 w-full bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 shrink-0" />

      {/* ── Row 1: Main action + power orb ── */}
      <div className="px-3 pt-2 pb-1.5 flex gap-2 items-center min-w-0 flex-shrink-0">
        <Button
          ref={mainActionButtonRef}
          disabled={
            completeCoolingDown ||
            (!state.powered && !state.campaignActive && !isConnected && !isDialing) ||
            (state.webRTCConferenceActive && !canDial && !state.campaignActive && !isConnected && !hasVdpCall)
          }
          className={`flex-1 min-w-0 h-8 rounded-lg font-bold text-xs transition-all duration-300 active:scale-95 ${
            completeCoolingDown
              ? 'bg-slate-500 text-white border-slate-400 border-2 cursor-not-allowed shadow-md'
              : showDialingAura
              ? `${mainAction.bgColor} ${mainAction.textColor} border-blue-400 border-2 ring-2 ring-purple-300/50 shadow-xl shadow-blue-500/40`
              : showOnCallAura
                ? `${mainAction.bgColor} ${mainAction.textColor} border-green-400 border-2 ring-2 ring-green-300/50 shadow-xl shadow-green-500/40`
                : isConnected
                  ? 'bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-md'
                  : `${mainAction.bgColor} ${mainAction.textColor} shadow-md`
          }`}
          style={{
            boxShadow: completeCoolingDown
              ? '0 0 12px rgba(100,116,139,0.35)'
              : showDialingAura
              ? '0 0 20px rgba(96,165,250,0.5), 0 0 40px rgba(147,197,253,0.3)'
              : showOnCallAura
                ? '0 0 20px rgba(34,197,94,0.5), 0 0 40px rgba(74,222,128,0.3)'
                : (isConnected || state.campaignActive ? '0 0 14px rgba(239,68,68,0.3)' : '0 2px 8px rgba(0,0,0,0.12)')
          }}
        >
          <div className="flex items-center justify-center gap-1 min-w-0 overflow-hidden">
            {(completeCoolingDown || showCompleteAction) ? (
              <>
                {completeCoolingDown ? <Clock className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                <span className="text-[10px] truncate whitespace-nowrap">
                  {completeCoolingDown
                    ? `Ready in ${displayedCooldownSeconds}`
                    : doubleDialMode && completeNextIsRedial ? 'Complete & Redial' : state.inboundCallInfo ? 'Complete Call / Dial Next' : 'Complete & Dial Next'}
                </span>
              </>
            ) : (
              <>
                <MainIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] truncate whitespace-nowrap">{mainAction.label}</span>
              </>
            )}
          </div>
        </Button>

        {/* Restore explicit call-control buttons for agents */}
        {(state.campaignActive && !isConnected && !isCallStarting && onPauseDialing) && (
          <Button
            type="button"
            onClick={onPauseDialing}
            className="h-8 shrink-0 rounded-lg bg-amber-500 px-2 text-[10px] font-bold text-white hover:bg-amber-600"
            title="Stop Dialing"
          >
            STOP DIALING
          </Button>
        )}

        {(isConnected || isCallStarting) && (
          <Button
            type="button"
            onClick={onEndCall}
            className="h-8 shrink-0 rounded-lg bg-red-600 px-2 text-[10px] font-bold text-white hover:bg-red-700"
            title="End Call"
          >
            END CALL
          </Button>
        )}

        {/* Disposition trigger — 1/3 width, inline with main action */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={!canDisposition}
              className={`w-[33%] shrink-0 h-8 rounded-lg font-semibold text-xs transition-all duration-200 active:scale-95 flex items-center justify-center gap-1 ${
                !canDisposition
                  ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                  : selectedDisposition
                    ? dispositionApplied
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 text-blue-700 hover:border-blue-400'
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 text-green-700 hover:border-green-400'
                    : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 text-indigo-700 hover:border-indigo-300'
              }`}
            >
              {selectedDisposition ? (
                <>
                  {(() => { const Icon = dispositionOptions.find(o => o.id === selectedDisposition)?.icon || CheckCircle; return <Icon className="w-3 h-3 shrink-0" />; })()}
                  <span className="text-[9px] font-bold truncate">{dispositionOptions.find(o => o.id === selectedDisposition)?.label ?? 'Disposition'}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 shrink-0" />
                  <span className="text-[9px] font-bold">{!canDisposition ? 'Dial First' : 'Disposition'}</span>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-52 z-50" sideOffset={4}>
            {dispositionOptions.map((option) => {
              const isEnabled = canUseDisposition(option.id, callDurationSeconds, isConnected);
              return (
                <DropdownMenuItem
                  key={option.id}
                  onClick={() => { if (isEnabled) onDispositionSelect?.(option.id); }}
                  disabled={!isEnabled}
                  className={`flex items-center gap-2 py-1.5 text-sm ${selectedDisposition === option.id ? 'bg-indigo-50' : ''} ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <option.icon className={`w-3.5 h-3.5 ${option.color}`} />
                  <span className="text-xs">{option.label}</span>
                  {selectedDisposition === option.id && <CheckCircle className="w-3 h-3 ml-auto text-indigo-600" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Double-dial toggle — 2× + phone icon */}
        {onDoubleDialModeChange != null && (
          <button
            type="button"
            onClick={() => onDoubleDialModeChange(!doubleDialMode)}
            title={doubleDialMode ? 'Double dial ON (tap to disable)' : 'Double dial OFF (tap to enable)'}
            className={`flex items-center gap-0.5 h-8 px-2 rounded-lg border font-bold transition-all duration-200 active:scale-95 shrink-0 ${
              doubleDialMode
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.55)]'
                : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-200 hover:text-indigo-500'
            }`}
          >
            <span className="text-[11px] font-black leading-none">2×</span>
            <Phone className="w-3 h-3" />
          </button>
        )}

        {/* Power / mic orb — compact */}
        <div className="relative inline-flex shrink-0">
          <div
            role="status"
            aria-label={micIssue ? 'Microphone required' : duplicateSession ? 'Multiple sessions' : (state.powered ? 'WebRTC on' : 'WebRTC off')}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all ${
              micIssue
                ? 'text-blue-500 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse'
                : duplicateSession
                  ? 'text-yellow-400 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse'
                  : state.powered
                    ? 'text-green-500 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.75)]'
                    : 'text-red-500 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.75)] animate-pulse'
            }`}
            title={micIssue ? 'Microphone required' : duplicateSession ? 'Another tab has this identity registered' : (state.powered ? 'WebRTC on' : 'WebRTC off')}
          >
            {micIssue ? <Mic className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </div>
          {duplicateSession && (
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-400 text-black text-[9px] font-bold leading-none">!</span>
          )}
        </div>
      </div>
      {/* Gradient divider */}
      <div className="h-px mx-3 bg-gradient-to-r from-transparent via-blue-100 to-transparent shrink-0" />

      {/* ── Row 2: Icon toolbar + double-dial toggle ── */}
      <div className="px-3 py-1.5 flex-shrink-0">
        <div className="flex gap-1.5 items-center justify-center bg-blue-50/60 border border-blue-100/80 rounded-lg px-2 py-1.5 shadow-inner">
          {/* Undo */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo || !onUndo}
            title={canUndo && onUndo ? 'Undo last action' : 'No action to undo'}
            className={`flex items-center justify-center h-7 w-7 rounded-md border transition-all duration-200 active:scale-95 ${
              canUndo && onUndo
                ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                : 'bg-white/50 border-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Keypad */}
          <button
            type="button"
            onClick={() => setIsKeypadOpen(!isKeypadOpen)}
            title="Keypad"
            className={`flex items-center justify-center h-7 w-7 rounded-md border transition-all duration-200 active:scale-95 shadow-sm ${
              isKeypadOpen
                ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
          </button>

          {/* Redial */}
          <button
            type="button"
            onClick={() => { if (!canRedial || !onRedial) return; onRedial(); }}
            disabled={!canRedial || !onRedial}
            title="Redial"
            className={`flex items-center justify-center h-7 w-7 rounded-md border transition-all duration-200 active:scale-95 shadow-sm ${
              canRedial && onRedial
                ? 'bg-gradient-to-br from-orange-400 to-red-500 border-orange-300 text-white hover:from-orange-500 hover:to-red-600'
                : 'bg-white/50 border-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
          </button>

          {/* Meet */}
          <button
            type="button"
            onClick={() => setIsAOIMeetOpen(true)}
            title="Meet"
            className="flex items-center justify-center h-7 w-7 rounded-md border border-emerald-200 bg-gradient-to-br from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 text-white transition-all duration-200 active:scale-95 shadow-sm"
          >
            <Users className="w-3.5 h-3.5" />
          </button>

          {/* End Call — only when connected */}
          {isConnected && (
            <button
              type="button"
              onClick={onEndCall}
              title="End Call"
              className="flex items-center justify-center h-7 w-7 rounded-md border border-red-200 bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white transition-all duration-200 active:scale-95 shadow-sm"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          )}


        </div>

        {/* Keypad panel */}
        {isKeypadOpen && (
          <div className="mt-1.5 bg-gradient-to-b from-blue-50 to-white rounded-xl p-2.5 border border-blue-100 shadow-sm animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
                <button
                  key={key}
                  type="button"
                  className="h-9 rounded-lg font-bold text-sm bg-white border border-blue-100 text-gray-700 hover:bg-blue-50 hover:border-blue-200 active:scale-95 transition-all duration-150 shadow-sm"
                  onClick={() => console.log('Keypad pressed:', key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gradient divider */}
      <div className="h-px mx-3 bg-gradient-to-r from-transparent via-blue-100 to-transparent shrink-0" />

      {/* Apply bar — only shown when disposition picked but not yet applied */}
      {selectedDisposition && !dispositionApplied && onApplyDisposition && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onApplyDisposition}
            className="w-full h-7 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-[10px] tracking-wide transition-all duration-200 active:scale-95 shadow-sm flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-3 h-3" />
            APPLY DISPOSITION
          </button>
        </div>
      )}

      {/* AO Meet Modal */}
      <AOIMeetModal
        isOpen={isAOIMeetOpen}
        onClose={() => setIsAOIMeetOpen(false)}
        lead={currentLead}
      />

      {/* Schedule Appointment Modal */}
      <SimpleAppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        lead={currentLead}
        userEmail={userEmail}
      />
    </div>
  );
}
