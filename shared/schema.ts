import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb, varchar, uuid, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";

// Role and Page Permission Types
export const ROLES = ['system_admin', 'rga', 'mga', 'agent', 'quality_manager', 'ao_quality_manager'] as const;
export const PAGE_KEYS = [
  'billing-dashboard',
  'aoi-report', 
  'appointments',
  'ao-recruit',
  'ao-precheck',
  'settings',
  'ao-intelligence',
  'ao-connect',
  'subscription',
  'ao-precheck-management',
  'admin',
  'user-management',
  'teams-management'
] as const;

export type TeamRole = typeof ROLES[number];
export type PageKey = typeof PAGE_KEYS[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  agentPhone: text("agent_phone"), // Agent's phone number for SMS notifications
  agentName: text("agent_name"), // Agent's full name
});

// SIMPLE CALL TRACKING - ONE SOURCE OF TRUTH
export const callLogs = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  twilioCallSid: text("twilio_call_sid").notNull().unique(),
  agentEmail: text("agent_email").notNull(), // Who made the call
  toNumber: text("to_number").notNull(), // Number called
  fromNumber: text("from_number").notNull(), // Number calling from
  callStatus: text("call_status").notNull(), // completed, no-answer, busy, failed
  callDuration: integer("call_duration").default(0), // Duration in seconds
  callStartedAt: timestamp("call_started_at").notNull(),
  callEndedAt: timestamp("call_ended_at"),
  isReached: boolean("is_reached").default(false), // Duration > 30 seconds
  isBooked: boolean("is_booked").default(false), // Duration > 120 seconds  
  createdAt: timestamp("created_at").defaultNow(),
});

// AGENT DIAL METRICS - Independent tracking of dial/reach/booked metrics
// This table tracks metrics separately from masterlead so leads can be cleaned/reassigned without losing historical data
export const agentDialMetrics = pgTable("agent_dial_metrics", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(), // Who made the call
  agentName: text("agent_name"),
  leadId: integer("lead_id"), // Reference to masterlead.id (nullable since leads can be deleted/reassigned)
  leadPhone: text("lead_phone").notNull(), // Store phone for historical tracking even if lead is deleted
  leadName: text("lead_name"),
  leadState: text("lead_state"),
  eventType: text("event_type").notNull(), // 'dial', 'reach', 'booked'
  eventTimestamp: timestamp("event_timestamp", { withTimezone: true }).notNull().defaultNow(),
  callDuration: integer("call_duration"), // Duration in seconds
  callStatus: text("call_status"), // 'completed', 'no_answer', 'busy', 'failed', etc.
  disposition: text("disposition"), // Call disposition if available
  callSid: text("call_sid"), // Twilio call SID if available
  source: text("source"), // 'dialer', 'vdp', 'manual', 'hotlead', etc.
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentProfiles = pgTable("agent_profiles", {
  id: serial("id").primaryKey(),
  supabaseUserId: text("supabase_user_id").notNull().unique(), // Links to Supabase auth.users.id
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  zoomId: text("zoom_id"),
  zoomPassword: text("zoom_password").default("1"),
  profilePicture: text("profile_picture"),
  googleTokens: text("google_tokens"), // Google Calendar OAuth tokens JSON
  
  // HOTLEAD DISTRIBUTION FIELDS
  isActive: boolean("is_active").default(true), // Whether agent is active for lead distribution
  licenseStates: jsonb("license_states").default(sql`'[]'::jsonb`), // Array of state codes agent is licensed in ["TX", "FL", "CA"]
  authorizedMarkets: jsonb("authorized_markets").default(sql`'[]'::jsonb`), // Array of markets agent can work ["Market A", "Market B"]
  maxHotleads: integer("max_hotleads").default(50), // Maximum hotleads this agent can handle
  currentHotleadCount: integer("current_hotlead_count").default(0), // Current number of assigned hotleads
  lastActivityDate: timestamp("last_activity_date"), // Last time agent was active (calls, logins, etc.)
  distributionPriority: integer("distribution_priority").default(1), // 1=highest, 5=lowest priority for lead assignment
  
  // ACCESS CONTROL
  callConnectorProAccess: boolean("call_connector_pro_access").default(false), // Whether user can access Call Connector Pro
  ccproPrimerDismissedAt: timestamp("ccpro_primer_dismissed_at"), // When agent dismissed CCPro primer modal (persists across browsers)
  vdpMissedCallDisclaimerAcceptedAt: timestamp("vdp_missed_call_disclaimer_accepted_at"), // When agent accepted VDP missed call billing disclaimer (persists across browsers/devices)
  callConnectorProDisclaimerAcceptedAt: timestamp("call_connector_pro_disclaimer_accepted_at"), // When agent accepted Call Connector Pro disclaimer (persists across browsers/devices)
  
  // TEAM MANAGEMENT
  mgaTeam: text("mga_team"), // MGA name this agent belongs to (e.g., "John Smith")
  rgaTeam: text("rga_team"), // RGA name this agent belongs to (e.g., "ENO IFTIU")
  teamRole: text("team_role").default("agent"), // "agent", "team_lead", "manager", "mga", "rga"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Role Page Permissions - controls which roles can access which pages
export const rolePagePermissions = pgTable("role_page_permissions", {
  role: text("role").notNull(),
  page: text("page").notNull(),
  allowed: boolean("allowed").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.role, table.page] }),
  };
});

