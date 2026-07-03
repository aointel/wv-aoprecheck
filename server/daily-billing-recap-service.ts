import { supabase } from './supabase';
import { sendDailyBillingRecap } from './email-service'; // This import is no longer directly used for sending but might be for other purposes or a remnant.
import { sendEmail } from './email'; // Assuming 'sendEmail' is the function from the Mailgun service

export interface DailyBillingData {
  agentId: string;
  agentName: string;
  agentEmail: string;
  date: string;
  totalConnects: number;
  totalMissedCalls: number;
  connectsBilling: number;
  missedCallsBilling: number;
  totalBilling: number;
  connects: Array<{
    id: string;
    clientName: string;
    clientPhone: string;
    callTime: string;
    duration: string;
    market: string;
    billingAmount: string;
  }>;
  missedCalls: Array<{
    id: string;
    clientName: string;
    clientPhone: string;
    callTime: string;
    market: string;
    billingAmount: string;
  }>;
}

export class DailyBillingRecapService {
  /**
   * Get billing data for a specific agent and date
   */
  static async getAgentBillingData(agentId: string, date: string): Promise<DailyBillingData | null> {
    if (!supabase) {
      console.error('❌ Supabase not available');
      return null;
    }

    try {
      console.log(`🔍 Getting billing data for agent ${agentId} on ${date}`);

      // Get agent info
      const { data: agentInfo, error: agentError } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name, company_email')
        .eq('associate_id', agentId)
        .single();

      if (agentError || !agentInfo) {
        console.error(`❌ Agent ${agentId} not found:`, agentError);
        return null;
      }

      const agentName = `${agentInfo.first_name} ${agentInfo.last_name}`;
      const agentEmail = agentInfo.company_email;

      // Get VDP calls for the date - USING EST TIMEZONE
      // Convert EST business day to UTC for Supabase query
      const estDate = new Date(`${date}T00:00:00-05:00`); // EST midnight
      const estEndDate = new Date(`${date}T23:59:59-05:00`); // EST 11:59 PM
      const startOfDay = estDate.toISOString(); // Auto converts to UTC
      const endOfDay = estEndDate.toISOString();   // Auto converts to UTC

      const { data: vdpCalls, error: callsError } = await supabase
        .from('vdp_calls')
        .select('*')
        .eq('agent', agentId)
        .gte('time', startOfDay)
        .lte('time', endOfDay)
        .order('time', { ascending: true });

      if (callsError) {
        console.error(`❌ Error fetching VDP calls:`, callsError);
        return null;
      }

      // Get missed calls for the date
      const { data: missedCalls, error: missedError } = await supabase
        .from('vdp_calls_missed')
        .select('*')
        .eq('agent', agentId)
        .gte('time', startOfDay)
        .lte('time', endOfDay)
        .order('time', { ascending: true });

      if (missedError) {
        console.error(`❌ Error fetching missed calls:`, missedError);
      }

      // Process successful connects
      const connects = (vdpCalls || []).map(call => ({
        id: call.leadid || call.id.toString(),
        clientName: call.firstName && call.lastName ?
          `${call.firstName} ${call.lastName}`.trim() :
          `Client ${call.phone}`,
        clientPhone: call.phone || 'N/A',
        callTime: call.time ? call.time.split('T')[1]?.split('+')[0] || '00:00:00' : '00:00:00',
        duration: call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : '0:00',
        market: call.market || 'Veteran',
        billingAmount: '8.00'
      }));

      // Process missed calls
      const missedCallsFormatted = (missedCalls || []).map(call => ({
        id: `missed_${call.id}`,
        clientName: call.firstName && call.lastName ?
          `${call.firstName} ${call.lastName}`.trim() :
          (call.firstname && call.lastname ? `${call.firstname} ${call.lastname}`.trim() : `Client ${call.phone}`),
        clientPhone: call.phone || 'N/A',
        callTime: call.time ? call.time.split('T')[1]?.split('+')[0] || '00:00:00' : '00:00:00',
        market: call.market || 'Veteran',
        billingAmount: '4.00'
      }));

      // Calculate totals
      const totalConnects = connects.length;
      const totalMissedCalls = missedCallsFormatted.length;
      const connectsBilling = totalConnects * 8.00;
      const missedCallsBilling = totalMissedCalls * 4.00;
      const totalBilling = connectsBilling + missedCallsBilling;

      console.log(`✅ Agent ${agentId} billing data: ${totalConnects} connects ($${connectsBilling}), ${totalMissedCalls} missed ($${missedCallsBilling}), total $${totalBilling}`);

      return {
        agentId,
        agentName,
        agentEmail,
        date,
        totalConnects,
        totalMissedCalls,
        connectsBilling,
        missedCallsBilling,
        totalBilling,
        connects,
        missedCalls: missedCallsFormatted
      };

    } catch (error) {
      console.error(`❌ Error getting agent billing data:`, error);
      return null;
    }
  }

