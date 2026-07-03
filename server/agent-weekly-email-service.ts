import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { supabase } from './supabase';
import { pool } from './db';

interface WeeklyAgentData {
  agentName: string;
  email: string;
  associateId: string;
  totalConnects: number;
  totalMissedCalls: number;
  totalCharges: number;
  connectCharges: number;
  missedCallCharges: number;
  creditsRemaining: number;
  creditsUsed: number;
  weekPeriod: string;
  dailyBreakdown: Array<{
    date: string;
    connects: number;
    missedCalls: number;
    charges: number;
  }>;
}

export class AgentWeeklyEmailService {
  private mailgun: any;
  private domain = 'mg.connectnow.one';
  private apiKey = 'aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a';

  constructor() {
    if (!this.apiKey) {
      console.warn('⚠️ Mailgun API key not configured - weekly email service disabled');
      return;
    }
    
    const mg = new Mailgun(formData);
    this.mailgun = mg.client({
      username: 'api',
      key: this.apiKey,
      url: 'https://api.mailgun.net'
    });

    console.log('✅ Mailgun weekly email service initialized');
  }

  async sendWeeklyReportSummaries(): Promise<void> {
    console.log('📧 Starting weekly report email process...');
    
    if (!this.mailgun) {
      console.error('❌ Mailgun not configured - skipping weekly email delivery');
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
        .select('associate_id, first_name, last_name, email')
        .not('email', 'is', null)
        .not('associate_id', 'is', null);

      if (error) {
        console.error('❌ Error fetching agents:', error);
        return;
      }

      console.log(`📊 Found ${agents?.length || 0} agents to process for weekly report`);

      if (!agents || agents.length === 0) {
        console.log('ℹ️ No agents found for weekly email delivery');
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      // Process each agent
      for (const agent of agents) {
        try {
          const weeklyData = await this.getAgentWeeklyData(agent.associate_id, agent.email);
          
          if (weeklyData) {
            // Only send email if agent has activity (connects OR missed calls)
            if (weeklyData.totalConnects > 0 || weeklyData.totalMissedCalls > 0) {
              await this.sendWeeklyReportEmail(weeklyData);
              successCount++;
              console.log(`✅ Weekly email sent to ${agent.first_name} ${agent.last_name} (${agent.email}) - ${weeklyData.totalConnects} connects, ${weeklyData.totalMissedCalls} missed`);
            } else {
              skippedCount++;
              console.log(`⏸️ Skipped ${agent.first_name} ${agent.last_name} (${agent.email}) - no weekly activity to report`);
            }
          } else {
            console.log(`⚠️ No weekly data found for agent ${agent.associate_id}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing weekly email for agent ${agent.associate_id}:`, error);
        }
      }

      console.log(`📧 Weekly report complete: ${successCount} sent, ${skippedCount} skipped (no activity), ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Error in weekly report process:', error);
    }
  }

  private async getAgentWeeklyData(associateId: string, email: string): Promise<WeeklyAgentData | null> {
    try {
      // Get last 7 days (Sunday to Saturday)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

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

      // Get VDP calls for the week
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

      // Get VDP missed calls for the week
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

      // Calculate totals
      const totalConnects = vdpResult.rows.length;
      const totalMissedCalls = missedResult.rows.length;
      const connectCharges = totalConnects * 8; // $8 per connect
      const missedCallCharges = totalMissedCalls * 4; // $4 per missed call
      const totalCharges = connectCharges + missedCallCharges;

      // Create daily breakdown
      const dailyBreakdown = [];
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(startDate.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayConnects = vdpResult.rows.filter(call => {
          const callTime = new Date(call.time);
          return callTime >= dayStart && callTime <= dayEnd;
        }).length;

        const dayMissed = missedResult.rows.filter(call => {
          const callTime = new Date(call.time);
          return callTime >= dayStart && callTime <= dayEnd;
        }).length;

        const dayCharges = (dayConnects * 8) + (dayMissed * 4);

        dailyBreakdown.push({
          date: dayStart.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          }),
          connects: dayConnects,
          missedCalls: dayMissed,
          charges: dayCharges
        });
      }

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
        totalConnects,
        totalMissedCalls,
        totalCharges,
        connectCharges,
        missedCallCharges,
        creditsRemaining,
        creditsUsed,
        weekPeriod: `${startDate.toLocaleDateString('en-US')} - ${endDate.toLocaleDateString('en-US')}`,
        dailyBreakdown
      };
    } catch (error) {
      console.error(`❌ Error getting weekly data for agent ${associateId}:`, error);
      return null;
    }
  }

  private async sendWeeklyReportEmail(data: WeeklyAgentData): Promise<void> {
    const subject = `Weekly Connect Summary - ${data.weekPeriod}`;
    
    const htmlContent = this.generateWeeklyEmailTemplate(data);
    
    const messageData = {
      from: `AO Intelligence <noreply@${this.domain}>`,
      to: data.email,
      subject,
      html: htmlContent,
    };

    await this.mailgun.messages.create(this.domain, messageData);
  }

  private generateWeeklyEmailTemplate(data: WeeklyAgentData): string {
    const dailyRows = data.dailyBreakdown.map(day => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e9ecef;">${day.date}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: center; color: #2563eb; font-weight: bold;">${day.connects}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: center; color: #dc2626; font-weight: bold;">${day.missedCalls}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e9ecef; text-align: center; color: #059669; font-weight: bold;">$${day.charges.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Weekly Connect Summary</title>
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
            .summary-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 15px;
                margin: 30px 0;
            }
            .summary-card {
                background: #f8f9fa;
                border-radius: 6px;
                padding: 20px;
                text-align: center;
            }
            .summary-card.connects {
                border-left: 4px solid #2563eb;
            }
            .summary-card.missed {
                border-left: 4px solid #dc2626;
            }
            .summary-card.charges {
                border-left: 4px solid #059669;
            }
            .summary-value {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .summary-value.connects {
                color: #2563eb;
            }
            .summary-value.missed {
                color: #dc2626;
            }
            .summary-value.charges {
                color: #059669;
            }
            .summary-label {
                color: #6b7280;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .daily-table {
                width: 100%;
                border-collapse: collapse;
                margin: 30px 0;
                background: white;
                border-radius: 6px;
                overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .daily-table th {
                background: #f8f9fa;
                padding: 15px 12px;
                text-align: left;
                font-weight: 600;
                color: #374151;
                border-bottom: 2px solid #e9ecef;
            }
            .daily-table th:nth-child(2),
            .daily-table th:nth-child(3),
            .daily-table th:nth-child(4) {
                text-align: center;
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
                .summary-grid {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                .container {
                    padding: 20px;
                }
                .daily-table {
                    font-size: 14px;
                }
                .daily-table th,
                .daily-table td {
                    padding: 8px 6px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">AO Intelligence</div>
                <div class="date">Weekly Connect Summary</div>
            </div>

            <h2>Hello ${data.agentName}!</h2>
            <p>Here's your weekly billing summary for <strong>${data.weekPeriod}</strong>. These charges are applied to your AOI credit balance:</p>

            <div class="summary-grid">
                <div class="summary-card connects">
                    <div class="summary-value connects">${data.totalConnects}</div>
                    <div class="summary-label">Total Connects</div>
                </div>
                <div class="summary-card missed">
                    <div class="summary-value missed">${data.totalMissedCalls}</div>
                    <div class="summary-label">Total Missed</div>
                </div>
                <div class="summary-card charges">
                    <div class="summary-value charges">$${data.totalCharges.toFixed(2)}</div>
                    <div class="summary-label">Total Charges</div>
                </div>
            </div>

            <h3 style="color: #374151; margin-bottom: 15px;">Daily Breakdown</h3>
            <table class="daily-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Connects</th>
                        <th>Missed</th>
                        <th>Charges</th>
                    </tr>
                </thead>
                <tbody>
                    ${dailyRows}
                </tbody>
            </table>

            <div class="credits-section">
                <div class="credits-title">AOI Credit Balance</div>
                <div class="credits-info">
                    <strong>${data.creditsRemaining} credits remaining</strong> • ${data.creditsUsed} credits used this week
                </div>
            </div>

            <div class="footer">
                <p>Great work this week! 🚀</p>
                <p>Need help? Contact support at aointel@aoglobelife.com</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Manual trigger for testing
  async sendTestWeeklyEmail(email: string, associateId: string): Promise<boolean> {
    if (!this.mailgun) {
      console.error('❌ Mailgun not configured');
      return false;
    }

    try {
      const weeklyData = await this.getAgentWeeklyData(associateId, email);
      
      if (!weeklyData) {
        console.error('❌ No weekly data found for test email');
        return false;
      }

      // Override subject for test
      const subject = `TEST - Weekly Connect Summary - ${weeklyData.weekPeriod}`;
      const htmlContent = this.generateWeeklyEmailTemplate(weeklyData);
      
      const messageData = {
        from: `AO Intelligence <noreply@${this.domain}>`,
        to: email,
        subject,
        html: htmlContent,
      };

      await this.mailgun.messages.create(this.domain, messageData);
      console.log(`✅ Test weekly email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending test weekly email:', error);
      return false;
    }
  }
}