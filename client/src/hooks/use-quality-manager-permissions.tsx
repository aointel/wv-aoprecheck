import { useQuery } from '@tanstack/react-query';
import { useAuth } from './use-auth';

export interface QualityManagerPermissions {
  isQualityManager: boolean;
  role: string | null;
  allowedMgaTeams: string[];
  canViewAll: boolean;
  isLoading: boolean;
  error: any;
}

/**
 * Hook to check if the current user is a Quality Manager
 */
export function useQualityManagerPermissions(): QualityManagerPermissions {
  const { authState } = useAuth();
  const userEmail = authState.user?.email;

  const { data, isLoading, error } = useQuery({
    queryKey: ['quality-manager-permissions', userEmail],
    queryFn: async () => {
      if (!userEmail) {
        return {
          isQualityManager: false,
          role: null,
          allowedMgaTeams: [],
          canViewAll: false
        };
      }

      try {
        const response = await fetch('/api/user-permissions', {
          headers: {
            'user-email': userEmail
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }

        const permissions = await response.json();
        
        return {
          isQualityManager: permissions.role === 'quality_manager' || permissions.role === 'ao_quality_manager',
          role: permissions.role,
          allowedMgaTeams: permissions.allowedMgaTeams || [],
          canViewAll: permissions.canViewAll || false
        };
      } catch (error) {
        console.error('Error fetching Quality Manager permissions:', error);
        return {
          isQualityManager: false,
          role: null,
          allowedMgaTeams: [],
          canViewAll: false
        };
      }
    },
    enabled: !!userEmail,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });

  return {
    isQualityManager: data?.isQualityManager || false,
    role: data?.role || null,
    allowedMgaTeams: data?.allowedMgaTeams || [],
    canViewAll: data?.canViewAll || false,
    isLoading,
    error
  };
}

