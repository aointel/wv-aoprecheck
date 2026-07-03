import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  boolean
} from "drizzle-orm/pg-core";

// Agent lead position tracking - ensures agents resume where they left off
export const agentLeadProgress = pgTable("agent_lead_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentEmail: varchar("agent_email").notNull(),
  market: varchar("market").notNull(),
  lastLeadId: varchar("last_lead_id"), // ID of the last lead they worked on
  lastLeadPhone: varchar("last_lead_phone"), // Phone number for backup identification
  currentPosition: integer("current_position").default(0), // Position in the lead queue
  sessionStartedAt: timestamp("session_started_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  isActive: boolean("is_active").default(true),
  notes: text("notes")
}, (table) => ({
  // Composite unique constraint for agent + market combination
  agentMarketIdx: {
    columns: [table.agentEmail, table.market],
    unique: true
  }
}));

// FTC compliance tracking - logs when leads are skipped due to time restrictions
export const ftcComplianceLog = pgTable("ftc_compliance_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  leadPhone: varchar("lead_phone").notNull(),
  leadState: varchar("lead_state").notNull(),
  agentEmail: varchar("agent_email").notNull(),
  actionTaken: varchar("action_taken").notNull(), // 'skipped', 'allowed', 'deferred'
  leadLocalTime: varchar("lead_local_time").notNull(),
  timeZone: varchar("time_zone").notNull(),
  nextCallableTime: varchar("next_callable_time"),
  createdAt: timestamp("created_at").defaultNow(),
  reason: text("reason")
});

// Hotlead Distribution Assignments - Tracks which hotleads are assigned to which agents
export const hotleadAssignments = pgTable("hotlead_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentEmail: varchar("agent_email").notNull(),
  hotleadPhone: varchar("hotlead_phone").notNull(), // References hotleads table in Supabase
  hotleadId: varchar("hotlead_id"), // Supabase hotlead ID if available
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignmentReason: varchar("assignment_reason"), // 'state_match', 'market_match', 'activity_level', 'manual'
  isActive: boolean("is_active").default(true), // Whether assignment is still active
  completedAt: timestamp("completed_at"), // When hotlead was marked complete/resolved
  
  // Track lead details at assignment time (for audit trail)
  leadState: varchar("lead_state"),
  leadMarket: varchar("lead_market"),
  leadFirstName: varchar("lead_first_name"),
  leadLastName: varchar("lead_last_name"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate assignments
  agentHotleadIdx: {
    columns: [table.agentEmail, table.hotleadPhone],
    unique: true
  }
}));

export type AgentLeadProgress = typeof agentLeadProgress.$inferSelect;
export type InsertAgentLeadProgress = typeof agentLeadProgress.$inferInsert;
export type FTCComplianceLog = typeof ftcComplianceLog.$inferSelect;
export type InsertFTCComplianceLog = typeof ftcComplianceLog.$inferInsert;
export type HotleadAssignment = typeof hotleadAssignments.$inferSelect;
export type InsertHotleadAssignment = typeof hotleadAssignments.$inferInsert;