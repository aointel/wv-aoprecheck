import { supabaseAdmin } from "./supabase";
import { db } from "./db";
import { adminRoles, userRoles, adminLogs, agentProfiles, userCredits, type AdminLog } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface CustomerUser {
  COMPANY_EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  PHONE: string;
  STATUS: string;
  AGENTTYPE: string;
  MARKET: string;
  TEAM: string;
  RECRUITING_TRAINING_TYPE: string;
  PLUSACTIVE: string;
  RECRUITACTIVE: string;
  CREATED_DATE: string;
  UPDATED_DATE: string;
  MANAGER_EMAIL: string;
  REGION: string;
  STATE: string;
}

export interface UserWithRole extends CustomerUser {
  role?: AdminRole;
  permissions?: string[];
  accessLevel?: number;
}

export interface AdminRole {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: string[];
  level: number | null;
  isActive: boolean | null;
}

// Standard role definitions
export const STANDARD_ROLES: Omit<AdminRole, 'id'>[] = [
  {
    name: 'super_admin',
    displayName: 'Super Administrator',
    description: 'Full system access including user management and system configuration',
    permissions: ['*'],
    level: 3,
    isActive: true,
  },
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Administrative access to manage users, teams, and system settings',
    permissions: [
      'admin',
      'settings',
      'aoi-report',
      'appointments',
      'billing-dashboard'
    ],
    level: 2,
    isActive: true,
  },
  {
    name: 'manager',
    displayName: 'Team Manager',
    description: 'Manage team members and view team performance reports',
    permissions: [
      'aoi-report',
      'appointments',
      'ao-connect'
    ],
    level: 1,
    isActive: true,
  },
  {
    name: 'quality_manager',
    displayName: 'Quality Manager',
    description: 'Quality assurance access to manage and review system processes',
    permissions: [
      'ao-precheck-management',
      'aoi-report',
      'settings'
    ],
    level: 1,
    isActive: true,
  },
  {
    name: 'ao_quality_manager',
    displayName: 'AO Quality Manager',
    description: 'AO-focused quality management with specialized access to AO Intelligence and reports',
    permissions: [
      'ao-intelligence',
      'ao-precheck',
      'ao-precheck-management',
      'aoi-report',
      'settings'
    ],
    level: 1,
    isActive: true,
  },
  {
    name: 'agent',
    displayName: 'Agent',
    description: 'Basic access to make calls and manage own profile',
    permissions: [
      'ao-connect',
      'ao-intelligence',
      'appointments'
    ],
    level: 0,
    isActive: true,
  },
];

export class AdminService {
  // Initialize standard roles
  static async initializeRoles(): Promise<void> {
    try {
      for (const roleData of STANDARD_ROLES) {
        const [existingRole] = await db
          .select()
          .from(adminRoles)
          .where(eq(adminRoles.name, roleData.name))
          .limit(1);

        if (!existingRole) {
          await db.insert(adminRoles).values({
            ...roleData,
            permissions: JSON.stringify(roleData.permissions),
          });
          console.log(`✅ Created role: ${roleData.displayName}`);
        }
      }

      console.log('✅ Role initialization complete');
    } catch (error) {
      console.error('❌ Error initializing roles:', error);
    }
  }

