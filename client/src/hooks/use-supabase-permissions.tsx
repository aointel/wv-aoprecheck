import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

// =====================================================
// TYPES
// =====================================================

export interface UserPermission {
  permission_name: string;
  permission_category: string;
  permission_resource?: string;
  permission_action?: string;
  granted_by_role: boolean;
  granted_by_override: boolean;
  role_name: string;
}

export interface UserRole {
  id: string;
  user_email: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: string;
  expires_at?: string;
  is_active: boolean;
  role?: {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    level: number;
    is_active: boolean;
    is_system_role: boolean;
  };
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

export interface PermissionCheckResult {
  hasPermission: boolean;
  isLoading: boolean;
  error?: string;
}

// =====================================================
// HOOK
// =====================================================

export function useSupabasePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // FETCH USER DATA
  // =====================================================

  const fetchUserData = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all user data in parallel
      const [permissionsRes, rolesRes, teamsRes] = await Promise.all([
        fetch(`/api/users/${user.email}/permissions`),
        fetch(`/api/users/${user.email}/roles`),
        fetch(`/api/users/${user.email}/teams`)
      ]);

      if (!permissionsRes.ok) throw new Error('Failed to fetch permissions');
      if (!rolesRes.ok) throw new Error('Failed to fetch roles');
      if (!teamsRes.ok) throw new Error('Failed to fetch team assignments');

      const [permissionsData, rolesData, teamsData] = await Promise.all([
        permissionsRes.json(),
        rolesRes.json(),
        teamsRes.json()
      ]);

