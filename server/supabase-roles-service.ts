import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './hardcoded-config';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =====================================================
// TYPES AND INTERFACES
// =====================================================

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  level: number;
  is_active: boolean;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category: 'page' | 'feature' | 'data' | 'admin';
  resource?: string;
  action?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_email: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: string;
  expires_at?: string;
  is_active: boolean;
  role?: Role;
}

export interface UserPermission {
  permission_name: string;
  permission_category: string;
  permission_resource?: string;
  permission_action?: string;
  granted_by_role: boolean;
  granted_by_override: boolean;
  role_name: string;
}

export interface TeamAssignment {
  id: string;
  user_email: string;
  team_type: 'mga' | 'rga' | 'quality';
  team_name: string;
  assigned_by?: string;
  assigned_at: string;
  is_active: boolean;
}

export interface PermissionOverride {
  id: string;
  user_email: string;
  permission_id: string;
  granted: boolean;
  reason?: string;
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  permission?: Permission;
}

export interface AuditLog {
  id: string;
  admin_email: string;
  action: string;
  target_user_email?: string;
  role_id?: string;
  permission_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// =====================================================
// ROLES MANAGEMENT SERVICE
// =====================================================

export class SupabaseRolesService {
  
  // =====================================================
  // ROLE MANAGEMENT
  // =====================================================
  
  /**
   * Get all roles
   */
  static async getRoles(): Promise<Role[]> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('level', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw error;
    }
  }