// Quality Manager Team Assignments - many-to-many relationship between QMs and MGA teams
export const qualityManagerTeamAssignments = pgTable("quality_manager_team_assignments", {
  id: serial("id").primaryKey(),
  qmEmail: text("qm_email").notNull(),
  mgaTeam: text("mga_team").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Call Disposition Inconsistencies - tracks "booked" calls without appointments
export const callDispositionInconsistencies = pgTable("call_disposition_inconsistencies", {
  id: serial("id").primaryKey(),
  callSid: text("call_sid").notNull(),
  agentEmail: text("agent_email").notNull(),
  callDate: text("call_date").notNull(),
  callDuration: integer("call_duration"),
  toNumber: text("to_number"),
  fromNumber: text("from_number"),
  callDirection: text("call_direction"), // 'inbound' or 'outbound-api'
  reportedOutcome: text("reported_outcome").notNull(), // What agent reported (sale, set_appointment, etc.)
  issueType: text("issue_type").notNull(), // booked_without_appointment, missing_appointment_data, etc.
  accountabilityDate: text("accountability_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Taalk VDP Logs - stores CSV data from Taalk verification calls
export const taalkVdpLogs = pgTable("taalk_vdp_logs", {
  id: serial("id").primaryKey(),
  callId: text("call_id"), // Taalk call ID
  agentName: text("agent_name"), // Agent who made the verification call
  clientName: text("client_name"), // Client name being verified
  phoneNumber: text("phone_number"), // Phone number called
  callDate: text("call_date"), // Date of the verification call
  callStatus: text("call_status"), // Status (completed, failed, etc.)
  duration: integer("duration"), // Call duration in seconds
  verificationResult: text("verification_result"), // Success/failed verification
  premiumAmount: decimal("premium_amount", { precision: 10, scale: 2 }), // Premium amount
  policyDetails: jsonb("policy_details"), // Any additional policy data
  rawData: jsonb("raw_data"), // Store original CSV row data
  resolved: boolean("resolved").default(false),
  resolutionNotes: text("resolution_notes"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// VDP Calls - Call activity tracking from Taalk VDP system
export const vdpCalls = pgTable("vdp_calls", {
  id: serial("id").primaryKey(),
  Date: text("Date"), // Call date
  Time: text("Time"), // Call time
  Event: text("Event"), // Event type (CONNECT, NEW, ASSIGN_TO, etc.)
  Phone: text("Phone"), // Phone number
  Agent: text("Agent"), // Agent ID
  Params: text("Params"), // JSON parameters
  MGA: text("MGA"), // Master General Agent from producers lookup
  RGA: text("RGA"), // Regional General Agent from producers lookup
  duration: text("duration"), // Call duration
  leadid: text("leadid"), // Lead ID
  firstname: text("firstname"), // First name
  lastname: text("lastname"), // Last name
  market: text("market"), // Market segment
  email: text("email"), // Email address
  address: text("address"), // Address
  city: text("city"), // City
  state: text("state"), // State
  resolutionStatus: text("resolution_status"), // Resolution status (sold, appointment_set, not_interested, callback_requested, etc.)
  resolutionNotes: text("resolution_notes"), // Additional notes about the resolution
  resolvedAt: timestamp("resolved_at"), // When the call was resolved
  isFollowupRequired: boolean("is_followup_required").default(false), // Whether this resolution requires follow-up
  followupDeadline: timestamp("followup_deadline"), // When follow-up is due
  finalOutcome: text("final_outcome"), // Final business outcome (sold, no_show, etc.
  finalOutcomeNotes: text("final_outcome_notes"), // Notes about final outcome
  finalOutcomeAt: timestamp("final_outcome_at"), // When final outcome was recorded
  createdAt: timestamp("created_at").defaultNow(), // When the record was created
});

// Type definitions for CurrentLead system
export type VdpCallSelect = typeof vdpCalls.$inferSelect;

// Discriminated union for current lead - supports both masterlead and vdp sources
export type CurrentLead = {
  source: 'masterlead';
  id: number;
  name: string;
  phone: string;
  market: string;
  state?: string;
  city?: string;
  address?: string;
  notes?: string;
  cnresolution?: string;
  metadata: any; // Raw masterlead data
} | {
  source: 'vdp';
  id: number;
  name: string;
  phone: string;
  market: string;
  state?: string;
  city?: string;
  address?: string;
  notes?: string;
  cnresolution?: string;
  metadata: VdpCallSelect; // Raw vdp_calls data
};

// AOI Follow-up Tracking - Two-stage accountability for appointments and callbacks
export const aoiFollowups = pgTable("aoi_followups", {
  id: serial("id").primaryKey(),
  vdpCallId: integer("vdp_call_id").references(() => vdpCalls.id).notNull(),
  taalk_leadid: text("taalk_leadid").notNull(), // Links to masterleads table using taalk_leadid
  agentEmail: text("agent_email").notNull(),
  followupType: text("followup_type").notNull(), // "appointment", "callback"
  initialResolution: text("initial_resolution").notNull(), // "appointment_set", "callback_requested"
  initialResolutionAt: timestamp("initial_resolution_at").notNull(),
  initialNotes: text("initial_notes"), // Notes from initial resolution
  
  // Follow-up Requirements
  dueDate: timestamp("due_date").notNull(), // When follow-up is due
  status: text("status").notNull().default("pending"), // "pending", "completed", "overdue"
  
  // Final Outcome Tracking
  finalOutcome: text("final_outcome"), // "sold", "attended_declined", "no_show", "cancelled", "rescheduled", "not_interested", "unable_to_reach"
  finalNotes: text("final_notes"), // Notes about final outcome
  completedAt: timestamp("completed_at"), // When final outcome was recorded
  completedBy: text("completed_by"), // Email of who recorded final outcome
  
  // Appointment Specific Fields
  appointmentDate: timestamp("appointment_date"), // Scheduled appointment date/time
  appointmentType: text("appointment_type"), // "zoom", "phone", "in_person"
  appointmentDetails: text("appointment_details"), // Zoom link, phone number, address
  
  // Callback Specific Fields
  callbackDate: timestamp("callback_date"), // When callback should happen
  callbackPhone: text("callback_phone"), // Phone number to call back
  callbackNotes: text("callback_notes"), // Special callback instructions
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call Disposition Outcomes - tracks all call dispositions
export const callDispositionOutcomes = pgTable("call_disposition_outcomes", {
  id: serial("id").primaryKey(),
  accountabilityId: integer("accountability_id").notNull(),
  callSid: text("call_sid").notNull(),
  outcome: text("outcome").notNull(), // sale, refused, set_appointment, etc.
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  agentEmail: text("agent_email").notNull(),
  callDate: text("call_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// VDP Connects - successful connects (PICK_UP → END over 12 seconds)
export const vdpConnects = pgTable("vdp_connects", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(), // VDP agent ID (e.g., "409") 
  associateId: integer("associate_id"), // Associate ID number
  phone: text("phone").notNull(), // Phone number called
  durationSeconds: integer("duration_seconds").notNull(), // Call duration in seconds
  clientName: text("client_name"), // Client name if available
  leadId: text("lead_id"), // Lead ID if available
  leadid: text("leadid"), // Lead ID from VDP params
  firstname: text("firstname"), // First name from VDP params
  lastname: text("lastname"), // Last name from VDP params
  market: text("market"), // Market segment (Veteran, etc.)
  mga: text("mga"), // MGA (Master General Agent)
  rga: text("rga"), // RGA (Regional General Agent)
  connectDate: text("connect_date").notNull(), // Date of connect
  pickupTime: text("pickup_time"), // When call was picked up (text format)
  endTime: text("end_time"), // When call ended (text format)
  eventType: text("event_type"), // Event type (CONNECT, END, etc.)
  params: text("params"), // JSON params
  processedAt: timestamp("processed_at").defaultNow(),
});

// VDP Missed Calls - calls that were not answered
export const vdpMissedCalls = pgTable("vdp_missed_calls", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(), // VDP agent ID (e.g., "409")
  agentName: text("agent_name"), // Agent full name  
  associateId: integer("associate_id"), // Associate ID number
  phoneNumber: text("phone_number").notNull(), // Phone number called
  duration: integer("duration").default(0), // Duration attempted (0 for missed)
  clientName: text("client_name"), // Client name if available
  leadId: text("lead_id"), // Lead ID if available
  market: text("market"), // Market segment (Veteran, etc.)
  mga: text("mga"), // MGA (Master General Agent)
  rga: text("rga"), // RGA (Regional General Agent)
  missedDate: text("missed_date").notNull(), // Date of missed call
  missedTime: timestamp("missed_time").notNull(), // When call was missed
  createdAt: timestamp("created_at").defaultNow(),
});

// AOI Connect Tracking - tracks all billable AOI connects from VDP calls
export const aoiConnects = pgTable("aoi_connects", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(), // Agent ID (associate_id from Supabase)
  supabaseVdpId: integer("supabase_vdp_id").notNull().unique(), // ID from Supabase vdp_calls table
  clientPhone: text("client_phone").notNull(), // Phone number called
  clientName: text("client_name"), // Client full name (firstname + lastname)
  firstName: text("first_name"), // Client first name
  lastName: text("last_name"), // Client last name
  leadId: text("lead_id"), // Lead ID
  market: text("market"), // Market segment
  callDate: text("call_date").notNull(), // Date of call
  callTime: text("call_time").notNull(), // Time of call
  duration: text("duration"), // Call duration
  billingAmount: decimal("billing_amount", { precision: 10, scale: 2 }).default("8.00"), // $8.00 per AOI connect
  billed: boolean("billed").default(false), // Whether this has been billed
  notified: boolean("notified").default(false), // Whether agent was notified
  syncedAt: timestamp("synced_at").defaultNow(), // When synced from Supabase
  createdAt: timestamp("created_at").defaultNow(),
});

// Producer Database - complete agent hierarchy and contact info
export const producers = pgTable("producers", {
  id: serial("id").primaryKey(),
  associateId: integer("associate_id").notNull().unique(), // Associate ID from Excel
  agentName: text("agent_name").notNull(), // Full agent name
  mga: text("mga"), // Master General Agent
  rga: text("rga"), // Regional General Agent  
  companyEmail: text("company_email"), // Company email
  personalEmail: text("personal_email"), // Personal email
  phone: text("phone"), // Phone number
  aoiMarket: text("aoi_market"), // AOI Market
  designatedMarket: text("designated_market"), // Designated Market
  licensedStates: text("licensed_states"), // Life-and-Health Licensed States
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Credits - manages agent credit balances for VDP usage
export const agentCredits = pgTable("agent_credits", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().unique(), // VDP agent ID (e.g., "409")
  associateId: integer("associate_id"), // Associate ID from producer hierarchy
  agentName: text("agent_name").notNull(), // Agent full name
  agentEmail: text("agent_email"), // Agent email for notifications
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).notNull().default("0.00"), // Current credit balance
  totalPurchased: decimal("total_purchased", { precision: 10, scale: 2 }).default("0.00"), // Total credits purchased
  totalUsed: decimal("total_used", { precision: 10, scale: 2 }).default("0.00"), // Total credits used
  aoiConnectRate: decimal("aoi_connect_rate", { precision: 10, scale: 2 }).default("8.00"), // Cost per AOI connect
  aoiMissedRate: decimal("aoi_missed_rate", { precision: 10, scale: 2 }).default("4.00"), // Cost per AOI missed call
  aoiRecruitRate: decimal("aoi_recruit_rate", { precision: 10, scale: 2 }).default("5.00"), // Cost per AOI recruit
  aoiPrecheckRate: decimal("aoi_precheck_rate", { precision: 10, scale: 2 }).default("3.00"), // Cost per AOI precheck
  aoiPlusRate: decimal("aoi_plus_rate", { precision: 10, scale: 2 }).default("6.00"), // Cost per AOI plus lead
  mga: text("mga"), // MGA for team reporting
  rga: text("rga"), // RGA for team reporting
  isActive: boolean("is_active").default(true), // Whether agent can use credits
  lowBalanceThreshold: decimal("low_balance_threshold", { precision: 10, scale: 2 }).default("10.00"), // When to send low balance alerts
  autoReloadEnabled: boolean("auto_reload_enabled").default(false), // Auto-reload credits when low
  autoReloadAmount: decimal("auto_reload_amount", { precision: 10, scale: 2 }).default("50.00"), // Amount to auto-reload
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit Transactions - tracks all credit purchases and usage
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(), // VDP agent ID
  transactionType: text("transaction_type").notNull(), // "purchase", "usage", "refund", "adjustment"
  serviceType: text("service_type"), // "aoi_connect", "aoi_missed", "aoi_recruit", "aoi_precheck"
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Transaction amount (positive for credits, negative for usage)
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(), // Balance before transaction
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(), // Balance after transaction
  description: text("description").notNull(), // Transaction description
  vdpConnectId: integer("vdp_connect_id"), // Link to vdp_connects table if usage transaction
  phoneNumber: text("phone_number"), // Phone number for connect transactions
  clientName: text("client_name"), // Client name for connect transactions
  connectDuration: integer("connect_duration"), // Connect duration in seconds
  market: text("market"), // Market segment
  paymentMethod: text("payment_method"), // "stripe", "admin", "auto_reload"
  paymentId: text("payment_id"), // External payment system ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily Billing Reports - tracks daily agent billing summaries
export const dailyBillingReports = pgTable("daily_billing_reports", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  reportDate: text("report_date").notNull(), // YYYY-MM-DD format
  connectCount: integer("connect_count").default(0), // Total connects for the day
  missedCallCount: integer("missed_call_count").default(0), // Total missed calls for the day
  totalCharges: decimal("total_charges", { precision: 10, scale: 2 }).default("0.00"), // Total charges for the day
  averageConnectDuration: integer("average_connect_duration").default(0), // Average connect duration in seconds
  topClientMarket: text("top_client_market"), // Most active market for the day
  balanceStart: decimal("balance_start", { precision: 10, scale: 2 }).notNull(), // Balance at start of day
  balanceEnd: decimal("balance_end", { precision: 10, scale: 2 }).notNull(), // Balance at end of day
  emailSent: boolean("email_sent").default(false), // Whether daily recap email was sent
  emailSentAt: timestamp("email_sent_at"), // When recap email was sent
  createdAt: timestamp("created_at").defaultNow(),
});

// Help Requests - stores support requests instead of sending emails
export const helpRequests = pgTable("help_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  page: text("page"), // Which page the help was requested from
  status: text("status").default("new"), // new, in_progress, resolved
  resolvedBy: text("resolved_by"), // Admin who resolved it
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Support Queue - Live support queue (Geek Squad / Apple Bar style)
export const supportQueue = pgTable("support_queue", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  issueCategory: text("issue_category").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  position: integer("position").notNull().default(1),
  status: text("status").notNull().default("waiting"), // waiting, in_session, completed, abandoned
  zoomLink: text("zoom_link"),
  bookingId: integer("booking_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Support Bookings - 10-minute block bookings for live support
export const supportBookings = pgTable("support_bookings", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  name: text("name").notNull(),
  slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
  slotEnd: timestamp("slot_end", { withTimezone: true }).notNull(),
  issueCategory: text("issue_category").notNull().default("general"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Phantom Booking Resolutions - tracks data integrity issue resolutions
export const phantomBookingResolutions = pgTable("phantom_booking_resolutions", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(),
  leadName: text("lead_name").notNull(),
  leadPhone: text("lead_phone").notNull(),
  market: text("market").notNull(),
  resolutionType: text("resolution_type").notNull(), // data_error, forgot_appointment, incorrect_marking
  explanation: text("explanation").notNull(),
  resolvedAt: timestamp("resolved_at").defaultNow(),
  originalBookingDate: text("original_booking_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lead Campaigns - agent-created lead packs and campaigns
export const leadCampaigns = pgTable("lead_campaigns", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(),
  campaignName: text("campaign_name").notNull(),
  campaignType: text("campaign_type").notNull(), // 'smart' or 'custom'
  leadCount: integer("lead_count").default(0),
  filters: jsonb("filters"), // Smart campaign filters
  leadPhones: jsonb("lead_phones"), // Custom campaign phone numbers array
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bug Reports and Feedback System for Pre-Alpha Phase
export const feedbackReports = pgTable("feedback_reports", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(), // "bug", "feature_request", "feedback"
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("medium"), // "low", "medium", "high", "critical"
  status: text("status").notNull().default("open"), // "open", "in_progress", "resolved", "closed"
  reporterEmail: text("reporter_email").notNull(),
  reporterName: text("reporter_name"),
  browserInfo: text("browser_info"), // User agent string
  pageUrl: text("page_url"), // URL where issue occurred
  stepsToReproduce: text("steps_to_reproduce"),
  expectedBehavior: text("expected_behavior"),
  actualBehavior: text("actual_behavior"),
  attachments: jsonb("attachments"), // Array of attachment URLs/paths
  adminNotes: text("admin_notes"), // Private admin notes
  assignedTo: text("assigned_to"), // Admin email assigned to handle this
  priority: integer("priority").default(3), // 1=highest, 5=lowest
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// AO Recruit Candidates
export const recruitCandidates = pgTable("recruit_candidates", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  // Recruitment specific fields
  status: text("status").notNull().default("new"), // new, contacted, interview, pending, hired, rejected
  position: text("position"), // Position they're applying for
  experience: text("experience"), // Years of experience
  rating: decimal("rating", { precision: 3, scale: 1 }), // 1-5 rating
  notes: text("notes"), // Notes about the candidate
  aiSummary: text("ai_summary"), // AI-generated summary from screening call
  // Agent who added this candidate
  agentId: text("agent_id").notNull(),
  agentEmail: text("agent_email").notNull(),
  // Appointment scheduling
  appointmentDate: timestamp("appointment_date"),
  appointmentNotes: text("appointment_notes"),
  // Stage tracking
  currentStageId: integer("current_stage_id"),
  stageEnteredAt: timestamp("stage_entered_at"),
  // ExamFX Licensing Tracker
  examfxVoucherCode: text("examfx_voucher_code"),           // voucher code issued to candidate
  examfxEnrolledAt: timestamp("examfx_enrolled_at"),        // when they were enrolled
  examfxState: text("examfx_state"),                        // which state's course (e.g. "TX", "CA")
  examfxCourseType: text("examfx_course_type"),             // "Life & Health", "Property & Casualty", etc.
  examfxStatus: text("examfx_status"),                      // "not_enrolled" | "enrolled" | "studying" | "exam_scheduled" | "passed" | "failed"
  examfxProgressPercent: integer("examfx_progress_percent"), // 0-100 course completion
  examfxPracticeScores: text("examfx_practice_scores"),     // JSON array of practice exam scores e.g. "[72, 81, 88]"
  examfxExamDate: timestamp("examfx_exam_date"),            // scheduled real exam date
  examfxExamResult: text("examfx_exam_result"),             // "passed" | "failed" | null
  examfxExamResultAt: timestamp("examfx_exam_result_at"),   // when they took the real exam
  examfxNotes: text("examfx_notes"),                        // recruiter notes on licensing progress
  examfxLastSyncAt: timestamp("examfx_last_sync_at"),       // last time data was synced from ExamFX
  // Call tracking (similar to masterlead.last_contacted)
  lastContacted: timestamp("last_contacted"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Masterrecruit - unassigned/follow-up candidate queue (like masterlead for recruits).
// Mirrors recruit_candidates; agents "convert" rows to recruit_candidates when they take ownership.
export const masterrecruit = pgTable("masterrecruit", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  status: text("status").notNull().default("new"),
  position: text("position"),
  experience: text("experience"),
  rating: decimal("rating", { precision: 3, scale: 1 }),
  notes: text("notes"),
  aiSummary: text("ai_summary"),
  agentId: text("agent_id"), // Null until converted to recruit_candidates
  agentEmail: text("agent_email"), // Null until converted
  isHotCandidate: boolean("is_hot_candidate").default(false), // Hot candidate queue
  priorityScore: integer("priority_score").default(0), // Queue order (higher = first)
  appointmentDate: timestamp("appointment_date"),
  appointmentNotes: text("appointment_notes"),
  currentStageId: integer("current_stage_id"),
  stageEnteredAt: timestamp("stage_entered_at"),
  lastContacted: timestamp("last_contacted"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Removed LinkedIn enriched recruit profiles table - system was ineffective per user request

// AO Recruit User Settings - stores pipeline order and URL customizations per agent
export const recruitUserSettings = pgTable("recruit_user_settings", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull().unique(),
  // Pipeline order customization - JSON array of stage IDs in custom order
  pipelineOrder: jsonb("pipeline_order"), // e.g., [1, 2, 3, 4, 5, 6, 7, 8]
  // Custom stage names - JSON object mapping stage ID to custom name
  customStageNames: jsonb("custom_stage_names"), // e.g., { "3": "My Virtual Overview", "5": "Group Meeting" }
  // Stage URLs - JSON object mapping stage ID to custom SMS URL (Virtual Overview is hardcoded, not editable)
  stageUrls: jsonb("stage_urls"), // e.g., { "5": "https://example.com/group-final", "6": "https://example.com/final-interview" }
  // Legacy URL fields (kept for backward compatibility, but stageUrls is preferred)
  virtualOverviewUrl: text("virtual_overview_url"), // Deprecated: Virtual Overview URL is now hardcoded
  groupFinalUrl: text("group_final_url"), // Deprecated: Use stageUrls instead
  finalInterviewUrl: text("final_interview_url"), // Deprecated: Use stageUrls instead
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call Tracking System for Call Connector Pro with Twilio Integration
export const outboundCalls = pgTable("outbound_calls", {
  id: serial("id").primaryKey(),
  // Twilio Call Information
  twilioCallSid: text("twilio_call_sid").notNull().unique(),
  twilioConferenceSid: text("twilio_conference_sid"),
  twilioParentCallSid: text("twilio_parent_call_sid"), // For connecting related calls
  
  // Agent Information
  agentEmail: text("agent_email").notNull(),
  agentPhone: text("agent_phone"),
  agentName: text("agent_name"),
  
  // Lead Information
  leadName: text("lead_name").notNull(),
  leadPhone: text("lead_phone").notNull(),
  leadId: text("lead_id"),
  leadMarket: text("lead_market"),
  leadState: text("lead_state"),
  leadCity: text("lead_city"),
  
  // Call Status and Timing
  callStatus: text("call_status").notNull().default("initiated"), // initiated, ringing, in-progress, completed, failed, no-answer, busy
  callDirection: text("call_direction").notNull().default("outbound"), 
  startTime: timestamp("start_time").defaultNow(),
  answerTime: timestamp("answer_time"),
  endTime: timestamp("end_time"),
  duration: integer("duration").default(0), // Duration in seconds
  
  // Call Quality and Technical Details
  callQuality: decimal("call_quality", { precision: 3, scale: 2 }), // 0.00 to 5.00 rating
  localPresenceNumber: text("local_presence_number"), // Which local number was used
  recordingUrl: text("recording_url"),
  
  // Disposition and Results
  callDisposition: text("call_disposition"), // no-answer, voicemail, callback, appointment, not-interested, do-not-call
  appointmentScheduled: boolean("appointment_scheduled").default(false),
  appointmentDate: timestamp("appointment_date"),
  notes: text("notes"),
  
  // System Information
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Real-time Call Center Dashboard Events
export const callCenterEvents = pgTable("call_center_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(), // call_started, call_answered, call_ended, disposition_set, etc.
  callId: integer("call_id").references(() => outboundCalls.id),
  twilioCallSid: text("twilio_call_sid").notNull(),
  agentEmail: text("agent_email").notNull(),
  eventData: jsonb("event_data"), // Store additional event-specific data
  timestamp: timestamp("timestamp").defaultNow(),
});

// Agent Performance Metrics
export const agentMetrics = pgTable("agent_metrics", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(),
  date: timestamp("date").notNull(),
  
  // Call Volume
  totalCalls: integer("total_calls").default(0),
  totalConnects: integer("total_connects").default(0),
  totalAppointments: integer("total_appointments").default(0),
  
  // Performance Percentages
  connectRate: decimal("connect_rate", { precision: 5, scale: 2 }).default("0.00"), // Percentage
  appointmentRate: decimal("appointment_rate", { precision: 5, scale: 2 }).default("0.00"),
  
  // Time Metrics
  totalTalkTime: integer("total_talk_time").default(0), // Total talk time in seconds
  avgCallDuration: decimal("avg_call_duration", { precision: 8, scale: 2 }).default("0.00"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OLD appointments table removed to avoid duplication

// Appointment Reminders System
export const appointmentReminders = pgTable("appointment_reminders", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  
  // Reminder Configuration
  reminderType: text("reminder_type").notNull(), // sms, email, call
  reminderTime: integer("reminder_time").notNull(), // Minutes before appointment
  
  // Delivery Status
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  
  // Message Content
  messageContent: text("message_content"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent Availability Settings
export const agentAvailability = pgTable("agent_availability", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(),
  
  // Day of week (0 = Sunday, 6 = Saturday)
  dayOfWeek: integer("day_of_week").notNull(),
  
  // Time slots (in minutes from midnight)
  startTime: integer("start_time").notNull(), // e.g., 540 = 9:00 AM
  endTime: integer("end_time").notNull(), // e.g., 1020 = 5:00 PM
  
  // Availability status
  isAvailable: boolean("is_available").default(true),
  timezone: text("timezone").notNull().default("America/New_York"),
  
  // Booking settings
  bufferTime: integer("buffer_time").default(15), // Minutes between appointments
  maxAdvanceDays: integer("max_advance_days").default(30), // How far in advance bookings are allowed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 🎯 BULLETPROOF CALL TRACKING - Single Source of Truth
export const callTracker = pgTable("call_tracker", {
  id: serial("id").primaryKey(),
  
  // CORE IDENTIFIERS - Never null, always trackable
  sessionId: text("session_id").notNull().unique(), // Our internal session ID
  agentEmail: text("agent_email").notNull(), // Who made the call
  leadPhone: text("lead_phone").notNull(), // Who was called
  leadName: text("lead_name").notNull(), // Lead name for reference
  
  // CALL PROGRESS - Simple 4-state system
  callProgress: text("call_progress").notNull().default("not_initiated"), 
  // Values: not_initiated -> initiated -> connected -> in_progress -> complete
  
  // EXTERNAL SYSTEM IDS - Can be null if systems fail
  taalkCallId: text("taalk_call_id"), // Taalk API call ID
  twilioCallSid: text("twilio_call_sid"), // Twilio call SID
  zoomRoomId: text("zoom_room_id"), // Zoom room for verification
  
  // TIMESTAMPS - Exact progression tracking
  initiatedAt: timestamp("initiated_at"), // When call was started
  connectedAt: timestamp("connected_at"), // When call was answered
  inProgressAt: timestamp("in_progress_at"), // When call became active
  completedAt: timestamp("completed_at"), // When call ended
  
  // RESULTS - What happened
  callOutcome: text("call_outcome"), // answered, no_answer, busy, failed, voicemail
  verificationResult: text("verification_result"), // passed, failed, incomplete
  appointmentBooked: boolean("appointment_booked").default(false),
  
  // ERROR HANDLING - Fail-safe tracking
  lastError: text("last_error"), // Any error messages
  retryCount: integer("retry_count").default(0), // How many retries
  systemFlags: jsonb("system_flags"), // Any additional metadata
  
  // AUDIT TRAIL - Never changes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Weekly Agency Report (WAR) - Connect tracking with daily production status
export const warConnects = pgTable("war_connects", {
  id: serial("id").primaryKey(),
  connectId: text("connect_id").notNull().unique(), // Unique identifier for the connect
  agentEmail: text("agent_email").notNull(),
  leadName: text("lead_name").notNull(),
  leadPhone: text("lead_phone").notNull(),
  connectDate: timestamp("connect_date").notNull(),
  connectTime: text("connect_time").notNull(),
  duration: integer("duration").notNull(), // Duration in seconds
  leadSource: text("lead_source"), // Where the lead came from
  market: text("market").notNull(),
  state: text("state").notNull(),
  
  // Connect Type Classification (AOI appointments, press sales, etc.)
  connectType: text("connect_type").notNull(), // 'aoi_appointment', 'press_sale', 'instant_presentation', 'callback_scheduled', 'other'
  
  // Daily Production Status (captured immediately with connect)
  productionStatus: text("production_status").default("pending"), // 'pending', 'confirmed', 'cancelled', 'no_show', 'completed'
  immediateOutcome: text("immediate_outcome"), // What was agreed to right away (appointment set, sale closed, callback scheduled)
  
  // Final Disposition tracking (for Wednesday reporting)
  disposition: text("disposition"), // appointment, sale, cant_afford, medically_uninsurable, not_interested, pending
  appointmentSet: boolean("appointment_set").default(false),
  appointmentDate: timestamp("appointment_date"),
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
  
  // Enhanced tracking fields
  followUpRequired: boolean("follow_up_required").default(false),
  nextContactDate: timestamp("next_contact_date"),
  priorityLevel: text("priority_level").default("normal"), // 'urgent', 'high', 'normal', 'low'
  tags: jsonb("tags").default(sql`'[]'::jsonb`), // Flexible tagging for categorization
  
  notes: text("notes"),
  reportedAt: timestamp("reported_at"),
  
  // Connect Review System (for gamified card deck)
  reviewStatus: text("review_status"), // 'pending', 'interested', 'not_interested', 'sale'
  reviewedAt: timestamp("reviewed_at"),
  nextReviewDate: timestamp("next_review_date"), // For interested connects to appear tomorrow
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WAR Submissions - Track weekly report completions
export const warSubmissions = pgTable("war_submissions", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  totalConnects: integer("total_connects").notNull(),
  reportedConnects: integer("reported_connects").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationSessions = pgTable("verification_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  spouseName: text("spouse_name"),
  phone: text("phone").notNull(),
  agentPhone: text("agent_phone"), // Agent's phone number for Taalk integration
  agentFirstName: text("agent_first_name"), // Agent's first name for Taalk script
  agentLastName: text("agent_last_name"), // Agent's last name for Taalk script
  associateId: integer("associate_id"), // Associate ID to lookup MGA/RGA from producers table
  agentMgaTeam: text("agent_mga_team"), // Agent's MGA team for RBAC (auto-populated from producers lookup)
  agentRgaTeam: text("agent_rga_team"), // Agent's RGA team for RBAC (auto-populated from producers lookup)
  city: text("city").notNull(),
  state: text("state").notNull(),
  premium: text("premium").notNull(),
  achDrawDate: text("ach_draw_date"), // Full date for ACH draw (e.g., "September 8th")
  achDrawDateShort: text("ach_draw_date_short"), // Short format (e.g., "8th")
  sessionType: text("session_type").notNull().default("live"), // "demo" or "live" - demo sessions are hidden from admin view
  verificationMethod: text("verification_method"),
  zoomRoomId: text("zoom_room_id"),
  zoomPassword: text("zoom_password"),
  language: text("language").default("en"),
  screenshotPath: text("screenshot_path"),
  status: text("status").notNull().default("pending"),
  // SMS verification fields
  smsVerificationSent: boolean("sms_verification_sent").default(false),
  smsVerificationCode: text("sms_verification_code"),
  clientApprovalStatus: text("client_approval_status").default("pending"), // pending, approved, denied
  clientApprovalTime: timestamp("client_approval_time"),
  // Client SMS tracking
  clientSmsSid: text("client_sms_sid"),
  clientSmsStatus: text("client_sms_status"),
  clientSmsSentAt: text("client_sms_sent_at"),
  clientSmsError: text("client_sms_error"),
  // Agent SMS tracking
  agentSmsSid: text("agent_sms_sid"),
  agentSmsStatus: text("agent_sms_status"),
  agentSmsSentAt: text("agent_sms_sent_at"),
  agentSmsError: text("agent_sms_error"),
  // Location and IP tracking
  clientIpAddress: text("client_ip_address"),
  clientCountry: text("client_country"),
  clientRegion: text("client_region"),
  clientCity: text("client_city"),
  clientLatitude: text("client_latitude"),
  clientLongitude: text("client_longitude"),
  clientTimezone: text("client_timezone"),
  clientIsp: text("client_isp"),
  clientUserAgent: text("client_user_agent"),
  // Client VPN detection
  clientIsVpn: boolean("client_is_vpn").default(false),
  clientIsProxy: boolean("client_is_proxy").default(false),
  clientIsHosting: boolean("client_is_hosting").default(false),
  clientVpnDetectionReason: text("client_vpn_detection_reason"),
  // Agent IP tracking 
  agentIpAddress: text("agent_ip_address"),
  agentCountry: text("agent_country"),
  agentRegion: text("agent_region"),
  agentCity: text("agent_city"),
  agentLatitude: text("agent_latitude"),
  agentLongitude: text("agent_longitude"),
  agentTimezone: text("agent_timezone"),
  agentIsp: text("agent_isp"),
  agentUserAgent: text("agent_user_agent"),
  // Agent VPN detection
  agentIsVpn: boolean("agent_is_vpn").default(false),
  agentIsProxy: boolean("agent_is_proxy").default(false),
  agentIsHosting: boolean("agent_is_hosting").default(false),
  agentVpnDetectionReason: text("agent_vpn_detection_reason"),
  callCompleted: boolean("call_completed").default(false),
  verificationResult: text("verification_result"), // JSON string for call results
  // Taalk call tracking
  taalkCallId: text("taalk_call_id"),
  taalkCallStatus: text("taalk_call_status"), // initiated, ringing, answered, completed, failed
  taalkCallInitiatedAt: text("taalk_call_initiated_at"),
  taalkCallCompletedAt: text("taalk_call_completed_at"),
  taalkCallDuration: integer("taalk_call_duration"), // Duration in seconds
  taalkCallData: text("taalk_call_data"), // JSON string with Taalk response data
  taalkCallUrl: text("taalk_call_url"), // Object storage URL for downloaded recording
  // IP Analysis fields
  ipAnalysis: jsonb("ip_analysis"), // JSONB storing full IP analysis result
  ipFlagStatus: text("ip_flag_status"), // Quick status: valid, flagged, suspicious, critical, pending
  ipFlagReason: text("ip_flag_reason"), // Human-readable explanation of flag status
  ipAnalysisSummary: text("ip_analysis_summary"), // Summary text displayed in hover card
  // Real-time call tracking fields
  callStatus: text("call_status"), // General call status (initiated, ringing, ongoing, completed, failed, etc.)
  initiatedAt: timestamp("initiated_at"), // When call was started
  callCompletedAt: timestamp("call_completed_at"), // When call ended
  duration: integer("duration"), // Call duration in seconds
  answered: boolean("answered").default(false), // Whether call was answered
  lastPolledAt: timestamp("last_polled_at"), // For tracking polling intervals
  // Transmit precheck - only transmitted sessions show in AO Precheck Management
  transmitStatus: text("transmit_status").default("pending_transmit"), // pending_transmit | transmitted | scheduled_delete
  precheckType: text("precheck_type").default("live"), // live | training | incomplete
  transmittedAt: timestamp("transmitted_at"), // When agent clicked Transmit
  scheduledDeleteAt: timestamp("scheduled_delete_at"), // Training/Incomplete: delete in 24h; Recover clears this
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Getting Started Walkthrough System - Mandatory for all users
export const walkthroughVideos = pgTable("walkthrough_videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(), // URL to video file or streaming link
  thumbnailUrl: text("thumbnail_url"), // Video thumbnail image
  category: text("category").notNull(), // "call_connector_pro", "ao_precheck", "general"
  orderIndex: integer("order_index").notNull().default(0), // Display order within category
  duration: integer("duration"), // Video duration in seconds
  isRequired: boolean("is_required").default(true), // Must be watched to complete walkthrough
  isActive: boolean("is_active").default(true), // Can be disabled by admins
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const walkthroughProgress = pgTable("walkthrough_progress", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(), // User who is taking the walkthrough
  videoId: integer("video_id").references(() => walkthroughVideos.id).notNull(),
  
  // Progress tracking
  hasStarted: boolean("has_started").default(false),
  hasCompleted: boolean("has_completed").default(false),
  watchTimeSeconds: integer("watch_time_seconds").default(0), // How much they've watched
  lastWatchedAt: timestamp("last_watched_at"),
  completedAt: timestamp("completed_at"),
  
  // Engagement metrics
  pauseCount: integer("pause_count").default(0),
  replayCount: integer("replay_count").default(0),
  skipAttempts: integer("skip_attempts").default(0), // Track if they try to skip
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const walkthroughCompletion = pgTable("walkthrough_completion", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull().unique(), // One record per user
  
  // Completion status by category
  callConnectorProCompleted: boolean("call_connector_pro_completed").default(false),
  aoPreCheckCompleted: boolean("ao_precheck_completed").default(false),
  generalWalkthroughCompleted: boolean("general_walkthrough_completed").default(false),
  
  // Overall completion
  isFullyCompleted: boolean("is_fully_completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // System access tracking
  systemAccessGranted: boolean("system_access_granted").default(false),
  firstAccessAt: timestamp("first_access_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comprehensive Appointment Scheduling System
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  
  // Appointment Basic Info
  title: text("title").notNull(),
  description: text("description"),
  appointmentType: text("appointment_type").notNull().default("consultation"), // consultation, follow-up, presentation, closing
  
  // Scheduling Details
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration").notNull().default(60), // Duration in minutes
  timezone: text("timezone").notNull().default("America/New_York"),
  
  // Participant Information
  agentId: text("agent_id").notNull(),
  agentEmail: text("agent_email").notNull(),
  agentName: text("agent_name").notNull(),
  
  // Lead/Client Information
  leadId: text("lead_id"),
  leadName: text("lead_name").notNull(),
  leadPhone: text("lead_phone").notNull(),
  leadEmail: text("lead_email"),
  leadCity: text("lead_city"),
  leadState: text("lead_state"),
  
  // Video Conference Settings
  meetingPlatform: text("meeting_platform").notNull().default("zoom"), // zoom, whereby, twilio, teams
  meetingLink: text("meeting_link"), // Generic meeting link for any platform
  meetingData: jsonb("meeting_data"), // JSON object containing platform-specific meeting details
  
  // Zoom Meeting Settings
  zoomMeetingId: text("zoom_meeting_id"),
  zoomPassword: text("zoom_password"),
  zoomJoinUrl: text("zoom_join_url"),
  
  // Whereby Meeting Settings
  wherebyRoomUrl: text("whereby_room_url"),
  wherebyHostRoomUrl: text("whereby_host_room_url"),
  wherebyMeetingId: text("whereby_meeting_id"),
  
  // Twilio Video Settings
  twilioRoomName: text("twilio_room_name"),
  
  // Appointment Status and Management
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, rescheduled, cancelled, completed, no-show
  confirmationStatus: text("confirmation_status").default("pending"), // pending, confirmed, declined
  remindersSent: integer("reminders_sent").default(0),
  
  // Communication
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Agent-only notes
  
  // Google Calendar Integration
  googleCalendarEventId: text("google_calendar_event_id"), // Google Calendar event ID for sync
  googleCalendarSyncStatus: text("google_calendar_sync_status").default("pending"), // pending, synced, failed
  googleCalendarSyncedAt: timestamp("google_calendar_synced_at"),
  googleCalendarHtmlLink: text("google_calendar_html_link"), // Direct link to Google Calendar event
  googleCalendarSyncError: text("google_calendar_sync_error"), // Error message if sync fails
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
  completedAt: timestamp("completed_at"),
});

// User Experience Points for gamification
export const userExperience = pgTable("user_experience", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  totalExperience: integer("total_experience").notNull().default(0),
  level: integer("level").notNull().default(1),
  experienceToNextLevel: integer("experience_to_next_level").notNull().default(100),
  connectsReviewed: integer("connects_reviewed").notNull().default(0),
  salesMade: integer("sales_made").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WAR (Weekly Activity Report) Metrics Tracking
export const warMetrics = pgTable("war_metrics", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(),
  agentName: text("agent_name").notNull(),
  teamName: text("team_name").notNull().default("Default Team"),
  reportDate: timestamp("report_date").notNull(), // The specific day this metrics entry is for
  marketType: text("market_type").notNull(), // "plus", "veteran", "globe", "willkit"
  
  // Daily metrics: D-R-B-A-P-S-ALP
  dials: integer("dials").notNull().default(0), // D - Calls made
  reached: integer("reached").notNull().default(0), // R - Connected calls
  booked: integer("booked").notNull().default(0), // B - Appointments booked
  appointments: integer("appointments").notNull().default(0), // A - Appointments kept
  presentations: integer("presentations").notNull().default(0), // P - Presentations given
  sales: integer("sales").notNull().default(0), // S - Sales closed
  alp: decimal("alp", { precision: 10, scale: 2 }).notNull().default("0.00"), // ALP - Annualized Life Premium
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WAR Teams configuration
export const warTeams = pgTable("war_teams", {
  id: serial("id").primaryKey(),
  teamName: text("team_name").notNull().unique(),
  teamLeader: text("team_leader").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// WAR Team Members association
export const warTeamMembers = pgTable("war_team_members", {
  id: serial("id").primaryKey(),
  teamName: text("team_name").notNull(),
  agentEmail: text("agent_email").notNull(),
  agentName: text("agent_name").notNull(),
  role: text("role").notNull().default("agent"), // "agent", "team_leader", "supervisor"
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  
  agentName: true,
});

export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const agentProfileSchema = insertAgentProfileSchema;

// Veteran leads table for CSV data
// Masterlead table for lead management with hotlead priority
export const masterlead = pgTable("masterlead", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastContacted: timestamp("last_contacted"),
  dnc: boolean("dnc").default(false),
  status: text("status").default("pending"),
  dispositionNotes: text("disposition_notes"),
  isLiveCall: boolean("is_live_call").default(false),
  liveCallPriority: integer("live_call_priority").default(1),
  assignedAgentEmail: text("assigned_agent_email"),
  taalkSponsorOrg: text("taalk_sponsor_org"),
  taalkMarket: text("taalk_market"),
  taalkLeadSource: text("taalk_lead_source"),
  taalkState: text("taalk_state"),
  taalkReffered: text("taalk_reffered"),
  taalkRelationship: text("taalk_relationship"),
  taalkSecretkey: text("taalk_secretkey"),
  taalkGroupCode: text("taalk_group_code"),
  taalkLeadId: text("taalk_lead_id"),
  taalkEmail: text("taalk_email"),
  taalkCity: text("taalk_city"),
  taalkGroupname: text("taalk_groupname"),
  taalkBeneficiary: text("taalk_beneficiary"),
  taalkAddress: text("taalk_address"),
  cnEmail: text("cn_email"),
  cnresolution: text("cnresolution").default("pending"),
  appointmentDate: timestamp("appointment_date"), // APPTTIME - appointment date/time
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }), // ALP - sale amount
  isHotLead: boolean("is_hot_lead").default(false),
  priorityScore: integer("priority_score").default(1),
  associateId: integer("associate_id"), // Associate ID for lead assignment
  aoLeadBox: text("ao_lead_box"), // Lead pool category for My Leads queue
  aoLeadBoxOwners: text("ao_lead_box_owners"), // Owner email(s) for AO lead boxes (like cn_email but for lead boxes)
  dateOfBirth: text("date_of_birth"), // Date of birth (text field for display/capture)
});

// Masterleadrecruit table for recruit candidate queue/assignment system
// Mirrors masterlead structure but for recruit candidates
export const masterleadrecruit = pgTable("masterleadrecruit", {
  id: serial("id").primaryKey(),
  // Link to source candidate record
  candidateId: integer("candidate_id").references(() => recruitCandidates.id, { onDelete: "cascade" }),
  // Basic candidate info (denormalized for performance)
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  address: text("address"),
  // Assignment and status tracking (same as masterlead)
  cnEmail: text("cn_email"), // Assigned agent email (NULL = unassigned)
  cnresolution: text("cnresolution").default("pending"), // Status: pending, called, booked, etc.
  assignedDate: timestamp("assigned_date"), // When candidate was assigned to agent
  previousCnEmail: text("previous_cn_email"), // Previous agent assignment (for rotation)
  lastAssignedDate: timestamp("last_assigned_date"), // Last assignment timestamp
  currentlyCalling: boolean("currently_calling").default(false), // Flag for active calls
  // Call tracking
  lastContacted: timestamp("last_contacted"),
  dnc: boolean("dnc").default(false), // Do Not Call flag
  // Market/context
  market: text("market").default("aorecruit"), // Always 'aorecruit' for recruit candidates
  // Recruit hotlead (high-priority candidate, like masterlead is_hot_lead)
  isHotLead: boolean("is_hot_lead").default(false),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const veteranLeads = pgTable("veteran_leads", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  address: text("address"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  calledAt: timestamp("called_at"),
  dnc: boolean("dnc").default(false),
  tryCount: integer("try_count").default(0),
  answered: boolean("answered").default(false),
  hasSentSMS: boolean("has_sent_sms").default(false),
  hasOpenLink: boolean("has_open_link").default(false),
  hasRedirectCall: boolean("has_redirect_call").default(false),
  duration: integer("duration"),
  durationAfterTransfer: integer("duration_after_transfer"),
  hasSummary: boolean("has_summary").default(false),
  // Call disposition tracking
  callDisposition: text("call_disposition"), // 'no_answer_vm', 'booked', 'call_back', 'not_interested', 'medically_uninsurable', 'already_been_sold', 'duplicate', 'do_not_call'
  dispositionNotes: text("disposition_notes"),
  dispositionTimestamp: timestamp("disposition_timestamp"),
  // Taalk integration fields
  taalkSponsorOrg: text("taalk_sponsor_org"),
  taalkMarket: text("taalk_market"),
  taalkLeadSource: text("taalk_lead_source"),
  taalkState: text("taalk_state"),
  taalkReferred: text("taalk_referred"),
  taalkRelationship: text("taalk_relationship"),
  taalkSecretKey: text("taalk_secret_key"),
  taalkGroupCode: text("taalk_group_code"),
  taalkLeadId: text("taalk_lead_id"),
  taalkCity: text("taalk_city"),
  taalkEmail: text("taalk_email"),
  taalkZip: text("taalk_zip"),
  taalkAddress: text("taalk_address"),
});

export const insertVeteranLeadSchema = createInsertSchema(veteranLeads).omit({
  id: true,
});

// OLD appointment schema removed to avoid duplication

// Incoming leads from CSV webhook table
export const incomingLeads = pgTable("incoming_leads", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  referrer: varchar("referrer", { length: 255 }),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  address1: varchar("address_1", { length: 500 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 10 }),
  postalCode: varchar("postal_code", { length: 20 }),
  language: varchar("language", { length: 10 }).default("1"),
  cost: varchar("cost", { length: 20 }),
  gender: varchar("gender", { length: 20 }),
  querystring: text("querystring"),
  status: varchar("status", { length: 50 }).default("new").notNull(),
  assignedAgent: varchar("assigned_agent", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertIncomingLeadSchema = createInsertSchema(incomingLeads).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertIncomingLead = z.infer<typeof insertIncomingLeadSchema>;
export type IncomingLead = typeof incomingLeads.$inferSelect;
export type OutboundCallHistory = typeof outboundCallHistory.$inferSelect;
export type InboundCallRouting = typeof inboundCallRouting.$inferSelect;

// Call Tracking Schemas and Types
export const insertOutboundCallSchema = createInsertSchema(outboundCalls).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertOutboundCall = z.infer<typeof insertOutboundCallSchema>;
export type OutboundCall = typeof outboundCalls.$inferSelect;

export const insertCallCenterEventSchema = createInsertSchema(callCenterEvents).omit({ 
  id: true, 
  timestamp: true 
});
export type InsertCallCenterEvent = z.infer<typeof insertCallCenterEventSchema>;
export type CallCenterEvent = typeof callCenterEvents.$inferSelect;

export const insertAgentMetricsSchema = createInsertSchema(agentMetrics).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertAgentMetrics = z.infer<typeof insertAgentMetricsSchema>;
export type AgentMetrics = typeof agentMetrics.$inferSelect;

// WAR Schema Types
export const insertWarMetricsSchema = createInsertSchema(warMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWarMetrics = z.infer<typeof insertWarMetricsSchema>;
export type WarMetrics = typeof warMetrics.$inferSelect;

export const insertWarTeamSchema = createInsertSchema(warTeams).omit({
  id: true,
  createdAt: true,
});
export type InsertWarTeam = z.infer<typeof insertWarTeamSchema>;
export type WarTeam = typeof warTeams.$inferSelect;

export const insertWarTeamMemberSchema = createInsertSchema(warTeamMembers).omit({
  id: true,
  joinedAt: true,
});
export type InsertWarTeamMember = z.infer<typeof insertWarTeamMemberSchema>;
export type WarTeamMember = typeof warTeamMembers.$inferSelect;

// 🎯 BULLETPROOF CALL TRACKING TYPES
export const insertCallTrackerSchema = createInsertSchema(callTracker).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCallTracker = z.infer<typeof insertCallTrackerSchema>;
export type CallTracker = typeof callTracker.$inferSelect;

export const insertVerificationSessionSchema = createInsertSchema(verificationSessions).omit({
  id: true,
  sessionId: true,
  createdAt: true,
  completedAt: true,
  initiatedAt: true, // Auto-generated timestamp
  callCompletedAt: true, // Auto-generated timestamp
  lastPolledAt: true, // Auto-generated timestamp
}).extend({
  verificationMethod: z.enum(['zoom', 'phone', 'whatsapp', 'facetime']),
});

export const clientInfoSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string().optional().default('USA'), // Add country field for Canada support
  premium: z.string(),
  language: z.string().default('en'),
  verificationMethod: z.enum(['zoom', 'phone', 'whatsapp', 'facetime']),
  spouseName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentFirstName: z.string().optional(),
  agentLastName: z.string().optional(),
  associateId: z.number().optional(),
  achDrawDate: z.string().optional(),
  achDrawDateShort: z.string().optional(),
  zoomRoomId: z.string().optional(),
  zoomPassword: z.string().optional(),
});

export const methodSelectionSchema = z.object({
  sessionId: z.string(),
  verificationMethod: z.enum(['zoom', 'phone', 'whatsapp', 'facetime']),
});

export const screenshotUploadSchema = z.object({
  sessionId: z.string(),
  screenshotPath: z.string(),
});

export const smsVerificationSchema = z.object({
  sessionId: z.string(),
  phone: z.string(),
});

export const clientApprovalSchema = z.object({
  sessionId: z.string(),
  verificationCode: z.string(),
  approved: z.boolean(),
  ipAddress: z.string().optional(),
  location: z.string().optional(),
  userAgent: z.string().optional(),
  timezone: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Import lead tracking tables
export * from './lead-tracking-schema';
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type InsertAgentProfile = z.infer<typeof insertAgentProfileSchema>;
export type VerificationSession = typeof verificationSessions.$inferSelect;
export type InsertVerificationSession = z.infer<typeof insertVerificationSessionSchema>;
export type ClientInfo = z.infer<typeof clientInfoSchema>;

// Appointment types - moved to proper location below
export type MethodSelection = z.infer<typeof methodSelectionSchema>;
export type SMSVerification = z.infer<typeof smsVerificationSchema>;
export type ClientApproval = z.infer<typeof clientApprovalSchema>;
export type ScreenshotUpload = z.infer<typeof screenshotUploadSchema>;

// WAR Connect schema and types
export const insertWarConnectSchema = createInsertSchema(warConnects);
export type InsertWarConnect = z.infer<typeof insertWarConnectSchema>;
export type WarConnect = typeof warConnects.$inferSelect;

// Appointment Scheduling Schemas and Types  
export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  completedAt: true,
});

export const updateAppointmentSchema = insertAppointmentSchema.partial().extend({
  id: z.number(),
});

export const appointmentQuerySchema = z.object({
  agentEmail: z.string().optional(),
  leadId: z.string().optional(),
  status: z.enum(['scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no-show']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  appointmentType: z.enum(['consultation', 'follow-up', 'presentation', 'closing']).optional(),
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type UpdateAppointment = z.infer<typeof updateAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>;

// WAR Submission schema and types
export const insertWarSubmissionSchema = createInsertSchema(warSubmissions);
export type InsertWarSubmission = z.infer<typeof insertWarSubmissionSchema>;
export type WarSubmission = typeof warSubmissions.$inferSelect;

// Appointment Review Cards (for AOI presentation outcomes)
export const appointmentReviews = pgTable("appointment_reviews", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  agentEmail: text("agent_email").notNull(),
  // Appointment outcome
  outcome: text("outcome").notNull(), // 'sale', 'interested', 'not_interested', 'no_show', 'reschedule'
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }), // Premium amount for sales
  notes: text("notes"),
  // Follow-up information
  followUpDate: timestamp("follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  // System tracking
  reviewedAt: timestamp("reviewed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAppointmentReviewSchema = createInsertSchema(appointmentReviews).omit({
  id: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAppointmentReview = z.infer<typeof insertAppointmentReviewSchema>;
export type AppointmentReview = typeof appointmentReviews.$inferSelect;

// Walkthrough System Schemas and Types
export const insertWalkthroughVideoSchema = createInsertSchema(walkthroughVideos).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWalkthroughVideo = z.infer<typeof insertWalkthroughVideoSchema>;
export type WalkthroughVideo = typeof walkthroughVideos.$inferSelect;

export const insertWalkthroughProgressSchema = createInsertSchema(walkthroughProgress).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWalkthroughProgress = z.infer<typeof insertWalkthroughProgressSchema>;
export type WalkthroughProgress = typeof walkthroughProgress.$inferSelect;

export const insertWalkthroughCompletionSchema = createInsertSchema(walkthroughCompletion).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWalkthroughCompletion = z.infer<typeof insertWalkthroughCompletionSchema>;
export type WalkthroughCompletion = typeof walkthroughCompletion.$inferSelect;

// Daily Appointment Accountability System
export const dailyAccountability = pgTable("daily_accountability", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull(),
  accountabilityDate: timestamp("accountability_date").notNull(), // The date they're reporting on (previous day)
  hasCompletedReport: boolean("has_completed_report").default(false),
  totalAppointments: integer("total_appointments").default(0),
  appointmentsReported: integer("appointments_reported").default(0),
  totalSales: integer("total_sales").default(0),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual appointment outcome tracking for detailed analytics
export const appointmentOutcomes = pgTable("appointment_outcomes", {
  id: serial("id").primaryKey(),
  accountabilityId: integer("accountability_id").references(() => dailyAccountability.id).notNull(),
  appointmentId: integer("appointment_id").notNull(),
  appointmentTitle: text("appointment_title").notNull(),
  leadName: text("lead_name").notNull(),
  outcome: text("outcome").notNull(), // 'pending', 'sale', 'refused', 'cannot_afford', 'thinker', 'medically_uninsurable', 'no_need', 'no_show', 'reschedule'
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  agentEmail: text("agent_email").notNull(),
  reportedAt: timestamp("reported_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent System Access Control
export const agentAccessControl = pgTable("agent_access_control", {
  id: serial("id").primaryKey(),
  agentEmail: text("agent_email").notNull().unique(),
  lastAccountabilityDate: timestamp("last_accountability_date"),
  isBlocked: boolean("is_blocked").default(false),
  blockedReason: text("blocked_reason"),
  nextRequiredAccountabilityDate: timestamp("next_required_accountability_date"),
  consecutiveDaysCompleted: integer("consecutive_days_completed").default(0),
  totalAccountabilityReports: integer("total_accountability_reports").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});



export const insertDailyAccountabilitySchema = createInsertSchema(dailyAccountability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentAccessControlSchema = createInsertSchema(agentAccessControl).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentOutcomeSchema = createInsertSchema(appointmentOutcomes).omit({
  id: true,
  reportedAt: true,
  createdAt: true,
});

export const insertCallDispositionInconsistencySchema = createInsertSchema(callDispositionInconsistencies).omit({
  id: true,
  createdAt: true,
});

export const insertLeadCampaignSchema = createInsertSchema(leadCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDailyAccountability = z.infer<typeof insertDailyAccountabilitySchema>;
export type DailyAccountability = typeof dailyAccountability.$inferSelect;
export type InsertAgentAccessControl = z.infer<typeof insertAgentAccessControlSchema>;
export type AgentAccessControl = typeof agentAccessControl.$inferSelect;
export type InsertAppointmentOutcome = z.infer<typeof insertAppointmentOutcomeSchema>;
export type AppointmentOutcome = typeof appointmentOutcomes.$inferSelect;
export type InsertCallDispositionInconsistency = z.infer<typeof insertCallDispositionInconsistencySchema>;
export type CallDispositionInconsistency = typeof callDispositionInconsistencies.$inferSelect;
export type InsertLeadCampaign = z.infer<typeof insertLeadCampaignSchema>;
export type LeadCampaign = typeof leadCampaigns.$inferSelect;

// ConnectNow Platform Tables

// Outbound Call Tracking table for intelligent inbound routing
export const outboundCallHistory = pgTable("outbound_call_history", {
  id: serial("id").primaryKey(),
  leadPhone: varchar("lead_phone", { length: 20 }).notNull(),
  leadName: varchar("lead_name", { length: 255 }),
  leadState: varchar("lead_state", { length: 10 }),
  agentEmail: varchar("agent_email", { length: 255 }).notNull(),
  agentName: varchar("agent_name", { length: 255 }),
  callSid: varchar("call_sid", { length: 255 }),
  conferenceName: varchar("conference_name", { length: 255 }),
  localPresenceNumber: varchar("local_presence_number", { length: 20 }),
  callStatus: varchar("call_status", { length: 50 }).default("initiated"),
  callDisposition: varchar("call_disposition", { length: 100 }),
  callDuration: integer("call_duration").default(0),
  callAttempts: integer("call_attempts").default(1),
  lastContactedAt: timestamp("last_contacted_at").defaultNow(),
  startTime: timestamp("start_time").defaultNow(),
  answerTime: timestamp("answer_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow(),
  notes: text("notes"),
});

// Inbound Call Routing table for callback management
export const inboundCallRouting = pgTable("inbound_call_routing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callerPhone: varchar("caller_phone", { length: 20 }).notNull(),
  incomingCallSid: varchar("incoming_call_sid", { length: 255 }),
  routedToAgent: varchar("routed_to_agent", { length: 255 }),
  routingReason: varchar("routing_reason", { length: 100 }), // "callback", "new_caller", "manual_assignment"
  conferenceName: varchar("conference_name", { length: 255 }),
  callStartTime: timestamp("call_start_time").defaultNow(),
  callEndTime: timestamp("call_end_time"),
  callDuration: integer("call_duration"),
  callStatus: varchar("call_status", { length: 50 }).default("active"),
  notes: text("notes"),
});

// Teams table
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  managerId: text("manager_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Roles table
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced users table for ConnectNow
export const connectnowUsers = pgTable("connectnow_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  supabaseUserId: text("supabase_user_id").unique(),
  isAdmin: boolean("is_admin").default(false),
  isActive: boolean("is_active").default(true),
  teamId: text("team_id"),
  roleId: text("role_id"),
  creditsRemaining: integer("credits_remaining").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quality Manager Roles - assign QM role to specific users by email
export const qualityManagerRoles = pgTable("quality_manager_roles", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").default(true),
  assignedBy: text("assigned_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// MGA/RGA Teams - master list of MGA and RGA teams for assignment
export const mgaTeams = pgTable("mga_teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  teamType: varchar("team_type", { length: 10 }).default("MGA"), // "MGA" or "RGA"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quality Manager Team Assignments - control data access by MGA team
export const qualityManagerAssignments = pgTable("quality_manager_assignments", {
  id: serial("id").primaryKey(),
  qmEmail: text("qm_email").notNull(),
  mgaTeamId: integer("mga_team_id").references(() => mgaTeams.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Call Minutes Usage Tracking table
export const callUsageTracking = pgTable("call_usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  callType: varchar("call_type", { length: 20 }).notNull(), // "voice", "video", "conference"
  callId: varchar("call_id", { length: 255 }).notNull(), // Twilio CallSid or Whereby meeting ID
  leadPhone: varchar("lead_phone", { length: 20 }),
  leadName: varchar("lead_name", { length: 255 }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds").default(0),
  durationMinutes: decimal("duration_minutes", { precision: 10, scale: 2 }).default("0.00"),
  creditsCharged: decimal("credits_charged", { precision: 10, scale: 4 }).default("0.0000"),
  billingRate: decimal("billing_rate", { precision: 10, scale: 4 }).default("0.0167"), // $1/hour = ~$0.0167/minute
  totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0.0000"),
  billingStatus: varchar("billing_status", { length: 20 }).default("pending"), // "pending", "charged", "failed"
  platform: varchar("platform", { length: 50 }), // "twilio", "whereby", "aoi-meet"
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Additional call details
  createdAt: timestamp("created_at").defaultNow(),
  billedAt: timestamp("billed_at"),
});

// Video Meeting Usage Tracking table
export const videoMeetingTracking = pgTable("video_meeting_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  meetingId: varchar("meeting_id", { length: 255 }).notNull(),
  meetingType: varchar("meeting_type", { length: 20 }).notNull(), // "whereby", "zoom", "aoi-meet"
  roomUrl: text("room_url"),
  hostRoomUrl: text("host_room_url"),
  leadName: varchar("lead_name", { length: 255 }),
  leadPhone: varchar("lead_phone", { length: 20 }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds").default(0),
  durationMinutes: decimal("duration_minutes", { precision: 10, scale: 2 }).default("0.00"),
  participantCount: integer("participant_count").default(1),
  maxParticipants: integer("max_participants").default(1),
  creditsCharged: decimal("credits_charged", { precision: 10, scale: 4 }).default("0.0000"),
  billingRate: decimal("billing_rate", { precision: 10, scale: 4 }).default("0.0167"), // $1/hour = ~$0.0167/minute
  totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0.0000"),
  billingStatus: varchar("billing_status", { length: 20 }).default("pending"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  billedAt: timestamp("billed_at"),
});

// User Credits table (matches actual Supabase structure with UUID)
export const userCredits = pgTable("user_credits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  externalId: text("external_id"),
  stripeId: text("stripe_id"),
  stripeCreated: text("stripe_created"),
  totalSpend: decimal("total_spend"),
  paymentCount: integer("payment_count"),
  refunded: decimal("refunded"),
  creditsPurchased: integer("credits_purchased").default(0),
  creditsUsed: integer("credits_used").default(0),
  needsAdditionalCredits: integer("needs_additional_credits"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  associateId: text("associate_id"),
  manualAdjustments: integer("manual_adjustments").default(0),
  creditsRemaining: integer("credits_remaining").default(0),
  autoRefillEnabled: boolean("auto_refill_enabled").default(false),
  refillAmount: integer("refill_amount").default(0),
  threshold: integer("threshold").default(0),
  zeroCreditsNotified: boolean("zero_credits_notified").default(false),
  aoiConnectCreditsUsed: integer("aoi_connect_credits_used").default(0),
  aoiPlusCreditsUsed: integer("aoi_plus_credits_used").default(0),
  aoiPrecheckCreditsUsed: integer("aoi_precheck_credits_used").default(0),
  aoiRecruitCreditsUsed: integer("aoi_recruit_credits_used").default(0),
  aoiPlusOptedIn: boolean("aoi_plus_opted_in").default(false),
  aoiRecruitOptedIn: boolean("aoi_recruit_opted_in").default(false),
  aoiConnectOptedIn: boolean("aoi_connect_opted_in").default(false),
});



// Incoming Calls table - Enhanced for Taalk VDP integration
export const incomingCalls = pgTable("incoming_calls", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  callerNumber: text("caller_number"),
  twilioCallSid: text("twilio_call_sid"),
  assignedAgentEmail: text("assigned_agent_email"),
  status: text("status"), // 'ringing', 'answered', 'declined', 'completed', 'missed'
  callType: text("call_type").default("inbound"), // 'VDP', 'inbound', 'support'
  leadName: text("lead_name"),
  leadCity: text("lead_city"),
  leadState: text("lead_state"),
  duration: integer("duration"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  answeredAt: timestamp("answered_at"),
  endedAt: timestamp("ended_at"),
});

// Gamification tables
export const userGameStats = pgTable("user_game_stats", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  streak: integer("streak").default(0),
  achievements: jsonb("achievements").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leaderboard table
export const leaderboard = pgTable("leaderboard", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  period: text("period"), // 'daily', 'weekly', 'monthly'
  metric: text("metric"), // 'calls', 'sales', 'xp'
  value: integer("value"),
  rank: integer("rank"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  manager: one(connectnowUsers, {
    fields: [teams.managerId],
    references: [connectnowUsers.id],
  }),
  members: many(connectnowUsers),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(connectnowUsers),
}));

export const connectnowUsersRelations = relations(connectnowUsers, ({ one, many }) => ({
  team: one(teams, {
    fields: [connectnowUsers.teamId],
    references: [teams.id],
  }),
  role: one(roles, {
    fields: [connectnowUsers.roleId],
    references: [roles.id],
  }),
  callLogs: many(callLogs),
  vdpCalls: many(vdpCalls),
  incomingCalls: many(incomingCalls),
  gameStats: one(userGameStats, {
    fields: [connectnowUsers.id],
    references: [userGameStats.userId],
  }),
}));

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  // No relations for now - keeping it simple
}));

export const vdpCallsRelations = relations(vdpCalls, ({ one }) => ({
  // No user relation - VDP calls don't have userId field
}));

export const incomingCallsRelations = relations(incomingCalls, ({ one }) => ({
  user: one(connectnowUsers, {
    fields: [incomingCalls.userId],
    references: [connectnowUsers.id],
  }),
}));

export const userGameStatsRelations = relations(userGameStats, ({ one }) => ({
  user: one(connectnowUsers, {
    fields: [userGameStats.userId],
    references: [connectnowUsers.id],
  }),
}));

// ConnectNow schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConnectNowUserSchema = createInsertSchema(connectnowUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});

export const insertVdpCallSchema = createInsertSchema(vdpCalls).omit({
  id: true,
  createdAt: true,
});

// Admin system roles and permissions
export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").default(sql`'[]'::jsonb`),
  level: integer("level").default(0), // 0=agent, 1=manager, 2=admin, 3=super_admin
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User roles assignment table
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userEmail: text("user_email").notNull(),
  roleId: text("role_id").notNull(),
  assignedBy: text("assigned_by"),
  assignedAt: timestamp("assigned_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Admin activity logs
export const adminLogs = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetUserId: text("target_user_id"),
  targetUserEmail: text("target_user_email"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminRoleSchema = createInsertSchema(adminRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  assignedAt: true,
});

export const insertAdminLogSchema = createInsertSchema(adminLogs).omit({
  id: true,
  createdAt: true,
});

export const insertFeedbackReportSchema = createInsertSchema(feedbackReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ConnectNow types
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type ConnectNowUser = typeof connectnowUsers.$inferSelect;
export type InsertConnectNowUser = z.infer<typeof insertConnectNowUserSchema>;
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type VdpCall = typeof vdpCalls.$inferSelect;
export type InsertVdpCall = z.infer<typeof insertVdpCallSchema>;
export type IncomingCall = typeof incomingCalls.$inferSelect;
export type UserGameStats = typeof userGameStats.$inferSelect;
export type LeaderboardEntry = typeof leaderboard.$inferSelect;

// Admin types
export type AdminRole = typeof adminRoles.$inferSelect;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type FeedbackReport = typeof feedbackReports.$inferSelect;
export type InsertFeedbackReport = z.infer<typeof insertFeedbackReportSchema>;

// Recruit Candidates schemas and types
export const insertRecruitCandidateSchema = createInsertSchema(recruitCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRecruitCandidateSchema = createInsertSchema(recruitCandidates).omit({
  id: true,
  createdAt: true,
  agentId: true,
  agentEmail: true,
}).partial();

export type RecruitCandidate = typeof recruitCandidates.$inferSelect;
export type InsertRecruitCandidate = z.infer<typeof insertRecruitCandidateSchema>;
export type UpdateRecruitCandidate = z.infer<typeof updateRecruitCandidateSchema>;

// Extended CallLog interface for Supabase VDP data
export interface CallHistoryEntry extends CallLog {
  market?: string | null;
  state?: string | null;
}

// Call Usage Tracking schemas
export const insertCallUsageTrackingSchema = createInsertSchema(callUsageTracking).omit({
  id: true,
  createdAt: true,
  billedAt: true,
});

export const insertVideoMeetingTrackingSchema = createInsertSchema(videoMeetingTracking).omit({
  id: true,
  createdAt: true,
  billedAt: true,
});

// Call Usage Tracking types
export type CallUsageTracking = typeof callUsageTracking.$inferSelect;
export type InsertCallUsageTracking = z.infer<typeof insertCallUsageTrackingSchema>;
export type VideoMeetingTracking = typeof videoMeetingTracking.$inferSelect;
export type InsertVideoMeetingTracking = z.infer<typeof insertVideoMeetingTrackingSchema>;

// USER ACTIVITY TRACKING SYSTEM
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  sessionId: text("session_id").notNull().unique(), // UUID for session tracking
  loginTime: timestamp("login_time").notNull().defaultNow(),
  logoutTime: timestamp("logout_time"), // Null until logout
  sessionDuration: integer("session_duration"), // Duration in seconds
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pageActivityLogs = pgTable("page_activity_logs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(), // Links to user_sessions
  userEmail: text("user_email").notNull(),
  pagePath: text("page_path").notNull(), // e.g., "/dashboard/aoi", "/call-connector-pro"
  pageTitle: text("page_title"), // Human readable page name
  timeSpent: integer("time_spent"), // Time spent on page in seconds
  visitedAt: timestamp("visited_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"), // When they left the page
});

export const featureUsageLogs = pgTable("feature_usage_logs", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userEmail: text("user_email").notNull(),
  featureName: text("feature_name").notNull(), // e.g., "vdp_call", "call_connector_pro", "billing_report"
  action: text("action").notNull(), // e.g., "started", "completed", "clicked", "viewed"
  metadata: jsonb("metadata"), // Additional context data
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const dailyUserStats = pgTable("daily_user_stats", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  totalSessionTime: integer("total_session_time").default(0), // Total seconds online
  pageViews: integer("page_views").default(0), // Number of page visits
  featuresUsed: jsonb("features_used").default(sql`'[]'::jsonb`), // Array of features accessed
  callsMade: integer("calls_made").default(0), // Number of calls made
  vdpConnects: integer("vdp_connects").default(0), // VDP connects made
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema and type definitions for new tables
export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export const insertPageActivityLogSchema = createInsertSchema(pageActivityLogs).omit({
  id: true,
});

export const insertFeatureUsageLogSchema = createInsertSchema(featureUsageLogs).omit({
  id: true,
});

export const insertDailyUserStatsSchema = createInsertSchema(dailyUserStats).omit({
  id: true,
  createdAt: true,
});

// Types for usage tracking
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type PageActivityLog = typeof pageActivityLogs.$inferSelect;
export type InsertPageActivityLog = z.infer<typeof insertPageActivityLogSchema>;
export type FeatureUsageLog = typeof featureUsageLogs.$inferSelect;
export type InsertFeatureUsageLog = z.infer<typeof insertFeatureUsageLogSchema>;
export type DailyUserStats = typeof dailyUserStats.$inferSelect;
export type InsertDailyUserStats = z.infer<typeof insertDailyUserStatsSchema>;

// Role Page Permissions schemas
export const insertRolePagePermissionSchema = createInsertSchema(rolePagePermissions).omit({
  createdAt: true,
  updatedAt: true,
});

export type RolePagePermission = typeof rolePagePermissions.$inferSelect;
export type InsertRolePagePermission = z.infer<typeof insertRolePagePermissionSchema>;

// Quality Manager Team Assignment schemas
export const insertQualityManagerTeamAssignmentSchema = createInsertSchema(qualityManagerTeamAssignments).omit({
  id: true,
  createdAt: true,
});

// Quality Manager types
export type QualityManagerTeamAssignment = typeof qualityManagerTeamAssignments.$inferSelect;
export type InsertQualityManagerTeamAssignment = z.infer<typeof insertQualityManagerTeamAssignmentSchema>;

// Default permissions matrix
export const DEFAULT_PAGE_PERMISSIONS: Record<TeamRole, PageKey[]> = {
  system_admin: [...PAGE_KEYS], // System admin gets access to all pages
  rga: ['billing-dashboard', 'aoi-report', 'appointments', 'ao-recruit', 'ao-precheck', 'settings', 'ao-intelligence', 'ao-connect', 'admin', 'user-management', 'teams-management'], // RGA gets broad access
  mga: ['billing-dashboard', 'aoi-report', 'appointments', 'ao-recruit', 'ao-precheck', 'settings', 'ao-intelligence', 'ao-connect', 'teams-management'], // MGA gets team management access
  agent: ['billing-dashboard', 'aoi-report', 'appointments', 'ao-recruit', 'ao-precheck', 'settings', 'ao-intelligence', 'ao-connect'], // Agent access as requested
  quality_manager: ['settings', 'ao-precheck-management'], // Quality manager limited access as requested
  ao_quality_manager: ['settings', 'ao-precheck-management', 'aoi-report', 'ao-intelligence'], // AO Quality Manager with AO-focused access
};
