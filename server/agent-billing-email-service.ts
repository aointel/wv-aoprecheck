import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { supabase } from './supabase';
import { pool } from './db';

interface AgentBillingData {
  agentName: string;
  email: string;
  associateId: string;
  connects: number;
  missedCalls: number;
  totalEarnings: number;
  connectEarnings: number;
  missedCallEarnings: number;
  creditsRemaining: number;
  creditsUsed: number;
  period: string;
}

export class AgentBillingEmailService {
  private mailgun: any;
  private domain = 'mg.connectnow.one';
  private apiKey = 'aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a';

  constructor() {
    if (!this.apiKey) {
      console.warn('⚠️ Mailgun API key not configured - email service disabled');
      return;
    }
    
    const mg = new Mailgun(formData);
    this.mailgun = mg.client({
      username: 'api',
      key: this.apiKey,
      url: 'https://api.mailgun.net'
    });

    console.log('✅ Mailgun email service initialized');
  }

  async sendDailyBillingSummaries(): Promise<void> {
    console.log('📧 🔥 ADMIN MODE: Sending ALL daily billing reports to admin');
    
    if (!this.mailgun) {
      console.error('❌ Mailgun not configured - skipping email delivery');
      return;
    }

    try {
      // Get all active agents from customers table
      if (!supabase) {
        console.error('❌ Supabase not configured');
        return;
      }
      const { data: agents, error } = await supabase
        .from('customers')
        .select('associate_id, first_name, last_name, company_email')
        .not('company_email', 'is', null)
        .not('associate_id', 'is', null);

      if (error) {
        console.error('❌ Error fetching agents:', error);
        return;
      }

      console.log(`📊 Found ${agents?.length || 0} agents to process for ADMIN REVIEW`);

      if (!agents || agents.length === 0) {
        console.log('ℹ️ No agents found for email delivery');
        return;
      }

      let allReportsHTML = '';
      let totalAgents = 0;
      let totalConnects = 0;
      let totalEarnings = 0;

      // Process each agent and aggregate data for admin review
      for (const agent of agents) {
        try {
          const billingData = await this.getAgentBillingData(agent.associate_id, agent.company_email);
          
          if (billingData && (billingData.connects > 0 || billingData.missedCalls > 0)) {
            totalAgents++;
            totalConnects += billingData.connects;
            totalEarnings += billingData.totalEarnings;
            
            allReportsHTML += `
              <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 15px 0;">
                <h3 style="color: #1a365d; margin: 0 0 15px 0;">👤 ${billingData.agentName} (${billingData.associateId})</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 10px 0;">
                  <div style="text-align: center; background: #e8f5e8; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">${billingData.connects}</div>
                    <div style="font-size: 12px; color: #666;">Connects</div>
                  </div>
                  <div style="text-align: center; background: #ffebee; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 24px; font-weight: bold; color: #d32f2f;">${billingData.missedCalls}</div>
                    <div style="font-size: 12px; color: #666;">Missed</div>
                  </div>
                  <div style="text-align: center; background: #e3f2fd; padding: 10px; border-radius: 5px;">
                    <div style="font-size: 24px; font-weight: bold; color: #1976d2;">$${billingData.totalEarnings}</div>
                    <div style="font-size: 12px; color: #666;">Total</div>
                  </div>
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 10px;">
                  📧 ${billingData.email} | 💰 Credits: ${billingData.creditsRemaining} remaining, ${billingData.creditsUsed} used
                </div>
              </div>
            `;
            
            console.log(`✅ Included ${agent.first_name} ${agent.last_name} - ${billingData.connects} connects, ${billingData.missedCalls} missed, $${billingData.totalEarnings}`);
          } else {
            console.log(`⏸️ Skipped ${agent.first_name} ${agent.last_name} - no activity to report`);
          }
        } catch (error) {
          console.error(`❌ Error processing agent ${agent.associate_id}:`, error);
        }
      }

      // Send consolidated admin report to admin
      if (totalAgents > 0) {
        await this.sendAdminConsolidatedReport(allReportsHTML, totalAgents, totalConnects, totalEarnings);
        console.log(`📧 🔥 ADMIN REPORT SENT: ${totalAgents} agents, ${totalConnects} connects, $${totalEarnings} total earnings`);
      } else {
        console.log(`📭 No agent activity to report for admin review`);
      }
    } catch (error) {
      console.error('❌ Error in daily billing summary process:', error);
    }
  }

