import { supabaseAdmin, supabase } from './supabase';
import { getMgaRgaDetails } from './mga-rga-checker';

// Service pricing
const SERVICE_PRICES: Record<string, number> = {
  connect: 8.00,
  recruit: 5.00,
  precheck: 4.00,
  hotconnect: 2.00
};

export interface ManagerInfo {
  isManager: boolean;
  role?: string;
  name?: string;
  associateId?: number;
  email: string;
}

export interface TeamAgent {
  associate_id: number;
  agent_name: string;
  company_email: string;
  mga: string | null;
  rga: string | null;
  current_balance?: number;
}

export interface Allocation {
  id: number;
  allocation_id: string;
  manager_email: string;
  manager_name: string;
  agent_email: string;
  agent_name: string;
  agent_associate_id: number;
  service_type: string;
  allocation_type: string;
  credits_allocated: number;
  credits_used: number;
  credits_remaining: number;
  total_amount_allocated: number;
  total_amount_used: number;
  total_amount_remaining: number;
  status: string;
  start_date: string;
  end_date?: string;
  notes?: string;
}

export interface Transaction {
  id: number;
  transaction_id: string;
  manager_email: string;
  agent_email: string;
  agent_name: string;
  service_type: string;
  amount_charged: number;
  credits_deducted: number;
  lead_id?: string;
  lead_name?: string;
  lead_phone?: string;
  transaction_date: string;
  status: string;
}

export interface ManagerBalance {
  credits_balance: number;
  credits_purchased: number;
  credits_used: number;
  dollar_balance: number;
  total_spent: number;
  account_status: string;
}

export class ManagerBillingService {
  private static normalizeManagerRoleForBilling(role: string | undefined | null): string {
    const normalized = String(role || '').toUpperCase().trim();
    // manager_credit_balance has a strict role CHECK; map non-manager roles safely.
    if (normalized === 'ADMIN' || normalized === 'MGA' || normalized === 'RGA') return normalized;
    return 'MGA';
  }
  
  /**
   * Check if a user is an MGA/RGA manager
   */
  static async getManagerInfo(email: string): Promise<ManagerInfo> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log(`🔍 Checking manager status for: ${normalizedEmail}`);
      
      // System admins always have manager access
      const systemAdmins = ['cnsysop@aoglobelife.com', 'nateschoot@aoglobelife.com'];
      if (systemAdmins.includes(normalizedEmail)) {
        console.log(`✅ ${normalizedEmail} is SYSTEM ADMIN - granting manager access`);
        return {
          isManager: true,
          role: 'ADMIN',
          name: 'System Admin',
          email: normalizedEmail
        };
      }
      
      const mgaRgaDetails = await getMgaRgaDetails(normalizedEmail);
      
      if (mgaRgaDetails.isMgaRga) {
        console.log(`✅ ${normalizedEmail} is a ${mgaRgaDetails.role}: ${mgaRgaDetails.name}`);
        return {
          isManager: true,
          role: mgaRgaDetails.role,
          name: mgaRgaDetails.name,
          associateId: mgaRgaDetails.associateId,
          email: normalizedEmail
        };
      }
      
      // Also check if they exist in customers table - anyone can be a "manager" for billing purposes
      if (supabaseAdmin) {
        const { data: customerData } = await supabaseAdmin
          .from('customers')
          .select('associate_id, first_name, last_name, company_email')
          .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
          .maybeSingle();
        
        // Any customer can allocate credits to others - no hierarchy restrictions
        if (customerData) {
          const customerName = `${customerData.first_name || ''} ${customerData.last_name || ''}`.trim();
          console.log(`✅ ${normalizedEmail} is a customer - granting manager billing access`);
          return {
            isManager: true,
            role: 'CUSTOMER',
            name: customerName || normalizedEmail,
            associateId: customerData.associate_id,
            email: normalizedEmail
          };
        }
      }
      
