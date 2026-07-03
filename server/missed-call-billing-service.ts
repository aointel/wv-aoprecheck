import { supabase, supabaseAdmin } from './supabase';
import { RealBillingService } from './real-billing-service';

const MISSED_CALL_AMOUNT_USD = 4.0;

export interface MissedCallEvent {
  phone: string;
  agentId: string;
  leadName: string;
  leadData: any;
  blasterCycles: number;
  timestamp: string;
}

export interface MissedCallBilling {
  agentEmail: string;
  agentName: string;
  associateId: string;
  missedCallCount: number;
  billingAmount: number; // $4.00 per missed call
  date: string;
}

export interface MGAReport {
  mgaName: string;
  mgaEmail: string;
  totalAgents: number;
  totalConnects: number;
  totalMissedCalls: number;
  totalRevenue: number;
  agents: {
    agentName: string;
    agentEmail: string;
    connects: number;
    missedCalls: number;
    revenue: number;
    missedCallCharges: number;
  }[];
}

export interface CallSession {
  phone: string;
  agentId: string;
  events: Array<{
    event: string;
    timestamp: string;
    params?: any;
  }>;
  hadPickup: boolean;
  blasterCycles: number;
  leadData?: any;
}

export class MissedCallBillingService {
  /**
   * Parse CSV data and identify missed calls that should be billed
   */
  static async parseMissedCallsFromCSV(csvData: string): Promise<MissedCallEvent[]> {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    const events = lines.slice(1).map(line => this.parseCSVLine(line));
    
    // Group events by phone number
    const sessionsByPhone = new Map<string, CallSession>();
    
    for (const event of events) {
      if (!event.phone) continue;
      
      if (!sessionsByPhone.has(event.phone)) {
        sessionsByPhone.set(event.phone, {
          phone: event.phone,
          agentId: event.agentId || '',
          events: [],
          hadPickup: false,
          blasterCycles: 0,
          leadData: null
        });
      }
      
      const session = sessionsByPhone.get(event.phone)!;
      session.events.push({
        event: event.event,
        timestamp: event.timestamp,
        params: event.params
      });
      
      // Track if any pickup occurred
      if (event.event === 'PICKUP' || event.event === 'PICK_UP') {
        session.hadPickup = true;
      }
      
      // Count BLASTER cycles
      if (event.event === 'BLASTER') {
        session.blasterCycles++;
      }
      
      // Store agent ID and lead data from first event
      if (event.agentId && !session.agentId) {
        session.agentId = event.agentId;
      }
      
      if (event.params && !session.leadData) {
        session.leadData = event.params;
      }
    }
    
    // Identify billable missed calls
    const missedCalls: MissedCallEvent[] = [];
    
    for (const session of sessionsByPhone.values()) {
      // Billing rule: Must have BLASTER cycles AND no pickup AND valid agent ID
      if (session.blasterCycles >= 1 && !session.hadPickup && session.agentId) {
        const leadName = session.leadData ? 
          `${session.leadData['First Name'] || ''} ${session.leadData['Last Name'] || ''}`.trim() :
          'Unknown Lead';
          
        missedCalls.push({
          phone: session.phone,
          agentId: session.agentId,
          leadName,
          leadData: session.leadData,
          blasterCycles: session.blasterCycles,
          timestamp: session.events[0]?.timestamp || new Date().toISOString()
        });
      }
    }
    
    return missedCalls;
  }
  
  /**
   * Parse a single CSV line handling quoted fields properly
   */
  private static parseCSVLine(line: string) {
    const result: any = {};
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);
    
    // Map to expected fields: Date,Time,Event,Phone,Agent,Params
    result.date = parts[0] || '';
    result.time = parts[1] || '';
    result.event = parts[2] || '';
    result.phone = parts[3] || '';
    result.agentId = parts[4] ? parts[4].replace(/"/g, '') : '';
    result.timestamp = `${result.date} ${result.time}`;
    
    // Parse Params JSON if available
    if (parts[5]) {
      try {
        const paramsStr = parts[5].replace(/^"/, '').replace(/"$/, '');
        result.params = JSON.parse(paramsStr);
      } catch (e) {
        result.params = null;
      }
    }
    
    return result;
  }
  
