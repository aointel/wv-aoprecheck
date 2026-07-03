import {
  users,
  verificationSessions,
  agentProfiles,
  appointments,
  incomingLeads,
  outboundCallHistory,
  inboundCallRouting,
  recruitCandidates,
  aoiFollowups,
  qualityManagerTeamAssignments,
  mgaTeams,
  type User,
  type InsertUser,
  type VerificationSession,
  type InsertVerificationSession,
  type AgentProfile,
  type InsertAgentProfile,
  type Appointment,
  type InsertAppointment,
  type IncomingLead,
  type InsertIncomingLead,
  type OutboundCallHistory,
  type InboundCallRouting,
  type RecruitCandidate,
  type InsertRecruitCandidate,
  type UpdateRecruitCandidate,
  type CurrentLead,
  type QualityManagerTeamAssignment,
  type InsertQualityManagerTeamAssignment
} from "@shared/schema";
import { nanoid } from "nanoid";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { supabase as supabaseClient, supabaseAdmin } from "./supabase";
import { masterleadClient } from "./local-masterlead-client";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Legacy agent profile methods (single profile)
  getAgentProfile(): Promise<AgentProfile | undefined>;
  createOrUpdateAgentProfile(profile: InsertAgentProfile): Promise<AgentProfile>;

  // Supabase-linked agent profile methods (multi-user)
  getAgentProfileBySupabaseId(supabaseUserId: string): Promise<AgentProfile | null>;
  getAgentProfileByEmail(email: string): Promise<AgentProfile | null>;
  /** Rows in agent_profiles matching email (ilike, normalized). >1 breaks PostgREST .single() on multi-row updates. */
  countAgentProfilesForEmail(email: string): Promise<number>;
  updateAgentProfileByEmail(email: string, updates: Partial<InsertAgentProfile>): Promise<AgentProfile | null>;
  createAgentProfileWithEmail(profileData: InsertAgentProfile & { email: string }): Promise<AgentProfile>;
  getAllAgentProfiles(): Promise<AgentProfile[]>;
  createAgentProfileWithSupabaseId(profileData: InsertAgentProfile & { supabaseUserId: string }): Promise<AgentProfile>;
  updateAgentProfileBySupabaseId(supabaseUserId: string, updates: Partial<InsertAgentProfile>): Promise<AgentProfile | null>;
  syncAllProfilesToHierarchy(): Promise<void>;

  // RGA Management
  getDistinctRGATeams(): Promise<string[]>;
  getMGAsByRGA(rgaTeam: string): Promise<string[]>;
  assignMGAToRGA(mgaTeam: string, rgaTeam: string): Promise<void>;

  createVerificationSession(session: Omit<InsertVerificationSession, 'sessionId'>): Promise<VerificationSession>;
  getVerificationSession(sessionId: string): Promise<VerificationSession | undefined>;
  getVerificationSessionByCode(verificationCode: string): Promise<VerificationSession | undefined>;
  updateVerificationSession(sessionId: string, updates: Partial<VerificationSession>): Promise<VerificationSession | undefined>;
  completeVerificationSession(sessionId: string): Promise<VerificationSession | undefined>;

  // Appointment methods
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  getAppointments(agentId: string): Promise<Appointment[]>;
  getAppointmentsByDate(agentId: string, date: string): Promise<Appointment[]>;
  updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;

  // Incoming leads operations (CSV webhook)
  createIncomingLead(lead: InsertIncomingLead): Promise<IncomingLead>;
  getIncomingLeads(status?: string): Promise<IncomingLead[]>;
  updateIncomingLeadStatus(id: number, status: string, assignedAgent?: string): Promise<IncomingLead | undefined>;

  // Outbound call tracking for intelligent inbound routing
  trackOutboundCall(callData: Partial<OutboundCallHistory>): Promise<OutboundCallHistory>;
  createOutboundCall(callData: {
    leadPhone: string;
    agentEmail: string;
    callSid: string;
    callStatus: string;
    callDisposition?: string;
    callDuration?: number;
    startTime?: Date;
    endTime?: Date;
  }): Promise<OutboundCallHistory>;
  updateOutboundCallStatus(updateData: {
    leadPhone: string;
    agentEmail: string;
    callStatus?: string;
    callDisposition?: string;
    callDuration?: number;
    answerTime?: Date;
    endTime?: Date;
  }): Promise<OutboundCallHistory | undefined>;
  getLastCallToNumber(phoneNumber: string): Promise<OutboundCallHistory | undefined>;
  getAgentForCallbacks(phoneNumber: string): Promise<string | undefined>;

  // Inbound call routing management
  createInboundCallRoute(routeData: Partial<InboundCallRouting>): Promise<InboundCallRouting>;
  getActiveInboundCalls(agentEmail?: string): Promise<InboundCallRouting[]>;
  updateInboundCallStatus(callSid: string, status: string, endTime?: Date): Promise<InboundCallRouting | undefined>;
  getCallbackStats(): Promise<{
    totalActiveCalls: number;
    callbackCalls: number;
    newCallerCalls: number;
    callbackPercentage: number;
    agentSpecificCallbacks: Record<string, number>;
  }>;

  // Recruit Candidates operations
  createRecruitCandidate(candidate: InsertRecruitCandidate): Promise<RecruitCandidate>;
  getRecruitCandidates(agentEmail: string): Promise<RecruitCandidate[]>;
  getRecruitCandidateById(id: number): Promise<RecruitCandidate | undefined>;
  updateRecruitCandidate(id: number, updates: UpdateRecruitCandidate): Promise<RecruitCandidate | undefined>;
  deleteRecruitCandidate(id: number): Promise<boolean>;

  // Music preferences
  getMusicPreferences(agentEmail: string): Promise<{ musicType: string } | null>;

  // Team management
  getDistinctMGATeams(): Promise<string[]>;

  // AOI Follow-up Management - Two-stage accountability
  createFollowup(followupData: any): Promise<any>;
  getOverdueFollowups(): Promise<any[]>;
  getPendingFollowups(agentEmail: string): Promise<any[]>;
  completeFollowup(followupId: number, outcome: string, notes?: string): Promise<any>;

  // Current Lead Management - supports both masterlead and vdp sources
  getCurrentLead(userEmail: string): Promise<CurrentLead | null>;
  setCurrentLead(userEmail: string, currentLead: CurrentLead): Promise<void>;
  clearCurrentLead(userEmail: string): Promise<void>;

  // Quality Manager Team Assignments
  getQMTeamAssignments(qmEmail: string): Promise<string[]>;
  assignQMToTeam(qmEmail: string, mgaTeam: string): Promise<void>;
  removeQMFromTeam(qmEmail: string, mgaTeam: string): Promise<void>;
  replaceQMTeamAssignments(qmEmail: string, mgaTeams: string[]): Promise<void>;
  getAllQMTeamAssignments(): Promise<QualityManagerTeamAssignment[]>;

  // Enhanced Team Management - MGA/RGA Teams
  getAllTeams(): Promise<Array<{id: number, name: string, description: string, teamType: string, isActive: boolean}>>;
  getTeamsByType(teamType: 'MGA' | 'RGA'): Promise<Array<{id: number, name: string, description: string, teamType: string, isActive: boolean}>>;
  getQualityManagersByTeam(teamId: number): Promise<string[]>;
  assignQMToTeamById(qmEmail: string, teamId: number): Promise<void>;
  removeQMFromTeamById(qmEmail: string, teamId: number): Promise<void>;
}