      console.log(`⚠️ ${normalizedEmail} is NOT a manager`);
      return {
        isManager: false,
        email: normalizedEmail
      };
      
    } catch (error) {
      console.error(`❌ Error checking manager status for ${email}:`, error);
      return { isManager: false, email: email.toLowerCase() };
    }
  }

  /**
   * Get actual team members for a manager (filtered by MGA/RGA hierarchy and billing transactions)
   * This is used for the "Your Team" section
   */
  static async getActualTeamAgents(managerEmail: string): Promise<TeamAgent[]> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin not initialized');
        return [];
      }

      const normalizedEmail = managerEmail.toLowerCase().trim();
      console.log(`🔍 Getting actual team members for: ${normalizedEmail}`);
      
      // Get manager info to determine their associate_id
      const managerInfo = await this.getManagerInfo(normalizedEmail);
      if (!managerInfo.isManager || !managerInfo.associateId) {
        console.log(`⚠️ ${normalizedEmail} is not a manager or has no associate_id`);
        return [];
      }

      const managerAssociateId = managerInfo.associateId;
      const teamAgentEmails = new Set<string>();
      const teamAgentsMap = new Map<string, TeamAgent>();

      // 1. Get agents from agent_hierarchy where manager is MGA or RGA
      const { data: mgaAgents } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email, agent_name, agent_associate_id')
        .eq('mga_associate_id', managerAssociateId)
        .not('agent_email', 'is', null)
        .limit(10000);

      const { data: rgaAgents } = await supabaseAdmin
        .from('agent_hierarchy')
        .select('agent_email, agent_name, agent_associate_id')
        .eq('rga_associate_id', managerAssociateId)
        .not('agent_email', 'is', null)
        .limit(10000);

      // Combine hierarchy agents
      [...(mgaAgents || []), ...(rgaAgents || [])].forEach(agent => {
        const email = agent.agent_email?.toLowerCase();
        if (email) {
          teamAgentEmails.add(email);
          // Get customer details for this agent
          teamAgentsMap.set(email, {
            associate_id: agent.agent_associate_id || 0,
            agent_name: agent.agent_name || email,
            company_email: agent.agent_email || email,
            mga: null, // Will be filled from customers table
            rga: null
          });
        }
      });

      console.log(`✅ Found ${teamAgentEmails.size} agents from hierarchy`);

      // 2. Get agents who have billing transactions (including missed calls) where manager has allocated credits
      // Check manager_billing_allocations for active allocations
      const { data: allocations } = await supabaseAdmin
        .from('manager_billing_allocations')
        .select('agent_email, agent_name, agent_associate_id')
        .eq('manager_email', normalizedEmail)
        .eq('status', 'active')
        .not('agent_email', 'is', null)
        .limit(10000);

      (allocations || []).forEach(allocation => {
        const email = allocation.agent_email?.toLowerCase();
        if (email && !teamAgentEmails.has(email)) {
          teamAgentEmails.add(email);
          teamAgentsMap.set(email, {
            associate_id: allocation.agent_associate_id || 0,
            agent_name: allocation.agent_name || email,
            company_email: allocation.agent_email || email,
            mga: null,
            rga: null
          });
        }
      });

      console.log(`✅ Found ${teamAgentEmails.size} total team members (including allocations)`);

      // 3. Get agents who have billing transactions (including missed calls) where manager has allocated credits
      // Check billing_transactions for agents with active allocations
      if (teamAgentEmails.size > 0) {
        const emailArray = Array.from(teamAgentEmails);
        const { data: transactions } = await supabaseAdmin
          .from('billing_transactions')
          .select('agent_email, agent_associate_id, agent_name, transaction_type')
          .in('agent_email', emailArray)
          .in('transaction_type', ['missed_call', 'connect', 'precheck', 'recruit', 'hotconnect'])
          .limit(10000);

        // Also check for agents with missed calls specifically
        const { data: missedCallTransactions } = await supabaseAdmin
          .from('billing_transactions')
          .select('agent_email, agent_associate_id, agent_name')
          .eq('transaction_type', 'missed_call')
          .in('agent_email', emailArray)
          .limit(10000);

        console.log(`✅ Found ${transactions?.length || 0} billing transactions (including ${missedCallTransactions?.length || 0} missed calls) for team members`);
      }

      // 4. Get customer details (MGA/RGA) for all team agents
      if (teamAgentEmails.size > 0) {
        const emailArray = Array.from(teamAgentEmails);
        
        // Query customers by company_email
        const { data: customersByCompany } = await supabaseAdmin
          .from('customers')
          .select('associate_id, first_name, last_name, company_email, personal_email, mga, rga')
          .in('company_email', emailArray)
          .limit(10000);
        
        // Query customers by personal_email
        const { data: customersByPersonal } = await supabaseAdmin
          .from('customers')
          .select('associate_id, first_name, last_name, company_email, personal_email, mga, rga')
          .in('personal_email', emailArray)
          .limit(10000);
        
        // Combine and deduplicate
        const allCustomers = [...(customersByCompany || []), ...(customersByPersonal || [])];
        const seenCustomerIds = new Set<number>();
        const customers = allCustomers.filter(c => {
          if (c.associate_id && seenCustomerIds.has(c.associate_id)) {
            return false;
          }
          if (c.associate_id) {
            seenCustomerIds.add(c.associate_id);
          }
          return true;
        });

        customers.forEach(customer => {
          const email = (customer.company_email || customer.personal_email)?.toLowerCase();
          if (email && teamAgentsMap.has(email)) {
            const agent = teamAgentsMap.get(email)!;
            agent.mga = customer.mga || null;
            agent.rga = customer.rga || null;
            if (!agent.agent_name || agent.agent_name === email) {
              const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
              if (fullName) {
                agent.agent_name = fullName;
              }
            }
            if (!agent.associate_id && customer.associate_id) {
              agent.associate_id = customer.associate_id;
            }
          }
        });
      }

      const result = Array.from(teamAgentsMap.values());
      console.log(`✅ Returning ${result.length} actual team members`);
      return result;

    } catch (error) {
      console.error(`❌ Error getting actual team members for ${managerEmail}:`, error);
      return [];
    }
  }

  /**
   * Get ALL customers that a manager can allocate credits to
   * No team restrictions - managers can pay for anyone's calls
   * This is used for the search/allocation dropdown
   */
  static async getTeamAgents(managerEmail: string): Promise<TeamAgent[]> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin not initialized');
        return [];
      }

      const normalizedEmail = managerEmail.toLowerCase().trim();
      console.log(`🔍 Getting all available agents from customers table for: ${normalizedEmail}`);
      
      // Get ALL customers from customers table - no team restrictions
      // Query all customers that have either company_email or personal_email
      const { data: allCustomers, error } = await supabaseAdmin
        .from('customers')
        .select('associate_id, first_name, last_name, company_email, personal_email, mga, rga')
        .not('company_email', 'is', null)
        .order('last_name')
        .limit(20000); // Increased to 20000 to ensure we get everyone
      
      if (error) {
        console.error('❌ Error fetching customers:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        return [];
      }
      
      console.log(`✅ Found ${allCustomers?.length || 0} customers available for allocation`);
      
      // Also get customers with only personal_email (no company_email)
      const { data: personalEmailCustomers, error: personalError } = await supabaseAdmin
        .from('customers')
        .select('associate_id, first_name, last_name, company_email, personal_email, mga, rga')
        .is('company_email', null)
        .not('personal_email', 'is', null)
        .order('last_name')
        .limit(20000);
      
      if (personalError) {
        console.error('❌ Error fetching personal_email customers:', personalError);
      } else {
        console.log(`✅ Found ${personalEmailCustomers?.length || 0} additional customers with personal_email only`);
      }
      
      // Combine both results
      const combinedCustomers = [
        ...(allCustomers || []),
        ...(personalEmailCustomers || [])
      ];
      
      console.log(`✅ Total customers found: ${combinedCustomers.length}`);
      
      // Map customers to team agents, using company_email first, then personal_email
      const agents: TeamAgent[] = [];
      const seenEmails = new Set<string>();
      
      for (const c of combinedCustomers) {
        // Use company_email if available, otherwise personal_email
        const email = c.company_email || c.personal_email;
        if (!email || seenEmails.has(email.toLowerCase())) {
          continue; // Skip duplicates
        }
        
        seenEmails.add(email.toLowerCase());
        
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        const agentName = fullName || email;
        
        agents.push({
          associate_id: c.associate_id || 0,
          agent_name: agentName,
          company_email: email,
          mga: c.mga || null,
          rga: c.rga || null
        });
      }
      
      console.log(`✅ Returning ${agents.length} unique agents for search`);
      if (agents.length === 0) {
        console.error('⚠️ WARNING: No agents found! Check customers table.');
      }
      return agents;
      
    } catch (error) {
      console.error(`❌ Error getting customers for ${managerEmail}:`, error);
      return [];
    }
  }

  /**
   * Get manager's billing allocations
   */
  static async getAllocations(managerEmail: string): Promise<Allocation[]> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin not initialized');
        return [];
      }

      const normalizedEmail = managerEmail.toLowerCase().trim();
      
      const { data, error } = await supabaseAdmin
        .from('manager_billing_allocations')
        .select('*')
        .eq('manager_email', normalizedEmail)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching allocations:', error);
        return [];
      }
      
      return data || [];
      
    } catch (error) {
      console.error(`❌ Error getting allocations for ${managerEmail}:`, error);
      return [];
    }
  }

  /**
   * Get manager's billing transactions
   */
  static async getTransactions(managerEmail: string, limit: number = 50): Promise<Transaction[]> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin not initialized');
        return [];
      }

      const normalizedEmail = managerEmail.toLowerCase().trim();
      
      const { data, error } = await supabaseAdmin
        .from('manager_billing_transactions')
        .select('*')
        .eq('manager_email', normalizedEmail)
        .order('transaction_date', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('❌ Error fetching transactions:', error);
        return [];
      }
      
      return data || [];
      
    } catch (error) {
      console.error(`❌ Error getting transactions for ${managerEmail}:`, error);
      return [];
    }
  }

  /**
   * Get manager's credit balance
   */
  static async getBalance(managerEmail: string): Promise<ManagerBalance | null> {
    try {
      if (!supabaseAdmin) {
        console.error('❌ Supabase admin not initialized');
        return null;
      }

      const normalizedEmail = managerEmail.toLowerCase().trim();
      
      const { data, error } = await supabaseAdmin
        .from('manager_credit_balance')
        .select('*')
        .eq('manager_email', normalizedEmail)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error fetching balance:', error);
        return null;
      }
      
      if (!data) {
        // Create initial balance record
        const managerInfo = await this.getManagerInfo(normalizedEmail);
        const managerRole = this.normalizeManagerRoleForBilling(managerInfo.role);
        
        const { data: newBalance, error: insertError } = await supabaseAdmin
          .from('manager_credit_balance')
          .insert({
            manager_email: normalizedEmail,
            manager_name: managerInfo.name || 'Unknown',
            manager_role: managerRole,
            credits_balance: 100, // Start with 100 credits
            credits_purchased: 100,
            credits_used: 0,
            dollar_balance: 0,
            total_spent: 0,
            account_status: 'active'
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Error creating balance record:', insertError);
          return {
            credits_balance: 100,
            credits_purchased: 100,
            credits_used: 0,
            dollar_balance: 0,
            total_spent: 0,
            account_status: 'active'
          };
        }
        
        return newBalance;
      }
      
      return data;
      
    } catch (error) {
      console.error(`❌ Error getting balance for ${managerEmail}:`, error);
      return null;
    }
  }

  /**
   * Create a new billing allocation
   */
  static async createAllocation(params: {
    managerEmail: string;
    agentEmail: string;
    serviceType: string;
    allocationType: 'credits' | 'unlimited';
    creditsAmount?: number;
    notes?: string;
  }): Promise<{ success: boolean; allocation?: Allocation; error?: string }> {
    try {
      if (!supabaseAdmin) {
        return { success: false, error: 'Database not initialized' };
      }

      const { managerEmail, agentEmail, serviceType, allocationType, creditsAmount = 0, notes } = params;
      const normalizedManagerEmail = managerEmail.toLowerCase().trim();
      const normalizedAgentEmail = agentEmail.toLowerCase().trim();
      
      console.log(`📝 Creating allocation: Manager ${normalizedManagerEmail} -> Agent ${normalizedAgentEmail} for ${serviceType}`);
      
      // Get manager info
      const managerInfo = await this.getManagerInfo(normalizedManagerEmail);
      if (!managerInfo.isManager) {
        return { success: false, error: 'User is not a manager' };
      }
      const managerRole = this.normalizeManagerRoleForBilling(managerInfo.role);
      
      // Get agent info from customers table - NO team restrictions
      // Try company_email first
      let { data: agentData, error: agentError } = await supabaseAdmin
        .from('customers')
        .select('associate_id, first_name, last_name, company_email, personal_email')
        .eq('company_email', normalizedAgentEmail)
        .maybeSingle();
      
      // If not found, try personal_email
      if (!agentData) {
        const { data: personalData, error: personalError } = await supabaseAdmin
          .from('customers')
          .select('associate_id, first_name, last_name, company_email, personal_email')
          .eq('personal_email', normalizedAgentEmail)
          .maybeSingle();
        
        if (personalError) {
          console.error('❌ Error looking up agent by personal_email:', personalError);
        }
        agentData = personalData;
      }
      
      if (!agentData) {
        console.error(`❌ Agent not found: ${normalizedAgentEmail}`);
        return { success: false, error: `Agent ${normalizedAgentEmail} not found in customers table` };
      }
      
      console.log(`✅ Found agent: ${agentData.first_name} ${agentData.last_name} (${agentData.company_email || agentData.personal_email})`);
      
      // NO TEAM RESTRICTIONS - Any manager can allocate to any customer
      console.log(`✅ Manager ${normalizedManagerEmail} allocating to ${normalizedAgentEmail} (no team restrictions)`);
      
      // Build agent name from first/last name
      const agentName = `${agentData.first_name || ''} ${agentData.last_name || ''}`.trim() || normalizedAgentEmail;
      
      // Calculate amounts
      const price = SERVICE_PRICES[serviceType] || 8.00;
      const totalAmount = allocationType === 'unlimited' ? 0 : creditsAmount * price;
      
      // Check if allocation already exists for this agent + service
      const { data: existingAllocation } = await supabaseAdmin
        .from('manager_billing_allocations')
        .select('*')
        .eq('manager_email', normalizedManagerEmail)
        .eq('agent_email', normalizedAgentEmail)
        .eq('service_type', serviceType)
        .eq('status', 'active')
        .maybeSingle();
      
      if (existingAllocation) {
        // Update existing allocation instead of creating new
        const newCredits = existingAllocation.credits_allocated + creditsAmount;
        const newAmount = existingAllocation.total_amount_allocated + totalAmount;
        
        const { data: updatedAllocation, error: updateError } = await supabaseAdmin
          .from('manager_billing_allocations')
          .update({
            credits_allocated: allocationType === 'unlimited' ? 0 : newCredits,
            credits_remaining: allocationType === 'unlimited' ? 0 : newCredits - existingAllocation.credits_used,
            total_amount_allocated: newAmount,
            total_amount_remaining: newAmount - existingAllocation.total_amount_used,
            allocation_type: allocationType,
            notes: notes || existingAllocation.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAllocation.id)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ Error updating allocation:', updateError);
          return { success: false, error: 'Failed to update allocation' };
        }
        
        console.log(`✅ Updated existing allocation for ${normalizedAgentEmail}`);
        return { success: true, allocation: updatedAllocation };
      }
      
      // Create new allocation
      const { data: newAllocation, error: insertError } = await supabaseAdmin
        .from('manager_billing_allocations')
        .insert({
          manager_email: normalizedManagerEmail,
          manager_associate_id: managerInfo.associateId,
          manager_name: managerInfo.name,
          manager_role: managerRole,
          agent_email: normalizedAgentEmail,
          agent_associate_id: agentData.associate_id,
          agent_name: agentName,
          service_type: serviceType,
          allocation_type: allocationType,
          credits_allocated: allocationType === 'unlimited' ? 0 : creditsAmount,
          credits_used: 0,
          credits_remaining: allocationType === 'unlimited' ? 0 : creditsAmount,
          total_amount_allocated: totalAmount,
          total_amount_used: 0,
          total_amount_remaining: totalAmount,
          billing_to: 'manager',
          status: 'active',
          notes: notes,
          start_date: new Date().toISOString()
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Error creating allocation:', insertError);
        console.error('❌ Insert error details:', JSON.stringify(insertError, null, 2));
        return { success: false, error: `Failed to create allocation: ${insertError.message || 'Database error'}` };
      }
      
      console.log(`✅ Created new allocation for ${normalizedAgentEmail}: ${allocationType === 'unlimited' ? 'Unlimited' : creditsAmount + ' credits'}`);
      return { success: true, allocation: newAllocation };
      
    } catch (error) {
      console.error('❌ Error in createAllocation:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Record a transaction when an agent uses a covered service
   * This is called by the billing system when a call is made
   */
  static async recordTransaction(params: {
    agentEmail: string;
    serviceType: string;
    leadId?: string;
    leadName?: string;
    leadPhone?: string;
    callDuration?: number;
    sourceTable?: string;
    sourceId?: string;
  }): Promise<{ success: boolean; billedToManager: boolean; managerEmail?: string; error?: string }> {
    try {
      if (!supabaseAdmin) {
        return { success: false, billedToManager: false, error: 'Database not initialized' };
      }

      const { agentEmail, serviceType, leadId, leadName, leadPhone, callDuration, sourceTable, sourceId } = params;
      const normalizedAgentEmail = agentEmail.toLowerCase().trim();
      
      console.log(`💰 Checking for manager billing coverage: ${normalizedAgentEmail}, service: ${serviceType}`);
      
      // Find active allocation for this agent + service
      const { data: allocation } = await supabaseAdmin
        .from('manager_billing_allocations')
        .select('*')
        .eq('agent_email', normalizedAgentEmail)
        .eq('service_type', serviceType)
        .eq('status', 'active')
        .or('allocation_type.eq.unlimited,credits_remaining.gt.0')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!allocation) {
        console.log(`⚠️ No active allocation found for ${normalizedAgentEmail} - ${serviceType}`);
        return { success: true, billedToManager: false };
      }
      
      const price = SERVICE_PRICES[serviceType] || 8.00;
      
      // Check if credits are available (for non-unlimited allocations)
      if (allocation.allocation_type !== 'unlimited' && allocation.credits_remaining <= 0) {
        console.log(`⚠️ Allocation exhausted for ${normalizedAgentEmail}`);
        
        // Update allocation status to exhausted
        await supabaseAdmin
          .from('manager_billing_allocations')
          .update({ status: 'exhausted' })
          .eq('id', allocation.id);
        
        return { success: true, billedToManager: false };
      }
      
      // Record the transaction
      const { error: transactionError } = await supabaseAdmin
        .from('manager_billing_transactions')
        .insert({
          allocation_id: allocation.allocation_id,
          manager_email: allocation.manager_email,
          manager_associate_id: allocation.manager_associate_id,
          manager_name: allocation.manager_name,
          agent_email: normalizedAgentEmail,
          agent_associate_id: allocation.agent_associate_id,
          agent_name: allocation.agent_name,
          service_type: serviceType,
          amount_charged: price,
          credits_deducted: 1,
          lead_id: leadId,
          lead_name: leadName,
          lead_phone: leadPhone,
          call_duration: callDuration,
          source_table: sourceTable,
          source_id: sourceId,
          status: 'completed'
        });
      
      if (transactionError) {
        console.error('❌ Error recording transaction:', transactionError);
        return { success: false, billedToManager: false, error: 'Failed to record transaction' };
      }
      
      // Update allocation usage
      if (allocation.allocation_type !== 'unlimited') {
        await supabaseAdmin
          .from('manager_billing_allocations')
          .update({
            credits_used: allocation.credits_used + 1,
            credits_remaining: allocation.credits_remaining - 1,
            total_amount_used: allocation.total_amount_used + price,
            total_amount_remaining: allocation.total_amount_remaining - price,
            updated_at: new Date().toISOString()
          })
          .eq('id', allocation.id);
      } else {
        // For unlimited, just track usage
        await supabaseAdmin
          .from('manager_billing_allocations')
          .update({
            credits_used: allocation.credits_used + 1,
            total_amount_used: allocation.total_amount_used + price,
            updated_at: new Date().toISOString()
          })
          .eq('id', allocation.id);
      }
      
      // Update manager's credit balance
      await supabaseAdmin
        .from('manager_credit_balance')
        .update({
          credits_used: supabaseAdmin.raw('credits_used + 1'),
          credits_balance: supabaseAdmin.raw('credits_balance - 1'),
          total_spent: supabaseAdmin.raw(`total_spent + ${price}`),
          updated_at: new Date().toISOString()
        })
        .eq('manager_email', allocation.manager_email);
      
      console.log(`✅ Transaction recorded: ${normalizedAgentEmail} service billed to manager ${allocation.manager_email}`);
      return { 
        success: true, 
        billedToManager: true, 
        managerEmail: allocation.manager_email 
      };
      
    } catch (error) {
      console.error('❌ Error in recordTransaction:', error);
      return { success: false, billedToManager: false, error: 'Internal server error' };
    }
  }

  /**
   * Cancel an allocation
   */
  static async cancelAllocation(allocationId: string, managerEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabaseAdmin) {
        return { success: false, error: 'Database not initialized' };
      }

      const normalizedManagerEmail = managerEmail.toLowerCase().trim();
      
      const { error } = await supabaseAdmin
        .from('manager_billing_allocations')
        .update({ 
          status: 'cancelled',
          end_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('allocation_id', allocationId)
        .eq('manager_email', normalizedManagerEmail);
      
      if (error) {
        console.error('❌ Error cancelling allocation:', error);
        return { success: false, error: 'Failed to cancel allocation' };
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error in cancelAllocation:', error);
      return { success: false, error: 'Internal server error' };
    }
  }
}

export const managerBillingService = new ManagerBillingService();

