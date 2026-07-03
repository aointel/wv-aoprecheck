import { db } from './db';
import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { HARDCODED_CONFIG } from './hardcoded-config';
import { 
  connectnowUsers, 
  teams, 
  roles, 
  callLogs, 
  vdpCalls, 
  userGameStats,
  userCredits,
  type ConnectNowUser,
  type Team,
  type Role,
  type CallLog,
  type VdpCall,
  type UserGameStats
} from '@shared/schema';
import { eq, desc, and, count, avg, sum, gte, lt } from 'drizzle-orm';

export class ConnectNowService {
  private creditsQueryPausedUntil = 0;
  private creditsWarned = false;
  private static readonly CREDITS_QUERY_COOLDOWN_MS = 15_000;

  private buildEmptyCredits(email: string) {
    return {
      credits_remaining: 0,
      credits_used: 0,
      credits_purchased: 0,
      associate_id: 0,
      aoi_connect_credits_used: 0,
      aoi_plus_credits_used: 0,
      aoi_precheck_credits_used: 0,
      aoi_recruit_credits_used: 0,
      name: 'No Data',
      email,
    };
  }

  private isCreditsInfraError(err: unknown): boolean {
    const raw = String((err as any)?.message || err || '').toLowerCase();
    const code = String((err as any)?.code || '').toUpperCase();
    return (
      code === '42P01' ||
      raw.includes('relation "user_credits" does not exist') ||
      raw.includes('timeout exceeded when trying to connect') ||
      raw.includes('query read timeout') ||
      raw.includes('query timeout')
    );
  }

  private pauseCreditsLookup(reason: unknown) {
    this.creditsQueryPausedUntil = Date.now() + ConnectNowService.CREDITS_QUERY_COOLDOWN_MS;
    if (!this.creditsWarned) {
      this.creditsWarned = true;
      console.warn(
        '⚠️ Credits lookup temporarily paused (cooldown):',
        reason instanceof Error ? reason.message : String(reason),
      );
    }
  }

  // Call Management
  async createCallLog(callData: {
    userId: string;
    sessionId?: string;
    callType: string;
    duration?: number;
    status: string;
    phoneNumber?: string;
    notes?: string;
  }): Promise<CallLog> {
    const [callLog] = await db
      .insert(callLogs)
      .values(callData)
      .returning();
    return callLog;
  }

