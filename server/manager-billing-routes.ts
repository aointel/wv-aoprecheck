import type { Express } from 'express';
import { ManagerBillingService } from './manager-billing-service';

export function registerManagerBillingRoutes(app: Express) {
  console.log('📋 Registering Manager Billing Portal routes...');

  /**
   * Get manager info - check if user is MGA/RGA
   */
  app.get('/api/manager-billing/manager-info', async (req, res) => {
    try {
      const email = req.query.email as string;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      const managerInfo = await ManagerBillingService.getManagerInfo(email);
      
      res.json(managerInfo);
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/manager-info:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Get actual team members for a manager (filtered by MGA/RGA hierarchy and billing transactions)
   * This is used for the "Your Team" section
   */
  app.get('/api/manager-billing/actual-team-agents', async (req, res) => {
    try {
      const managerEmail = req.query.managerEmail as string;
      
      if (!managerEmail) {
        return res.status(400).json({ error: 'Manager email is required' });
      }
      
      // Verify manager status
      const managerInfo = await ManagerBillingService.getManagerInfo(managerEmail);
      if (!managerInfo.isManager) {
        return res.status(403).json({ error: 'User is not a manager' });
      }
      
      const agents = await ManagerBillingService.getActualTeamAgents(managerEmail);
      
      res.json({ agents });
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/actual-team-agents:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Get ALL customers that a manager can allocate credits to (for search/allocation)
   * No team restrictions - managers can pay for anyone's calls
   */
  app.get('/api/manager-billing/team-agents', async (req, res) => {
    try {
      const managerEmail = req.query.managerEmail as string;
      
      if (!managerEmail) {
        return res.status(400).json({ error: 'Manager email is required' });
      }
      
      // Verify manager status
      const managerInfo = await ManagerBillingService.getManagerInfo(managerEmail);
      if (!managerInfo.isManager) {
        return res.status(403).json({ error: 'User is not a manager' });
      }
      
      const agents = await ManagerBillingService.getTeamAgents(managerEmail);
      
      res.json({ agents });
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/team-agents:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Get manager's allocations
   */
  app.get('/api/manager-billing/allocations', async (req, res) => {
    try {
      const managerEmail = req.query.managerEmail as string;
      
      if (!managerEmail) {
        return res.status(400).json({ error: 'Manager email is required' });
      }
      
      const managerInfo = await ManagerBillingService.getManagerInfo(managerEmail);
      if (!managerInfo.isManager) {
        return res.status(403).json({ error: 'User is not a manager' });
      }
      
      const allocations = await ManagerBillingService.getAllocations(managerEmail);
      
      res.json({ allocations });
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/allocations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Get manager's transactions
   */
  app.get('/api/manager-billing/transactions', async (req, res) => {
    try {
      const managerEmail = req.query.managerEmail as string;
      const limit = parseInt(req.query.limit as string) || 50;
      
      if (!managerEmail) {
        return res.status(400).json({ error: 'Manager email is required' });
      }
      
      const managerInfo = await ManagerBillingService.getManagerInfo(managerEmail);
      if (!managerInfo.isManager) {
        return res.status(403).json({ error: 'User is not a manager' });
      }
      
      const transactions = await ManagerBillingService.getTransactions(managerEmail, limit);
      
      res.json({ transactions });
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/transactions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Get manager's credit balance
   */
  app.get('/api/manager-billing/balance', async (req, res) => {
    try {
      const managerEmail = req.query.managerEmail as string;
      
      if (!managerEmail) {
        return res.status(400).json({ error: 'Manager email is required' });
      }
      
      const managerInfo = await ManagerBillingService.getManagerInfo(managerEmail);
      if (!managerInfo.isManager) {
        return res.status(403).json({ error: 'User is not a manager' });
      }
      
      const balance = await ManagerBillingService.getBalance(managerEmail);
      
      res.json(balance);
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/balance:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * Create a new billing allocation
   */
  app.post('/api/manager-billing/allocate', async (req, res) => {
    try {
      const { managerEmail, agentEmail, serviceType, allocationType, creditsAmount, notes } = req.body;
      
      console.log('📝 Allocation request:', { managerEmail, agentEmail, serviceType, allocationType, creditsAmount });
      
      if (!managerEmail || !agentEmail || !serviceType) {
        console.error('❌ Missing required fields:', { managerEmail: !!managerEmail, agentEmail: !!agentEmail, serviceType: !!serviceType });
        return res.status(400).json({ 
          success: false, 
          error: 'Manager email, agent email, and service type are required' 
        });
      }
      
      // Verify manager status
      const managerInfo = await ManagerBillingService.getManagerInfo(managerEmail);
      if (!managerInfo.isManager) {
        console.error(`❌ User ${managerEmail} is not a manager`);
        return res.status(403).json({ success: false, error: 'User is not a manager' });
      }
      
      const result = await ManagerBillingService.createAllocation({
        managerEmail,
        agentEmail,
        serviceType,
        allocationType: allocationType || 'credits',
        creditsAmount: creditsAmount || 100,
        notes
      });
      
      if (!result.success) {
        console.error('❌ Allocation creation failed:', result.error);
        return res.status(400).json(result);
      }
      
      console.log('✅ Allocation created successfully');
      res.json(result);
      
    } catch (error: any) {
      console.error('❌ Error in /api/manager-billing/allocate:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  });

  /**
   * Cancel an allocation
   */
  app.post('/api/manager-billing/cancel-allocation', async (req, res) => {
    try {
      const { managerEmail, allocationId } = req.body;
      
      if (!managerEmail || !allocationId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Manager email and allocation ID are required' 
        });
      }
      
      const managerInfo = await ManagerBillingService.getManagerInfo(managerEmail);
      if (!managerInfo.isManager) {
        return res.status(403).json({ success: false, error: 'User is not a manager' });
      }
      
      const result = await ManagerBillingService.cancelAllocation(allocationId, managerEmail);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/cancel-allocation:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * Record a transaction (called by billing system when agent uses a service)
   */
  app.post('/api/manager-billing/record-transaction', async (req, res) => {
    try {
      const { agentEmail, serviceType, leadId, leadName, leadPhone, callDuration, sourceTable, sourceId } = req.body;
      
      if (!agentEmail || !serviceType) {
        return res.status(400).json({ 
          success: false, 
          error: 'Agent email and service type are required' 
        });
      }
      
      const result = await ManagerBillingService.recordTransaction({
        agentEmail,
        serviceType,
        leadId,
        leadName,
        leadPhone,
        callDuration,
        sourceTable,
        sourceId
      });
      
      res.json(result);
      
    } catch (error) {
      console.error('❌ Error in /api/manager-billing/record-transaction:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  console.log('✅ Manager Billing Portal routes registered');
}














