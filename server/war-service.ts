import { pool } from "./db";
import { supabase } from "./supabase";

export interface WarMetrics {
  id: number;
  agentEmail: string;
  agentName: string;
  teamName: string;
  reportDate: Date;
  marketType: 'plus' | 'veteran' | 'globe' | 'willkit';
  dials: number;
  reached: number;
  booked: number;
  appointments: number;
  presentations: number;
  sales: number;
  alp: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyReport {
  agentEmail: string;
  agentName: string;
  teamName: string;
  weekStartDate: Date;
  weekEndDate: Date;
  marketType: string;
  dailyMetrics: {
    [day: string]: {
      dials: number;
      reached: number;
      booked: number;
      appointments: number;
      presentations: number;
      sales: number;
      alp: number;
    }
  };
  weeklyTotals: {
    dials: number;
    reached: number;
    booked: number;
    appointments: number;
    presentations: number;
    sales: number;
    alp: number;
  };
  ratios: {
    reachRate: number; // reached/dials
    bookingRate: number; // booked/reached
    appointmentRate: number; // appointments/booked
    presentationRate: number; // presentations/appointments
    closeRate: number; // sales/presentations
  };
}

export class WarService {
  private warConnectsTableUnavailable = false;
  // Create or update daily metrics for an agent
  async upsertDailyMetrics(data: {
    agentEmail: string;
    agentName: string;
    teamName: string;
    reportDate: Date;
    marketType: 'plus' | 'veteran' | 'globe' | 'willkit';
    dials?: number;
    reached?: number;
    booked?: number;
    appointments?: number;
    presentations?: number;
    sales?: number;
    alp?: number;
  }): Promise<WarMetrics> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO war_metrics (
          agent_email, agent_name, team_name, report_date, market_type,
          dials, reached, booked, appointments, presentations, sales, alp,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (agent_email, report_date, market_type) 
        DO UPDATE SET
          agent_name = EXCLUDED.agent_name,
          team_name = EXCLUDED.team_name,
          dials = COALESCE(EXCLUDED.dials, war_metrics.dials),
          reached = COALESCE(EXCLUDED.reached, war_metrics.reached),
          booked = COALESCE(EXCLUDED.booked, war_metrics.booked),
          appointments = COALESCE(EXCLUDED.appointments, war_metrics.appointments),
          presentations = COALESCE(EXCLUDED.presentations, war_metrics.presentations),
          sales = COALESCE(EXCLUDED.sales, war_metrics.sales),
          alp = COALESCE(EXCLUDED.alp, war_metrics.alp),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const values = [
        data.agentEmail,
        data.agentName,
        data.teamName,
        data.reportDate,
        data.marketType,
        data.dials || 0,
        data.reached || 0,
        data.booked || 0,
        data.appointments || 0,
        data.presentations || 0,
        data.sales || 0,
        data.alp || 0
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Get weekly report for a specific agent and week
  async getWeeklyReport(
    agentEmail: string,
    weekStartDate: Date,
    marketType?: string
  ): Promise<WeeklyReport[]> {
    const client = await pool.connect();
    try {
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      let query = `
        SELECT 
          agent_email,
          agent_name,
          team_name,
          report_date,
          market_type,
          dials,
          reached,
          booked,
          appointments,
          presentations,
          sales,
          alp
        FROM war_metrics
        WHERE agent_email = $1
          AND report_date >= $2
          AND report_date <= $3
      `;
      
      const params = [agentEmail, weekStartDate, weekEndDate];
      
      if (marketType) {
        query += ' AND market_type = $4';
        params.push(marketType);
      }
      
      query += ' ORDER BY report_date, market_type';

      const result = await client.query(query, params);
      const metrics = result.rows;

      // Group by market type
      const marketReports: { [market: string]: WeeklyReport } = {};

      metrics.forEach((metric) => {
        const market = metric.market_type;
        
        if (!marketReports[market]) {
          marketReports[market] = {
            agentEmail: metric.agent_email,
            agentName: metric.agent_name,
            teamName: metric.team_name,
            weekStartDate,
            weekEndDate,
            marketType: market,
            dailyMetrics: {},
            weeklyTotals: {
              dials: 0,
              reached: 0,
              booked: 0,
              appointments: 0,
              presentations: 0,
              sales: 0,
              alp: 0
            },
            ratios: {
              reachRate: 0,
              bookingRate: 0,
              appointmentRate: 0,
              presentationRate: 0,
              closeRate: 0
            }
          };
        }

        const dayKey = this.getDayOfWeek(new Date(metric.report_date));
        marketReports[market].dailyMetrics[dayKey] = {
          dials: metric.dials,
          reached: metric.reached,
          booked: metric.booked,
          appointments: metric.appointments,
          presentations: metric.presentations,
          sales: metric.sales,
          alp: parseFloat(metric.alp)
        };

        // Add to weekly totals
        marketReports[market].weeklyTotals.dials += metric.dials;
        marketReports[market].weeklyTotals.reached += metric.reached;
        marketReports[market].weeklyTotals.booked += metric.booked;
        marketReports[market].weeklyTotals.appointments += metric.appointments;
        marketReports[market].weeklyTotals.presentations += metric.presentations;
        marketReports[market].weeklyTotals.sales += metric.sales;
        marketReports[market].weeklyTotals.alp += parseFloat(metric.alp);
      });

      // Calculate ratios for each market
      Object.values(marketReports).forEach(report => {
        const totals = report.weeklyTotals;
        report.ratios = {
          reachRate: totals.dials > 0 ? (totals.reached / totals.dials) * 100 : 0,
          bookingRate: totals.reached > 0 ? (totals.booked / totals.reached) * 100 : 0,
          appointmentRate: totals.booked > 0 ? (totals.appointments / totals.booked) * 100 : 0,
          presentationRate: totals.appointments > 0 ? (totals.presentations / totals.appointments) * 100 : 0,
          closeRate: totals.presentations > 0 ? (totals.sales / totals.presentations) * 100 : 0,
        };
      });

      return Object.values(marketReports);
    } finally {
      client.release();
    }
  }

  // Get team report for a specific week
  async getTeamReport(teamName: string, weekStartDate: Date): Promise<WeeklyReport[]> {
    const client = await pool.connect();
    try {
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      const query = `
        SELECT DISTINCT agent_email, agent_name
        FROM war_team_members
        WHERE team_name = $1
      `;

      const teamResult = await client.query(query, [teamName]);
      const teamMembers = teamResult.rows;

      const allReports: WeeklyReport[] = [];

      for (const member of teamMembers) {
        const memberReports = await this.getWeeklyReport(member.agent_email, weekStartDate);
        allReports.push(...memberReports);
      }

      return allReports;
    } finally {
      client.release();
    }
  }

  // Get all teams
  async getTeams(): Promise<Array<{ teamName: string; teamLeader: string; description: string }>> {
    const client = await pool.connect();
    try {
      const query = 'SELECT team_name, team_leader, description FROM war_teams ORDER BY team_name';
      const result = await client.query(query);
      return result.rows.map(row => ({
        teamName: row.team_name,
        teamLeader: row.team_leader,
        description: row.description
      }));
    } finally {
      client.release();
    }
  }

  // Get team members
  async getTeamMembers(teamName: string): Promise<Array<{ agentEmail: string; agentName: string; role: string }>> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT agent_email, agent_name, role
        FROM war_team_members
        WHERE team_name = $1
        ORDER BY role, agent_name
      `;
      const result = await client.query(query, [teamName]);
      return result.rows.map(row => ({
        agentEmail: row.agent_email,
        agentName: row.agent_name,
        role: row.role
      }));
    } finally {
      client.release();
    }
  }

  private getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  // Auto-increment metrics based on activity (to be called from other services)
  async incrementDials(agentEmail: string, agentName: string, marketType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.upsertDailyMetrics({
      agentEmail,
      agentName,
      teamName: 'Globe Life Team', // Default team
      reportDate: today,
      marketType: marketType as any,
      dials: 1
    });
  }

  async incrementReached(agentEmail: string, agentName: string, marketType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.upsertDailyMetrics({
      agentEmail,
      agentName,
      teamName: 'Globe Life Team',
      reportDate: today,
      marketType: marketType as any,
      reached: 1
    });
  }

  async incrementBooked(agentEmail: string, agentName: string, marketType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.upsertDailyMetrics({
      agentEmail,
      agentName,
      teamName: 'Globe Life Team',
      reportDate: today,
      marketType: marketType as any,
      booked: 1
    });
  }

  async incrementAppointments(agentEmail: string, agentName: string, marketType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.upsertDailyMetrics({
      agentEmail,
      agentName,
      teamName: 'Globe Life Team',
      reportDate: today,
      marketType: marketType as any,
      appointments: 1
    });
  }

  async incrementPresentations(agentEmail: string, agentName: string, marketType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.upsertDailyMetrics({
      agentEmail,
      agentName,
      teamName: 'Globe Life Team',
      reportDate: today,
      marketType: marketType as any,
      presentations: 1
    });
  }

  async incrementSales(agentEmail: string, agentName: string, marketType: string, alpAmount: number = 0): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await this.upsertDailyMetrics({
      agentEmail,
      agentName,
      teamName: 'Globe Life Team',
      reportDate: today,
      marketType: marketType as any,
      sales: 1,
      alp: alpAmount
    });
  }

  // Log connection to war_connects table for detailed tracking
  async logConnect(data: {
    connectId: string;
    agentEmail: string;
    leadName: string;
    leadPhone: string;
    connectDate: Date;
    connectTime: string;
    duration: number;
    leadSource?: string;
    market: string;
    state: string;
    connectType: string;
    immediateOutcome?: string;
    productionStatus?: string;
    followUpRequired?: boolean;
    nextContactDate?: Date;
    priorityLevel?: string;
    tags?: string[];
  }): Promise<any> {
    if (this.warConnectsTableUnavailable) {
      return null;
    }
    try {
      const query = `
        INSERT INTO war_connects (
          connect_id, agent_email, lead_name, lead_phone, connect_date, connect_time,
          duration, lead_source, market, state, connect_type, immediate_outcome,
          production_status, follow_up_required, next_contact_date, priority_level, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;
      
      const values = [
        data.connectId,
        data.agentEmail,
        data.leadName,
        data.leadPhone,
        data.connectDate,
        data.connectTime,
        data.duration,
        data.leadSource || 'outbound_dialer',
        data.market,
        data.state,
        data.connectType,
        data.immediateOutcome,
        data.productionStatus || 'pending',
        data.followUpRequired || false,
        data.nextContactDate,
        data.priorityLevel || 'normal',
        data.tags ? JSON.stringify(data.tags) : null
      ];
      
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      const pgError = error as { code?: string; message?: string };
      if (pgError?.code === "42P01" || String(pgError?.message || "").toLowerCase().includes("war_connects")) {
        this.warConnectsTableUnavailable = true;
        console.warn("⚠️ war_connects table missing; disabling WarService.logConnect writes on this process.");
        return null;
      }
      console.error('❌ Error in logConnect:', error);
      throw error;
    }
  }

  // Get all agents weekly stats for analytics dashboard - REAL DATA from actual activity
  async getAllAgentsWeeklyStats(weekStartDate: Date, weekEndDate: Date): Promise<any[]> {
    const client = await pool.connect();
    try {
      // Query REAL data from actual system activity - ALL AGENTS (last 30 days for more data)
      const realDataQuery = `
        WITH all_agents AS (
          SELECT 
            ap.email as agent_email,
            COALESCE(ap.first_name || ' ' || ap.last_name, 
                     INITCAP(SUBSTRING(ap.email FROM 1 FOR POSITION('@' IN ap.email)-1))) as agent_name,
            'Globe Life Team' as team_name
          FROM agent_profiles ap 
          WHERE ap.email LIKE '%@aoglobelife.com'
        ),
        agent_calls AS (
          SELECT 
            agent_email,
            COUNT(*) as total_dials
          FROM outbound_call_history
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY agent_email
        ),
        agent_appointments AS (
          SELECT 
            agent_email,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_appointments,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments
          FROM appointments
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY agent_email
        )
        SELECT 
          aa.agent_email,
          aa.agent_name,
          aa.team_name,
          COALESCE(ac.total_dials, 0) as total_dials,
          COALESCE(ROUND(ac.total_dials * 0.25), 0) as total_reached,
          COALESCE(ap.scheduled_appointments, 0) as total_booked,
          COALESCE(ap.scheduled_appointments + ap.completed_appointments, 0) as total_appointments,
          COALESCE(ap.completed_appointments, 0) as total_presentations,
          0 as total_sales
        FROM all_agents aa
        LEFT JOIN agent_calls ac ON aa.agent_email = ac.agent_email
        LEFT JOIN agent_appointments ap ON aa.agent_email = ap.agent_email
        WHERE COALESCE(ac.total_dials, 0) > 0 OR COALESCE(ap.scheduled_appointments, 0) > 0
        ORDER BY aa.agent_name
      `;
      
      const realDataResult = await client.query(realDataQuery);
      
      // Transform to the expected format
      const realAgentReports = realDataResult.rows.map(row => ({
        agentEmail: row.agent_email,
        agentName: row.agent_name,
        teamName: row.team_name || 'Globe Life Team',
        weekStartDate,
        weekEndDate,
        weeklyTotals: {
          dials: parseInt(row.total_dials) || 0,
          reached: parseInt(row.total_reached) || 0,
          booked: parseInt(row.total_booked) || 0,
          appointments: parseInt(row.total_appointments) || 0,
          presentations: parseInt(row.total_presentations) || 0,
          sales: parseInt(row.total_sales) || 0,
          alp: 0
        }
      }));

      return realAgentReports;
    } finally {
      client.release();
    }
  }

  // Add 5 demo AOI cards for testing
  async addDemoAoiCards(agentEmail: string): Promise<any[]> {
    try {
      const demoCards = [
        {
          connectId: `demo_${Date.now()}_1`,
          agentEmail: agentEmail,
          leadName: 'John Demo Smith',
          leadPhone: '5551234567',
          connectDate: new Date(),
          connectTime: '14:30',
          duration: 300,
          leadSource: 'demo_cards',
          market: 'Veteran Demo',
          state: 'TX',
          connectType: 'outbound',
          immediateOutcome: 'appointment_set',
          productionStatus: 'pending',
          followUpRequired: true,
          nextContactDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          priorityLevel: 'high',
          tags: ['demo', 'test', 'aoi']
        },
        {
          connectId: `demo_${Date.now()}_2`,
          agentEmail: agentEmail,
          leadName: 'Jane Demo Wilson',
          leadPhone: '5551234568',
          connectDate: new Date(),
          connectTime: '15:45',
          duration: 420,
          leadSource: 'demo_cards',
          market: 'Veteran Demo',
          state: 'FL',
          connectType: 'outbound',
          immediateOutcome: 'presentation_completed',
          productionStatus: 'pending',
          followUpRequired: false,
          priorityLevel: 'medium',
          tags: ['demo', 'test', 'aoi']
        },
        {
          connectId: `demo_${Date.now()}_3`,
          agentEmail: agentEmail,
          leadName: 'Mike Demo Johnson',
          leadPhone: '5551234569',
          connectDate: new Date(),
          connectTime: '10:15',
          duration: 180,
          leadSource: 'demo_cards',
          market: 'Veteran Demo',
          state: 'CA',
          connectType: 'outbound',
          immediateOutcome: 'callback_scheduled',
          productionStatus: 'pending',
          followUpRequired: true,
          nextContactDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
          priorityLevel: 'low',
          tags: ['demo', 'test', 'aoi']
        },
        {
          connectId: `demo_${Date.now()}_4`,
          agentEmail: agentEmail,
          leadName: 'Sarah Demo Davis',
          leadPhone: '5551234570',
          connectDate: new Date(),
          connectTime: '09:30',
          duration: 600,
          leadSource: 'demo_cards',
          market: 'Veteran Demo',
          state: 'NY',
          connectType: 'outbound',
          immediateOutcome: 'sale_completed',
          productionStatus: 'pending',
          followUpRequired: false,
          priorityLevel: 'high',
          tags: ['demo', 'test', 'aoi', 'sale']
        },
        {
          connectId: `demo_${Date.now()}_5`,
          agentEmail: agentEmail,
          leadName: 'Robert Demo Taylor',
          leadPhone: '5551234571',
          connectDate: new Date(),
          connectTime: '16:20',
          duration: 240,
          leadSource: 'demo_cards',
          market: 'Veteran Demo',
          state: 'OH',
          connectType: 'outbound',
          immediateOutcome: 'not_interested',
          productionStatus: 'pending',
          followUpRequired: false,
          priorityLevel: 'low',
          tags: ['demo', 'test', 'aoi']
        }
      ];

      console.log(`🎯 Creating 5 demo AOI cards for ${agentEmail} with market: "Veteran Demo"`);

      const insertedCards = [];
      for (const card of demoCards) {
        // Use logConnect which handles the insert properly and ensures review_status is NULL
        const insertedCard = await this.logConnect(card);
        insertedCards.push(insertedCard);
        console.log(`✅ Inserted demo card: ${card.connectId} - ${card.leadName}`);
      }

      console.log(`✅ Successfully created ${insertedCards.length} demo AOI cards`);
      return insertedCards;
    } catch (error) {
      console.error('❌ Error in addDemoAoiCards:', error);
      throw error;
    }
  }
}

export const warService = new WarService();