// AOI Followup types
export type AoiFollowup = typeof aoiFollowups.$inferSelect;
export type InsertAoiFollowup = typeof aoiFollowups.$inferInsert;

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private verificationSessions: Map<string, VerificationSession>;
  private agentProfile: AgentProfile | null;
  private currentUserId: number;
  private currentSessionId: number;
  private currentLeads: Map<string, CurrentLead>;

  constructor() {
    this.users = new Map();
    this.verificationSessions = new Map();
    this.agentProfile = null;
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentLeads = new Map();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      agentPhone: insertUser.agentPhone || null,
      agentName: insertUser.agentName || null
    };
    this.users.set(id, user);
    return user;
  }

  async getAgentProfile(): Promise<AgentProfile | undefined> {
    return this.agentProfile || undefined;
  }

  async createOrUpdateAgentProfile(profile: InsertAgentProfile): Promise<AgentProfile> {
    const agentProfile: AgentProfile = {
      id: 1,
      supabaseUserId: 'mem-storage-default',
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      email: profile.email,
      zoomId: profile.zoomId || null,
      zoomPassword: profile.zoomPassword || null,
      profilePicture: profile.profilePicture || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.agentProfile = agentProfile;
    return agentProfile;
  }

  async createVerificationSession(session: Omit<InsertVerificationSession, 'sessionId'>): Promise<VerificationSession> {
    const sessionId = `VER-${Date.now()}-${nanoid(6)}`;

    // This is MemStorage - should NOT use database, just store in memory
    const verificationSession: VerificationSession = {
      id: this.verificationSessions.size + 1,
      sessionId,
      firstName: session.firstName,
      lastName: session.lastName,
      spouseName: session.spouseName,
      phone: session.phone,
      agentPhone: session.agentPhone,
      agentFirstName: session.agentFirstName || null,
      agentLastName: session.agentLastName || null,
      city: session.city,
      state: session.state,
      premium: session.premium,
      achDrawDate: session.achDrawDate || null,
      achDrawDateShort: session.achDrawDateShort || null,
      verificationMethod: session.verificationMethod,
      zoomRoomId: session.zoomRoomId,
      zoomPassword: session.zoomPassword,
      language: session.language || 'en',
      screenshotPath: session.screenshotPath || null,
      status: 'pending',
      createdAt: new Date(),
      smsVerificationCode: null,
      clientApprovalTimestamp: null,
      completedAt: null,
      // Add missing fields that were causing errors
      taalkCallId: null,
      taalkCallStatus: null,
      taalkCallInitiatedAt: null,
      taalkCallCompletedAt: null,
      callCompleted: false,
      verificationResult: null
    };

    this.verificationSessions.set(sessionId, verificationSession);
    return verificationSession;
  }

  async getVerificationSession(sessionId: string): Promise<VerificationSession | undefined> {
    return this.verificationSessions.get(sessionId);
  }

  async getVerificationSessionByCode(verificationCode: string): Promise<VerificationSession | undefined> {
    return Array.from(this.verificationSessions.values()).find(
      (session) => session.smsVerificationCode === verificationCode,
    );
  }

  async updateVerificationSession(sessionId: string, updates: Partial<VerificationSession>): Promise<VerificationSession | undefined> {
    const session = this.verificationSessions.get(sessionId);
    if (!session) return undefined;

    const updatedSession = { ...session, ...updates };
    this.verificationSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async completeVerificationSession(sessionId: string): Promise<VerificationSession | undefined> {
    const session = this.verificationSessions.get(sessionId);
    if (!session) return undefined;

    const completedSession = {
      ...session,
      status: 'completed' as const,
      completedAt: new Date(),
    };
    this.verificationSessions.set(sessionId, completedSession);
    return completedSession;
  }

  // Supabase-linked agent profile methods (not implemented in memory storage)
  async getAgentProfileBySupabaseId(supabaseUserId: string): Promise<AgentProfile | null> {
    return null; // Memory storage doesn't support Supabase linking
  }

  async createAgentProfileWithSupabaseId(profileData: InsertAgentProfile & { supabaseUserId: string }): Promise<AgentProfile> {
    // For memory storage, just create without Supabase linking
    return this.createOrUpdateAgentProfile(profileData);
  }

  async getAgentProfileByEmail(email: string): Promise<AgentProfile | null> {
    return null; // Memory storage doesn't support email lookup
  }

  async countAgentProfilesForEmail(_email: string): Promise<number> {
    return 0;
  }

  async getAllAgentProfiles(): Promise<AgentProfile[]> {
    return []; // Memory storage doesn't support multi-user profiles
  }

  // RGA Management (stub implementations for memory storage)
  async getDistinctRGATeams(): Promise<string[]> {
    return []; // Memory storage doesn't support RGA management
  }

  async getMGAsByRGA(rgaTeam: string): Promise<string[]> {
    return []; // Memory storage doesn't support RGA management
  }

  async assignMGAToRGA(mgaTeam: string, rgaTeam: string): Promise<void> {
    // Memory storage doesn't support RGA management
  }

  async updateAgentProfileBySupabaseId(supabaseUserId: string, updates: Partial<InsertAgentProfile>): Promise<AgentProfile | null> {
    return null; // Memory storage doesn't support Supabase linking
  }

  // Appointment methods (stub implementations for memory storage)
  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    throw new Error("Appointments not supported in memory storage");
  }

  async getAppointments(agentId: string): Promise<Appointment[]> {
    return [];
  }

  async getAppointmentsByDate(agentId: string, date: string): Promise<Appointment[]> {
    return [];
  }

  async updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined> {
    return undefined;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    return false;
  }

  // Incoming leads operations (stub implementations for memory storage)
  async createIncomingLead(lead: InsertIncomingLead): Promise<IncomingLead> {
    throw new Error("Incoming leads not supported in memory storage");
  }

  async getIncomingLeads(status?: string): Promise<IncomingLead[]> {
    return [];
  }

  async updateIncomingLeadStatus(id: number, status: string, assignedAgent?: string): Promise<IncomingLead | undefined> {
    return undefined;
  }

  // Call tracking operations (stub implementations for memory storage)
  async trackOutboundCall(callData: Partial<OutboundCallHistory>): Promise<OutboundCallHistory> {
    throw new Error("Call tracking not supported in memory storage");
  }

  async updateOutboundCallStatus(updateData: {
    leadPhone: string;
    agentEmail: string;
    callStatus?: string;
    callDisposition?: string;
    callDuration?: number;
    answerTime?: Date;
    endTime?: Date;
  }): Promise<OutboundCallHistory | undefined> {
    return undefined;
  }

  async getLastCallToNumber(phoneNumber: string): Promise<OutboundCallHistory | undefined> {
    return undefined;
  }

  async getAgentForCallbacks(phoneNumber: string): Promise<string | undefined> {
    return undefined;
  }

  async createInboundCallRoute(routeData: Partial<InboundCallRouting>): Promise<InboundCallRouting> {
    throw new Error("Inbound call routing not supported in memory storage");
  }

  async getActiveInboundCalls(agentEmail?: string): Promise<InboundCallRouting[]> {
    return [];
  }

  async updateInboundCallStatus(callSid: string, status: string, endTime?: Date): Promise<InboundCallRouting | undefined> {
    return undefined;
  }

  async getCallbackStats(): Promise<{
    totalActiveCalls: number;
    callbackCalls: number;
    newCallerCalls: number;
    callbackPercentage: number;
    agentSpecificCallbacks: Record<string, number>;
  }> {
    return {
      totalActiveCalls: 0,
      callbackCalls: 0,
      newCallerCalls: 0,
      callbackPercentage: 0,
      agentSpecificCallbacks: {}
    };
  }

  // Recruit Candidates operations (stub implementations for memory storage)
  async createRecruitCandidate(candidate: InsertRecruitCandidate): Promise<RecruitCandidate> {
    throw new Error("Recruit candidates not supported in memory storage");
  }

  async getRecruitCandidates(agentEmail: string): Promise<RecruitCandidate[]> {
    return [];
  }

  async getRecruitCandidateById(id: number): Promise<RecruitCandidate | undefined> {
    return undefined;
  }

  async updateRecruitCandidate(id: number, updates: UpdateRecruitCandidate): Promise<RecruitCandidate | undefined> {
    return undefined;
  }

  async deleteRecruitCandidate(id: number): Promise<boolean> {
    return false;
  }

  // Music preferences - simple stub for MemStorage
  async getMusicPreferences(agentEmail: string): Promise<{ musicType: string } | null> {
    return { musicType: 'silence' };
  }

  // Team management - simple stub for MemStorage
  async getDistinctMGATeams(): Promise<string[]> {
    return ['Team Alpha', 'Team Beta', 'Team Gamma'];
  }

  // Quality Manager Team Assignment stubs
  async getQMTeamAssignments(qmEmail: string): Promise<string[]> {
    return [];
  }

  async assignQMToTeam(qmEmail: string, mgaTeam: string): Promise<void> {
    // Stub implementation
  }

  async removeQMFromTeam(qmEmail: string, mgaTeam: string): Promise<void> {
    // Stub implementation
  }

  async replaceQMTeamAssignments(qmEmail: string, mgaTeams: string[]): Promise<void> {
    // Stub implementation
  }

  async getAllQMTeamAssignments(): Promise<QualityManagerTeamAssignment[]> {
    return [];
  }

  // Enhanced Team Management stubs
  async getAllTeams(): Promise<Array<{id: number, name: string, description: string, teamType: string, isActive: boolean}>> {
    return [
      {id: 1, name: 'Sample MGA Team', description: 'Sample MGA', teamType: 'MGA', isActive: true},
      {id: 2, name: 'Sample RGA Team', description: 'Sample RGA', teamType: 'RGA', isActive: true}
    ];
  }

  async getTeamsByType(teamType: 'MGA' | 'RGA'): Promise<Array<{id: number, name: string, description: string, teamType: string, isActive: boolean}>> {
    const allTeams = await this.getAllTeams();
    return allTeams.filter(team => team.teamType === teamType);
  }

  async getQualityManagersByTeam(teamId: number): Promise<string[]> {
    return [];
  }

  async assignQMToTeamById(qmEmail: string, teamId: number): Promise<void> {
    // Stub implementation
  }

  async removeQMFromTeamById(qmEmail: string, teamId: number): Promise<void> {
    // Stub implementation
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  private teamDirectoryCache = new Map<string, number | null>();

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAgentProfile(): Promise<AgentProfile | undefined> {
    const [profile] = await db.select().from(agentProfiles).limit(1);
    return profile || undefined;
  }

  async createOrUpdateAgentProfile(profile: InsertAgentProfile): Promise<AgentProfile> {
    const existing = await this.getAgentProfile();

    if (existing) {
      const [updatedProfile] = await db
        .update(agentProfiles)
        .set({
          ...profile,
          updatedAt: new Date(),
        })
        .where(eq(agentProfiles.id, existing.id))
        .returning();
      return updatedProfile;
    } else {
      const [newProfile] = await db
        .insert(agentProfiles)
        .values(profile)
        .returning();
      return newProfile;
    }
  }

  async createVerificationSession(session: Omit<InsertVerificationSession, 'sessionId'>): Promise<VerificationSession> {
    const sessionId = `VER-${Date.now()}-${nanoid(6)}`;

    // 🔥 CRITICAL: Use MGA/RGA from session if already provided (from routes.ts lookup)
    // Only do lookup if NOT already provided
    let agentMgaTeam = (session as any).agentMgaTeam || null;
    let agentRgaTeam = (session as any).agentRgaTeam || null;
    let agentAssociateId = (session as any).associateId;
    let agentCompanyEmail = (session as any).companyEmail;

    console.log(`🔍 VERIFICATION SESSION CREATION: MGA=${agentMgaTeam}, RGA=${agentRgaTeam}, AssociateId=${agentAssociateId}, Email=${agentCompanyEmail}`);

    // Only do lookup if MGA/RGA are NOT already provided
    if (!agentMgaTeam && supabaseClient) {
      try {
        const supabase = supabaseClient;
        
        // First try to find by associate_id if available using agent_hierarchy
        if (agentAssociateId) {
          const { data: hierarchyData, error: hierarchyError } = await supabase
            .from('agent_hierarchy')
            .select('agent_associate_id, agent_name, agent_email, mga_name, rga_name')
            .eq('agent_associate_id', agentAssociateId)
            .single();
        console.log(`🔍 SUPABASE HIERARCHY: error=${JSON.stringify(hierarchyError)}, hasData=${!!hierarchyData}}`);
          
          if (!hierarchyError && hierarchyData) {
            agentMgaTeam = hierarchyData.mga_name;
            agentRgaTeam = hierarchyData.rga_name;
            agentCompanyEmail = hierarchyData.agent_email;
            console.log(`🔍 Found agent in hierarchy by associate_id ${agentAssociateId}: ${hierarchyData.agent_name} (MGA: ${agentMgaTeam}, RGA: ${agentRgaTeam})`);
          }
        }
        
        // If not found by associate_id, try by email or name in agent_hierarchy
        if (!agentMgaTeam && agentCompanyEmail) {
          const { data: hierarchyByEmail, error: hierarchyEmailError } = await supabase
            .from('agent_hierarchy')
            .select('agent_associate_id, agent_name, agent_email, mga_name, rga_name')
            .eq('agent_email', agentCompanyEmail.toLowerCase().trim())
            .single();
        console.log(`🔍 HIERARCHY BY EMAIL: error=${JSON.stringify(hierarchyEmailError)}, hasData=${!!hierarchyByEmail}}`);
          
          if (!hierarchyEmailError && hierarchyByEmail) {
            agentMgaTeam = hierarchyByEmail.mga_name;
            agentRgaTeam = hierarchyByEmail.rga_name;
            agentAssociateId = agentAssociateId || hierarchyByEmail.agent_associate_id;
            console.log(`🔍 Found agent by email "${agentCompanyEmail}": ${hierarchyByEmail.agent_name} (MGA: ${agentMgaTeam}, RGA: ${agentRgaTeam})`);
          }
        }
        
        // If still not found, try looking up by name (last resort)
        if (!agentMgaTeam && (session as any).agentFirstName && (session as any).agentLastName) {
          const agentFullName = `${(session as any).agentFirstName} ${(session as any).agentLastName}`;
          const { data: hierarchyByName, error: hierarchyNameError } = await supabase
            .from('agent_hierarchy')
            .select('agent_associate_id, agent_name, agent_email, mga_name, rga_name')
            .ilike('agent_name', agentFullName)
            .limit(1);
          
          if (!hierarchyNameError && hierarchyByName && hierarchyByName.length > 0) {
            agentMgaTeam = hierarchyByName[0].mga_name;
            agentRgaTeam = hierarchyByName[0].rga_name;
            agentAssociateId = agentAssociateId || hierarchyByName[0].agent_associate_id;
            agentCompanyEmail = agentCompanyEmail || hierarchyByName[0].agent_email;
            console.log(`🔍 Found agent by name "${agentFullName}": ${hierarchyByName[0].agent_name} (MGA: ${agentMgaTeam}, RGA: ${agentRgaTeam})`);
          }
        }
        
        // Log final result
        if (agentMgaTeam) {
          console.log(`✅ Using MGA team: ${agentMgaTeam}, RGA team: ${agentRgaTeam || 'null'}`);
        } else {
          console.log(`⚠️ No MGA team found in agent_hierarchy for agent (AssociateId: ${agentAssociateId}, Email: ${agentCompanyEmail})`);
        }
        
      } catch (error) {
        console.error('❌ Error looking up MGA team:', error);
      }
    } else if (agentMgaTeam) {
      console.log(`✅ Using MGA/RGA from provided session data: MGA=${agentMgaTeam}, RGA=${agentRgaTeam || 'null'}`);
    }

    // Create data for Supabase (using snake_case field names)
    // 🎭 DEMO MODE: Check if session has is_demo flag
    const isDemo = (session as any).is_demo === true || (session as any).is_demo === 'true';
    
  const supabaseData = {
      session_id: sessionId,
      first_name: session.firstName,
      last_name: session.lastName,
      spouse_name: session.spouseName,
      phone: session.phone,
      agent_phone: session.agentPhone,
      agent_first_name: session.agentFirstName,
      agent_last_name: session.agentLastName,
      associate_id: agentAssociateId, // Use looked up or provided associate_id
      company_email: agentCompanyEmail, // Use looked up or provided company_email
      agent_mga_team: agentMgaTeam,
      agent_rga_team: agentRgaTeam,
      city: session.city,
      state: session.state,
      premium: session.premium,
      ach_draw_date: session.achDrawDate,
      ach_draw_date_short: session.achDrawDateShort,
      verification_method: session.verificationMethod,
      zoom_room_id: session.zoomRoomId,
      zoom_password: session.zoomPassword,
      language: session.language || 'en',
      status: 'pending',
      created_at: new Date().toISOString(),
      screenshot_url: 'PENDING',  // CRITICAL FLAG: Tells scheduler to analyze this session
      recording_url: 'PENDING',     // CRITICAL FLAG: Tells scheduler to analyze this session
      is_demo: isDemo || false  // 🎭 DEMO MODE: Set is_demo flag
    };

    console.log('🔧 SUPABASE: Creating verification session:', sessionId);
    console.log('🔧 SUPABASE: Session data:', JSON.stringify(supabaseData, null, 2));

    try {
      // Save to Supabase FIRST
      if (supabaseClient) {
        const supabase = supabaseAdmin;
        const { data: supabaseSession, error } = await supabase
          .from('verification_sessions')
          .insert([supabaseData])
          .select()
          .single();
        console.log(`🔍 SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseSession}}`);

        if (error) {
          console.error('❌ SUPABASE: Error creating verification session:', error);
          throw new Error(`Supabase error: ${error.message}`);
        }

        console.log('✅ SUPABASE: Verification session created successfully:', sessionId);

        // Convert snake_case back to camelCase for return type
        const verificationSession: VerificationSession = {
          id: supabaseSession.id,
          sessionId: supabaseSession.session_id,
          firstName: supabaseSession.first_name,
          lastName: supabaseSession.last_name,
          spouseName: supabaseSession.spouse_name,
          phone: supabaseSession.phone,
          agentPhone: supabaseSession.agent_phone,
          agentFirstName: supabaseSession.agent_first_name,
          agentLastName: supabaseSession.agent_last_name,
          city: supabaseSession.city,
          state: supabaseSession.state,
          premium: supabaseSession.premium,
          achDrawDate: supabaseSession.ach_draw_date,
          achDrawDateShort: supabaseSession.ach_draw_date_short,
          verificationMethod: supabaseSession.verification_method,
          zoomRoomId: supabaseSession.zoom_room_id,
          zoomPassword: supabaseSession.zoom_password,
          language: supabaseSession.language,
          status: supabaseSession.status,
          createdAt: new Date(supabaseSession.created_at),
          // Optional fields
          smsVerificationCode: supabaseSession.sms_verification_code,
          screenshotPath: supabaseSession.screenshot_path,
          clientApprovalTimestamp: supabaseSession.client_approval_timestamp ? new Date(supabaseSession.client_approval_timestamp) : null,
          completedAt: supabaseSession.completed_at ? new Date(supabaseSession.completed_at) : null,
          // Add missing Taalk fields that were causing the call status issues
          taalkCallId: supabaseSession.taalk_call_id,
          taalkCallStatus: supabaseSession.taalk_call_status,
          taalkCallInitiatedAt: supabaseSession.taalk_call_initiated_at,
          taalkCallCompletedAt: supabaseSession.taalk_call_completed_at,
          callCompleted: supabaseSession.call_completed || false,
          verificationResult: supabaseSession.verification_result,
          agentMgaTeam: supabaseSession.agent_mga_team,
          agentRgaTeam: supabaseSession.agent_rga_team,
          associateId: supabaseSession.associate_id,
          companyEmail: supabaseSession.company_email,
        };

        return verificationSession;
      } else {
        console.error('❌ SUPABASE: Client not available - falling back to local database');
        // Fallback to local database with original field names
        const dbData = {
          sessionId,
          firstName: session.firstName,
          lastName: session.lastName,
          spouseName: session.spouseName,
          phone: session.phone,
          agentPhone: session.agentPhone,
          agentFirstName: session.agentFirstName,
          agentLastName: session.agentLastName,
          city: session.city,
          state: session.state,
          premium: session.premium,
          achDrawDate: session.achDrawDate,
          achDrawDateShort: session.achDrawDateShort,
          verificationMethod: session.verificationMethod,
          zoomRoomId: session.zoomRoomId,
          zoomPassword: session.zoomPassword,
          language: session.language || 'en',
          status: 'pending'
        };

        const [verificationSession] = await db
          .insert(verificationSessions)
          .values(dbData)
          .returning();
        return verificationSession;
      }
    } catch (error) {
      console.error('❌ Error creating verification session:', error);
      throw error;
    }
  }

  async getVerificationSession(sessionId: string): Promise<VerificationSession | undefined> {
    console.log(`🔍 SUPABASE GET SESSION: Attempting to fetch ${sessionId}, client available: ${!!supabaseClient}`);
    // Try Supabase first, then fall back to local database
    if (supabaseClient) {
      try {
        console.log(`🔍 SUPABASE GET SESSION: Querying verification_sessions table`);
        const { data: supabaseSession, error } = await supabaseClient
          .from('verification_sessions')
          .select('*')
          .eq('session_id', sessionId)
          .single();
        console.log(`🔍 SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseSession}}`);

        if (error) {
          if (error.code !== 'PGRST116') {
            console.error('❌ SUPABASE: Error fetching session:', error);
          }
        } else if (supabaseSession) {

          // Convert snake_case back to camelCase for return type
          const verificationSession: VerificationSession = {
            id: supabaseSession.id,
            sessionId: supabaseSession.session_id,
            firstName: supabaseSession.first_name,
            lastName: supabaseSession.last_name,
            spouseName: supabaseSession.spouse_name,
            phone: supabaseSession.phone,
            agentPhone: supabaseSession.agent_phone,
            agentFirstName: supabaseSession.agent_first_name,
            agentLastName: supabaseSession.agent_last_name,
            city: supabaseSession.city,
            state: supabaseSession.state,
            premium: supabaseSession.premium,
            achDrawDate: supabaseSession.ach_draw_date,
            achDrawDateShort: supabaseSession.ach_draw_date_short,
            verificationMethod: supabaseSession.verification_method,
            zoomRoomId: supabaseSession.zoom_room_id,
            zoomPassword: supabaseSession.zoom_password,
            language: supabaseSession.language,
            status: supabaseSession.status,
            createdAt: new Date(supabaseSession.created_at),
            updatedAt: supabaseSession.updated_at ? new Date(supabaseSession.updated_at) : new Date(supabaseSession.created_at),
            // Optional fields
            smsVerificationCode: supabaseSession.sms_verification_code,
            screenshotPath: supabaseSession.screenshot_path,
            clientApprovalTimestamp: supabaseSession.client_approval_timestamp ? new Date(supabaseSession.client_approval_timestamp) : null,
            clientApprovalStatus: supabaseSession.client_approval_status,
            completedAt: supabaseSession.completed_at ? new Date(supabaseSession.completed_at) : null,
            // CRITICAL FIX: Add missing Taalk call fields that were causing the bug!
            taalkCallId: supabaseSession.taalk_call_id,
            taalkCallStatus: supabaseSession.taalk_call_status,
            taalkCallInitiatedAt: supabaseSession.taalk_call_initiated_at,
            taalkCallCompletedAt: supabaseSession.taalk_call_completed_at,
            callCompleted: supabaseSession.call_completed || false,
            verificationResult: supabaseSession.verification_result
          };

          return verificationSession;
        }
      } catch (error) {
        console.error('❌ SUPABASE: Error getting verification session:', error);
      }
    } else {
      console.log('⚠️ SUPABASE: Client not available, using local database');
    }

    // Fall back to local database
    console.log('🔍 LOCAL: Checking local database for session:', sessionId);
    const [session] = await db
      .select()
      .from(verificationSessions)
      .where(eq(verificationSessions.sessionId, sessionId));
    return session || undefined;
  }

  async getVerificationSessionByCode(verificationCode: string): Promise<VerificationSession | undefined> {
    const [session] = await db
      .select()
      .from(verificationSessions)
      .where(eq(verificationSessions.smsVerificationCode, verificationCode));
    return session || undefined;
  }

  async updateVerificationSession(sessionId: string, updates: Partial<VerificationSession>): Promise<VerificationSession | undefined> {
    // First try to update in Supabase since that's where verification sessions are primarily stored
    if (supabaseClient) {
      try {
        console.log(`🔄 SUPABASE: Updating verification session ${sessionId} with:`, updates);

        // Map the local field names to Supabase field names
        const supabaseUpdates: any = {};
        if ((updates as any).smsVerificationSent !== undefined) supabaseUpdates.sms_verification_sent = (updates as any).smsVerificationSent;
        if (updates.agentSmsStatus !== undefined) supabaseUpdates.agent_sms_status = updates.agentSmsStatus;
        if (updates.clientSmsStatus !== undefined) supabaseUpdates.client_sms_status = updates.clientSmsStatus;
        if (updates.clientApprovalStatus !== undefined) supabaseUpdates.client_approval_status = updates.clientApprovalStatus;
        if (updates.clientApprovalTime !== undefined) supabaseUpdates.client_approval_time = updates.clientApprovalTime.toISOString();
        if (updates.status !== undefined) supabaseUpdates.status = updates.status;
        if (updates.screenshotPath !== undefined) {
          supabaseUpdates.screenshot_path = updates.screenshotPath;
          supabaseUpdates.screenshot_url = updates.screenshotPath;
        }
        // CRITICAL: Add missing Taalk call field mappings
        if (updates.taalkCallId !== undefined) supabaseUpdates.taalk_call_id = updates.taalkCallId;
        if (updates.taalkCallStatus !== undefined) supabaseUpdates.taalk_call_status = updates.taalkCallStatus;
        if (updates.taalkCallInitiatedAt !== undefined) supabaseUpdates.taalk_call_initiated_at = updates.taalkCallInitiatedAt;
        if (updates.taalkCallCompletedAt !== undefined) supabaseUpdates.taalk_call_completed_at = updates.taalkCallCompletedAt;
        if (updates.taalkCallDuration !== undefined) supabaseUpdates.taalk_call_duration = updates.taalkCallDuration;
        if (updates.taalkCallData !== undefined) supabaseUpdates.taalk_call_data = updates.taalkCallData;
        if (updates.taalkCallUrl !== undefined) supabaseUpdates.taalk_call_url = updates.taalkCallUrl;
        if (updates.recordingUrl !== undefined) supabaseUpdates.recording_url = updates.recordingUrl;  // Frontend uses this!
        
        // Client IP and location fields
        if (updates.clientIpAddress !== undefined) supabaseUpdates.client_ip_address = updates.clientIpAddress;
        if (updates.clientUserAgent !== undefined) supabaseUpdates.client_user_agent = updates.clientUserAgent;
        if (updates.clientCountry !== undefined) supabaseUpdates.client_country = updates.clientCountry;
        if (updates.clientRegion !== undefined) supabaseUpdates.client_region = updates.clientRegion;
        if (updates.clientCity !== undefined) supabaseUpdates.client_city = updates.clientCity;
        if (updates.clientLatitude !== undefined) supabaseUpdates.client_latitude = updates.clientLatitude;
        if (updates.clientLongitude !== undefined) supabaseUpdates.client_longitude = updates.clientLongitude;
        if (updates.clientTimezone !== undefined) supabaseUpdates.client_timezone = updates.clientTimezone;
        if (updates.clientIsp !== undefined) supabaseUpdates.client_isp = updates.clientIsp;
        // Client VPN detection fields
        if (updates.clientIsVpn !== undefined) supabaseUpdates.client_is_vpn = updates.clientIsVpn;
        if (updates.clientIsProxy !== undefined) supabaseUpdates.client_is_proxy = updates.clientIsProxy;
        if (updates.clientIsHosting !== undefined) supabaseUpdates.client_is_hosting = updates.clientIsHosting;
        if (updates.clientVpnDetectionReason !== undefined) supabaseUpdates.client_vpn_detection_reason = updates.clientVpnDetectionReason;
        
        // Agent IP and location fields
        if (updates.agentIpAddress !== undefined) supabaseUpdates.agent_ip_address = updates.agentIpAddress;
        if (updates.agentUserAgent !== undefined) supabaseUpdates.agent_user_agent = updates.agentUserAgent;
        if (updates.agentCountry !== undefined) supabaseUpdates.agent_country = updates.agentCountry;
        if (updates.agentRegion !== undefined) supabaseUpdates.agent_region = updates.agentRegion;
        if (updates.agentCity !== undefined) supabaseUpdates.agent_city = updates.agentCity;
        if (updates.agentLatitude !== undefined) supabaseUpdates.agent_latitude = updates.agentLatitude;
        if (updates.agentLongitude !== undefined) supabaseUpdates.agent_longitude = updates.agentLongitude;
        if (updates.agentTimezone !== undefined) supabaseUpdates.agent_timezone = updates.agentTimezone;
        if (updates.agentIsp !== undefined) supabaseUpdates.agent_isp = updates.agentIsp;
        // Agent VPN detection fields
        if (updates.agentIsVpn !== undefined) supabaseUpdates.agent_is_vpn = updates.agentIsVpn;
        if (updates.agentIsProxy !== undefined) supabaseUpdates.agent_is_proxy = updates.agentIsProxy;
        if (updates.agentIsHosting !== undefined) supabaseUpdates.agent_is_hosting = updates.agentIsHosting;
        if (updates.agentVpnDetectionReason !== undefined) supabaseUpdates.agent_vpn_detection_reason = updates.agentVpnDetectionReason;
        
        // IP Analysis fields
        if (updates.ipAnalysis !== undefined) supabaseUpdates.ip_analysis = updates.ipAnalysis;
        if (updates.ipFlagStatus !== undefined) supabaseUpdates.ip_flag_status = updates.ipFlagStatus;
        if (updates.ipFlagReason !== undefined) supabaseUpdates.ip_flag_reason = updates.ipFlagReason;
        if ((updates as any).ipAnalysisSummary !== undefined) supabaseUpdates.ip_analysis_summary = (updates as any).ipAnalysisSummary;

        const { data, error } = await supabaseClient
          .from('verification_sessions')
          .update(supabaseUpdates)
          .eq('session_id', sessionId)
          .select()
          .single();
        console.log(`🔍 SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!data}}`);

        if (error) {
          console.error('❌ SUPABASE: Error updating verification session:', error);
        } else {
          console.log('✅ SUPABASE: Verification session updated successfully');
          return data as any; // Return the updated session
        }
      } catch (error) {
        console.error('❌ SUPABASE: Exception updating verification session:', error);
      }
    }

    // Fallback to local database - map camelCase to snake_case for Drizzle
    try {
      console.log(`🔄 LOCAL: Updating verification session ${sessionId} with:`, updates);

      // Map camelCase updates to snake_case for the local database
      const dbUpdates: any = {};
      if ((updates as any).smsVerificationSent !== undefined) dbUpdates.smsVerificationSent = (updates as any).smsVerificationSent;
      if (updates.agentSmsStatus !== undefined) dbUpdates.agentSmsStatus = updates.agentSmsStatus;
      if (updates.clientSmsStatus !== undefined) dbUpdates.clientSmsStatus = updates.clientSmsStatus;
      if (updates.clientApprovalStatus !== undefined) dbUpdates.clientApprovalStatus = updates.clientApprovalStatus;
      if (updates.clientApprovalTime !== undefined) dbUpdates.clientApprovalTime = updates.clientApprovalTime;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.screenshotPath !== undefined) dbUpdates.screenshotPath = updates.screenshotPath;
      // CRITICAL: Add missing Taalk call field mappings for local database
      if (updates.taalkCallId !== undefined) dbUpdates.taalkCallId = updates.taalkCallId;
      if (updates.taalkCallStatus !== undefined) dbUpdates.taalkCallStatus = updates.taalkCallStatus;
      if (updates.taalkCallInitiatedAt !== undefined) dbUpdates.taalkCallInitiatedAt = updates.taalkCallInitiatedAt;
      
      // Client IP and location fields (for local database fallback)
      if (updates.clientIpAddress !== undefined) dbUpdates.clientIpAddress = updates.clientIpAddress;
      if (updates.clientUserAgent !== undefined) dbUpdates.clientUserAgent = updates.clientUserAgent;
      if (updates.clientCountry !== undefined) dbUpdates.clientCountry = updates.clientCountry;
      if (updates.clientRegion !== undefined) dbUpdates.clientRegion = updates.clientRegion;
      if (updates.clientCity !== undefined) dbUpdates.clientCity = updates.clientCity;
      if (updates.clientLatitude !== undefined) dbUpdates.clientLatitude = updates.clientLatitude;
      if (updates.clientLongitude !== undefined) dbUpdates.clientLongitude = updates.clientLongitude;
      if (updates.clientTimezone !== undefined) dbUpdates.clientTimezone = updates.clientTimezone;
      if (updates.clientIsp !== undefined) dbUpdates.clientIsp = updates.clientIsp;
      // Client VPN detection fields (for local database fallback)
      if (updates.clientIsVpn !== undefined) dbUpdates.clientIsVpn = updates.clientIsVpn;
      if (updates.clientIsProxy !== undefined) dbUpdates.clientIsProxy = updates.clientIsProxy;
      if (updates.clientIsHosting !== undefined) dbUpdates.clientIsHosting = updates.clientIsHosting;
      if (updates.clientVpnDetectionReason !== undefined) dbUpdates.clientVpnDetectionReason = updates.clientVpnDetectionReason;
      
      // Agent IP and location fields (for local database fallback)
      if (updates.agentIpAddress !== undefined) dbUpdates.agentIpAddress = updates.agentIpAddress;
      if (updates.agentUserAgent !== undefined) dbUpdates.agentUserAgent = updates.agentUserAgent;
      if (updates.agentCountry !== undefined) dbUpdates.agentCountry = updates.agentCountry;
      if (updates.agentRegion !== undefined) dbUpdates.agentRegion = updates.agentRegion;
      if (updates.agentCity !== undefined) dbUpdates.agentCity = updates.agentCity;
      if (updates.agentLatitude !== undefined) dbUpdates.agentLatitude = updates.agentLatitude;
      if (updates.agentLongitude !== undefined) dbUpdates.agentLongitude = updates.agentLongitude;
      if (updates.agentTimezone !== undefined) dbUpdates.agentTimezone = updates.agentTimezone;
      if (updates.agentIsp !== undefined) dbUpdates.agentIsp = updates.agentIsp;
      // Agent VPN detection fields (for local database fallback)
      if (updates.agentIsVpn !== undefined) dbUpdates.agentIsVpn = updates.agentIsVpn;
      if (updates.agentIsProxy !== undefined) dbUpdates.agentIsProxy = updates.agentIsProxy;
      if (updates.agentIsHosting !== undefined) dbUpdates.agentIsHosting = updates.agentIsHosting;
      if (updates.agentVpnDetectionReason !== undefined) dbUpdates.agentVpnDetectionReason = updates.agentVpnDetectionReason;
      
      // IP Analysis fields (for local database fallback)
      if (updates.ipAnalysis !== undefined) dbUpdates.ipAnalysis = updates.ipAnalysis;
      if (updates.ipFlagStatus !== undefined) dbUpdates.ipFlagStatus = updates.ipFlagStatus;
      if (updates.ipFlagReason !== undefined) dbUpdates.ipFlagReason = updates.ipFlagReason;
      if ((updates as any).ipAnalysisSummary !== undefined) dbUpdates.ipAnalysisSummary = (updates as any).ipAnalysisSummary;

      console.log(`🔄 LOCAL: Final dbUpdates keys: ${Object.keys(dbUpdates)}`);

      // Guard against empty updates to prevent SQL syntax error
      if (Object.keys(dbUpdates).length === 0) {
        console.log('⚠️ LOCAL: No valid updates provided, skipping database update');
        return await this.getVerificationSession(sessionId); // Return existing session
      }

      const [updatedSession] = await db
        .update(verificationSessions)
        .set(dbUpdates)
        .where(eq(verificationSessions.sessionId, sessionId))
        .returning();
      return updatedSession || undefined;
    } catch (error) {
      console.error('❌ LOCAL: Error updating verification session:', error);
      throw error;
    }
  }

  async completeVerificationSession(sessionId: string): Promise<VerificationSession | undefined> {
    const [completedSession] = await db
      .update(verificationSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(verificationSessions.sessionId, sessionId))
      .returning();
    return completedSession || undefined;
  }

  // Appointment methods
  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db
      .insert(appointments)
      .values(appointment)
      .returning();
    return newAppointment;
  }

  async getAppointments(agentId: string): Promise<Appointment[]> {
    const appointmentsList = await db
      .select()
      .from(appointments)
      .where(eq(appointments.agentId, agentId))
      .orderBy(appointments.date, appointments.time);
    return appointmentsList;
  }

  async getAppointmentsByDate(agentId: string, date: string): Promise<Appointment[]> {
    const appointmentsList = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.agentId, agentId),
        eq(appointments.date, date)
      ))
      .orderBy(appointments.time);
    return appointmentsList;
  }

  async updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment || undefined;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db
      .delete(appointments)
      .where(eq(appointments.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Incoming leads operations (CSV webhook)
  async createIncomingLead(lead: InsertIncomingLead): Promise<IncomingLead> {
    const [newLead] = await db.insert(incomingLeads).values(lead).returning();
    return newLead;
  }

  async getIncomingLeads(status?: string): Promise<IncomingLead[]> {
    if (status) {
      return await db.select().from(incomingLeads).where(eq(incomingLeads.status, status));
    }
    return await db.select().from(incomingLeads);
  }

  async updateIncomingLeadStatus(id: number, status: string, assignedAgent?: string): Promise<IncomingLead | undefined> {
    const updates: Partial<IncomingLead> = { status };
    if (assignedAgent) {
      updates.assignedAgent = assignedAgent;
    }
    if (status === 'processed') {
      updates.processedAt = new Date();
    }

    const [updatedLead] = await db
      .update(incomingLeads)
      .set(updates)
      .where(eq(incomingLeads.id, id))
      .returning();

    return updatedLead;
  }

  // Supabase-linked agent profile methods
  async getAgentProfileBySupabaseId(supabaseUserId: string): Promise<AgentProfile | null> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.supabaseUserId, supabaseUserId));
    return profile || null;
  }

  async createAgentProfileWithSupabaseId(profileData: InsertAgentProfile & { supabaseUserId: string }): Promise<AgentProfile> {
    console.log('🔥 SUPABASE: Creating agent profile with Supabase ID:', profileData.supabaseUserId);
    
    // First check if profile already exists
    const existingProfile = await this.getAgentProfileBySupabaseId(profileData.supabaseUserId);
    if (existingProfile) {
      console.log('✅ SUPABASE: Profile already exists, updating instead');
      // Update existing profile
      return await this.updateAgentProfileBySupabaseId(profileData.supabaseUserId, profileData) || existingProfile;
    }

    // 🔥 CRITICAL: Sync MGA/RGA with mga_rga_directory BEFORE creating
    if (profileData.mgaTeam || profileData.rgaTeam) {
      await this.ensureMgaRgaInDirectory(profileData.mgaTeam, profileData.rgaTeam);
    }

    // 🔥 CRITICAL: Create in Supabase FIRST (this is what getAgentProfileByEmail reads from!)
    if (supabaseClient) {
      try {
        const supabase = supabaseAdmin;
        console.log('🔍 SUPABASE: Creating in Supabase database');
        console.log('🔍 SUPABASE: Insert data:', {
          supabase_user_id: profileData.supabaseUserId,
          email: profileData.email,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone,
          zoom_id: profileData.zoomId,
          zoom_password: profileData.zoomPassword,
          mga_team: profileData.mgaTeam || '',
          rga_team: profileData.rgaTeam || '',
        });
        
        // CRITICAL: Normalize email to lowercase for consistency (getAgentProfileByEmail uses .toLowerCase().trim())
        const normalizedEmail = profileData.email?.toLowerCase().trim() || '';
        
        const { data: supabaseProfile, error } = await supabase
          .from('agent_profiles')
          .insert({
            supabase_user_id: profileData.supabaseUserId,
            email: normalizedEmail, // Use normalized email
            first_name: profileData.firstName,
            last_name: profileData.lastName,
            phone: profileData.phone || '+1-555-0000',
            zoom_id: profileData.zoomId || '',
            zoom_password: profileData.zoomPassword || '1',
            mga_team: profileData.mgaTeam || '',
            rga_team: profileData.rgaTeam || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        console.log(`🔍 SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseProfile}`);

        if (!error && supabaseProfile) {
          console.log('✅ SUPABASE: Profile created successfully in Supabase');
          // Return Supabase data
          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || '',
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || '',
            rgaTeam: supabaseProfile.rga_team || '',
            createdAt: new Date(supabaseProfile.created_at || new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || new Date()),
          } as AgentProfile;
        } else {
          console.error('❌ SUPABASE: Error creating profile in Supabase:', error);
          // CRITICAL: Don't fall back to local DB - throw error so caller knows it failed
          // Local DB profiles won't be found by getAgentProfileByEmail which only reads Supabase
          throw new Error(`Failed to create profile in Supabase: ${error?.message || 'Unknown error'}`);
        }
      } catch (supabaseError) {
        console.error('❌ SUPABASE: Error creating in Supabase:', supabaseError);
        // CRITICAL: Don't fall back to local DB - throw error so caller knows it failed
        throw new Error(`Failed to create profile in Supabase: ${supabaseError instanceof Error ? supabaseError.message : 'Unknown error'}`);
      }
    }

    // If Supabase client not available, throw error - don't create in local DB
    throw new Error('Supabase client not available - cannot create agent profile');
  }

  async getAgentProfileByEmail(email: string): Promise<AgentProfile | null> {
    if (!email) {
      console.log('❌ SUPABASE: No email provided to getAgentProfileByEmail');
      return null;
    }
    
    // Normalize for logging / display; lookup must be case-insensitive because legacy rows
    // may store mixed-case email — .eq would miss them and break /api/agent/profile-direct + diagnostics.
    const normalizedEmail = email.trim().toLowerCase();
    console.log('🔍 SUPABASE: Getting agent profile for email:', email, '→ normalized:', normalizedEmail);

    // Use Supabase ONLY - no local caching
    try {
      if (!supabaseAdmin) {
        console.log('⚠️ SUPABASE: Supabase admin client not available');
        return null;
      }
      
      const { data: supabaseProfile, error } = await supabaseAdmin
        .from('agent_profiles')
        .select('*')
        .ilike('email', normalizedEmail)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log(`🔍 SUPABASE RESPONSE: error=${error?.message || 'none'}, hasData=${!!supabaseProfile}, emailInDB=${supabaseProfile?.email || 'N/A'}`);

      if (!error && supabaseProfile) {
        console.log('✅ SUPABASE: Found agent profile in Supabase:', {
          id: supabaseProfile.id,
          email: supabaseProfile.email,
          firstName: supabaseProfile.first_name,
          lastName: supabaseProfile.last_name
        });
        // Return Supabase data directly - no local caching
        return {
          id: supabaseProfile.id,
          email: supabaseProfile.email,
          firstName: supabaseProfile.first_name,
          lastName: supabaseProfile.last_name,
          phone: supabaseProfile.phone || '',
          zoomId: supabaseProfile.zoom_id,
          zoomPassword: supabaseProfile.zoom_password,
          profilePicture: supabaseProfile.profile_picture || '',
          supabaseUserId: supabaseProfile.supabase_user_id,
          mgaTeam: supabaseProfile.mga_team || '',
          rgaTeam: supabaseProfile.rga_team || '',
          createdAt: new Date(supabaseProfile.created_at || new Date()),
          updatedAt: new Date(supabaseProfile.updated_at || new Date()),
        } as AgentProfile;
      } else {
        console.log('❌ SUPABASE: No profile found in Supabase for:', normalizedEmail, 'error:', error);
      }
    } catch (supabaseError) {
      console.error('❌ SUPABASE: Exception checking for agent profile:', supabaseError);
      console.error('Stack:', supabaseError instanceof Error ? supabaseError.stack : 'No stack');
    }

    return null;
  }

  async countAgentProfilesForEmail(email: string): Promise<number> {
    if (!email?.trim() || !supabaseAdmin) return 0;
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { count, error } = await supabaseAdmin
        .from('agent_profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('email', normalizedEmail);
      if (error) {
        console.warn('⚠️ countAgentProfilesForEmail:', error.message);
        return 0;
      }
      return typeof count === 'number' ? count : 0;
    } catch (e) {
      console.warn('⚠️ countAgentProfilesForEmail exception:', e);
      return 0;
    }
  }

  async updateAgentProfileByEmail(email: string, updates: Partial<InsertAgentProfile>): Promise<AgentProfile | null> {
    console.log('🔄 SUPABASE: Updating agent profile by email:', email);

    // 🔥 CRITICAL: Sync MGA/RGA with mga_rga_directory BEFORE saving
    if (updates.mgaTeam || updates.rgaTeam) {
      await this.ensureMgaRgaInDirectory(updates.mgaTeam, updates.rgaTeam);
    }

    // Update Supabase ONLY - no local caching
    try {
      if (supabaseClient) {
        const supabase = supabaseAdmin;
        console.log('🔍 SUPABASE: Updating in Supabase database');
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };
        
        // Only include fields that are actually provided (not undefined)
        if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
        if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.zoomId !== undefined) updateData.zoom_id = updates.zoomId;
        if (updates.zoomPassword !== undefined) updateData.zoom_password = updates.zoomPassword;
        if (updates.mgaTeam !== undefined) updateData.mga_team = updates.mgaTeam;
        if (updates.rgaTeam !== undefined) updateData.rga_team = updates.rgaTeam;
        if (updates.profilePicture !== undefined) updateData.profile_picture = updates.profilePicture;

        console.log('🔍 SUPABASE: Update data:', updateData);
        const normalizedEmail = email.toLowerCase().trim();

        const { data: targetRows, error: pickErr } = await supabase
          .from('agent_profiles')
          .select('id')
          .ilike('email', normalizedEmail)
          .order('updated_at', { ascending: false })
          .limit(2);

        if (pickErr) {
          console.warn('⚠️ SUPABASE: Could not resolve profile row id:', pickErr);
        }

        const targetId = targetRows?.[0]?.id;
        if (!targetId) {
          console.log('🔍 SUPABASE: Profile not found by email, creating new one');
          return await this.createAgentProfileWithEmail({ email, ...updates });
        }

        if ((targetRows?.length ?? 0) > 1) {
          console.warn(
            `⚠️ SUPABASE: multiple agent_profiles rows match ${normalizedEmail} — updating newest only (id=${targetId})`,
          );
        }

        const { data: supabaseProfile, error } = await supabase
          .from('agent_profiles')
          .update(updateData)
          .eq('id', targetId)
          .select()
          .single();
        console.log(`🔍 SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseProfile}`);

        console.log('🔍 SUPABASE: Update result - data:', supabaseProfile, 'error:', error);

        if (!error && supabaseProfile) {
          console.log('✅ SUPABASE: Updated successfully in Supabase');

          await this.syncAgentHierarchyFromProfile(supabaseProfile.email, {
            first_name: supabaseProfile.first_name,
            last_name: supabaseProfile.last_name,
            mga_team: supabaseProfile.mga_team,
            rga_team: supabaseProfile.rga_team,
          });

          // Return updated Supabase data directly
          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || '',
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            profilePicture: supabaseProfile.profile_picture || '',
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || '',
            rgaTeam: supabaseProfile.rga_team || '',
            createdAt: new Date(supabaseProfile.created_at || new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || new Date()),
          } as AgentProfile;
        } else if (error?.code === 'PGRST116') {
          // Row not found, create new one
          console.log('🔍 SUPABASE: Profile not found, creating new one');
          return await this.createAgentProfileWithEmail({ email, ...updates });
        } else {
          console.warn('⚠️ SUPABASE: Error updating in Supabase:', error);
        }
      } else {
        console.warn('⚠️ SUPABASE: supabaseClient is null - cannot save to Supabase!');
      }
    } catch (supabaseError) {
      console.warn('⚠️ SUPABASE: Error updating Supabase:', supabaseError);
    }

    return null;
  }

  async createAgentProfileWithEmail(profileData: InsertAgentProfile & { email: string }): Promise<AgentProfile> {
    console.log('🔥 SUPABASE: Creating agent profile for email:', profileData.email);

    // 🔥 CRITICAL: Sync MGA/RGA with mga_rga_directory BEFORE creating
    if (profileData.mgaTeam || profileData.rgaTeam) {
      await this.ensureMgaRgaInDirectory(profileData.mgaTeam, profileData.rgaTeam);
    }

    // Create in Supabase ONLY - no local caching
    try {
      if (supabaseClient) {
        const supabase = supabaseAdmin;
        console.log('🔍 SUPABASE: Creating in Supabase database');
        console.log('🔍 SUPABASE: Insert data:', {
          email: profileData.email,
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone,
          zoom_id: profileData.zoomId,
          zoom_password: profileData.zoomPassword,
          supabase_user_id: profileData.email,
        });
        const { data: supabaseProfile, error } = await supabase
          .from('agent_profiles')
          .insert({
            email: profileData.email,
            first_name: profileData.firstName,
            last_name: profileData.lastName,
            phone: profileData.phone,
            zoom_id: profileData.zoomId,
            zoom_password: profileData.zoomPassword,
            supabase_user_id: profileData.email, // Use email as user ID since we don't have proper auth
            mga_team: profileData.mgaTeam || '',
            rga_team: profileData.rgaTeam || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        console.log(`🔍 SUPABASE RESPONSE: error=${JSON.stringify(error)}, hasData=${!!supabaseProfile}`);

        console.log('🔍 SUPABASE: Insert result - data:', supabaseProfile, 'error:', error);

        if (!error && supabaseProfile) {
          console.log('✅ SUPABASE: Created successfully in Supabase');

          await this.syncAgentHierarchyFromProfile(supabaseProfile.email, {
            first_name: supabaseProfile.first_name,
            last_name: supabaseProfile.last_name,
            mga_team: supabaseProfile.mga_team,
            rga_team: supabaseProfile.rga_team,
          });

          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || '',
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            profilePicture: supabaseProfile.profile_picture || '',
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || '',
            rgaTeam: supabaseProfile.rga_team || '',
            createdAt: new Date(supabaseProfile.created_at || new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || new Date()),
          } as AgentProfile;
        } else {
          console.warn('⚠️ SUPABASE: Error creating in Supabase:', error);
          throw new Error(`Failed to create agent profile: ${error?.message}`);
        }
      } else {
        throw new Error('Supabase client not available');
      }
    } catch (supabaseError) {
      console.warn('⚠️ SUPABASE: Error creating in Supabase:', supabaseError);
      throw supabaseError;
    }
  }

  async getAllAgentProfiles(): Promise<AgentProfile[]> {
    const profiles = await db
      .select()
      .from(agentProfiles);
    return profiles;
  }

  async syncAllProfilesToHierarchy(): Promise<void> {
    if (!supabaseAdmin) {
      console.warn('⚠️ Supabase admin client unavailable - skipping agent hierarchy sync');
      return;
    }

    try {
      console.log('🔄 Syncing agent_hierarchy with agent_profiles...');
      const { data: profiles, error } = await supabaseAdmin
        .from('agent_profiles')
        .select('email, first_name, last_name, mga_team, rga_team')
        .limit(5000);

      if (error) {
        console.error('❌ Failed to fetch agent profiles for hierarchy sync:', error);
        return;
      }

      if (!profiles || profiles.length === 0) {
        console.log('ℹ️ No agent profiles found to sync');
        return;
      }

      let syncedCount = 0;
      for (const profile of profiles) {
        if (!profile?.email) {
          continue;
        }
        await this.syncAgentHierarchyFromProfile(profile.email, {
          first_name: profile.first_name,
          last_name: profile.last_name,
          mga_team: profile.mga_team,
          rga_team: profile.rga_team,
        });
        syncedCount += 1;
      }

      console.log(`✅ Agent hierarchy sync complete — processed ${syncedCount} profiles`);
    } catch (error) {
      console.error('❌ Agent hierarchy sync failed:', error);
    }
  }

  async syncProducerListToHierarchy(): Promise<void> {
    if (!supabaseAdmin) {
      console.warn('⚠️ Supabase admin client unavailable - skipping producerlist sync');
      return;
    }

    try {
      console.log('🔄 Syncing agent_hierarchy with producerlist...');
      
      // Get all agents from producerlist
      const { data: producers, error: producersError } = await supabaseAdmin
        .from('producerlist')
        .select('associate_id, agent_name, company_email, mga, rga, aoi_market, ao_market_2, designated_market')
        .not('company_email', 'is', null)
        .not('company_email', 'eq', '')
        .limit(10000);

      if (producersError) {
        console.error('❌ Failed to fetch producerlist for hierarchy sync:', producersError);
        return;
      }

      if (!producers || producers.length === 0) {
        console.log('ℹ️ No producers found to sync');
        return;
      }

      console.log(`📊 Found ${producers.length} agents in producerlist`);

      // Get MGA/RGA directory for associate_id lookup
      const { data: directory, error: dirError } = await supabaseAdmin
        .from('mga_rga_directory')
        .select('name, associate_id');

      const mgaLookup = new Map<string, number>();
      const rgaLookup = new Map<string, number>();

      if (directory) {
        directory.forEach(d => {
          const nameUpper = d.name?.toUpperCase().trim();
          if (nameUpper && d.associate_id) {
            mgaLookup.set(nameUpper, d.associate_id);
            rgaLookup.set(nameUpper, d.associate_id);
          }
        });
      }

      console.log(`📋 Loaded ${mgaLookup.size} MGA/RGA entries from directory`);

      let syncedCount = 0;
      let errorCount = 0;

      for (const producer of producers) {
        try {
          if (!producer.company_email || !producer.associate_id) {
            continue;
          }

          const mgaName = producer.mga && producer.mga !== '0' ? producer.mga.toUpperCase().trim() : null;
          const rgaName = producer.rga && producer.rga !== '0' ? producer.rga.toUpperCase().trim() : null;

          const mgaAssociateId = mgaName ? (mgaLookup.get(mgaName) || null) : null;
          const rgaAssociateId = rgaName ? (rgaLookup.get(rgaName) || null) : null;

          const payload: Record<string, any> = {
            agent_associate_id: producer.associate_id,
            agent_name: producer.agent_name || null,
            agent_email: producer.company_email.toLowerCase().trim(),
            mga_name: mgaName,
            mga_associate_id: mgaAssociateId,
            rga_name: rgaName,
            rga_associate_id: rgaAssociateId,
            aoi_market: producer.aoi_market || null,
            ao_market_2: producer.ao_market_2 || null,
            designated_market: producer.designated_market || null,
            updated_at: new Date().toISOString(),
          };

          // Upsert by agent_associate_id
          const { error: upsertError } = await supabaseAdmin
            .from('agent_hierarchy')
            .upsert(payload, { onConflict: 'agent_associate_id' });

          if (upsertError) {
            console.error(`❌ Error syncing ${producer.agent_name}:`, upsertError);
            errorCount++;
          } else {
            syncedCount++;
            if (syncedCount % 100 === 0) {
              console.log(`   Synced ${syncedCount}/${producers.length} agents...`);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to sync producer ${producer.agent_name}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Producerlist sync complete — synced ${syncedCount} agents, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Producerlist hierarchy sync failed:', error);
    }
  }

  private async syncAgentHierarchyFromProfile(
    email: string,
    profile: { first_name?: string | null; last_name?: string | null; mga_team?: string | null; rga_team?: string | null }
  ): Promise<void> {
    if (!supabaseAdmin) {
      return;
    }

    const normalizedEmail = email?.toLowerCase()?.trim();
    if (!normalizedEmail) {
      return;
    }

    try {
      const { data: existingByEmail, error: existingError } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('id, agent_associate_id, agent_name, mga_name, rga_name, mga_associate_id, rga_associate_id')
        .eq('agent_email', normalizedEmail)
        .maybeSingle();

      if (existingError) {
        console.warn('⚠️ Unable to fetch existing agent hierarchy row:', existingError);
      }

      const identity = await this.resolveAgentIdentity(normalizedEmail, existingByEmail?.agent_associate_id, existingByEmail?.agent_name);
      const agentAssociateId = identity.associateId;

      if (!agentAssociateId) {
        console.warn(`⚠️ Skipping hierarchy sync — missing associate ID for ${normalizedEmail}`);
        return;
      }

      const agentName = identity.agentName ||
        this.combineName(profile.first_name, profile.last_name) ||
        normalizedEmail.split('@')[0];

      const mgaName = this.normalizeTeamName(profile.mga_team);
      const rgaName = this.normalizeTeamName(profile.rga_team);

      const [mgaAssociateId, rgaAssociateId] = await Promise.all([
        this.lookupTeamAssociateId(mgaName),
        this.lookupTeamAssociateId(rgaName),
      ]);

      const payload: Record<string, any> = {
        agent_associate_id: agentAssociateId,
        agent_name: agentName,
        agent_email: normalizedEmail,
        mga_name: mgaName,
        mga_associate_id: mgaAssociateId,
        rga_name: rgaName,
        rga_associate_id: rgaAssociateId,
        updated_at: new Date().toISOString(),
      };

      if (existingByEmail) {
        await supabaseAdmin
          .from('agent_hierarchy')
          .update(payload)
          .eq('id', existingByEmail.id);
      } else {
        payload.created_at = new Date().toISOString();
        await supabaseAdmin
          .from('agent_hierarchy')
          .upsert(payload, { onConflict: 'agent_associate_id' });
      }
    } catch (error) {
      console.error(`❌ Failed to sync agent hierarchy for ${normalizedEmail}:`, error);
    }
  }

  private async resolveAgentIdentity(
    email: string,
    existingAssociateId?: number | null,
    existingName?: string | null
  ): Promise<{ associateId: number | null; agentName: string | null }> {
    if (!supabaseAdmin) {
      return { associateId: existingAssociateId ?? null, agentName: existingName ?? null };
    }

    let associateId = existingAssociateId ?? null;
    let agentName = existingName ?? null;

    const trySetName = (newName?: string | null) => {
      if (!agentName && newName && newName.trim().length > 0) {
        agentName = newName.trim();
      }
    };

    // Customers table
    if (!associateId || !agentName) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('associate_id, first_name, last_name')
        .or(`company_email.eq.${email},personal_email.eq.${email}`)
        .maybeSingle();

      if (customer) {
        if (!associateId && customer.associate_id) {
          associateId = Number(customer.associate_id) || null;
        }
        trySetName(this.combineName(customer.first_name, customer.last_name));
      }
    }

    // user_credits table
    if (!associateId || !agentName) {
      const { data: credits } = await supabaseAdmin
        .from('user_credits')
        .select('associate_id, name')
        .eq('email', email)
        .maybeSingle();

      if (credits) {
        if (!associateId && credits.associate_id) {
          associateId = Number(credits.associate_id) || null;
        }
        trySetName(credits.name);
      }
    }

    // producerlist table
    if (!associateId || !agentName) {
      const { data: producer } = await supabaseAdmin
        .from('producerlist')
        .select('associate_id, agent_name')
        .eq('company_email', email)
        .maybeSingle();

      if (producer) {
        if (!associateId && producer.associate_id) {
          associateId = Number(producer.associate_id) || null;
        }
        trySetName(producer.agent_name);
      }
    }

    return { associateId: associateId ?? null, agentName: agentName ?? null };
  }

  private combineName(first?: string | null, last?: string | null): string | null {
    const parts = [first, last].filter(part => part && part.trim().length > 0) as string[];
    if (parts.length === 0) {
      return null;
    }
    return parts.map(part => part.trim()).join(' ');
  }

  private normalizeTeamName(team?: string | null): string | null {
    if (!team) {
      return null;
    }
    const trimmed = team.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed;
  }

  private async lookupTeamAssociateId(teamName: string | null): Promise<number | null> {
    if (!teamName || !supabaseAdmin) {
      return null;
    }

    const cacheKey = teamName.toLowerCase();
    if (this.teamDirectoryCache.has(cacheKey)) {
      return this.teamDirectoryCache.get(cacheKey) ?? null;
    }

    const { data, error } = await supabaseAdmin
      .from('mga_rga_directory')
      .select('associate_id')
      .ilike('name', teamName)
      .maybeSingle();

    if (error) {
      console.warn(`⚠️ Failed to resolve associate ID for team ${teamName}:`, error);
      this.teamDirectoryCache.set(cacheKey, null);
      return null;
    }

    const associateId = data?.associate_id ? Number(data.associate_id) : null;
    this.teamDirectoryCache.set(cacheKey, associateId ?? null);
    return associateId ?? null;
  }

  /**
   * 🔥 CRITICAL: Ensures MGA/RGA exists in mga_rga_directory by syncing from producerlist
   * This is called when Producer Setup saves MGA/RGA team names
   */
  private async ensureMgaRgaInDirectory(mgaTeam?: string | null, rgaTeam?: string | null): Promise<void> {
    if (!supabaseAdmin) {
      console.warn('⚠️ Supabase admin unavailable - cannot sync MGA/RGA to directory');
      return;
    }

    const teamsToSync: Array<{ name: string; role: 'MGA' | 'RGA' }> = [];
    if (mgaTeam) teamsToSync.push({ name: mgaTeam.trim().toUpperCase(), role: 'MGA' });
    if (rgaTeam) teamsToSync.push({ name: rgaTeam.trim().toUpperCase(), role: 'RGA' });

    if (teamsToSync.length === 0) {
      return;
    }

    console.log(`🔄 Syncing ${teamsToSync.length} MGA/RGA teams to directory...`);

    for (const team of teamsToSync) {
      try {
        // Check if already exists in directory
        const { data: existing, error: checkError } = await supabaseAdmin
          .from('mga_rga_directory')
          .select('associate_id, name, role')
          .ilike('name', team.name)
          .maybeSingle();

        if (checkError) {
          console.warn(`⚠️ Error checking ${team.role} ${team.name} in directory:`, checkError);
          continue;
        }

        if (existing) {
          console.log(`✅ ${team.role} ${team.name} already exists in directory (associate_id: ${existing.associate_id})`);
          // Update cache
          this.teamDirectoryCache.set(team.name.toLowerCase(), existing.associate_id);
          continue;
        }

        // Not in directory - look it up in producerlist by agent_name (MGA/RGA are also agents)
        console.log(`🔍 ${team.role} ${team.name} not in directory, looking up in producerlist...`);
        
        const { data: producer, error: producerError } = await supabaseAdmin
          .from('producerlist')
          .select('associate_id, agent_name, company_email, mga, rga')
          .ilike('agent_name', team.name)
          .limit(1)
          .maybeSingle();

        if (producerError) {
          console.warn(`⚠️ Error looking up ${team.role} ${team.name} in producerlist:`, producerError);
          continue;
        }

        if (!producer) {
          console.warn(`⚠️ ${team.role} ${team.name} not found in producerlist - cannot sync to directory`);
          continue;
        }

        // Found in producerlist - determine if it's MGA or RGA
        const isMga = producer.mga?.toUpperCase().trim() === team.name;
        const isRga = producer.rga?.toUpperCase().trim() === team.name;
        let role: 'MGA' | 'RGA' | 'BOTH' = team.role;
        
        if (isMga && isRga) {
          role = 'BOTH';
        } else if (isMga) {
          role = 'MGA';
        } else if (isRga) {
          role = 'RGA';
        }

        // Insert into mga_rga_directory
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('mga_rga_directory')
          .insert({
            associate_id: producer.associate_id,
            name: team.name,
            email: producer.company_email || null,
            role: role,
          })
          .select()
          .single();

        if (insertError) {
          // Might be duplicate key - try to update instead
          if (insertError.code === '23505') {
            console.log(`🔄 ${team.role} ${team.name} already exists (duplicate key), updating...`);
            const { error: updateError } = await supabaseAdmin
              .from('mga_rga_directory')
              .update({
                name: team.name,
                email: producer.company_email || null,
                role: role,
                updated_at: new Date().toISOString(),
              })
              .eq('associate_id', producer.associate_id);

            if (updateError) {
              console.error(`❌ Failed to update ${team.role} ${team.name} in directory:`, updateError);
            } else {
              console.log(`✅ Updated ${team.role} ${team.name} in directory (associate_id: ${producer.associate_id})`);
              this.teamDirectoryCache.set(team.name.toLowerCase(), producer.associate_id);
            }
          } else {
            console.error(`❌ Failed to insert ${team.role} ${team.name} into directory:`, insertError);
          }
        } else if (inserted) {
          console.log(`✅ Added ${team.role} ${team.name} to directory (associate_id: ${inserted.associate_id})`);
          this.teamDirectoryCache.set(team.name.toLowerCase(), inserted.associate_id);
        }
      } catch (error) {
        console.error(`❌ Error syncing ${team.role} ${team.name} to directory:`, error);
      }
    }
  }

  // RGA Management
  async getDistinctRGATeams(): Promise<string[]> {
    const results = await db
      .selectDistinct({ rga: agentProfiles.rgaTeam })
      .from(agentProfiles)
      .where(sql`${agentProfiles.rgaTeam} IS NOT NULL`);
    return results.map(r => r.rga).filter(Boolean);
  }

  async getMGAsByRGA(rgaTeam: string): Promise<string[]> {
    const results = await db
      .selectDistinct({ mga: agentProfiles.mgaTeam })
      .from(agentProfiles)
      .where(eq(agentProfiles.rgaTeam, rgaTeam))
      .where(sql`${agentProfiles.mgaTeam} IS NOT NULL`);
    return results.map(r => r.mga).filter(Boolean);
  }

  async assignMGAToRGA(mgaTeam: string, rgaTeam: string): Promise<void> {
    await db
      .update(agentProfiles)
      .set({ rgaTeam: rgaTeam })
      .where(eq(agentProfiles.mgaTeam, mgaTeam));
  }

  async updateAgentProfileBySupabaseId(supabaseUserId: string, updates: Partial<InsertAgentProfile>): Promise<AgentProfile | null> {
    console.log('🔄 SUPABASE STORAGE: Updating agent profile for user:', supabaseUserId);
    console.log('🔄 SUPABASE STORAGE: Updates to apply:', updates);
    console.log('🔥 CRITICAL: MGA Team in updates:', updates.mgaTeam, 'RGA Team:', updates.rgaTeam);

    // 🔥 CRITICAL: Sync MGA/RGA with mga_rga_directory BEFORE saving
    if (updates.mgaTeam || updates.rgaTeam) {
      await this.ensureMgaRgaInDirectory(updates.mgaTeam, updates.rgaTeam);
    }

    // 🔥 CRITICAL: Update Supabase FIRST (this is what verification sessions read from!)
    if (supabaseClient) {
      try {
        const supabase = supabaseAdmin;
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // Map camelCase to snake_case for Supabase
        if (updates.firstName !== undefined) updateData.first_name = updates.firstName;
        if (updates.lastName !== undefined) updateData.last_name = updates.lastName;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.zoomId !== undefined) updateData.zoom_id = updates.zoomId;
        if (updates.zoomPassword !== undefined) updateData.zoom_password = updates.zoomPassword;
        
        // 🔥 CRITICAL: Save MGA/RGA teams that agents are entering!
        if (updates.mgaTeam !== undefined) {
          updateData.mga_team = updates.mgaTeam;
          console.log(`✅ SAVING MGA_TEAM TO SUPABASE: ${updates.mgaTeam}`);
        }
        if (updates.rgaTeam !== undefined) {
          updateData.rga_team = updates.rgaTeam;
          console.log(`✅ SAVING RGA_TEAM TO SUPABASE: ${updates.rgaTeam}`);
        }

        console.log('🔍 SUPABASE: Update data being saved:', updateData);

        const { data: supabaseProfile, error } = await supabase
          .from('agent_profiles')
          .update(updateData)
          .eq('supabase_user_id', supabaseUserId)
          .select()
          .single();

        if (error) {
          console.error('❌ SUPABASE: Error updating agent profile:', error);
        } else if (supabaseProfile) {
          console.log('✅ SUPABASE: Profile updated successfully in Supabase:', {
            email: supabaseProfile.email,
            mga_team: supabaseProfile.mga_team,
            rga_team: supabaseProfile.rga_team
          });

          // Also sync to agent_hierarchy if MGA/RGA were updated
          if (updates.mgaTeam || updates.rgaTeam) {
            await this.syncAgentHierarchyFromProfile(supabaseProfile.email, {
              first_name: supabaseProfile.first_name,
              last_name: supabaseProfile.last_name,
              mga_team: supabaseProfile.mga_team,
              rga_team: supabaseProfile.rga_team,
            });
          }

          // Return Supabase data
          return {
            id: supabaseProfile.id,
            email: supabaseProfile.email,
            firstName: supabaseProfile.first_name,
            lastName: supabaseProfile.last_name,
            phone: supabaseProfile.phone || '',
            zoomId: supabaseProfile.zoom_id,
            zoomPassword: supabaseProfile.zoom_password,
            supabaseUserId: supabaseProfile.supabase_user_id,
            mgaTeam: supabaseProfile.mga_team || '',
            rgaTeam: supabaseProfile.rga_team || '',
            createdAt: new Date(supabaseProfile.created_at || new Date()),
            updatedAt: new Date(supabaseProfile.updated_at || new Date()),
          } as AgentProfile;
        }
      } catch (supabaseError) {
        console.error('❌ SUPABASE: Error updating Supabase:', supabaseError);
      }
    }

    // Fallback to local database (but Supabase is primary)
    const [updatedProfile] = await db
      .update(agentProfiles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agentProfiles.supabaseUserId, supabaseUserId))
      .returning();

    if (updatedProfile) {
      console.log('✅ LOCAL DB: Profile updated successfully for:', updatedProfile.email);
    } else {
      console.log('❌ LOCAL DB: No profile found to update for user:', supabaseUserId);
    }

    return updatedProfile || null;
  }

  // Outbound call tracking for intelligent inbound routing
  async trackOutboundCall(callData: Partial<OutboundCallHistory>): Promise<OutboundCallHistory> {
    const [trackedCall] = await db
      .insert(outboundCallHistory)
      .values({
        leadPhone: callData.leadPhone!,
        leadName: callData.leadName || null,
        leadState: callData.leadState || null,
        agentEmail: callData.agentEmail!,
        agentName: callData.agentName || null,
        callSid: callData.callSid || null,
        conferenceName: callData.conferenceName || null,
        localPresenceNumber: callData.localPresenceNumber || null,
        callStatus: callData.callStatus || 'initiated',
        callDisposition: callData.callDisposition || null,
        callDuration: callData.callDuration || 0,
        callAttempts: callData.callAttempts || 1,
        notes: callData.notes || null,
        lastContactedAt: new Date(),
        startTime: new Date(),
        answerTime: null,
        endTime: null,
        createdAt: new Date(),
      })
      .returning();
    return trackedCall;
  }

  async createOutboundCall(callData: {
    leadPhone: string;
    agentEmail: string;
    callSid: string;
    callStatus: string;
    callDisposition?: string;
    callDuration?: number;
    startTime?: Date;
    endTime?: Date;
  }): Promise<OutboundCallHistory> {
    const [call] = await db
      .insert(outboundCallHistory)
      .values({
        leadPhone: callData.leadPhone,
        agentEmail: callData.agentEmail,
        callSid: callData.callSid,
        callStatus: callData.callStatus,
        callDisposition: callData.callDisposition || null,
        callDuration: callData.callDuration || 0,
        startTime: callData.startTime || new Date(),
        endTime: callData.endTime || null,
        createdAt: new Date()
      })
      .returning();
    return call;
  }

  async updateOutboundCallStatus(updateData: {
    leadPhone: string;
    agentEmail: string;
    callStatus?: string;
    callDisposition?: string;
    callDuration?: number;
    answerTime?: Date;
    endTime?: Date;
  }): Promise<OutboundCallHistory | undefined> {
    const updates: any = {
      lastContactedAt: new Date(),
    };

    if (updateData.callStatus) updates.callStatus = updateData.callStatus;
    if (updateData.callDisposition) updates.callDisposition = updateData.callDisposition;
    if (updateData.callDuration !== undefined) updates.callDuration = updateData.callDuration;
    if (updateData.answerTime) updates.answerTime = updateData.answerTime;
    if (updateData.endTime) updates.endTime = updateData.endTime;

    const [updatedCall] = await db
      .update(outboundCallHistory)
      .set(updates)
      .where(and(
        eq(outboundCallHistory.leadPhone, updateData.leadPhone),
        eq(outboundCallHistory.agentEmail, updateData.agentEmail)
      ))
      .returning();

    return updatedCall || undefined;
  }

  async getLastCallToNumber(phoneNumber: string): Promise<OutboundCallHistory | undefined> {
    const [lastCall] = await db
      .select()
      .from(outboundCallHistory)
      .where(eq(outboundCallHistory.leadPhone, phoneNumber))
      .orderBy(outboundCallHistory.lastContactedAt)
      .limit(1);
    return lastCall || undefined;
  }

  async getAgentForCallbacks(phoneNumber: string): Promise<string | undefined> {
    const lastCall = await this.getLastCallToNumber(phoneNumber);
    return lastCall?.agentEmail || undefined;
  }

  // Inbound call routing management
  async createInboundCallRoute(routeData: Partial<InboundCallRouting>): Promise<InboundCallRouting> {
    const [newRoute] = await db
      .insert(inboundCallRouting)
      .values({
        callerPhone: routeData.callerPhone!,
        incomingCallSid: routeData.incomingCallSid || null,
        routedToAgent: routeData.routedToAgent || null,
        routingReason: routeData.routingReason || 'new_caller',
        conferenceName: routeData.conferenceName || null,
        callStatus: routeData.callStatus || 'active',
        notes: routeData.notes || null,
        callStartTime: new Date(),
      })
      .returning();
    return newRoute;
  }

  async getActiveInboundCalls(agentEmail?: string): Promise<InboundCallRouting[]> {
    if (agentEmail) {
      return await db
        .select()
        .from(inboundCallRouting)
        .where(and(
          eq(inboundCallRouting.callStatus, 'active'),
          eq(inboundCallRouting.routedToAgent, agentEmail)
        ));
    } else {
      return await db
        .select()
        .from(inboundCallRouting)
        .where(eq(inboundCallRouting.callStatus, 'active'));
    }
  }

  async updateInboundCallStatus(callSid: string, status: string, endTime?: Date): Promise<InboundCallRouting | undefined> {
    const updates: Partial<InboundCallRouting> = { callStatus: status };
    if (endTime) {
      updates.callEndTime = endTime;
    }

    const [updatedRoute] = await db
      .update(inboundCallRouting)
      .set(updates)
      .where(eq(inboundCallRouting.incomingCallSid, callSid))
      .returning();

    return updatedRoute || undefined;
  }

  async getCallbackStats(): Promise<{
    totalActiveCalls: number;
    callbackCalls: number;
    newCallerCalls: number;
    callbackPercentage: number;
    agentSpecificCallbacks: Record<string, number>;
  }> {
    // Get all active inbound calls
    const activeCalls = await this.getActiveInboundCalls();

    // Calculate statistics
    const totalActiveCalls = activeCalls.length;
    const callbackCalls = activeCalls.filter(call => call.routingReason === 'callback').length;
    const newCallerCalls = activeCalls.filter(call => call.routingReason === 'new_caller').length;
    const callbackPercentage = totalActiveCalls > 0 ? Math.round((callbackCalls / totalActiveCalls) * 100) : 0;

    // Count callbacks by agent
    const agentSpecificCallbacks: Record<string, number> = {};
    activeCalls
      .filter(call => call.routingReason === 'callback' && call.routedToAgent)
      .forEach(call => {
        const agent = call.routedToAgent!;
        agentSpecificCallbacks[agent] = (agentSpecificCallbacks[agent] || 0) + 1;
      });

    return {
      totalActiveCalls,
      callbackCalls,
      newCallerCalls,
      callbackPercentage,
      agentSpecificCallbacks
    };
  }

  // Recruit Candidates operations - SUPABASE DIRECT QUERIES
  async createRecruitCandidate(candidate: InsertRecruitCandidate): Promise<RecruitCandidate> {
    // Map camelCase to snake_case for Supabase
    const supabaseCandidate = {
      first_name: candidate.firstName,
      last_name: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      city: candidate.city,
      state: candidate.state,
      zip_code: candidate.zipCode,
      status: candidate.status,
      position: candidate.position,
      experience: candidate.experience,
      rating: candidate.rating,
      notes: candidate.notes,
      appointment_date: candidate.appointmentDate,
      appointment_notes: candidate.appointmentNotes,
      current_stage_id: candidate.currentStageId ?? 1,
      agent_id: candidate.agentId,
      agent_email: candidate.agentEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('recruit_candidates')
      .insert(supabaseCandidate)
      .select()
      .single();

    if (error) throw error;
    
    // Map Supabase snake_case to camelCase
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      status: data.status,
      position: data.position,
      experience: data.experience,
      rating: data.rating,
      notes: data.notes,
      appointmentDate: data.appointment_date,
      appointmentNotes: data.appointment_notes,
      currentStageId: data.current_stage_id ?? 1,
      stageEnteredAt: data.stage_entered_at,
      agentId: data.agent_id,
      agentEmail: data.agent_email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    } as RecruitCandidate;
  }

  async getRecruitCandidates(agentEmail: string): Promise<RecruitCandidate[]> {
    const normalizedAgentEmail = String(agentEmail || '').trim().toLowerCase();
    if (!normalizedAgentEmail) return [];

    // Get agent's associate ID from producerlist OR agent_profiles for fallback matching
    let associateId = null;
    
    // Try producerlist first
    const { data: producerData } = await supabaseAdmin
      .from('producerlist')
      .select('Associate ID')
      .ilike('Company Email', normalizedAgentEmail)
      .single();
    
    associateId = producerData?.['Associate ID'];
    
    // Note: agent_profiles table doesn't have associate_id column
    // Skip this fallback - associate_id should come from producerlist or customers table
    // if (!associateId) {
    //   const { data: profileData } = await supabaseAdmin
    //     .from('agent_profiles')
    //     .select('associate_id')
    //     .eq('email', agentEmail)
    //     .single();
    //   
    //   associateId = profileData?.associate_id;
    // }
    
    // Query by agent_email OR agent_id (for candidates created before email was mapped)
    let query = supabaseAdmin
      .from('recruit_candidates')
      .select('*');
    
    if (associateId) {
      // Match by email OR associate ID
      query = query.or(`agent_email.ilike.${normalizedAgentEmail},agent_id.eq.${associateId}`);
    } else {
      // No associate ID found, only match by email
      query = query.ilike('agent_email', normalizedAgentEmail);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }); // Newest first

    if (error) {
      console.error('❌ Error fetching recruit candidates from Supabase:', error);
      throw error;
    }

    // console.log('📊 Raw Supabase data:', data); // silenced — too verbose in prod

    // Map Supabase snake_case to camelCase
    return (data || []).map(candidate => ({
      id: candidate.id,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      email: candidate.email,
      phone: candidate.phone,
      city: candidate.city,
      state: candidate.state,
      zipCode: candidate.zip_code,
      status: candidate.status,
      currentStageId: candidate.current_stage_id ?? 1,
      position: candidate.position,
      experience: candidate.experience,
      rating: candidate.rating,
      notes: candidate.notes,
      aiSummary: candidate.ai_summary,
      appointmentDate: candidate.appointment_date,
      appointmentNotes: candidate.appointment_notes,
      agentId: candidate.agent_id,
      agentEmail: candidate.agent_email,
      createdAt: new Date(candidate.created_at),
      updatedAt: new Date(candidate.updated_at),
    })) as RecruitCandidate[];
  }

  async getRecruitCandidateById(id: number): Promise<RecruitCandidate | undefined> {
    const { data, error } = await supabaseAdmin
      .from('recruit_candidates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return undefined; // Not found
      throw error;
    }

    // Map Supabase snake_case to camelCase
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      status: data.status,
      currentStageId: data.current_stage_id ?? 1,
      position: data.position,
      experience: data.experience,
      rating: data.rating,
      notes: data.notes,
      aiSummary: data.ai_summary,
      appointmentDate: data.appointment_date,
      appointmentNotes: data.appointment_notes,
      stageEnteredAt: data.stage_entered_at,
      agentId: data.agent_id,
      agentEmail: data.agent_email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    } as RecruitCandidate;
  }

  async updateRecruitCandidate(id: number, updates: UpdateRecruitCandidate): Promise<RecruitCandidate | undefined> {
    // Map camelCase to snake_case for Supabase
    const supabaseUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.firstName !== undefined) supabaseUpdates.first_name = updates.firstName;
    if (updates.lastName !== undefined) supabaseUpdates.last_name = updates.lastName;
    if (updates.email !== undefined) supabaseUpdates.email = updates.email;
    if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone;
    if (updates.city !== undefined) supabaseUpdates.city = updates.city;
    if (updates.state !== undefined) supabaseUpdates.state = updates.state;
    if (updates.zipCode !== undefined) supabaseUpdates.zip_code = updates.zipCode;
    if (updates.status !== undefined) supabaseUpdates.status = updates.status;
    if (updates.position !== undefined) supabaseUpdates.position = updates.position;
    if (updates.experience !== undefined) supabaseUpdates.experience = updates.experience;
    if (updates.rating !== undefined) supabaseUpdates.rating = updates.rating;
    if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes;
    if (updates.appointmentDate !== undefined) supabaseUpdates.appointment_date = updates.appointmentDate;
    if (updates.appointmentNotes !== undefined) supabaseUpdates.appointment_notes = updates.appointmentNotes;
    if (updates.currentStageId !== undefined) supabaseUpdates.current_stage_id = updates.currentStageId;
    if (updates.stageEnteredAt !== undefined) supabaseUpdates.stage_entered_at = updates.stageEnteredAt;

    const { data, error } = await supabaseAdmin
      .from('recruit_candidates')
      .update(supabaseUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return undefined; // Not found
      throw error;
    }

    // Map Supabase snake_case to camelCase
    return {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      status: data.status,
      position: data.position,
      experience: data.experience,
      rating: data.rating,
      notes: data.notes,
      appointmentDate: data.appointment_date,
      appointmentNotes: data.appointment_notes,
      currentStageId: data.current_stage_id ?? 1,
      stageEnteredAt: data.stage_entered_at,
      agentId: data.agent_id,
      agentEmail: data.agent_email,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    } as RecruitCandidate;
  }

  async deleteRecruitCandidate(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('recruit_candidates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting recruit candidate from Supabase:', error);
      return false;
    }

    return true;
  }

  // Music preferences - simple implementation returning default for now
  async getMusicPreferences(agentEmail: string): Promise<{ musicType: string } | null> {
    // For now, return silence as default. This can be expanded to use a database table later
    return { musicType: 'silence' };
  }

  async getDistinctMGATeams(): Promise<string[]> {
    const profiles = await db
      .select({ mgaTeam: agentProfiles.mgaTeam })
      .from(agentProfiles)
      .where(sql`mga_team IS NOT NULL AND mga_team != ''`);

    const uniqueTeams = [...new Set(profiles.map(p => p.mgaTeam).filter(Boolean))];
    return uniqueTeams;
  }

  // AOI Follow-up Management - Two-stage accountability implementation
  async createFollowup(followupData: any): Promise<any> {
    try {
      console.log('📝 Creating AOI follow-up:', followupData);
      const [newFollowup] = await db
        .insert(aoiFollowups)
        .values({
          vdpCallId: followupData.vdp_call_id || 0, // Default if not provided
          taalk_leadid: followupData.taalk_leadid || followupData.leadid || `temp_${Date.now()}`,
          agentEmail: followupData.agent_email,
          followupType: followupData.initial_resolution === 'appointment_set' ? 'appointment' : 'callback',
          initialResolution: followupData.initial_resolution,
          initialResolutionAt: new Date(),
          initialNotes: followupData.notes || '',
          dueDate: new Date(followupData.due_date),
          status: 'pending'
        })
        .returning();

      console.log('✅ AOI follow-up created:', newFollowup);
      return newFollowup;
    } catch (error) {
      console.error('❌ Error creating AOI follow-up:', error);
      throw error;
    }
  }

  async getOverdueFollowups(): Promise<any[]> {
    try {
      console.log('🔍 Getting overdue AOI follow-ups...');
      const today = new Date();

      const overdueFollowups = await db
        .select()
        .from(aoiFollowups)
        .where(sql`due_date < ${today} AND status = 'pending'`)
        .orderBy(aoiFollowups.dueDate);

      console.log(`📋 Found ${overdueFollowups.length} overdue follow-ups`);
      return overdueFollowups.map(followup => ({
        ...followup,
        customer_name: 'Unknown Customer',
        phone_number: 'Unknown Phone',
        agent_email: followup.agentEmail,
        initial_resolution: followup.initialResolution,
        due_date: followup.dueDate,
        created_at: followup.createdAt
      }));
    } catch (error) {
      console.error('❌ Error getting overdue follow-ups:', error);
      return [];
    }
  }

  // Get ALL calls from both VDP calls and masterlead tables
  async getAllVDPCallsNeedingResolution() {
    try {
      console.log('🔍 Getting calls needing resolution from VDP calls and masterlead...');

      // Use the supabaseClient from import
      const supabase = supabaseClient;

      if (!supabase) {
        console.error('❌ Supabase client not available');
        return [];
      }

      // First let's get a count of total records in each table
      const { count: vdpTotalCount, error: vdpCountError } = await supabase
        .from('vdp_calls')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 Total VDP calls in database: ${vdpTotalCount || 0}`);
      if (vdpCountError) console.log('❌ VDP count error:', vdpCountError);

      const { count: masterleadTotalCount, error: masterleadCountError } = await masterleadClient
        .from('masterlead')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 Total masterlead records in database: ${masterleadTotalCount || 0}`);
      if (masterleadCountError) console.log('❌ Masterlead count error:', masterleadCountError);

      // Get ALL VDP calls (since they don't have resolution tracking) + calls >4 minutes
      const { data: vdpCalls, error: vdpError } = await supabase
        .from('vdp_calls')
        .select('*')
        .or('duration.gte.240,duration.is.null') // Include calls >4 minutes OR any call (null duration)
        .order('id', { ascending: false })
        .limit(200); // Increased limit since we're filtering

      if (vdpError) {
        console.error('❌ Supabase error getting VDP calls:', vdpError);
      } else {
        console.log(`🔍 Retrieved ${vdpCalls?.length || 0} VDP calls`);
      }

      // Get masterlead calls that need follow-up: call backs, bookings, appointments
      const { data: masterleadCalls, error: masterleadError } = await masterleadClient
        .from('masterlead')
        .select('*')
        .or('cnresolution.ilike.%booked%,cnresolution.ilike.%appointment%,cnresolution.ilike.%call back%,cnresolution.ilike.%callback%')
        .order('created_at', { ascending: false })
        .limit(2000);

      if (masterleadError) {
        console.error('❌ Masterlead query error getting masterlead calls:', masterleadError);
      } else {
        console.log(`🔍 Retrieved ${masterleadCalls?.length || 0} masterlead calls`);
      }

      // Combine both datasets and normalize structure
      const allCalls = [];

      // Add VDP calls with source identifier
      if (vdpCalls) {
        vdpCalls.forEach((call, index) => {
          // Fix the fucked up date issue - use proper date fields or current date
          let callDate = null;
          if (call.time && !isNaN(Date.parse(call.time))) {
            callDate = call.time;
          } else if (call.Date && !isNaN(Date.parse(call.Date))) {
            callDate = call.Date;
          } else {
            // If no valid date, use a reasonable default (today minus random days for demo)
            callDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
          }

          allCalls.push({
            ...call,
            source: 'vdp_calls',
            customer_name: `${call.firstname || ''} ${call.lastname || ''}`.trim() || 'Unknown',
            phone: call.Phone || 'Unknown',
            agent_email: call.agent || call.cn_email || call.email || call.agent_email || 'Unknown Agent',
            market: call.market || 'Unknown Market',
            taalk_leadid: call.leadid,
            cnresolution: 'No resolution tracking', // VDP calls don't track resolutions
            created_at: callDate
          });
        });
      }

      // Add masterlead calls with source identifier
      if (masterleadCalls) {
        masterleadCalls.forEach((call, index) => {
          // Use proper date fields for masterlead calls
          let callDate = call.called_at || call.created_at || call.updated_at || call.last_contacted;
          if (!callDate || isNaN(Date.parse(callDate))) {
            // If no valid date, use a reasonable default
            callDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
          }

          allCalls.push({
            ...call,
            source: 'masterlead',
            customer_name: `${call.first_name || ''} ${call.last_name || ''}`.trim() || 'Unknown',
            phone: call.phone || 'Unknown',
            agent_email: call.assigned_agent_email || call.cn_email || call.agent_email || 'Unknown Agent',
            market: call.taalk_market || 'Unknown Market',
            taalk_leadid: call.taalk_lead_id,
            created_at: callDate
          });
        });
      }

      console.log(`🔍 Found ${vdpCalls?.length || 0} VDP calls + ${masterleadCalls?.length || 0} masterlead calls = ${allCalls.length} total calls needing resolution`);
      return allCalls;
    } catch (error) {
      console.error('❌ Error getting calls needing resolution:', error);
      return [];
    }
  }

  async getPendingFollowups(agentEmail: string): Promise<any[]> {
    try {
      console.log(`📅 Getting pending follow-ups for agent: ${agentEmail}`);

      const pendingFollowups = await db
        .select()
        .from(aoiFollowups)
        .where(sql`agent_email = ${agentEmail} AND status = 'pending'`)
        .orderBy(aoiFollowups.dueDate);

      console.log(`📋 Found ${pendingFollowups.length} pending follow-ups for ${agentEmail}`);
      return pendingFollowups;
    } catch (error) {
      console.error('❌ Error getting pending follow-ups:', error);
      return [];
    }
  }

  async completeFollowup(followupId: number, outcome: string, notes?: string): Promise<any> {
    try {
      console.log(`✅ Completing follow-up ${followupId} with outcome: ${outcome}`);

      const [completedFollowup] = await db
        .update(aoiFollowups)
        .set({
          status: 'completed',
          finalOutcome: outcome,
          finalNotes: notes || '',
          completedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(aoiFollowups.id, followupId))
        .returning();

      console.log('✅ Follow-up completed:', completedFollowup);
      return completedFollowup;
    } catch (error) {
      console.error('❌ Error completing follow-up:', error);
      throw error;
    }
  }

  // Current Lead Management - in-memory storage keyed by userEmail
  private currentLeads: Map<string, CurrentLead> = new Map();

  async getCurrentLead(userEmail: string): Promise<CurrentLead | null> {
    return this.currentLeads.get(userEmail) || null;
  }

  async setCurrentLead(userEmail: string, currentLead: CurrentLead): Promise<void> {
    this.currentLeads.set(userEmail, currentLead);
    console.log(`📋 Set current lead for ${userEmail}: ${currentLead.source} - ${currentLead.name} (${currentLead.phone})`);
  }

  async clearCurrentLead(userEmail: string): Promise<void> {
    this.currentLeads.delete(userEmail);
    console.log(`🗑️ Cleared current lead for ${userEmail}`);
  }

  // Quality Manager Team Assignment methods
  async getQMTeamAssignments(qmEmail: string): Promise<string[]> {
    try {
      const assignments = await db
        .select({ mgaTeam: qualityManagerTeamAssignments.mgaTeam })
        .from(qualityManagerTeamAssignments)
        .where(eq(qualityManagerTeamAssignments.qmEmail, qmEmail));

      return assignments.map(a => a.mgaTeam);
    } catch (error) {
      console.error('❌ Error getting QM team assignments:', error);
      return [];
    }
  }

  async assignQMToTeam(qmEmail: string, mgaTeam: string): Promise<void> {
    try {
      await db
        .insert(qualityManagerTeamAssignments)
        .values({ qmEmail, mgaTeam })
        .onConflictDoNothing(); // Ignore if already exists

      console.log(`✅ Assigned QM ${qmEmail} to team ${mgaTeam}`);
    } catch (error) {
      console.error('❌ Error assigning QM to team:', error);
      throw error;
    }
  }

  async removeQMFromTeam(qmEmail: string, mgaTeam: string): Promise<void> {
    try {
      await db
        .delete(qualityManagerTeamAssignments)
        .where(
          and(
            eq(qualityManagerTeamAssignments.qmEmail, qmEmail),
            eq(qualityManagerTeamAssignments.mgaTeam, mgaTeam)
          )
        );

      console.log(`✅ Removed QM ${qmEmail} from team ${mgaTeam}`);
    } catch (error) {
      console.error('❌ Error removing QM from team:', error);
      throw error;
    }
  }

  async replaceQMTeamAssignments(qmEmail: string, mgaTeams: string[]): Promise<void> {
    try {
      // Delete all existing assignments for this QM
      await db
        .delete(qualityManagerTeamAssignments)
        .where(eq(qualityManagerTeamAssignments.qmEmail, qmEmail));

      // Insert new assignments
      if (mgaTeams.length > 0) {
        const newAssignments = mgaTeams.map(mgaTeam => ({ qmEmail, mgaTeam }));
        await db.insert(qualityManagerTeamAssignments).values(newAssignments);
      }

      console.log(`✅ Replaced QM ${qmEmail} team assignments with: ${mgaTeams.join(', ')}`);
    } catch (error) {
      console.error('❌ Error replacing QM team assignments:', error);
      throw error;
    }
  }

  async getAllQMTeamAssignments(): Promise<QualityManagerTeamAssignment[]> {
    try {
      return await db.select().from(qualityManagerTeamAssignments);
    } catch (error) {
      console.error('❌ Error getting all QM team assignments:', error);
      return [];
    }
  }

  // Enhanced Team Management - MGA/RGA Teams
  async getAllTeams(): Promise<Array<{id: number, name: string, description: string, teamType: string, isActive: boolean}>> {
    try {
      const teams = await db.select({
        id: mgaTeams.id,
        name: mgaTeams.name,
        description: mgaTeams.description,
        teamType: mgaTeams.teamType,
        isActive: mgaTeams.isActive
      }).from(mgaTeams).where(eq(mgaTeams.isActive, true));

      return teams;
    } catch (error) {
      console.error('❌ Error getting all teams:', error);
      return [];
    }
  }

  async getTeamsByType(teamType: 'MGA' | 'RGA'): Promise<Array<{id: number, name: string, description: string, teamType: string, isActive: boolean}>> {
    try {
      const teams = await db.select({
        id: mgaTeams.id,
        name: mgaTeams.name,
        description: mgaTeams.description,
        teamType: mgaTeams.teamType,
        isActive: mgaTeams.isActive
      }).from(mgaTeams)
        .where(and(
          eq(mgaTeams.isActive, true),
          eq(mgaTeams.teamType, teamType)
        ));

      return teams;
    } catch (error) {
      console.error(`❌ Error getting ${teamType} teams:`, error);
      return [];
    }
  }

  async getQualityManagersByTeam(teamId: number): Promise<string[]> {
    try {
      // Get team name first
      const team = await db.select({ name: mgaTeams.name })
        .from(mgaTeams)
        .where(eq(mgaTeams.id, teamId))
        .limit(1);

      if (team.length === 0) {
        return [];
      }

      // Get QMs assigned to this team using the team name
      const assignments = await db
        .select({ qmEmail: qualityManagerTeamAssignments.qmEmail })
        .from(qualityManagerTeamAssignments)
        .where(eq(qualityManagerTeamAssignments.mgaTeam, team[0].name));

      return assignments.map(a => a.qmEmail);
    } catch (error) {
      console.error('❌ Error getting quality managers by team:', error);
      return [];
    }
  }

  async assignQMToTeamById(qmEmail: string, teamId: number): Promise<void> {
    try {
      // Get team name first
      const team = await db.select({ name: mgaTeams.name })
        .from(mgaTeams)
        .where(eq(mgaTeams.id, teamId))
        .limit(1);

      if (team.length === 0) {
        throw new Error(`Team with ID ${teamId} not found`);
      }

      // Use existing method with team name
      await this.assignQMToTeam(qmEmail, team[0].name);
      console.log(`✅ Assigned QM ${qmEmail} to team ID ${teamId} (${team[0].name})`);
    } catch (error) {
      console.error('❌ Error assigning QM to team by ID:', error);
      throw error;
    }
  }

  async removeQMFromTeamById(qmEmail: string, teamId: number): Promise<void> {
    try {
      // Get team name first
      const team = await db.select({ name: mgaTeams.name })
        .from(mgaTeams)
        .where(eq(mgaTeams.id, teamId))
        .limit(1);

      if (team.length === 0) {
        throw new Error(`Team with ID ${teamId} not found`);
      }

      // Use existing method with team name
      await this.removeQMFromTeam(qmEmail, team[0].name);
      console.log(`✅ Removed QM ${qmEmail} from team ID ${teamId} (${team[0].name})`);
    } catch (error) {
      console.error('❌ Error removing QM from team by ID:', error);
      throw error;
    }
  }
}

// Use DatabaseStorage with PostgreSQL
export const storage = new DatabaseStorage();