  // Get all users from Supabase customers table (main source of truth)
  static async getAllUsers(): Promise<CustomerUser[]> {
    try {
      if (!supabaseAdmin) {
        console.log('⚠️ Supabase admin not available, falling back to local agent_profiles');
        // Fallback to local agent_profiles table
        const profiles = await db.select().from(agentProfiles).orderBy(desc(agentProfiles.createdAt));
        
        return profiles.map(profile => ({
          COMPANY_EMAIL: profile.email,
          FIRST_NAME: profile.firstName,
          LAST_NAME: profile.lastName,
          PHONE: profile.phone,
          STATUS: 'ACTIVE',
          AGENTTYPE: 'AGENT',
          MARKET: 'UNKNOWN',
          TEAM: 'DEFAULT',
          RECRUITING_TRAINING_TYPE: 'NONE',
          PLUSACTIVE: 'NO',
          RECRUITACTIVE: 'NO',
          CREATED_DATE: profile.createdAt?.toISOString() || new Date().toISOString(),
          UPDATED_DATE: profile.updatedAt?.toISOString() || new Date().toISOString(),
          MANAGER_EMAIL: '',
          REGION: '',
          STATE: ''
        }));
      }

      // Get ALL users from Supabase customers table (no limit)
      console.log('🔍 Fetching ALL users from Supabase customers table...');
      const { data: customers, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching from Supabase customers:', error);
        // Fallback to local agent_profiles if Supabase fails
        const profiles = await db.select().from(agentProfiles).orderBy(desc(agentProfiles.createdAt));
        
        return profiles.map(profile => ({
          COMPANY_EMAIL: profile.email,
          FIRST_NAME: profile.firstName,
          LAST_NAME: profile.lastName,
          PHONE: profile.phone,
          STATUS: 'ACTIVE',
          AGENTTYPE: 'AGENT',
          MARKET: 'UNKNOWN',
          TEAM: 'DEFAULT',
          RECRUITING_TRAINING_TYPE: 'NONE',
          PLUSACTIVE: 'NO',
          RECRUITACTIVE: 'NO',
          CREATED_DATE: profile.createdAt?.toISOString() || new Date().toISOString(),
          UPDATED_DATE: profile.updatedAt?.toISOString() || new Date().toISOString(),
          MANAGER_EMAIL: '',
          REGION: '',
          STATE: ''
        }));
      }

      console.log(`✅ Retrieved ${customers?.length || 0} users from Supabase customers table`);
      return customers || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  // Get user with role information
  static async getUserWithRole(email: string): Promise<UserWithRole | null> {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('COMPANY_EMAIL', email)
        .single();

      if (error || !data) return null;

      const userRole = await this.getUserRole(email);
      return {
        ...data,
        role: userRole?.role,
        permissions: userRole?.permissions,
        accessLevel: userRole?.accessLevel,
      };
    } catch (error) {
      console.error('Error fetching user with role:', error);
      return null;
    }
  }

  // Get user role and permissions
  static async getUserRole(email: string): Promise<{
    role: AdminRole;
    permissions: string[];
    accessLevel: number;
  } | null> {
    try {
      const [userRole] = await db
        .select()
        .from(userRoles)
        .where(and(
          eq(userRoles.userEmail, email),
          eq(userRoles.isActive, true)
        ))
        .limit(1);

      if (!userRole) {
        // Default to agent role
        const [agentRole] = await db
          .select()
          .from(adminRoles)
          .where(eq(adminRoles.name, 'agent'))
          .limit(1);

        if (agentRole) {
          let permissions: string[] = [];
          try {
            if (typeof agentRole.permissions === 'string') {
              permissions = JSON.parse(agentRole.permissions);
            } else if (Array.isArray(agentRole.permissions)) {
              permissions = agentRole.permissions;
            }
          } catch (error) {
            console.error('Error parsing agent role permissions:', error);
            permissions = ['profile.read', 'profile.write', 'calls.read', 'calls.write', 'leads.read'];
          }
          
          return {
            role: {
              ...agentRole,
              permissions: permissions,
              description: agentRole.description || '',
              level: agentRole.level || 0,
              isActive: agentRole.isActive || false,
            },
            permissions: permissions,
            accessLevel: agentRole.level || 0,
          };
        }
        return null;
      }

      const [role] = await db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.id, userRole.roleId))
        .limit(1);

      if (!role) return null;

      let permissions: string[] = [];
      try {
        if (typeof role.permissions === 'string') {
          permissions = JSON.parse(role.permissions);
        } else if (Array.isArray(role.permissions)) {
          permissions = role.permissions;
        }
      } catch (error) {
        console.error('Error parsing role permissions:', error);
        permissions = [];
      }

      return {
        role: {
          ...role,
          permissions: permissions,
          description: role.description || '',
          level: role.level || 0,
          isActive: role.isActive || false,
        },
        permissions: permissions,
        accessLevel: role.level || 0,
      };
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  // Assign role to user
  static async assignRole(email: string, roleName: string, assignedBy: string): Promise<boolean> {
    try {
      const [role] = await db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.name, roleName))
        .limit(1);

      if (!role) {
        throw new Error(`Role ${roleName} not found`);
      }

      // Deactivate existing roles
      await db
        .update(userRoles)
        .set({ isActive: false })
        .where(eq(userRoles.userEmail, email));

      // Assign new role
      await db.insert(userRoles).values({
        userEmail: email,
        roleId: role.id,
        assignedBy,
        isActive: true,
      });

      // Log the action
      await this.logAction(assignedBy, 'role_assigned', null, email, {
        roleName,
        roleId: role.id,
      });

      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
      return false;
    }
  }

  // Check if user has permission
  static async hasPermission(email: string, permission: string): Promise<boolean> {
    try {
      const userRole = await this.getUserRole(email);
      if (!userRole) return false;

      // Super admin has all permissions
      if (userRole.permissions.includes('*')) return true;

      // Check specific permission
      return userRole.permissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  // Removed admin check - no longer needed

  // Get all roles
  static async getAllRoles(): Promise<AdminRole[]> {
    try {
      const roles = await db
        .select()
        .from(adminRoles)
        .where(eq(adminRoles.isActive, true))
        .orderBy(desc(adminRoles.level));

      return roles.map(role => {
        let permissions: string[] = [];
        try {
          if (typeof role.permissions === 'string') {
            permissions = JSON.parse(role.permissions);
          } else if (Array.isArray(role.permissions)) {
            permissions = role.permissions;
          }
        } catch (error) {
          console.error('Error parsing role permissions:', error);
          permissions = [];
        }
        
        return {
          ...role,
          permissions: permissions,
          description: role.description || '',
          level: role.level || 0,
          isActive: role.isActive || false,
        };
      });
    } catch (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
  }

  // Log admin action
  static async logAction(
    adminEmail: string,
    action: string,
    targetUserId: string | null,
    targetUserEmail: string | null,
    details: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await db.insert(adminLogs).values({
        adminEmail,
        action,
        targetUserId,
        targetUserEmail,
        details: JSON.stringify(details),
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  }

  // Get admin activity logs
  static async getAdminLogs(limit: number = 100): Promise<AdminLog[]> {
    try {
      return await db
        .select()
        .from(adminLogs)
        .orderBy(desc(adminLogs.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('Error fetching admin logs:', error);
      return [];
    }
  }

  // Credit Management Methods
  static async getUserCredits(userEmail: string): Promise<any> {
    try {
      // Try Supabase first for credit data
      const { data: supabaseCredits, error } = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (supabaseCredits && !error) {
        console.log(`✅ Found credits in Supabase for ${userEmail}:`, supabaseCredits);
        return {
          email: supabaseCredits.email,
          creditsPurchased: supabaseCredits.credits_purchased || 0,
          creditsUsed: supabaseCredits.credits_used || 0,
          creditsRemaining: supabaseCredits.credits_remaining || 0,
          createdAt: supabaseCredits.created_at,
          updatedAt: supabaseCredits.updated_at
        };
      }

      // Fallback to local PostgreSQL (selecting only existing columns)
      const result = await db.select({
        email: userCredits.email,
        creditsPurchased: userCredits.creditsPurchased,
        creditsUsed: userCredits.creditsUsed,
        creditsRemaining: userCredits.creditsRemaining,
        createdAt: userCredits.createdAt,
        updatedAt: userCredits.updatedAt
      }).from(userCredits).where(eq(userCredits.email, userEmail));
      const localCredits = result[0];
      
      if (localCredits) {
        console.log(`✅ Found credits in local DB for ${userEmail}:`, localCredits);
        return localCredits;
      }
      
      console.log(`ℹ️ No credit records found for ${userEmail} in either Supabase or local DB`);
      return null;
    } catch (error) {
      console.error('❌ Failed to get user credits:', error);
      return null;
    }
  }

  static async updateUserCredits(userEmail: string, creditsPurchased: number, adminEmail: string): Promise<boolean> {
    try {
      // Try Supabase first
      const { data: supabaseUpdate, error } = await supabaseAdmin
        .from('user_credits')
        .update({ 
          credits_purchased: creditsPurchased,
          credits_remaining: creditsPurchased, // Assuming no usage yet when updating purchased
          updated_at: new Date().toISOString()
        })
        .eq('email', userEmail)
        .select();

      if (supabaseUpdate && supabaseUpdate.length > 0 && !error) {
        await this.logAction(adminEmail, 'UPDATE_CREDITS', null, userEmail, {
          newCreditsPurchased: creditsPurchased,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Updated Supabase credits for ${userEmail}: ${creditsPurchased} purchased`);
        return true;
      }

      // Fallback to local PostgreSQL
      const result = await db
        .update(userCredits)
        .set({ 
          creditsPurchased: creditsPurchased,
          creditsRemaining: creditsPurchased,
          updatedAt: new Date() 
        })
        .where(eq(userCredits.email, userEmail))
        .returning();
      
      if (result.length > 0) {
        await this.logAction(adminEmail, 'UPDATE_CREDITS', null, userEmail, {
          newCreditsPurchased: creditsPurchased,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Updated local DB credits for ${userEmail}: ${creditsPurchased} purchased`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to update user credits:', error);
      return false;
    }
  }

  static async addCreditsToUser(userEmail: string, creditsToAdd: number, adminEmail: string): Promise<boolean> {
    try {
      // Try Supabase first - check if user exists
      const { data: existingUser, error: checkError } = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (existingUser && !checkError) {
        // User exists in Supabase - add to purchased credits
        const newPurchased = (existingUser.credits_purchased || 0) + creditsToAdd;
        const newRemaining = newPurchased - (existingUser.credits_used || 0);
        
        const { data: updateResult, error: updateError } = await supabaseAdmin
          .from('user_credits')
          .update({
            credits_purchased: newPurchased,
            credits_remaining: newRemaining,
            updated_at: new Date().toISOString()
          })
          .eq('email', userEmail)
          .select();

        if (updateResult && updateResult.length > 0 && !updateError) {
          await this.logAction(adminEmail, 'ADD_CREDITS', null, userEmail, {
            creditsAdded: creditsToAdd,
            newTotal: newPurchased,
            timestamp: new Date().toISOString()
          });
          
          console.log(`✅ Added ${creditsToAdd} credits to ${userEmail} in Supabase. New total: ${newPurchased}`);
          return true;
        }
      }

      // Fallback to local PostgreSQL
      const currentUser = await db.select().from(userCredits).where(eq(userCredits.email, userEmail)).limit(1);
      
      if (currentUser.length === 0) {
        // Create new user credits record if doesn't exist - only modify creditsPurchased
        const result = await db
          .insert(userCredits)
          .values({
            email: userEmail,
            creditsPurchased: creditsToAdd,
            creditsUsed: 0,
            creditsRemaining: creditsToAdd, // remaining = purchased - used (0 for new users)
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
          
        if (result.length > 0) {
          await this.logAction(adminEmail, 'CREATE_CREDITS', null, userEmail, {
            creditsAdded: creditsToAdd,
            newPurchased: creditsToAdd,
            timestamp: new Date().toISOString()
          });
          console.log(`✅ Created credit account for ${userEmail} with ${creditsToAdd} purchased credits`);
          return true;
        }
        return false;
      }
      
      // Update existing credits - only modify creditsPurchased, recalculate remaining
      const current = currentUser[0];
      const newPurchased = (current.creditsPurchased || 0) + creditsToAdd;
      const usedCredits = current.creditsUsed || 0;
      const newRemaining = newPurchased - usedCredits; // remaining = purchased - used
      
      const result = await db
        .update(userCredits)
        .set({ 
          creditsPurchased: newPurchased,
          creditsRemaining: newRemaining, // recalculated value
          updatedAt: new Date() 
        })
        .where(eq(userCredits.email, userEmail))
        .returning();
      
      if (result.length > 0) {
        const newTotal = result[0].creditsRemaining;
        
        await this.logAction(adminEmail, 'ADD_CREDITS', null, userEmail, {
          creditsAdded: creditsToAdd,
          newTotal: newTotal,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Added ${creditsToAdd} credits to ${userEmail}. New total: ${newTotal}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to add credits to user:', error);
      return false;
    }
  }

  static async createUserCredits(userEmail: string, initialCredits: number, adminEmail: string): Promise<boolean> {
    try {
      // Removed old SQL query - using Drizzle ORM below
      
      const result = await db
        .insert(userCredits)
        .values({
          email: userEmail,
          creditsRemaining: initialCredits,
          creditsPurchased: initialCredits,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: userCredits.email,
          set: {
            creditsRemaining: initialCredits,
            creditsPurchased: sql`${userCredits.creditsPurchased} + ${initialCredits}`,
            updatedAt: new Date()
          }
        })
        .returning();
      
      if (result.length > 0) {
        await this.logAction(adminEmail, 'CREATE_USER_CREDITS', null, userEmail, {
          initialCredits: initialCredits,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Created/updated credits for ${userEmail}: ${initialCredits}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to create user credits:', error);
      return false;
    }
  }

  static async getAllUserCredits(): Promise<any[]> {
    try {
      return await db
        .select()
        .from(userCredits)
        .orderBy(desc(userCredits.creditsRemaining), userCredits.email);
    } catch (error) {
      console.error('❌ Failed to get all user credits:', error);
      return [];
    }
  }

  // Sync Supabase authentication users to admin panel
  static async syncSupabaseUsers(): Promise<{ success: boolean; synced: number; errors: string[] }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      console.log('🔄 Starting Supabase user sync...');

      // Get all users from Supabase auth with pagination
      let page = 1;
      let hasMore = true;
      const allUsers: any[] = [];
      
      while (hasMore) {
        console.log(`📄 Fetching page ${page} of Supabase users...`);
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000 // Maximum per page
        });
        
        if (authError) {
          throw new Error(`Failed to fetch Supabase users page ${page}: ${authError.message}`);
        }
        
        if (authUsers?.users?.length) {
          allUsers.push(...authUsers.users);
          console.log(`✅ Page ${page}: ${authUsers.users.length} users fetched`);
          page++;
          hasMore = authUsers.users.length === 1000; // Continue if we got max results
        } else {
          hasMore = false;
        }
      }

      if (!allUsers.length) {
        console.log('⚠️ No Supabase users found to sync');
        return { success: true, synced: 0, errors: [] };
      }

      console.log(`📋 Found ${allUsers.length} total Supabase users to sync`);

      for (const authUser of allUsers) {
        try {
          if (!authUser.email) {
            errors.push(`User ${authUser.id} has no email address`);
            continue;
          }

          // Check if user already exists in agent_profiles
          const [existingProfile] = await db
            .select()
            .from(agentProfiles)
            .where(eq(agentProfiles.email, authUser.email))
            .limit(1);

          if (!existingProfile) {
            // Create new agent profile from Supabase user
            const firstName = authUser.user_metadata?.firstName || 
                             authUser.user_metadata?.first_name || 
                             authUser.email.split('@')[0] || 'User';
            const lastName = authUser.user_metadata?.lastName || 
                            authUser.user_metadata?.last_name || '';
            const phone = authUser.user_metadata?.phone || '';

            await db.insert(agentProfiles).values({
              supabaseUserId: authUser.id,
              email: authUser.email,
              firstName,
              lastName,
              phone,
              zoomId: '',
              zoomPassword: '1',
              createdAt: new Date(authUser.created_at),
              updatedAt: new Date()
            });

            console.log(`✅ Created agent profile for: ${authUser.email}`);
          } else if (!existingProfile.supabaseUserId) {
            // Update existing profile with Supabase user ID
            await db
              .update(agentProfiles)
              .set({ 
                supabaseUserId: authUser.id,
                updatedAt: new Date()
              })
              .where(eq(agentProfiles.email, authUser.email));

            console.log(`🔗 Linked existing profile to Supabase: ${authUser.email}`);
          }

          // Check if user has a role assigned
          const userRole = await this.getUserRole(authUser.email);
          if (!userRole) {
            // Assign default agent role to new users
            const defaultRole = authUser.email.includes('@aoglobelife.com') ? 'agent' : 'agent';
            await this.assignRole(authUser.email, defaultRole, 'system');
            console.log(`👤 Assigned default role '${defaultRole}' to: ${authUser.email}`);
          }

          syncedCount++;
        } catch (userError) {
          const errorMsg = `Failed to sync user ${authUser.email}: ${userError instanceof Error ? userError.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      await this.logAction('system', 'users_synced', null, null, {
        totalUsers: authUsers.users.length,
        syncedUsers: syncedCount,
        errors: errors.length
      });

      console.log(`✅ Sync completed: ${syncedCount}/${allUsers.length} users synced`);
      
      return { 
        success: true, 
        synced: syncedCount, 
        errors 
      };

    } catch (error) {
      const errorMsg = `Supabase user sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
      
      return { 
        success: false, 
        synced: syncedCount, 
        errors 
      };
    }
  }

  // Get sync status and statistics
  static async getSyncStats(): Promise<{
    supabaseUsers: number;
    localProfiles: number;
    linkedProfiles: number;
    unlinkedProfiles: number;
    lastSyncDate?: string;
  }> {
    try {
      let supabaseUsers = 0;
      
      if (supabaseAdmin) {
        console.log('🔍 Starting comprehensive Supabase user count...');
        
        try {
          // Try multiple approaches to get accurate count
          
          // Approach 1: Simple listUsers call to see what we get
          const { data: firstPage, error: firstError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000
          });
          
          console.log('📋 First page results:', {
            users_returned: firstPage?.users?.length || 0,
            error: firstError?.message || 'none'
          });
          
          if (firstError) {
            console.error('❌ Supabase listUsers error:', firstError);
            supabaseUsers = 0;
          } else {
            // Try pagination to get all users
            let page = 1;
            let totalUsers = 0;
            let hasMore = true;
            const maxPages = 20; // Safety limit
            
            while (hasMore && page <= maxPages) {
              const { data: pageData, error: pageError } = await supabaseAdmin.auth.admin.listUsers({
                page,
                perPage: 1000
              });
              
              if (pageError) {
                console.error(`❌ Error on page ${page}:`, pageError);
                break;
              }
              
              const userCount = pageData?.users?.length || 0;
              totalUsers += userCount;
              
              console.log(`📄 Page ${page}: ${userCount} users (Total: ${totalUsers})`);
              
              // Continue if we got a full page
              hasMore = userCount === 1000;
              page++;
              
              // Short delay to avoid rate limiting
              if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
            
            supabaseUsers = totalUsers;
            console.log(`📊 FINAL COUNT: ${supabaseUsers} total Supabase users found across ${page - 1} pages`);
            
            // Additional debugging - check if there are way more users by trying a different approach
            if (supabaseUsers < 100) {
              console.log('🔍 Low user count detected. Checking Supabase service key and permissions...');
              
              // Try to get a count from auth.users table directly (if permissions allow)
              try {
                const { count, error: countError } = await supabaseAdmin
                  .from('auth.users')
                  .select('*', { count: 'exact', head: true });
                
                if (!countError) {
                  console.log(`📊 Direct auth.users table count: ${count}`);
                } else {
                  console.log('❌ Cannot access auth.users table directly:', countError.message);
                }
              } catch (tableError) {
                console.log('❌ auth.users table query failed:', tableError);
              }
            }
          }
        } catch (globalError) {
          console.error('❌ Global Supabase error:', globalError);
          supabaseUsers = 0;
        }
      } else {
        console.log('❌ Supabase admin client not available');
      }

      const localProfiles = await db
        .select({ count: sql<number>`count(*)` })
        .from(agentProfiles);

      const linkedProfiles = await db
        .select({ count: sql<number>`count(*)` })
        .from(agentProfiles)
        .where(sql`supabase_user_id IS NOT NULL`);

      const unlinkedProfiles = await db
        .select({ count: sql<number>`count(*)` })
        .from(agentProfiles)
        .where(sql`supabase_user_id IS NULL`);

      // Get last sync date from admin logs
      const [lastSyncLog] = await db
        .select()
        .from(adminLogs)
        .where(eq(adminLogs.action, 'users_synced'))
        .orderBy(desc(adminLogs.createdAt))
        .limit(1);

      return {
        supabaseUsers,
        localProfiles: localProfiles[0]?.count || 0,
        linkedProfiles: linkedProfiles[0]?.count || 0,
        unlinkedProfiles: unlinkedProfiles[0]?.count || 0,
        lastSyncDate: lastSyncLog?.createdAt?.toISOString()
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        supabaseUsers: 0,
        localProfiles: 0,
        linkedProfiles: 0,
        unlinkedProfiles: 0
      };
    }
  }

  // Update customer attributes
  static async updateCustomerAttributes(email: string, attributes: any): Promise<boolean> {
    try {
      console.log(`🔄 Updating customer ${email} with:`, attributes);
      
      // Prepare update object with proper field mapping
      const updateData: any = {
        ASSOCIATE_ID: attributes.ASSOCIATE_ID,
        STATE: attributes.STATE,
        AGENTTYPE: attributes.AGENTTYPE,
        MANAGER_EMAIL: attributes.MANAGER_EMAIL,
        UPDATED_DATE: new Date().toISOString()
      };

      // Handle both old MARKET and new MARKETS fields
      if (attributes.MARKET) {
        updateData.MARKET = attributes.MARKET;
      }
      
      // Handle multi-select markets - save as JSON array to market field
      if (attributes.MARKETS && Array.isArray(attributes.MARKETS)) {
        updateData.market = attributes.MARKETS; // Supabase market field as JSON array
        updateData.MARKET = attributes.MARKETS[0] || ''; // Legacy single market field
        console.log(`📈 Saving multi-select markets to ${email}:`, attributes.MARKETS);
      }

      // Handle states array
      if (attributes.STATES && Array.isArray(attributes.STATES)) {
        updateData.states = attributes.STATES; // Supabase states field as JSON array
        updateData.STATE = attributes.STATES.join(', '); // Legacy CSV format
      }

      // Handle platform access flags
      if (attributes.VDPACTIVE) updateData.VDPACTIVE = attributes.VDPACTIVE;
      if (attributes.PLUSACTIVE) updateData.PLUSACTIVE = attributes.PLUSACTIVE;
      if (attributes.RECRUITACTIVE) updateData.RECRUITACTIVE = attributes.RECRUITACTIVE;
      if (attributes.AOICONNECT) updateData.AOICONNECT = attributes.AOICONNECT;

      // Update in Supabase
      const { error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('company_email', email);

      if (error) {
        console.error('Supabase customer update error:', error);
        return false;
      }

      // Log the action
      await this.logAction('system@aoglobelife.com', 'update_customer', `Updated customer attributes for ${email}`, {
        targetEmail: email,
        updatedFields: attributes
      });

      console.log(`✅ Updated customer attributes for ${email}:`, updateData);
      return true;
    } catch (error) {
      console.error('Error updating customer attributes:', error);
      return false;
    }
  }

  // Password Reset Method
  static async resetUserPassword(userEmail: string, newPassword: string, adminEmail: string): Promise<boolean> {
    try {
      console.log(`🔄 Attempting to reset password for ${userEmail} by admin ${adminEmail}`);
      
      // First, find the user by email to get their ID - with proper pagination
      let allUsers = [];
      let page = 1;
      const perPage = 1000;
      
      while (true) {
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers({
          page: page,
          perPage: perPage
        });
        
        if (userError) {
          console.error('❌ Failed to list users:', userError);
          return false;
        }
        
        allUsers = allUsers.concat(userData.users);
        
        if (userData.users.length < perPage) {
          break; // Last page
        }
        page++;
      }

      console.log(`🔍 Found ${allUsers.length} users total. Looking for: ${userEmail}`);

      const targetUser = allUsers.find(user => user.email === userEmail);
      if (!targetUser) {
        console.error('❌ User not found in Supabase auth:', userEmail);
        return false;
      }

      // Reset password using the user ID
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUser.id,
        { password: newPassword }
      );

      if (resetError) {
        console.error('❌ Failed to reset password:', resetError);
        return false;
      }

      console.log('✅ Password reset successful for user:', userEmail);

      // Log the password reset action
      await this.logAction(adminEmail, 'RESET_PASSWORD', targetUser.id, userEmail, {
        timestamp: new Date().toISOString(),
        resetBy: adminEmail
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to reset user password:', error);
      return false;
    }
  }
}