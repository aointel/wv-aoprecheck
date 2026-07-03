import { Router } from 'express';
import SupabaseRolesService from './supabase-roles-service';

const router = Router();

// =====================================================
// ROLE MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/roles
 * Get all roles
 */
router.get('/roles', async (req, res) => {
  try {
    const roles = await SupabaseRolesService.getRoles();
    res.json({ success: true, roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch roles' });
  }
});

/**
 * GET /api/roles/:name
 * Get role by name
 */
router.get('/roles/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const role = await SupabaseRolesService.getRoleByName(name);
    
    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }
    
    res.json({ success: true, role });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch role' });
  }
});

/**
 * POST /api/roles
 * Create new role
 */
router.post('/roles', async (req, res) => {
  try {
    const roleData = req.body;
    const role = await SupabaseRolesService.createRole(roleData);
    res.json({ success: true, role });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ success: false, error: 'Failed to create role' });
  }
});

/**
 * PUT /api/roles/:id
 * Update role
 */
router.put('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const role = await SupabaseRolesService.updateRole(id, updates);
    res.json({ success: true, role });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

/**
 * DELETE /api/roles/:id
 * Delete role (soft delete)
 */
router.delete('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await SupabaseRolesService.deleteRole(id);
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ success: false, error: 'Failed to delete role' });
  }
});

// =====================================================
// PERMISSION MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/permissions
 * Get all permissions
 */
router.get('/permissions', async (req, res) => {
  try {
    const permissions = await SupabaseRolesService.getPermissions();
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch permissions' });
  }
});

/**
 * GET /api/permissions/category/:category
 * Get permissions by category
 */
router.get('/permissions/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const permissions = await SupabaseRolesService.getPermissionsByCategory(category);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Error fetching permissions by category:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch permissions' });
  }
});

// =====================================================
// USER ROLE MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/users/:email/roles
 * Get user's roles
 */
router.get('/users/:email/roles', async (req, res) => {
  try {
    const { email } = req.params;
    const roles = await SupabaseRolesService.getUserRoles(email);
    res.json({ success: true, roles });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user roles' });
  }
});

/**
 * POST /api/users/:email/roles
 * Assign role to user
 */
router.post('/users/:email/roles', async (req, res) => {
  try {
    const { email } = req.params;
    const { roleId, assignedBy, expiresAt } = req.body;
    
    if (!roleId || !assignedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'roleId and assignedBy are required' 
      });
    }
    
    const userRole = await SupabaseRolesService.assignRoleToUser(
      email, 
      roleId, 
      assignedBy, 
      expiresAt
    );
    
    res.json({ success: true, userRole });
  } catch (error) {
    console.error('Error assigning role to user:', error);
    res.status(500).json({ success: false, error: 'Failed to assign role to user' });
  }
});

/**
 * DELETE /api/users/:email/roles/:roleId
 * Remove role from user
 */
router.delete('/users/:email/roles/:roleId', async (req, res) => {
  try {
    const { email, roleId } = req.params;
    await SupabaseRolesService.removeRoleFromUser(email, roleId);
    res.json({ success: true, message: 'Role removed from user successfully' });
  } catch (error) {
    console.error('Error removing role from user:', error);
    res.status(500).json({ success: false, error: 'Failed to remove role from user' });
  }
});

// =====================================================
// PERMISSION CHECKING ROUTES
// =====================================================

/**
 * GET /api/users/:email/permissions
 * Get user's effective permissions
 */
router.get('/users/:email/permissions', async (req, res) => {
  try {
    const { email } = req.params;
    const permissions = await SupabaseRolesService.getUserPermissions(email);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user permissions' });
  }
});

/**
 * GET /api/users/:email/permissions/check
 * Check if user has specific permission
 */
router.get('/users/:email/permissions/check', async (req, res) => {
  try {
    const { email } = req.params;
    const { permission } = req.query;
    
    if (!permission) {
      return res.status(400).json({ 
        success: false, 
        error: 'permission query parameter is required' 
      });
    }
    
    const hasPermission = await SupabaseRolesService.userHasPermission(
      email, 
      permission as string
    );
    
    res.json({ success: true, hasPermission });
  } catch (error) {
    console.error('Error checking user permission:', error);
    res.status(500).json({ success: false, error: 'Failed to check user permission' });
  }
});