  private async getAgentBillingData(associateId: string, email: string): Promise<AgentBillingData | null> {
    try {
      // Get yesterday's date range
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const startDate = new Date(yesterday);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(yesterday);
      endDate.setHours(23, 59, 59, 999);

      // Get agent name
      if (!supabase) {
        console.error('❌ Supabase not configured');
        return null;
      }
      const { data: agentData } = await supabase
        .from('customers')
        .select('first_name, last_name')
        .eq('associate_id', associateId)
        .single();

      const agentName = agentData ? `${agentData.first_name} ${agentData.last_name}` : 'Agent';

      // Get VDP calls for yesterday
      const vdpQuery = `
        SELECT * FROM vdp_calls 
        WHERE agent = $1 
        AND time >= $2 
        AND time <= $3
        ORDER BY time DESC
      `;

      const vdpResult = await pool.query(vdpQuery, [
        associateId, 
        startDate.toISOString(), 
        endDate.toISOString()
      ]);

      // Get VDP missed calls for yesterday
      const missedQuery = `
        SELECT * FROM vdp_missed_calls 
        WHERE agent = $1 
        AND time >= $2 
        AND time <= $3
        ORDER BY time DESC
      `;

      const missedResult = await pool.query(missedQuery, [
        associateId, 
        startDate.toISOString(), 
        endDate.toISOString()
      ]);

      const connects = vdpResult.rows.length;
      const missedCalls = missedResult.rows.length;
      const connectEarnings = connects * 8; // $8 per connect
      const missedCallEarnings = missedCalls * 4; // $4 per missed call
      const totalEarnings = connectEarnings + missedCallEarnings;

      // Get credit information
      const { data: creditData } = supabase ? await supabase
        .from('agent_credits')
        .select('*')
        .eq('email', email)
        .single() : { data: null };

      const creditsRemaining = creditData?.credits_remaining || 0;
      const creditsUsed = creditData?.credits_used || 0;

      return {
        agentName,
        email,
        associateId,
        connects,
        missedCalls,
        totalEarnings,
        connectEarnings,
        missedCallEarnings,
        creditsRemaining,
        creditsUsed,
        period: yesterday.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      };
    } catch (error) {
      console.error(`❌ Error getting billing data for agent ${associateId}:`, error);
      return null;
    }
  }

  private async sendBillingSummaryEmail(data: AgentBillingData): Promise<void> {
    const subject = `Daily Connect Summary - ${data.period}`;
    
    const htmlContent = this.generateEmailTemplate(data);
    
    const messageData = {
      from: `AO Intelligence <noreply@${this.domain}>`,
      to: data.email,
      subject,
      html: htmlContent,
    };

    await this.mailgun.messages.create(this.domain, messageData);
  }