  // User Management
  async createUser(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    supabaseUserId?: string;
    teamId?: string;
    roleId?: string;
    isAdmin?: boolean;
  }): Promise<ConnectNowUser> {
    const [user] = await db
      .insert(connectnowUsers)
      .values(userData)
      .returning();

    // Initialize user credits
    await db
      .insert(userCredits)
      .values({
        email: userData.email,
        creditsRemaining: 100, // Starting credits
      })
      .onConflictDoNothing();

    // Initialize game stats
    await db
      .insert(userGameStats)
      .values({
        userId: user.id,
      })
      .onConflictDoNothing();

    return user;
  }

  async getUserByEmail(email: string): Promise<ConnectNowUser | undefined> {
    const [user] = await db
      .select()
      .from(connectnowUsers)
      .where(eq(connectnowUsers.email, email));
    return user;
  }

  async getUserBySupabaseId(supabaseUserId: string): Promise<ConnectNowUser | undefined> {
    const [user] = await db
      .select()
      .from(connectnowUsers)
      .where(eq(connectnowUsers.supabaseUserId, supabaseUserId));
    return user;
  }

  async updateUser(userId: string, updates: Partial<ConnectNowUser>): Promise<ConnectNowUser> {
    const [user] = await db
      .update(connectnowUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(connectnowUsers.id, userId))
      .returning();
    return user;
  }

  // Team Management
  async createTeam(teamData: {
    name: string;
    description?: string;
    managerId?: string;
  }): Promise<Team> {
    const [team] = await db
      .insert(teams)
      .values(teamData)
      .returning();
    return team;
  }

  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.isActive, true));
  }

  async getTeamById(teamId: string): Promise<Team | undefined> {
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));
    return team;
  }

  async getTeamMembers(teamId: string): Promise<ConnectNowUser[]> {
    return await db
      .select()
      .from(connectnowUsers)
      .where(and(
        eq(connectnowUsers.teamId, teamId),
        eq(connectnowUsers.isActive, true)
      ));
  }

  // Role Management
  async createRole(roleData: {
    name: string;
    description?: string;
    permissions?: any[];
  }): Promise<Role> {
    const [role] = await db
      .insert(roles)
      .values(roleData)
      .returning();
    return role;
  }

  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).where(eq(roles.isActive, true));
  }

  // Call Management
  async logCall(callData: {
    userId: string;
    sessionId?: string;
    callType: string;
    duration?: number;
    status: string;
    phoneNumber?: string;
    notes?: string;
  }): Promise<CallLog> {
    const [call] = await db
      .insert(callLogs)
      .values({
        agentEmail: callData.userId,
        twilioCallSid: `ccp-${Date.now()}`,
        toNumber: callData.phoneNumber || '',
        fromNumber: '+19142289324',
        callStatus: callData.status,
        callDuration: callData.duration || 0,
        callStartedAt: new Date(),
        isReached: false,
        isBooked: false
      })
      .returning();

    // Update game stats
    await this.updateUserGameStats(callData.userId, {
      totalCalls: 1,
      successfulCalls: callData.status === 'completed' ? 1 : 0,
    });

    return call;
  }

  async getUserCalls(userId: string, limit = 10): Promise<CallLog[]> {
    return await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(desc(callLogs.createdAt))
      .limit(limit);
  }

  async logVdpCall(callData: {
    userId: string;
    market?: string;
    state?: string;
    leadId?: string;
    status: string;
    duration?: number;
    disposition?: string;
    notes?: string;
  }): Promise<VdpCall> {
    const [call] = await db
      .insert(vdpCalls)
      .values(callData)
      .returning();
    return call;
  }

  // Dashboard Statistics
  async getDashboardStats(userId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // General stats
    const [todayCallsResult] = await db
      .select({ count: count() })
      .from(callLogs)
      .where(eq(callLogs.createdAt, today));

    const [activeAgentsResult] = await db
      .select({ count: count() })
      .from(connectnowUsers)
      .where(eq(connectnowUsers.isActive, true));

    // Success rate calculation
    const [successRateResult] = await db
      .select({
        total: count(),
        successful: count(callLogs.status),
      })
      .from(callLogs)
      .where(eq(callLogs.status, 'completed'));

    const successRate = successRateResult.total > 0 
      ? Math.round((successRateResult.successful / successRateResult.total) * 100)
      : 0;

    // Average call time
    const [avgTimeResult] = await db
      .select({ avgDuration: avg(callLogs.duration) })
      .from(callLogs)
      .where(eq(callLogs.status, 'completed'));

    const avgCallTime = avgTimeResult.avgDuration 
      ? `${Math.floor(Number(avgTimeResult.avgDuration) / 60)}:${(Number(avgTimeResult.avgDuration) % 60).toString().padStart(2, '0')}`
      : '0:00';

    return {
      todayCalls: todayCallsResult.count,
      activeAgents: activeAgentsResult.count,
      successRate,
      avgCallTime,
      callsChange: 0, // Calculate based on yesterday's data
      teamCalls: 0,
      teamSuccessRate: 0,
      teamMembers: 0,
    };
  }

  async getRecentCalls(dateRange = 'today', userId?: string, limit = 10): Promise<CallLog[]> {
    // First try to get calls from Supabase VDP system if available
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = HARDCODED_CONFIG.SUPABASE_URL;
      const supabaseKey = HARDCODED_CONFIG.SUPABASE_ANON_KEY;

      console.log('🔍 Checking Supabase connection for call history...');

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        let query = supabase
          .from('vdp_calls')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (userId) {
          query = query.eq('agent_email', userId);
        }

        const { data: supabaseCalls, error } = await query;
        console.log('📞 Supabase VDP calls query result:', { count: supabaseCalls?.length || 0, error: error?.message });

        // Log the first record to see available columns
        if (supabaseCalls && supabaseCalls.length > 0) {
          console.log('📋 First VDP call record columns:', Object.keys(supabaseCalls[0]));
          console.log('📋 Sample raw_webhook_data:', supabaseCalls[0].raw_webhook_data);
        }



        // Also get AOIntel calls from masterlead
        let aoiIntelCalls: any[] = [];
        if (supabaseAdmin) {
          try {
            const now = new Date();
            let startDate: Date;
            
            switch (dateRange) {
              case 'yesterday':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                break;
              case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
              case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
              case 'all':
                startDate = new Date(0); // Beginning of time
                break;
              default: // today
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            }

            let aoiQuery = masterleadClient.from('masterlead')
              .select('*')
              .eq('cnresolution', 'AOIntel')
              .gte('created_at', startDate.toISOString())
              .order('created_at', { ascending: false })
              .limit(limit);

            if (userId) {
              aoiQuery = aoiQuery.eq('cn_email', userId);
            }

            const { data: aoiCalls, error: aoiError } = await aoiQuery;
            
            if (!aoiError && aoiCalls) {
              console.log(`📞 Found ${aoiCalls.length} AOIntel calls from masterlead`);
              aoiIntelCalls = aoiCalls.map(call => ({
                id: `aoi-${call.id}`,
                agent_email: call.cn_email,
                first_name: call.first_name,
                last_name: call.last_name,
                phone: call.phone,
                phone_number: call.phone,
                caller_phone: call.phone,
                market: call.taalk_market || 'AOIntel',
                state: call.state || call.taalk_state,
                created_at: call.created_at,
                call_status: 'completed',
                call_duration: 0,
                raw_webhook_data: {
                  first_name: call.first_name,
                  last_name: call.last_name,
                  phone: call.phone,
                  clientphone: call.phone,
                  clientmarket: call.taalk_market,
                  clientstate: call.state || call.taalk_state,
                  company_email: call.cn_email,
                  LeadId: call.taalk_lead_id || call.id,
                  lead_id: call.taalk_lead_id || call.id,
                  event: 'AOIntel',
                  call_status: 'completed'
                }
              }));
            }
          } catch (aoiError) {
            console.warn('⚠️ Error fetching AOIntel calls:', aoiError);
          }
        }

        if (!error && supabaseCalls) {
          console.log('✅ Using Supabase VDP calls for call history');
          // Combine VDP calls and AOIntel calls
          const allCalls = [...supabaseCalls, ...aoiIntelCalls];
          
          // Sort by created_at descending and limit
          allCalls.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
          });
          
          // Transform Supabase data to match CallLog interface
          return allCalls.slice(0, limit).map(call => {
            // Parse raw_webhook_data for additional information
            let webhookData: any = {};
            try {
              if (call.raw_webhook_data && typeof call.raw_webhook_data === 'object') {
                webhookData = call.raw_webhook_data;
              } else if (call.raw_webhook_data && typeof call.raw_webhook_data === 'string') {
                webhookData = JSON.parse(call.raw_webhook_data);
              }
            } catch (error) {
              console.log('Error parsing raw_webhook_data:', error);
            }

            // Extract data primarily from raw_webhook_data
            const getName = () => {
              // Try webhook data first since it has the most complete information
              if (webhookData.first_name && webhookData.last_name) {
                return `${webhookData.first_name} ${webhookData.last_name}`.trim();
              }
              if (webhookData.caller_name || webhookData.name) {
                return webhookData.caller_name || webhookData.name;
              }
              // Fallback to direct columns
              if (call.first_name && call.last_name) {
                return `${call.first_name} ${call.last_name}`.trim();
              }
              if (call.notes) {
                return call.notes;
              }
              return 'Unknown Contact';
            };

            const getPhoneNumber = () => {
              return webhookData.clientphone || webhookData.phone || webhookData.phone_number || webhookData.caller_number || 
                     call.phone || call.phone_number || call.caller_phone || 'N/A';
            };

            const getLeadId = () => {
              return webhookData.LeadId || webhookData.lead_id || webhookData.campaign_id || webhookData.id ||
                     call.lead_id || call.session_id || 'N/A';
            };

            const getMarket = () => {
              return webhookData.clientmarket || webhookData.market || webhookData.campaign_type || webhookData.lead_type ||
                     call.market || 'General';
            };

            const getState = () => {
              return webhookData.clientstate || webhookData.state || webhookData.location || webhookData.region ||
                     call.state || 'N/A';
            };

            const getStatus = () => {
              // Map webhook events to status
              if (webhookData.event === 'PICK_UP') return 'answered';
              if (webhookData.event === 'HANG_UP') return 'completed';
              return webhookData.call_status || webhookData.status || webhookData.disposition ||
                     call.call_status || 'completed';
            };

            const getDuration = () => {
              return webhookData.duration || webhookData.call_duration || 
                     call.call_duration || 0;
            };

            // Extract additional fields for detailed view
            const getClientEmail = () => {
              return webhookData.clientemail || webhookData.email || webhookData.client_email || '';
            };

            const getClientCity = () => {
              return webhookData.clientcity || webhookData.city || webhookData.client_city || '';
            };

            const getClientAddress = () => {
              return webhookData.clientaddress || webhookData.address || webhookData.client_address || '';
            };

            const getSecretKey = () => {
              return webhookData.clientsecretkey || webhookData.secret_key || webhookData.secretkey || '';
            };

            const getAssociateId = () => {
              return webhookData.associate_id || webhookData.agent_id || call.campaign_id || '';
            };

            return {
              id: call.id,
              userId: call.agent_email || call.user_email || webhookData.company_email || 'unknown',
              sessionId: getLeadId(),
              callType: 'inbound',
              duration: getDuration(),
              status: getStatus(),
              phoneNumber: getPhoneNumber(),
              notes: getName(),
              market: getMarket(),
              state: getState(),
              createdAt: new Date(call.created_at),
              // Additional fields for detailed view
              clientEmail: getClientEmail(),
              clientCity: getClientCity(),
              clientAddress: getClientAddress(),
              secretKey: getSecretKey(),
              associateId: getAssociateId(),
              rawWebhookData: webhookData // Include raw data for maximum flexibility
            };
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Supabase not available, falling back to PostgreSQL:', error);
    }

    // Fallback to PostgreSQL call_logs table
    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        // No date filter for all time
        if (userId) {
          return await db
            .select()
            .from(callLogs)
            .where(eq(callLogs.userId, userId))
            .orderBy(desc(callLogs.createdAt))
            .limit(limit);
        } else {
          return await db
            .select()
            .from(callLogs)
            .orderBy(desc(callLogs.createdAt))
            .limit(limit);
        }
      default: // today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const endDate = dateRange === 'yesterday' 
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let baseQuery = db
      .select()
      .from(callLogs)
      .where(and(
        gte(callLogs.createdAt, startDate),
        lt(callLogs.createdAt, endDate)
      ))
      .orderBy(desc(callLogs.createdAt))
      .limit(limit);

    if (userId) {
      baseQuery = db
        .select()
        .from(callLogs)
        .where(and(
          gte(callLogs.createdAt, startDate),
          lt(callLogs.createdAt, endDate),
          eq(callLogs.userId, userId)
        ))
        .orderBy(desc(callLogs.createdAt))
        .limit(limit);
    }

    return await baseQuery;
  }

  async getUserStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // For now, return default stats since callLogs table uses agentEmail, not userId
    // TODO: Need to map userId to agentEmail or modify the query approach
    return {
      callsToday: 0,
      callsWeek: 0,
      streak: 0,
    };
  }

  // Experience Management Methods
  async awardUserExperience(userEmail: string, experience: number) {
    try {
      // First check if user exists in Supabase
      const { data: userData } = await supabaseAdmin!
        .from('user-credits')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (userData) {
        // User exists in Supabase, update there
        const { data: updatedUser, error } = await supabaseAdmin!
          .from('user-credits')
          .update({
            total_experience: (userData.total_experience || 0) + experience,
            level: Math.floor(((userData.total_experience || 0) + experience) / 100) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('email', userEmail)
          .select()
          .single();

        if (error) throw error;
        return updatedUser;
      } else {
        // Fallback to local database
        const [user] = await db
          .select()
          .from(connectnowUsers)
          .where(eq(connectnowUsers.email, userEmail));

        if (!user) {
          throw new Error('User not found');
        }

        const [gameStats] = await db
          .select()
          .from(userGameStats)
          .where(eq(userGameStats.userId, user.id));

        const newXp = (gameStats?.xp || 0) + experience;
        const newLevel = Math.floor(newXp / 100) + 1;

        await db
          .update(userGameStats)
          .set({
            xp: newXp,
            level: newLevel,
            updatedAt: new Date()
          })
          .where(eq(userGameStats.userId, user.id));

        return {
          total_experience: newXp,
          level: newLevel,
          experience_to_next_level: 100 - (newXp % 100)
        };
      }
    } catch (error) {
      console.error('Error awarding experience:', error);
      throw error;
    }
  }

  async getUserExperience(userEmail: string) {
    try {
      // First check Supabase
      const { data: userData } = await supabaseAdmin!
        .from('user-credits')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (userData) {
        return {
          total_experience: userData.total_experience || 0,
          level: userData.level || 1,
          experience_to_next_level: 100 - ((userData.total_experience || 0) % 100),
          connects_reviewed: userData.connects_reviewed || 0,
          sales_made: userData.sales_made || 0
        };
      } else {
        // Fallback to local database
        const [user] = await db
          .select()
          .from(connectnowUsers)
          .where(eq(connectnowUsers.email, userEmail));

        if (!user) {
          return null;
        }

        const [gameStats] = await db
          .select()
          .from(userGameStats)
          .where(eq(userGameStats.userId, user.id));

        const xp = gameStats?.xp || 0;
        const level = Math.floor(xp / 100) + 1;

        return {
          total_experience: xp,
          level: level,
          experience_to_next_level: 100 - (xp % 100),
          connects_reviewed: gameStats?.totalCalls || 0,
          sales_made: gameStats?.successfulCalls || 0
        };
      }
    } catch (error) {
      console.error('Error getting user experience:', error);
      return null;
    }
  }

  // Gamification
  async updateUserGameStats(userId: string, updates: {
    totalCalls?: number;
    successfulCalls?: number;
    xp?: number;
  }) {
    const [currentStats] = await db
      .select()
      .from(userGameStats)
      .where(eq(userGameStats.userId, userId));

    if (!currentStats) {
      // Create new stats
      await db
        .insert(userGameStats)
        .values({
          userId,
          totalCalls: updates.totalCalls || 0,
          successfulCalls: updates.successfulCalls || 0,
          xp: updates.xp || 0,
        });
      return;
    }

    // Update existing stats
    const newTotalCalls = (currentStats.totalCalls || 0) + (updates.totalCalls || 0);
    const newSuccessfulCalls = (currentStats.successfulCalls || 0) + (updates.successfulCalls || 0);
    const newXp = (currentStats.xp || 0) + (updates.xp || 0);
    const newLevel = Math.floor(newXp / 1000) + 1;

    await db
      .update(userGameStats)
      .set({
        totalCalls: newTotalCalls,
        successfulCalls: newSuccessfulCalls,
        xp: newXp,
        level: newLevel,
        updatedAt: new Date(),
      })
      .where(eq(userGameStats.userId, userId));
  }

  async getUserGameStats(userId: string): Promise<UserGameStats & { leaderboardPosition?: number } | undefined> {
    const [stats] = await db
      .select()
      .from(userGameStats)
      .where(eq(userGameStats.userId, userId));

    if (!stats) return undefined;

    // Calculate leaderboard position based on XP
    const allUsers = await db
      .select()
      .from(userGameStats)
      .orderBy(desc(userGameStats.xp));

    const leaderboardPosition = allUsers.findIndex(user => user.userId === userId) + 1;

    return {
      ...stats,
      leaderboardPosition
    };
  }

  // Credits Management - RESTORED SUPABASE CREDIT SYSTEM
  /** Short TTL: HeaderToolbar + many routes call this; avoids Supabase stampede under load */
  private creditsByEmailCache = new Map<string, { exp: number; data: any }>();
  private static readonly CREDITS_CACHE_MS = 10_000;

  private bustCreditsCache(email: string) {
    this.creditsByEmailCache.delete(email.toLowerCase().trim());
  }

  async getUserCredits(email: string) {
    const key = email.toLowerCase().trim();
    const hit = this.creditsByEmailCache.get(key);
    if (hit && Date.now() < hit.exp) return hit.data;
    if (Date.now() < this.creditsQueryPausedUntil) {
      const empty = this.buildEmptyCredits(email);
      this.creditsByEmailCache.set(key, { exp: Date.now() + ConnectNowService.CREDITS_CACHE_MS, data: empty });
      return empty;
    }
    // Once cooldown passes, allow a real read attempt again.
    this.creditsWarned = false;

    try {
      // Try Supabase first for real credit data
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('user_credits')
          .select('*')
          .eq('email', email.toLowerCase())
          .single();

        if (!error && data) {
          const row = {
            credits_remaining: data.credits_remaining || 0,
            credits_used: data.credits_used || 0,
            credits_purchased: data.credits_purchased || 0,
            associate_id: data.associate_id || 0,
            aoi_connect_credits_used: data.aoi_connect_credits_used || 0,
            aoi_plus_credits_used: data.aoi_plus_credits_used || 0,
            aoi_precheck_credits_used: data.aoi_precheck_credits_used || 0,
            aoi_recruit_credits_used: data.aoi_recruit_credits_used || 0,
            name: data.name || 'Agent',
            email: email
          };
          this.creditsByEmailCache.set(key, { exp: Date.now() + ConnectNowService.CREDITS_CACHE_MS, data: row });
          return row;
        }

        if (error && this.isCreditsInfraError(error)) {
          this.pauseCreditsLookup(error);
          const empty = this.buildEmptyCredits(email);
          this.creditsByEmailCache.set(key, { exp: Date.now() + ConnectNowService.CREDITS_CACHE_MS, data: empty });
          return empty;
        }

      }

      // Fallback to local database if Supabase unavailable
      const [user] = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.email, email.toLowerCase()));

      if (user) {
        this.creditsByEmailCache.set(key, { exp: Date.now() + ConnectNowService.CREDITS_CACHE_MS, data: user });
        return user;
      }
      const empty = this.buildEmptyCredits(email);
      this.creditsByEmailCache.set(key, { exp: Date.now() + ConnectNowService.CREDITS_CACHE_MS, data: empty });
      return empty;

    } catch (error) {
      if (this.isCreditsInfraError(error)) {
        this.pauseCreditsLookup(error);
        const empty = this.buildEmptyCredits(email);
        this.creditsByEmailCache.set(key, { exp: Date.now() + ConnectNowService.CREDITS_CACHE_MS, data: empty });
        return empty;
      }
      console.error('❌ Exception in disabled credits service:', error);
      return this.buildEmptyCredits(email);
    }
  }

  async awardUserCredits(email: string, creditsToAdd: number) {
    this.bustCreditsCache(email);
    console.log(`🎉 Awarding ${creditsToAdd} credit(s) to ${email} for reviewing connects`);

    // Try Supabase first
    if (supabaseAdmin) {
      try {
        // Get current credits
        const { data: currentData, error: getCurrentError } = await supabaseAdmin
          .from('user_credits')
          .select('*')
          .eq('email', email.toLowerCase())
          .single();

        if (getCurrentError && getCurrentError.code === 'PGRST116') {
          // No record exists, create new one with awarded credits
          const { data, error } = await supabaseAdmin
            .from('user_credits')
            .insert({
              email: email.toLowerCase(),
              credits_remaining: creditsToAdd,
              credits_purchased: creditsToAdd,
              credits_used: 0,
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            console.error('Error creating credit record in Supabase:', error);
            throw error;
          }

          console.log(`✅ Created new credit record with ${creditsToAdd} credits for ${email}`);
          return data;
        }

        if (getCurrentError) {
          console.error('Error getting current credits from Supabase:', getCurrentError);
          throw getCurrentError;
        }

        // Update existing record
        const newCreditsRemaining = (currentData.credits_remaining || 0) + creditsToAdd;
        const newCreditsPurchased = (currentData.credits_purchased || 0) + creditsToAdd;

        const { data, error } = await supabaseAdmin
          .from('user_credits')
          .update({
            credits_remaining: newCreditsRemaining,
            credits_purchased: newCreditsPurchased,
            updated_at: new Date().toISOString()
          })
          .eq('email', email.toLowerCase())
          .select()
          .single();

        if (error) {
          console.error('Error updating credits in Supabase:', error);
          throw error;
        }

        console.log(`✅ Awarded ${creditsToAdd} credits to ${email}, new balance: ${newCreditsRemaining}`);
        return data;

      } catch (error) {
        console.error('Supabase credit award failed, falling back to local database:', error);
      }
    }

    // Fall back to local database
    console.log('Using local database for credit award');
    const [currentCredits] = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.email, email));

    if (!currentCredits) {
      // Create new record
      const [newRecord] = await db
        .insert(userCredits)
        .values({
          email,
          creditsRemaining: creditsToAdd,
          creditsPurchased: creditsToAdd,
          creditsUsed: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      console.log(`✅ Created local credit record with ${creditsToAdd} credits for ${email}`);
      return {
        credits_remaining: newRecord.creditsRemaining,
        credits_purchased: newRecord.creditsPurchased,
        credits_used: newRecord.creditsUsed
      };
    }

    // Update existing record
    const newCreditsRemaining = (currentCredits.creditsRemaining || 0) + creditsToAdd;
    const newCreditsPurchased = (currentCredits.creditsPurchased || 0) + creditsToAdd;

    const [updatedRecord] = await db
      .update(userCredits)
      .set({
        creditsRemaining: newCreditsRemaining,
        creditsPurchased: newCreditsPurchased,
        updatedAt: new Date()
      })
      .where(eq(userCredits.email, email))
      .returning();

    console.log(`✅ Awarded ${creditsToAdd} credits to ${email}, new balance: ${newCreditsRemaining}`);
    return {
      credits_remaining: updatedRecord.creditsRemaining,
      credits_purchased: updatedRecord.creditsPurchased,
      credits_used: updatedRecord.creditsUsed
    };
  }

  async addUserCredits(email: string, creditsToAdd: number) {
    this.bustCreditsCache(email);
    console.log(`🔄 Adding ${creditsToAdd} credits to ${email}`);

    // Try Supabase first
    if (supabaseAdmin) {
      try {
        const { data: existingRecord, error: fetchError } = await supabaseAdmin
          .from('user_credits')
          .select('*')
          .eq('email', email)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        if (existingRecord) {
          // Update existing record
          const { data: updatedRecord, error: updateError } = await supabaseAdmin
            .from('user_credits')
            .update({
              credits_purchased: (existingRecord.credits_purchased || 0) + creditsToAdd,
              credits_remaining: (existingRecord.credits_remaining || 0) + creditsToAdd,
              updated_at: new Date().toISOString()
            })
            .eq('email', email)
            .select()
            .single();

          if (updateError) throw updateError;
          console.log(`✅ Updated Supabase credits for ${email}:`, updatedRecord);
          return updatedRecord;
        } else {
          // Create new record
          const { data: newRecord, error: insertError } = await supabaseAdmin
            .from('user_credits')
            .insert({
              email: email,
              credits_purchased: creditsToAdd,
              credits_remaining: creditsToAdd,
              credits_used: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) throw insertError;
          console.log(`✅ Created new Supabase credits for ${email}:`, newRecord);
          return newRecord;
        }
      } catch (supabaseError) {
        console.error('Supabase credit add error:', supabaseError);
        console.log('Falling back to local database');
      }
    }

    // Fallback to local database
    const [existingCredits] = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.email, email));

    if (existingCredits) {
      // Update existing record
      const [updatedCredits] = await db
        .update(userCredits)
        .set({
          creditsPurchased: (existingCredits.creditsPurchased || 0) + creditsToAdd,
          creditsRemaining: (existingCredits.creditsRemaining || 0) + creditsToAdd,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.email, email))
        .returning();

      console.log(`✅ Updated local credits for ${email}:`, updatedCredits);
      return updatedCredits;
    } else {
      // Create new record
      const [newCredits] = await db
        .insert(userCredits)
        .values({
          email,
          creditsPurchased: creditsToAdd,
          creditsRemaining: creditsToAdd,
          creditsUsed: 0,
        })
        .returning();

      console.log(`✅ Created new local credits for ${email}:`, newCredits);
      return newCredits;
    }
  }

  async updateUserCredits(email: string, change: number) {
    const [credits] = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.email, email));

    if (!credits) {
      // Create new credit record
      await db
        .insert(userCredits)
        .values({
          email,
          creditsRemaining: Math.max(0, change),
          creditsUsed: change < 0 ? Math.abs(change) : 0,
        });
      return;
    }

    const newCreditsRemaining = Math.max(0, (credits.creditsRemaining || 0) + change);
    const newCreditsUsed = change < 0 
      ? (credits.creditsUsed || 0) + Math.abs(change)
      : credits.creditsUsed || 0;

    await db
      .update(userCredits)
      .set({
        creditsRemaining: newCreditsRemaining,
        creditsUsed: newCreditsUsed,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.email, email));
  }

  // Dialer Service
  async getDialerStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [callsTodayResult] = await db
      .select({ count: count() })
      .from(callLogs)
      .where(and(
        eq(callLogs.userId, userId),
        eq(callLogs.createdAt, today)
      ));

    const [connectRateResult] = await db
      .select({
        total: count(),
        connected: count(callLogs.status),
      })
      .from(callLogs)
      .where(and(
        eq(callLogs.userId, userId),
        eq(callLogs.status, 'completed')
      ));

    const connectRate = connectRateResult.total > 0
      ? Math.round((connectRateResult.connected / connectRateResult.total) * 100)
      : 0;

    const recentCalls = await this.getUserCalls(userId, 5);

    return {
      callsToday: callsTodayResult.count,
      connectRate,
      recentCalls: recentCalls.map(call => ({
        number: call.phoneNumber,
        status: call.status,
        duration: call.duration,
      })),
      leadsRemaining: 50, // Mock data for now
    };
  }

  // API call logging method
  async logOutboundCall(callData: {
    userId: string;
    callType: string;
    status: string;
    phoneNumber: string;
  }) {
    const [call] = await db
      .insert(callLogs)
      .values(callData)
      .returning();

    // Update game stats
    await this.updateUserGameStats(callData.userId, {
      totalCalls: 1,
      successfulCalls: callData.status === 'completed' ? 1 : 0,
    });

    return call;
  }
}

export const connectnowService = new ConnectNowService();