  /**
   * Process missed calls and bill agents
   */
  static async processMissedCallBilling(missedCalls: MissedCallEvent[]): Promise<{
    processed: number;
    failed: number;
    results: Array<{ agentId: string; success: boolean; error?: string; }>;
  }> {
    const results = [];
    let processed = 0;
    let failed = 0;
    
    for (const missedCall of missedCalls) {
      try {
        // Bill missed call at $4.00 in missed_calls column
        const { data, error } = await supabase
          .from('user_credits')
          .update({
            missed_calls: supabase.sql`COALESCE(missed_calls, 0) + 4.00`,
            aoi_missed_calls: supabase.sql`COALESCE(aoi_missed_calls, 0) + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('associate_id', missedCall.agentId)
          .select()
          .single();
        
        if (error) {
          console.error(`❌ Failed to bill agent ${missedCall.agentId}:`, error);
          results.push({
            agentId: missedCall.agentId,
            success: false,
            error: error.message
          });
          failed++;
        } else {
          console.log(`💰 Billed $4.00 missed call to agent ${missedCall.agentId} for phone ${missedCall.phone}`);
          results.push({
            agentId: missedCall.agentId,
            success: true
          });
          processed++;

          // CRITICAL: Also insert into billing_transactions so reports/dashboards see missed calls
          await this.insertMissedCallBillingTransaction(missedCall);
          
          // Create notification for the agent (to be implemented)
          await this.createMissedCallNotification(missedCall);
        }
      } catch (error) {
        console.error(`❌ Error billing agent ${missedCall.agentId}:`, error);
        results.push({
          agentId: missedCall.agentId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failed++;
      }
    }
    
    return { processed, failed, results };
  }
  
  /**
   * Insert one row into billing_transactions for a missed call (so reports/dashboards count it).
   */
  private static async insertMissedCallBillingTransaction(missedCall: MissedCallEvent): Promise<void> {
    if (!supabaseAdmin) return;
    try {
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, first_name, last_name, associate_id')
        .eq('associate_id', missedCall.agentId)
        .maybeSingle();
      const email = (cust?.company_email || cust?.personal_email || '').toString().trim().toLowerCase();
      if (!email || !email.includes('@')) return;
      const name = [cust?.first_name, cust?.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
      const transactionId = `missed_call-${missedCall.agentId}-${missedCall.phone}-${(missedCall.timestamp || Date.now()).toString().replace(/\D/g, '')}`.slice(0, 200);
      const transactionDate = missedCall.timestamp ? new Date(missedCall.timestamp).toISOString() : new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('billing_transactions')
        .insert({
          transaction_id: transactionId,
          transaction_type: 'missed_call',
          agent_email: email,
          agent_associate_id: parseInt(missedCall.agentId, 10) || null,
          agent_name: name,
          transaction_date: transactionDate,
          amount_usd: MISSED_CALL_AMOUNT_USD,
          credits_charged: Math.round(MISSED_CALL_AMOUNT_USD),
          lead_name: missedCall.leadName || null,
          lead_phone: missedCall.phone || null,
          source_table: 'missed_call_billing',
          source_id: null,
          description: `Missed call (${missedCall.blasterCycles || 1} ring cycles)`,
          metadata: { phone: missedCall.phone, agentId: missedCall.agentId, blasterCycles: missedCall.blasterCycles },
        });
      if (error) {
        if (error.code === '23505') return; // duplicate
        console.error('❌ Failed to insert missed_call into billing_transactions:', error.message);
      }
    } catch (e) {
      console.warn('⚠️ insertMissedCallBillingTransaction (non-blocking):', e);
    }
  }

  /**
   * Create notification for missed call (placeholder for future implementation)
   */
  private static async createMissedCallNotification(missedCall: MissedCallEvent): Promise<void> {
    // TODO: Implement notification system
    console.log(`🔔 Created missed call notification for agent ${missedCall.agentId}: ${missedCall.leadName} (${missedCall.phone})`);
  }
  
  /**
   * Process comprehensive missed call billing with real data
   * Charges individual agents $4.00 per missed call in user_credits.missed_calls
   */
  static async processComprehensiveMissedCallBilling(): Promise<{ success: boolean; results: MissedCallBilling[] }> {
    try {
      console.log('💸 Processing comprehensive missed call billing for all agents...');
      
      // Get missed call data from real billing service
      const billingData = await RealBillingService.analyzeAOConnects();
      
      const billingResults: MissedCallBilling[] = [];
      
      for (const record of billingData) {
        if (record.missedCallCount && record.missedCallCount > 0) {
          const billingAmount = record.missedCallCount * 4.00; // $4.00 per missed call
          
          // Update user_credits table with missed call charges
          const { error: updateError } = await supabase
            .from('user_credits')
            .update({
              missed_calls: supabase.sql`COALESCE(missed_calls, 0) + ${billingAmount}`,
              updated_at: new Date().toISOString()
            })
            .eq('email', record.agentEmail);
          
          if (updateError) {
            console.error(`❌ Failed to bill agent ${record.agentEmail}:`, updateError);
            continue;
          }

          // CRITICAL: Insert missed_call rows into billing_transactions so reports/dashboards see them
          if (supabaseAdmin && record.missedCallCount > 0) {
            const dateStr = new Date().toISOString().split('T')[0];
            const baseId = `missed_call-${record.agentEmail}-${dateStr}`;
            for (let i = 0; i < record.missedCallCount; i++) {
              const transactionId = `${baseId}-${i}-${Date.now()}`.slice(0, 200);
              const { error: insertErr } = await supabaseAdmin
                .from('billing_transactions')
                .insert({
                  transaction_id: transactionId,
                  transaction_type: 'missed_call',
                  agent_email: record.agentEmail,
                  agent_associate_id: record.associateId ? parseInt(String(record.associateId), 10) : null,
                  agent_name: record.agentName || null,
                  transaction_date: new Date().toISOString(),
                  amount_usd: MISSED_CALL_AMOUNT_USD,
                  credits_charged: Math.round(MISSED_CALL_AMOUNT_USD),
                  lead_name: null,
                  lead_phone: null,
                  source_table: 'missed_call_comprehensive',
                  source_id: null,
                  description: `Missed call (comprehensive billing)`,
                  metadata: { index: i, total: record.missedCallCount },
                });
              if (insertErr && insertErr.code !== '23505') {
                console.error(`❌ Failed to insert billing_transactions missed_call for ${record.agentEmail}:`, insertErr.message);
              }
            }
          }
          
          billingResults.push({
            agentEmail: record.agentEmail,
            agentName: record.agentName,
            associateId: record.associateId,
            missedCallCount: record.missedCallCount,
            billingAmount: billingAmount,
            date: new Date().toISOString().split('T')[0]
          });
          
          console.log(`💰 Billed ${record.agentEmail}: ${record.missedCallCount} missed calls = $${billingAmount.toFixed(2)}`);
        }
      }
      
      console.log(`✅ Successfully processed missed call billing for ${billingResults.length} agents`);
      return { success: true, results: billingResults };
    } catch (error) {
      console.error('❌ Error processing comprehensive missed call billing:', error);
      return { success: false, results: [] };
    }
  }

  /**
   * Generate MGA performance reports
   */
  static async generateMGAReports(): Promise<MGAReport[]> {
    try {
      console.log('📊 Generating MGA performance reports...');
      
      // Get all billing data
      const billingData = await RealBillingService.analyzeAOConnects();
      
      // Get customer data to map MGAs
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name, company_email, agent_name');
      
      if (customerError) throw customerError;
      
      // Create MGA lookup
      const mgaLookup = new Map();
      customerData?.forEach(customer => {
        if (customer.company_email && customer.agent_name) {
          mgaLookup.set(customer.company_email, customer.agent_name);
        }
      });
      
      // Group agents by MGA
      const mgaGroups = new Map<string, any[]>();
      
      billingData.forEach(record => {
        const mgaName = mgaLookup.get(record.agentEmail) || 'Unassigned MGA';
        
        if (!mgaGroups.has(mgaName)) {
          mgaGroups.set(mgaName, []);
        }
        
        mgaGroups.get(mgaName)!.push(record);
      });
      
      // Generate reports for each MGA
      const reports: MGAReport[] = [];
      
      mgaGroups.forEach((agents, mgaName) => {
        const totalConnects = agents.reduce((sum, agent) => sum + (agent.connectCount || 0), 0);
        const totalMissedCalls = agents.reduce((sum, agent) => sum + (agent.missedCallCount || 0), 0);
        const totalRevenue = agents.reduce((sum, agent) => sum + (agent.totalBilling || 0), 0);
        
        const agentReports = agents.map(agent => ({
          agentName: agent.agentName,
          agentEmail: agent.agentEmail,
          connects: agent.connectCount || 0,
          missedCalls: agent.missedCallCount || 0,
          revenue: agent.totalBilling || 0,
          missedCallCharges: (agent.missedCallCount || 0) * 4.00
        }));
        
        reports.push({
          mgaName,
          mgaEmail: this.getMGAEmail(mgaName, customerData),
          totalAgents: agents.length,
          totalConnects,
          totalMissedCalls,
          totalRevenue,
          agents: agentReports.sort((a, b) => b.revenue - a.revenue)
        });
      });
      
      console.log(`✅ Generated reports for ${reports.length} MGAs`);
      return reports.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      console.error('❌ Error generating MGA reports:', error);
      throw error;
    }
  }

  /**
   * Generate email notifications (NO ACTUAL SENDING - just log content)
   */
  static async generateMissedCallNotifications(billingResults: MissedCallBilling[]): Promise<void> {
    try {
      console.log('📧 Generating missed call notification emails (NOT SENDING)...');
      
      for (const billing of billingResults) {
        const emailContent = {
          to: billing.agentEmail,
          subject: `Missed Call Billing: $${billing.billingAmount.toFixed(2)} charged`,
          message: `Dear ${billing.agentName}, you have been charged $${billing.billingAmount.toFixed(2)} for ${billing.missedCallCount} missed calls on ${billing.date}. This amount has been added to your account billing under the missed_calls column.`
        };
        
        console.log(`📧 EMAIL NOTIFICATION PREPARED:`, emailContent);
      }
    } catch (error) {
      console.error('❌ Error generating notifications:', error);
    }
  }

  /**
   * Generate MGA performance report emails (NO ACTUAL SENDING - just log content)
   */
  static async generateMGAReportNotifications(reports: MGAReport[]): Promise<void> {
    try {
      console.log('📊 Generating MGA performance reports (NOT SENDING)...');
      
      for (const report of reports) {
        if (!report.mgaEmail) continue;
        
        const reportContent = {
          to: report.mgaEmail,
          subject: `Weekly Performance Report - ${report.mgaName}`,
          summary: {
            totalAgents: report.totalAgents,
            totalConnects: report.totalConnects,
            totalMissedCalls: report.totalMissedCalls,
            totalRevenue: report.totalRevenue,
            agents: report.agents
          }
        };
        
        console.log(`📊 MGA REPORT PREPARED:`, reportContent);
      }
    } catch (error) {
      console.error('❌ Error generating MGA reports:', error);
    }
  }

  /**
   * Generate SMS notifications (NO ACTUAL SENDING - just log content)
   */
  static async generateSMSNotifications(billingResults: MissedCallBilling[]): Promise<void> {
    try {
      console.log('📱 Generating SMS notifications (NOT SENDING)...');
      
      const highCharges = billingResults.filter(billing => billing.billingAmount >= 20.00); // $20+ charges
      
      for (const billing of highCharges) {
        const smsContent = {
          to: billing.agentEmail,
          message: `AO Intelligence Alert: You've been charged $${billing.billingAmount.toFixed(2)} for ${billing.missedCallCount} missed calls. Check your billing dashboard.`
        };
        
        console.log(`📱 SMS NOTIFICATION PREPARED:`, smsContent);
      }
    } catch (error) {
      console.error('❌ Error generating SMS notifications:', error);
    }
  }

  /**
   * Create in-system notifications
   */
  static async createSystemNotifications(billingResults: MissedCallBilling[]): Promise<void> {
    try {
      console.log('🔔 Creating in-system notifications...');
      
      // Create notifications (in a real app, this would store in a notifications table)
      const notifications = billingResults.map(billing => ({
        user_email: billing.agentEmail,
        type: 'missed_call_billing',
        title: 'Missed Call Billing',
        message: `You've been charged $${billing.billingAmount.toFixed(2)} for ${billing.missedCallCount} missed calls.`,
        amount: billing.billingAmount,
        is_read: false,
        created_at: new Date().toISOString()
      }));
      
      console.log(`🔔 SYSTEM NOTIFICATIONS CREATED:`, notifications);
    } catch (error) {
      console.error('❌ Error creating system notifications:', error);
    }
  }

  /**
   * Process complete billing cycle (NO ACTUAL EMAILS SENT)
   */
  static async processCompleteBillingCycle(): Promise<void> {
    try {
      console.log('🔄 Starting complete billing cycle...');
      
      // 1. Process missed call billing
      const billingResults = await this.processComprehensiveMissedCallBilling();
      
      if (billingResults.success && billingResults.results.length > 0) {
        // 2. Generate all notifications (but don't send)
        await Promise.all([
          this.generateMissedCallNotifications(billingResults.results),
          this.generateSMSNotifications(billingResults.results),
          this.createSystemNotifications(billingResults.results)
        ]);
      }
      
      // 3. Generate and prepare MGA reports (but don't send)
      const mgaReports = await this.generateMGAReports();
      await this.generateMGAReportNotifications(mgaReports);
      
      console.log('✅ Complete billing cycle finished successfully');
    } catch (error) {
      console.error('❌ Error in complete billing cycle:', error);
    }
  }

  /**
   * Get missed calls for a specific agent
   */
  static async getAgentMissedCalls(agentId: string): Promise<MissedCallEvent[]> {
    // This would typically come from a missed_calls table, but for now return empty
    // TODO: Implement persistent missed call storage
    return [];
  }

  private static getMGAEmail(mgaName: string, customerData: any[]): string {
    // Find the first agent's email that belongs to this MGA
    const mgaAgent = customerData?.find(customer => customer.agent_name === mgaName);
    return mgaAgent?.company_email || '';
  }
}