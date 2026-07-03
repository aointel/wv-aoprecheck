// Shared types for Call Connector Pro components
// No imports - avoid load-order / circular dep issues (ReactNode caused "It" before init)

export interface Lead {
  id: string;
  name: string;
  phone: string;
  leadId: string;
  market: string;
  state: string;
  city?: string;
  email?: string;
  taalk_email?: string;
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
  groupName?: string;
  taalk_secretkey?: string; // Secret key field for verification calls
  secretKey?: string; // Alias from server
  // Hot Lead priority system and source tracking
  isHotLead?: boolean;
  priority?: number;
  taalk_market?: string; // For hotleads with 'Hot Lead Campaign'
  campaign_type?: string; // For legacy hot lead detection
  source_table?: string; // 'hotleads' or 'masterlead'
  isHotlead?: boolean; // Alternative flag
  taalk_lead_id?: string; // Actual Taalk lead ID for hotleads
  isVDPCall?: boolean; // Flag to identify VDP calls
  priority_score?: number; // Priority score for lead ranking
  cnresolution?: string; // ConnectNow resolution status
  corevt?: string; // Core VT status field
  aiSummary?: string;
  ai_summary?: string;
  ai_notes?: string;
  appointment_notes?: string;
  appointment_date?: string | null;
}

export interface CallStatus {
  hasCustomer: boolean;
  hasPendingCall: boolean;
  activeCustomerCall?: any;
  pendingCustomerCall?: any;
  activeproducerConference?: string;
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
  | 'ready'
  | 'error';

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
  | 'sale'
  | '';

export interface DialerState {
  webRTCConferenceActive: boolean;
  powered: boolean; // Add powered state property
  campaignActive: boolean;
  dialingStatus: DialingStatus;
  currentCall: Lead | null;
  currentConferenceName?: string; // Add conference name tracking
  callNotes: string;
  selectedDisposition: CallDisposition;
  dispositionApplied: boolean; // Track if disposition has been applied to masterlead
  availableLeads: Lead[];
  currentLeadIndex: number;
  callStatus: string;
  customerCallStatus: CallStatus;
  vdpCallStatus: VDPCallStatus;
  callDuration: number;
  viewedLead: Lead | null; // For leads selected from search that don't affect queue
  /** When agent accepted an inbound call, show this in the lead card */
  inboundCallInfo?: { from: string; to?: string; callSid?: string } | null;
  /** Lead from masterlead for the inbound caller (set when they accept) */
  inboundCallLead?: Lead | null;
}

export type SubscriptionPlan = 'starter' | 'professional';

export type PlanOption = {
  plan: SubscriptionPlan;
  label: string;
  price: string;
  priceSuffix: string;
  tagline: string;
  cardClass: string;
  gradientClass: string;
  bodyClass: string;
  buttonClass: string;
  icon: any;
  benefits: string[];
  ctaLabel: string;
  topBanner?: string;
};

// Global type declarations
declare global {
  interface Window {
    twilioDevice: any;
  }
}