  private generateEmailTemplate(data: AgentBillingData): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Daily Connect Summary</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background: white;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 5px;
            }
            .date {
                color: #6b7280;
                font-size: 16px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin: 30px 0;
            }
            .stat-card {
                background: #f8f9fa;
                border-radius: 6px;
                padding: 20px;
                text-align: center;
                border-left: 4px solid #2563eb;
            }
            .stat-card.missed {
                border-left: 4px solid #dc2626;
            }
            .stat-value {
                font-size: 28px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 5px;
            }
            .stat-value.missed {
                color: #dc2626;
            }
            .stat-label {
                color: #6b7280;
                font-size: 14px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .earnings-section {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                border-radius: 8px;
                padding: 25px;
                margin: 30px 0;
                text-align: center;
            }
            .total-earnings {
                font-size: 36px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .earnings-breakdown {
                font-size: 14px;
                opacity: 0.9;
            }
            .credits-section {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                padding: 20px;
                margin: 20px 0;
            }
            .credits-title {
                font-weight: bold;
                color: #92400e;
                margin-bottom: 10px;
            }
            .credits-info {
                color: #451a03;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
                color: #6b7280;
                font-size: 14px;
            }
            @media (max-width: 480px) {
                .stats-grid {
                    grid-template-columns: 1fr;
                    gap: 15px;
                }
                .container {
                    padding: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">AO Intelligence</div>
                <div class="date">Daily Connect Summary</div>
            </div>

            <h2>Hello ${data.agentName}!</h2>
            <p>Here's your performance summary for <strong>${data.period}</strong>:</p>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${data.connects}</div>
                    <div class="stat-label">Connects</div>
                </div>
                <div class="stat-card missed">
                    <div class="stat-value missed">${data.missedCalls}</div>
                    <div class="stat-label">Missed Calls</div>
                </div>
            </div>

            <div class="earnings-section">
                <div class="total-earnings">$${data.totalEarnings.toFixed(2)}</div>
                <div class="earnings-breakdown">
                    ${data.connects} connects ($${data.connectEarnings}) + ${data.missedCalls} missed calls ($${data.missedCallEarnings})
                </div>
            </div>

            <div class="credits-section">
                <div class="credits-title">Credit Status</div>
                <div class="credits-info">
                    <strong>${data.creditsRemaining} credits remaining</strong> • ${data.creditsUsed} credits used
                </div>
            </div>

            <div class="footer">
                <p>Keep up the great work! 🚀</p>
                <p>Need help? Contact support at aointel@aoglobelife.com</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Manual trigger for testing
  async sendTestEmail(email: string, associateId: string): Promise<boolean> {
    if (!this.mailgun) {
      console.error('❌ Mailgun not configured');
      return false;
    }

    try {
      const billingData = await this.getAgentBillingData(associateId, email);
      
      if (!billingData) {
        console.error('❌ No billing data found for test email');
        return false;
      }

      // Override subject for test
      const subject = `TEST - Daily Connect Summary - ${billingData.period}`;
      const htmlContent = this.generateEmailTemplate(billingData);
      
      const messageData = {
        from: `AO Intelligence <noreply@${this.domain}>`,
        to: email,
        subject,
        html: htmlContent,
      };

      await this.mailgun.messages.create(this.domain, messageData);
      console.log(`✅ Test email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending test email:', error);
      return false;
    }
  }

  // Send consolidated admin report to admin
  private async sendAdminConsolidatedReport(allReportsHTML: string, totalAgents: number, totalConnects: number, totalEarnings: number): Promise<void> {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    });

    const adminEmail = 'mmandella@ailpdx.com';
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto;">
        <div style="background: #1a365d; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px;">🔥 AO Intelligence</h1>
          <h2 style="margin: 15px 0 0 0; font-weight: normal;">ADMIN DAILY BILLING REPORT</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 18px;">${today}</p>
        </div>

        <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 25px; margin: 20px;">
          <h3 style="color: #2e7d32; margin: 0 0 20px 0; text-align: center;">📊 TEAM SUMMARY</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center;">
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="font-size: 36px; font-weight: bold; color: #1976d2;">${totalAgents}</div>
              <div style="font-size: 14px; color: #666; margin-top: 5px;">Active Agents</div>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="font-size: 36px; font-weight: bold; color: #2e7d32;">${totalConnects}</div>
              <div style="font-size: 14px; color: #666; margin-top: 5px;">Total Connects</div>
            </div>
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="font-size: 36px; font-weight: bold; color: #d32f2f;">$${totalEarnings}</div>
              <div style="font-size: 14px; color: #666; margin-top: 5px;">Total Earnings</div>
            </div>
          </div>
        </div>

        <div style="padding: 20px;">
          <h3 style="color: #1a365d; margin: 0 0 20px 0;">👥 INDIVIDUAL AGENT REPORTS</h3>
          ${allReportsHTML}
        </div>

        <div style="background: #718096; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">AO Intelligence | Admin Daily Billing Report</p>
          <p style="margin: 5px 0 0 0; opacity: 0.8;">This report contains all agent activity from ${today}</p>
        </div>
      </div>
    `;

    const messageData = {
      from: 'AO Intelligence <noreply@mg.connectnow.one>',
      to: adminEmail,
      subject: `🔥 ADMIN REPORT: ${totalAgents} agents, ${totalConnects} connects, $${totalEarnings} total - ${today}`,
      html: emailHtml,
      text: `ADMIN DAILY BILLING REPORT for ${today}: ${totalAgents} active agents, ${totalConnects} total connects, $${totalEarnings} total earnings. See HTML email for detailed breakdown.`
    };

    await this.mailgun.messages.create(this.domain, messageData);
    console.log(`✅ 🔥 Admin consolidated report sent to ${adminEmail}`);
  }
}