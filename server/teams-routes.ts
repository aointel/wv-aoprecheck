import type { Express } from "express";
import { db } from "./db";
import { teams, connectnowUsers, warConnects, appointments } from "@shared/schema";
import { eq, and, count, sum, sql, desc, isNotNull } from "drizzle-orm";
import { z } from "zod";

const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  managerId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export function registerTeamsRoutes(app: Express) {
  // Get all teams with member counts and manager names
  app.get("/api/teams", async (req, res) => {
    try {
      const teamsWithStats = await db
        .select({
          id: teams.id,
          name: teams.name,
          description: teams.description,
          managerId: teams.managerId,
          isActive: teams.isActive,
          createdAt: teams.createdAt,
          updatedAt: teams.updatedAt,
          memberCount: count(connectnowUsers.id),
          managerName: sql<string>`CONCAT(manager.first_name, ' ', manager.last_name)`,
        })
        .from(teams)
        .leftJoin(connectnowUsers, eq(teams.id, connectnowUsers.teamId))
        .leftJoin(
          sql`${connectnowUsers} as manager`,
          eq(teams.managerId, sql`manager.id`)
        )
        .groupBy(
          teams.id,
          teams.name,
          teams.description,
          teams.managerId,
          teams.isActive,
          teams.createdAt,
          teams.updatedAt,
          sql`manager.first_name`,
          sql`manager.last_name`
        )
        .orderBy(desc(teams.createdAt));

      res.json(teamsWithStats);
    } catch (error) {
      console.error("❌ Failed to fetch teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  // Get team by ID
  app.get("/api/teams/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, id));

      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      res.json(team);
    } catch (error) {
      console.error("❌ Failed to fetch team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  // Create new team
  app.post("/api/teams", async (req, res) => {
    try {
      const teamData = createTeamSchema.parse(req.body);

      const [newTeam] = await db
        .insert(teams)
        .values({
          name: teamData.name,
          description: teamData.description,
          managerId: teamData.managerId,
        })
        .returning();

      res.status(201).json(newTeam);
    } catch (error) {
      console.error("❌ Failed to create team:", error);
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // Update team
  app.put("/api/teams/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const teamData = updateTeamSchema.parse(req.body);

      const [updatedTeam] = await db
        .update(teams)
        .set({
          ...teamData,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, id))
        .returning();

      if (!updatedTeam) {
        return res.status(404).json({ error: "Team not found" });
      }

      res.json(updatedTeam);
    } catch (error) {
      console.error("❌ Failed to update team:", error);
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  // Delete team
  app.delete("/api/teams/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // First, remove team associations from users
      await db
        .update(connectnowUsers)
        .set({ teamId: null })
        .where(eq(connectnowUsers.teamId, id));

      // Then delete the team
      const [deletedTeam] = await db
        .delete(teams)
        .where(eq(teams.id, id))
        .returning();

      if (!deletedTeam) {
        return res.status(404).json({ error: "Team not found" });
      }

      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("❌ Failed to delete team:", error);
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  // Get team members
  app.get("/api/teams/:id/members", async (req, res) => {
    try {
      const { id } = req.params;

      const members = await db
        .select()
        .from(connectnowUsers)
        .where(eq(connectnowUsers.teamId, id))
        .orderBy(connectnowUsers.firstName, connectnowUsers.lastName);

      res.json(members);
    } catch (error) {
      console.error("❌ Failed to fetch team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Add member to team
  app.post("/api/teams/:teamId/members/:userId", async (req, res) => {
    try {
      const { teamId, userId } = req.params;

      // Verify team exists
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId));

      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Update user's team assignment
      const [updatedUser] = await db
        .update(connectnowUsers)
        .set({ teamId, updatedAt: new Date() })
        .where(eq(connectnowUsers.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "Member added to team successfully" });
    } catch (error) {
      console.error("❌ Failed to add member to team:", error);
      res.status(500).json({ error: "Failed to add member to team" });
    }
  });

  // Remove member from team
  app.delete("/api/teams/:teamId/members/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      const [updatedUser] = await db
        .update(connectnowUsers)
        .set({ teamId: null, updatedAt: new Date() })
        .where(eq(connectnowUsers.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "Member removed from team successfully" });
    } catch (error) {
      console.error("❌ Failed to remove member from team:", error);
      res.status(500).json({ error: "Failed to remove member from team" });
    }
  });

  // Get team statistics
  app.get("/api/teams/stats", async (req, res) => {
    try {
      const teamStats = await db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          totalMembers: count(sql`DISTINCT ${connectnowUsers.id}`),
          totalConnects: count(sql`DISTINCT ${warConnects.id}`),
          totalAppointments: count(sql`DISTINCT CASE WHEN ${warConnects.appointmentSet} = true THEN ${warConnects.id} END`),
          totalSales: count(sql`DISTINCT CASE WHEN ${warConnects.disposition} = 'sale' THEN ${warConnects.id} END`),
          totalRevenue: sum(sql`CASE WHEN ${warConnects.disposition} = 'sale' THEN CAST(${warConnects.saleAmount} AS DECIMAL) ELSE 0 END`),
        })
        .from(teams)
        .leftJoin(connectnowUsers, eq(teams.id, connectnowUsers.teamId))
        .leftJoin(warConnects, eq(connectnowUsers.email, warConnects.agentEmail))
        .where(eq(teams.isActive, true))
        .groupBy(teams.id, teams.name)
        .orderBy(desc(sql`count(DISTINCT ${warConnects.id})`));

      // Convert BigInt values to numbers for JSON serialization
      const formattedStats = teamStats.map(stat => ({
        ...stat,
        totalMembers: Number(stat.totalMembers),
        totalConnects: Number(stat.totalConnects),
        totalAppointments: Number(stat.totalAppointments),
        totalSales: Number(stat.totalSales),
        totalRevenue: Number(stat.totalRevenue || 0),
        weeklyConnects: 0, // This would need a separate query for weekly data
        averagePerformance: Number(stat.totalConnects) / Math.max(Number(stat.totalMembers), 1),
      }));

      res.json(formattedStats);
    } catch (error) {
      console.error("❌ Failed to fetch team statistics:", error);
      res.status(500).json({ error: "Failed to fetch team statistics" });
    }
  });

  // Get team performance for a specific period
  app.get("/api/teams/:id/performance", async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const performance = await db
        .select({
          agentEmail: warConnects.agentEmail,
          totalConnects: count(warConnects.id),
          totalAppointments: count(sql`CASE WHEN ${warConnects.appointmentSet} = true THEN 1 END`),
          totalSales: count(sql`CASE WHEN ${warConnects.disposition} = 'sale' THEN 1 END`),
          totalRevenue: sum(sql`CASE WHEN ${warConnects.disposition} = 'sale' THEN CAST(${warConnects.saleAmount} AS DECIMAL) ELSE 0 END`),
        })
        .from(connectnowUsers)
        .leftJoin(warConnects, eq(connectnowUsers.email, warConnects.agentEmail))
        .where(
          and(
            eq(connectnowUsers.teamId, id),
            startDate ? sql`${warConnects.connectDate} >= ${startDate}` : undefined,
            endDate ? sql`${warConnects.connectDate} <= ${endDate}` : undefined
          )
        )
        .groupBy(warConnects.agentEmail, connectnowUsers.email, connectnowUsers.firstName, connectnowUsers.lastName);

      res.json(performance);
    } catch (error) {
      console.error("❌ Failed to fetch team performance:", error);
      res.status(500).json({ error: "Failed to fetch team performance" });
    }
  });
}