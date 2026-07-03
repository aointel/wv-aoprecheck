import type { Express } from "express";
import { db } from "./db";
import { warConnects, warSubmissions, connectnowUsers } from "@shared/schema";
import { eq, and, gte, lte, desc, count, sum, sql, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { WarService } from "./war-service";
import { pool } from "./db";

const updateDispositionSchema = z.object({
  disposition: z.string(),
  appointmentDate: z.string().optional(),
  saleAmount: z.number().optional(),
  notes: z.string().optional(),
});

const submitWeeklyReportSchema = z.object({
  agentEmail: z.string().email(),
  weekStart: z.string(),
  weekEnd: z.string(),
});

const warService = new WarService();

export function registerWarRoutes(app: Express) {
  // Get war connects for an agent within a date range
  app.get("/api/war/connects", async (req, res) => {
    try {
      const { agentEmail, weekStart, weekEnd } = req.query;

      if (!agentEmail) {
        return res.status(400).json({ error: "Agent email is required" });
      }

      let query = db
        .select()
        .from(warConnects)
        .where(eq(warConnects.agentEmail, agentEmail as string))
        .orderBy(desc(warConnects.connectDate));

      if (weekStart && weekEnd) {
        query = query.where(
          and(
            eq(warConnects.agentEmail, agentEmail as string),
            gte(warConnects.connectDate, new Date(weekStart as string)),
            lte(warConnects.connectDate, new Date(weekEnd as string))
          )
        );
      }

      const connects = await query;
      res.json(connects);
    } catch (error) {
      console.error("❌ Failed to fetch war connects:", error);
      res.status(500).json({ error: "Failed to fetch war connects" });
    }
  });

  // Get war statistics for an agent
  app.get("/api/war/stats", async (req, res) => {
    try {
      const { agentEmail, weekStart, weekEnd } = req.query;

      if (!agentEmail) {
        return res.status(400).json({ error: "Agent email is required" });
      }

      let baseQuery = db
        .select({
          totalConnects: count(warConnects.id),
          reportedConnects: count(sql`CASE WHEN ${warConnects.disposition} IS NOT NULL AND ${warConnects.disposition} != 'pending' THEN 1 END`),
          unreportedConnects: count(sql`CASE WHEN ${warConnects.disposition} IS NULL OR ${warConnects.disposition} = 'pending' THEN 1 END`),
          totalAppointments: count(sql`CASE WHEN ${warConnects.appointmentSet} = true OR ${warConnects.disposition} = 'appointment' THEN 1 END`),
          totalSales: count(sql`CASE WHEN ${warConnects.disposition} = 'sale' THEN 1 END`),
          totalRevenue: sum(sql`CASE WHEN ${warConnects.disposition} = 'sale' AND ${warConnects.saleAmount} IS NOT NULL THEN CAST(${warConnects.saleAmount} AS DECIMAL) ELSE 0 END`),
        })
        .from(warConnects)
        .where(eq(warConnects.agentEmail, agentEmail as string));

      if (weekStart && weekEnd) {
        baseQuery = baseQuery.where(
          and(
            eq(warConnects.agentEmail, agentEmail as string),
            gte(warConnects.connectDate, new Date(weekStart as string)),
            lte(warConnects.connectDate, new Date(weekEnd as string))
          )
        );
      }

      const [stats] = await baseQuery;

      // Calculate rates
      const totalConnects = Number(stats.totalConnects);
      const totalAppointments = Number(stats.totalAppointments);
      const totalSales = Number(stats.totalSales);
      const totalRevenue = Number(stats.totalRevenue || 0);

      const appointmentRate = totalConnects > 0 ? (totalAppointments / totalConnects) * 100 : 0;
      const salesRate = totalConnects > 0 ? (totalSales / totalConnects) * 100 : 0;
      const averageSaleAmount = totalSales > 0 ? totalRevenue / totalSales : 0;

      const formattedStats = {
        totalConnects,
        reportedConnects: Number(stats.reportedConnects),
        unreportedConnects: Number(stats.unreportedConnects),
        totalAppointments,
        totalSales,
        totalRevenue,
        appointmentRate,
        salesRate,
        averageSaleAmount,
      };

      res.json(formattedStats);
    } catch (error) {
      console.error("❌ Failed to fetch war statistics:", error);
      res.status(500).json({ error: "Failed to fetch war statistics" });
    }
  });

  // Get daily production status for an agent
  app.get("/api/war/daily-production", async (req, res) => {
    try {
      const { agentEmail } = req.query;

      if (!agentEmail) {
        return res.status(400).json({ error: "Agent email is required" });
      }

      const dailyProduction = await warService.getDailyProductionStatus(agentEmail as string);
      res.json(dailyProduction);
    } catch (error) {
      console.error("❌ Failed to fetch daily production:", error);
      res.status(500).json({ error: "Failed to fetch daily production" });
    }
  });

  // Update connect disposition
  app.put("/api/war/connects/:connectId/disposition", async (req, res) => {
    try {
      const { connectId } = req.params;
      const dispositionData = updateDispositionSchema.parse(req.body);

      const updatedConnect = await warService.updateDisposition(
        connectId,
        dispositionData.disposition,
        dispositionData.appointmentDate ? new Date(dispositionData.appointmentDate) : undefined,
        dispositionData.saleAmount,
        dispositionData.notes
      );

      res.json(updatedConnect);
    } catch (error) {
      console.error("❌ Failed to update disposition:", error);
      res.status(500).json({ error: "Failed to update disposition" });
    }
  });

  // Submit weekly report
  app.post("/api/war/submit-weekly-report", async (req, res) => {
    try {
      const reportData = submitWeeklyReportSchema.parse(req.body);

      await warService.submitWeeklyReport(
        reportData.agentEmail,
        new Date(reportData.weekStart),
        new Date(reportData.weekEnd)
      );

      res.json({ message: "Weekly report submitted successfully" });
    } catch (error) {
      console.error("❌ Failed to submit weekly report:", error);
      res.status(500).json({ error: "Failed to submit weekly report" });
    }
  });

  // Get war submissions for an agent
  app.get("/api/war/submissions", async (req, res) => {
    try {
      const { agentEmail } = req.query;

      if (!agentEmail) {
        return res.status(400).json({ error: "Agent email is required" });
      }

      const submissions = await db
        .select()
        .from(warSubmissions)
        .where(eq(warSubmissions.agentEmail, agentEmail as string))
        .orderBy(desc(warSubmissions.weekStart));

      res.json(submissions);
    } catch (error) {
      console.error("❌ Failed to fetch war submissions:", error);
      res.status(500).json({ error: "Failed to fetch war submissions" });
    }
  });

  // Check if agent needs to submit WAR
  app.get("/api/war/check-submission/:agentEmail", async (req, res) => {
    try {
      const { agentEmail } = req.params;

      const needsSubmission = await warService.needsWarSubmission(agentEmail);
      res.json(needsSubmission);
    } catch (error) {
      console.error("❌ Failed to check WAR submission:", error);
      res.status(500).json({ error: "Failed to check WAR submission" });
    }
  });

  // Log a new connect (used by call tracking system)
  app.post("/api/war/log-connect", async (req, res) => {
    try {
      const connectData = req.body;

      const connect = await warService.logConnect({
        connectId: connectData.connectId,
        agentEmail: connectData.agentEmail,
        leadName: connectData.leadName,
        leadPhone: connectData.leadPhone,
        connectDate: new Date(connectData.connectDate),
        connectTime: connectData.connectTime,
        duration: connectData.duration,
        leadSource: connectData.leadSource,
        market: connectData.market,
        state: connectData.state,
        connectType: connectData.connectType,
        immediateOutcome: connectData.immediateOutcome,
        productionStatus: connectData.productionStatus,
        followUpRequired: connectData.followUpRequired,
        nextContactDate: connectData.nextContactDate ? new Date(connectData.nextContactDate) : undefined,
        priorityLevel: connectData.priorityLevel,
        tags: connectData.tags,
      });

      res.status(201).json(connect);
    } catch (error) {
      console.error("❌ Failed to log connect:", error);
      res.status(500).json({ error: "Failed to log connect" });
    }
  });

  // Update production status for a connect
  app.put("/api/war/connects/:connectId/production-status", async (req, res) => {
    try {
      const { connectId } = req.params;
      const { productionStatus, immediateOutcome, followUpRequired, nextContactDate, notes } = req.body;

      const updatedConnect = await warService.updateProductionStatus(
        connectId,
        productionStatus,
        immediateOutcome,
        followUpRequired,
        nextContactDate ? new Date(nextContactDate) : undefined,
        notes
      );

      res.json(updatedConnect);
    } catch (error) {
      console.error("❌ Failed to update production status:", error);
      res.status(500).json({ error: "Failed to update production status" });
    }
  });

  // Get team war report summary
  app.get("/api/war/team-summary", async (req, res) => {
    try {
      const { teamId, weekStart, weekEnd } = req.query;

      let baseQuery = db
        .select({
          agentEmail: warConnects.agentEmail,
          agentName: sql<string>`CONCAT(${connectnowUsers.firstName}, ' ', ${connectnowUsers.lastName})`,
          totalConnects: count(warConnects.id),
          reportedConnects: count(sql`CASE WHEN ${warConnects.disposition} IS NOT NULL AND ${warConnects.disposition} != 'pending' THEN 1 END`),
          totalAppointments: count(sql`CASE WHEN ${warConnects.appointmentSet} = true OR ${warConnects.disposition} = 'appointment' THEN 1 END`),
          totalSales: count(sql`CASE WHEN ${warConnects.disposition} = 'sale' THEN 1 END`),
          totalRevenue: sum(sql`CASE WHEN ${warConnects.disposition} = 'sale' AND ${warConnects.saleAmount} IS NOT NULL THEN CAST(${warConnects.saleAmount} AS DECIMAL) ELSE 0 END`),
        })
        .from(warConnects)
        .leftJoin(connectnowUsers, eq(warConnects.agentEmail, connectnowUsers.email))
        .groupBy(warConnects.agentEmail, connectnowUsers.firstName, connectnowUsers.lastName)
        .orderBy(desc(count(warConnects.id)));

      if (teamId) {
        baseQuery = baseQuery.where(eq(connectnowUsers.teamId, teamId as string));
      }

      if (weekStart && weekEnd) {
        baseQuery = baseQuery.where(
          and(
            gte(warConnects.connectDate, new Date(weekStart as string)),
            lte(warConnects.connectDate, new Date(weekEnd as string))
          )
        );
      }

      const teamSummary = await baseQuery;

      // Format the results
      const formattedSummary = teamSummary.map(agent => ({
        agentEmail: agent.agentEmail,
        agentName: agent.agentName,
        totalConnects: Number(agent.totalConnects),
        reportedConnects: Number(agent.reportedConnects),
        unreportedConnects: Number(agent.totalConnects) - Number(agent.reportedConnects),
        totalAppointments: Number(agent.totalAppointments),
        totalSales: Number(agent.totalSales),
        totalRevenue: Number(agent.totalRevenue || 0),
        appointmentRate: Number(agent.totalConnects) > 0 ? (Number(agent.totalAppointments) / Number(agent.totalConnects)) * 100 : 0,
        salesRate: Number(agent.totalConnects) > 0 ? (Number(agent.totalSales) / Number(agent.totalConnects)) * 100 : 0,
      }));

      res.json(formattedSummary);
    } catch (error) {
      console.error("❌ Failed to fetch team war summary:", error);
      res.status(500).json({ error: "Failed to fetch team war summary" });
    }
  });

  // Get all agents performance stats for analytics dashboard - REAL DATA from war_connects
  app.get("/api/war/all-agents-stats", async (req, res) => {
    const client = await pool.connect();
    try {
      // Query REAL outbound dial data from all outbound tracking systems
      const realDataQuery = `
        WITH agent_war_connects AS (
          SELECT 
            wc.agent_email,
            COALESCE(ap.first_name || ' ' || ap.last_name, 
                     INITCAP(SUBSTRING(wc.agent_email FROM 1 FOR POSITION('@' IN wc.agent_email)-1))) as agent_name,
            COUNT(*) as war_dials,
            COUNT(CASE WHEN wc.duration > 30 THEN 1 END) as war_reached,
            COUNT(CASE WHEN wc.immediate_outcome = 'appointment' OR wc.connect_type = 'appointment' OR wc.immediate_outcome = 'booked' THEN 1 END) as war_booked
          FROM war_connects wc
          LEFT JOIN agent_profiles ap ON wc.agent_email = ap.email
          WHERE wc.connect_date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY wc.agent_email, ap.first_name, ap.last_name
        ),
        agent_outbound_history AS (
          SELECT 
            och.agent_email,
            COUNT(*) as history_dials,
            COUNT(CASE WHEN och.call_duration > 30 THEN 1 END) as history_reached,
            COUNT(CASE WHEN och.call_disposition = 'appointment' THEN 1 END) as history_booked
          FROM outbound_call_history och
          WHERE och.created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY och.agent_email
        ),
        agent_call_logs AS (
          SELECT 
            cl.agent_email,
            COUNT(*) as log_dials,
            COUNT(CASE WHEN cl.call_duration > 30 THEN 1 END) as log_reached,
            COUNT(CASE WHEN cl.disposition = 'appointment' THEN 1 END) as log_booked
          FROM call_logs cl
          WHERE cl.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND cl.call_type = 'outbound'
          GROUP BY cl.agent_email
        ),
        agent_dials AS (
          SELECT 
            COALESCE(wc.agent_email, och.agent_email, cl.agent_email) as agent_email,
            COALESCE(wc.agent_name, 
                     INITCAP(SUBSTRING(COALESCE(wc.agent_email, och.agent_email, cl.agent_email) FROM 1 FOR POSITION('@' IN COALESCE(wc.agent_email, och.agent_email, cl.agent_email))-1))) as agent_name,
            COALESCE(wc.war_dials, 0) + COALESCE(och.history_dials, 0) + COALESCE(cl.log_dials, 0) as total_dials,
            COALESCE(wc.war_reached, 0) + COALESCE(och.history_reached, 0) + COALESCE(cl.log_reached, 0) as total_reached,
            COALESCE(wc.war_booked, 0) + COALESCE(och.history_booked, 0) + COALESCE(cl.log_booked, 0) as war_booked
          FROM agent_war_connects wc
          FULL OUTER JOIN agent_outbound_history och ON wc.agent_email = och.agent_email
          FULL OUTER JOIN agent_call_logs cl ON COALESCE(wc.agent_email, och.agent_email) = cl.agent_email
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
        ),
        agent_precheck_sessions AS (
          SELECT 
            agent_email,
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'completed' AND premium_amount > 0 THEN 1 END) as completed_sales,
            COALESCE(SUM(CASE WHEN status = 'completed' AND premium_amount > 0 THEN premium_amount * 12 ELSE 0 END), 0) as total_alp
          FROM aoi_precheck_sessions
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY agent_email
        ),
        agent_verification_sessions AS (
          SELECT 
            company_email as agent_email,
            COUNT(*) as total_sessions,
            COUNT(CASE WHEN status = 'completed' AND premium IS NOT NULL AND premium != '' THEN 1 END) as completed_sales,
            COALESCE(SUM(CASE WHEN status = 'completed' AND premium IS NOT NULL AND premium != '' THEN (CAST(REGEXP_REPLACE(premium, '[^0-9.]', '', 'g') AS DECIMAL) * 12) ELSE 0 END), 0) as total_alp
          FROM verification_sessions
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY company_email
        ),
        all_precheck_data AS (
          SELECT 
            COALESCE(aps.agent_email, vs.agent_email) as agent_email,
            COALESCE(aps.total_sessions, 0) + COALESCE(vs.total_sessions, 0) as total_presentations,
            COALESCE(aps.completed_sales, 0) + COALESCE(vs.completed_sales, 0) as total_sales,
            COALESCE(aps.total_alp, 0) + COALESCE(vs.total_alp, 0) as total_alp
          FROM agent_precheck_sessions aps
          FULL OUTER JOIN agent_verification_sessions vs ON aps.agent_email = vs.agent_email
        )
        SELECT 
          COALESCE(ad.agent_email, apd.agent_email) as agent_email,
          COALESCE(ad.agent_name, 
                   INITCAP(SUBSTRING(COALESCE(ad.agent_email, apd.agent_email) FROM 1 FOR POSITION('@' IN COALESCE(ad.agent_email, apd.agent_email))-1))) as agent_name,
          'Globe Life Team' as team_name,
          COALESCE(ad.total_dials, 0) as total_dials,
          COALESCE(ad.total_reached, 0) as total_reached,
          COALESCE(aa.scheduled_appointments, 0) as appointment_bookings,
          COALESCE(aa.scheduled_appointments + aa.completed_appointments + aa.cancelled_appointments, 0) as total_appointments,
          COALESCE(aa.completed_appointments, 0) + COALESCE(apd.total_presentations, 0) as total_presentations,
          COALESCE(apd.total_sales, 0) as total_sales,
          COALESCE(apd.total_alp, 0) as total_alp
        FROM agent_dials ad
        FULL OUTER JOIN all_precheck_data apd ON ad.agent_email = apd.agent_email
        LEFT JOIN agent_appointments aa ON COALESCE(ad.agent_email, apd.agent_email) = aa.agent_email
        WHERE COALESCE(ad.total_dials, 0) > 0 OR COALESCE(apd.total_presentations, 0) > 0
        ORDER BY COALESCE(ad.total_dials, 0) DESC, COALESCE(apd.total_presentations, 0) DESC
      `;
      
      const result = await client.query(realDataQuery);
      
      // Transform to expected frontend format with real calculations
      const agentPerformance = result.rows.map(row => ({
        agentName: row.agent_name,
        agentEmail: row.agent_email,
        teamName: row.team_name,
        totalDials: parseInt(row.total_dials) || 0,
        totalReached: parseInt(row.total_reached) || 0,
        totalBooked: parseInt(row.appointment_bookings) || 0,
        totalAppointments: parseInt(row.total_appointments) || 0,
        totalPresentations: parseInt(row.total_presentations) || 0,
        totalSales: parseInt(row.total_sales) || 0,
        totalALP: parseFloat(row.total_alp) || 0,
        reachRate: row.total_dials > 0 ? Math.round((row.total_reached / row.total_dials) * 100) : 0,
        bookingRate: row.total_reached > 0 ? Math.round((row.appointment_bookings / row.total_reached) * 100) : 0,
        closeRate: row.total_presentations > 0 ? Math.round((row.total_sales / row.total_presentations) * 100) : 0
      }));

      // Add missing agents who have no call tracking data but should appear in analytics
      const expectedAgents = [
        { email: 'kingsleyibeh@aoglobelife.com', name: 'Kingsley Ibeh' },
        { email: 'michael.mandella@aoglobelife.com', name: 'Michael Mandella' },
        { email: 'faye.harmon@aoglobelife.com', name: 'Faye Harmon' }
      ];

      for (const expectedAgent of expectedAgents) {
        const exists = agentPerformance.find(agent => agent.agentEmail === expectedAgent.email);
        if (!exists) {
          agentPerformance.push({
            agentName: expectedAgent.name,
            agentEmail: expectedAgent.email,
            teamName: 'Globe Life Team',
            totalDials: 0,
            totalReached: 0,
            totalBooked: 0,
            totalAppointments: 0,
            totalPresentations: 0,
            totalSales: 0,
            totalALP: 0,
            reachRate: 0,
            bookingRate: 0,
            closeRate: 0
          });
        }
      }
      
      res.json(agentPerformance);
    } catch (error) {
      console.error("❌ Failed to fetch all agents stats:", error);
      res.status(500).json({ error: "Failed to fetch all agents stats" });
    } finally {
      client.release();
    }
  });
}