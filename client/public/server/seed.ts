import { db } from "./db";
import { users, teams, RoleType } from "@shared/schema";
import { eq } from "drizzle-orm";

// Function to seed sample users and teams with hierarchical structure
export async function seedSampleUsers() {
  try {
    console.log("Starting to seed sample users...");
    
    // Check if we already have seeded data
    console.log("Checking for existing users...");
    const existingUsers = await db.select().from(users).where(eq(users.email, "michael.mandella@aoglobelife.com"));
    console.log(`Found ${existingUsers.length} existing users with email 'michael.mandella@aoglobelife.com'`);
    
    if (existingUsers.length > 0) {
      console.log("Sample users already exist, skipping seed");
      return;
    }
    
    console.log("No existing users found, proceeding with seeding...");

    // 1. Create teams structure first
    // Create an object to store team IDs for reference
    const teamIds: Record<string, number> = {};

    // Create the main AO team
    const [aoTeam] = await db.insert(teams)
      .values({
        name: "AO Globe Life",
        parentTeamId: null,
        managerId: 0, // Temporary, will update after creating the Super Admin
      })
      .returning();
    
    teamIds.aoTeam = aoTeam.id;
    
    // Create RGA team
    const [rgaTeam] = await db.insert(teams)
      .values({
        name: "RGA Team",
        parentTeamId: aoTeam.id,
        managerId: 0, // Temporary, will update after creating the RGA
      })
      .returning();
    
    teamIds.rgaTeam = rgaTeam.id;
    
    // Create MGA team
    const [mgaTeam] = await db.insert(teams)
      .values({
        name: "MGA Team",
        parentTeamId: rgaTeam.id,
        managerId: 0, // Temporary, will update after creating the MGA
      })
      .returning();
    
    teamIds.mgaTeam = mgaTeam.id;
    
    // Create GA team
    const [gaTeam] = await db.insert(teams)
      .values({
        name: "GA Team",
        parentTeamId: mgaTeam.id,
        managerId: 0, // Temporary, will update after creating the GA
      })
      .returning();
    
    teamIds.gaTeam = gaTeam.id;
    
    // Create SA team
    const [saTeam] = await db.insert(teams)
      .values({
        name: "SA Team",
        parentTeamId: gaTeam.id,
        managerId: 0, // Temporary, will update after creating the SA
      })
      .returning();
    
    teamIds.saTeam = saTeam.id;

    // 2. Create users with the requested hierarchical structure
    // Create an object to store user IDs for reference
    const userIds: Record<string, number> = {};

    // Create Super Admin - Michael Mandella
    const [superAdmin] = await db.insert(users)
      .values({
        username: "michael.mandella",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "Michael Mandella",
        email: "michael.mandella@aoglobelife.com",
        role: RoleType.Values.SUPER_ADMIN,
        teamId: teamIds.aoTeam,
        managerId: null,
      })
      .returning();
    
    userIds.superAdmin = superAdmin.id;
    
    // Update AO team manager
    await db.update(teams)
      .set({ managerId: superAdmin.id })
      .where(eq(teams.id, teamIds.aoTeam));
    
    // Create AO Quality Manager - Danielle Noble
    const [qualityManager] = await db.insert(users)
      .values({
        username: "danielle.noble",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "Danielle Noble",
        email: "danielle.noble@aoglobelife.com",
        role: RoleType.Values.QUALITY_MANAGER,
        teamId: teamIds.aoTeam,
        managerId: superAdmin.id,
      })
      .returning();
    
    userIds.qualityManager = qualityManager.id;
    
    // Create RGA - Enzo Iftiu
    const [rga] = await db.insert(users)
      .values({
        username: "enzo.iftiu",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "Enzo Iftiu",
        email: "enzo.iftiu@aoglobelife.com",
        role: RoleType.Values.RGA,
        teamId: teamIds.rgaTeam,
        managerId: superAdmin.id,
      })
      .returning();
    
    userIds.rga = rga.id;
    
    // Update RGA team manager
    await db.update(teams)
      .set({ managerId: rga.id })
      .where(eq(teams.id, teamIds.rgaTeam));
    
    // Create MGA - Andi Iftiu
    const [mga] = await db.insert(users)
      .values({
        username: "andi.iftiu",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "Andi Iftiu",
        email: "andi.iftiu@aoglobelife.com",
        role: RoleType.Values.MGA,
        teamId: teamIds.mgaTeam,
        managerId: rga.id,
      })
      .returning();
    
    userIds.mga = mga.id;
    
    // Update MGA team manager
    await db.update(teams)
      .set({ managerId: mga.id })
      .where(eq(teams.id, teamIds.mgaTeam));
    
    // Create GA - GA One
    const [ga] = await db.insert(users)
      .values({
        username: "ga.one",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "GA One",
        email: "ga.one@aoglobelife.com",
        role: RoleType.Values.GA,
        teamId: teamIds.gaTeam,
        managerId: mga.id,
      })
      .returning();
    
    userIds.ga = ga.id;
    
    // Update GA team manager
    await db.update(teams)
      .set({ managerId: ga.id })
      .where(eq(teams.id, teamIds.gaTeam));
    
    // Create SA - SA One
    const [sa] = await db.insert(users)
      .values({
        username: "sa.one",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "SA One",
        email: "sa.one@aoglobelife.com",
        role: RoleType.Values.SA,
        teamId: teamIds.saTeam,
        managerId: ga.id,
      })
      .returning();
    
    userIds.sa = sa.id;
    
    // Update SA team manager
    await db.update(teams)
      .set({ managerId: sa.id })
      .where(eq(teams.id, teamIds.saTeam));
    
    // Create Agents
    // Agent One
    const [agentOne] = await db.insert(users)
      .values({
        username: "agent.one",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "Agent One",
        email: "agent.one@aoglobelife.com",
        role: RoleType.Values.AGENT,
        teamId: teamIds.saTeam,
        managerId: sa.id,
      })
      .returning();
    
    userIds.agentOne = agentOne.id;
    
    // Agent Two
    const [agentTwo] = await db.insert(users)
      .values({
        username: "agent.two",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "Agent Two",
        email: "agent.two@aoglobelife.com",
        role: RoleType.Values.AGENT,
        teamId: teamIds.saTeam,
        managerId: sa.id,
      })
      .returning();
    
    userIds.agentTwo = agentTwo.id;
    
    // Agent Three
    const [agentThree] = await db.insert(users)
      .values({
        username: "agent.three",
        password: "$2b$10$EggAJz.vjZO6jxj/TYBS4.ClYP2SPWHRVJph5z3Z6tMVB7UJU0sIO", // "password"
        fullName: "Agent Three",
        email: "agent.three@aoglobelife.com",
        role: RoleType.Values.AGENT,
        teamId: teamIds.saTeam,
        managerId: sa.id,
      })
      .returning();
    
    userIds.agentThree = agentThree.id;
    
    // Create calls assigned to agents
    // (We can add sample calls here if needed)
    
    console.log("Sample users and teams seeded successfully!");
    console.log(`Created ${Object.keys(teamIds).length} teams and ${Object.keys(userIds).length} users.`);
    return { teamIds, userIds };
  } catch (error) {
    console.error("Error seeding sample users:", error);
    // Print more detailed error information
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    throw error;
  }
}