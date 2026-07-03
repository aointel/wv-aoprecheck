import { Router } from 'express';
import QualityManagerService from './quality-manager-service';

const router = Router();

// =====================================================
// MGA TEAM MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/mga-teams
 * Get all MGA teams
 */
router.get('/mga-teams', async (req, res) => {
  try {
    const teams = await QualityManagerService.getMGATeams();
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Error fetching MGA teams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch MGA teams' });
  }
});

/**
 * POST /api/mga-teams
 * Create MGA team
 */
router.post('/mga-teams', async (req, res) => {
  try {
    const teamData = req.body;
    const team = await QualityManagerService.createMGATeam(teamData);
    res.json({ success: true, team });
  } catch (error) {
    console.error('Error creating MGA team:', error);
    res.status(500).json({ success: false, error: 'Failed to create MGA team' });
  }
});

/**
 * PUT /api/mga-teams/:id
 * Update MGA team
 */
router.put('/mga-teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const team = await QualityManagerService.updateMGATeam(id, updates);
    res.json({ success: true, team });
  } catch (error) {
    console.error('Error updating MGA team:', error);
    res.status(500).json({ success: false, error: 'Failed to update MGA team' });
  }
});

// =====================================================
// QUALITY MANAGER ASSIGNMENT ROUTES
// =====================================================

/**
 * GET /api/quality-managers/:email/mga-teams
 * Get Quality Manager's assigned MGA teams
 */
router.get('/quality-managers/:email/mga-teams', async (req, res) => {
  try {
    const { email } = req.params;
    const teams = await QualityManagerService.getQMMGATeams(email);
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Error fetching QM MGA teams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch QM MGA teams' });
  }
});

/**
 * GET /api/quality-managers/:email/agents
 * Get all agents a Quality Manager can access
 */
router.get('/quality-managers/:email/agents', async (req, res) => {
  try {
    const { email } = req.params;
    const agents = await QualityManagerService.getQMAccessibleAgents(email);
    res.json({ success: true, agents });
  } catch (error) {
    console.error('Error fetching QM accessible agents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch QM accessible agents' });
  }
});

/**
 * GET /api/quality-managers/:email/agents/:agentEmail/access
 * Check if Quality Manager can access specific agent
 */
router.get('/quality-managers/:email/agents/:agentEmail/access', async (req, res) => {
  try {
    const { email, agentEmail } = req.params;
    const canAccess = await QualityManagerService.qmCanAccessAgent(email, agentEmail);
    res.json({ success: true, canAccess });
  } catch (error) {
    console.error('Error checking QM agent access:', error);
    res.status(500).json({ success: false, error: 'Failed to check QM agent access' });
  }
});

/**
 * POST /api/quality-managers/:email/mga-teams
 * Assign Quality Manager to MGA team
 */
router.post('/quality-managers/:email/mga-teams', async (req, res) => {
  try {
    const { email } = req.params;
    const { mgaTeamId, assignedBy, expiresAt } = req.body;
    
    if (!mgaTeamId || !assignedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'mgaTeamId and assignedBy are required' 
      });
    }
    
    const assignment = await QualityManagerService.assignQMToMGATeam(
      email, 
      mgaTeamId, 
      assignedBy, 
      expiresAt
    );
    
    res.json({ success: true, assignment });
  } catch (error) {
    console.error('Error assigning QM to MGA team:', error);
    res.status(500).json({ success: false, error: 'Failed to assign QM to MGA team' });
  }
});

/**
 * DELETE /api/quality-managers/:email/mga-teams/:mgaTeamId
 * Remove Quality Manager from MGA team
 */
router.delete('/quality-managers/:email/mga-teams/:mgaTeamId', async (req, res) => {
  try {
    const { email, mgaTeamId } = req.params;
    await QualityManagerService.removeQMFromMGATeam(email, mgaTeamId);
    res.json({ success: true, message: 'QM removed from MGA team successfully' });
  } catch (error) {
    console.error('Error removing QM from MGA team:', error);
    res.status(500).json({ success: false, error: 'Failed to remove QM from MGA team' });
  }
});

/**
 * GET /api/quality-managers/assignments
 * Get all Quality Manager assignments
 */
router.get('/quality-managers/assignments', async (req, res) => {
  try {
    const assignments = await QualityManagerService.getAllQMAssignments();
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Error fetching QM assignments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch QM assignments' });
  }
});

/**
 * GET /api/mga-teams/:mgaTeamId/quality-managers
 * Get Quality Manager assignments for specific MGA team
 */
router.get('/mga-teams/:mgaTeamId/quality-managers', async (req, res) => {
  try {
    const { mgaTeamId } = req.params;
    const assignments = await QualityManagerService.getQMAssignmentsForTeam(mgaTeamId);
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Error fetching QM assignments for team:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch QM assignments for team' });
  }
});

// =====================================================
// AGENT MGA ASSIGNMENT ROUTES
// =====================================================

/**
 * GET /api/agents/:email/mga-teams
 * Get agent's MGA team assignments
 */