/**
 * GET /api/users/:email/pages/:pageName/access
 * Check if user can access a page
 */
router.get('/users/:email/pages/:pageName/access', async (req, res) => {
  try {
    const { email, pageName } = req.params;
    const canAccess = await SupabaseRolesService.userCanAccessPage(email, pageName);
    res.json({ success: true, canAccess });
  } catch (error) {
    console.error('Error checking page access:', error);
    res.status(500).json({ success: false, error: 'Failed to check page access' });
  }
});

/**
 * GET /api/users/:email/actions/:resource/:action/check
 * Check if user can perform action on resource
 */
router.get('/users/:email/actions/:resource/:action/check', async (req, res) => {
  try {
    const { email, resource, action } = req.params;
    const canPerform = await SupabaseRolesService.userCanPerformAction(email, resource, action);
    res.json({ success: true, canPerform });
  } catch (error) {
    console.error('Error checking action permission:', error);
    res.status(500).json({ success: false, error: 'Failed to check action permission' });
  }
});

// =====================================================
// TEAM ASSIGNMENT ROUTES
// =====================================================

/**
 * GET /api/users/:email/teams
 * Get user's team assignments
 */
router.get('/users/:email/teams', async (req, res) => {
  try {
    const { email } = req.params;
    const teams = await SupabaseRolesService.getUserTeamAssignments(email);
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Error fetching user team assignments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user team assignments' });
  }
});

/**
 * POST /api/users/:email/teams
 * Assign user to team
 */
router.post('/users/:email/teams', async (req, res) => {
  try {
    const { email } = req.params;
    const { teamType, teamName, assignedBy } = req.body;
    
    if (!teamType || !teamName || !assignedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'teamType, teamName, and assignedBy are required' 
      });
    }
    
    const teamAssignment = await SupabaseRolesService.assignUserToTeam(
      email, 
      teamType, 
      teamName, 
      assignedBy
    );
    
    res.json({ success: true, teamAssignment });
  } catch (error) {
    console.error('Error assigning user to team:', error);
    res.status(500).json({ success: false, error: 'Failed to assign user to team' });
  }
});

/**
 * DELETE /api/users/:email/teams/:teamType/:teamName
 * Remove user from team
 */
router.delete('/users/:email/teams/:teamType/:teamName', async (req, res) => {
  try {
    const { email, teamType, teamName } = req.params;
    await SupabaseRolesService.removeUserFromTeam(email, teamType as any, teamName);
    res.json({ success: true, message: 'User removed from team successfully' });
  } catch (error) {
    console.error('Error removing user from team:', error);
    res.status(500).json({ success: false, error: 'Failed to remove user from team' });
  }
});

// =====================================================
// PERMISSION OVERRIDE ROUTES
// =====================================================

/**
 * GET /api/users/:email/overrides
 * Get user's permission overrides
 */
router.get('/users/:email/overrides', async (req, res) => {
  try {
    const { email } = req.params;
    const overrides = await SupabaseRolesService.getUserPermissionOverrides(email);
    res.json({ success: true, overrides });
  } catch (error) {
    console.error('Error fetching user permission overrides:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user permission overrides' });
  }
});

/**
 * POST /api/users/:email/overrides/grant
 * Grant permission override to user
 */
router.post('/users/:email/overrides/grant', async (req, res) => {
  try {
    const { email } = req.params;
    const { permissionId, reason, grantedBy, expiresAt } = req.body;
    
    if (!permissionId || !reason || !grantedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'permissionId, reason, and grantedBy are required' 
      });
    }
    
    const override = await SupabaseRolesService.grantPermissionOverride(
      email, 
      permissionId, 
      reason, 
      grantedBy, 
      expiresAt
    );
    
    res.json({ success: true, override });
  } catch (error) {
    console.error('Error granting permission override:', error);
    res.status(500).json({ success: false, error: 'Failed to grant permission override' });
  }
});

/**
 * POST /api/users/:email/overrides/deny
 * Deny permission override to user
 */
