import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './hardcoded-config';

export interface UserPermissions {
  role: 'system_admin' | 'rga' | 'mga' | 'agent' | 'quality_manager' | 'ao_quality_manager';
  mgaTeam?: string;
  rgaTeam?: string;
  canViewAll: boolean;
  allowedMgaTeams: string[];
  allowedRgaTeams: string[];
  precheck: {
    readScope: 'assigned_mga' | 'all';
    canUpdateStatus: boolean;
    viewPII: boolean;
    evidenceAccess: 'none' | 'thumbnails' | 'full';
  };
}

/**
 * Get user permissions and team access based on their role and team assignments
 */
export async function getUserPermissions(userEmail: string): Promise<UserPermissions> {
  try {
    console.log(`🔐 Getting permissions for user: ${userEmail}`);
    
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // FIRST: Check if user is SYSTEM ADMIN (cnsysop, richiealtig, etc.) - FULL ACCESS TO EVERYTHING
    const systemAdmins = [
      'cnsysop@aoglobelife.com',
      'richiealtig@aoglobelife.com',
      'leyna@aoglobelife.com',
      'leynatran@aoglobelife.com',
      'nateschoot@aoglobelife.com'
    ];
    
    if (systemAdmins.includes(userEmail)) {
      console.log(`🔐 SYSTEM ADMIN found: ${userEmail} - FULL UNRESTRICTED ACCESS TO ALL SESSIONS`);
      return {
        role: 'system_admin',
        canViewAll: true,
        allowedMgaTeams: [],
        allowedRgaTeams: [],
        precheck: {
          readScope: 'all',
          canUpdateStatus: true,
          viewPII: true,
          evidenceAccess: 'full'
        }
      };
    }

    // SECOND: Check if user is an AO Quality Manager (has admin privileges)
    // This check must come BEFORE regular QM check to prevent super QMs from getting limited access
    const superQualityManagers = [
      'admin@aoprecheck.net',
      'dianabarreiro@aoglobelife.com',
      'radojkamanojlovic@aoglobelife.com',
      'daniellenoble@aoglobelife.com',
      'robhay@aoglobelife.com',
      'danielnobel@aoglobelife.com',
      'bengore@aoglobelife.com',
      'fabiolamontiel@aoglobelife.com',
      'randytrahan@aoglobelife.com'
      // NOTE: Leyna Tran is SUPER ADMIN (in systemAdmins above), not QM
    ];
    
    if (superQualityManagers.includes(userEmail) || userEmail.includes('admin')) {
      console.log(`🌍 AO Quality Manager found: ${userEmail} - UNFILTERED ACCESS TO ALL SESSIONS`);
      return {
        role: 'ao_quality_manager',
        canViewAll: true,
        allowedMgaTeams: [],
        allowedRgaTeams: [],
        precheck: {
          readScope: 'all',
          canUpdateStatus: true,
          viewPII: true,
          evidenceAccess: 'full'
        }
      };
    }

    // THIRD: Check if user is a Quality Manager with limited team access
    const { data: qmTeamsResult, error: qmTeamsError } = await supabase
      .from('qm_mga_assignments')
      .select('mga')
      .eq('quality_manager', userEmail);
    
    if (!qmTeamsError && qmTeamsResult && qmTeamsResult.length > 0) {
      const assignedTeams = qmTeamsResult.map((row: any) => row.mga);
      
      console.log(`🎯 Quality Manager found: ${userEmail} with teams:`, assignedTeams);
      
      return {
        role: 'quality_manager',
        canViewAll: false,
        allowedMgaTeams: assignedTeams,
        allowedRgaTeams: [],
        precheck: {
          readScope: 'assigned_mga',
          canUpdateStatus: true,
          viewPII: true,
          evidenceAccess: 'full'
        }
      };
    }

    // Default to agent role for all other users
    console.log(`👤 Agent role assigned to: ${userEmail}`);
    return {
      role: 'agent',
      canViewAll: false,
      allowedMgaTeams: [],
      allowedRgaTeams: [],
      precheck: {
        readScope: 'assigned_mga',
        canUpdateStatus: false,
        viewPII: false,
        evidenceAccess: 'none'
      }
    };

  } catch (error) {
    console.error('❌ Error in getUserPermissions:', error);
    // Return safe default on error
    return {
      role: 'agent',
      canViewAll: false,
      allowedMgaTeams: [],
      allowedRgaTeams: [],
      precheck: {
        readScope: 'assigned_mga',
        canUpdateStatus: false,
        viewPII: false,
        evidenceAccess: 'none'
      }
    };
  }
}