  /**
   * Send daily recap email to a specific agent
   */
  static async sendAgentDailyRecap(agentId: string, date: string): Promise<boolean> {
    try {
      const billingData = await this.getAgentBillingData(agentId, date);

      if (!billingData) {
        console.error(`❌ No billing data found for agent ${agentId} on ${date}`);
        return false;
      }

      // Only send email if there's activity or if requested specifically
      if (billingData.totalConnects === 0 && billingData.totalMissedCalls === 0) {
        console.log(`📭 No activity for agent ${agentId} on ${date} - skipping email`);
        return true; // Return true as it's not an error, just no activity
      }

      console.log(`📧 Sending daily recap to ${billingData.agentEmail}`);

      // Generate professional email HTML
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">AO Intelligence</h1>
            <h2 style="margin: 10px 0 0 0; font-weight: normal;">Daily Billing Recap</h2>
          </div>

          <div style="padding: 30px; background: #f7fafc;">
            <h3 style="color: #1a365d; margin: 0 0 20px 0;">📊 ${billingData.agentName} - ${billingData.date}</h3>

            <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="color: #2e7d32; margin: 0 0 15px 0;">💰 Daily Summary</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 5px 0; font-weight: bold;">Total Connects:</td><td style="padding: 5px 0;">${billingData.totalConnects}</td></tr>
                <tr><td style="padding: 5px 0; font-weight: bold;">Missed Calls:</td><td style="padding: 5px 0; color: #d32f2f;">${billingData.totalMissedCalls}</td></tr>
                <tr><td style="padding: 5px 0; font-weight: bold;">Total Billed:</td><td style="padding: 5px 0; color: #2e7d32; font-weight: bold;">$${billingData.totalBilling.toFixed(2)}</td></tr>
              </table>
            </div>

            ${billingData.totalConnects > 0 ? `
            <h4 style="color: #1a365d;">✅ Successful Connects</h4>
            ${billingData.connects.map(call => `
              <p style="margin: 5px 0;">• ${call.clientName} (${call.clientPhone}) - ${call.callTime} - $${call.billingAmount}</p>
            `).join('')}
            ` : ''}

            ${billingData.totalMissedCalls > 0 ? `
            <h4 style="color: #1a365d;">📵 Missed Calls</h4>
            ${billingData.missedCalls.map(call => `
              <p style="margin: 5px 0;">• ${call.clientName} (${call.clientPhone}) - ${call.callTime} - $${call.billingAmount}</p>
            `).join('')}
            ` : ''}
          </div>

          <div style="background: #718096; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">AO Intelligence | Daily Billing Recap</p>
          </div>
        </div>
      `;

      // Send via real Mailgun service
      const emailSent = await sendEmail({
        to: billingData.agentEmail,
        subject: `📊 Daily Billing Recap - ${billingData.date} ($${billingData.totalBilling.toFixed(2)})`,
        html: emailHtml,
        text: `Daily billing recap for ${billingData.date}: ${billingData.totalConnects} connects, ${billingData.totalMissedCalls} missed calls, $${billingData.totalBilling.toFixed(2)} total billed.`
      });


      if (emailSent) {
        console.log(`✅ Daily recap sent to ${billingData.agentEmail}`);

        // Log email sent to database (optional)
        if (supabase) {
          await supabase
            .from('email_notifications')
            .insert({
              recipient: billingData.agentEmail,
              subject: `Daily Billing Recap - ${date}`,
              type: 'daily_billing_recap',
              status: 'sent',
              sent_at: new Date().toISOString(),
              metadata: {
                agentId: billingData.agentId,
                date: date,
                totalBilling: billingData.totalBilling,
                totalConnects: billingData.totalConnects,
                totalMissedCalls: billingData.totalMissedCalls
              }
            });
        }

        return true;
      } else {
        console.error(`❌ Failed to send daily recap to ${billingData.agentEmail}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ Error sending daily recap:`, error);
      return false;
    }
  }

  /**
   * Send daily recaps to all active agents for a specific date
   */
  static async sendAllAgentDailyRecaps(date: string): Promise<{ sent: number; errors: number; details: string[] }> {
    if (!supabase) {
      console.error('❌ Supabase not available');
      return { sent: 0, errors: 1, details: ['Supabase not available'] };
    }

    try {
      console.log(`🔄 Sending daily recaps for ${date} to all active agents`);

      // Get all agents who had activity on this date
      const startOfDay = `${date}T00:00:00+00:00`;
      const endOfDay = `${date}T23:59:59+00:00`;

      // Get agents with VDP calls
      const { data: vdpAgents, error: vdpError } = await supabase
        .from('vdp_calls')
        .select('agent')
        .gte('time', startOfDay)
        .lte('time', endOfDay);

      // Get agents with missed calls
      const { data: missedAgents, error: missedError } = await supabase
        .from('vdp_calls_missed')
        .select('agent')
        .gte('time', startOfDay)
        .lte('time', endOfDay);

      if (vdpError || missedError) {
        console.error('❌ Error fetching agent activity:', { vdpError, missedError });
        return { sent: 0, errors: 1, details: ['Error fetching agent activity'] };
      }

      // Combine and deduplicate agent IDs
      const allAgentIds = new Set([
        ...(vdpAgents || []).map(a => a.agent),
        ...(missedAgents || []).map(a => a.agent)
      ]);

      const activeAgents = Array.from(allAgentIds).filter(id => id && id !== '');

      console.log(`📊 Found ${activeAgents.length} agents with activity on ${date}`);

      let sent = 0;
      let errors = 0;
      const details: string[] = [];

      // Send recap to each agent
      for (const agentId of activeAgents) {
        try {
          const success = await this.sendAgentDailyRecap(agentId, date);
          if (success) {
            sent++;
            details.push(`✅ Sent to agent ${agentId}`);
          } else {
            errors++;
            details.push(`❌ Failed to send to agent ${agentId}`);
          }
        } catch (error) {
          errors++;
          details.push(`❌ Error sending to agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Small delay to avoid overwhelming email service
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✅ Daily recap batch complete: ${sent} sent, ${errors} errors`);

      return { sent, errors, details };

    } catch (error) {
      console.error(`❌ Error sending daily recaps:`, error);
      return {
        sent: 0,
        errors: 1,
        details: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Schedule automatic daily recap sending (for previous day)
   */
  static setupDailyRecapScheduler(): void {
    console.log('📅 Setting up daily billing recap scheduler...');

    // Send recaps every day at 7 AM PST for the previous day
    const sendDailyRecaps = async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      console.log(`🔄 Automated daily recap sending for ${dateStr}`);

      const result = await this.sendAllAgentDailyRecaps(dateStr);
      console.log(`📊 Automated recap results: ${result.sent} sent, ${result.errors} errors`);
    };

    // Calculate time until next 7 AM PST
    const now = new Date();
    const tomorrow7AM = new Date();
    tomorrow7AM.setDate(now.getDate() + 1);
    tomorrow7AM.setHours(7, 0, 0, 0); // 7 AM PST

    const msUntil7AM = tomorrow7AM.getTime() - now.getTime();

    // Schedule first run
    setTimeout(() => {
      sendDailyRecaps();

      // Then run every 24 hours
      setInterval(sendDailyRecaps, 24 * 60 * 60 * 1000);
    }, msUntil7AM);

    console.log(`⏰ Daily recap scheduler set up - next run in ${Math.round(msUntil7AM / 1000 / 60)} minutes`);
  }
}