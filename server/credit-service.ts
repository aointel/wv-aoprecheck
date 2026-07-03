import { eq, and, desc, gte, lte, sum } from 'drizzle-orm';
import { agentCredits, creditTransactions, vdpConnects, producers } from '../shared/schema';
import { db } from './db';
import { sendEmail } from './email-service';
import { supabase } from './supabase';

export interface CreditDeductionResult {
  success: boolean;
  newBalance: number;
  transactionId: number;
  message: string;
  agentEmail?: string;
}

export interface AgentCreditInfo {
  agentId: string;
  agentName: string;
  currentBalance: number;
  mga: string | null;
  rga: string | null;
  agentEmail: string | null;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
}

export class CreditService {
  private static instance: CreditService;
  private wsClients: Set<any> = new Set();
  
  static getInstance(): CreditService {
    if (!CreditService.instance) {
      CreditService.instance = new CreditService();
    }
    return CreditService.instance;
  }

  /**
   * Register WebSocket clients for real-time notifications
   */
  addWebSocketClient(ws: any): void {
    this.wsClients.add(ws);
    ws.on('close', () => {
      this.wsClients.delete(ws);
    });
  }

  /**
   * Send real-time credit notification to WebSocket clients
   */
  private sendCreditNotification(notification: any): void {
    const message = JSON.stringify({
      type: 'credit_notification',
      payload: notification
    });

    console.log('🔔 Sending credit notification:', notification);

    this.wsClients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(message);
        } catch (error) {
          console.error('Failed to send WebSocket notification:', error);
          this.wsClients.delete(ws);
        }
      }
    });
  }

  /**
   * Send billing notification for AOI services
   */
  sendBillingNotification(agentId: string, serviceType: string, amount: number, newBalance: number, clientName?: string, phoneNumber?: string): void {
    const notification = {
      type: 'connect',
      agentId,
      serviceType,
      amount: -Math.abs(amount), // Negative for charges
      newBalance,
      clientName,
      phoneNumber,
      timestamp: new Date().toISOString()
    };

    this.sendCreditNotification(notification);

    // Send low balance notification if needed
    if (newBalance <= 10) {
      setTimeout(() => {
        this.sendCreditNotification({
          type: 'low_balance',
          agentId,
          amount: 0,
          newBalance,
          timestamp: new Date().toISOString()
        });
      }, 1000);
    }
  }

  /**
   * Get agent credit balance from Supabase (authoritative source)
   */
  async getSupabaseCreditBalance(agentId: string): Promise<{ balance: number; exists: boolean }> {
    try {
      const { data: user, error } = await supabase
        .from('user_credits')
        .select('credits_remaining, associate_id')
        .eq('associate_id', agentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error fetching Supabase balance for agent ${agentId}:`, error);
        return { balance: 0, exists: false };
      }

      if (!user) {
        console.log(`⚠️ No Supabase user_credits record found for associate_id ${agentId}`);
        return { balance: 0, exists: false };
      }

      return { balance: user.credits_remaining || 0, exists: true };
    } catch (error) {
      console.error(`❌ Unexpected error fetching Supabase balance for agent ${agentId}:`, error);
      return { balance: 0, exists: false };
    }
  }

  /**
   * Initialize agent credit account if it doesn't exist
   */
  async initializeAgentCredits(agentId: string): Promise<void> {
    try {
      // Check if agent already exists
      const existing = await db.select().from(agentCredits).where(eq(agentCredits.agentId, agentId)).limit(1);
      
      if (existing.length > 0) {
        return; // Agent already initialized
      }

      // Get agent info from producers table
      const producer = await db.select().from(producers).where(eq(producers.associateId, parseInt(agentId))).limit(1);
      
      const agentName = producer[0]?.agentName || `Agent ${agentId}`;
      const mga = producer[0]?.mga || null;
      const rga = producer[0]?.rga || null;
      const agentEmail = producer[0]?.companyEmail || producer[0]?.personalEmail || null;

      // Create new agent credit account with default starting balance
      await db.insert(agentCredits).values({
        agentId,
        associateId: parseInt(agentId) || null,
        agentName,
        agentEmail,
        currentBalance: "25.00", // Start with $25 credits
        totalPurchased: "25.00", // Initial bonus
        mga,
        rga,
        creditRate: "0.50", // $0.50 per AOI connect
        lowBalanceThreshold: "10.00",
      });

      // Record initial credit transaction
      await db.insert(creditTransactions).values({
        agentId,
        transactionType: "purchase",
        amount: "25.00",
        balanceBefore: "0.00",
        balanceAfter: "25.00",
        description: "Welcome bonus - Initial credit allocation",
        paymentMethod: "admin",
      });

      console.log(`✅ Initialized credits for agent ${agentId} (${agentName}) with $25 welcome bonus`);
    } catch (error) {
      console.error(`❌ Error initializing credits for agent ${agentId}:`, error);
    }
  }

  /**
   * Deduct credits for a VDP connect
   */
  async deductCreditsForConnect(vdpConnectId: number, agentId: string, phoneNumber: string, clientName: string, connectDuration: number, market: string, serviceType: 'aoi_connect' | 'aoi_missed' | 'aoi_recruit' | 'aoi_precheck' | 'aoi_plus' = 'aoi_connect'): Promise<CreditDeductionResult> {
    try {
      // Ensure agent has credit account
      await this.initializeAgentCredits(agentId);

      // Get current agent credit info from PostgreSQL (for settings)
      const agent = await db.select().from(agentCredits).where(eq(agentCredits.agentId, agentId)).limit(1);
      
      if (agent.length === 0) {
        throw new Error(`Agent ${agentId} not found in credit system`);
      }

      // Get authoritative balance from Supabase
      const supabaseBalance = await this.getSupabaseCreditBalance(agentId);
      if (!supabaseBalance.exists) {
        console.log(`⚠️ No Supabase balance found for agent ${agentId}, using PostgreSQL balance`);
      }

      // Use Supabase balance if available, otherwise fall back to PostgreSQL
      const currentBalance = supabaseBalance.exists ? supabaseBalance.balance : parseFloat(agent[0].currentBalance);
      
      // Get appropriate rate based on service type
      let deductionAmount: number;
      switch (serviceType) {
        case 'aoi_connect':
          deductionAmount = parseFloat(agent[0].aoiConnectRate || '8.00');
          break;
        case 'aoi_missed':
          deductionAmount = parseFloat(agent[0].aoiMissedRate || '4.00');
          break;
        case 'aoi_recruit':
          deductionAmount = parseFloat(agent[0].aoiRecruitRate || '5.00');
          break;
        case 'aoi_precheck':
          deductionAmount = parseFloat(agent[0].aoiPrecheckRate || '3.00');
          break;
        case 'aoi_plus':
          deductionAmount = parseFloat(agent[0].aoiPlusRate || '6.00');
          break;
        default:
          deductionAmount = parseFloat(agent[0].aoiConnectRate || '8.00');
      }

      // Check if agent has sufficient balance
      if (currentBalance < deductionAmount) {
        return {
          success: false,
          newBalance: currentBalance,
          transactionId: 0,
          message: `Insufficient credits. Balance: $${currentBalance.toFixed(2)}, Required: $${deductionAmount.toFixed(2)}`,
          agentEmail: agent[0].agentEmail,
        };
      }

      const newBalance = currentBalance - deductionAmount;
      const totalUsed = parseFloat(agent[0].totalUsed) + deductionAmount;

      // Update agent balance
      await db.update(agentCredits)
        .set({ 
          currentBalance: newBalance.toFixed(2),
          totalUsed: totalUsed.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(agentCredits.agentId, agentId));

      // Record transaction
      const transactionResult = await db.insert(creditTransactions).values({
        agentId,
        transactionType: "usage",
        serviceType,
        amount: `-${deductionAmount.toFixed(2)}`,
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description: `${serviceType.toUpperCase().replace('_', ' ')} - ${clientName} (${phoneNumber})`,
        vdpConnectId,
        phoneNumber,
        clientName: clientName.substring(0, 100), // Limit length
        connectDuration,
        market: market.substring(0, 50),
        paymentMethod: "usage",
      }).returning({ id: creditTransactions.id });

      console.log(`💳 Deducted $${deductionAmount.toFixed(2)} from agent ${agentId} for connect ${vdpConnectId}. New balance: $${newBalance.toFixed(2)}`);

      // Sync balance to Supabase user_credits table
      await this.syncBalanceToSupabase(agentId, newBalance, deductionAmount, serviceType);

      // Send real-time credit notification
      const notification = {
        type: 'connect',
        agentId,
        amount: -deductionAmount,
        newBalance,
        clientName,
        phoneNumber,
        timestamp: new Date().toISOString()
      };
      this.sendCreditNotification(notification);

      // Check for low balance and send notification
      const lowBalanceThreshold = parseFloat(agent[0].lowBalanceThreshold);
      if (newBalance <= lowBalanceThreshold && newBalance > 0) {
        const lowBalanceNotification = {
          type: 'low_balance',
          agentId,
          amount: 0,
          newBalance,
          timestamp: new Date().toISOString()
        };
        this.sendCreditNotification(lowBalanceNotification);
      }

      return {
        success: true,
        newBalance,
        transactionId: transactionResult[0].id,
        message: `Successfully charged $${deductionAmount.toFixed(2)} for AOI connect`,
        agentEmail: agent[0].agentEmail,
      };

    } catch (error) {
      console.error(`❌ Error deducting credits for agent ${agentId}:`, error);
      return {
        success: false,
        newBalance: 0,
        transactionId: 0,
        message: `Error processing credit deduction: ${error.message}`,
      };
    }
  }

  /**
   * Add credits to agent account (purchase, admin adjustment, etc.)
   */
  async addCredits(agentId: string, amount: number, description: string, paymentMethod: string = "admin", paymentId?: string): Promise<CreditDeductionResult> {
    try {
      // Ensure agent has credit account
      await this.initializeAgentCredits(agentId);

      // Get current agent credit info
      const agent = await db.select().from(agentCredits).where(eq(agentCredits.agentId, agentId)).limit(1);
      
      if (agent.length === 0) {
        throw new Error(`Agent ${agentId} not found in credit system`);
      }

      const currentBalance = parseFloat(agent[0].currentBalance);
      const newBalance = currentBalance + amount;
      const totalPurchased = parseFloat(agent[0].totalPurchased) + amount;

      // Update agent balance
      await db.update(agentCredits)
        .set({ 
          currentBalance: newBalance.toFixed(2),
          totalPurchased: totalPurchased.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(agentCredits.agentId, agentId));

      // Record transaction
      const transactionResult = await db.insert(creditTransactions).values({
        agentId,
        transactionType: "purchase",
        amount: amount.toFixed(2),
        balanceBefore: currentBalance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        description,
        paymentMethod,
        paymentId,
      }).returning({ id: creditTransactions.id });

      console.log(`💰 Added $${amount.toFixed(2)} credits to agent ${agentId}. New balance: $${newBalance.toFixed(2)}`);

      return {
        success: true,
        newBalance,
        transactionId: transactionResult[0].id,
        message: `Successfully added $${amount.toFixed(2)} credits`,
        agentEmail: agent[0].agentEmail,
      };

    } catch (error) {
      console.error(`❌ Error adding credits for agent ${agentId}:`, error);
      return {
        success: false,
        newBalance: 0,
        transactionId: 0,
        message: `Error adding credits: ${error.message}`,
      };
    }
  }

  /**
   * Get agent credit information
   */
  async getAgentCreditInfo(agentId: string): Promise<AgentCreditInfo | null> {
    try {
      // Ensure agent has credit account
      await this.initializeAgentCredits(agentId);

      const agent = await db.select().from(agentCredits).where(eq(agentCredits.agentId, agentId)).limit(1);
      
      if (agent.length === 0) {
        return null;
      }

      const currentBalance = parseFloat(agent[0].currentBalance);
      const lowBalanceThreshold = parseFloat(agent[0].lowBalanceThreshold);

      return {
        agentId: agent[0].agentId,
        agentName: agent[0].agentName,
        currentBalance,
        mga: agent[0].mga,
        rga: agent[0].rga,
        agentEmail: agent[0].agentEmail,
        lowBalanceThreshold,
        isLowBalance: currentBalance <= lowBalanceThreshold,
      };

    } catch (error) {
      console.error(`❌ Error getting credit info for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get agent transaction history
   */
  async getAgentTransactionHistory(agentId: string, limit: number = 50): Promise<any[]> {
    try {
      const transactions = await db.select()
        .from(creditTransactions)
        .where(eq(creditTransactions.agentId, agentId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(limit);

      return transactions;
    } catch (error) {
      console.error(`❌ Error getting transaction history for agent ${agentId}:`, error);
      return [];
    }
  }

  /**
   * Get recent notifications for agent
   */
  async getRecentNotifications(agentId: string): Promise<any[]> {
    try {
      // For now, simulate notifications based on recent transactions
      const recentTransactions = await db.select()
        .from(creditTransactions)
        .where(eq(creditTransactions.agentId, agentId))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(10);

      return recentTransactions.map(transaction => ({
        id: `notif-${transaction.id}`,
        type: transaction.transactionType === 'usage' ? 'credit_deducted' : 'credit_added',
        title: transaction.transactionType === 'usage' ? 'Credit Deducted' : 'Credits Added',
        message: `${transaction.description} - $${Math.abs(parseFloat(transaction.amount)).toFixed(2)}`,
        amount: parseFloat(transaction.amount),
        timestamp: transaction.createdAt,
        read: false,
        priority: transaction.transactionType === 'usage' ? 'medium' : 'low'
      }));
    } catch (error) {
      console.error("Error getting notifications:", error);
      return [];
    }
  }

  /**
   * Get all agents with low balance for notifications
   */
  async getAgentsWithLowBalance(): Promise<AgentCreditInfo[]> {
    try {
      const agents = await db.select().from(agentCredits).where(eq(agentCredits.isActive, true));
      
      const lowBalanceAgents: AgentCreditInfo[] = [];
      
      for (const agent of agents) {
        const currentBalance = parseFloat(agent.currentBalance);
        const lowBalanceThreshold = parseFloat(agent.lowBalanceThreshold);
        
        if (currentBalance <= lowBalanceThreshold) {
          lowBalanceAgents.push({
            agentId: agent.agentId,
            agentName: agent.agentName,
            currentBalance,
            mga: agent.mga,
            rga: agent.rga,
            agentEmail: agent.agentEmail,
            lowBalanceThreshold,
            isLowBalance: true,
          });
        }
      }

      return lowBalanceAgents;
    } catch (error) {
      console.error(`❌ Error getting agents with low balance:`, error);
      return [];
    }
  }

  /**
   * Process historical VDP connects and create credit transactions
   */
  async processHistoricalConnects(): Promise<void> {
    try {
      console.log('🔄 Processing historical VDP connects for credit transactions...');

      // Get all VDP connects that don't have associated credit transactions
      const connects = await db.select().from(vdpConnects).orderBy(vdpConnects.pickupTime);

      let processedCount = 0;
      let skippedCount = 0;

      for (const connect of connects) {
        // Check if this connect already has a credit transaction
        const existingTransaction = await db.select()
          .from(creditTransactions)
          .where(eq(creditTransactions.vdpConnectId, connect.id))
          .limit(1);

        if (existingTransaction.length > 0) {
          skippedCount++;
          continue; // Already processed
        }

        // Process credit deduction for this connect
        const result = await this.deductCreditsForConnect(
          connect.id,
          connect.agentId,
          connect.phoneNumber,
          connect.clientName || 'Unknown Client',
          connect.duration,
          connect.market || 'Unknown'
        );

        if (result.success) {
          processedCount++;
        } else {
          console.log(`⚠️  Could not process connect ${connect.id} for agent ${connect.agentId}: ${result.message}`);
        }
      }

      console.log(`✅ Historical VDP connect processing complete:`);
      console.log(`   📞 Processed: ${processedCount} connects`);
      console.log(`   ⏭️  Skipped: ${skippedCount} connects (already processed)`);

    } catch (error) {
      console.error(`❌ Error processing historical connects:`, error);
    }
  }

  /**
   * Sync credit balance to Supabase user_credits table
   */
  private async syncBalanceToSupabase(agentId: string, newBalance: number, deductionAmount: number, serviceType: string = 'aoi_connect'): Promise<void> {
    try {
      // Get ALL emails tied to this associate_id from customers table
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('company_email, personal_email')
        .eq('associate_id', agentId);

      if (customersError) {
        console.error(`❌ Error fetching customers for associate_id ${agentId}:`, customersError);
        return;
      }

      // Collect all unique emails from all customer records
      const allEmails = new Set<string>();
      customers?.forEach(c => {
        if (c.company_email) allEmails.add(c.company_email.toLowerCase());
        if (c.personal_email) allEmails.add(c.personal_email.toLowerCase());
      });

      if (allEmails.size === 0) {
        console.log(`⚠️ No emails found for associate_id ${agentId} in customers table`);
        return;
      }

      const emailArray = Array.from(allEmails);
      console.log(`📧 Found ${emailArray.length} email(s) for associate_id ${agentId}: ${emailArray.join(', ')}`);

      // Get ALL user_credits records for these emails
      const { data: users, error: fetchError } = await supabase
        .from('user_credits')
        .select('*')
        .in('email', emailArray);

      if (fetchError) {
        console.error(`❌ Error fetching Supabase user credits for agent ${agentId}:`, fetchError);
        return;
      }

      if (!users || users.length === 0) {
        console.log(`⚠️ No Supabase user_credits records found for emails: ${emailArray.join(', ')}`);
        return;
      }

      // Update ALL user_credits records for ALL emails tied to this associate_id
      for (const user of users) {
        // Prepare update object with service-specific credit tracking
        const updateData: any = {
          credits_remaining: Math.floor(newBalance), // Convert to integer for Supabase
          credits_used: (user.credits_used || 0) + Math.floor(deductionAmount),
          updated_at: new Date().toISOString()
        };

        // Update the appropriate service-specific credit field
        switch (serviceType) {
          case 'aoi_connect':
            updateData.aoi_connect_credits_used = (user.aoi_connect_credits_used || 0) + Math.floor(deductionAmount);
            break;
          case 'aoi_plus':
            updateData.aoi_plus_credits_used = (user.aoi_plus_credits_used || 0) + Math.floor(deductionAmount);
            break;
          case 'aoi_recruit':
            updateData.aoi_recruit_credits_used = (user.aoi_recruit_credits_used || 0) + Math.floor(deductionAmount);
            break;
          case 'aoi_precheck':
            updateData.aoi_precheck_credits_used = (user.aoi_precheck_credits_used || 0) + Math.floor(deductionAmount);
            break;
          default:
            // Default to aoi_connect for backwards compatibility
            updateData.aoi_connect_credits_used = (user.aoi_connect_credits_used || 0) + Math.floor(deductionAmount);
            break;
        }

        // Update this specific user_credits record
        const { error: updateError } = await supabase
          .from('user_credits')
          .update(updateData)
          .eq('email', user.email);

        if (updateError) {
          console.error(`❌ Error updating Supabase user credits for ${user.email}:`, updateError);
        } else {
          console.log(`✅ Synced balance to Supabase for ${user.email} (associate_id ${agentId}): $${newBalance.toFixed(2)}`);
        }
      }

      console.log(`✅ Updated ${users.length} user_credits record(s) for associate_id ${agentId}`);

    } catch (error) {
      console.error(`❌ Unexpected error syncing to Supabase for agent ${agentId}:`, error);
    }
  }

  /**
   * Get unprocessed VDP connects for testing
   */
  async getUnprocessedConnects(limit: number = 10): Promise<any[]> {
    try {
      const unprocessed = await db.select({
        id: vdpConnects.id,
        agentId: vdpConnects.agentId,
        agentName: vdpConnects.agentName,
        phoneNumber: vdpConnects.phoneNumber,
        duration: vdpConnects.duration,
        clientName: vdpConnects.clientName,
        market: vdpConnects.market
      })
      .from(vdpConnects)
      .where(gte(vdpConnects.duration, 12)) // Only connects over 12 seconds
      .orderBy(desc(vdpConnects.id))
      .limit(limit);

      return unprocessed;
    } catch (error) {
      console.error(`❌ Error getting unprocessed connects:`, error);
      return [];
    }
  }

  /**
   * Send daily credit recap emails to all agents
   */
  async sendDailyCreditRecaps(date?: string): Promise<{ sent: number; errors: number }> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const startOfDay = `${targetDate} 00:00:00`;
      const endOfDay = `${targetDate} 23:59:59`;

      console.log(`📧 Sending daily credit recaps for ${targetDate}...`);

      // Get all agents with transactions today
      const agentsWithActivity = await db
        .select({
          agentId: creditTransactions.agentId,
          agentName: agentCredits.agentName,
          agentEmail: agentCredits.agentEmail,
          currentBalance: agentCredits.currentBalance,
          mga: agentCredits.mga,
          rga: agentCredits.rga,
        })
        .from(creditTransactions)
        .innerJoin(agentCredits, eq(creditTransactions.agentId, agentCredits.agentId))
        .where(
          and(
            gte(creditTransactions.createdAt, new Date(startOfDay)),
            lte(creditTransactions.createdAt, new Date(endOfDay))
          )
        )
        .groupBy(
          creditTransactions.agentId,
          agentCredits.agentName,
          agentCredits.agentEmail,
          agentCredits.currentBalance,
          agentCredits.mga,
          agentCredits.rga
        );

      let sent = 0;
      let errors = 0;

      for (const agent of agentsWithActivity) {
        if (!agent.agentEmail) {
          continue; // Skip agents without email
        }

        try {
          // Get today's transactions for this agent
          const todaysTransactions = await db
            .select({
              id: creditTransactions.id,
              transactionType: creditTransactions.transactionType,
              amount: creditTransactions.amount,
              description: creditTransactions.description,
              clientName: creditTransactions.clientName,
              phoneNumber: creditTransactions.phoneNumber,
              createdAt: creditTransactions.createdAt,
            })
            .from(creditTransactions)
            .where(
              and(
                eq(creditTransactions.agentId, agent.agentId),
                gte(creditTransactions.createdAt, new Date(startOfDay)),
                lte(creditTransactions.createdAt, new Date(endOfDay))
              )
            )
            .orderBy(desc(creditTransactions.createdAt));

          // Calculate daily totals
          const totalSpent = todaysTransactions
            .filter(t => t.transactionType === 'usage')
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

          const totalConnects = todaysTransactions.filter(t => t.transactionType === 'usage').length;

          const emailHtml = this.generateDailyRecapEmail(agent, todaysTransactions, totalSpent, totalConnects, targetDate);

          // Send email
          await sendEmail(
            agent.agentEmail,
            `Daily Credit Recap - ${targetDate}`,
            '',
            emailHtml
          );

          sent++;
          console.log(`✅ Daily recap sent to ${agent.agentName} (${agent.agentEmail})`);

        } catch (error) {
          console.error(`❌ Failed to send daily recap to ${agent.agentName}:`, error);
          errors++;
        }
      }

      console.log(`📧 Daily credit recaps completed: ${sent} sent, ${errors} errors`);
      return { sent, errors };

    } catch (error) {
      console.error('❌ Error sending daily credit recaps:', error);
      return { sent: 0, errors: 1 };
    }
  }

  /**
   * Generate HTML email for daily credit recap
   */
  private generateDailyRecapEmail(
    agent: any,
    transactions: any[],
    totalSpent: number,
    totalConnects: number,
    date: string
  ): string {
    const connectsList = transactions
      .filter(t => t.transactionType === 'usage')
      .map(t => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${t.clientName || 'Unknown Client'}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${t.phoneNumber || 'N/A'}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #dc2626;">
            $${Math.abs(parseFloat(t.amount)).toFixed(2)}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${new Date(t.createdAt).toLocaleTimeString()}
          </td>
        </tr>
      `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Credit Recap</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">📊 Daily Credit Recap</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${date}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2563eb; margin-top: 0;">Hello ${agent.agentName}!</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #1f2937;">📈 Today's Summary</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div style="text-align: center; padding: 15px; background: #fee2e2; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #dc2626;">$${totalSpent.toFixed(2)}</div>
                <div style="color: #991b1b;">Total Billed</div>
              </div>
              <div style="text-align: center; padding: 15px; background: #dbeafe; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${totalConnects}</div>
                <div style="color: #1d4ed8;">AOI Connects</div>
              </div>
            </div>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #1f2937;">💰 Current Balance</h3>
            <div style="font-size: 28px; font-weight: bold; color: ${parseFloat(agent.currentBalance) > 10 ? '#059669' : '#dc2626'};">
              $${parseFloat(agent.currentBalance).toFixed(2)}
            </div>
            ${parseFloat(agent.currentBalance) <= 10 ? 
              '<p style="color: #dc2626; font-weight: bold;">⚠️ Low balance warning! Consider adding more credits.</p>' : 
              '<p style="color: #059669;">✅ Healthy credit balance</p>'
            }
          </div>

          ${totalConnects > 0 ? `
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #1f2937;">📞 Today's AOI Connects</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Client</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Phone</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Cost</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Time</th>
                </tr>
              </thead>
              <tbody>
                ${connectsList}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <p style="margin: 0; color: #0c4a6e;">
              <strong>💡 Tip:</strong> Your AOI credits help you connect with qualified prospects faster. 
              Each successful connect costs $0.50 and brings you closer to closing deals!
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              This is an automated daily recap from AO Intelligence Credit Management System
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">
              ${agent.mga ? `MGA: ${agent.mga}` : ''} ${agent.rga ? `| RGA: ${agent.rga}` : ''}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const creditService = CreditService.getInstance();