      setPermissions(permissionsData.permissions || []);
      setRoles(rolesData.roles || []);
      setTeamAssignments(teamsData.teams || []);
    } catch (err) {
      console.error('Error fetching user permissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  // =====================================================
  // PERMISSION CHECKING METHODS
  // =====================================================

  const hasPermission = useCallback((permissionName: string): boolean => {
    return permissions.some(p => p.permission_name === permissionName);
  }, [permissions]);

  const hasAnyPermission = useCallback((permissionNames: string[]): boolean => {
    return permissionNames.some(name => hasPermission(name));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((permissionNames: string[]): boolean => {
    return permissionNames.every(name => hasPermission(name));
  }, [hasPermission]);

  const canAccessPage = useCallback((pageName: string): boolean => {
    return hasPermission(`page.${pageName}`);
  }, [hasPermission]);

  const canPerformAction = useCallback((resource: string, action: string): boolean => {
    return hasPermission(`${resource}.${action}`);
  }, [hasPermission]);

  const hasRole = useCallback((roleName: string): boolean => {
    return roles.some(r => r.role?.name === roleName && r.is_active);
  }, [roles]);

  const hasAnyRole = useCallback((roleNames: string[]): boolean => {
    return roleNames.some(name => hasRole(name));
  }, [hasRole]);

  const getHighestRoleLevel = useCallback((): number => {
    if (roles.length === 0) return 0;
    return Math.max(...roles.map(r => r.role?.level || 0));
  }, [roles]);

  const isAdmin = useCallback((): boolean => {
    return getHighestRoleLevel() >= 2;
  }, [getHighestRoleLevel]);

  const isSuperAdmin = useCallback((): boolean => {
    return getHighestRoleLevel() >= 3;
  }, [getHighestRoleLevel]);

  const getTeamAssignments = useCallback((teamType?: 'mga' | 'rga' | 'quality'): TeamAssignment[] => {
    if (!teamType) return teamAssignments;
    return teamAssignments.filter(t => t.team_type === teamType && t.is_active);
  }, [teamAssignments]);

  const isAssignedToTeam = useCallback((teamType: 'mga' | 'rga' | 'quality', teamName: string): boolean => {
    return teamAssignments.some(t => 
      t.team_type === teamType && 
      t.team_name === teamName && 
      t.is_active
    );
  }, [teamAssignments]);

  // =====================================================
  // PERMISSION CHECK WITH API CALL
  // =====================================================

  const checkPermission = useCallback(async (permissionName: string): Promise<PermissionCheckResult> => {
    if (!user?.email) {
      return { hasPermission: false, isLoading: false, error: 'No user email' };
    }

    try {
      const response = await fetch(`/api/users/${user.email}/permissions/check?permission=${permissionName}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check permission');
      }

      return { hasPermission: data.hasPermission, isLoading: false };
    } catch (err) {
      console.error('Error checking permission:', err);
      return { 
        hasPermission: false, 
        isLoading: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }, [user?.email]);

  const checkPageAccess = useCallback(async (pageName: string): Promise<PermissionCheckResult> => {
    if (!user?.email) {
      return { hasPermission: false, isLoading: false, error: 'No user email' };
    }

    try {
      const response = await fetch(`/api/users/${user.email}/pages/${pageName}/access`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check page access');
      }

      return { hasPermission: data.canAccess, isLoading: false };
    } catch (err) {
      console.error('Error checking page access:', err);
      return { 
        hasPermission: false, 
        isLoading: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }, [user?.email]);

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // =====================================================
  // RETURN INTERFACE
  // =====================================================

  return {
    // Data
    permissions,
    roles,
    teamAssignments,
    isLoading,
    error,
    
    // Permission checking (local)
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessPage,
    canPerformAction,
    
    // Role checking (local)
    hasRole,
    hasAnyRole,
    getHighestRoleLevel,
    isAdmin,
    isSuperAdmin,
    
    // Team checking (local)
    getTeamAssignments,
    isAssignedToTeam,
    
    // Permission checking (API)
    checkPermission,
    checkPageAccess,
    
    // Utilities
    refresh: fetchUserData
  };
}

// =====================================================
// PERMISSION COMPONENT WRAPPER
// =====================================================

interface PermissionWrapperProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  roles?: string[];
  page?: string;
  resource?: string;
  action?: string;
  teamType?: 'mga' | 'rga' | 'quality';
  teamName?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionWrapper({
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  page,
  resource,
  action,
  teamType,
  teamName,
  fallback = null,
  children
}: PermissionWrapperProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessPage,
    canPerformAction,
    hasRole,
    hasAnyRole,
    isAssignedToTeam,
    isLoading
  } = useSupabasePermissions();

  if (isLoading) {
    return <div>Loading permissions...</div>;
  }

  let hasAccess = false;

  // Check page access
  if (page) {
    hasAccess = canAccessPage(page);
  }
  // Check resource/action
  else if (resource && action) {
    hasAccess = canPerformAction(resource, action);
  }
  // Check single permission
  else if (permission) {
    hasAccess = hasPermission(permission);
  }
  // Check multiple permissions
  else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  }
  // Check single role
  else if (role) {
    hasAccess = hasRole(role);
  }
  // Check multiple roles
  else if (roles) {
    hasAccess = hasAnyRole(roles);
  }
  // Check team assignment
  else if (teamType && teamName) {
    hasAccess = isAssignedToTeam(teamType, teamName);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// =====================================================
// COMMON PERMISSION CONSTANTS
// =====================================================

export const PERMISSIONS = {
  // Page access
  DASHBOARD: 'page.dashboard',
  AO_CONNECT: 'page.ao_connect',
  AO_INTELLIGENCE: 'page.ao_intelligence',
  APPOINTMENTS: 'page.appointments',
  BILLING_DASHBOARD: 'page.billing_dashboard',
  AOI_REPORT: 'page.aoi_report',
  AO_PRECHECK: 'page.ao_precheck',
  AO_PRECHECK_MANAGEMENT: 'page.ao_precheck_management',
  ADMIN: 'page.admin',
  SETTINGS: 'page.settings',

  // Feature permissions
  MAKE_CALLS: 'feature.make_calls',
  RECEIVE_CALLS: 'feature.receive_calls',
  VIEW_LEADS: 'feature.view_leads',
  MANAGE_LEADS: 'feature.manage_leads',
  VIEW_REPORTS: 'feature.view_reports',
  EXPORT_DATA: 'feature.export_data',

  // Data permissions
  VIEW_ALL_LEADS: 'data.view_all_leads',
  VIEW_TEAM_LEADS: 'data.view_team_leads',
  VIEW_OWN_LEADS: 'data.view_own_leads',
  VIEW_ALL_CALLS: 'data.view_all_calls',
  VIEW_TEAM_CALLS: 'data.view_team_calls',
  VIEW_OWN_CALLS: 'data.view_own_calls',
  VIEW_PII: 'data.view_pii',
  VIEW_EVIDENCE: 'data.view_evidence',

  // Admin permissions
  MANAGE_USERS: 'admin.manage_users',
  MANAGE_ROLES: 'admin.manage_roles',
  MANAGE_PERMISSIONS: 'admin.manage_permissions',
  VIEW_AUDIT_LOGS: 'admin.view_audit_logs',
  SYSTEM_SETTINGS: 'admin.system_settings',
  BILLING_MANAGEMENT: 'admin.billing_management'
} as const;

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  QUALITY_MANAGER: 'quality_manager',
  AO_QUALITY_MANAGER: 'ao_quality_manager',
  producer: 'producer'
} as const;

export default useSupabasePermissions;

