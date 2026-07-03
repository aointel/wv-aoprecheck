import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './hardcoded-config';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =====================================================
// TYPES AND INTERFACES
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

export interface AgentMGAAssignment {
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
  assigned_agents: Array<{
    agent_email: string;
    assigned_at: string;
  }>;
}

export interface QMDataAccess {
  qm_email: string;
  mga_team_id: string;
  mga_team_name: string;
  accessible_agents: string[];
  agent_count: number;
}

// =====================================================
// QUALITY MANAGER SERVICE
// =====================================================

export class QualityManagerService {
  
  // =====================================================
  // MGA TEAM MANAGEMENT
  // =====================================================

  /**
   * Get all MGA teams
   */
  static async getMGATeams(): Promise<MGATeam[]> {
    try {
      const { data, error } = await supabase
        .from('mga_teams')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching MGA teams:', error);
      throw error;
    }
  }

  /**
   * Create MGA team
   */
  static async createMGATeam(teamData: Omit<MGATeam, 'id' | 'created_at' | 'updated_at'>): Promise<MGATeam> {
    try {
      const { data, error } = await supabase
        .from('mga_teams')
        .insert(teamData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating MGA team:', error);
      throw error;
    }
  }

  /**
   * Update MGA team
   */
  static async updateMGATeam(id: string, updates: Partial<MGATeam>): Promise<MGATeam> {
    try {
      const { data, error } = await supabase
        .from('mga_teams')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating MGA team:', error);
      throw error;
    }
  }

  // =====================================================
  // QUALITY MANAGER ASSIGNMENTS
  // =====================================================

  /**
   * Get Quality Manager's assigned MGA teams
   */
  static async getQMMGATeams(qmEmail: string): Promise<QMPermissions[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_qm_mga_teams', { qm_email_param: qmEmail });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching QM MGA teams:', error);
      throw error;
    }
  }

  /**
   * Get all agents a Quality Manager can access
   */
  static async getQMAccessibleAgents(qmEmail: string): Promise<Array<{
    agent_email: string;
    mga_team_name: string;
    assigned_at: string;
  }>> {
    try {
      const { data, error } = await supabase
        .rpc('get_qm_accessible_agents', { qm_email_param: qmEmail });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching QM accessible agents:', error);
      throw error;
    }
  }

  /**
   * Check if Quality Manager can access specific agent
   */
  static async qmCanAccessAgent(qmEmail: string, agentEmail: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('qm_can_access_agent', { 
          qm_email_param: qmEmail,
          agent_email_param: agentEmail
        });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking QM agent access:', error);
      return false;
    }
  }

  /**
   * Assign Quality Manager to MGA team
   */
  static async assignQMToMGATeam(
    qmEmail: string,
    mgaTeamId: string,
    assignedBy: string,
    expiresAt?: string
  ): Promise<QualityManagerAssignment> {
    try {
      const { data, error } = await supabase
        .from('quality_manager_assignments')
        .insert({
          qm_email: qmEmail,
          mga_team_id: mgaTeamId,
          assigned_by: assignedBy,
          expires_at: expiresAt
        })
        .select(`
          *,
          mga_team:mga_teams(*)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error assigning QM to MGA team:', error);
      throw error;
    }
  }

  /**
   * Remove Quality Manager from MGA team
   */
  static async removeQMFromMGATeam(qmEmail: string, mgaTeamId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('quality_manager_assignments')
        .update({ is_active: false })
        .eq('qm_email', qmEmail)
        .eq('mga_team_id', mgaTeamId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing QM from MGA team:', error);
      throw error;
    }
  }

  /**
   * Get all Quality Manager assignments
   */
  static async getAllQMAssignments(): Promise<QualityManagerAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('quality_manager_assignments')
        .select(`
          *,
          mga_team:mga_teams(*)
        `)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching QM assignments:', error);
      throw error;
    }
  }

  /**
   * Get Quality Manager assignments for specific MGA team
   */
  static async getQMAssignmentsForTeam(mgaTeamId: string): Promise<QualityManagerAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('quality_manager_assignments')
        .select(`
          *,
          mga_team:mga_teams(*)
        `)
        .eq('mga_team_id', mgaTeamId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching QM assignments for team:', error);
      throw error;
    }
  }

  // =====================================================
  // AGENT MGA ASSIGNMENTS
  // =====================================================

  /**
   * Get agent MGA assignments
   */
  static async getAgentMGAAssignments(agentEmail?: string): Promise<AgentMGAAssignment[]> {
    try {
      let query = supabase
        .from('agent_mga_assignments')
        .select('*')
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (agentEmail) {
        query = query.eq('agent_email', agentEmail);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching agent MGA assignments:', error);
      throw error;
    }
  }

  /**
   * Assign agent to MGA team
   */
  static async assignAgentToMGATeam(agentEmail: string, mgaTeamName: string): Promise<AgentMGAAssignment> {
    try {
      const { data, error } = await supabase
        .from('agent_mga_assignments')
        .insert({
          agent_email: agentEmail,
          mga_team_name: mgaTeamName
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error assigning agent to MGA team:', error);
      throw error;
    }
  }

  /**
   * Remove agent from MGA team
   */
  static async removeAgentFromMGATeam(agentEmail: string, mgaTeamName: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('agent_mga_assignments')
        .update({ is_active: false })
        .eq('agent_email', agentEmail)
        .eq('mga_team_name', mgaTeamName);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing agent from MGA team:', error);
      throw error;
    }
  }

  // =====================================================
  // MIGRATION AND UTILITIES
  // =====================================================

  /**
   * Migrate MGA teams from producerlist
   */
  static async migrateFromProducerlist(): Promise<Array<{
    mga_team_name: string;
    agent_count: number;
  }>> {
    try {
      const { data, error } = await supabase
        .rpc('migrate_mga_teams_from_producerlist');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error migrating from producerlist:', error);
      throw error;
    }
  }

  /**
   * Get Quality Manager data access summary
   */
  static async getQMDataAccess(qmEmail: string): Promise<QMDataAccess[]> {
    try {
      const { data, error } = await supabase
        .from('quality_manager_data_access')
        .select('*')
        .eq('qm_email', qmEmail);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching QM data access:', error);
      throw error;
    }
  }

  /**
   * Get all Quality Manager permissions (with agent details)
   */
  static async getQMPermissions(qmEmail: string): Promise<QMPermissions[]> {
    try {
      const { data, error } = await supabase
        .from('quality_manager_permissions')
        .select('*')
        .eq('qm_email', qmEmail);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching QM permissions:', error);
      throw error;
    }
  }

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  /**
   * Assign multiple Quality Managers to MGA teams
   */
  static async bulkAssignQMs(assignments: Array<{
    qmEmail: string;
    mgaTeamId: string;
    assignedBy: string;
    expiresAt?: string;
  }>): Promise<QualityManagerAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('quality_manager_assignments')
        .insert(assignments)
        .select(`
          *,
          mga_team:mga_teams(*)
        `);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error bulk assigning QMs:', error);
      throw error;
    }
  }

  /**
   * Assign multiple agents to MGA teams
   */
  static async bulkAssignAgents(assignments: Array<{
    agentEmail: string;
    mgaTeamName: string;
  }>): Promise<AgentMGAAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('agent_mga_assignments')
        .insert(assignments)
        .select();

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error bulk assigning agents:', error);
      throw error;
    }
  }

  // =====================================================
  // VALIDATION AND CHECKS
  // =====================================================

  /**
   * Check if MGA team has Quality Managers assigned
   */
  static async teamHasQMs(mgaTeamId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('quality_manager_assignments')
        .select('id')
        .eq('mga_team_id', mgaTeamId)
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking if team has QMs:', error);
      return false;
    }
  }

  /**
   * Get teams without Quality Managers
   */
  static async getTeamsWithoutQMs(): Promise<MGATeam[]> {
    try {
      const { data, error } = await supabase
        .from('mga_teams')
        .select('*')
        .eq('is_active', true)
        .not('id', 'in', 
          supabase
            .from('quality_manager_assignments')
            .select('mga_team_id')
            .eq('is_active', true)
        );

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching teams without QMs:', error);
      throw error;
    }
  }

  /**
   * Get Quality Manager assignment statistics
   */
  static async getQMAssignmentStats(): Promise<{
    totalTeams: number;
    teamsWithQMs: number;
    teamsWithoutQMs: number;
    totalQMAssignments: number;
    totalAgents: number;
  }> {
    try {
      const [teamsRes, qmAssignmentsRes, agentsRes] = await Promise.all([
        supabase.from('mga_teams').select('id').eq('is_active', true),
        supabase.from('quality_manager_assignments').select('id').eq('is_active', true),
        supabase.from('agent_mga_assignments').select('id').eq('is_active', true)
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (qmAssignmentsRes.error) throw qmAssignmentsRes.error;
      if (agentsRes.error) throw agentsRes.error;

      const totalTeams = teamsRes.data?.length || 0;
      const totalQMAssignments = qmAssignmentsRes.data?.length || 0;
      const totalAgents = agentsRes.data?.length || 0;

      // Get unique teams with QMs
      const teamsWithQMsRes = await supabase
        .from('quality_manager_assignments')
        .select('mga_team_id')
        .eq('is_active', true);

      if (teamsWithQMsRes.error) throw teamsWithQMsRes.error;

      const uniqueTeamsWithQMs = new Set(teamsWithQMsRes.data?.map(a => a.mga_team_id) || []).size;

      return {
        totalTeams,
        teamsWithQMs: uniqueTeamsWithQMs,
        teamsWithoutQMs: totalTeams - uniqueTeamsWithQMs,
        totalQMAssignments,
        totalAgents
      };
    } catch (error) {
      console.error('Error fetching QM assignment stats:', error);
      throw error;
    }
  }
}

export default QualityManagerService;

