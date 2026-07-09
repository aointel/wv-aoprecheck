import { 
  users, teams, userTeams, calls, offices,
  type User, type InsertUser, 
  type Team, type InsertTeam, 
  type UserTeam, type Call, type InsertCall,
  type Office, type InsertOffice,
  type Role, RoleType
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { sql, eq, and, or, like, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: Role): Promise<User[]>;
  getUsersByTeam(teamId: number): Promise<User[]>;
  getUserSubordinates(managerId: number): Promise<User[]>;
  
  // Team management
  getTeam(id: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, teamData: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;
  getAllTeams(): Promise<Team[]>;
  getTeamsByParent(parentTeamId: number): Promise<Team[]>;
  getTeamHierarchy(teamId: number): Promise<Team[]>; // Get team and all children recursively
  
  // Team membership
  addUserToTeam(userId: number, teamId: number): Promise<UserTeam>;
  removeUserFromTeam(userId: number, teamId: number): Promise<boolean>;
  getUserTeams(userId: number): Promise<Team[]>;
  
  // Office management
  getOffice(id: number): Promise<Office | undefined>;
  getOfficeByName(name: string): Promise<Office | undefined>;
  createOffice(office: InsertOffice): Promise<Office>;
  updateOffice(id: number, officeData: Partial<InsertOffice>): Promise<Office | undefined>;
  deleteOffice(id: number): Promise<boolean>;
  getAllOffices(): Promise<Office[]>;
  getUsersByOffice(office: string): Promise<User[]>;
  
  // Call related methods
  getCalls(limit: number, offset: number, filters?: CallFilters, sortOptions?: { column: string, direction: 'asc' | 'desc' }): Promise<Call[]>;
  getCallById(id: number): Promise<Call | undefined>;
  getCallByPhone(phone: string): Promise<Call[]>;
  getCallByTaalkUID(taalkUID: string): Promise<Call | undefined>;
  getCallByHpproId(hpproId: string): Promise<Call | undefined>;
  getCallsByAgent(agentId: number): Promise<Call[]>;
  getCallsByTeam(teamId: number, includeSubteams: boolean): Promise<Call[]>;
  getCallsByOffice(office: string): Promise<Call[]>;
  createCall(call: InsertCall): Promise<Call>;
  updateCall(id: number, call: Partial<InsertCall>): Promise<Call | undefined>;
  deleteCall(id: number): Promise<boolean>;
  getTotalCalls(filters?: CallFilters): Promise<number>;
  
  // Access control helpers
  canUserAccessCall(userId: number, callId: number): Promise<boolean>;
  getAccessibleCallsForUser(userId: number, limit: number, offset: number, filters?: CallFilters): Promise<Call[]>;
  getTotalAccessibleCallsForUser(userId: number, filters?: CallFilters): Promise<number>;
}

// Filters for call search/filtering
export interface CallFilters {
  search?: string;
  phoneSearch?: string; // Specific search for phone numbers
  agentSearch?: string; // Specific search for agent names
  status?: string;
  dateRange?: string;
  agent?: string;
  agentName?: string; // Alternative agent name field
  premiumMin?: number;
  premiumMax?: number;
  isFlagged?: boolean;
  office?: string; // Filter by office
  userId?: number; // To filter by current user's access
  teamId?: number; // To filter by specific team
  startDate?: string;
  endDate?: string;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private callsData: Map<number, Call>;
  private teams: Map<number, Team>;
  private userTeams: Map<string, UserTeam>; // Composite key: userId-teamId
  userCurrentId: number;
  callCurrentId: number;
  teamCurrentId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.callsData = new Map();
    this.teams = new Map();
    this.userTeams = new Map();
    this.userCurrentId = 1;
    this.callCurrentId = 1;
    this.teamCurrentId = 1;
    
    // Initialize session store
    const MemoryStore = createMemoryStore(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours in milliseconds
    });
    
    // Add some sample calls for development
    this.initializeSampleCalls();
  }

  private initializeSampleCalls() {
    const sampleCalls: Omit<Call, 'id'>[] = [
      {
        taalkUID: "HP202305001", // Adding unique TaalkUID as primary identifier
        phone: "555-123-4567",
        firstName: "John",
        lastName: "Doe",
        monthlyPremium: "124.99" as any,
        status: "approved",
        recordingUrl: "/sample-recording.mp3",
        transcriptionText: "This call was about a policy renewal. The customer confirmed their details and agreed to renew their policy.",
        screenshotUrl: null,
        isFlagged: false,
        flagReason: null,
        office: "Houston Office",
        createdAt: new Date(),
        agentName: "Sarah Johnson",
        callDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        callDuration: "8:45" as any,
        notes: "Customer was very satisfied with service.",
        teamId: null,
        agentId: null,
      },
      {
        taalkUID: "HP202305002", // Adding unique TaalkUID as primary identifier
        phone: "555-987-6543",
        firstName: "Jane",
        lastName: "Smith",
        monthlyPremium: "248.50" as any,
        status: "flagged",
        recordingUrl: "/sample-recording.mp3",
        transcriptionText: "This call was about a premium adjustment request. The customer was inquiring about reducing their monthly premium. The agent explained available options and recommended a policy review. The call was marked as requiring follow-up.",
        screenshotUrl: null,
        isFlagged: true,
        flagReason: "Compliance issue detected",
        office: "Dallas Office",
        createdAt: new Date(),
        agentName: "David Lee",
        callDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        callDuration: "12:35" as any,
        notes: "Customer requested premium adjustment. Needs follow-up.",
        teamId: null,
        agentId: null,
      },
      {
        taalkUID: "HP202305003", // Adding unique TaalkUID as primary identifier
        phone: "555-456-7890",
        firstName: "Michael",
        lastName: "Johnson",
        monthlyPremium: "89.99" as any,
        status: "pending",
        recordingUrl: "/sample-recording.mp3",
        transcriptionText: "Customer called to inquire about coverage details. Agent provided explanation of policy terms and recommended additional coverage options.",
        isFlagged: false,
        flagReason: null,
        office: "Austin Office",
        createdAt: new Date(),
        agentName: "Emily Wilson",
        callDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        callDuration: "5:22" as any,
        screenshotUrl: null,
        notes: "Agent provided detailed explanation of policy terms. Customer satisfied.",
        teamId: null,
        agentId: null,
      },
      {
        taalkUID: "HP202305004", // Adding unique TaalkUID as primary identifier
        phone: "555-789-0123",
        firstName: "Robert",
        lastName: "Williams",
        monthlyPremium: "175.00" as any,
        status: "rejected",
        recordingUrl: "/sample-recording.mp3",
        transcriptionText: "Customer called with billing concerns. Agent reviewed account and explained recent charges. Customer requested additional documentation.",
        isFlagged: false,
        flagReason: null,
        office: "San Antonio Office",
        createdAt: new Date(),
        agentName: "Michelle Garcia",
        callDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        callDuration: "9:17" as any,
        screenshotUrl: null,
        notes: "Customer has billing concerns. Follow up with documentation.",
        teamId: null,
        agentId: null,
      }
    ];
    
    // Add sample calls to the storage
    sampleCalls.forEach(call => {
      const id = this.callCurrentId++;
      this.callsData.set(id, { ...call, id });
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Set default values for nullable fields
      teamId: insertUser.teamId || null,
      managerId: insertUser.managerId || null,
      role: insertUser.role || "AGENT"
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      ...userData,
      updatedAt: new Date() 
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // First check if user exists
    if (!this.users.has(id)) return false;
    
    // Remove user from all teams
    const userTeamKeys = Array.from(this.userTeams.keys())
      .filter(key => key.startsWith(`${id}-`));
    
    for (const key of userTeamKeys) {
      this.userTeams.delete(key);
    }
    
    // Remove the user
    return this.users.delete(id);
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getUsersByRole(role: Role): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => user.role === role);
  }
  
  async getUsersByTeam(teamId: number): Promise<User[]> {
    // First get all userTeam entries for this team
    const userTeamEntries = Array.from(this.userTeams.values())
      .filter(ut => ut.teamId === teamId);
    
    // Then get the users
    const userIds = userTeamEntries.map(ut => ut.userId);
    return Array.from(this.users.values())
      .filter(user => userIds.includes(user.id));
  }
  
  async getUserSubordinates(managerId: number): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => user.managerId === managerId);
  }
  
  // Team methods
  async getTeam(id: number): Promise<Team | undefined> {
    return this.teams.get(id);
  }
  
  async createTeam(insertTeam: InsertTeam): Promise<Team> {
    const id = this.teamCurrentId++;
    const team: Team = {
      ...insertTeam,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Set default values for nullable fields
      parentTeamId: insertTeam.parentTeamId || null
    };
    this.teams.set(id, team);
    return team;
  }
  
  async updateTeam(id: number, teamData: Partial<InsertTeam>): Promise<Team | undefined> {
    const team = this.teams.get(id);
    if (!team) return undefined;
    
    const updatedTeam = {
      ...team,
      ...teamData,
      updatedAt: new Date()
    };
    this.teams.set(id, updatedTeam);
    return updatedTeam;
  }
  
  async deleteTeam(id: number): Promise<boolean> {
    // First check if team exists
    if (!this.teams.has(id)) return false;
    
    // Remove all userTeam entries for this team
    const userTeamKeys = Array.from(this.userTeams.keys())
      .filter(key => key.endsWith(`-${id}`));
    
    for (const key of userTeamKeys) {
      this.userTeams.delete(key);
    }
    
    // Remove the team
    return this.teams.delete(id);
  }
  
  async getAllTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }
  
  async getTeamsByParent(parentTeamId: number): Promise<Team[]> {
    return Array.from(this.teams.values())
      .filter(team => team.parentTeamId === parentTeamId);
  }
  
  async getTeamHierarchy(teamId: number): Promise<Team[]> {
    const result: Team[] = [];
    const team = await this.getTeam(teamId);
    if (!team) return result;
    
    // Add this team
    result.push(team);
    
    // Recursively get child teams
    const childTeams = await this.getTeamsByParent(teamId);
    for (const childTeam of childTeams) {
      const childHierarchy = await this.getTeamHierarchy(childTeam.id);
      result.push(...childHierarchy);
    }
    
    return result;
  }
  
  // Team membership methods
  async addUserToTeam(userId: number, teamId: number): Promise<UserTeam> {
    const key = `${userId}-${teamId}`;
    const userTeam: UserTeam = { userId, teamId };
    this.userTeams.set(key, userTeam);
    return userTeam;
  }
  
  async removeUserFromTeam(userId: number, teamId: number): Promise<boolean> {
    const key = `${userId}-${teamId}`;
    return this.userTeams.delete(key);
  }
  
  async getUserTeams(userId: number): Promise<Team[]> {
    // Find all userTeam entries for this user
    const userTeamEntries = Array.from(this.userTeams.values())
      .filter(ut => ut.userId === userId);
    
    // Get the teams
    const teamIds = userTeamEntries.map(ut => ut.teamId);
    return Array.from(this.teams.values())
      .filter(team => teamIds.includes(team.id));
  }

  // Call methods
  async getCallByTaalkUID(taalkUID: string): Promise<Call | undefined> {
    return Array.from(this.callsData.values()).find(
      (call) => call.taalkUID === taalkUID
    );
  }

  // Call methods
  async getCalls(limit: number, offset: number, filters?: CallFilters, sortOptions?: { column: string, direction: 'asc' | 'desc' }): Promise<Call[]> {
    let calls = Array.from(this.callsData.values());
    
    // Apply filters if provided
    if (filters) {
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        calls = calls.filter(call => 
          call.phone.toLowerCase().includes(searchTerm) ||
          call.firstName.toLowerCase().includes(searchTerm) ||
          call.lastName.toLowerCase().includes(searchTerm) ||
          call.taalkUID.toLowerCase().includes(searchTerm) ||
          (call.agentName && call.agentName.toLowerCase().includes(searchTerm))
        );
      }

      // Specific phone search
      if (filters.phoneSearch) {
        const phoneSearchTerm = filters.phoneSearch.toLowerCase();
        calls = calls.filter(call => 
          call.phone.toLowerCase().includes(phoneSearchTerm)
        );
      }
      
      // Specific agent name search
      if (filters.agentSearch) {
        const agentSearchTerm = filters.agentSearch.toLowerCase();
        calls = calls.filter(call => 
          call.agentName && call.agentName.toLowerCase().includes(agentSearchTerm)
        );
      }
      
      if (filters.status) {
        calls = calls.filter(call => call.status === filters.status);
      }
      
      if (filters.agent) {
        calls = calls.filter(call => call.agentName === filters.agent);
      }
      
      if (filters.isFlagged !== undefined) {
        calls = calls.filter(call => call.isFlagged === filters.isFlagged);
      }
      
      if (filters.premiumMin !== undefined) {
        calls = calls.filter(call => parseFloat(call.monthlyPremium as any) >= filters.premiumMin!);
      }
      
      if (filters.premiumMax !== undefined) {
        calls = calls.filter(call => parseFloat(call.monthlyPremium as any) <= filters.premiumMax!);
      }
      
      if (filters.dateRange) {
        const now = new Date();
        let startDate: Date;
        
        switch(filters.dateRange) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            calls = calls.filter(call => call.callDate && call.callDate >= startDate);
            break;
          case 'yesterday':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            startDate.setDate(startDate.getDate() - 1);
            const endYesterday = new Date(now.setHours(23, 59, 59, 999));
            calls = calls.filter(call => 
              call.callDate && call.callDate >= startDate && call.callDate <= endYesterday
            );
            break;
          case 'thisweek':
            const dayOfWeek = now.getDay();
            startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
            startDate.setHours(0, 0, 0, 0);
            calls = calls.filter(call => call.callDate && call.callDate >= startDate);
            break;
          case 'lastweek':
            const currentDayOfWeek = now.getDay();
            const lastWeekStart = new Date(now.setDate(now.getDate() - currentDayOfWeek - 7));
            lastWeekStart.setHours(0, 0, 0, 0);
            const lastWeekEnd = new Date(now.setDate(lastWeekStart.getDate() + 6));
            lastWeekEnd.setHours(23, 59, 59, 999);
            calls = calls.filter(call => 
              call.callDate && call.callDate >= lastWeekStart && call.callDate <= lastWeekEnd
            );
            break;
          case 'thismonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            calls = calls.filter(call => call.callDate && call.callDate >= startDate);
            break;
        }
      }
    }
    
    // Apply sorting if provided
    if (sortOptions) {
      const { column, direction } = sortOptions;
      
      calls.sort((a, b) => {
        let valueA: any;
        let valueB: any;
        
        // Handle special case for callDuration which requires time string comparison
        if (column === 'callDuration') {
          // Convert MM:SS format to seconds for comparison
          const timeToSeconds = (timeStr: string | null): number => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':');
            if (parts.length === 2) {
              return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return 0;
          };
          
          valueA = timeToSeconds(a.callDuration);
          valueB = timeToSeconds(b.callDuration);
        } else {
          // For other columns, just get the value directly
          valueA = (a as any)[column];
          valueB = (b as any)[column];
          
          // Handle different data types
          if (typeof valueA === 'string' && typeof valueB === 'string') {
            return direction === 'asc' 
              ? valueA.localeCompare(valueB) 
              : valueB.localeCompare(valueA);
          }
        }
        
        // For numbers, dates, and other comparable types
        if (direction === 'asc') {
          return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
        } else {
          return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
        }
      });
    } else {
      // Default sort by createdAt (most recent first)
      calls.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    
    // Apply pagination
    return calls.slice(offset, offset + limit);
  }

  async getCallById(id: number): Promise<Call | undefined> {
    return this.callsData.get(id);
  }

  async getCallByPhone(phone: string): Promise<Call[]> {
    return Array.from(this.callsData.values()).filter(
      (call) => call.phone.includes(phone)
    );
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const id = this.callCurrentId++;
    const call: Call = { 
      ...insertCall, 
      id, 
      createdAt: new Date(),
      // Ensure required fields have default values
      status: insertCall.status || 'pending',
      recordingUrl: insertCall.recordingUrl || null,
      transcriptionText: insertCall.transcriptionText || null,
      screenshotUrl: insertCall.screenshotUrl || null,
      callDuration: insertCall.callDuration || null,
      isFlagged: insertCall.isFlagged ?? false, // Use nullish coalescing to handle undefined
      flagReason: insertCall.flagReason || null,
      agentName: insertCall.agentName || null,
      notes: insertCall.notes || null,
      // Add teamId and agentId with default values if not provided
      teamId: insertCall.teamId || null,
      agentId: insertCall.agentId || null,
      // Ensure phone, firstName, lastName, monthlyPremium, and taalkUID exist as they're required
      phone: insertCall.phone,
      firstName: insertCall.firstName,
      lastName: insertCall.lastName, 
      monthlyPremium: insertCall.monthlyPremium,
      taalkUID: insertCall.taalkUID,
    };
    this.callsData.set(id, call);
    return call;
  }

  async updateCall(id: number, updateData: Partial<InsertCall>): Promise<Call | undefined> {
    const call = this.callsData.get(id);
    if (!call) return undefined;
    
    const updatedCall = { ...call, ...updateData };
    this.callsData.set(id, updatedCall);
    return updatedCall;
  }

  async deleteCall(id: number): Promise<boolean> {
    return this.callsData.delete(id);
  }

  async getTotalCalls(filters?: CallFilters): Promise<number> {
    // Get all calls matching the filters (without pagination)
    const calls = await this.getCalls(Number.MAX_SAFE_INTEGER, 0, filters);
    return calls.length;
  }
  
  // Additional methods for team-based access control
  async getCallsByAgent(agentId: number): Promise<Call[]> {
    return Array.from(this.callsData.values())
      .filter(call => call.agentId === agentId);
  }
  
  async getCallsByTeam(teamId: number, includeSubteams: boolean): Promise<Call[]> {
    if (!includeSubteams) {
      // Just get calls for this team
      return Array.from(this.callsData.values())
        .filter(call => call.teamId === teamId);
    }
    
    // Get team hierarchy
    const teamHierarchy = await this.getTeamHierarchy(teamId);
    const teamIds = teamHierarchy.map(team => team.id);
    
    // Get calls for all teams in the hierarchy
    return Array.from(this.callsData.values())
      .filter(call => call.teamId && teamIds.includes(call.teamId));
  }
  
  async canUserAccessCall(userId: number, callId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    const call = await this.getCallById(callId);
    
    if (!user || !call) return false;
    
    // SuperAdmin has visibility to everything
    if (user.role === "SUPER_ADMIN") {
      return true;
    }
    
    // Admin and Quality Manager can access all calls
    if (user.role === "ADMIN" || user.role === "QUALITY_MANAGER") {
      return true;
    }
    
    // Agents can only access their own calls
    if (user.role === "AGENT" && call.agentId === userId) {
      return true;
    }
    
    // For hierarchical roles, check team hierarchy
    if (["PARTNER", "RGA", "MGA", "GA", "SA"].includes(user.role)) {
      // If the call has no team or the user has no team, deny access
      if (!call.teamId || !user.teamId) return false;
      
      // Get the teams this user can access (current team and subordinate teams)
      const userTeam = await this.getTeam(user.teamId);
      if (!userTeam) return false;
      
      const accessibleTeams = await this.getTeamHierarchy(userTeam.id);
      const accessibleTeamIds = accessibleTeams.map(team => team.id);
      
      // Allow access if the call's team is in the accessible teams list
      return accessibleTeamIds.includes(call.teamId);
    }
    
    // Default to deny access
    return false;
  }
  
  async getAccessibleCallsForUser(
    userId: number, 
    limit: number, 
    offset: number, 
    filters?: CallFilters
  ): Promise<Call[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    
    // Get all calls, applying any filters
    let calls = await this.getCalls(Number.MAX_SAFE_INTEGER, 0, filters);
    
    // Filter for access control based on role
    if (user.role === "SUPER_ADMIN") {
      // Super Admin has visibility to everything, no filtering needed
    } else if (user.role === "ADMIN" || user.role === "QUALITY_MANAGER") {
      // These roles can see all calls, no filtering needed
    } else if (user.role === "AGENT") {
      // Agents can only see their own calls
      calls = calls.filter(call => call.agentId === userId);
    } else if (["PARTNER", "RGA", "MGA", "GA", "SA"].includes(user.role) && user.teamId) {
      // These roles can see calls from their own team and subordinate teams
      const accessibleTeams = await this.getTeamHierarchy(user.teamId);
      const accessibleTeamIds = accessibleTeams.map(team => team.id);
      calls = calls.filter(call => call.teamId && accessibleTeamIds.includes(call.teamId));
    } else {
      // Default to no access
      calls = [];
    }
    
    // Apply pagination to the filtered results
    return calls.slice(offset, offset + limit);
  }
  
  async getTotalAccessibleCallsForUser(userId: number, filters?: CallFilters): Promise<number> {
    const calls = await this.getAccessibleCallsForUser(userId, Number.MAX_SAFE_INTEGER, 0, filters);
    return calls.length;
  }
}

