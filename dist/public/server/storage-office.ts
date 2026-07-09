import { 
  users, teams, userTeams, calls, offices,
  type User, type InsertUser, 
  type Team, type InsertTeam, 
  type UserTeam, type Call, type InsertCall,
  type Office, type InsertOffice,
  type Role, RoleType
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, asc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

export interface CallFilters {
  search?: string;
  status?: string;
  isFlagged?: boolean;
  office?: string;
  agentName?: string;
  startDate?: string;
  endDate?: string;
}

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // Office management methods
  async getOffice(id: number): Promise<Office | undefined> {
    const [office] = await db.select().from(offices).where(eq(offices.id, id));
    return office || undefined;
  }

  async getOfficeByName(name: string): Promise<Office | undefined> {
    const [office] = await db.select().from(offices).where(eq(offices.name, name));
    return office || undefined;
  }

  async createOffice(office: InsertOffice): Promise<Office> {
    const [newOffice] = await db.insert(offices).values(office).returning();
    return newOffice;
  }

  async updateOffice(id: number, officeData: Partial<InsertOffice>): Promise<Office | undefined> {
    const [updatedOffice] = await db
      .update(offices)
      .set({ ...officeData, updatedAt: new Date() })
      .where(eq(offices.id, id))
      .returning();
    return updatedOffice || undefined;
  }

  async deleteOffice(id: number): Promise<boolean> {
    const result = await db.delete(offices).where(eq(offices.id, id));
    return result.rowCount > 0;
  }

  async getAllOffices(): Promise<Office[]> {
    return await db.select().from(offices).orderBy(offices.name);
  }

  async getUsersByOffice(office: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.office, office));
  }

  // User management with office support
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByRole(role: Role): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  // Call management with office filtering
  async getCalls(
    limit: number, 
    offset: number, 
    filters?: CallFilters, 
    sortOptions?: { column: string, direction: 'asc' | 'desc' }
  ): Promise<Call[]> {
    let query = db.select().from(calls);

    // Apply filters
    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        or(
          like(calls.firstName, `%${filters.search}%`),
          like(calls.lastName, `%${filters.search}%`),
          like(calls.phone, `%${filters.search}%`),
          like(calls.agentName, `%${filters.search}%`)
        )
      );
    }

    if (filters?.status) {
      conditions.push(eq(calls.status, filters.status));
    }

    if (filters?.isFlagged !== undefined) {
      conditions.push(eq(calls.isFlagged, filters.isFlagged));
    }

    if (filters?.office) {
      conditions.push(eq(calls.office, filters.office));
    }

    if (filters?.agentName) {
      conditions.push(like(calls.agentName, `%${filters.agentName}%`));
    }

    // Always filter to only show calls over 120 seconds (2:00)
    // Duration is stored as MM:SS format, so we need to convert and filter
    const durationCondition = sql`
      CASE 
        WHEN ${calls.callDuration} IS NULL THEN false
        WHEN length(${calls.callDuration}) = 5 THEN 
          (cast(split_part(${calls.callDuration}, ':', 1) as integer) * 60 + 
           cast(split_part(${calls.callDuration}, ':', 2) as integer)) > 120
        ELSE false
      END
    `;
    conditions.push(durationCondition);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    if (sortOptions) {
      const column = calls[sortOptions.column as keyof typeof calls];
      if (column) {
        query = query.orderBy(sortOptions.direction === 'desc' ? desc(column) : asc(column));
      }
    } else {
      query = query.orderBy(desc(calls.createdAt));
    }

    return await query.limit(limit).offset(offset);
  }

  async getCallsByOffice(office: string): Promise<Call[]> {
    return await db.select().from(calls).where(eq(calls.office, office));
  }

  async getCallById(id: number): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return call || undefined;
  }

  async getCallByTaalkUID(taalkUID: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.taalkUID, taalkUID));
    return call || undefined;
  }

  async createCall(call: InsertCall): Promise<Call> {
    const [newCall] = await db.insert(calls).values(call).returning();
    return newCall;
  }

  async updateCall(id: number, call: Partial<InsertCall>): Promise<Call | undefined> {
    const [updatedCall] = await db
      .update(calls)
      .set(call)
      .where(eq(calls.id, id))
      .returning();
    return updatedCall || undefined;
  }

  async deleteCall(id: number): Promise<boolean> {
    const result = await db.delete(calls).where(eq(calls.id, id));
    return result.rowCount > 0;
  }

  async getTotalCalls(filters?: CallFilters): Promise<number> {
    let query = db.select({ count: sql`count(*)` }).from(calls);

    const conditions = [];
    
    if (filters?.search) {
      conditions.push(
        or(
          like(calls.firstName, `%${filters.search}%`),
          like(calls.lastName, `%${filters.search}%`),
          like(calls.phone, `%${filters.search}%`),
          like(calls.agentName, `%${filters.agentName}%`)
        )
      );
    }

    if (filters?.status) {
      conditions.push(eq(calls.status, filters.status));
    }

    if (filters?.isFlagged !== undefined) {
      conditions.push(eq(calls.isFlagged, filters.isFlagged));
    }

    if (filters?.office) {
      conditions.push(eq(calls.office, filters.office));
    }

    // Always filter to only count calls over 120 seconds (2:00)
    const durationCondition = sql`
      CASE 
        WHEN ${calls.callDuration} IS NULL THEN false
        WHEN length(${calls.callDuration}) = 5 THEN 
          (cast(split_part(${calls.callDuration}, ':', 1) as integer) * 60 + 
           cast(split_part(${calls.callDuration}, ':', 2) as integer)) > 120
        ELSE false
      END
    `;
    conditions.push(durationCondition);

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [result] = await query;
    return Number(result.count);
  }

  // Stub methods for team functionality (can be implemented later)
  async getTeam(id: number): Promise<Team | undefined> { return undefined; }
  async createTeam(team: InsertTeam): Promise<Team> { throw new Error("Not implemented"); }
  async updateTeam(id: number, teamData: Partial<InsertTeam>): Promise<Team | undefined> { return undefined; }
  async deleteTeam(id: number): Promise<boolean> { return false; }
  async getAllTeams(): Promise<Team[]> { return []; }
  async getTeamsByParent(parentTeamId: number): Promise<Team[]> { return []; }
  async getTeamHierarchy(teamId: number): Promise<Team[]> { return []; }
  async addUserToTeam(userId: number, teamId: number): Promise<UserTeam> { throw new Error("Not implemented"); }
  async removeUserFromTeam(userId: number, teamId: number): Promise<boolean> { return false; }
  async getUserTeams(userId: number): Promise<Team[]> { return []; }
  async getCallByPhone(phone: string): Promise<Call[]> { return []; }
  async getCallsByAgent(agentId: number): Promise<Call[]> { return []; }
  async getCallsByTeam(teamId: number, includeSubteams: boolean): Promise<Call[]> { return []; }
  async getUserSubordinates(managerId: number): Promise<User[]> { return []; }
  async getUsersByTeam(teamId: number): Promise<User[]> { return []; }

  async canUserAccessCall(userId: number, callId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    const call = await this.getCallById(callId);
    
    if (!user || !call) return false;
    
    // SUPER_ADMIN can access everything
    if (user.role === "SUPER_ADMIN") {
      return true;
    }
    
    // All other users can only access calls from their assigned office
    if (user.office && call.office) {
      return user.office === call.office;
    }
    
    return false;
  }
}

export const storage = new DatabaseStorage();