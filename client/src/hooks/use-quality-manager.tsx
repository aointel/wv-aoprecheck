import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';

// =====================================================
// TYPES
// =====================================================

export interface MGATeam {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualityManagerAssignment {
  id: string;
  qm_email: string;
  mga_team_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at?: string;
  is_active: boolean;
  mga_team?: MGATeam;
}

export interface producerMGAAssignment {
  id: string;
  agent_email: string;
  mga_team_name: string;
  assigned_at: string;
  is_active: boolean;
}

export interface QMPermissions {
  qm_email: string;
  mga_team_id: string;
  mga_team_name: string;
  mga_team_display_name: string;
  assigned_at: string;
  expires_at?: string;
  assignment_active: boolean;
  assigned_producers: Array<{
    agent_email: string;
    assigned_at: string;
  }>;
}

export interface QMDataAccess {
  qm_email: string;
  mga_team_id: string;
  mga_team_name: string;
  accessible_producers: string[];
  agent_count: number;
}

export interface QMAssignmentStats {
  totalTeams: number;
  teamsWithQMs: number;
  teamsWithoutQMs: number;
  totalQMAssignments: number;
  totalproducers: number;
}

// =====================================================
// HOOK
// =====================================================

export function useQualityManager() {
  const { user } = useAuth();
  const [mgaTeams, setMgaTeams] = useState<MGATeam[]>([]);
  const [qmAssignments, setQmAssignments] = useState<QualityManagerAssignment[]>([]);
  const [producerAssignments, setproducerAssignments] = useState<producerMGAAssignment[]>([]);
  const [qmPermissions, setQmPermissions] = useState<QMPermissions[]>([]);
  const [qmDataAccess, setQmDataAccess] = useState<QMDataAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // FETCH DATA
  // =====================================================

  const fetchMGATeams = useCallback(async () => {
    try {
      const response = await fetch('/api/mga-teams');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch MGA teams');
      
      setMgaTeams(data.teams || []);
    } catch (err) {
      console.error('Error fetching MGA teams:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchQMAssignments = useCallback(async () => {
    try {
      const response = await fetch('/api/quality-managers/assignments');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch QM assignments');
      
      setQmAssignments(data.assignments || []);
    } catch (err) {
      console.error('Error fetching QM assignments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchproducerAssignments = useCallback(async (agentEmail?: string) => {
    try {
      const url = agentEmail 
        ? `/api/agents/${agentEmail}/mga-teams`
        : '/api/agents/mga-teams';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch producer assignments');
      
      setproducerAssignments(data.assignments || []);
    } catch (err) {
      console.error('Error fetching producer assignments:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchQMPermissions = useCallback(async (qmEmail: string) => {
    try {
      const response = await fetch(`/api/quality-managers/${qmEmail}/permissions`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch QM permissions');
      
      setQmPermissions(data.permissions || []);
    } catch (err) {
      console.error('Error fetching QM permissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchQMDataAccess = useCallback(async (qmEmail: string) => {
    try {
      const response = await fetch(`/api/quality-managers/${qmEmail}/data-access`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch QM data access');
      
      setQmDataAccess(data.dataAccess || []);
    } catch (err) {
      console.error('Error fetching QM data access:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await Promise.all([
        fetchMGATeams(),
        fetchQMAssignments(),
        fetchproducerAssignments(),
        fetchQMPermissions(user.email),
        fetchQMDataAccess(user.email)
      ]);
    } catch (err) {
      console.error('Error fetching all data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, fetchMGATeams, fetchQMAssignments, fetchproducerAssignments, fetchQMPermissions, fetchQMDataAccess]);

  // =====================================================
  // QUALITY MANAGER OPERATIONS
  // =====================================================

  const assignQMToTeam = useCallback(async (
    qmEmail: string,
    mgaTeamId: string,
    assignedBy: string,
    expiresAt?: string
  ): Promise<QualityManagerAssignment> => {
    const response = await fetch(`/api/quality-managers/${qmEmail}/mga-teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mgaTeamId, assignedBy, expiresAt })
    });

    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Failed to assign QM to team');
    
    // Refresh data
    await fetchQMAssignments();
    
    return data.assignment;
  }, [fetchQMAssignments]);

  const removeQMFromTeam = useCallback(async (qmEmail: string, mgaTeamId: string): Promise<void> => {
    const response = await fetch(`/api/quality-managers/${qmEmail}/mga-teams/${mgaTeamId}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Failed to remove QM from team');
    
    // Refresh data
    await fetchQMAssignments();
  }, [fetchQMAssignments]);

  const assignproducerToTeam = useCallback(async (agentEmail: string, mgaTeamName: string): Promise<producerMGAAssignment> => {
    const response = await fetch(`/api/agents/${agentEmail}/mga-teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mgaTeamName })
    });

    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Failed to assign producer to team');
    
    // Refresh data
    await fetchproducerAssignments();
    
    return data.assignment;
  }, [fetchproducerAssignments]);

  const removeproducerFromTeam = useCallback(async (agentEmail: string, mgaTeamName: string): Promise<void> => {
    const response = await fetch(`/api/agents/${agentEmail}/mga-teams/${mgaTeamName}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Failed to remove producer from team');
    
    // Refresh data
    await fetchproducerAssignments();
  }, [fetchproducerAssignments]);

  // =====================================================
  // PERMISSION CHECKING
  // =====================================================

  const canAccessproducer = useCallback(async (qmEmail: string, agentEmail: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/quality-managers/${qmEmail}/agents/${agentEmail}/access`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to check producer access');
      
      return data.canAccess;
    } catch (err) {
      console.error('Error checking producer access:', err);
      return false;
    }
  }, []);

  const getQMAccessibleproducers = useCallback(async (qmEmail: string) => {
    try {
      const response = await fetch(`/api/quality-managers/${qmEmail}/agents`);
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch accessible producers');
      
      return data.producers || [];
    } catch (err) {
      console.error('Error fetching accessible producers:', err);
      return [];
    }
  }, []);

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================

  const getTeamsForQM = useCallback((qmEmail: string): QMPermissions[] => {
    return qmPermissions.filter(p => p.qm_email === qmEmail);
  }, [qmPermissions]);

  const getproducersForTeam = useCallback((mgaTeamName: string): producerMGAAssignment[] => {
    return producerAssignments.filter(a => a.mga_team_name === mgaTeamName && a.is_active);
  }, [producerAssignments]);

  const getQMsForTeam = useCallback((mgaTeamId: string): QualityManagerAssignment[] => {
    return qmAssignments.filter(a => a.mga_team_id === mgaTeamId && a.is_active);
  }, [qmAssignments]);

  const isQMAssignedToTeam = useCallback((qmEmail: string, mgaTeamId: string): boolean => {
    return qmAssignments.some(a => 
      a.qm_email === qmEmail && 
      a.mga_team_id === mgaTeamId && 
      a.is_active
    );
  }, [qmAssignments]);

  const isproducerInTeam = useCallback((agentEmail: string, mgaTeamName: string): boolean => {
    return producerAssignments.some(a => 
      a.agent_email === agentEmail && 
      a.mga_team_name === mgaTeamName && 
      a.is_active
    );
  }, [producerAssignments]);

  // =====================================================
  // STATISTICS
  // =====================================================

  const getAssignmentStats = useCallback(async (): Promise<QMAssignmentStats | null> => {
    try {
      const response = await fetch('/api/quality-managers/assignment-stats');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch assignment stats');
      
      return data.stats;
    } catch (err) {
      console.error('Error fetching assignment stats:', err);
      return null;
    }
  }, []);

  const getTeamsWithoutQMs = useCallback(async (): Promise<MGATeam[]> => {
    try {
      const response = await fetch('/api/mga-teams/without-quality-managers');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch teams without QMs');
      
      return data.teams || [];
    } catch (err) {
      console.error('Error fetching teams without QMs:', err);
      return [];
    }
  }, []);

  // =====================================================
  // MIGRATION
  // =====================================================

  const migrateFromProducerlist = useCallback(async () => {
    try {
      const response = await fetch('/api/mga-teams/migrate-from-producerlist', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to migrate from producerlist');
      
      // Refresh data after migration
      await fetchAllData();
      
      return data.results || [];
    } catch (err) {
      console.error('Error migrating from producerlist:', err);
      throw err;
    }
  }, [fetchAllData]);

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // =====================================================
  // RETURN INTERFACE
  // =====================================================

  return {
    // Data
    mgaTeams,
    qmAssignments,
    producerAssignments,
    qmPermissions,
    qmDataAccess,
    isLoading,
    error,
    
    // Operations
    assignQMToTeam,
    removeQMFromTeam,
    assignproducerToTeam,
    removeproducerFromTeam,
    
    // Permission checking
    canAccessproducer,
    getQMAccessibleproducers,
    
    // Utility functions
    getTeamsForQM,
    getproducersForTeam,
    getQMsForTeam,
    isQMAssignedToTeam,
    isproducerInTeam,
    
    // Statistics
    getAssignmentStats,
    getTeamsWithoutQMs,
    
    // Migration
    migrateFromProducerlist,
    
    // Refresh functions
    refresh: fetchAllData,
    refreshMGATeams: fetchMGATeams,
    refreshQMAssignments: fetchQMAssignments,
    refreshproducerAssignments: fetchproducerAssignments,
    refreshQMPermissions: fetchQMPermissions,
    refreshQMDataAccess: fetchQMDataAccess
  };
}

// =====================================================
// QUALITY MANAGER PERMISSION WRAPPER
// =====================================================

interface QMPermissionWrapperProps {
  qmEmail: string;
  agentEmail?: string;
  mgaTeamId?: string;
  mgaTeamName?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function QMPermissionWrapper({
  qmEmail,
  agentEmail,
  mgaTeamId,
  mgaTeamName,
  fallback = null,
  children
}: QMPermissionWrapperProps) {
  const { isQMAssignedToTeam, isproducerInTeam, canAccessproducer } = useQualityManager();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (agentEmail) {
        // Check if QM can access specific producer
        const canAccess = await canAccessproducer(qmEmail, agentEmail);
        setHasAccess(canAccess);
      } else if (mgaTeamId) {
        // Check if QM is assigned to team
        setHasAccess(isQMAssignedToTeam(qmEmail, mgaTeamId));
      } else if (mgaTeamName) {
        // Check if producer is in team (for producer context)
        setHasAccess(isproducerInTeam(qmEmail, mgaTeamName));
      } else {
        setHasAccess(false);
      }
    };

    checkAccess();
  }, [qmEmail, agentEmail, mgaTeamId, mgaTeamName, canAccessproducer, isQMAssignedToTeam, isproducerInTeam]);

  if (hasAccess === null) {
    return <div>Checking permissions...</div>;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

export default useQualityManager;