import { db } from "./db";
import { eq, like, gte, lte, and, or, desc, asc } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      tableName: 'sessions',
      createTableIfMissing: true 
    });
  }
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // Ensure we're using the correct role type
      const roleValue = insertUser.role as z.infer<typeof RoleType>;
      
      // Create new user with properly typed role value
      const [user] = await db
        .insert(users)
        .values({ 
          ...insertUser,
          role: roleValue,
          teamId: insertUser.teamId || null,
          managerId: insertUser.managerId || null
        })
        .returning();
      
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async getUsersByRole(role: Role): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }
  
  async getUsersByTeam(teamId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.teamId, teamId));
  }
  
  async getUserSubordinates(managerId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.managerId, managerId));
  }
  
  async getTeam(id: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }
  
  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }
  
  async updateTeam(id: number, teamData: Partial<InsertTeam>): Promise<Team | undefined> {
    const [updatedTeam] = await db
      .update(teams)
      .set(teamData)
      .where(eq(teams.id, id))
      .returning();
    return updatedTeam;
  }
  
  async deleteTeam(id: number): Promise<boolean> {
    const result = await db
      .delete(teams)
      .where(eq(teams.id, id))
      .returning();
    return result.length > 0;
  }
  
  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }
  
  async getTeamsByParent(parentTeamId: number): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.parentTeamId, parentTeamId));
  }
  
  async getTeamHierarchy(teamId: number): Promise<Team[]> {
    // Get the requested team
    const rootTeam = await this.getTeam(teamId);
    if (!rootTeam) return [];
    
    // Get all teams (we'll filter them)
    const allTeams = await this.getAllTeams();
    
    // Function to recursively get child teams
    const getChildTeams = (parentId: number, allTeamsList: Team[]): Team[] => {
      const childTeams = allTeamsList.filter(t => t.parentTeamId === parentId);
      let result: Team[] = [...childTeams];
      
      for (const child of childTeams) {
        result = [...result, ...getChildTeams(child.id, allTeamsList)];
      }
      
      return result;
    };
    
    return [rootTeam, ...getChildTeams(teamId, allTeams)];
  }
  
  async addUserToTeam(userId: number, teamId: number): Promise<UserTeam> {
    const [userTeam] = await db
      .insert(userTeams)
      .values({ userId, teamId })
      .returning();
    return userTeam;
  }
  
  async removeUserFromTeam(userId: number, teamId: number): Promise<boolean> {
    const result = await db
      .delete(userTeams)
      .where(and(eq(userTeams.userId, userId), eq(userTeams.teamId, teamId)))
      .returning();
    return result.length > 0;
  }
  
  async getUserTeams(userId: number): Promise<Team[]> {
    const userTeamsEntries = await db
      .select()
      .from(userTeams)
      .where(eq(userTeams.userId, userId));
    
    if (userTeamsEntries.length === 0) return [];
    
    const teamIds = userTeamsEntries.map(ut => ut.teamId);
    return await db
      .select()
      .from(teams)
      .where(
        teamIds.map(id => eq(teams.id, id)).reduce((acc, curr) => or(acc, curr))
      );
  }

  async getCalls(limit: number, offset: number, filters?: CallFilters, sortOptions?: { column: string, direction: 'asc' | 'desc' }): Promise<Call[]> {
    console.log("Getting calls with filters:", JSON.stringify(filters, null, 2));
    let query = db.select().from(calls);
    
    if (filters) {
      const conditions = [];
      
      if (filters.search) {
        // Convert search term to lowercase and trim whitespace
        const searchInput = filters.search.toLowerCase().trim();
        const searchTerm = `%${searchInput}%`;
        console.log("Searching with term:", searchInput, "SQL pattern:", searchTerm);
        
        // Special case: if the search term is a number, we might be searching for an ID directly
        if (/^\d+$/.test(searchInput)) {
          const numericSearchTerm = parseInt(searchInput, 10);
          console.log("Detected numeric search - also searching for ID:", numericSearchTerm);
          
          // First try direct ID match
          try {
            // First check if this ID exists
            const idExists = await db.select({ exists: sql`count(*) > 0` }).from(calls).where(sql`id = ${numericSearchTerm}`);
            console.log("ID exists check:", idExists);
            
            if (idExists[0].exists) {
              console.log("Found exact ID match, using that directly");
              return await db.select().from(calls).where(sql`id = ${numericSearchTerm}`);
            }
          } catch (err) {
            console.error("Error in direct ID search:", err);
          }
        }
        
        // Regular search if not ID or ID not found
        console.log("Performing regular pattern-based search");
        conditions.push(
          or(
            sql`LOWER(phone) LIKE ${searchTerm}`,
            sql`LOWER(first_name) LIKE ${searchTerm}`,
            sql`LOWER(last_name) LIKE ${searchTerm}`,
            sql`LOWER(taalkuid) LIKE ${searchTerm}`,
            sql`LOWER(agent_name) LIKE ${searchTerm}`,
            sql`CAST(id AS TEXT) = ${searchInput}`  // Exact match for ID as string
          )
        );
      }
      
      // Specific phone search
      if (filters.phoneSearch) {
        const phoneInput = filters.phoneSearch.toLowerCase().trim();
        const phoneSearchTerm = `%${phoneInput}%`;
        console.log("Phone search with term:", phoneInput);
        conditions.push(sql`LOWER(phone) LIKE ${phoneSearchTerm}`);
      }
      
      // Specific agent name search
      if (filters.agentSearch) {
        const agentInput = filters.agentSearch.toLowerCase().trim();
        const agentSearchTerm = `%${agentInput}%`;
        console.log("Agent search with term:", agentInput);
        conditions.push(sql`LOWER(agent_name) LIKE ${agentSearchTerm}`);
      }
      
      if (filters.status) {
        conditions.push(sql`status = ${filters.status}`);
      }
      
      if (filters.agent) {
        conditions.push(sql`agent_name = ${filters.agent}`);
      }
      
      if (filters.isFlagged !== undefined) {
        conditions.push(sql`is_flagged = ${filters.isFlagged}`);
      }
      
      if (filters.office) {
        console.log("Applying office filter:", filters.office);
        // Only show calls that exactly match the user's office (exclude NULL offices)
        conditions.push(sql`office = ${filters.office}`);
      }
      
      if (filters.premiumMin !== undefined) {
        // For monetary values stored as text, we need to convert to a comparable format
        conditions.push(sql`CAST(monthly_premium AS NUMERIC) >= ${filters.premiumMin}`);
      }
      
      if (filters.premiumMax !== undefined) {
        // For monetary values stored as text, we need to convert to a comparable format
        conditions.push(sql`CAST(monthly_premium AS NUMERIC) <= ${filters.premiumMax}`);
      }
      
      if (filters.dateRange) {
        const now = new Date();
        let startDate: Date;
        
        switch(filters.dateRange) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            conditions.push(sql`call_date >= ${startDate.toISOString()}`);
            break;
          case 'yesterday':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            startDate.setDate(startDate.getDate() - 1);
            const endYesterday = new Date(startDate);
            endYesterday.setHours(23, 59, 59, 999);
            conditions.push(
              sql`call_date >= ${startDate.toISOString()} AND call_date <= ${endYesterday.toISOString()}`
            );
            break;
          case 'thisweek':
            const dayOfWeek = now.getDay();
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            conditions.push(sql`call_date >= ${startDate.toISOString()}`);
            break;
          case 'lastweek':
            const currentDayOfWeek = now.getDay();
            const lastWeekStart = new Date(now);
            lastWeekStart.setDate(now.getDate() - currentDayOfWeek - 7);
            lastWeekStart.setHours(0, 0, 0, 0);
            const lastWeekEnd = new Date(lastWeekStart);
            lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
            lastWeekEnd.setHours(23, 59, 59, 999);
            conditions.push(
              sql`call_date >= ${lastWeekStart.toISOString()} AND call_date <= ${lastWeekEnd.toISOString()}`
            );
            break;
          case 'thismonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            conditions.push(sql`call_date >= ${startDate.toISOString()}`);
            break;
        }
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    // Apply sorting (with support for custom sorting)
    if (sortOptions) {
      const { column, direction } = sortOptions;
      
      // Handle different columns
      if (column === 'callDuration') {
        // For call duration, we need to get the results and sort them in memory
        // because SQL can't easily sort MM:SS format strings properly
        let results = await query;
        
        // Sort based on call duration
        results.sort((a, b) => {
          // Convert MM:SS format to seconds for comparison
          const timeToSeconds = (timeStr: string | null): number => {
            if (!timeStr) return 0;
            const parts = timeStr.split(':');
            if (parts.length === 2) {
              return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return 0;
          };
          
          const durationA = timeToSeconds(a.callDuration);
          const durationB = timeToSeconds(b.callDuration);
          
          if (direction === 'asc') {
            return durationA - durationB;
          } else {
            return durationB - durationA;
          }
        });
        
        // Apply pagination in memory
        return results.slice(offset, offset + limit);
      } else {
        // For other columns, use SQL ordering
        const columnRef = (calls as any)[column];
        if (columnRef) {
          if (direction === 'asc') {
            query = query.orderBy(asc(columnRef));
          } else {
            query = query.orderBy(desc(columnRef));
          }
        } else {
          // Default to createdAt if column not found
          query = query.orderBy(desc(calls.createdAt));
        }
      }
    } else {
      // Default sort by call_date (most recent calls first)
      query = query.orderBy(desc(calls.callDate));
    }
    
    // Apply pagination for SQL-based sorting
    if (sortOptions?.column !== 'callDuration') {
      query = query.limit(limit).offset(offset);
      return await query;
    } else {
      // For callDuration sorting, we've already handled pagination and returned results
      return []; // This line is never reached for callDuration sorting
    }
  }

  async getCallById(id: number): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return call || undefined;
  }

  async getCallByPhone(phone: string): Promise<Call[]> {
    return await db.select().from(calls).where(like(calls.phone, `%${phone}%`));
  }
  
  async getCallByTaalkUID(taalkUID: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.taalkUID, taalkUID));
    return call || undefined;
  }

  async getCallByHpproId(hpproId: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.hpproId, hpproId));
    return call || undefined;
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    // Ensure required fields have default values
    const callData = {
      ...insertCall,
      status: insertCall.status || 'pending',
      recordingUrl: insertCall.recordingUrl || null,
      transcriptionText: insertCall.transcriptionText || null,
      screenshotUrl: insertCall.screenshotUrl || null,
      callDuration: insertCall.callDuration || null,
      isFlagged: insertCall.isFlagged ?? false, // Use nullish coalescing to handle undefined
      flagReason: insertCall.flagReason || null,
      // Add teamId and agentId with default values if not provided
      teamId: insertCall.teamId || null,
      agentId: insertCall.agentId || null,
    };
    
    const [call] = await db.insert(calls).values(callData).returning();
    return call;
  }

  async updateCall(id: number, updateData: Partial<InsertCall>): Promise<Call | undefined> {
    const [updatedCall] = await db
      .update(calls)
      .set(updateData)
      .where(eq(calls.id, id))
      .returning();
    return updatedCall;
  }

  async deleteCall(id: number): Promise<boolean> {
    try {
      await db.delete(calls).where(eq(calls.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting call:', error);
      return false;
    }
  }

  async getTotalCalls(filters?: CallFilters): Promise<number> {
    // For simplicity, since we're having issues with the count function in drizzle,
    // let's get all calls matching the filter and count them in JavaScript
    let result = await this.getCalls(1000, 0, filters);
    return result.length;
  }
  
  async getCallsByAgent(agentId: number): Promise<Call[]> {
    return await db.select().from(calls).where(eq(calls.agentId, agentId));
  }
  
  async getCallsByTeam(teamId: number, includeSubteams: boolean): Promise<Call[]> {
    if (!includeSubteams) {
      // Just get calls directly assigned to this team
      return await db.select().from(calls).where(eq(calls.teamId, teamId));
    }
    
    // Get this team and all child teams
    const teamHierarchy = await this.getTeamHierarchy(teamId);
    const teamIds = teamHierarchy.map(t => t.id);
    
    if (teamIds.length === 0) return [];
    
    // Get calls for all of these teams
    const conditions = teamIds.map(id => eq(calls.teamId, id));
    return await db.select().from(calls).where(
      conditions.reduce((acc, curr) => or(acc, curr))
    );
  }
  
  async canUserAccessCall(userId: number, callId: number): Promise<boolean> {
    // First, get the user
    const user = await this.getUser(userId);
    if (!user) return false;
    
    // Get the call
    const call = await this.getCallById(callId);
    if (!call) return false;
    
    // Super Admin and Quality Manager can access everything
    if (user.role === RoleType.Values.SUPER_ADMIN || user.role === RoleType.Values.QUALITY_MANAGER) {
      return true;
    }
    
    // If user is the agent who made the call
    if (call.agentId === userId) {
      return true;
    }
    
    // If the user is in management role
    if (user.role !== RoleType.Values.AGENT) {
      // Get the user's team and all teams beneath it
      const userTeamHierarchy = await this.getTeamHierarchy(user.teamId!);
      const accessibleTeamIds = userTeamHierarchy.map(t => t.id);
      
      // Check if the call belongs to one of those teams
      if (call.teamId && accessibleTeamIds.includes(call.teamId)) {
        return true;
      }
    }
    
    return false;
  }
  
  async getAccessibleCallsForUser(
    userId: number,
    limit: number,
    offset: number,
    filters?: CallFilters,
    sortOptions?: { column: string, direction: 'asc' | 'desc' }
  ): Promise<Call[]> {
    // First, get the user
    const user = await this.getUser(userId);
    if (!user) return [];
    
    // Super Admin and Quality Manager can see everything
    if (user.role === RoleType.Values.SUPER_ADMIN || user.role === RoleType.Values.QUALITY_MANAGER) {
      return await this.getCalls(limit, offset, filters, sortOptions);
    }
    
    // Agents can only see their own calls
    if (user.role === RoleType.Values.AGENT) {
      const agentFilters = { ...filters, agent: user.username };
      return await this.getCalls(limit, offset, agentFilters, sortOptions);
    }
    
    // Managers can see calls from their hierarchy
    const userTeamHierarchy = await this.getTeamHierarchy(user.teamId!);
    const accessibleTeamIds = userTeamHierarchy.map(t => t.id);
    
    // Get all calls based on supplied filters
    const allCalls = await this.getCalls(1000, 0, filters, sortOptions); // Get a large batch with sorting
    
    // Filter to only accessible calls
    const accessibleCalls = allCalls.filter(call => {
      return call.teamId && accessibleTeamIds.includes(call.teamId);
    });
    
    // Apply pagination in memory
    return accessibleCalls.slice(offset, offset + limit);
  }
  
  async getTotalAccessibleCallsForUser(userId: number, filters?: CallFilters): Promise<number> {
    const calls = await this.getAccessibleCallsForUser(userId, Number.MAX_SAFE_INTEGER, 0, filters);
    return calls.length;
  }
}

// Create and export our DB-backed storage
export const storage = new DatabaseStorage();

// Add sample data initialization function that can be called to seed the database
export async function seedSampleData() {
  // Check if we already have data in the calls table
  const existingCalls = await db.select({ count: sql`count(*)` }).from(calls);
  const callCount = parseInt(existingCalls[0].count.toString());
  
  if (callCount > 0) {
    console.log(`Found ${callCount} existing calls, skipping sample data seeding`);
    return;
  }
  
  console.log("No existing calls found, seeding sample data...");
  
  const sampleCalls: Omit<InsertCall, 'id' | 'createdAt'>[] = [
    {
      taalkUID: "HP202305001", // Adding unique TaalkUID as primary identifier
      phone: "555-123-4567",
      firstName: "John",
      lastName: "Doe",
      monthlyPremium: "124.99",
      status: "approved",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "This call was about a policy renewal. The customer confirmed their details and agreed to renew their policy.",
      isFlagged: false,
      flagReason: null,
      agentName: "Sarah Johnson",
      callDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      callDuration: "08:45",
      teamId: null,
      agentId: null,
    },
    {
      taalkUID: "HP202305002", // Adding unique TaalkUID as primary identifier
      phone: "555-987-6543",
      firstName: "Jane",
      lastName: "Smith",
      monthlyPremium: "248.50",
      status: "flagged",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "This call was about a premium adjustment request. The customer was inquiring about reducing their monthly premium. The agent explained available options and recommended a policy review. The call was marked as requiring follow-up.",
      isFlagged: true,
      flagReason: "Compliance issue detected",
      agentName: "David Lee",
      callDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      callDuration: "12:35",
      teamId: null,
      agentId: null,
    },
    {
      taalkUID: "HP202305003", // Adding unique TaalkUID as primary identifier
      phone: "555-456-7890",
      firstName: "Michael",
      lastName: "Johnson",
      monthlyPremium: "89.99",
      status: "pending",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "Customer called to inquire about coverage details. Agent provided explanation of policy terms and recommended additional coverage options.",
      isFlagged: false,
      flagReason: null,
      agentName: "Emily Wilson",
      callDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      callDuration: "05:22",
      teamId: null,
      agentId: null,
    },
    {
      taalkUID: "HP202305004", // Adding unique TaalkUID as primary identifier
      phone: "555-789-0123",
      firstName: "Robert",
      lastName: "Williams",
      monthlyPremium: "175.00",
      status: "rejected",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "Customer called with billing concerns. Agent reviewed account and explained recent charges. Customer requested additional documentation.",
      isFlagged: false,
      flagReason: null,
      agentName: "Michelle Garcia",
      callDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      callDuration: "09:17",
      teamId: null,
      agentId: null,
    },
    {
      taalkUID: "HP202305005", // Adding unique TaalkUID as primary identifier
      phone: "555-222-3333",
      firstName: "Elizabeth",
      lastName: "Taylor",
      monthlyPremium: "195.75",
      status: "approved",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "Customer called to add a dependent to their policy. Agent confirmed the details and processed the request successfully.",
      isFlagged: false,
      flagReason: null,
      agentName: "James Wilson",
      callDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      callDuration: "11:05",
      teamId: null,
      agentId: null,
    },
    {
      taalkUID: "HP202305006", // Adding unique TaalkUID as primary identifier
      phone: "555-444-5555",
      firstName: "Thomas",
      lastName: "Anderson",
      monthlyPremium: "76.25",
      status: "pending",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "Customer requested information about switching their policy type. Agent provided details on available options and policy benefits.",
      isFlagged: false,
      flagReason: null,
      agentName: "Sarah Johnson",
      callDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      callDuration: "07:22",
      teamId: null,
      agentId: null,
    },
    {
      taalkUID: "HP202305007", // Adding unique TaalkUID as primary identifier
      phone: "555-666-7777",
      firstName: "Maria",
      lastName: "Rodriguez",
      monthlyPremium: "220.00",
      status: "flagged",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "Customer called with concerns about recent policy changes. Agent wasn't able to properly explain the changes, leading to customer frustration.",
      isFlagged: true,
      flagReason: "Customer service issues",
      agentName: "David Lee",
      callDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      callDuration: "15:40",
      teamId: null,
      agentId: null,
    },
    {
      taalkUID: "HP202305008", // Adding unique TaalkUID as primary identifier
      phone: "555-888-9999",
      firstName: "Richard",
      lastName: "Brown",
      monthlyPremium: "134.50",
      status: "rejected",
      recordingUrl: "/sample-recording.mp3",
      transcriptionText: "Customer requested cancellation of their policy. Agent attempted to retain the customer but was unsuccessful. Cancellation was processed.",
      isFlagged: false,
      flagReason: null,
      agentName: "Michelle Garcia",
      callDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      callDuration: "10:15",
      teamId: null,
      agentId: null,
    }
  ];
  
  try {
    // Delete existing data
    await db.delete(calls);
    
    // Insert new sample data
    for (const call of sampleCalls) {
      await db.insert(calls).values(call);
    }
    console.log('Sample data seeded successfully');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
}
