import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiSkipForward, FiPlay } from 'react-icons/fi';
import { ChevronDown, Power, CheckCircle, XCircle, Clock, PhoneOff, Ban, ArrowRight } from 'lucide-react';
import { DialerState, CallDisposition } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface CallControlsProps {
  state: DialerState;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onSkipLead: () => void;
  onPowerToggle?: () => void;
  onDispositionSelect?: (disposition: CallDisposition) => void;
  onPauseDialing?: () => void;
  onStartDialing?: () => void;
  onCompleteCall?: () => void;
  onDialNextLead?: () => void;
}

export default function CallControls({ 
  state, 
  onStartCall, 
  onEndCall, 
  onToggleMute,
  onSkipLead,
  onPowerToggle,
  onDispositionSelect,
  onPauseDialing,
  onStartDialing,
  onCompleteCall,
  onDialNextLead
}: CallControlsProps) {
  const isConnected = false; // Force reset - no WebRTC connection active
  const canDial = state.webRTCConferenceActive && state.availableLeads.length > 0;

  // Debug logging for state
  console.log('🔍 CallControls State Debug:', {
    webRTCConferenceActive: state.webRTCConferenceActive,
    availableLeadsCount: state.availableLeads.length,
    canDial: canDial,
    powered: state.powered,
    isConnected: isConnected
  });

  // Debug logging for state
  console.log('🔍 CallControls State Debug:', {
    webRTCConferenceActive: state.webRTCConferenceActive,
    availableLeadsCount: state.availableLeads.length,
    canDial: canDial,
    powered: state.powered,
    isConnected: isConnected
  });

  const dispositionOptions = [
    { id: 'interested' as CallDisposition, label: 'Interested', icon: CheckCircle, color: 'text-green-600' },
    { id: 'not_interested' as CallDisposition, label: 'Not Interested', icon: XCircle, color: 'text-blue-600' },
    { id: 'callback' as CallDisposition, label: 'Callback', icon: Clock, color: 'text-yellow-600' },
    { id: 'no_answer' as CallDisposition, label: 'No Answer', icon: PhoneOff, color: 'text-gray-600' },
    { id: 'dnc' as CallDisposition, label: 'Do Not Call', icon: Ban, color: 'text-red-600' }
  ];

  return (
    <div className="space-y-4">
      {/* Main Call Controls Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column: GIANT Start Dialing/Pause Button - Takes 2 rows worth of height */}
        <div className="row-span-2">
          <Button 
            onClick={() => {
              console.log('🎯 START DIALING BUTTON CLICKED!');
              console.log('State check:', { 
                campaignActive: state.campaignActive, 
                isConnected, 
                canDial,
                dialingStatus: state.dialingStatus
              });
              
              if (state.campaignActive && !isConnected) {
                console.log('-> Calling onPauseDialing');
                onPauseDialing?.();
              } else if (canDial && !isConnected) {
                console.log('-> Calling onStartDialing or onStartCall');
                (onStartDialing || onStartCall)?.();
              } else {
                console.log('-> Calling onEndCall');
                onEndCall?.();
              }
            }}
            disabled={!canDial && !isConnected && !state.campaignActive}
            variant={isConnected ? "destructive" : "default"}
            className={`w-full h-32 text-2xl font-bold transition-all duration-300 ${
              !state.webRTCConferenceActive && !isConnected && !state.campaignActive
                ? 'opacity-50 cursor-not-allowed bg-gray-300 border-2 border-dashed border-gray-400' 
                : isConnected 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : state.campaignActive && !isConnected
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isConnected ? (
              <>
                <FiPhoneOff className="w-10 h-10 mr-4" />
                END CALL
              </>
            ) : state.campaignActive ? (
              <>
                <Clock className="w-10 h-10 mr-4" />
                PAUSE DIALING
              </>
            ) : canDial ? (
              <>
                <FiPhone className="w-10 h-10 mr-4" />
                START DIALING
              </>
            ) : !state.webRTCConferenceActive ? (
              <>
                <Power className="w-10 h-10 mr-4" />
                WebRTC not turned on, select power first
              </>
            ) : (
              <>
                <FiPhone className="w-10 h-10 mr-4" />
                Select leads first
              </>
            )}
          </Button>
        </div>

        {/* Right Column Top: Hold and End Call */}
        <div className="grid grid-cols-2 gap-2">
          {/* Hold Button */}
          <Button 
            variant="outline"
            className="h-12 bg-yellow-100 border-yellow-300 hover:bg-yellow-200 text-yellow-700 font-medium"
            disabled={!isConnected}
          >
            <Clock className="w-4 h-4 mr-1" />
            Hold
          </Button>

          {/* End Call Button */}
          <Button 
            onClick={onEndCall}
            variant="outline"
            className="h-12 bg-red-100 border-red-300 hover:bg-red-200 text-red-700 font-medium"
            disabled={!isConnected}
          >
            <FiPhoneOff className="w-4 h-4 mr-1" />
            End Call
          </Button>
        </div>

        {/* Right Column Bottom: Disposition Dropdown */}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full h-12 bg-purple-100 border-purple-300 hover:bg-purple-200 text-purple-700 font-medium"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Select disposition...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {dispositionOptions.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onClick={() => onDispositionSelect?.(option.id)}
                  className="flex items-center gap-2 py-2"
                >
                  <option.icon className={`w-4 h-4 ${option.color}`} />
                  <span>{option.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>


      </div>

      {/* Complete & Next Lead Button - Unified workflow control */}
      <div className="w-full">
        <Button
          onClick={async () => {
            if (isConnected) {
              // Complete current call first
              await onCompleteCall?.();
              // Then automatically dial next lead after short delay
              setTimeout(() => {
                onDialNextLead?.();
              }, 500);
            } else if (canDial) {
              // If not connected, just dial next lead
              onDialNextLead?.();
            }
          }}
          disabled={!isConnected && !canDial}
          className={`w-full h-12 text-white font-bold transition-all duration-200 ${
            (isConnected || canDial)
              ? 'bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 hover:from-purple-500 hover:via-blue-500 hover:to-green-500 hover:scale-[1.02] shadow-lg'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          style={
            (isConnected || canDial)
              ? {
                  boxShadow: '0 0 20px rgba(147, 51, 234, 0.4)'
                }
              : {}
          }
        >
          <>
            <CheckCircle className="w-5 h-5 mr-2" />
            Complete Call and Dial Next Lead
          </>
        </Button>
      </div>
    </div>
  );
}