  /**
   * Get role by name
   */
  static async getRoleByName(name: string): Promise<Role | null> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('name', name)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error fetching role by name:', error);
      throw error;
    }
  }

  /**
   * Create a new role
   */
  static async createRole(roleData: Omit<Role, 'id' | 'created_at' | 'updated_at'>): Promise<Role> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .insert(roleData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  /**
   * Update a role
   */
  static async updateRole(id: string, updates: Partial<Role>): Promise<Role> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  /**
   * Delete a role (soft delete)
   */
  static async deleteRole(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('roles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  // =====================================================
  // PERMISSION MANAGEMENT
  // =====================================================

  /**
   * Get all permissions
   */
  static async getPermissions(): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw error;
    }
  }

  /**
   * Get permissions by category
   */
  static async getPermissionsByCategory(category: string): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching permissions by category:', error);
      throw error;
    }
  }

  // =====================================================
  // USER ROLE MANAGEMENT
  // =====================================================

  /**
   * Get user's roles
   */
  static async getUserRoles(userEmail: string): Promise<UserRole[]> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('user_email', userEmail)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  static async assignRoleToUser(
    userEmail: string, 
    roleId: string, 
    assignedBy: string,
    expiresAt?: string
  ): Promise<UserRole> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_email: userEmail,
          role_id: roleId,
          assigned_by: assignedBy,
          expires_at: expiresAt
        })
        .select(`
          *,
          role:roles(*)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  static async removeRoleFromUser(userEmail: string, roleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_email', userEmail)
        .eq('role_id', roleId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing role from user:', error);
      throw error;
    }
  }

  // =====================================================
  // PERMISSION CHECKING
  // =====================================================

  /**
   * Get user's effective permissions
   */
  static async getUserPermissions(userEmail: string): Promise<UserPermission[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_permissions', { user_email_param: userEmail });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user has specific permission
   */
  static async userHasPermission(userEmail: string, permissionName: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_permission', { 
          user_email_param: userEmail,
          permission_name_param: permissionName
        });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Check if user can access a page
   */
  static async userCanAccessPage(userEmail: string, pageName: string): Promise<boolean> {
    const permissionName = `page.${pageName}`;
    return this.userHasPermission(userEmail, permissionName);
  }

  /**
   * Check if user can perform an action on a resource
   */
  static async userCanPerformAction(
    userEmail: string, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    const permissionName = `${resource}.${action}`;
    return this.userHasPermission(userEmail, permissionName);
  }

  // =====================================================
  // TEAM ASSIGNMENTS
  // =====================================================

  /**
   * Get user's team assignments
   */
  static async getUserTeamAssignments(userEmail: string): Promise<TeamAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('user_team_assignments')
        .select('*')
        .eq('user_email', userEmail)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user team assignments:', error);
      throw error;
    }
  }

  /**
   * Assign user to team
   */
  static async assignUserToTeam(
    userEmail: string,
    teamType: 'mga' | 'rga' | 'quality',
    teamName: string,
    assignedBy: string
  ): Promise<TeamAssignment> {
    try {
      const { data, error } = await supabase
        .from('user_team_assignments')
        .insert({
          user_email: userEmail,
          team_type: teamType,
          team_name: teamName,
          assigned_by: assignedBy
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error assigning user to team:', error);
      throw error;
    }
  }

  /**
   * Remove user from team
   */
  static async removeUserFromTeam(
    userEmail: string,
    teamType: 'mga' | 'rga' | 'quality',
    teamName: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_team_assignments')
        .update({ is_active: false })
        .eq('user_email', userEmail)
        .eq('team_type', teamType)
        .eq('team_name', teamName);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing user from team:', error);
      throw error;
    }
  }

  // =====================================================
  // PERMISSION OVERRIDES
  // =====================================================

  /**
   * Get user's permission overrides
   */
  static async getUserPermissionOverrides(userEmail: string): Promise<PermissionOverride[]> {
    try {
      const { data, error } = await supabase
        .from('user_permission_overrides')
        .select(`
          *,
          permission:permissions(*)
        `)
        .eq('user_email', userEmail)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user permission overrides:', error);
      throw error;
    }
  }

  /**
   * Grant permission override to user
   */
  static async grantPermissionOverride(
    userEmail: string,
    permissionId: string,
    reason: string,
    grantedBy: string,
    expiresAt?: string
  ): Promise<PermissionOverride> {
    try {
      const { data, error } = await supabase
        .from('user_permission_overrides')
        .insert({
          user_email: userEmail,
          permission_id: permissionId,
          granted: true,
          reason: reason,
          granted_by: grantedBy,
          expires_at: expiresAt
        })
        .select(`
          *,
          permission:permissions(*)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error granting permission override:', error);
      throw error;
    }
  }

  /**
   * Deny permission override to user
   */
  static async denyPermissionOverride(
    userEmail: string,
    permissionId: string,
    reason: string,
    grantedBy: string,
    expiresAt?: string
  ): Promise<PermissionOverride> {
    try {
      const { data, error } = await supabase
        .from('user_permission_overrides')
        .insert({
          user_email: userEmail,
          permission_id: permissionId,
          granted: false,
          reason: reason,
          granted_by: grantedBy,
          expires_at: expiresAt
        })
        .select(`
          *,
          permission:permissions(*)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error denying permission override:', error);
      throw error;
    }
  }

  // =====================================================
  // AUDIT LOGS
  // =====================================================

  /**
   * Get audit logs
   */
  static async getAuditLogs(
    limit: number = 100,
    offset: number = 0,
    adminEmail?: string,
    targetUserEmail?: string
  ): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('role_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (adminEmail) {
        query = query.eq('admin_email', adminEmail);
      }

      if (targetUserEmail) {
        query = query.eq('target_user_email', targetUserEmail);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }

  /**
   * Log admin action
   */
  static async logAdminAction(
    adminEmail: string,
    action: string,
    targetUserEmail?: string,
    roleId?: string,
    permissionId?: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('role_audit_logs')
        .insert({
          admin_email: adminEmail,
          action: action,
          target_user_email: targetUserEmail,
          role_id: roleId,
          permission_id: permissionId,
          details: details,
          ip_address: ipAddress,
          user_agent: userAgent
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging admin action:', error);
      throw error;
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  /**
   * Get user's highest role level
   */
  static async getUserHighestRoleLevel(userEmail: string): Promise<number> {
    try {
      const userRoles = await this.getUserRoles(userEmail);
      if (userRoles.length === 0) return 0;

      return Math.max(...userRoles.map(ur => ur.role?.level || 0));
    } catch (error) {
      console.error('Error getting user highest role level:', error);
      return 0;
    }
  }

  /**
   * Check if user is admin or higher
   */
  static async isUserAdmin(userEmail: string): Promise<boolean> {
    const level = await this.getUserHighestRoleLevel(userEmail);
    return level >= 2; // Admin level is 2
  }

  /**
   * Check if user is super admin
   */
  static async isUserSuperAdmin(userEmail: string): Promise<boolean> {
    const level = await this.getUserHighestRoleLevel(userEmail);
    return level >= 3; // Super admin level is 3
  }

  /**
   * Get all users with a specific role
   */
  static async getUsersWithRole(roleName: string): Promise<UserRole[]> {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('is_active', true)
        .eq('role.name', roleName);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching users with role:', error);
      throw error;
    }
  }

  /**
   * Get role permissions
   */
  static async getRolePermissions(roleId: string): Promise<Permission[]> {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          permission:permissions(*)
        `)
        .eq('role_id', roleId);

      if (error) throw error;
      return data?.map(rp => rp.permission).filter(Boolean) || [];
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      throw error;
    }
  }

  /**
   * Add permission to role
   */
  static async addPermissionToRole(roleId: string, permissionId: string, grantedBy: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .insert({
          role_id: roleId,
          permission_id: permissionId,
          granted_by: grantedBy
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding permission to role:', error);
      throw error;
    }
  }

  /**
   * Remove permission from role
   */
  static async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permissionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing permission from role:', error);
      throw error;
    }
  }
}

export default SupabaseRolesService;

