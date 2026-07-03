// Shared types for Call Connector Pro components

export interface Lead {
  id: string;
  name: string;
  phone: string;
  leadId: string;
  market: string;
  state: string;
  city?: string;
  email?: string;
  status: string;
  timestamp: string;
  notes?: string;
  call_count?: number;
  rawWebhookData?: any;
  // Relationship section fields
  beneficiary?: string;
  relationship?: string;
  referredBy?: string;
  sponsorOrg?: string;
  groupCode?: string;
}

export interface CallStatus {
  hasCustomer: boolean;
  hasPendingCall: boolean;
  activeCustomerCall?: any;
  pendingCustomerCall?: any;
  activeAgentConference?: string;
  status?: string;
  message?: string;
}

export interface VDPCallStatus {
  hasVDPCall: boolean;
  vdpCall: any;
  countdownValue: number;
  countdownActive: boolean;
}

export type DialingStatus =
  | 'idle'
  | 'dialing'
  | 'ringing'
  | 'connected'
  | 'paused'
  | 'ready';

export type CallDisposition = 
  | 'no_answer_vm'
  | 'booked'
  | 'instant_presentation'
  | 'call_back'
  | 'not_interested'
  | 'medically_uninsurable'
  | 'duplicate'
  | 'do_not_call'
  | 'already_been_sold'
  | 'pending'
  | 'medically_uninsurable'
  | 'duplicate'
  | 'do_not_call'
  | 'already_been_sold'
  | '';

export interface DialerState {
  webRTCConferenceActive: boolean;
  powered: boolean; // Add powered state property
  campaignActive: boolean;
  dialingStatus: DialingStatus;
  currentCall: Lead | null;
  callNotes: string;
  selectedDisposition: CallDisposition;
  availableLeads: Lead[];
  currentLeadIndex: number;
  callStatus: string;
  customerCallStatus: CallStatus;
  vdpCallStatus: VDPCallStatus;
  isMuted: boolean;
  callDuration: number;
}

// Global type declarations
declare global {
  interface Window {
    twilioDevice: any;
  }
}