router.post('/users/:email/overrides/deny', async (req, res) => {
  try {
    const { email } = req.params;
    const { permissionId, reason, grantedBy, expiresAt } = req.body;
    
    if (!permissionId || !reason || !grantedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'permissionId, reason, and grantedBy are required' 
      });
    }
    
    const override = await SupabaseRolesService.denyPermissionOverride(
      email, 
      permissionId, 
      reason, 
      grantedBy, 
      expiresAt
    );
    
    res.json({ success: true, override });
  } catch (error) {
    console.error('Error denying permission override:', error);
    res.status(500).json({ success: false, error: 'Failed to deny permission override' });
  }
});

// =====================================================
// AUDIT LOG ROUTES
// =====================================================

/**
 * GET /api/audit-logs
 * Get audit logs
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { limit = 100, offset = 0, adminEmail, targetUserEmail } = req.query;
    
    const logs = await SupabaseRolesService.getAuditLogs(
      parseInt(limit as string),
      parseInt(offset as string),
      adminEmail as string,
      targetUserEmail as string
    );
    
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// =====================================================
// UTILITY ROUTES
// =====================================================

/**
 * GET /api/users/:email/role-level
 * Get user's highest role level
 */
router.get('/users/:email/role-level', async (req, res) => {
  try {
    const { email } = req.params;
    const level = await SupabaseRolesService.getUserHighestRoleLevel(email);
    res.json({ success: true, level });
  } catch (error) {
    console.error('Error getting user role level:', error);
    res.status(500).json({ success: false, error: 'Failed to get user role level' });
  }
});

/**
 * GET /api/users/:email/is-admin
 * Check if user is admin or higher
 */
router.get('/users/:email/is-admin', async (req, res) => {
  try {
    const { email } = req.params;
    const isAdmin = await SupabaseRolesService.isUserAdmin(email);
    res.json({ success: true, isAdmin });
  } catch (error) {
    console.error('Error checking if user is admin:', error);
    res.status(500).json({ success: false, error: 'Failed to check if user is admin' });
  }
});

/**
 * GET /api/users/:email/is-super-admin
 * Check if user is super admin
 */
router.get('/users/:email/is-super-admin', async (req, res) => {
  try {
    const { email } = req.params;
    const isSuperAdmin = await SupabaseRolesService.isUserSuperAdmin(email);
    res.json({ success: true, isSuperAdmin });
  } catch (error) {
    console.error('Error checking if user is super admin:', error);
    res.status(500).json({ success: false, error: 'Failed to check if user is super admin' });
  }
});

/**
 * GET /api/roles/:roleName/users
 * Get all users with specific role
 */
router.get('/roles/:roleName/users', async (req, res) => {
  try {
    const { roleName } = req.params;
    const users = await SupabaseRolesService.getUsersWithRole(roleName);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users with role:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users with role' });
  }
});

/**
 * GET /api/roles/:roleId/permissions
 * Get role permissions
 */
router.get('/roles/:roleId/permissions', async (req, res) => {
  try {
    const { roleId } = req.params;
    const permissions = await SupabaseRolesService.getRolePermissions(roleId);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch role permissions' });
  }
});

/**
 * POST /api/roles/:roleId/permissions
 * Add permission to role
 */
router.post('/roles/:roleId/permissions', async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissionId, grantedBy } = req.body;
    
    if (!permissionId || !grantedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'permissionId and grantedBy are required' 
      });
    }
    
    await SupabaseRolesService.addPermissionToRole(roleId, permissionId, grantedBy);
    res.json({ success: true, message: 'Permission added to role successfully' });
  } catch (error) {
    console.error('Error adding permission to role:', error);
    res.status(500).json({ success: false, error: 'Failed to add permission to role' });
  }
});

/**
 * DELETE /api/roles/:roleId/permissions/:permissionId
 * Remove permission from role
 */
router.delete('/roles/:roleId/permissions/:permissionId', async (req, res) => {
  try {
    const { roleId, permissionId } = req.params;
    await SupabaseRolesService.removePermissionFromRole(roleId, permissionId);
    res.json({ success: true, message: 'Permission removed from role successfully' });
  } catch (error) {
    console.error('Error removing permission from role:', error);
    res.status(500).json({ success: false, error: 'Failed to remove permission from role' });
  }
});

export default router;