router.get('/agents/:email/mga-teams', async (req, res) => {
  try {
    const { email } = req.params;
    const assignments = await QualityManagerService.getAgentMGAAssignments(email);
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Error fetching agent MGA assignments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agent MGA assignments' });
  }
});

/**
 * POST /api/agents/:email/mga-teams
 * Assign agent to MGA team
 */
router.post('/agents/:email/mga-teams', async (req, res) => {
  try {
    const { email } = req.params;
    const { mgaTeamName } = req.body;
    
    if (!mgaTeamName) {
      return res.status(400).json({ 
        success: false, 
        error: 'mgaTeamName is required' 
      });
    }
    
    const assignment = await QualityManagerService.assignAgentToMGATeam(email, mgaTeamName);
    res.json({ success: true, assignment });
  } catch (error) {
    console.error('Error assigning agent to MGA team:', error);
    res.status(500).json({ success: false, error: 'Failed to assign agent to MGA team' });
  }
});

/**
 * DELETE /api/agents/:email/mga-teams/:mgaTeamName
 * Remove agent from MGA team
 */
router.delete('/agents/:email/mga-teams/:mgaTeamName', async (req, res) => {
  try {
    const { email, mgaTeamName } = req.params;
    await QualityManagerService.removeAgentFromMGATeam(email, mgaTeamName);
    res.json({ success: true, message: 'Agent removed from MGA team successfully' });
  } catch (error) {
    console.error('Error removing agent from MGA team:', error);
    res.status(500).json({ success: false, error: 'Failed to remove agent from MGA team' });
  }
});

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * POST /api/quality-managers/bulk-assign
 * Assign multiple Quality Managers to MGA teams
 */
router.post('/quality-managers/bulk-assign', async (req, res) => {
  try {
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ 
        success: false, 
        error: 'assignments must be an array' 
      });
    }
    
    const results = await QualityManagerService.bulkAssignQMs(assignments);
    res.json({ success: true, assignments: results });
  } catch (error) {
    console.error('Error bulk assigning QMs:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk assign QMs' });
  }
});

/**
 * POST /api/agents/bulk-assign
 * Assign multiple agents to MGA teams
 */
router.post('/agents/bulk-assign', async (req, res) => {
  try {
    const { assignments } = req.body;
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ 
        success: false, 
        error: 'assignments must be an array' 
      });
    }
    
    const results = await QualityManagerService.bulkAssignAgents(assignments);
    res.json({ success: true, assignments: results });
  } catch (error) {
    console.error('Error bulk assigning agents:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk assign agents' });
  }
});

// =====================================================
// MIGRATION AND UTILITIES
// =====================================================

/**
 * POST /api/mga-teams/migrate-from-producerlist
 * Migrate MGA teams from producerlist
 */
router.post('/mga-teams/migrate-from-producerlist', async (req, res) => {
  try {
    const results = await QualityManagerService.migrateFromProducerlist();
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error migrating from producerlist:', error);
    res.status(500).json({ success: false, error: 'Failed to migrate from producerlist' });
  }
});

/**
 * GET /api/quality-managers/:email/data-access
 * Get Quality Manager data access summary
 */
router.get('/quality-managers/:email/data-access', async (req, res) => {
  try {
    const { email } = req.params;
    const dataAccess = await QualityManagerService.getQMDataAccess(email);
    res.json({ success: true, dataAccess });
  } catch (error) {
    console.error('Error fetching QM data access:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch QM data access' });
  }
});

/**
 * GET /api/quality-managers/:email/permissions
 * Get Quality Manager permissions with agent details
 */
router.get('/quality-managers/:email/permissions', async (req, res) => {
  try {
    const { email } = req.params;
    const permissions = await QualityManagerService.getQMPermissions(email);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Error fetching QM permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch QM permissions' });
  }
});

// =====================================================
// VALIDATION AND STATISTICS
// =====================================================

/**
 * GET /api/mga-teams/:mgaTeamId/has-quality-managers
 * Check if MGA team has Quality Managers assigned
 */
router.get('/mga-teams/:mgaTeamId/has-quality-managers', async (req, res) => {
  try {
    const { mgaTeamId } = req.params;
    const hasQMs = await QualityManagerService.teamHasQMs(mgaTeamId);
    res.json({ success: true, hasQMs });
  } catch (error) {
    console.error('Error checking if team has QMs:', error);
    res.status(500).json({ success: false, error: 'Failed to check if team has QMs' });
  }
});

/**
 * GET /api/mga-teams/without-quality-managers
 * Get teams without Quality Managers
 */
router.get('/mga-teams/without-quality-managers', async (req, res) => {
  try {
    const teams = await QualityManagerService.getTeamsWithoutQMs();
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Error fetching teams without QMs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch teams without QMs' });
  }
});

/**
 * GET /api/quality-managers/assignment-stats
 * Get Quality Manager assignment statistics
 */
router.get('/quality-managers/assignment-stats', async (req, res) => {
  try {
    const stats = await QualityManagerService.getQMAssignmentStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching QM assignment stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch QM assignment stats' });
  }
});

export default router;

