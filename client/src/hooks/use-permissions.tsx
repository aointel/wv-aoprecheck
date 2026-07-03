import { useAuth } from './use-auth';
import type { PageKey, TeamRole } from '@shared/schema';

export interface UserPagePermissions {
  role: TeamRole;
  allowedPages: PageKey[];
  canViewAll: boolean;
}

/**
 * Hook that gives full permissions to all authenticated users - NO MORE RBAC
 */
export function usePermissions() {
  const { authState } = useAuth();

  // Mock permissions that give full access to everyone
  const mockPermissions: UserPagePermissions = {
    role: 'producer' as TeamRole,
    allowedPages: [
      'ao-intelligence',
      'ao-connect', 
      'aoi-report',
      'billing-dashboard',
      'appointments',
      'ao-recruit',
      'ao-precheck',
      'settings',
      'ao-precheck-management',
      'admin',
      'user-management',
      'teams-management'
    ] as PageKey[],
    canViewAll: true
  };

  /**
   * Check if the current user can access a specific page - ALWAYS TRUE
   */
  const canAccessPage = (pageKey: PageKey): boolean => {
    return true; // Everyone can access everything
  };

  /**
   * Get user's role - always return producer
   */
  const getUserRole = (): TeamRole | null => {
    return 'producer';
  };

  /**
   * Check if user is system admin - return true for specific emails
   */
  const isSystemAdmin = (): boolean => {
    const email = authState.user?.email;
    return email === 'cnsysop@aoglobelife.com' || email?.endsWith('@aoglobelife.com') || false;
  };

  return {
    userPermissions: mockPermissions,
    canAccessPage,
    getUserRole,
    isSystemAdmin,
    isLoading: false,
    error: null,
  };
}