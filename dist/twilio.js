var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/hardcoded-config.ts
var HARDCODED_CONFIG, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID, TWILIO_PHONE_NUMBER_SID, TWILIO_PHONE_NUMBER, TWILIO_TASKROUTER_WORKSPACE_SID, TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID, WHEREBY_API_KEY, OPENAI_API_KEY, IPINFO_API_KEY, PRODUCTION_URL, WEBHOOK_BASE_URL, SESSION_SECRET, DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_REGION, S3_BUCKET, NODE_ENV, PORT;
var init_hardcoded_config = __esm({
  "server/hardcoded-config.ts"() {
    "use strict";
    HARDCODED_CONFIG = {
      // Redis fallback when process.env.REDIS_URL is unset (Railway private network only). Web + worker use server/redis-config getRedisUrl().
      REDIS_URL: "redis://default:PPuJmoYFxPgRTqLmiZJbAMXyqsDdsjmS@redis.railway.internal:6379",
      // Twilio Account Keys - Updated with your new working account
      TWILIO_ACCOUNT_SID: "AC25d37aa41aed0df4fddd81ecf7abf00d",
      TWILIO_AUTH_TOKEN: "974557c999ed53ada16c4a784af2a7d3",
      // Twilio API Keys for WebRTC tokens - Your new API key
      TWILIO_API_KEY: "SKda62cc0dd6b62fa233efbfbb67c5aaf5",
      TWILIO_API_SECRET: "dNeGYk0Wj8KXp2PghiHuz7GVa4OmAYtX",
      // Twilio App and Phone SIDs - Your new TwiML app
      TWILIO_TWIML_APP_SID: "AP958ebb1810e2315e9ff008cc06e91c1d",
      TWILIO_PHONE_NUMBER_SID: "PNa1d67508986206fa137ef97f239314d7",
      TWILIO_PHONE_NUMBER: "+19142289324",
      // TaskRouter for inbound voice routing (provisioned via npm run provision-taskrouter)
      TWILIO_TASKROUTER_WORKSPACE_SID: "WS6a978202496f59f6cd478c1310f5c2eb",
      TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID: "WW7c3e36b25267cd0489d855dd0b195f3e",
      // Production app URL (aoirail only; no baa2)
      PRODUCTION_URL: "https://aoirail-production.up.railway.app",
      // Base URL for Twilio webhooks, 609 inbound, and assignment callback. Same as production.
      WEBHOOK_BASE_URL: "https://aoirail-production.up.railway.app",
      // Session and Security
      SESSION_SECRET: "ao-precheck-production-secret-2024",
      // Database - Use Replit database URL or fallback to Neon
      DATABASE_URL: process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require",
      // Supabase Configuration
      SUPABASE_URL: "https://ycztjetxwpfgtrzeyytt.supabase.co",
      SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNzQwMzcsImV4cCI6MjA1Mjc1MDAzN30.E0gNaQyQUhfN2I8XfdNVEViVv90HxKZS4Rcwcq19ldc",
      SUPABASE_SERVICE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0",
      // S3 Storage Configuration for Supabase
      S3_ACCESS_KEY_ID: "28d0095786f39a89e8f40f73b9015357",
      S3_SECRET_ACCESS_KEY: "e5a1acbe3f9c68a569e33e70e27a6651a9d720fdd07beb0398626ae2ab7db967",
      S3_ENDPOINT: "https://ycztjetxwpfgtrzeyytt.storage.supabase.co/storage/v1/s3",
      S3_REGION: "us-east-1",
      S3_BUCKET: "verify_agent_screenshot",
      // Whereby API Key - UPDATED November 5, 2025
      WHEREBY_API_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmFwcGVhci5pbiIsImF1ZCI6Imh0dHBzOi8vYXBpLmFwcGVhci5pbi92MSIsImV4cCI6OTAwNzE5OTI1NDc0MDk5MSwiaWF0IjoxNzYyMzgzNDQyLCJvcmdhbml6YXRpb25JZCI6MzIyMzg4LCJqdGkiOiIwZDVhODdjZC01MmZjLTRjZTctOGZiZC1iMWMxMTFlNDI0MTMifQ.To1zA1SWOJaUxoE70fSiep5n798cp5yPXX6AgoLgUAI",
      // OpenAI API Key - SCREENSHOT VALIDATION ONLY
      OPENAI_API_KEY: "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",
      // IPinfo.io API Key - IP Geolocation (better accuracy than ip-api.com)
      IPINFO_API_KEY: "4dbb9166a24cc6",
      // Stripe (if needed)
      STRIPE_SECRET_KEY: "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",
      STRIPE_PUBLISHABLE_KEY: "pk_live_51QUWLbDB901D7nogTsLhaocdKc8HT8jWMs6F43v8CSeB9E8wUdg9RAh4K4ZpSUV0lY9eOVi6Sd8a5OrfaV9EnCtE00eKP0VSwF",
      // Other settings - Use environment variables if available, fallback to hardcoded values
      NODE_ENV: process.env.NODE_ENV || "production",
      PORT: process.env.PORT || 5e3
    };
    ({
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      TWILIO_TWIML_APP_SID,
      TWILIO_PHONE_NUMBER_SID,
      TWILIO_PHONE_NUMBER,
      TWILIO_TASKROUTER_WORKSPACE_SID,
      TWILIO_TASKROUTER_WORKFLOW_INBOUND_SID,
      WHEREBY_API_KEY,
      OPENAI_API_KEY,
      IPINFO_API_KEY,
      PRODUCTION_URL,
      WEBHOOK_BASE_URL,
      SESSION_SECRET,
      DATABASE_URL,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_KEY,
      S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY,
      S3_ENDPOINT,
      S3_REGION,
      S3_BUCKET,
      NODE_ENV,
      PORT
    } = HARDCODED_CONFIG);
  }
});

// server/perf-observability.ts
async function timedDependency(kind, target, fn) {
  const start = Date.now();
  try {
    const out = await fn();
    perfStore.recordDependency(kind, target, Date.now() - start, true);
    return out;
  } catch (error) {
    perfStore.recordDependency(kind, target, Date.now() - start, false);
    throw error;
  }
}
function compactUrl(input) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
  try {
    const u = new URL(raw);
    const firstPath = u.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    return `${u.host}/${firstPath || ""}`.replace(/\/$/, "");
  } catch {
    return raw.slice(0, 120);
  }
}
function wrapFetchWithPerf(kind, fetchFn) {
  return async (input, init) => {
    const target = compactUrl(input);
    return timedDependency(kind, target, () => fetchFn(input, init));
  };
}
var MAX_POINTS_PER_KEY, MAX_AGE_MS, PerfStore, perfStore, LOOP_SAMPLE_MS, expected, lagTimer;
var init_perf_observability = __esm({
  "server/perf-observability.ts"() {
    "use strict";
    MAX_POINTS_PER_KEY = 400;
    MAX_AGE_MS = 24 * 60 * 60 * 1e3;
    PerfStore = class {
      requests = /* @__PURE__ */ new Map();
      dependencies = /* @__PURE__ */ new Map();
      upsert(map, key) {
        let agg = map.get(key);
        if (!agg) {
          agg = { key, count: 0, errors: 0, totalMs: 0, maxMs: 0, points: [] };
          map.set(key, agg);
        }
        return agg;
      }
      record(map, key, durationMs, ok) {
        const agg = this.upsert(map, key);
        const now = Date.now();
        agg.count += 1;
        agg.totalMs += durationMs;
        if (!ok) agg.errors += 1;
        if (durationMs > agg.maxMs) agg.maxMs = durationMs;
        agg.points.push({ ts: now, durationMs, ok });
        if (agg.points.length > MAX_POINTS_PER_KEY) {
          agg.points.splice(0, agg.points.length - MAX_POINTS_PER_KEY);
        }
        const cutoff = now - MAX_AGE_MS;
        while (agg.points.length && agg.points[0].ts < cutoff) {
          agg.points.shift();
        }
      }
      recordRequest(method, path3, statusCode, durationMs) {
        const key = `${method.toUpperCase()} ${path3}`;
        const ok = statusCode < 500;
        this.record(this.requests, key, durationMs, ok);
      }
      recordDependency(kind, target, durationMs, ok) {
        const key = `${kind}:${target}`;
        this.record(this.dependencies, key, durationMs, ok);
      }
      toRows(map, limit) {
        const rows = Array.from(map.values()).map((agg) => {
          const samples = agg.points.map((p2) => p2.durationMs).sort((a, b) => a - b);
          const p = (q) => {
            if (!samples.length) return 0;
            const idx = Math.min(samples.length - 1, Math.floor(q / 100 * samples.length));
            return samples[idx];
          };
          return {
            key: agg.key,
            count: agg.count,
            errors: agg.errors,
            errorRate: agg.count ? Number((agg.errors / agg.count).toFixed(4)) : 0,
            avgMs: agg.count ? Number((agg.totalMs / agg.count).toFixed(2)) : 0,
            p50Ms: p(50),
            p95Ms: p(95),
            p99Ms: p(99),
            maxMs: agg.maxMs
          };
        });
        rows.sort((a, b) => b.p95Ms - a.p95Ms || b.maxMs - a.maxMs || b.count - a.count);
        return rows.slice(0, limit);
      }
      getSummary(limit = 25) {
        return {
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          topRoutesByP95: this.toRows(this.requests, limit),
          topDependenciesByP95: this.toRows(this.dependencies, limit)
        };
      }
      reset() {
        this.requests.clear();
        this.dependencies.clear();
      }
    };
    perfStore = new PerfStore();
    LOOP_SAMPLE_MS = 1e3;
    expected = Date.now() + LOOP_SAMPLE_MS;
    lagTimer = setInterval(() => {
      const now = Date.now();
      const lag = Math.max(0, now - expected);
      perfStore.recordDependency("runtime", "eventloop.lag", lag, true);
      expected = now + LOOP_SAMPLE_MS;
    }, LOOP_SAMPLE_MS);
    if (typeof lagTimer.unref === "function") lagTimer.unref();
  }
});

// server/hot-table-mode.ts
function isHotTablesEodOnly() {
  return false;
}
var init_hot_table_mode = __esm({
  "server/hot-table-mode.ts"() {
    "use strict";
  }
});

// server/hot-table-write-gate.ts
function isWithinEodHour(now = /* @__PURE__ */ new Date()) {
  return now.getHours() === 23;
}
function shouldBlockHotTableSupabaseWrite(url, method) {
  if (!isHotTablesEodOnly()) return false;
  const upperMethod = method.toUpperCase();
  if (READ_METHODS.has(upperMethod)) return false;
  if (!HOT_TABLE_PATHS.some((path3) => url.includes(path3))) return false;
  if (bypassCounter > 0) return false;
  if (isWithinEodHour()) return false;
  return true;
}
var bypassCounter, HOT_TABLE_PATHS, READ_METHODS;
var init_hot_table_write_gate = __esm({
  "server/hot-table-write-gate.ts"() {
    "use strict";
    init_hot_table_mode();
    bypassCounter = 0;
    HOT_TABLE_PATHS = [
      "/rest/v1/twilio_call_logs",
      "/rest/v1/agent_dial_metrics"
    ];
    READ_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
  }
});

// shared/lead-tracking-schema.ts
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  integer,
  text,
  boolean
} from "drizzle-orm/pg-core";
var agentLeadProgress, ftcComplianceLog, hotleadAssignments;
var init_lead_tracking_schema = __esm({
  "shared/lead-tracking-schema.ts"() {
    "use strict";
    agentLeadProgress = pgTable("agent_lead_progress", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      agentEmail: varchar("agent_email").notNull(),
      market: varchar("market").notNull(),
      lastLeadId: varchar("last_lead_id"),
      // ID of the last lead they worked on
      lastLeadPhone: varchar("last_lead_phone"),
      // Phone number for backup identification
      currentPosition: integer("current_position").default(0),
      // Position in the lead queue
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
    ftcComplianceLog = pgTable("ftc_compliance_log", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      leadId: varchar("lead_id").notNull(),
      leadPhone: varchar("lead_phone").notNull(),
      leadState: varchar("lead_state").notNull(),
      agentEmail: varchar("agent_email").notNull(),
      actionTaken: varchar("action_taken").notNull(),
      // 'skipped', 'allowed', 'deferred'
      leadLocalTime: varchar("lead_local_time").notNull(),
      timeZone: varchar("time_zone").notNull(),
      nextCallableTime: varchar("next_callable_time"),
      createdAt: timestamp("created_at").defaultNow(),
      reason: text("reason")
    });
    hotleadAssignments = pgTable("hotlead_assignments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      agentEmail: varchar("agent_email").notNull(),
      hotleadPhone: varchar("hotlead_phone").notNull(),
      // References hotleads table in Supabase
      hotleadId: varchar("hotlead_id"),
      // Supabase hotlead ID if available
      assignedAt: timestamp("assigned_at").defaultNow(),
      assignmentReason: varchar("assignment_reason"),
      // 'state_match', 'market_match', 'activity_level', 'manual'
      isActive: boolean("is_active").default(true),
      // Whether assignment is still active
      completedAt: timestamp("completed_at"),
      // When hotlead was marked complete/resolved
      // Track lead details at assignment time (for audit trail)
      leadState: varchar("lead_state"),
      leadMarket: varchar("lead_market"),
      leadFirstName: varchar("lead_first_name"),
      leadLastName: varchar("lead_last_name"),
      createdAt: timestamp("created_at").defaultNow(),
      updatedAt: timestamp("updated_at").defaultNow()
    }, (table) => ({
      // Unique constraint to prevent duplicate assignments
      agentHotleadIdx: {
        columns: [table.agentEmail, table.hotleadPhone],
        unique: true
      }
    }));
  }
});

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  DEFAULT_PAGE_PERMISSIONS: () => DEFAULT_PAGE_PERMISSIONS,
  PAGE_KEYS: () => PAGE_KEYS,
  ROLES: () => ROLES,
  adminLogs: () => adminLogs,
  adminRoles: () => adminRoles,
  agentAccessControl: () => agentAccessControl,
  agentAvailability: () => agentAvailability,
  agentCredits: () => agentCredits,
  agentDialMetrics: () => agentDialMetrics,
  agentLeadProgress: () => agentLeadProgress,
  agentMetrics: () => agentMetrics,
  agentProfileSchema: () => agentProfileSchema,
  agentProfiles: () => agentProfiles,
  aoiConnects: () => aoiConnects,
  aoiFollowups: () => aoiFollowups,
  appointmentOutcomes: () => appointmentOutcomes,
  appointmentQuerySchema: () => appointmentQuerySchema,
  appointmentReminders: () => appointmentReminders,
  appointmentReviews: () => appointmentReviews,
  appointments: () => appointments,
  callCenterEvents: () => callCenterEvents,
  callDispositionInconsistencies: () => callDispositionInconsistencies,
  callDispositionOutcomes: () => callDispositionOutcomes,
  callLogs: () => callLogs,
  callLogsRelations: () => callLogsRelations,
  callTracker: () => callTracker,
  callUsageTracking: () => callUsageTracking,
  clientApprovalSchema: () => clientApprovalSchema,
  clientInfoSchema: () => clientInfoSchema,
  connectnowUsers: () => connectnowUsers,
  connectnowUsersRelations: () => connectnowUsersRelations,
  creditTransactions: () => creditTransactions,
  dailyAccountability: () => dailyAccountability,
  dailyBillingReports: () => dailyBillingReports,
  dailyUserStats: () => dailyUserStats,
  featureUsageLogs: () => featureUsageLogs,
  feedbackReports: () => feedbackReports,
  ftcComplianceLog: () => ftcComplianceLog,
  helpRequests: () => helpRequests,
  hotleadAssignments: () => hotleadAssignments,
  inboundCallRouting: () => inboundCallRouting,
  incomingCalls: () => incomingCalls,
  incomingCallsRelations: () => incomingCallsRelations,
  incomingLeads: () => incomingLeads,
  insertAdminLogSchema: () => insertAdminLogSchema,
  insertAdminRoleSchema: () => insertAdminRoleSchema,
  insertAgentAccessControlSchema: () => insertAgentAccessControlSchema,
  insertAgentMetricsSchema: () => insertAgentMetricsSchema,
  insertAgentProfileSchema: () => insertAgentProfileSchema,
  insertAppointmentOutcomeSchema: () => insertAppointmentOutcomeSchema,
  insertAppointmentReviewSchema: () => insertAppointmentReviewSchema,
  insertAppointmentSchema: () => insertAppointmentSchema,
  insertCallCenterEventSchema: () => insertCallCenterEventSchema,
  insertCallDispositionInconsistencySchema: () => insertCallDispositionInconsistencySchema,
  insertCallLogSchema: () => insertCallLogSchema,
  insertCallTrackerSchema: () => insertCallTrackerSchema,
  insertCallUsageTrackingSchema: () => insertCallUsageTrackingSchema,
  insertConnectNowUserSchema: () => insertConnectNowUserSchema,
  insertDailyAccountabilitySchema: () => insertDailyAccountabilitySchema,
  insertDailyUserStatsSchema: () => insertDailyUserStatsSchema,
  insertFeatureUsageLogSchema: () => insertFeatureUsageLogSchema,
  insertFeedbackReportSchema: () => insertFeedbackReportSchema,
  insertIncomingLeadSchema: () => insertIncomingLeadSchema,
  insertLeadCampaignSchema: () => insertLeadCampaignSchema,
  insertOutboundCallSchema: () => insertOutboundCallSchema,
  insertPageActivityLogSchema: () => insertPageActivityLogSchema,
  insertQualityManagerTeamAssignmentSchema: () => insertQualityManagerTeamAssignmentSchema,
  insertRecruitCandidateSchema: () => insertRecruitCandidateSchema,
  insertRolePagePermissionSchema: () => insertRolePagePermissionSchema,
  insertRoleSchema: () => insertRoleSchema,
  insertTeamSchema: () => insertTeamSchema,
  insertUserRoleSchema: () => insertUserRoleSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserSessionSchema: () => insertUserSessionSchema,
  insertVdpCallSchema: () => insertVdpCallSchema,
  insertVerificationSessionSchema: () => insertVerificationSessionSchema,
  insertVeteranLeadSchema: () => insertVeteranLeadSchema,
  insertVideoMeetingTrackingSchema: () => insertVideoMeetingTrackingSchema,
  insertWalkthroughCompletionSchema: () => insertWalkthroughCompletionSchema,
  insertWalkthroughProgressSchema: () => insertWalkthroughProgressSchema,
  insertWalkthroughVideoSchema: () => insertWalkthroughVideoSchema,
  insertWarConnectSchema: () => insertWarConnectSchema,
  insertWarMetricsSchema: () => insertWarMetricsSchema,
  insertWarSubmissionSchema: () => insertWarSubmissionSchema,
  insertWarTeamMemberSchema: () => insertWarTeamMemberSchema,
  insertWarTeamSchema: () => insertWarTeamSchema,
  leadCampaigns: () => leadCampaigns,
  leaderboard: () => leaderboard,
  masterlead: () => masterlead,
  masterleadrecruit: () => masterleadrecruit,
  masterrecruit: () => masterrecruit,
  methodSelectionSchema: () => methodSelectionSchema,
  mgaTeams: () => mgaTeams,
  outboundCallHistory: () => outboundCallHistory,
  outboundCalls: () => outboundCalls,
  pageActivityLogs: () => pageActivityLogs,
  phantomBookingResolutions: () => phantomBookingResolutions,
  producers: () => producers,
  qualityManagerAssignments: () => qualityManagerAssignments,
  qualityManagerRoles: () => qualityManagerRoles,
  qualityManagerTeamAssignments: () => qualityManagerTeamAssignments,
  recruitCandidates: () => recruitCandidates,
  recruitUserSettings: () => recruitUserSettings,
  rolePagePermissions: () => rolePagePermissions,
  roles: () => roles,
  rolesRelations: () => rolesRelations,
  screenshotUploadSchema: () => screenshotUploadSchema,
  smsVerificationSchema: () => smsVerificationSchema,
  supportBookings: () => supportBookings,
  supportQueue: () => supportQueue,
  taalkVdpLogs: () => taalkVdpLogs,
  teams: () => teams,
  teamsRelations: () => teamsRelations,
  updateAppointmentSchema: () => updateAppointmentSchema,
  updateRecruitCandidateSchema: () => updateRecruitCandidateSchema,
  userCredits: () => userCredits,
  userExperience: () => userExperience,
  userGameStats: () => userGameStats,
  userGameStatsRelations: () => userGameStatsRelations,
  userRoles: () => userRoles,
  userSessions: () => userSessions,
  users: () => users,
  vdpCalls: () => vdpCalls,
  vdpCallsRelations: () => vdpCallsRelations,
  vdpConnects: () => vdpConnects,
  vdpMissedCalls: () => vdpMissedCalls,
  verificationSessions: () => verificationSessions,
  veteranLeads: () => veteranLeads,
  videoMeetingTracking: () => videoMeetingTracking,
  walkthroughCompletion: () => walkthroughCompletion,
  walkthroughProgress: () => walkthroughProgress,
  walkthroughVideos: () => walkthroughVideos,
  warConnects: () => warConnects,
  warMetrics: () => warMetrics,
  warSubmissions: () => warSubmissions,
  warTeamMembers: () => warTeamMembers,
  warTeams: () => warTeams
});
import { pgTable as pgTable2, text as text2, serial, integer as integer2, boolean as boolean2, timestamp as timestamp2, decimal, jsonb, varchar as varchar2, uuid, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql as sql2 } from "drizzle-orm";
import { z } from "zod";
var ROLES, PAGE_KEYS, users, callLogs, agentDialMetrics, agentProfiles, rolePagePermissions, qualityManagerTeamAssignments, callDispositionInconsistencies, taalkVdpLogs, vdpCalls, aoiFollowups, callDispositionOutcomes, vdpConnects, vdpMissedCalls, aoiConnects, producers, agentCredits, creditTransactions, dailyBillingReports, helpRequests, supportQueue, supportBookings, phantomBookingResolutions, leadCampaigns, feedbackReports, recruitCandidates, masterrecruit, recruitUserSettings, outboundCalls, callCenterEvents, agentMetrics, appointmentReminders, agentAvailability, callTracker, warConnects, warSubmissions, verificationSessions, walkthroughVideos, walkthroughProgress, walkthroughCompletion, appointments, userExperience, warMetrics, warTeams, warTeamMembers, insertUserSchema, insertAgentProfileSchema, agentProfileSchema, masterlead, masterleadrecruit, veteranLeads, insertVeteranLeadSchema, incomingLeads, insertIncomingLeadSchema, insertOutboundCallSchema, insertCallCenterEventSchema, insertAgentMetricsSchema, insertWarMetricsSchema, insertWarTeamSchema, insertWarTeamMemberSchema, insertCallTrackerSchema, insertVerificationSessionSchema, clientInfoSchema, methodSelectionSchema, screenshotUploadSchema, smsVerificationSchema, clientApprovalSchema, insertWarConnectSchema, insertAppointmentSchema, updateAppointmentSchema, appointmentQuerySchema, insertWarSubmissionSchema, appointmentReviews, insertAppointmentReviewSchema, insertWalkthroughVideoSchema, insertWalkthroughProgressSchema, insertWalkthroughCompletionSchema, dailyAccountability, appointmentOutcomes, agentAccessControl, insertDailyAccountabilitySchema, insertAgentAccessControlSchema, insertAppointmentOutcomeSchema, insertCallDispositionInconsistencySchema, insertLeadCampaignSchema, outboundCallHistory, inboundCallRouting, teams, roles, connectnowUsers, qualityManagerRoles, mgaTeams, qualityManagerAssignments, callUsageTracking, videoMeetingTracking, userCredits, incomingCalls, userGameStats, leaderboard, teamsRelations, rolesRelations, connectnowUsersRelations, callLogsRelations, vdpCallsRelations, incomingCallsRelations, userGameStatsRelations, insertTeamSchema, insertRoleSchema, insertConnectNowUserSchema, insertCallLogSchema, insertVdpCallSchema, adminRoles, userRoles, adminLogs, insertAdminRoleSchema, insertUserRoleSchema, insertAdminLogSchema, insertFeedbackReportSchema, insertRecruitCandidateSchema, updateRecruitCandidateSchema, insertCallUsageTrackingSchema, insertVideoMeetingTrackingSchema, userSessions, pageActivityLogs, featureUsageLogs, dailyUserStats, insertUserSessionSchema, insertPageActivityLogSchema, insertFeatureUsageLogSchema, insertDailyUserStatsSchema, insertRolePagePermissionSchema, insertQualityManagerTeamAssignmentSchema, DEFAULT_PAGE_PERMISSIONS;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    init_lead_tracking_schema();
    ROLES = ["system_admin", "rga", "mga", "agent", "quality_manager", "ao_quality_manager"];
    PAGE_KEYS = [
      "billing-dashboard",
      "aoi-report",
      "appointments",
      "ao-recruit",
      "ao-precheck",
      "settings",
      "ao-intelligence",
      "ao-connect",
      "subscription",
      "ao-precheck-management",
      "admin",
      "user-management",
      "teams-management"
    ];
    users = pgTable2("users", {
      id: serial("id").primaryKey(),
      username: text2("username").notNull().unique(),
      password: text2("password").notNull(),
      agentPhone: text2("agent_phone"),
      // Agent's phone number for SMS notifications
      agentName: text2("agent_name")
      // Agent's full name
    });
    callLogs = pgTable2("call_logs", {
      id: serial("id").primaryKey(),
      twilioCallSid: text2("twilio_call_sid").notNull().unique(),
      agentEmail: text2("agent_email").notNull(),
      // Who made the call
      toNumber: text2("to_number").notNull(),
      // Number called
      fromNumber: text2("from_number").notNull(),
      // Number calling from
      callStatus: text2("call_status").notNull(),
      // completed, no-answer, busy, failed
      callDuration: integer2("call_duration").default(0),
      // Duration in seconds
      callStartedAt: timestamp2("call_started_at").notNull(),
      callEndedAt: timestamp2("call_ended_at"),
      isReached: boolean2("is_reached").default(false),
      // Duration > 30 seconds
      isBooked: boolean2("is_booked").default(false),
      // Duration > 120 seconds  
      createdAt: timestamp2("created_at").defaultNow()
    });
    agentDialMetrics = pgTable2("agent_dial_metrics", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      // Who made the call
      agentName: text2("agent_name"),
      leadId: integer2("lead_id"),
      // Reference to masterlead.id (nullable since leads can be deleted/reassigned)
      leadPhone: text2("lead_phone").notNull(),
      // Store phone for historical tracking even if lead is deleted
      leadName: text2("lead_name"),
      leadState: text2("lead_state"),
      eventType: text2("event_type").notNull(),
      // 'dial', 'reach', 'booked'
      eventTimestamp: timestamp2("event_timestamp", { withTimezone: true }).notNull().defaultNow(),
      callDuration: integer2("call_duration"),
      // Duration in seconds
      callStatus: text2("call_status"),
      // 'completed', 'no_answer', 'busy', 'failed', etc.
      disposition: text2("disposition"),
      // Call disposition if available
      callSid: text2("call_sid"),
      // Twilio call SID if available
      source: text2("source"),
      // 'dialer', 'vdp', 'manual', 'hotlead', etc.
      notes: text2("notes"),
      createdAt: timestamp2("created_at", { withTimezone: true }).notNull().defaultNow()
    });
    agentProfiles = pgTable2("agent_profiles", {
      id: serial("id").primaryKey(),
      supabaseUserId: text2("supabase_user_id").notNull().unique(),
      // Links to Supabase auth.users.id
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email").notNull(),
      zoomId: text2("zoom_id"),
      zoomPassword: text2("zoom_password").default("1"),
      profilePicture: text2("profile_picture"),
      googleTokens: text2("google_tokens"),
      // Google Calendar OAuth tokens JSON
      // HOTLEAD DISTRIBUTION FIELDS
      isActive: boolean2("is_active").default(true),
      // Whether agent is active for lead distribution
      licenseStates: jsonb("license_states").default(sql2`'[]'::jsonb`),
      // Array of state codes agent is licensed in ["TX", "FL", "CA"]
      authorizedMarkets: jsonb("authorized_markets").default(sql2`'[]'::jsonb`),
      // Array of markets agent can work ["Market A", "Market B"]
      maxHotleads: integer2("max_hotleads").default(50),
      // Maximum hotleads this agent can handle
      currentHotleadCount: integer2("current_hotlead_count").default(0),
      // Current number of assigned hotleads
      lastActivityDate: timestamp2("last_activity_date"),
      // Last time agent was active (calls, logins, etc.)
      distributionPriority: integer2("distribution_priority").default(1),
      // 1=highest, 5=lowest priority for lead assignment
      // ACCESS CONTROL
      callConnectorProAccess: boolean2("call_connector_pro_access").default(false),
      // Whether user can access Call Connector Pro
      ccproPrimerDismissedAt: timestamp2("ccpro_primer_dismissed_at"),
      // When agent dismissed CCPro primer modal (persists across browsers)
      vdpMissedCallDisclaimerAcceptedAt: timestamp2("vdp_missed_call_disclaimer_accepted_at"),
      // When agent accepted VDP missed call billing disclaimer (persists across browsers/devices)
      callConnectorProDisclaimerAcceptedAt: timestamp2("call_connector_pro_disclaimer_accepted_at"),
      // When agent accepted Call Connector Pro disclaimer (persists across browsers/devices)
      // TEAM MANAGEMENT
      mgaTeam: text2("mga_team"),
      // MGA name this agent belongs to (e.g., "John Smith")
      rgaTeam: text2("rga_team"),
      // RGA name this agent belongs to (e.g., "ENO IFTIU")
      teamRole: text2("team_role").default("agent"),
      // "agent", "team_lead", "manager", "mga", "rga"
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    rolePagePermissions = pgTable2("role_page_permissions", {
      role: text2("role").notNull(),
      page: text2("page").notNull(),
      allowed: boolean2("allowed").notNull().default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    }, (table) => {
      return {
        pk: primaryKey({ columns: [table.role, table.page] })
      };
    });
    qualityManagerTeamAssignments = pgTable2("quality_manager_team_assignments", {
      id: serial("id").primaryKey(),
      qmEmail: text2("qm_email").notNull(),
      mgaTeam: text2("mga_team").notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    callDispositionInconsistencies = pgTable2("call_disposition_inconsistencies", {
      id: serial("id").primaryKey(),
      callSid: text2("call_sid").notNull(),
      agentEmail: text2("agent_email").notNull(),
      callDate: text2("call_date").notNull(),
      callDuration: integer2("call_duration"),
      toNumber: text2("to_number"),
      fromNumber: text2("from_number"),
      callDirection: text2("call_direction"),
      // 'inbound' or 'outbound-api'
      reportedOutcome: text2("reported_outcome").notNull(),
      // What agent reported (sale, set_appointment, etc.)
      issueType: text2("issue_type").notNull(),
      // booked_without_appointment, missing_appointment_data, etc.
      accountabilityDate: text2("accountability_date").notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    taalkVdpLogs = pgTable2("taalk_vdp_logs", {
      id: serial("id").primaryKey(),
      callId: text2("call_id"),
      // Taalk call ID
      agentName: text2("agent_name"),
      // Agent who made the verification call
      clientName: text2("client_name"),
      // Client name being verified
      phoneNumber: text2("phone_number"),
      // Phone number called
      callDate: text2("call_date"),
      // Date of the verification call
      callStatus: text2("call_status"),
      // Status (completed, failed, etc.)
      duration: integer2("duration"),
      // Call duration in seconds
      verificationResult: text2("verification_result"),
      // Success/failed verification
      premiumAmount: decimal("premium_amount", { precision: 10, scale: 2 }),
      // Premium amount
      policyDetails: jsonb("policy_details"),
      // Any additional policy data
      rawData: jsonb("raw_data"),
      // Store original CSV row data
      resolved: boolean2("resolved").default(false),
      resolutionNotes: text2("resolution_notes"),
      uploadedAt: timestamp2("uploaded_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    vdpCalls = pgTable2("vdp_calls", {
      id: serial("id").primaryKey(),
      Date: text2("Date"),
      // Call date
      Time: text2("Time"),
      // Call time
      Event: text2("Event"),
      // Event type (CONNECT, NEW, ASSIGN_TO, etc.)
      Phone: text2("Phone"),
      // Phone number
      Agent: text2("Agent"),
      // Agent ID
      Params: text2("Params"),
      // JSON parameters
      MGA: text2("MGA"),
      // Master General Agent from producers lookup
      RGA: text2("RGA"),
      // Regional General Agent from producers lookup
      duration: text2("duration"),
      // Call duration
      leadid: text2("leadid"),
      // Lead ID
      firstname: text2("firstname"),
      // First name
      lastname: text2("lastname"),
      // Last name
      market: text2("market"),
      // Market segment
      email: text2("email"),
      // Email address
      address: text2("address"),
      // Address
      city: text2("city"),
      // City
      state: text2("state"),
      // State
      resolutionStatus: text2("resolution_status"),
      // Resolution status (sold, appointment_set, not_interested, callback_requested, etc.)
      resolutionNotes: text2("resolution_notes"),
      // Additional notes about the resolution
      resolvedAt: timestamp2("resolved_at"),
      // When the call was resolved
      isFollowupRequired: boolean2("is_followup_required").default(false),
      // Whether this resolution requires follow-up
      followupDeadline: timestamp2("followup_deadline"),
      // When follow-up is due
      finalOutcome: text2("final_outcome"),
      // Final business outcome (sold, no_show, etc.
      finalOutcomeNotes: text2("final_outcome_notes"),
      // Notes about final outcome
      finalOutcomeAt: timestamp2("final_outcome_at"),
      // When final outcome was recorded
      createdAt: timestamp2("created_at").defaultNow()
      // When the record was created
    });
    aoiFollowups = pgTable2("aoi_followups", {
      id: serial("id").primaryKey(),
      vdpCallId: integer2("vdp_call_id").references(() => vdpCalls.id).notNull(),
      taalk_leadid: text2("taalk_leadid").notNull(),
      // Links to masterleads table using taalk_leadid
      agentEmail: text2("agent_email").notNull(),
      followupType: text2("followup_type").notNull(),
      // "appointment", "callback"
      initialResolution: text2("initial_resolution").notNull(),
      // "appointment_set", "callback_requested"
      initialResolutionAt: timestamp2("initial_resolution_at").notNull(),
      initialNotes: text2("initial_notes"),
      // Notes from initial resolution
      // Follow-up Requirements
      dueDate: timestamp2("due_date").notNull(),
      // When follow-up is due
      status: text2("status").notNull().default("pending"),
      // "pending", "completed", "overdue"
      // Final Outcome Tracking
      finalOutcome: text2("final_outcome"),
      // "sold", "attended_declined", "no_show", "cancelled", "rescheduled", "not_interested", "unable_to_reach"
      finalNotes: text2("final_notes"),
      // Notes about final outcome
      completedAt: timestamp2("completed_at"),
      // When final outcome was recorded
      completedBy: text2("completed_by"),
      // Email of who recorded final outcome
      // Appointment Specific Fields
      appointmentDate: timestamp2("appointment_date"),
      // Scheduled appointment date/time
      appointmentType: text2("appointment_type"),
      // "zoom", "phone", "in_person"
      appointmentDetails: text2("appointment_details"),
      // Zoom link, phone number, address
      // Callback Specific Fields
      callbackDate: timestamp2("callback_date"),
      // When callback should happen
      callbackPhone: text2("callback_phone"),
      // Phone number to call back
      callbackNotes: text2("callback_notes"),
      // Special callback instructions
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    callDispositionOutcomes = pgTable2("call_disposition_outcomes", {
      id: serial("id").primaryKey(),
      accountabilityId: integer2("accountability_id").notNull(),
      callSid: text2("call_sid").notNull(),
      outcome: text2("outcome").notNull(),
      // sale, refused, set_appointment, etc.
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).default("0.00"),
      notes: text2("notes"),
      agentEmail: text2("agent_email").notNull(),
      callDate: text2("call_date").notNull(),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    vdpConnects = pgTable2("vdp_connects", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // VDP agent ID (e.g., "409") 
      associateId: integer2("associate_id"),
      // Associate ID number
      phone: text2("phone").notNull(),
      // Phone number called
      durationSeconds: integer2("duration_seconds").notNull(),
      // Call duration in seconds
      clientName: text2("client_name"),
      // Client name if available
      leadId: text2("lead_id"),
      // Lead ID if available
      leadid: text2("leadid"),
      // Lead ID from VDP params
      firstname: text2("firstname"),
      // First name from VDP params
      lastname: text2("lastname"),
      // Last name from VDP params
      market: text2("market"),
      // Market segment (Veteran, etc.)
      mga: text2("mga"),
      // MGA (Master General Agent)
      rga: text2("rga"),
      // RGA (Regional General Agent)
      connectDate: text2("connect_date").notNull(),
      // Date of connect
      pickupTime: text2("pickup_time"),
      // When call was picked up (text format)
      endTime: text2("end_time"),
      // When call ended (text format)
      eventType: text2("event_type"),
      // Event type (CONNECT, END, etc.)
      params: text2("params"),
      // JSON params
      processedAt: timestamp2("processed_at").defaultNow()
    });
    vdpMissedCalls = pgTable2("vdp_missed_calls", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // VDP agent ID (e.g., "409")
      agentName: text2("agent_name"),
      // Agent full name  
      associateId: integer2("associate_id"),
      // Associate ID number
      phoneNumber: text2("phone_number").notNull(),
      // Phone number called
      duration: integer2("duration").default(0),
      // Duration attempted (0 for missed)
      clientName: text2("client_name"),
      // Client name if available
      leadId: text2("lead_id"),
      // Lead ID if available
      market: text2("market"),
      // Market segment (Veteran, etc.)
      mga: text2("mga"),
      // MGA (Master General Agent)
      rga: text2("rga"),
      // RGA (Regional General Agent)
      missedDate: text2("missed_date").notNull(),
      // Date of missed call
      missedTime: timestamp2("missed_time").notNull(),
      // When call was missed
      createdAt: timestamp2("created_at").defaultNow()
    });
    aoiConnects = pgTable2("aoi_connects", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // Agent ID (associate_id from Supabase)
      supabaseVdpId: integer2("supabase_vdp_id").notNull().unique(),
      // ID from Supabase vdp_calls table
      clientPhone: text2("client_phone").notNull(),
      // Phone number called
      clientName: text2("client_name"),
      // Client full name (firstname + lastname)
      firstName: text2("first_name"),
      // Client first name
      lastName: text2("last_name"),
      // Client last name
      leadId: text2("lead_id"),
      // Lead ID
      market: text2("market"),
      // Market segment
      callDate: text2("call_date").notNull(),
      // Date of call
      callTime: text2("call_time").notNull(),
      // Time of call
      duration: text2("duration"),
      // Call duration
      billingAmount: decimal("billing_amount", { precision: 10, scale: 2 }).default("8.00"),
      // $8.00 per AOI connect
      billed: boolean2("billed").default(false),
      // Whether this has been billed
      notified: boolean2("notified").default(false),
      // Whether agent was notified
      syncedAt: timestamp2("synced_at").defaultNow(),
      // When synced from Supabase
      createdAt: timestamp2("created_at").defaultNow()
    });
    producers = pgTable2("producers", {
      id: serial("id").primaryKey(),
      associateId: integer2("associate_id").notNull().unique(),
      // Associate ID from Excel
      agentName: text2("agent_name").notNull(),
      // Full agent name
      mga: text2("mga"),
      // Master General Agent
      rga: text2("rga"),
      // Regional General Agent  
      companyEmail: text2("company_email"),
      // Company email
      personalEmail: text2("personal_email"),
      // Personal email
      phone: text2("phone"),
      // Phone number
      aoiMarket: text2("aoi_market"),
      // AOI Market
      designatedMarket: text2("designated_market"),
      // Designated Market
      licensedStates: text2("licensed_states"),
      // Life-and-Health Licensed States
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    agentCredits = pgTable2("agent_credits", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull().unique(),
      // VDP agent ID (e.g., "409")
      associateId: integer2("associate_id"),
      // Associate ID from producer hierarchy
      agentName: text2("agent_name").notNull(),
      // Agent full name
      agentEmail: text2("agent_email"),
      // Agent email for notifications
      currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
      // Current credit balance
      totalPurchased: decimal("total_purchased", { precision: 10, scale: 2 }).default("0.00"),
      // Total credits purchased
      totalUsed: decimal("total_used", { precision: 10, scale: 2 }).default("0.00"),
      // Total credits used
      aoiConnectRate: decimal("aoi_connect_rate", { precision: 10, scale: 2 }).default("8.00"),
      // Cost per AOI connect
      aoiMissedRate: decimal("aoi_missed_rate", { precision: 10, scale: 2 }).default("4.00"),
      // Cost per AOI missed call
      aoiRecruitRate: decimal("aoi_recruit_rate", { precision: 10, scale: 2 }).default("5.00"),
      // Cost per AOI recruit
      aoiPrecheckRate: decimal("aoi_precheck_rate", { precision: 10, scale: 2 }).default("3.00"),
      // Cost per AOI precheck
      aoiPlusRate: decimal("aoi_plus_rate", { precision: 10, scale: 2 }).default("6.00"),
      // Cost per AOI plus lead
      mga: text2("mga"),
      // MGA for team reporting
      rga: text2("rga"),
      // RGA for team reporting
      isActive: boolean2("is_active").default(true),
      // Whether agent can use credits
      lowBalanceThreshold: decimal("low_balance_threshold", { precision: 10, scale: 2 }).default("10.00"),
      // When to send low balance alerts
      autoReloadEnabled: boolean2("auto_reload_enabled").default(false),
      // Auto-reload credits when low
      autoReloadAmount: decimal("auto_reload_amount", { precision: 10, scale: 2 }).default("50.00"),
      // Amount to auto-reload
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    creditTransactions = pgTable2("credit_transactions", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      // VDP agent ID
      transactionType: text2("transaction_type").notNull(),
      // "purchase", "usage", "refund", "adjustment"
      serviceType: text2("service_type"),
      // "aoi_connect", "aoi_missed", "aoi_recruit", "aoi_precheck"
      amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
      // Transaction amount (positive for credits, negative for usage)
      balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
      // Balance before transaction
      balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
      // Balance after transaction
      description: text2("description").notNull(),
      // Transaction description
      vdpConnectId: integer2("vdp_connect_id"),
      // Link to vdp_connects table if usage transaction
      phoneNumber: text2("phone_number"),
      // Phone number for connect transactions
      clientName: text2("client_name"),
      // Client name for connect transactions
      connectDuration: integer2("connect_duration"),
      // Connect duration in seconds
      market: text2("market"),
      // Market segment
      paymentMethod: text2("payment_method"),
      // "stripe", "admin", "auto_reload"
      paymentId: text2("payment_id"),
      // External payment system ID
      createdAt: timestamp2("created_at").defaultNow()
    });
    dailyBillingReports = pgTable2("daily_billing_reports", {
      id: serial("id").primaryKey(),
      agentId: text2("agent_id").notNull(),
      reportDate: text2("report_date").notNull(),
      // YYYY-MM-DD format
      connectCount: integer2("connect_count").default(0),
      // Total connects for the day
      missedCallCount: integer2("missed_call_count").default(0),
      // Total missed calls for the day
      totalCharges: decimal("total_charges", { precision: 10, scale: 2 }).default("0.00"),
      // Total charges for the day
      averageConnectDuration: integer2("average_connect_duration").default(0),
      // Average connect duration in seconds
      topClientMarket: text2("top_client_market"),
      // Most active market for the day
      balanceStart: decimal("balance_start", { precision: 10, scale: 2 }).notNull(),
      // Balance at start of day
      balanceEnd: decimal("balance_end", { precision: 10, scale: 2 }).notNull(),
      // Balance at end of day
      emailSent: boolean2("email_sent").default(false),
      // Whether daily recap email was sent
      emailSentAt: timestamp2("email_sent_at"),
      // When recap email was sent
      createdAt: timestamp2("created_at").defaultNow()
    });
    helpRequests = pgTable2("help_requests", {
      id: serial("id").primaryKey(),
      name: text2("name").notNull(),
      email: text2("email").notNull(),
      subject: text2("subject").notNull(),
      message: text2("message").notNull(),
      page: text2("page"),
      // Which page the help was requested from
      status: text2("status").default("new"),
      // new, in_progress, resolved
      resolvedBy: text2("resolved_by"),
      // Admin who resolved it
      resolutionNotes: text2("resolution_notes"),
      createdAt: timestamp2("created_at").defaultNow(),
      resolvedAt: timestamp2("resolved_at")
    });
    supportQueue = pgTable2("support_queue", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      name: text2("name").notNull(),
      issueCategory: text2("issue_category").notNull(),
      joinedAt: timestamp2("joined_at", { withTimezone: true }).notNull().defaultNow(),
      position: integer2("position").notNull().default(1),
      status: text2("status").notNull().default("waiting"),
      // waiting, in_session, completed, abandoned
      zoomLink: text2("zoom_link"),
      bookingId: integer2("booking_id"),
      createdAt: timestamp2("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp2("updated_at", { withTimezone: true }).notNull().defaultNow()
    });
    supportBookings = pgTable2("support_bookings", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      name: text2("name").notNull(),
      slotStart: timestamp2("slot_start", { withTimezone: true }).notNull(),
      slotEnd: timestamp2("slot_end", { withTimezone: true }).notNull(),
      issueCategory: text2("issue_category").notNull().default("general"),
      createdAt: timestamp2("created_at", { withTimezone: true }).notNull().defaultNow()
    });
    phantomBookingResolutions = pgTable2("phantom_booking_resolutions", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      market: text2("market").notNull(),
      resolutionType: text2("resolution_type").notNull(),
      // data_error, forgot_appointment, incorrect_marking
      explanation: text2("explanation").notNull(),
      resolvedAt: timestamp2("resolved_at").defaultNow(),
      originalBookingDate: text2("original_booking_date").notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    leadCampaigns = pgTable2("lead_campaigns", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      campaignName: text2("campaign_name").notNull(),
      campaignType: text2("campaign_type").notNull(),
      // 'smart' or 'custom'
      leadCount: integer2("lead_count").default(0),
      filters: jsonb("filters"),
      // Smart campaign filters
      leadPhones: jsonb("lead_phones"),
      // Custom campaign phone numbers array
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    feedbackReports = pgTable2("feedback_reports", {
      id: serial("id").primaryKey(),
      reportType: text2("report_type").notNull(),
      // "bug", "feature_request", "feedback"
      title: text2("title").notNull(),
      description: text2("description").notNull(),
      severity: text2("severity").notNull().default("medium"),
      // "low", "medium", "high", "critical"
      status: text2("status").notNull().default("open"),
      // "open", "in_progress", "resolved", "closed"
      reporterEmail: text2("reporter_email").notNull(),
      reporterName: text2("reporter_name"),
      browserInfo: text2("browser_info"),
      // User agent string
      pageUrl: text2("page_url"),
      // URL where issue occurred
      stepsToReproduce: text2("steps_to_reproduce"),
      expectedBehavior: text2("expected_behavior"),
      actualBehavior: text2("actual_behavior"),
      attachments: jsonb("attachments"),
      // Array of attachment URLs/paths
      adminNotes: text2("admin_notes"),
      // Private admin notes
      assignedTo: text2("assigned_to"),
      // Admin email assigned to handle this
      priority: integer2("priority").default(3),
      // 1=highest, 5=lowest
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      resolvedAt: timestamp2("resolved_at")
    });
    recruitCandidates = pgTable2("recruit_candidates", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email").notNull(),
      city: text2("city"),
      state: text2("state"),
      zipCode: text2("zip_code"),
      // Recruitment specific fields
      status: text2("status").notNull().default("new"),
      // new, contacted, interview, pending, hired, rejected
      position: text2("position"),
      // Position they're applying for
      experience: text2("experience"),
      // Years of experience
      rating: decimal("rating", { precision: 3, scale: 1 }),
      // 1-5 rating
      notes: text2("notes"),
      // Notes about the candidate
      aiSummary: text2("ai_summary"),
      // AI-generated summary from screening call
      // Agent who added this candidate
      agentId: text2("agent_id").notNull(),
      agentEmail: text2("agent_email").notNull(),
      // Appointment scheduling
      appointmentDate: timestamp2("appointment_date"),
      appointmentNotes: text2("appointment_notes"),
      // Stage tracking
      currentStageId: integer2("current_stage_id"),
      stageEnteredAt: timestamp2("stage_entered_at"),
      // ExamFX Licensing Tracker
      examfxVoucherCode: text2("examfx_voucher_code"),
      // voucher code issued to candidate
      examfxEnrolledAt: timestamp2("examfx_enrolled_at"),
      // when they were enrolled
      examfxState: text2("examfx_state"),
      // which state's course (e.g. "TX", "CA")
      examfxCourseType: text2("examfx_course_type"),
      // "Life & Health", "Property & Casualty", etc.
      examfxStatus: text2("examfx_status"),
      // "not_enrolled" | "enrolled" | "studying" | "exam_scheduled" | "passed" | "failed"
      examfxProgressPercent: integer2("examfx_progress_percent"),
      // 0-100 course completion
      examfxPracticeScores: text2("examfx_practice_scores"),
      // JSON array of practice exam scores e.g. "[72, 81, 88]"
      examfxExamDate: timestamp2("examfx_exam_date"),
      // scheduled real exam date
      examfxExamResult: text2("examfx_exam_result"),
      // "passed" | "failed" | null
      examfxExamResultAt: timestamp2("examfx_exam_result_at"),
      // when they took the real exam
      examfxNotes: text2("examfx_notes"),
      // recruiter notes on licensing progress
      examfxLastSyncAt: timestamp2("examfx_last_sync_at"),
      // last time data was synced from ExamFX
      // Call tracking (similar to masterlead.last_contacted)
      lastContacted: timestamp2("last_contacted"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    masterrecruit = pgTable2("masterrecruit", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email").notNull(),
      city: text2("city"),
      state: text2("state"),
      zipCode: text2("zip_code"),
      status: text2("status").notNull().default("new"),
      position: text2("position"),
      experience: text2("experience"),
      rating: decimal("rating", { precision: 3, scale: 1 }),
      notes: text2("notes"),
      aiSummary: text2("ai_summary"),
      agentId: text2("agent_id"),
      // Null until converted to recruit_candidates
      agentEmail: text2("agent_email"),
      // Null until converted
      isHotCandidate: boolean2("is_hot_candidate").default(false),
      // Hot candidate queue
      priorityScore: integer2("priority_score").default(0),
      // Queue order (higher = first)
      appointmentDate: timestamp2("appointment_date"),
      appointmentNotes: text2("appointment_notes"),
      currentStageId: integer2("current_stage_id"),
      stageEnteredAt: timestamp2("stage_entered_at"),
      lastContacted: timestamp2("last_contacted"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    recruitUserSettings = pgTable2("recruit_user_settings", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull().unique(),
      // Pipeline order customization - JSON array of stage IDs in custom order
      pipelineOrder: jsonb("pipeline_order"),
      // e.g., [1, 2, 3, 4, 5, 6, 7, 8]
      // Custom stage names - JSON object mapping stage ID to custom name
      customStageNames: jsonb("custom_stage_names"),
      // e.g., { "3": "My Virtual Overview", "5": "Group Meeting" }
      // Stage URLs - JSON object mapping stage ID to custom SMS URL (Virtual Overview is hardcoded, not editable)
      stageUrls: jsonb("stage_urls"),
      // e.g., { "5": "https://example.com/group-final", "6": "https://example.com/final-interview" }
      // Legacy URL fields (kept for backward compatibility, but stageUrls is preferred)
      virtualOverviewUrl: text2("virtual_overview_url"),
      // Deprecated: Virtual Overview URL is now hardcoded
      groupFinalUrl: text2("group_final_url"),
      // Deprecated: Use stageUrls instead
      finalInterviewUrl: text2("final_interview_url"),
      // Deprecated: Use stageUrls instead
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    outboundCalls = pgTable2("outbound_calls", {
      id: serial("id").primaryKey(),
      // Twilio Call Information
      twilioCallSid: text2("twilio_call_sid").notNull().unique(),
      twilioConferenceSid: text2("twilio_conference_sid"),
      twilioParentCallSid: text2("twilio_parent_call_sid"),
      // For connecting related calls
      // Agent Information
      agentEmail: text2("agent_email").notNull(),
      agentPhone: text2("agent_phone"),
      agentName: text2("agent_name"),
      // Lead Information
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      leadId: text2("lead_id"),
      leadMarket: text2("lead_market"),
      leadState: text2("lead_state"),
      leadCity: text2("lead_city"),
      // Call Status and Timing
      callStatus: text2("call_status").notNull().default("initiated"),
      // initiated, ringing, in-progress, completed, failed, no-answer, busy
      callDirection: text2("call_direction").notNull().default("outbound"),
      startTime: timestamp2("start_time").defaultNow(),
      answerTime: timestamp2("answer_time"),
      endTime: timestamp2("end_time"),
      duration: integer2("duration").default(0),
      // Duration in seconds
      // Call Quality and Technical Details
      callQuality: decimal("call_quality", { precision: 3, scale: 2 }),
      // 0.00 to 5.00 rating
      localPresenceNumber: text2("local_presence_number"),
      // Which local number was used
      recordingUrl: text2("recording_url"),
      // Disposition and Results
      callDisposition: text2("call_disposition"),
      // no-answer, voicemail, callback, appointment, not-interested, do-not-call
      appointmentScheduled: boolean2("appointment_scheduled").default(false),
      appointmentDate: timestamp2("appointment_date"),
      notes: text2("notes"),
      // System Information
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    callCenterEvents = pgTable2("call_center_events", {
      id: serial("id").primaryKey(),
      eventType: text2("event_type").notNull(),
      // call_started, call_answered, call_ended, disposition_set, etc.
      callId: integer2("call_id").references(() => outboundCalls.id),
      twilioCallSid: text2("twilio_call_sid").notNull(),
      agentEmail: text2("agent_email").notNull(),
      eventData: jsonb("event_data"),
      // Store additional event-specific data
      timestamp: timestamp2("timestamp").defaultNow()
    });
    agentMetrics = pgTable2("agent_metrics", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      date: timestamp2("date").notNull(),
      // Call Volume
      totalCalls: integer2("total_calls").default(0),
      totalConnects: integer2("total_connects").default(0),
      totalAppointments: integer2("total_appointments").default(0),
      // Performance Percentages
      connectRate: decimal("connect_rate", { precision: 5, scale: 2 }).default("0.00"),
      // Percentage
      appointmentRate: decimal("appointment_rate", { precision: 5, scale: 2 }).default("0.00"),
      // Time Metrics
      totalTalkTime: integer2("total_talk_time").default(0),
      // Total talk time in seconds
      avgCallDuration: decimal("avg_call_duration", { precision: 8, scale: 2 }).default("0.00"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    appointmentReminders = pgTable2("appointment_reminders", {
      id: serial("id").primaryKey(),
      appointmentId: integer2("appointment_id").references(() => appointments.id).notNull(),
      // Reminder Configuration
      reminderType: text2("reminder_type").notNull(),
      // sms, email, call
      reminderTime: integer2("reminder_time").notNull(),
      // Minutes before appointment
      // Delivery Status
      status: text2("status").notNull().default("pending"),
      // pending, sent, delivered, failed
      sentAt: timestamp2("sent_at"),
      deliveredAt: timestamp2("delivered_at"),
      errorMessage: text2("error_message"),
      // Message Content
      messageContent: text2("message_content"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    agentAvailability = pgTable2("agent_availability", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      // Day of week (0 = Sunday, 6 = Saturday)
      dayOfWeek: integer2("day_of_week").notNull(),
      // Time slots (in minutes from midnight)
      startTime: integer2("start_time").notNull(),
      // e.g., 540 = 9:00 AM
      endTime: integer2("end_time").notNull(),
      // e.g., 1020 = 5:00 PM
      // Availability status
      isAvailable: boolean2("is_available").default(true),
      timezone: text2("timezone").notNull().default("America/New_York"),
      // Booking settings
      bufferTime: integer2("buffer_time").default(15),
      // Minutes between appointments
      maxAdvanceDays: integer2("max_advance_days").default(30),
      // How far in advance bookings are allowed
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    callTracker = pgTable2("call_tracker", {
      id: serial("id").primaryKey(),
      // CORE IDENTIFIERS - Never null, always trackable
      sessionId: text2("session_id").notNull().unique(),
      // Our internal session ID
      agentEmail: text2("agent_email").notNull(),
      // Who made the call
      leadPhone: text2("lead_phone").notNull(),
      // Who was called
      leadName: text2("lead_name").notNull(),
      // Lead name for reference
      // CALL PROGRESS - Simple 4-state system
      callProgress: text2("call_progress").notNull().default("not_initiated"),
      // Values: not_initiated -> initiated -> connected -> in_progress -> complete
      // EXTERNAL SYSTEM IDS - Can be null if systems fail
      taalkCallId: text2("taalk_call_id"),
      // Taalk API call ID
      twilioCallSid: text2("twilio_call_sid"),
      // Twilio call SID
      zoomRoomId: text2("zoom_room_id"),
      // Zoom room for verification
      // TIMESTAMPS - Exact progression tracking
      initiatedAt: timestamp2("initiated_at"),
      // When call was started
      connectedAt: timestamp2("connected_at"),
      // When call was answered
      inProgressAt: timestamp2("in_progress_at"),
      // When call became active
      completedAt: timestamp2("completed_at"),
      // When call ended
      // RESULTS - What happened
      callOutcome: text2("call_outcome"),
      // answered, no_answer, busy, failed, voicemail
      verificationResult: text2("verification_result"),
      // passed, failed, incomplete
      appointmentBooked: boolean2("appointment_booked").default(false),
      // ERROR HANDLING - Fail-safe tracking
      lastError: text2("last_error"),
      // Any error messages
      retryCount: integer2("retry_count").default(0),
      // How many retries
      systemFlags: jsonb("system_flags"),
      // Any additional metadata
      // AUDIT TRAIL - Never changes
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warConnects = pgTable2("war_connects", {
      id: serial("id").primaryKey(),
      connectId: text2("connect_id").notNull().unique(),
      // Unique identifier for the connect
      agentEmail: text2("agent_email").notNull(),
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      connectDate: timestamp2("connect_date").notNull(),
      connectTime: text2("connect_time").notNull(),
      duration: integer2("duration").notNull(),
      // Duration in seconds
      leadSource: text2("lead_source"),
      // Where the lead came from
      market: text2("market").notNull(),
      state: text2("state").notNull(),
      // Connect Type Classification (AOI appointments, press sales, etc.)
      connectType: text2("connect_type").notNull(),
      // 'aoi_appointment', 'press_sale', 'instant_presentation', 'callback_scheduled', 'other'
      // Daily Production Status (captured immediately with connect)
      productionStatus: text2("production_status").default("pending"),
      // 'pending', 'confirmed', 'cancelled', 'no_show', 'completed'
      immediateOutcome: text2("immediate_outcome"),
      // What was agreed to right away (appointment set, sale closed, callback scheduled)
      // Final Disposition tracking (for Wednesday reporting)
      disposition: text2("disposition"),
      // appointment, sale, cant_afford, medically_uninsurable, not_interested, pending
      appointmentSet: boolean2("appointment_set").default(false),
      appointmentDate: timestamp2("appointment_date"),
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
      // Enhanced tracking fields
      followUpRequired: boolean2("follow_up_required").default(false),
      nextContactDate: timestamp2("next_contact_date"),
      priorityLevel: text2("priority_level").default("normal"),
      // 'urgent', 'high', 'normal', 'low'
      tags: jsonb("tags").default(sql2`'[]'::jsonb`),
      // Flexible tagging for categorization
      notes: text2("notes"),
      reportedAt: timestamp2("reported_at"),
      // Connect Review System (for gamified card deck)
      reviewStatus: text2("review_status"),
      // 'pending', 'interested', 'not_interested', 'sale'
      reviewedAt: timestamp2("reviewed_at"),
      nextReviewDate: timestamp2("next_review_date"),
      // For interested connects to appear tomorrow
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warSubmissions = pgTable2("war_submissions", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      weekStart: timestamp2("week_start").notNull(),
      weekEnd: timestamp2("week_end").notNull(),
      totalConnects: integer2("total_connects").notNull(),
      reportedConnects: integer2("reported_connects").notNull(),
      submittedAt: timestamp2("submitted_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    verificationSessions = pgTable2("verification_sessions", {
      id: serial("id").primaryKey(),
      sessionId: text2("session_id").notNull().unique(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      spouseName: text2("spouse_name"),
      phone: text2("phone").notNull(),
      agentPhone: text2("agent_phone"),
      // Agent's phone number for Taalk integration
      agentFirstName: text2("agent_first_name"),
      // Agent's first name for Taalk script
      agentLastName: text2("agent_last_name"),
      // Agent's last name for Taalk script
      associateId: integer2("associate_id"),
      // Associate ID to lookup MGA/RGA from producers table
      agentMgaTeam: text2("agent_mga_team"),
      // Agent's MGA team for RBAC (auto-populated from producers lookup)
      agentRgaTeam: text2("agent_rga_team"),
      // Agent's RGA team for RBAC (auto-populated from producers lookup)
      city: text2("city").notNull(),
      state: text2("state").notNull(),
      premium: text2("premium").notNull(),
      achDrawDate: text2("ach_draw_date"),
      // Full date for ACH draw (e.g., "September 8th")
      achDrawDateShort: text2("ach_draw_date_short"),
      // Short format (e.g., "8th")
      sessionType: text2("session_type").notNull().default("live"),
      // "demo" or "live" - demo sessions are hidden from admin view
      verificationMethod: text2("verification_method"),
      zoomRoomId: text2("zoom_room_id"),
      zoomPassword: text2("zoom_password"),
      language: text2("language").default("en"),
      screenshotPath: text2("screenshot_path"),
      status: text2("status").notNull().default("pending"),
      // SMS verification fields
      smsVerificationSent: boolean2("sms_verification_sent").default(false),
      smsVerificationCode: text2("sms_verification_code"),
      clientApprovalStatus: text2("client_approval_status").default("pending"),
      // pending, approved, denied
      clientApprovalTime: timestamp2("client_approval_time"),
      // Client SMS tracking
      clientSmsSid: text2("client_sms_sid"),
      clientSmsStatus: text2("client_sms_status"),
      clientSmsSentAt: text2("client_sms_sent_at"),
      clientSmsError: text2("client_sms_error"),
      // Agent SMS tracking
      agentSmsSid: text2("agent_sms_sid"),
      agentSmsStatus: text2("agent_sms_status"),
      agentSmsSentAt: text2("agent_sms_sent_at"),
      agentSmsError: text2("agent_sms_error"),
      // Location and IP tracking
      clientIpAddress: text2("client_ip_address"),
      clientCountry: text2("client_country"),
      clientRegion: text2("client_region"),
      clientCity: text2("client_city"),
      clientLatitude: text2("client_latitude"),
      clientLongitude: text2("client_longitude"),
      clientTimezone: text2("client_timezone"),
      clientIsp: text2("client_isp"),
      clientUserAgent: text2("client_user_agent"),
      // Client VPN detection
      clientIsVpn: boolean2("client_is_vpn").default(false),
      clientIsProxy: boolean2("client_is_proxy").default(false),
      clientIsHosting: boolean2("client_is_hosting").default(false),
      clientVpnDetectionReason: text2("client_vpn_detection_reason"),
      // Agent IP tracking 
      agentIpAddress: text2("agent_ip_address"),
      agentCountry: text2("agent_country"),
      agentRegion: text2("agent_region"),
      agentCity: text2("agent_city"),
      agentLatitude: text2("agent_latitude"),
      agentLongitude: text2("agent_longitude"),
      agentTimezone: text2("agent_timezone"),
      agentIsp: text2("agent_isp"),
      agentUserAgent: text2("agent_user_agent"),
      // Agent VPN detection
      agentIsVpn: boolean2("agent_is_vpn").default(false),
      agentIsProxy: boolean2("agent_is_proxy").default(false),
      agentIsHosting: boolean2("agent_is_hosting").default(false),
      agentVpnDetectionReason: text2("agent_vpn_detection_reason"),
      callCompleted: boolean2("call_completed").default(false),
      verificationResult: text2("verification_result"),
      // JSON string for call results
      // Taalk call tracking
      taalkCallId: text2("taalk_call_id"),
      taalkCallStatus: text2("taalk_call_status"),
      // initiated, ringing, answered, completed, failed
      taalkCallInitiatedAt: text2("taalk_call_initiated_at"),
      taalkCallCompletedAt: text2("taalk_call_completed_at"),
      taalkCallDuration: integer2("taalk_call_duration"),
      // Duration in seconds
      taalkCallData: text2("taalk_call_data"),
      // JSON string with Taalk response data
      taalkCallUrl: text2("taalk_call_url"),
      // Object storage URL for downloaded recording
      // IP Analysis fields
      ipAnalysis: jsonb("ip_analysis"),
      // JSONB storing full IP analysis result
      ipFlagStatus: text2("ip_flag_status"),
      // Quick status: valid, flagged, suspicious, critical, pending
      ipFlagReason: text2("ip_flag_reason"),
      // Human-readable explanation of flag status
      ipAnalysisSummary: text2("ip_analysis_summary"),
      // Summary text displayed in hover card
      // Real-time call tracking fields
      callStatus: text2("call_status"),
      // General call status (initiated, ringing, ongoing, completed, failed, etc.)
      initiatedAt: timestamp2("initiated_at"),
      // When call was started
      callCompletedAt: timestamp2("call_completed_at"),
      // When call ended
      duration: integer2("duration"),
      // Call duration in seconds
      answered: boolean2("answered").default(false),
      // Whether call was answered
      lastPolledAt: timestamp2("last_polled_at"),
      // For tracking polling intervals
      // Transmit precheck - only transmitted sessions show in AO Precheck Management
      transmitStatus: text2("transmit_status").default("pending_transmit"),
      // pending_transmit | transmitted | scheduled_delete
      precheckType: text2("precheck_type").default("live"),
      // live | training | incomplete
      transmittedAt: timestamp2("transmitted_at"),
      // When agent clicked Transmit
      scheduledDeleteAt: timestamp2("scheduled_delete_at"),
      // Training/Incomplete: delete in 24h; Recover clears this
      createdAt: timestamp2("created_at").defaultNow(),
      completedAt: timestamp2("completed_at")
    });
    walkthroughVideos = pgTable2("walkthrough_videos", {
      id: serial("id").primaryKey(),
      title: text2("title").notNull(),
      description: text2("description"),
      videoUrl: text2("video_url").notNull(),
      // URL to video file or streaming link
      thumbnailUrl: text2("thumbnail_url"),
      // Video thumbnail image
      category: text2("category").notNull(),
      // "call_connector_pro", "ao_precheck", "general"
      orderIndex: integer2("order_index").notNull().default(0),
      // Display order within category
      duration: integer2("duration"),
      // Video duration in seconds
      isRequired: boolean2("is_required").default(true),
      // Must be watched to complete walkthrough
      isActive: boolean2("is_active").default(true),
      // Can be disabled by admins
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    walkthroughProgress = pgTable2("walkthrough_progress", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      // User who is taking the walkthrough
      videoId: integer2("video_id").references(() => walkthroughVideos.id).notNull(),
      // Progress tracking
      hasStarted: boolean2("has_started").default(false),
      hasCompleted: boolean2("has_completed").default(false),
      watchTimeSeconds: integer2("watch_time_seconds").default(0),
      // How much they've watched
      lastWatchedAt: timestamp2("last_watched_at"),
      completedAt: timestamp2("completed_at"),
      // Engagement metrics
      pauseCount: integer2("pause_count").default(0),
      replayCount: integer2("replay_count").default(0),
      skipAttempts: integer2("skip_attempts").default(0),
      // Track if they try to skip
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    walkthroughCompletion = pgTable2("walkthrough_completion", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull().unique(),
      // One record per user
      // Completion status by category
      callConnectorProCompleted: boolean2("call_connector_pro_completed").default(false),
      aoPreCheckCompleted: boolean2("ao_precheck_completed").default(false),
      generalWalkthroughCompleted: boolean2("general_walkthrough_completed").default(false),
      // Overall completion
      isFullyCompleted: boolean2("is_fully_completed").default(false),
      completedAt: timestamp2("completed_at"),
      // System access tracking
      systemAccessGranted: boolean2("system_access_granted").default(false),
      firstAccessAt: timestamp2("first_access_at"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    appointments = pgTable2("appointments", {
      id: serial("id").primaryKey(),
      // Appointment Basic Info
      title: text2("title").notNull(),
      description: text2("description"),
      appointmentType: text2("appointment_type").notNull().default("consultation"),
      // consultation, follow-up, presentation, closing
      // Scheduling Details
      startTime: timestamp2("start_time").notNull(),
      endTime: timestamp2("end_time").notNull(),
      duration: integer2("duration").notNull().default(60),
      // Duration in minutes
      timezone: text2("timezone").notNull().default("America/New_York"),
      // Participant Information
      agentId: text2("agent_id").notNull(),
      agentEmail: text2("agent_email").notNull(),
      agentName: text2("agent_name").notNull(),
      // Lead/Client Information
      leadId: text2("lead_id"),
      leadName: text2("lead_name").notNull(),
      leadPhone: text2("lead_phone").notNull(),
      leadEmail: text2("lead_email"),
      leadCity: text2("lead_city"),
      leadState: text2("lead_state"),
      // Video Conference Settings
      meetingPlatform: text2("meeting_platform").notNull().default("zoom"),
      // zoom, whereby, twilio, teams
      meetingLink: text2("meeting_link"),
      // Generic meeting link for any platform
      meetingData: jsonb("meeting_data"),
      // JSON object containing platform-specific meeting details
      // Zoom Meeting Settings
      zoomMeetingId: text2("zoom_meeting_id"),
      zoomPassword: text2("zoom_password"),
      zoomJoinUrl: text2("zoom_join_url"),
      // Whereby Meeting Settings
      wherebyRoomUrl: text2("whereby_room_url"),
      wherebyHostRoomUrl: text2("whereby_host_room_url"),
      wherebyMeetingId: text2("whereby_meeting_id"),
      // Twilio Video Settings
      twilioRoomName: text2("twilio_room_name"),
      // Appointment Status and Management
      status: text2("status").notNull().default("scheduled"),
      // scheduled, confirmed, rescheduled, cancelled, completed, no-show
      confirmationStatus: text2("confirmation_status").default("pending"),
      // pending, confirmed, declined
      remindersSent: integer2("reminders_sent").default(0),
      // Communication
      notes: text2("notes"),
      internalNotes: text2("internal_notes"),
      // Agent-only notes
      // Google Calendar Integration
      googleCalendarEventId: text2("google_calendar_event_id"),
      // Google Calendar event ID for sync
      googleCalendarSyncStatus: text2("google_calendar_sync_status").default("pending"),
      // pending, synced, failed
      googleCalendarSyncedAt: timestamp2("google_calendar_synced_at"),
      googleCalendarHtmlLink: text2("google_calendar_html_link"),
      // Direct link to Google Calendar event
      googleCalendarSyncError: text2("google_calendar_sync_error"),
      // Error message if sync fails
      // Timestamps
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      cancelledAt: timestamp2("cancelled_at"),
      completedAt: timestamp2("completed_at")
    });
    userExperience = pgTable2("user_experience", {
      id: serial("id").primaryKey(),
      email: text2("email").notNull().unique(),
      totalExperience: integer2("total_experience").notNull().default(0),
      level: integer2("level").notNull().default(1),
      experienceToNextLevel: integer2("experience_to_next_level").notNull().default(100),
      connectsReviewed: integer2("connects_reviewed").notNull().default(0),
      salesMade: integer2("sales_made").notNull().default(0),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warMetrics = pgTable2("war_metrics", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      agentName: text2("agent_name").notNull(),
      teamName: text2("team_name").notNull().default("Default Team"),
      reportDate: timestamp2("report_date").notNull(),
      // The specific day this metrics entry is for
      marketType: text2("market_type").notNull(),
      // "plus", "veteran", "globe", "willkit"
      // Daily metrics: D-R-B-A-P-S-ALP
      dials: integer2("dials").notNull().default(0),
      // D - Calls made
      reached: integer2("reached").notNull().default(0),
      // R - Connected calls
      booked: integer2("booked").notNull().default(0),
      // B - Appointments booked
      appointments: integer2("appointments").notNull().default(0),
      // A - Appointments kept
      presentations: integer2("presentations").notNull().default(0),
      // P - Presentations given
      sales: integer2("sales").notNull().default(0),
      // S - Sales closed
      alp: decimal("alp", { precision: 10, scale: 2 }).notNull().default("0.00"),
      // ALP - Annualized Life Premium
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    warTeams = pgTable2("war_teams", {
      id: serial("id").primaryKey(),
      teamName: text2("team_name").notNull().unique(),
      teamLeader: text2("team_leader").notNull(),
      description: text2("description"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    warTeamMembers = pgTable2("war_team_members", {
      id: serial("id").primaryKey(),
      teamName: text2("team_name").notNull(),
      agentEmail: text2("agent_email").notNull(),
      agentName: text2("agent_name").notNull(),
      role: text2("role").notNull().default("agent"),
      // "agent", "team_leader", "supervisor"
      joinedAt: timestamp2("joined_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
      username: true,
      password: true,
      agentName: true
    });
    insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    agentProfileSchema = insertAgentProfileSchema;
    masterlead = pgTable2("masterlead", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name"),
      lastName: text2("last_name"),
      phone: text2("phone"),
      email: text2("email"),
      address: text2("address"),
      city: text2("city"),
      state: text2("state"),
      zip: text2("zip"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      lastContacted: timestamp2("last_contacted"),
      dnc: boolean2("dnc").default(false),
      status: text2("status").default("pending"),
      dispositionNotes: text2("disposition_notes"),
      isLiveCall: boolean2("is_live_call").default(false),
      liveCallPriority: integer2("live_call_priority").default(1),
      assignedAgentEmail: text2("assigned_agent_email"),
      taalkSponsorOrg: text2("taalk_sponsor_org"),
      taalkMarket: text2("taalk_market"),
      taalkLeadSource: text2("taalk_lead_source"),
      taalkState: text2("taalk_state"),
      taalkReffered: text2("taalk_reffered"),
      taalkRelationship: text2("taalk_relationship"),
      taalkSecretkey: text2("taalk_secretkey"),
      taalkGroupCode: text2("taalk_group_code"),
      taalkLeadId: text2("taalk_lead_id"),
      taalkEmail: text2("taalk_email"),
      taalkCity: text2("taalk_city"),
      taalkGroupname: text2("taalk_groupname"),
      taalkBeneficiary: text2("taalk_beneficiary"),
      taalkAddress: text2("taalk_address"),
      cnEmail: text2("cn_email"),
      cnresolution: text2("cnresolution").default("pending"),
      appointmentDate: timestamp2("appointment_date"),
      // APPTTIME - appointment date/time
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
      // ALP - sale amount
      isHotLead: boolean2("is_hot_lead").default(false),
      priorityScore: integer2("priority_score").default(1),
      associateId: integer2("associate_id"),
      // Associate ID for lead assignment
      aoLeadBox: text2("ao_lead_box"),
      // Lead pool category for My Leads queue
      aoLeadBoxOwners: text2("ao_lead_box_owners"),
      // Owner email(s) for AO lead boxes (like cn_email but for lead boxes)
      dateOfBirth: text2("date_of_birth")
      // Date of birth (text field for display/capture)
    });
    masterleadrecruit = pgTable2("masterleadrecruit", {
      id: serial("id").primaryKey(),
      // Link to source candidate record
      candidateId: integer2("candidate_id").references(() => recruitCandidates.id, { onDelete: "cascade" }),
      // Basic candidate info (denormalized for performance)
      firstName: text2("first_name"),
      lastName: text2("last_name"),
      phone: text2("phone").notNull(),
      email: text2("email"),
      city: text2("city"),
      state: text2("state"),
      zip: text2("zip"),
      address: text2("address"),
      // Assignment and status tracking (same as masterlead)
      cnEmail: text2("cn_email"),
      // Assigned agent email (NULL = unassigned)
      cnresolution: text2("cnresolution").default("pending"),
      // Status: pending, called, booked, etc.
      assignedDate: timestamp2("assigned_date"),
      // When candidate was assigned to agent
      previousCnEmail: text2("previous_cn_email"),
      // Previous agent assignment (for rotation)
      lastAssignedDate: timestamp2("last_assigned_date"),
      // Last assignment timestamp
      currentlyCalling: boolean2("currently_calling").default(false),
      // Flag for active calls
      // Call tracking
      lastContacted: timestamp2("last_contacted"),
      dnc: boolean2("dnc").default(false),
      // Do Not Call flag
      // Market/context
      market: text2("market").default("aorecruit"),
      // Always 'aorecruit' for recruit candidates
      // Recruit hotlead (high-priority candidate, like masterlead is_hot_lead)
      isHotLead: boolean2("is_hot_lead").default(false),
      // Timestamps
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    veteranLeads = pgTable2("veteran_leads", {
      id: serial("id").primaryKey(),
      firstName: text2("first_name").notNull(),
      lastName: text2("last_name").notNull(),
      phone: text2("phone").notNull(),
      email: text2("email"),
      city: text2("city"),
      state: text2("state"),
      zip: text2("zip"),
      address: text2("address"),
      createdAt: timestamp2("created_at"),
      updatedAt: timestamp2("updated_at"),
      calledAt: timestamp2("called_at"),
      dnc: boolean2("dnc").default(false),
      tryCount: integer2("try_count").default(0),
      answered: boolean2("answered").default(false),
      hasSentSMS: boolean2("has_sent_sms").default(false),
      hasOpenLink: boolean2("has_open_link").default(false),
      hasRedirectCall: boolean2("has_redirect_call").default(false),
      duration: integer2("duration"),
      durationAfterTransfer: integer2("duration_after_transfer"),
      hasSummary: boolean2("has_summary").default(false),
      // Call disposition tracking
      callDisposition: text2("call_disposition"),
      // 'no_answer_vm', 'booked', 'call_back', 'not_interested', 'medically_uninsurable', 'already_been_sold', 'duplicate', 'do_not_call'
      dispositionNotes: text2("disposition_notes"),
      dispositionTimestamp: timestamp2("disposition_timestamp"),
      // Taalk integration fields
      taalkSponsorOrg: text2("taalk_sponsor_org"),
      taalkMarket: text2("taalk_market"),
      taalkLeadSource: text2("taalk_lead_source"),
      taalkState: text2("taalk_state"),
      taalkReferred: text2("taalk_referred"),
      taalkRelationship: text2("taalk_relationship"),
      taalkSecretKey: text2("taalk_secret_key"),
      taalkGroupCode: text2("taalk_group_code"),
      taalkLeadId: text2("taalk_lead_id"),
      taalkCity: text2("taalk_city"),
      taalkEmail: text2("taalk_email"),
      taalkZip: text2("taalk_zip"),
      taalkAddress: text2("taalk_address")
    });
    insertVeteranLeadSchema = createInsertSchema(veteranLeads).omit({
      id: true
    });
    incomingLeads = pgTable2("incoming_leads", {
      id: serial("id").primaryKey(),
      firstName: varchar2("first_name", { length: 255 }).notNull(),
      lastName: varchar2("last_name", { length: 255 }).notNull(),
      referrer: varchar2("referrer", { length: 255 }),
      phone: varchar2("phone", { length: 20 }).notNull(),
      email: varchar2("email", { length: 255 }),
      address1: varchar2("address_1", { length: 500 }),
      city: varchar2("city", { length: 255 }),
      state: varchar2("state", { length: 10 }),
      postalCode: varchar2("postal_code", { length: 20 }),
      language: varchar2("language", { length: 10 }).default("1"),
      cost: varchar2("cost", { length: 20 }),
      gender: varchar2("gender", { length: 20 }),
      querystring: text2("querystring"),
      status: varchar2("status", { length: 50 }).default("new").notNull(),
      assignedAgent: varchar2("assigned_agent", { length: 255 }),
      createdAt: timestamp2("created_at").defaultNow().notNull(),
      processedAt: timestamp2("processed_at")
    });
    insertIncomingLeadSchema = createInsertSchema(incomingLeads).omit({
      id: true,
      createdAt: true,
      processedAt: true
    });
    insertOutboundCallSchema = createInsertSchema(outboundCalls).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertCallCenterEventSchema = createInsertSchema(callCenterEvents).omit({
      id: true,
      timestamp: true
    });
    insertAgentMetricsSchema = createInsertSchema(agentMetrics).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertWarMetricsSchema = createInsertSchema(warMetrics).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertWarTeamSchema = createInsertSchema(warTeams).omit({
      id: true,
      createdAt: true
    });
    insertWarTeamMemberSchema = createInsertSchema(warTeamMembers).omit({
      id: true,
      joinedAt: true
    });
    insertCallTrackerSchema = createInsertSchema(callTracker).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertVerificationSessionSchema = createInsertSchema(verificationSessions).omit({
      id: true,
      sessionId: true,
      createdAt: true,
      completedAt: true,
      initiatedAt: true,
      // Auto-generated timestamp
      callCompletedAt: true,
      // Auto-generated timestamp
      lastPolledAt: true
      // Auto-generated timestamp
    }).extend({
      verificationMethod: z.enum(["zoom", "phone", "whatsapp", "facetime"])
    });
    clientInfoSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      city: z.string(),
      state: z.string(),
      country: z.string().optional().default("USA"),
      // Add country field for Canada support
      premium: z.string(),
      language: z.string().default("en"),
      verificationMethod: z.enum(["zoom", "phone", "whatsapp", "facetime"]),
      spouseName: z.string().optional(),
      agentPhone: z.string().optional(),
      agentFirstName: z.string().optional(),
      agentLastName: z.string().optional(),
      associateId: z.number().optional(),
      achDrawDate: z.string().optional(),
      achDrawDateShort: z.string().optional(),
      zoomRoomId: z.string().optional(),
      zoomPassword: z.string().optional()
    });
    methodSelectionSchema = z.object({
      sessionId: z.string(),
      verificationMethod: z.enum(["zoom", "phone", "whatsapp", "facetime"])
    });
    screenshotUploadSchema = z.object({
      sessionId: z.string(),
      screenshotPath: z.string()
    });
    smsVerificationSchema = z.object({
      sessionId: z.string(),
      phone: z.string()
    });
    clientApprovalSchema = z.object({
      sessionId: z.string(),
      verificationCode: z.string(),
      approved: z.boolean(),
      ipAddress: z.string().optional(),
      location: z.string().optional(),
      userAgent: z.string().optional(),
      timezone: z.string().optional()
    });
    insertWarConnectSchema = createInsertSchema(warConnects);
    insertAppointmentSchema = createInsertSchema(appointments).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      cancelledAt: true,
      completedAt: true
    });
    updateAppointmentSchema = insertAppointmentSchema.partial().extend({
      id: z.number()
    });
    appointmentQuerySchema = z.object({
      agentEmail: z.string().optional(),
      leadId: z.string().optional(),
      status: z.enum(["scheduled", "confirmed", "rescheduled", "cancelled", "completed", "no-show"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      appointmentType: z.enum(["consultation", "follow-up", "presentation", "closing"]).optional()
    });
    insertWarSubmissionSchema = createInsertSchema(warSubmissions);
    appointmentReviews = pgTable2("appointment_reviews", {
      id: serial("id").primaryKey(),
      appointmentId: integer2("appointment_id").references(() => appointments.id).notNull(),
      agentEmail: text2("agent_email").notNull(),
      // Appointment outcome
      outcome: text2("outcome").notNull(),
      // 'sale', 'interested', 'not_interested', 'no_show', 'reschedule'
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }),
      // Premium amount for sales
      notes: text2("notes"),
      // Follow-up information
      followUpDate: timestamp2("follow_up_date"),
      followUpNotes: text2("follow_up_notes"),
      // System tracking
      reviewedAt: timestamp2("reviewed_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    insertAppointmentReviewSchema = createInsertSchema(appointmentReviews).omit({
      id: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true
    });
    insertWalkthroughVideoSchema = createInsertSchema(walkthroughVideos).omit({ id: true, createdAt: true, updatedAt: true });
    insertWalkthroughProgressSchema = createInsertSchema(walkthroughProgress).omit({ id: true, createdAt: true, updatedAt: true });
    insertWalkthroughCompletionSchema = createInsertSchema(walkthroughCompletion).omit({ id: true, createdAt: true, updatedAt: true });
    dailyAccountability = pgTable2("daily_accountability", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull(),
      accountabilityDate: timestamp2("accountability_date").notNull(),
      // The date they're reporting on (previous day)
      hasCompletedReport: boolean2("has_completed_report").default(false),
      totalAppointments: integer2("total_appointments").default(0),
      appointmentsReported: integer2("appointments_reported").default(0),
      totalSales: integer2("total_sales").default(0),
      totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0.00"),
      notes: text2("notes"),
      submittedAt: timestamp2("submitted_at"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    appointmentOutcomes = pgTable2("appointment_outcomes", {
      id: serial("id").primaryKey(),
      accountabilityId: integer2("accountability_id").references(() => dailyAccountability.id).notNull(),
      appointmentId: integer2("appointment_id").notNull(),
      appointmentTitle: text2("appointment_title").notNull(),
      leadName: text2("lead_name").notNull(),
      outcome: text2("outcome").notNull(),
      // 'pending', 'sale', 'refused', 'cannot_afford', 'thinker', 'medically_uninsurable', 'no_need', 'no_show', 'reschedule'
      saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).default("0.00"),
      notes: text2("notes"),
      agentEmail: text2("agent_email").notNull(),
      reportedAt: timestamp2("reported_at").defaultNow(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    agentAccessControl = pgTable2("agent_access_control", {
      id: serial("id").primaryKey(),
      agentEmail: text2("agent_email").notNull().unique(),
      lastAccountabilityDate: timestamp2("last_accountability_date"),
      isBlocked: boolean2("is_blocked").default(false),
      blockedReason: text2("blocked_reason"),
      nextRequiredAccountabilityDate: timestamp2("next_required_accountability_date"),
      consecutiveDaysCompleted: integer2("consecutive_days_completed").default(0),
      totalAccountabilityReports: integer2("total_accountability_reports").default(0),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    insertDailyAccountabilitySchema = createInsertSchema(dailyAccountability).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertAgentAccessControlSchema = createInsertSchema(agentAccessControl).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertAppointmentOutcomeSchema = createInsertSchema(appointmentOutcomes).omit({
      id: true,
      reportedAt: true,
      createdAt: true
    });
    insertCallDispositionInconsistencySchema = createInsertSchema(callDispositionInconsistencies).omit({
      id: true,
      createdAt: true
    });
    insertLeadCampaignSchema = createInsertSchema(leadCampaigns).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    outboundCallHistory = pgTable2("outbound_call_history", {
      id: serial("id").primaryKey(),
      leadPhone: varchar2("lead_phone", { length: 20 }).notNull(),
      leadName: varchar2("lead_name", { length: 255 }),
      leadState: varchar2("lead_state", { length: 10 }),
      agentEmail: varchar2("agent_email", { length: 255 }).notNull(),
      agentName: varchar2("agent_name", { length: 255 }),
      callSid: varchar2("call_sid", { length: 255 }),
      conferenceName: varchar2("conference_name", { length: 255 }),
      localPresenceNumber: varchar2("local_presence_number", { length: 20 }),
      callStatus: varchar2("call_status", { length: 50 }).default("initiated"),
      callDisposition: varchar2("call_disposition", { length: 100 }),
      callDuration: integer2("call_duration").default(0),
      callAttempts: integer2("call_attempts").default(1),
      lastContactedAt: timestamp2("last_contacted_at").defaultNow(),
      startTime: timestamp2("start_time").defaultNow(),
      answerTime: timestamp2("answer_time"),
      endTime: timestamp2("end_time"),
      createdAt: timestamp2("created_at").defaultNow(),
      notes: text2("notes")
    });
    inboundCallRouting = pgTable2("inbound_call_routing", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      callerPhone: varchar2("caller_phone", { length: 20 }).notNull(),
      incomingCallSid: varchar2("incoming_call_sid", { length: 255 }),
      routedToAgent: varchar2("routed_to_agent", { length: 255 }),
      routingReason: varchar2("routing_reason", { length: 100 }),
      // "callback", "new_caller", "manual_assignment"
      conferenceName: varchar2("conference_name", { length: 255 }),
      callStartTime: timestamp2("call_start_time").defaultNow(),
      callEndTime: timestamp2("call_end_time"),
      callDuration: integer2("call_duration"),
      callStatus: varchar2("call_status", { length: 50 }).default("active"),
      notes: text2("notes")
    });
    teams = pgTable2("teams", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      name: text2("name").notNull(),
      description: text2("description"),
      managerId: text2("manager_id"),
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    roles = pgTable2("roles", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      name: text2("name").notNull().unique(),
      description: text2("description"),
      permissions: jsonb("permissions").default(sql2`'[]'::jsonb`),
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    connectnowUsers = pgTable2("connectnow_users", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      email: text2("email").notNull().unique(),
      firstName: text2("first_name"),
      lastName: text2("last_name"),
      profileImageUrl: text2("profile_image_url"),
      supabaseUserId: text2("supabase_user_id").unique(),
      isAdmin: boolean2("is_admin").default(false),
      isActive: boolean2("is_active").default(true),
      teamId: text2("team_id"),
      roleId: text2("role_id"),
      creditsRemaining: integer2("credits_remaining").default(0),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    qualityManagerRoles = pgTable2("quality_manager_roles", {
      id: serial("id").primaryKey(),
      email: text2("email").notNull().unique(),
      isActive: boolean2("is_active").default(true),
      assignedBy: text2("assigned_by"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    mgaTeams = pgTable2("mga_teams", {
      id: serial("id").primaryKey(),
      name: text2("name").notNull().unique(),
      description: text2("description"),
      teamType: varchar2("team_type", { length: 10 }).default("MGA"),
      // "MGA" or "RGA"
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    qualityManagerAssignments = pgTable2("quality_manager_assignments", {
      id: serial("id").primaryKey(),
      qmEmail: text2("qm_email").notNull(),
      mgaTeamId: integer2("mga_team_id").references(() => mgaTeams.id).notNull(),
      createdAt: timestamp2("created_at").defaultNow()
    });
    callUsageTracking = pgTable2("call_usage_tracking", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      userId: text2("user_id").notNull(),
      userEmail: text2("user_email").notNull(),
      callType: varchar2("call_type", { length: 20 }).notNull(),
      // "voice", "video", "conference"
      callId: varchar2("call_id", { length: 255 }).notNull(),
      // Twilio CallSid or Whereby meeting ID
      leadPhone: varchar2("lead_phone", { length: 20 }),
      leadName: varchar2("lead_name", { length: 255 }),
      startTime: timestamp2("start_time").notNull(),
      endTime: timestamp2("end_time"),
      durationSeconds: integer2("duration_seconds").default(0),
      durationMinutes: decimal("duration_minutes", { precision: 10, scale: 2 }).default("0.00"),
      creditsCharged: decimal("credits_charged", { precision: 10, scale: 4 }).default("0.0000"),
      billingRate: decimal("billing_rate", { precision: 10, scale: 4 }).default("0.0167"),
      // $1/hour = ~$0.0167/minute
      totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0.0000"),
      billingStatus: varchar2("billing_status", { length: 20 }).default("pending"),
      // "pending", "charged", "failed"
      platform: varchar2("platform", { length: 50 }),
      // "twilio", "whereby", "aoi-meet"
      metadata: jsonb("metadata").default(sql2`'{}'::jsonb`),
      // Additional call details
      createdAt: timestamp2("created_at").defaultNow(),
      billedAt: timestamp2("billed_at")
    });
    videoMeetingTracking = pgTable2("video_meeting_tracking", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      userId: text2("user_id").notNull(),
      userEmail: text2("user_email").notNull(),
      meetingId: varchar2("meeting_id", { length: 255 }).notNull(),
      meetingType: varchar2("meeting_type", { length: 20 }).notNull(),
      // "whereby", "zoom", "aoi-meet"
      roomUrl: text2("room_url"),
      hostRoomUrl: text2("host_room_url"),
      leadName: varchar2("lead_name", { length: 255 }),
      leadPhone: varchar2("lead_phone", { length: 20 }),
      startTime: timestamp2("start_time").notNull(),
      endTime: timestamp2("end_time"),
      durationSeconds: integer2("duration_seconds").default(0),
      durationMinutes: decimal("duration_minutes", { precision: 10, scale: 2 }).default("0.00"),
      participantCount: integer2("participant_count").default(1),
      maxParticipants: integer2("max_participants").default(1),
      creditsCharged: decimal("credits_charged", { precision: 10, scale: 4 }).default("0.0000"),
      billingRate: decimal("billing_rate", { precision: 10, scale: 4 }).default("0.0167"),
      // $1/hour = ~$0.0167/minute
      totalCost: decimal("total_cost", { precision: 10, scale: 4 }).default("0.0000"),
      billingStatus: varchar2("billing_status", { length: 20 }).default("pending"),
      metadata: jsonb("metadata").default(sql2`'{}'::jsonb`),
      createdAt: timestamp2("created_at").defaultNow(),
      billedAt: timestamp2("billed_at")
    });
    userCredits = pgTable2("user_credits", {
      id: uuid("id").primaryKey().default(sql2`gen_random_uuid()`),
      email: text2("email").notNull().unique(),
      name: text2("name"),
      externalId: text2("external_id"),
      stripeId: text2("stripe_id"),
      stripeCreated: text2("stripe_created"),
      totalSpend: decimal("total_spend"),
      paymentCount: integer2("payment_count"),
      refunded: decimal("refunded"),
      creditsPurchased: integer2("credits_purchased").default(0),
      creditsUsed: integer2("credits_used").default(0),
      needsAdditionalCredits: integer2("needs_additional_credits"),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow(),
      associateId: text2("associate_id"),
      manualAdjustments: integer2("manual_adjustments").default(0),
      creditsRemaining: integer2("credits_remaining").default(0),
      autoRefillEnabled: boolean2("auto_refill_enabled").default(false),
      refillAmount: integer2("refill_amount").default(0),
      threshold: integer2("threshold").default(0),
      zeroCreditsNotified: boolean2("zero_credits_notified").default(false),
      aoiConnectCreditsUsed: integer2("aoi_connect_credits_used").default(0),
      aoiPlusCreditsUsed: integer2("aoi_plus_credits_used").default(0),
      aoiPrecheckCreditsUsed: integer2("aoi_precheck_credits_used").default(0),
      aoiRecruitCreditsUsed: integer2("aoi_recruit_credits_used").default(0),
      aoiPlusOptedIn: boolean2("aoi_plus_opted_in").default(false),
      aoiRecruitOptedIn: boolean2("aoi_recruit_opted_in").default(false),
      aoiConnectOptedIn: boolean2("aoi_connect_opted_in").default(false)
    });
    incomingCalls = pgTable2("incoming_calls", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull(),
      callerNumber: text2("caller_number"),
      twilioCallSid: text2("twilio_call_sid"),
      assignedAgentEmail: text2("assigned_agent_email"),
      status: text2("status"),
      // 'ringing', 'answered', 'declined', 'completed', 'missed'
      callType: text2("call_type").default("inbound"),
      // 'VDP', 'inbound', 'support'
      leadName: text2("lead_name"),
      leadCity: text2("lead_city"),
      leadState: text2("lead_state"),
      duration: integer2("duration"),
      notes: text2("notes"),
      createdAt: timestamp2("created_at").defaultNow(),
      answeredAt: timestamp2("answered_at"),
      endedAt: timestamp2("ended_at")
    });
    userGameStats = pgTable2("user_game_stats", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull().unique(),
      level: integer2("level").default(1),
      xp: integer2("xp").default(0),
      totalCalls: integer2("total_calls").default(0),
      successfulCalls: integer2("successful_calls").default(0),
      streak: integer2("streak").default(0),
      achievements: jsonb("achievements").default(sql2`'[]'::jsonb`),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    leaderboard = pgTable2("leaderboard", {
      id: serial("id").primaryKey(),
      userId: text2("user_id").notNull(),
      period: text2("period"),
      // 'daily', 'weekly', 'monthly'
      metric: text2("metric"),
      // 'calls', 'sales', 'xp'
      value: integer2("value"),
      rank: integer2("rank"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    teamsRelations = relations(teams, ({ one, many }) => ({
      manager: one(connectnowUsers, {
        fields: [teams.managerId],
        references: [connectnowUsers.id]
      }),
      members: many(connectnowUsers)
    }));
    rolesRelations = relations(roles, ({ many }) => ({
      users: many(connectnowUsers)
    }));
    connectnowUsersRelations = relations(connectnowUsers, ({ one, many }) => ({
      team: one(teams, {
        fields: [connectnowUsers.teamId],
        references: [teams.id]
      }),
      role: one(roles, {
        fields: [connectnowUsers.roleId],
        references: [roles.id]
      }),
      callLogs: many(callLogs),
      vdpCalls: many(vdpCalls),
      incomingCalls: many(incomingCalls),
      gameStats: one(userGameStats, {
        fields: [connectnowUsers.id],
        references: [userGameStats.userId]
      })
    }));
    callLogsRelations = relations(callLogs, ({ one }) => ({
      // No relations for now - keeping it simple
    }));
    vdpCallsRelations = relations(vdpCalls, ({ one }) => ({
      // No user relation - VDP calls don't have userId field
    }));
    incomingCallsRelations = relations(incomingCalls, ({ one }) => ({
      user: one(connectnowUsers, {
        fields: [incomingCalls.userId],
        references: [connectnowUsers.id]
      })
    }));
    userGameStatsRelations = relations(userGameStats, ({ one }) => ({
      user: one(connectnowUsers, {
        fields: [userGameStats.userId],
        references: [connectnowUsers.id]
      })
    }));
    insertTeamSchema = createInsertSchema(teams).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRoleSchema = createInsertSchema(roles).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertConnectNowUserSchema = createInsertSchema(connectnowUsers).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertCallLogSchema = createInsertSchema(callLogs).omit({
      id: true,
      createdAt: true
    });
    insertVdpCallSchema = createInsertSchema(vdpCalls).omit({
      id: true,
      createdAt: true
    });
    adminRoles = pgTable2("admin_roles", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      name: text2("name").notNull().unique(),
      displayName: text2("display_name").notNull(),
      description: text2("description"),
      permissions: jsonb("permissions").default(sql2`'[]'::jsonb`),
      level: integer2("level").default(0),
      // 0=agent, 1=manager, 2=admin, 3=super_admin
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow(),
      updatedAt: timestamp2("updated_at").defaultNow()
    });
    userRoles = pgTable2("user_roles", {
      id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
      userEmail: text2("user_email").notNull(),
      roleId: text2("role_id").notNull(),
      assignedBy: text2("assigned_by"),
      assignedAt: timestamp2("assigned_at").defaultNow(),
      isActive: boolean2("is_active").default(true)
    });
    adminLogs = pgTable2("admin_logs", {
      id: serial("id").primaryKey(),
      adminEmail: text2("admin_email").notNull(),
      action: text2("action").notNull(),
      targetUserId: text2("target_user_id"),
      targetUserEmail: text2("target_user_email"),
      details: jsonb("details"),
      ipAddress: text2("ip_address"),
      userAgent: text2("user_agent"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    insertAdminRoleSchema = createInsertSchema(adminRoles).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertUserRoleSchema = createInsertSchema(userRoles).omit({
      id: true,
      assignedAt: true
    });
    insertAdminLogSchema = createInsertSchema(adminLogs).omit({
      id: true,
      createdAt: true
    });
    insertFeedbackReportSchema = createInsertSchema(feedbackReports).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    insertRecruitCandidateSchema = createInsertSchema(recruitCandidates).omit({
      id: true,
      createdAt: true,
      updatedAt: true
    });
    updateRecruitCandidateSchema = createInsertSchema(recruitCandidates).omit({
      id: true,
      createdAt: true,
      agentId: true,
      agentEmail: true
    }).partial();
    insertCallUsageTrackingSchema = createInsertSchema(callUsageTracking).omit({
      id: true,
      createdAt: true,
      billedAt: true
    });
    insertVideoMeetingTrackingSchema = createInsertSchema(videoMeetingTracking).omit({
      id: true,
      createdAt: true,
      billedAt: true
    });
    userSessions = pgTable2("user_sessions", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      sessionId: text2("session_id").notNull().unique(),
      // UUID for session tracking
      loginTime: timestamp2("login_time").notNull().defaultNow(),
      logoutTime: timestamp2("logout_time"),
      // Null until logout
      sessionDuration: integer2("session_duration"),
      // Duration in seconds
      ipAddress: text2("ip_address"),
      userAgent: text2("user_agent"),
      isActive: boolean2("is_active").default(true),
      createdAt: timestamp2("created_at").defaultNow()
    });
    pageActivityLogs = pgTable2("page_activity_logs", {
      id: serial("id").primaryKey(),
      sessionId: text2("session_id").notNull(),
      // Links to user_sessions
      userEmail: text2("user_email").notNull(),
      pagePath: text2("page_path").notNull(),
      // e.g., "/dashboard/aoi", "/call-connector-pro"
      pageTitle: text2("page_title"),
      // Human readable page name
      timeSpent: integer2("time_spent"),
      // Time spent on page in seconds
      visitedAt: timestamp2("visited_at").notNull().defaultNow(),
      leftAt: timestamp2("left_at")
      // When they left the page
    });
    featureUsageLogs = pgTable2("feature_usage_logs", {
      id: serial("id").primaryKey(),
      sessionId: text2("session_id").notNull(),
      userEmail: text2("user_email").notNull(),
      featureName: text2("feature_name").notNull(),
      // e.g., "vdp_call", "call_connector_pro", "billing_report"
      action: text2("action").notNull(),
      // e.g., "started", "completed", "clicked", "viewed"
      metadata: jsonb("metadata"),
      // Additional context data
      timestamp: timestamp2("timestamp").notNull().defaultNow()
    });
    dailyUserStats = pgTable2("daily_user_stats", {
      id: serial("id").primaryKey(),
      userEmail: text2("user_email").notNull(),
      date: text2("date").notNull(),
      // YYYY-MM-DD format
      totalSessionTime: integer2("total_session_time").default(0),
      // Total seconds online
      pageViews: integer2("page_views").default(0),
      // Number of page visits
      featuresUsed: jsonb("features_used").default(sql2`'[]'::jsonb`),
      // Array of features accessed
      callsMade: integer2("calls_made").default(0),
      // Number of calls made
      vdpConnects: integer2("vdp_connects").default(0),
      // VDP connects made
      lastActivity: timestamp2("last_activity"),
      createdAt: timestamp2("created_at").defaultNow()
    });
    insertUserSessionSchema = createInsertSchema(userSessions).omit({
      id: true,
      createdAt: true
    });
    insertPageActivityLogSchema = createInsertSchema(pageActivityLogs).omit({
      id: true
    });
    insertFeatureUsageLogSchema = createInsertSchema(featureUsageLogs).omit({
      id: true
    });
    insertDailyUserStatsSchema = createInsertSchema(dailyUserStats).omit({
      id: true,
      createdAt: true
    });
    insertRolePagePermissionSchema = createInsertSchema(rolePagePermissions).omit({
      createdAt: true,
      updatedAt: true
    });
    insertQualityManagerTeamAssignmentSchema = createInsertSchema(qualityManagerTeamAssignments).omit({
      id: true,
      createdAt: true
    });
    DEFAULT_PAGE_PERMISSIONS = {
      system_admin: [...PAGE_KEYS],
      // System admin gets access to all pages
      rga: ["billing-dashboard", "aoi-report", "appointments", "ao-recruit", "ao-precheck", "settings", "ao-intelligence", "ao-connect", "admin", "user-management", "teams-management"],
      // RGA gets broad access
      mga: ["billing-dashboard", "aoi-report", "appointments", "ao-recruit", "ao-precheck", "settings", "ao-intelligence", "ao-connect", "teams-management"],
      // MGA gets team management access
      agent: ["billing-dashboard", "aoi-report", "appointments", "ao-recruit", "ao-precheck", "settings", "ao-intelligence", "ao-connect"],
      // Agent access as requested
      quality_manager: ["settings", "ao-precheck-management"],
      // Quality manager limited access as requested
      ao_quality_manager: ["settings", "ao-precheck-management", "aoi-report", "ao-intelligence"]
      // AO Quality Manager with AO-focused access
    };
  }
});

// server/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
function getQueryText(args) {
  const first = args[0];
  if (typeof first === "string") return first;
  if (first && typeof first.text === "string") return first.text;
  return "";
}
function isLowPriorityDbQuery(queryText) {
  const normalized = queryText.toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("leasedialer") || normalized.includes("agent_routing_profiles")) return false;
  return normalized.includes("twilio_call_logs") || normalized.includes("agent_dial_metrics") || normalized.includes("agent_daily_stats") || normalized.includes("webhook_sent_at") || normalized.includes("with plus_ml as");
}
async function runLowPriorityDbQuery(operation) {
  const queuedAt = Date.now();
  if (lowPriorityDbActive >= LOW_PRIORITY_DB_CONCURRENCY) {
    if (lowPriorityDbQueue.length >= LOW_PRIORITY_DB_MAX_QUEUE) {
      throw new Error(`Low priority DB queue is full (${LOW_PRIORITY_DB_MAX_QUEUE})`);
    }
    await new Promise((resolve) => {
      lowPriorityDbQueue.push(resolve);
    });
  }
  lowPriorityDbActive += 1;
  const waitedMs = Date.now() - queuedAt;
  if (waitedMs > LOW_PRIORITY_DB_WARN_MS && Date.now() - lowPriorityDbLastWarnAt > LOW_PRIORITY_DB_WARN_MS) {
    lowPriorityDbLastWarnAt = Date.now();
    console.error("[DB_LOW_PRIORITY] query waited for slot", {
      waitedMs,
      active: lowPriorityDbActive,
      queued: lowPriorityDbQueue.length,
      concurrency: LOW_PRIORITY_DB_CONCURRENCY
    });
  }
  try {
    return await operation();
  } finally {
    lowPriorityDbActive = Math.max(0, lowPriorityDbActive - 1);
    const next = lowPriorityDbQueue.shift();
    if (next) setImmediate(next);
  }
}
var pool, dispositionWritePool, leaseDialerPool, leaseDialerWorkerPool, nonLeadPool, LOW_PRIORITY_DB_CONCURRENCY, LOW_PRIORITY_DB_MAX_QUEUE, LOW_PRIORITY_DB_WARN_MS, lowPriorityDbActive, lowPriorityDbLastWarnAt, lowPriorityDbQueue, originalPoolQuery, nonLeadPoolQuery, db, dbConnected;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_hardcoded_config();
    init_perf_observability();
    if (!DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3,
      query_timeout: 15e3,
      statement_timeout: 15e3,
      keepAlive: true,
      maxUses: 7500,
      allowExitOnIdle: false
    });
    dispositionWritePool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 1e4,
      query_timeout: 12e4,
      statement_timeout: 12e4,
      keepAlive: true,
      maxUses: 7500,
      allowExitOnIdle: false
    });
    leaseDialerPool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3,
      query_timeout: 15e3,
      statement_timeout: 15e3,
      keepAlive: true,
      maxUses: 5e3,
      allowExitOnIdle: false
    });
    leaseDialerWorkerPool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3,
      query_timeout: 3e4,
      statement_timeout: 3e4,
      keepAlive: true,
      maxUses: 5e3,
      allowExitOnIdle: false
    });
    nonLeadPool = new Pool({
      connectionString: DATABASE_URL,
      max: Math.max(2, Number(process.env.NON_LEAD_POOL_MAX || 8)),
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 8e3,
      query_timeout: 3e4,
      statement_timeout: 3e4,
      keepAlive: true,
      maxUses: 5e3,
      allowExitOnIdle: false
    });
    LOW_PRIORITY_DB_CONCURRENCY = Math.max(1, Number(process.env.LOW_PRIORITY_DB_CONCURRENCY || 8));
    LOW_PRIORITY_DB_MAX_QUEUE = Math.max(LOW_PRIORITY_DB_CONCURRENCY, Number(process.env.LOW_PRIORITY_DB_MAX_QUEUE || 2e3));
    LOW_PRIORITY_DB_WARN_MS = Math.max(1e3, Number(process.env.LOW_PRIORITY_DB_WARN_MS || 1e4));
    lowPriorityDbActive = 0;
    lowPriorityDbLastWarnAt = 0;
    lowPriorityDbQueue = [];
    originalPoolQuery = pool.query.bind(pool);
    nonLeadPoolQuery = nonLeadPool.query.bind(nonLeadPool);
    pool.query = async (...args) => {
      const start = Date.now();
      try {
        const queryText = getQueryText(args);
        const result = isLowPriorityDbQuery(queryText) ? await runLowPriorityDbQuery(() => nonLeadPoolQuery(...args)) : await originalPoolQuery(...args);
        perfStore.recordDependency("postgres", "pool.query", Date.now() - start, true);
        return result;
      } catch (error) {
        perfStore.recordDependency("postgres", "pool.query", Date.now() - start, false);
        throw error;
      }
    };
    db = drizzle({ client: pool, schema: schema_exports });
    dbConnected = false;
    pool.on("connect", () => {
      console.log("\u{1F517} Database pool connected");
      dbConnected = true;
    });
    pool.on("error", (err) => {
      console.warn("\u26A0\uFE0F Database connection failed - running without database");
      console.warn("Database error:", err.message);
      dbConnected = false;
    });
    pool.on("remove", () => {
      console.log("\u{1F50C} Database connection removed from pool");
    });
    nonLeadPool.on("connect", () => {
      console.log("\u{1F517} Non-lead DB pool connected");
    });
    nonLeadPool.on("error", (err) => {
      console.warn("\u26A0\uFE0F Non-lead DB connection failed");
      console.warn("Non-lead DB error:", err.message);
    });
    nonLeadPool.on("remove", () => {
      console.log("\u{1F50C} Non-lead DB connection removed from pool");
    });
  }
});

// server/local-hot-table-client.ts
function normalizeTable(table) {
  return String(table || "").trim().toLowerCase();
}
function normalizeColumn(column) {
  const clean = String(column || "").trim().replace(/^"+|"+$/g, "");
  if (!clean) return clean;
  if (clean.includes("_") || /[A-Z]/.test(clean)) return clean;
  return clean.toLowerCase();
}
function splitColumns(columns) {
  return String(columns || "*").split(",").map((c) => normalizeColumn(c.trim())).filter(Boolean);
}
function parseOrExpr(expr) {
  return String(expr || "").split(",").map((x) => x.trim()).filter(Boolean);
}
function parseInList(raw) {
  const trimmed = String(raw || "").trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((x) => x.trim()).filter(Boolean);
}
function qcol(column) {
  return `"${String(column).replace(/"/g, '""')}"`;
}
async function ensureBaseTable(table) {
  const t = normalizeTable(table);
  if (baseReadyByTable.get(t)) return;
  if (!HOT_TABLES.has(t)) throw new Error(`Unsupported local hot table: ${t}`);
  if (t === "twilio_call_logs") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS twilio_call_logs (
        id BIGSERIAL PRIMARY KEY,
        twilio_call_sid TEXT UNIQUE NOT NULL
      );
    `);
  } else if (t === "agent_dial_metrics") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_dial_metrics (
        id BIGSERIAL PRIMARY KEY,
        agent_email TEXT,
        lead_phone TEXT,
        event_type TEXT
      );
    `);
  }
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = $1`,
    [t]
  );
  const known = new Set(columns.rows.map((r) => String(r.column_name || "")));
  knownColumnsByTable.set(t, known);
  baseReadyByTable.set(t, true);
}
async function ensureColumns(table, columns) {
  const t = normalizeTable(table);
  await ensureBaseTable(t);
  const known = knownColumnsByTable.get(t) || /* @__PURE__ */ new Set();
  for (const col of columns.map((c) => normalizeColumn(c)).filter(Boolean)) {
    if (col === "*") continue;
    if (known.has(col)) continue;
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${qcol(col)} TEXT`);
    known.add(col);
  }
  knownColumnsByTable.set(t, known);
}
var HOT_TABLES, knownColumnsByTable, baseReadyByTable, LocalHotTableBuilder, localHotTableClient;
var init_local_hot_table_client = __esm({
  "server/local-hot-table-client.ts"() {
    "use strict";
    init_db();
    HOT_TABLES = /* @__PURE__ */ new Set(["twilio_call_logs", "agent_dial_metrics"]);
    knownColumnsByTable = /* @__PURE__ */ new Map();
    baseReadyByTable = /* @__PURE__ */ new Map();
    LocalHotTableBuilder = class {
      constructor(tableName) {
        this.tableName = tableName;
      }
      mode = "select";
      selectColumns = "*";
      selectHead = false;
      selectCount = null;
      filters = [];
      orderBys = [];
      limitValue = null;
      offsetValue = null;
      singleType = null;
      updatePayload = null;
      insertPayload = [];
      upsertConflict = "id";
      upsertIgnoreDuplicates = false;
      referencedColumns = /* @__PURE__ */ new Set();
      addFilter(sql3, ...params) {
        this.filters.push({ sql: sql3, params });
        return this;
      }
      whereClause(startIndex = 1) {
        const values = [];
        let idx = startIndex;
        const parts = this.filters.map((f) => {
          const sql3 = f.sql.replace(/\?/g, () => `$${idx++}`);
          values.push(...f.params);
          return `(${sql3})`;
        });
        return {
          sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
          values
        };
      }
      select(columns = "*", options) {
        this.mode = this.mode === "update" || this.mode === "insert" || this.mode === "upsert" || this.mode === "delete" ? this.mode : "select";
        this.selectColumns = columns || "*";
        if (this.selectColumns !== "*") splitColumns(this.selectColumns).forEach((c) => this.referencedColumns.add(c));
        this.selectCount = options?.count || null;
        this.selectHead = !!options?.head;
        return this;
      }
      eq(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} IS NOT DISTINCT FROM ?`, value);
      }
      neq(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`, value);
      }
      gt(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} > ?`, value);
      }
      gte(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} >= ?`, value);
      }
      lt(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} < ?`, value);
      }
      lte(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`${qcol(col)} <= ?`, value);
      }
      ilike(column, pattern) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE(${qcol(col)}::text, '') ILIKE COALESCE(?::text, '')`, pattern);
      }
      in(column, values) {
        if (!Array.isArray(values) || !values.length) return this.addFilter("1=0");
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        const placeholders2 = values.map(() => "?").join(", ");
        return this.addFilter(`${qcol(col)} IN (${placeholders2})`, ...values);
      }
      is(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`${qcol(col)} IS NULL`);
        if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'true'`);
        if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'false'`);
        return this.addFilter(`${qcol(col)} IS NOT DISTINCT FROM ?`, value);
      }
      not(column, operator, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        const op = String(operator || "").toLowerCase();
        if (op === "is") {
          if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`${qcol(col)} IS NOT NULL`);
          if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) <> 'true'`);
          if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) <> 'false'`);
        }
        if (op === "in") {
          const items = parseInList(String(value || ""));
          if (!items.length) return this;
          const placeholders2 = items.map(() => "?").join(", ");
          return this.addFilter(`COALESCE(${qcol(col)}::text, '') NOT IN (${placeholders2})`, ...items);
        }
        return this.addFilter(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`, value);
      }
      contains(column, value) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        const payload = typeof value === "string" ? value : JSON.stringify(value ?? {});
        return this.addFilter(`${qcol(col)}::jsonb @> ?::jsonb`, payload);
      }
      or(expr) {
        const parts = parseOrExpr(expr);
        if (!parts.length) return this;
        const sqlParts = [];
        const vals = [];
        for (const part of parts) {
          const segs = part.split(".");
          const col = normalizeColumn(segs[0] || "");
          if (!col) continue;
          this.referencedColumns.add(col);
          const op = String(segs[1] || "eq").toLowerCase();
          const raw = segs.slice(2).join(".");
          const value = raw === "null" ? null : raw;
          if (op === "eq") {
            sqlParts.push(`${qcol(col)} IS NOT DISTINCT FROM ?`);
            vals.push(value);
          } else if (op === "neq") {
            sqlParts.push(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`);
            vals.push(value);
          } else if (op === "ilike") {
            sqlParts.push(`COALESCE(${qcol(col)}::text, '') ILIKE COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "is") {
            if (value === null) sqlParts.push(`${qcol(col)} IS NULL`);
            else if (String(value).toLowerCase() === "true") sqlParts.push(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'true'`);
            else if (String(value).toLowerCase() === "false") sqlParts.push(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'false'`);
          } else if (op === "in") {
            const items = parseInList(String(value || ""));
            if (!items.length) continue;
            const placeholders2 = items.map(() => "?").join(", ");
            sqlParts.push(`COALESCE(${qcol(col)}::text, '') IN (${placeholders2})`);
            vals.push(...items);
          } else if (op === "gt") {
            sqlParts.push(`${qcol(col)} > ?`);
            vals.push(value);
          } else if (op === "gte") {
            sqlParts.push(`${qcol(col)} >= ?`);
            vals.push(value);
          } else if (op === "lt") {
            sqlParts.push(`${qcol(col)} < ?`);
            vals.push(value);
          } else if (op === "lte") {
            sqlParts.push(`${qcol(col)} <= ?`);
            vals.push(value);
          }
        }
        if (!sqlParts.length) return this;
        return this.addFilter(sqlParts.join(" OR "), ...vals);
      }
      order(column, options) {
        const col = normalizeColumn(column);
        this.referencedColumns.add(col);
        this.orderBys.push({
          column: col,
          ascending: options?.ascending !== false,
          nullsFirst: options?.nullsFirst
        });
        return this;
      }
      limit(count) {
        this.limitValue = Math.max(0, Number(count || 0));
        return this;
      }
      range(from, to) {
        const start = Math.max(0, Number(from || 0));
        const end = Math.max(start, Number(to || start));
        this.offsetValue = start;
        this.limitValue = end - start + 1;
        return this;
      }
      single() {
        this.singleType = "single";
        return this.execute();
      }
      maybeSingle() {
        this.singleType = "maybeSingle";
        return this.execute();
      }
      update(payload) {
        this.mode = "update";
        this.updatePayload = payload || {};
        Object.keys(this.updatePayload).forEach((k) => this.referencedColumns.add(normalizeColumn(k)));
        return this;
      }
      insert(payload) {
        this.mode = "insert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn(k))));
        return this;
      }
      upsert(payload, options) {
        this.mode = "upsert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn(k))));
        this.upsertConflict = normalizeColumn(options?.onConflict || "id");
        this.referencedColumns.add(this.upsertConflict);
        this.upsertIgnoreDuplicates = !!options?.ignoreDuplicates;
        return this;
      }
      delete() {
        this.mode = "delete";
        return this;
      }
      then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
      }
      async executeSelect() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        const cols = this.selectColumns === "*" ? "*" : splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ");
        const where = this.whereClause(1);
        const order = this.orderBys.length ? ` ORDER BY ${this.orderBys.map((o) => `${qcol(o.column)} ${o.ascending ? "ASC" : "DESC"}${o.nullsFirst === void 0 ? "" : o.nullsFirst ? " NULLS FIRST" : " NULLS LAST"}`).join(", ")}` : "";
        const limit = this.limitValue != null ? ` LIMIT ${this.limitValue}` : "";
        const offset = this.offsetValue != null ? ` OFFSET ${this.offsetValue}` : "";
        let count = null;
        if (this.selectCount === "exact") {
          const c = await pool.query(
            `SELECT COUNT(*)::text AS count FROM ${this.tableName}${where.sql}`,
            where.values
          );
          count = Number(c.rows[0]?.count || 0);
        }
        if (this.selectHead) return { data: null, error: null, count };
        const result = await pool.query(
          `SELECT ${cols} FROM ${this.tableName}${where.sql}${order}${limit}${offset}`,
          where.values
        );
        if (this.singleType === "single") {
          if ((result.rowCount || 0) !== 1) return { data: null, error: { message: "Expected single row" }, count };
          return { data: result.rows[0], error: null, count };
        }
        if (this.singleType === "maybeSingle") return { data: result.rows[0] || null, error: null, count };
        return { data: result.rows, error: null, count };
      }
      buildInsertRows() {
        const rows = this.insertPayload.filter(Boolean);
        const columnSet = /* @__PURE__ */ new Set();
        for (const row of rows) Object.keys(row).forEach((k) => columnSet.add(normalizeColumn(k)));
        const columns = [...columnSet];
        const values = rows.map((row) => columns.map((c) => row[c]));
        return { columns, rows: values };
      }
      async executeUpdateLike() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        if (!this.updatePayload) return { data: null, error: { message: "Missing update payload" }, count: null };
        const entries = Object.entries(this.updatePayload);
        if (!entries.length) return { data: null, error: null, count: 0 };
        const setSql = entries.map(([k], i) => `${qcol(normalizeColumn(k))} = $${i + 1}`).join(", ");
        const setVals = entries.map(([, v]) => v);
        const where = this.whereClause(setVals.length + 1);
        const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ") : "*";
        const wantsData = this.selectColumns !== "*";
        const sql3 = `UPDATE ${this.tableName} SET ${setSql}${where.sql}${wantsData ? ` RETURNING ${returning}` : ""}`;
        const result = await pool.query(sql3, [...setVals, ...where.values]);
        return { data: wantsData ? result.rows : null, error: null, count: result.rowCount || 0 };
      }
      async executeInsertLike() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        const { columns, rows } = this.buildInsertRows();
        if (!columns.length || !rows.length) return { data: null, error: null, count: 0 };
        const values = [];
        let idx = 1;
        const rowSql = rows.map((row) => {
          const ph = row.map(() => `$${idx++}`);
          values.push(...row);
          return `(${ph.join(", ")})`;
        }).join(", ");
        const quotedCols = columns.map((c) => qcol(c)).join(", ");
        let conflictSql = "";
        if (this.mode === "upsert") {
          if (this.upsertIgnoreDuplicates) {
            conflictSql = ` ON CONFLICT (${qcol(this.upsertConflict)}) DO NOTHING`;
          } else {
            const updates = columns.filter((c) => c !== this.upsertConflict).map((c) => `${qcol(c)} = EXCLUDED.${qcol(c)}`).join(", ");
            conflictSql = ` ON CONFLICT (${qcol(this.upsertConflict)}) DO UPDATE SET ${updates || `${qcol(this.upsertConflict)} = EXCLUDED.${qcol(this.upsertConflict)}`}`;
          }
        }
        const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ") : "*";
        const wantsData = this.selectColumns !== "*";
        const sql3 = `INSERT INTO ${this.tableName} (${quotedCols}) VALUES ${rowSql}${conflictSql}${wantsData ? ` RETURNING ${returning}` : ""}`;
        const result = await pool.query(sql3, values);
        const data = wantsData ? this.singleType ? result.rows[0] || null : result.rows : null;
        return { data, error: null, count: result.rowCount || 0 };
      }
      async executeDelete() {
        await ensureColumns(this.tableName, [...this.referencedColumns]);
        const where = this.whereClause(1);
        const sql3 = `DELETE FROM ${this.tableName}${where.sql}`;
        const result = await pool.query(sql3, where.values);
        return { data: null, error: null, count: result.rowCount || 0 };
      }
      async execute() {
        try {
          if (this.mode === "select") return await this.executeSelect();
          if (this.mode === "update") return await this.executeUpdateLike();
          if (this.mode === "insert" || this.mode === "upsert") return await this.executeInsertLike();
          if (this.mode === "delete") return await this.executeDelete();
          return { data: null, error: null, count: 0 };
        } catch (error) {
          return { data: null, error: { message: error?.message || String(error) }, count: null };
        }
      }
    };
    localHotTableClient = {
      from(table) {
        const t = normalizeTable(table);
        if (!HOT_TABLES.has(t)) throw new Error(`localHotTableClient unsupported table: ${t}`);
        return new LocalHotTableBuilder(t);
      }
    };
  }
});

// server/supabase.ts
import { createClient } from "@supabase/supabase-js";
function fetchWithConnectBudget(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input.url || "");
  const method = String(init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET");
  if (shouldBlockHotTableSupabaseWrite(url, method)) {
    const body = JSON.stringify({
      message: "HOT_TABLE_EOD_ONLY_BLOCKED",
      details: "Runtime writes to twilio_call_logs and agent_dial_metrics are disabled outside 11 PM EOD sync window.",
      method,
      url
    });
    return Promise.resolve(
      new Response(body, {
        status: 409,
        headers: { "Content-Type": "application/json" }
      })
    );
  }
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), SUPABASE_ADMIN_FETCH_MS);
  const timedFetch = wrapFetchWithPerf("supabase-admin-http", fetch);
  return timedFetch(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(id));
}
function patchLocalTableRouting(client2) {
  if (!client2 || typeof client2.from !== "function") return;
  const originalFrom = client2.from.bind(client2);
  client2.from = (table) => {
    const t = String(table || "").toLowerCase();
    if (t === "twilio_call_logs" || t === "agent_dial_metrics") {
      return localHotTableClient.from(t);
    }
    return originalFrom(table);
  };
}
var supabaseUrl, supabaseAnonKey, supabaseServiceKey, supabase, SUPABASE_ADMIN_FETCH_MS, supabaseAdminRaw, supabaseAdmin;
var init_supabase = __esm({
  "server/supabase.ts"() {
    "use strict";
    init_hardcoded_config();
    init_perf_observability();
    init_hot_table_write_gate();
    init_local_hot_table_client();
    supabaseUrl = SUPABASE_URL;
    supabaseAnonKey = SUPABASE_ANON_KEY;
    supabaseServiceKey = SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.warn("\u26A0\uFE0F Missing Supabase credentials - Supabase features will be disabled");
      console.warn("Edit server/hardcoded-config.ts (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY)");
      console.warn("URL:", !!supabaseUrl, "Anon Key:", !!supabaseAnonKey, "Service Key:", !!supabaseServiceKey);
    } else {
      console.log("\u2705 Supabase credentials configured properly");
      console.log("\u{1F527} URL:", supabaseUrl.substring(0, 30) + "...");
      console.log("\u{1F527} Key:", supabaseAnonKey.substring(0, 30) + "...");
    }
    supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: "public"
      },
      global: {
        fetch: wrapFetchWithPerf("supabase-anon-http", fetch),
        headers: {
          "Prefer": "count=exact"
        }
      }
    }) : null;
    SUPABASE_ADMIN_FETCH_MS = 12e3;
    supabaseAdminRaw = supabaseServiceKey && supabaseUrl ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: "public"
      },
      global: {
        fetch: fetchWithConnectBudget
      }
    }) : null;
    supabaseAdmin = supabaseServiceKey && supabaseUrl ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: "public"
      },
      global: {
        fetch: fetchWithConnectBudget
      }
    }) : null;
    patchLocalTableRouting(supabase);
    patchLocalTableRouting(supabaseAdmin);
    patchLocalTableRouting(supabaseAdminRaw);
    if (supabase) {
      console.log("\u2705 Supabase anon client created successfully");
    } else {
      console.log("\u274C Supabase anon client creation failed - missing credentials");
    }
    if (supabaseAdmin) {
      console.log("\u2705 Supabase admin client created successfully");
    } else {
      console.log("\u274C Supabase admin client creation failed - missing credentials");
    }
  }
});

// server/local-masterlead-client.ts
async function ensureBaseTable2() {
  if (baseReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS masterlead (
      id BIGSERIAL PRIMARY KEY,
      taalk_lead_id TEXT,
      phone TEXT,
      first_name TEXT,
      last_name TEXT,
      cn_email TEXT,
      cnresolution TEXT,
      last_contacted TIMESTAMPTZ,
      webhook_sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  try {
    await pool.query(`
      DO $$
      DECLARE
        id_data_type TEXT;
        has_default BOOLEAN;
        current_seq TEXT;
        next_seed BIGINT;
      BEGIN
        SELECT data_type, (column_default IS NOT NULL), pg_get_serial_sequence('masterlead', 'id')
        INTO id_data_type, has_default, current_seq
        FROM information_schema.columns
        WHERE table_name = 'masterlead' AND column_name = 'id'
        LIMIT 1;

        IF id_data_type IN ('bigint', 'integer', 'smallint') THEN
          IF current_seq IS NULL THEN
            CREATE SEQUENCE IF NOT EXISTS masterlead_id_seq;
            ALTER SEQUENCE masterlead_id_seq OWNED BY masterlead.id;
            ALTER TABLE masterlead ALTER COLUMN id SET DEFAULT nextval('masterlead_id_seq');
            SELECT COALESCE(MAX(id), 0) + 1 INTO next_seed FROM masterlead;
            PERFORM setval('masterlead_id_seq', next_seed, false);
          ELSIF has_default IS FALSE THEN
            EXECUTE format('ALTER TABLE masterlead ALTER COLUMN id SET DEFAULT nextval(%L)', current_seq);
          END IF;
        END IF;
      END $$;
    `);
  } catch (error) {
    console.warn("\u26A0\uFE0F Unable to enforce masterlead.id default sequence:", error);
  }
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'masterlead'`
  );
  for (const row of columns.rows) knownColumns.add(String(row.column_name || "").toLowerCase());
  baseReady = true;
}
async function ensureColumns2(columns) {
  await ensureBaseTable2();
  for (const col of columns.map((c) => normalizeColumn2(c)).filter(Boolean)) {
    if (knownColumns.has(col)) continue;
    await pool.query(`ALTER TABLE masterlead ADD COLUMN IF NOT EXISTS "${col}" TEXT`);
    knownColumns.add(col);
  }
}
function normalizeColumn2(column) {
  const clean = String(column || "").trim().replace(/^"+|"+$/g, "");
  if (!clean) return clean;
  if (clean.includes("_")) return clean;
  return clean.toLowerCase();
}
function splitColumns2(columns) {
  return String(columns || "*").split(",").map((c) => normalizeColumn2(c.trim())).filter(Boolean);
}
function parseOrExpr2(expr) {
  const source = String(expr || "");
  const parts = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    if (ch === ")" && depth > 0) depth -= 1;
    if (ch === "," && depth === 0) {
      const piece = current.trim();
      if (piece) parts.push(piece);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) parts.push(tail);
  return parts;
}
function parseInList2(raw) {
  const trimmed = String(raw || "").trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((x) => x.trim()).filter(Boolean);
}
var knownColumns, baseReady, LocalMasterleadBuilder, masterleadClient;
var init_local_masterlead_client = __esm({
  "server/local-masterlead-client.ts"() {
    "use strict";
    init_db();
    knownColumns = /* @__PURE__ */ new Set();
    baseReady = false;
    LocalMasterleadBuilder = class {
      mode = "select";
      selectColumns = "*";
      selectHead = false;
      selectCount = null;
      filters = [];
      orderBys = [];
      limitValue = null;
      offsetValue = null;
      singleType = null;
      updatePayload = null;
      insertPayload = [];
      upsertConflict = "id";
      upsertIgnoreDuplicates = false;
      referencedColumns = /* @__PURE__ */ new Set();
      addFilter(sql3, ...params) {
        this.filters.push({ sql: sql3, params });
        return this;
      }
      whereClause(startIndex = 1) {
        const values = [];
        let idx = startIndex;
        const parts = this.filters.map((f) => {
          const sql3 = f.sql.replace(/\?/g, () => `$${idx++}`);
          values.push(...f.params);
          return `(${sql3})`;
        });
        return {
          sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
          values,
          nextIndex: idx
        };
      }
      select(columns = "*", options) {
        this.mode = this.mode === "update" || this.mode === "insert" || this.mode === "upsert" || this.mode === "delete" ? this.mode : "select";
        this.selectColumns = columns || "*";
        if (this.selectColumns !== "*") {
          splitColumns2(this.selectColumns).forEach((c) => this.referencedColumns.add(c));
        }
        this.selectCount = options?.count || null;
        this.selectHead = !!options?.head;
        return this;
      }
      eq(column, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE("${col}"::text, '') = COALESCE(?::text, '')`, value);
      }
      neq(column, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE("${col}"::text, '') <> COALESCE(?::text, '')`, value);
      }
      gte(column, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE("${col}"::text, '') >= COALESCE(?::text, '')`, value);
      }
      gt(column, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE("${col}"::text, '') > COALESCE(?::text, '')`, value);
      }
      lte(column, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE("${col}"::text, '') <= COALESCE(?::text, '')`, value);
      }
      lt(column, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE("${col}"::text, '') < COALESCE(?::text, '')`, value);
      }
      ilike(column, pattern) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        return this.addFilter(`COALESCE("${col}"::text, '') ILIKE COALESCE(?::text, '')`, pattern);
      }
      in(column, values) {
        if (!Array.isArray(values) || !values.length) return this.addFilter("1=0");
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        const placeholders2 = values.map(() => "?").join(", ");
        return this.addFilter(`COALESCE("${col}"::text, '') IN (${placeholders2})`, ...values.map((v) => String(v ?? "")));
      }
      is(column, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        if (value === null || String(value).toLowerCase() === "null") {
          return this.addFilter(`"${col}" IS NULL`);
        }
        if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE("${col}"::text, '')) = 'true'`);
        if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE("${col}"::text, '')) = 'false'`);
        return this.addFilter(`"${col}" IS NOT DISTINCT FROM ?`, value);
      }
      not(column, operator, value) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        const op = String(operator || "").toLowerCase();
        if (op === "is") {
          if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`"${col}" IS NOT NULL`);
          if (String(value).toLowerCase() === "true") return this.addFilter(`"${col}" IS NOT TRUE`);
          if (String(value).toLowerCase() === "false") return this.addFilter(`"${col}" IS NOT FALSE`);
        }
        if (op === "in") {
          const items = parseInList2(String(value || ""));
          if (!items.length) return this;
          const placeholders2 = items.map(() => "?").join(", ");
          return this.addFilter(`COALESCE("${col}"::text, '') NOT IN (${placeholders2})`, ...items);
        }
        return this.addFilter(`NOT (COALESCE("${col}"::text, '') = COALESCE(?::text, ''))`, value);
      }
      or(expr) {
        const parts = parseOrExpr2(expr);
        if (!parts.length) return this;
        const sqlParts = [];
        const vals = [];
        for (const part of parts) {
          const segs = part.split(".");
          const col = normalizeColumn2(segs[0] || "");
          this.referencedColumns.add(col);
          const op = String(segs[1] || "eq").toLowerCase();
          const raw = segs.slice(2).join(".");
          const value = raw === "null" ? null : raw;
          if (!col) continue;
          if (op === "eq") {
            sqlParts.push(`COALESCE("${col}"::text, '') = COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "ilike") {
            sqlParts.push(`COALESCE("${col}"::text, '') ILIKE COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "is") {
            if (value === null) sqlParts.push(`"${col}" IS NULL`);
            else if (String(value).toLowerCase() === "true") sqlParts.push(`"${col}" IS TRUE`);
            else if (String(value).toLowerCase() === "false") sqlParts.push(`"${col}" IS FALSE`);
          } else if (op === "neq") {
            sqlParts.push(`COALESCE("${col}"::text, '') <> COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "in") {
            const items = parseInList2(String(value || ""));
            if (!items.length) continue;
            const placeholders2 = items.map(() => "?").join(", ");
            sqlParts.push(`COALESCE("${col}"::text, '') IN (${placeholders2})`);
            vals.push(...items);
          } else if (op === "gt") {
            sqlParts.push(`COALESCE("${col}"::text, '') > COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "gte") {
            sqlParts.push(`COALESCE("${col}"::text, '') >= COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "lt") {
            sqlParts.push(`COALESCE("${col}"::text, '') < COALESCE(?::text, '')`);
            vals.push(value);
          } else if (op === "lte") {
            sqlParts.push(`COALESCE("${col}"::text, '') <= COALESCE(?::text, '')`);
            vals.push(value);
          }
        }
        if (!sqlParts.length) return this;
        return this.addFilter(sqlParts.join(" OR "), ...vals);
      }
      order(column, options) {
        const col = normalizeColumn2(column);
        this.referencedColumns.add(col);
        this.orderBys.push({ column: col, ascending: options?.ascending !== false });
        return this;
      }
      limit(count) {
        this.limitValue = Math.max(0, Number(count || 0));
        return this;
      }
      range(from, to) {
        const start = Math.max(0, Number(from || 0));
        const end = Math.max(start, Number(to || start));
        this.offsetValue = start;
        this.limitValue = end - start + 1;
        return this;
      }
      single() {
        this.singleType = "single";
        return this.execute();
      }
      maybeSingle() {
        this.singleType = "maybeSingle";
        return this.execute();
      }
      update(payload) {
        this.mode = "update";
        this.updatePayload = payload || {};
        Object.keys(this.updatePayload).forEach((k) => this.referencedColumns.add(normalizeColumn2(k)));
        return this;
      }
      insert(payload) {
        this.mode = "insert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn2(k))));
        return this;
      }
      upsert(payload, options) {
        this.mode = "upsert";
        this.insertPayload = Array.isArray(payload) ? payload : [payload];
        this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn2(k))));
        this.upsertConflict = normalizeColumn2(options?.onConflict || "id");
        this.referencedColumns.add(this.upsertConflict);
        this.upsertIgnoreDuplicates = !!options?.ignoreDuplicates;
        return this;
      }
      delete() {
        this.mode = "delete";
        return this;
      }
      then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
      }
      async executeSelect() {
        await ensureColumns2([...this.referencedColumns]);
        const cols = this.selectColumns === "*" ? "*" : splitColumns2(this.selectColumns).map((c) => `"${c}"`).join(", ");
        const where = this.whereClause(1);
        const order = this.orderBys.length ? ` ORDER BY ${this.orderBys.map((o) => `"${o.column}" ${o.ascending ? "ASC" : "DESC"}`).join(", ")}` : "";
        const limit = this.limitValue != null ? ` LIMIT ${this.limitValue}` : "";
        const offset = this.offsetValue != null ? ` OFFSET ${this.offsetValue}` : "";
        let count = null;
        if (this.selectCount === "exact") {
          const c = await pool.query(
            `SELECT COUNT(*)::text AS count FROM masterlead${where.sql}`,
            where.values
          );
          count = Number(c.rows[0]?.count || 0);
        }
        if (this.selectHead) {
          return { data: null, error: null, count };
        }
        const result = await pool.query(
          `SELECT ${cols} FROM masterlead${where.sql}${order}${limit}${offset}`,
          where.values
        );
        if (this.singleType === "single") {
          if ((result.rowCount || 0) !== 1) {
            return { data: null, error: { message: "Expected single row" }, count };
          }
          return { data: result.rows[0], error: null, count };
        }
        if (this.singleType === "maybeSingle") {
          return { data: result.rows[0] || null, error: null, count };
        }
        return { data: result.rows, error: null, count };
      }
      buildInsertRows() {
        const rows = this.insertPayload.filter(Boolean);
        const columnSet = /* @__PURE__ */ new Set();
        for (const row of rows) {
          Object.keys(row).forEach((k) => columnSet.add(normalizeColumn2(k)));
        }
        const columns = [...columnSet];
        const values = rows.map((row) => columns.map((c) => row[c]));
        return { columns, rows: values };
      }
      async executeUpdateLike() {
        await ensureColumns2([...this.referencedColumns]);
        if (!this.updatePayload) return { data: null, error: { message: "Missing update payload" }, count: null };
        const entries = Object.entries(this.updatePayload);
        if (!entries.length) return { data: null, error: null, count: 0 };
        const setSql = entries.map(([k], i) => `"${normalizeColumn2(k)}" = $${i + 1}`).join(", ");
        const setVals = entries.map(([, v]) => v);
        const where = this.whereClause(setVals.length + 1);
        const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns2(this.selectColumns).map((c) => `"${c}"`).join(", ") : "*";
        const wantsData = this.selectColumns !== "*";
        const sql3 = `UPDATE masterlead SET ${setSql}${where.sql}${wantsData ? ` RETURNING ${returning}` : ""}`;
        const result = await pool.query(sql3, [...setVals, ...where.values]);
        return { data: wantsData ? result.rows : null, error: null, count: result.rowCount || 0 };
      }
      async executeInsertLike() {
        await ensureColumns2([...this.referencedColumns]);
        const { columns, rows } = this.buildInsertRows();
        if (!columns.length || !rows.length) return { data: null, error: null, count: 0 };
        const values = [];
        let idx = 1;
        const rowSql = rows.map((row) => {
          const ph = row.map(() => `$${idx++}`);
          values.push(...row);
          return `(${ph.join(", ")})`;
        }).join(", ");
        const quotedCols = columns.map((c) => `"${c}"`).join(", ");
        let conflictSql = "";
        if (this.mode === "upsert") {
          if (this.upsertIgnoreDuplicates) {
            conflictSql = ` ON CONFLICT ("${this.upsertConflict}") DO NOTHING`;
          } else {
            const updates = columns.filter((c) => c !== this.upsertConflict).map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
            conflictSql = ` ON CONFLICT ("${this.upsertConflict}") DO UPDATE SET ${updates || `"${this.upsertConflict}" = EXCLUDED."${this.upsertConflict}"`}`;
          }
        }
        const returning = this.selectColumns && this.selectColumns !== "*" ? splitColumns2(this.selectColumns).map((c) => `"${c}"`).join(", ") : "*";
        const wantsData = this.selectColumns !== "*";
        const sql3 = `INSERT INTO masterlead (${quotedCols}) VALUES ${rowSql}${conflictSql}${wantsData ? ` RETURNING ${returning}` : ""}`;
        const result = await pool.query(sql3, values);
        const data = wantsData ? this.singleType ? result.rows[0] || null : result.rows : null;
        return { data, error: null, count: result.rowCount || 0 };
      }
      async executeDelete() {
        await ensureColumns2([...this.referencedColumns]);
        const where = this.whereClause(1);
        const sql3 = `DELETE FROM masterlead${where.sql}`;
        const result = await pool.query(sql3, where.values);
        return { data: null, error: null, count: result.rowCount || 0 };
      }
      async execute() {
        try {
          if (this.mode === "select") return await this.executeSelect();
          if (this.mode === "update") return await this.executeUpdateLike();
          if (this.mode === "insert" || this.mode === "upsert") return await this.executeInsertLike();
          if (this.mode === "delete") return await this.executeDelete();
          return { data: null, error: null, count: 0 };
        } catch (error) {
          return { data: null, error: { message: error?.message || String(error) }, count: null };
        }
      }
    };
    masterleadClient = {
      from(table) {
        if (String(table || "").toLowerCase() !== "masterlead") {
          throw new Error("masterleadClient only supports the masterlead table");
        }
        return new LocalMasterleadBuilder();
      }
    };
  }
});

// server/queue/post-call-queue.ts
function scheduleDrain() {
  if (drainScheduled) return;
  drainScheduled = true;
  setImmediate(drain);
}
async function drain() {
  drainScheduled = false;
  while (queue.length > 0 && activeWorkers < MAX_CONCURRENCY) {
    const job = queue.shift();
    activeWorkers++;
    runJob(job).finally(() => {
      activeWorkers--;
      scheduleDrain();
    });
  }
}
async function runJob(job) {
  const handler = handlers.get(job.type);
  if (!handler) {
    console.error(`[POST_CALL_QUEUE] No handler for job type: ${job.type}`);
    return;
  }
  try {
    await handler(job.payload);
  } catch (err) {
    const attempts = (job.attemptsMade || 0) + 1;
    if (attempts < MAX_RETRIES) {
      console.warn(`[POST_CALL_QUEUE] Job ${job.type} failed (attempt ${attempts}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms:`, err?.message);
      setTimeout(() => {
        queue.push({ ...job, attemptsMade: attempts });
        scheduleDrain();
      }, RETRY_DELAY_MS * attempts);
    } else {
      console.error(`[POST_CALL_QUEUE] Job ${job.type} failed after ${MAX_RETRIES} attempts \u2014 dropping:`, err?.message, job.payload);
    }
  }
}
function registerQueueHandler(type, handler) {
  handlers.set(type, handler);
}
function enqueuePostCallJob(type, payload) {
  if (queue.length >= MAX_QUEUE_SIZE) {
    console.error(`[POST_CALL_QUEUE] Queue full (${MAX_QUEUE_SIZE}) \u2014 dropping job: ${type}`);
    return false;
  }
  queue.push({ type, payload, attemptsMade: 0, createdAt: Date.now() });
  scheduleDrain();
  return true;
}
var MAX_CONCURRENCY, MAX_QUEUE_SIZE, MAX_RETRIES, RETRY_DELAY_MS, activeWorkers, queue, handlers, drainScheduled;
var init_post_call_queue = __esm({
  "server/queue/post-call-queue.ts"() {
    "use strict";
    MAX_CONCURRENCY = Number(process.env.POST_CALL_QUEUE_CONCURRENCY || 5);
    MAX_QUEUE_SIZE = Number(process.env.POST_CALL_QUEUE_MAX || 2e3);
    MAX_RETRIES = 3;
    RETRY_DELAY_MS = 2e3;
    activeWorkers = 0;
    queue = [];
    handlers = /* @__PURE__ */ new Map();
    drainScheduled = false;
  }
});

// server/local-presence-service.ts
var local_presence_service_exports = {};
__export(local_presence_service_exports, {
  LocalPresenceService: () => LocalPresenceService,
  localPresenceService: () => localPresenceService
});
import twilio3 from "twilio";
var LocalPresenceService, localPresenceService;
var init_local_presence_service = __esm({
  "server/local-presence-service.ts"() {
    "use strict";
    init_hardcoded_config();
    LocalPresenceService = class {
      client = null;
      availableNumbers = /* @__PURE__ */ new Map();
      areaCodeNumbers = /* @__PURE__ */ new Map();
      selectionCursor = /* @__PURE__ */ new Map();
      initialized = false;
      constructor() {
        const accountSid = TWILIO_ACCOUNT_SID;
        const apiKey = TWILIO_API_KEY;
        const apiSecret = TWILIO_API_SECRET;
        if (!accountSid || !apiKey || !apiSecret) {
          console.warn("\u26A0\uFE0F Missing Twilio API credentials for local presence service");
          return;
        }
        this.client = twilio3(apiKey, apiSecret, { accountSid });
      }
      // Initialize by fetching all available Twilio numbers
      async initialize() {
        if (this.initialized || !this.client) {
          console.log("\u{1F504} Local Presence Service already initialized or no client available");
          return;
        }
        try {
          console.log("\u{1F50D} Initializing Local Presence Service in background...");
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Initialization timeout")), 12e4);
          });
          const initPromise = async () => {
            console.log("\u{1F4DE} Fetching ALL Twilio phone numbers (no limit)...");
            const incomingPhoneNumbers = await this.client.incomingPhoneNumbers.list();
            console.log(`\u{1F4DE} Found ${incomingPhoneNumbers.length} TOTAL Twilio numbers`);
            if (incomingPhoneNumbers.length === 0) {
              console.warn("\u26A0\uFE0F No phone numbers found in Twilio account");
              return;
            }
            this.availableNumbers.clear();
            this.areaCodeNumbers.clear();
            this.selectionCursor.clear();
            let processedCount = 0;
            for (const number of incomingPhoneNumbers) {
              const phoneNumber = number.phoneNumber;
              const state = this.extractStateFromNumber(phoneNumber, "Unknown");
              if (state) {
                if (!this.availableNumbers.has(state)) {
                  this.availableNumbers.set(state, []);
                }
                this.availableNumbers.get(state).push(phoneNumber);
                processedCount++;
              }
              const areaCode = this.extractAreaCode(phoneNumber);
              if (areaCode) {
                if (!this.areaCodeNumbers.has(areaCode)) {
                  this.areaCodeNumbers.set(areaCode, []);
                }
                this.areaCodeNumbers.get(areaCode).push(phoneNumber);
              }
            }
            console.log(`\u2705 Local presence initialized with ${processedCount} numbers across ${this.availableNumbers.size} states`);
            console.log(`\u{1F4CA} Numbers per state: ${Array.from(this.availableNumbers.entries()).map(([state, nums]) => `${state}:${nums.length}`).join(", ")}`);
            this.initialized = true;
          };
          await Promise.race([initPromise(), timeoutPromise]);
        } catch (error) {
          console.error("\u274C PRODUCTION ERROR: Failed to initialize local presence service:", error);
          console.error("\u274C PRODUCTION ERROR: Twilio credentials check:", {
            hasAccountSid: !!TWILIO_ACCOUNT_SID,
            hasAuthToken: !!TWILIO_AUTH_TOKEN,
            clientInitialized: !!this.client
          });
        }
      }
      // Get best local number for a lead's state
      getLocalNumber(leadState, excludeNumber) {
        console.log(`\u{1F50D} LOCAL PRESENCE CHECK: leadState=${leadState}, initialized=${this.initialized}, availableStates=${this.availableNumbers.size}, excludeNumber=${excludeNumber}`);
        if (!this.initialized) {
          console.warn("\u26A0\uFE0F Local presence service not initialized, using default number");
          return "+19142289324";
        }
        const leadAreaCode = this.extractAreaCode(excludeNumber || "");
        if (leadAreaCode) {
          const areaCodePool = this.areaCodeNumbers.get(leadAreaCode) || [];
          const areaSelected = this.selectNumber(areaCodePool, `ac:${leadAreaCode}`, excludeNumber);
          if (areaSelected) {
            console.log(`\u{1F3AF} Selected exact area-code number ${areaSelected} for area code ${leadAreaCode}`);
            return areaSelected;
          }
        }
        const stateNumbers = this.availableNumbers.get(leadState.toUpperCase());
        if (stateNumbers && stateNumbers.length > 0) {
          console.log(`\u{1F4CD} Found ${stateNumbers.length} ${leadState} numbers: ${stateNumbers.join(", ")}`);
          const selectedNumber = this.selectNumber(stateNumbers, `st:${leadState.toUpperCase()}`, excludeNumber);
          if (selectedNumber) {
            console.log(`\u{1F3AF} Selected local number ${selectedNumber} for ${leadState} lead (excluded ${excludeNumber})`);
            return selectedNumber;
          } else {
            console.log(`\u26A0\uFE0F All ${leadState} numbers excluded, trying nearby states`);
          }
        } else {
          console.log(`\u274C NO NUMBERS FOUND for state ${leadState}! Available states: ${Array.from(this.availableNumbers.keys()).join(", ")}`);
        }
        const nearbyStates = this.getNearbyStates(leadState);
        for (const nearbyState of nearbyStates) {
          const nearbyNumbers = this.availableNumbers.get(nearbyState);
          if (nearbyNumbers && nearbyNumbers.length > 0) {
            const selectedNumber = this.selectNumber(nearbyNumbers, `nearby:${nearbyState}`, excludeNumber);
            if (selectedNumber) {
              console.log(`\u{1F3AF} Selected nearby number ${selectedNumber} (${nearbyState}) for ${leadState} lead`);
              return selectedNumber;
            } else {
              console.log(`\u26A0\uFE0F All ${nearbyState} nearby numbers excluded, trying next state`);
            }
          }
        }
        const allNumbers = Array.from(this.availableNumbers.values()).flat();
        const anySelected = this.selectNumber(allNumbers, "pool:any", excludeNumber);
        if (anySelected) {
          console.log(`\u{1F3AF} Selected pooled number ${anySelected} for ${leadState} lead`);
          return anySelected;
        }
        const defaultNumber = "+19142289324";
        console.log(`\u{1F4DE} Using default number ${defaultNumber} for ${leadState} lead (no local presence available)`);
        return defaultNumber;
      }
      extractAreaCode(phoneNumber) {
        const digits = String(phoneNumber || "").replace(/\D/g, "");
        if (digits.length >= 10) {
          return digits.slice(-10, -7);
        }
        return null;
      }
      normalizeTenDigits(phoneNumber) {
        let digits = String(phoneNumber || "").replace(/\D/g, "");
        if (digits.length === 11 && digits.startsWith("1")) {
          digits = digits.substring(1);
        }
        return digits.slice(-10);
      }
      selectNumber(numbers, key, excludeNumber) {
        if (!Array.isArray(numbers) || numbers.length === 0) return null;
        const cleanExclude = this.normalizeTenDigits(excludeNumber || "");
        const filtered = numbers.filter((num) => {
          const cleanNum = this.normalizeTenDigits(num);
          const isExcluded = !!cleanExclude && cleanNum === cleanExclude;
          if (isExcluded) {
            console.log(`\u{1F6AB} Excluding candidate ${num} - matches lead ${excludeNumber}`);
          }
          return !isExcluded;
        });
        if (filtered.length === 0) return null;
        const cursor = this.selectionCursor.get(key) || 0;
        const idx = cursor % filtered.length;
        const selected = filtered[idx];
        this.selectionCursor.set(key, (cursor + 1) % filtered.length);
        return selected;
      }
      // Extract state from phone number area code and region info
      extractStateFromNumber(phoneNumber, region) {
        const areaCodeToState = {
          // California
          "209": "CA",
          "213": "CA",
          "310": "CA",
          "323": "CA",
          "408": "CA",
          "415": "CA",
          "424": "CA",
          "442": "CA",
          "510": "CA",
          "530": "CA",
          "559": "CA",
          "562": "CA",
          "619": "CA",
          "626": "CA",
          "628": "CA",
          "650": "CA",
          "657": "CA",
          "661": "CA",
          "669": "CA",
          "707": "CA",
          "714": "CA",
          "747": "CA",
          "760": "CA",
          "764": "CA",
          "805": "CA",
          "818": "CA",
          "820": "CA",
          "831": "CA",
          "840": "CA",
          "858": "CA",
          "909": "CA",
          "916": "CA",
          "925": "CA",
          "949": "CA",
          "951": "CA",
          // Texas
          "214": "TX",
          "254": "TX",
          "281": "TX",
          "361": "TX",
          "409": "TX",
          "430": "TX",
          "432": "TX",
          "469": "TX",
          "512": "TX",
          "713": "TX",
          "726": "TX",
          "737": "TX",
          "806": "TX",
          "817": "TX",
          "830": "TX",
          "832": "TX",
          "903": "TX",
          "915": "TX",
          "936": "TX",
          "940": "TX",
          "945": "TX",
          "956": "TX",
          "972": "TX",
          "979": "TX",
          // Florida
          "239": "FL",
          "305": "FL",
          "321": "FL",
          "352": "FL",
          "386": "FL",
          "407": "FL",
          "561": "FL",
          "689": "FL",
          "727": "FL",
          "754": "FL",
          "772": "FL",
          "786": "FL",
          "813": "FL",
          "850": "FL",
          "863": "FL",
          "904": "FL",
          "941": "FL",
          "954": "FL",
          // New York
          "212": "NY",
          "315": "NY",
          "347": "NY",
          "516": "NY",
          "518": "NY",
          "585": "NY",
          "607": "NY",
          "631": "NY",
          "646": "NY",
          "680": "NY",
          "716": "NY",
          "718": "NY",
          "845": "NY",
          "914": "NY",
          "917": "NY",
          "929": "NY",
          // Illinois
          "217": "IL",
          "224": "IL",
          "309": "IL",
          "312": "IL",
          "331": "IL",
          "618": "IL",
          "630": "IL",
          "708": "IL",
          "773": "IL",
          "779": "IL",
          "815": "IL",
          "847": "IL",
          "872": "IL",
          // Pennsylvania
          "215": "PA",
          "267": "PA",
          "272": "PA",
          "412": "PA",
          "484": "PA",
          "570": "PA",
          "610": "PA",
          "717": "PA",
          "724": "PA",
          "814": "PA",
          "878": "PA",
          // Ohio
          "216": "OH",
          "220": "OH",
          "234": "OH",
          "330": "OH",
          "380": "OH",
          "419": "OH",
          "440": "OH",
          "513": "OH",
          "567": "OH",
          "614": "OH",
          "740": "OH",
          "937": "OH",
          // Michigan
          "231": "MI",
          "248": "MI",
          "269": "MI",
          "313": "MI",
          "517": "MI",
          "586": "MI",
          "616": "MI",
          "679": "MI",
          "734": "MI",
          "810": "MI",
          "906": "MI",
          "947": "MI",
          // Georgia
          "229": "GA",
          "404": "GA",
          "470": "GA",
          "478": "GA",
          "678": "GA",
          "706": "GA",
          "762": "GA",
          "770": "GA",
          "912": "GA",
          // North Carolina
          "252": "NC",
          "336": "NC",
          "704": "NC",
          "743": "NC",
          "828": "NC",
          "910": "NC",
          "919": "NC",
          "980": "NC",
          "984": "NC",
          // New Jersey
          "201": "NJ",
          "551": "NJ",
          "609": "NJ",
          "732": "NJ",
          "848": "NJ",
          "856": "NJ",
          "862": "NJ",
          "908": "NJ",
          "973": "NJ",
          // Virginia
          "276": "VA",
          "434": "VA",
          "540": "VA",
          "571": "VA",
          "703": "VA",
          "757": "VA",
          "804": "VA",
          // Washington
          "206": "WA",
          "253": "WA",
          "360": "WA",
          "425": "WA",
          "509": "WA",
          "564": "WA",
          // Massachusetts
          "339": "MA",
          "351": "MA",
          "413": "MA",
          "508": "MA",
          "617": "MA",
          "774": "MA",
          "781": "MA",
          "857": "MA",
          "978": "MA",
          // Tennessee
          "423": "TN",
          "615": "TN",
          "629": "TN",
          "731": "TN",
          "865": "TN",
          "901": "TN",
          "931": "TN",
          // Indiana
          "219": "IN",
          "260": "IN",
          "317": "IN",
          "463": "IN",
          "574": "IN",
          "765": "IN",
          "812": "IN",
          "930": "IN",
          // Arizona
          "480": "AZ",
          "520": "AZ",
          "602": "AZ",
          "623": "AZ",
          "928": "AZ",
          // Missouri
          "314": "MO",
          "417": "MO",
          "573": "MO",
          "636": "MO",
          "660": "MO",
          "816": "MO",
          // Maryland
          "240": "MD",
          "301": "MD",
          "410": "MD",
          "443": "MD",
          "667": "MD",
          // Wisconsin
          "262": "WI",
          "414": "WI",
          "534": "WI",
          "608": "WI",
          "715": "WI",
          "920": "WI",
          // Minnesota
          "218": "MN",
          "320": "MN",
          "507": "MN",
          "612": "MN",
          "651": "MN",
          "763": "MN",
          "952": "MN",
          // Colorado
          "303": "CO",
          "719": "CO",
          "720": "CO",
          "970": "CO",
          // Alabama
          "205": "AL",
          "251": "AL",
          "256": "AL",
          "334": "AL",
          "659": "AL",
          "938": "AL",
          // Louisiana
          "225": "LA",
          "318": "LA",
          "337": "LA",
          "504": "LA",
          "985": "LA",
          // Kentucky
          "270": "KY",
          "364": "KY",
          "502": "KY",
          "606": "KY",
          "859": "KY",
          // Oregon
          "458": "OR",
          "503": "OR",
          "541": "OR",
          "971": "OR",
          // Oklahoma
          "405": "OK",
          "539": "OK",
          "580": "OK",
          "918": "OK",
          // Connecticut
          "203": "CT",
          "475": "CT",
          "860": "CT",
          "959": "CT",
          // Iowa
          "319": "IA",
          "515": "IA",
          "563": "IA",
          "641": "IA",
          "712": "IA",
          // Arkansas
          "479": "AR",
          "501": "AR",
          "870": "AR",
          // Mississippi
          "228": "MS",
          "601": "MS",
          "662": "MS",
          "769": "MS",
          // Kansas
          "316": "KS",
          "620": "KS",
          "785": "KS",
          "913": "KS",
          // Utah
          "385": "UT",
          "435": "UT",
          "801": "UT",
          // Nevada
          "702": "NV",
          "725": "NV",
          "775": "NV",
          // New Mexico
          "505": "NM",
          "575": "NM",
          // Nebraska
          "308": "NE",
          "402": "NE",
          "531": "NE",
          // West Virginia
          "304": "WV",
          "681": "WV",
          // Idaho
          "208": "ID",
          "986": "ID",
          // Hawaii
          "808": "HI",
          // Maine
          "207": "ME",
          // New Hampshire
          "603": "NH",
          // Vermont
          "802": "VT",
          // Rhode Island
          "401": "RI",
          // Montana
          "406": "MT",
          // Delaware
          "302": "DE",
          // South Dakota
          "605": "SD",
          // North Dakota
          "701": "ND",
          // Alaska
          "907": "AK",
          // Wyoming
          "307": "WY",
          // District of Columbia
          "202": "DC"
        };
        const areaCodeMatch = phoneNumber.match(/\+1(\d{3})/);
        if (areaCodeMatch) {
          const areaCode = areaCodeMatch[1];
          const state = areaCodeToState[areaCode];
          if (state) {
            return state;
          }
        }
        const regionUpper = region.toUpperCase();
        const stateAbbreviations = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"];
        for (const state of stateAbbreviations) {
          if (regionUpper.includes(state)) {
            return state;
          }
        }
        return null;
      }
      // Get nearby states for fallback
      getNearbyStates(state) {
        const stateRegions = {
          // West Coast
          "CA": ["NV", "AZ", "OR", "WA"],
          "OR": ["CA", "WA", "ID", "NV"],
          "WA": ["OR", "ID", "CA"],
          // Southwest
          "AZ": ["CA", "NV", "UT", "CO", "NM", "TX"],
          "NV": ["CA", "AZ", "UT", "ID", "OR"],
          "UT": ["AZ", "CO", "NV", "ID", "WY"],
          "NM": ["AZ", "CO", "TX", "OK"],
          // Texas
          "TX": ["OK", "AR", "LA", "NM"],
          // Southeast
          "FL": ["GA", "AL"],
          "GA": ["FL", "AL", "TN", "NC", "SC"],
          "AL": ["GA", "FL", "TN", "MS"],
          "SC": ["NC", "GA"],
          "NC": ["SC", "GA", "TN", "VA"],
          "TN": ["GA", "AL", "MS", "AR", "MO", "KY", "VA", "NC"],
          // Northeast
          "NY": ["NJ", "CT", "PA", "VT", "MA"],
          "NJ": ["NY", "PA", "DE"],
          "PA": ["NY", "NJ", "DE", "MD", "WV", "OH"],
          "CT": ["NY", "MA", "RI"],
          "MA": ["CT", "RI", "VT", "NH", "NY"],
          // Midwest
          "IL": ["IN", "WI", "IA", "MO"],
          "IN": ["IL", "OH", "MI", "KY"],
          "OH": ["PA", "WV", "KY", "IN", "MI"],
          "MI": ["OH", "IN", "WI"],
          "WI": ["MI", "IL", "IA", "MN"],
          "MN": ["WI", "IA", "SD", "ND"],
          "IA": ["MN", "WI", "IL", "MO", "SD", "NE"],
          "MO": ["IA", "IL", "KY", "TN", "AR", "OK", "KS", "NE"],
          // Mountain
          "CO": ["NM", "OK", "KS", "NE", "WY", "UT"],
          "WY": ["CO", "NE", "SD", "MT", "ID", "UT"],
          "MT": ["WY", "SD", "ND", "ID"],
          "ID": ["MT", "WY", "UT", "NV", "OR", "WA"],
          // Plains
          "KS": ["CO", "OK", "MO", "NE"],
          "NE": ["KS", "MO", "IA", "SD", "WY", "CO"],
          "SD": ["NE", "IA", "MN", "ND", "WY", "MT"],
          "ND": ["SD", "MN", "MT"],
          // South
          "LA": ["TX", "AR", "MS"],
          "AR": ["LA", "TX", "OK", "MO", "TN", "MS"],
          "MS": ["LA", "AR", "TN", "AL"],
          "KY": ["TN", "VA", "WV", "OH", "IN", "IL", "MO"],
          "WV": ["PA", "MD", "VA", "KY", "OH"],
          "VA": ["WV", "MD", "DC", "NC", "TN", "KY"],
          "MD": ["PA", "WV", "VA", "DC", "DE"],
          "DE": ["MD", "PA", "NJ"],
          "DC": ["MD", "VA"],
          // New England
          "VT": ["NH", "MA", "NY"],
          "NH": ["VT", "MA", "ME"],
          "ME": ["NH"],
          "RI": ["CT", "MA"],
          // Alaska and Hawaii (isolated)
          "AK": ["WA"],
          // Closest mainland state
          "HI": ["CA"]
          // Closest mainland state
        };
        return stateRegions[state.toUpperCase()] || [];
      }
      // Get available states
      getAvailableStates() {
        return Array.from(this.availableNumbers.keys());
      }
      // Get number count for a state
      getStateNumberCount(state) {
        const numbers = this.availableNumbers.get(state.toUpperCase());
        return numbers ? numbers.length : 0;
      }
      // Get initialization status
      isInitialized() {
        return this.initialized;
      }
      // Force re-initialization (for production debugging)
      async forceReinitialize() {
        console.log("\u{1F504} PRODUCTION: Force re-initializing local presence service...");
        this.initialized = false;
        this.availableNumbers.clear();
        await this.initialize();
      }
      // Get diagnostic info for production debugging
      getDiagnosticInfo() {
        return {
          initialized: this.initialized,
          hasClient: !!this.client,
          stateCount: this.availableNumbers.size,
          areaCodeCount: this.areaCodeNumbers.size,
          availableStates: this.getAvailableStates(),
          sampleNumbers: Array.from(this.availableNumbers.entries()).slice(0, 5).map(([state, numbers]) => ({
            state,
            count: numbers.length,
            sample: numbers[0]
          }))
        };
      }
    };
    localPresenceService = new LocalPresenceService();
  }
});

// server/connect-test-routes.ts
var connect_test_routes_exports = {};
__export(connect_test_routes_exports, {
  handleAgentConferenceJoin: () => handleAgentConferenceJoin,
  registerConnectTestRoutes: () => registerConnectTestRoutes
});
function getConnectSession(agentId, sessionId) {
  const key = `${agentId}:${sessionId}`;
  if (!connectSessions.has(key)) {
    connectSessions.set(key, {
      agentId,
      sessionId,
      conferenceName: `connect-${sessionId}`,
      conferenceSid: null,
      agentCallSid: null,
      activeLeadCallSid: null,
      leadCallStatus: "idle",
      agentStatus: "offline",
      lastEvent: null,
      events: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  return connectSessions.get(key);
}
function addEvent(session2, eventName, payload) {
  session2.lastEvent = eventName;
  session2.events.push({ at: (/* @__PURE__ */ new Date()).toISOString(), eventName, payload });
  if (session2.events.length > 100) session2.events = session2.events.slice(-100);
  session2.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  console.log("[CONNECT_TEST]", eventName, payload);
}
function handleAgentConferenceJoin(agentId, sessionId, callSid) {
  const session2 = getConnectSession(agentId, sessionId);
  session2.agentCallSid = callSid;
  session2.agentStatus = "connecting";
  addEvent(session2, "AGENT_VOICE_WEBHOOK", { callSid });
}
function normalizeToE164(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+1${digits}`;
}
function registerConnectTestRoutes(app2, twilioClient2, BASE_URL) {
  app2.post("/api/connect/dial", async (req, res) => {
    try {
      let { agentId, sessionId, phoneNumber } = req.body;
      if (!phoneNumber) phoneNumber = "+15032018470";
      if (!agentId || !sessionId) return res.status(400).json({ ok: false, error: "agentId and sessionId required" });
      const toNumber = normalizeToE164(phoneNumber);
      if (!toNumber.match(/^\+1?\d{10,14}$/)) {
        return res.status(400).json({ ok: false, error: `Invalid phone number: ${phoneNumber} -> ${toNumber}` });
      }
      const session2 = getConnectSession(agentId, sessionId);
      if (session2.activeLeadCallSid) {
        return res.status(409).json({ ok: false, error: "Lead call already active", callSid: session2.activeLeadCallSid });
      }
      const fallbackFrom = HARDCODED_CONFIG.TWILIO_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || "+19142289324";
      let fromNumber = fallbackFrom;
      try {
        const { localPresenceService: localPresenceService2 } = await Promise.resolve().then(() => (init_local_presence_service(), local_presence_service_exports));
        const areaCode = toNumber.replace(/\D/g, "").slice(1, 4);
        const areaCodeToState = {
          "503": "OR",
          "541": "OR",
          "971": "OR",
          "206": "WA",
          "253": "WA",
          "360": "WA",
          "425": "WA",
          "602": "AZ",
          "480": "AZ",
          "623": "AZ",
          "213": "CA",
          "310": "CA",
          "323": "CA",
          "415": "CA",
          "619": "CA",
          "714": "CA",
          "818": "CA",
          "612": "MN",
          "651": "MN",
          "763": "MN"
        };
        const leadState = areaCodeToState[areaCode] || "OR";
        const localNum = localPresenceService2.getLocalNumber(leadState, toNumber);
        if (localNum) fromNumber = localNum;
        console.log(`[CONNECT_TEST] local presence: areaCode=${areaCode} state=${leadState} from=${fromNumber}`);
      } catch (lpErr) {
        console.warn("[CONNECT_TEST] local presence unavailable, using default:", lpErr.message);
      }
      const effectiveBaseUrl = BASE_URL || HARDCODED_CONFIG.PRODUCTION_URL;
      const call = await twilioClient2.calls.create({
        to: toNumber,
        from: fromNumber,
        url: `${effectiveBaseUrl}/api/connect/lead-twiml?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}`,
        method: "POST",
        statusCallback: `${effectiveBaseUrl}/api/connect/call-status`,
        statusCallbackMethod: "POST",
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
      });
      session2.activeLeadCallSid = call.sid;
      session2.leadCallStatus = "dialing";
      addEvent(session2, "LEAD_CALL_CREATED", { callSid: call.sid, toNumber, fromNumber });
      return res.json({ ok: true, callSid: call.sid, conferenceName: session2.conferenceName, leadCallStatus: session2.leadCallStatus, fromNumber });
    } catch (err) {
      console.error("[CONNECT_TEST] dial error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
  app2.post("/api/connect/lead-twiml", (req, res) => {
    const agentId = String(req.query.agentId || req.body?.agentId || "");
    const sessionId = String(req.query.sessionId || req.body?.sessionId || "");
    const session2 = getConnectSession(agentId, sessionId);
    addEvent(session2, "LEAD_TWIML_REQUESTED", { agentId, sessionId });
    const effectiveBaseUrl = BASE_URL || HARDCODED_CONFIG.PRODUCTION_URL;
    res.set("Content-Type", "text/xml");
    res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Dial><Conference startConferenceOnEnter='true' endConferenceOnExit='false' beep='false' statusCallback='${effectiveBaseUrl}/api/connect/lead-conference-status' statusCallbackEvent='join leave' statusCallbackMethod='POST'>${session2.conferenceName}</Conference></Dial></Response>`);
  });
  app2.post("/api/connect/end", async (req, res) => {
    try {
      const { agentId, sessionId } = req.body;
      const session2 = getConnectSession(agentId, sessionId);
      if (!session2.activeLeadCallSid) {
        return res.json({ ok: true, message: "No active lead call" });
      }
      const callSid = session2.activeLeadCallSid;
      await twilioClient2.calls(callSid).update({ status: "completed" });
      addEvent(session2, "LEAD_CALL_END_REQUESTED", { callSid });
      session2.leadCallStatus = "completed";
      return res.json({ ok: true });
    } catch (err) {
      console.error("[CONNECT_TEST] end error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
  app2.post("/api/connect/power-off", async (req, res) => {
    try {
      const { agentId, sessionId } = req.body;
      const session2 = getConnectSession(agentId, sessionId);
      if (session2.activeLeadCallSid) {
        try {
          await twilioClient2.calls(session2.activeLeadCallSid).update({ status: "completed" });
        } catch (e) {
          console.warn("[CONNECT_TEST] could not end lead call:", e.message);
        }
      }
      if (session2.agentCallSid) {
        try {
          await twilioClient2.calls(session2.agentCallSid).update({ status: "completed" });
        } catch (e) {
          console.warn("[CONNECT_TEST] could not end agent call:", e.message);
        }
      }
      session2.agentStatus = "offline";
      session2.leadCallStatus = "idle";
      session2.activeLeadCallSid = null;
      session2.agentCallSid = null;
      addEvent(session2, "POWER_OFF", {});
      return res.json({ ok: true });
    } catch (err) {
      console.error("[CONNECT_TEST] power-off error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
  app2.get("/api/connect/status", (req, res) => {
    const agentId = String(req.query.agentId || "");
    const sessionId = String(req.query.sessionId || "");
    const session2 = getConnectSession(agentId, sessionId);
    return res.json({
      ok: true,
      agentId: session2.agentId,
      sessionId: session2.sessionId,
      conferenceName: session2.conferenceName,
      conferenceSid: session2.conferenceSid,
      agentCallSid: session2.agentCallSid,
      activeLeadCallSid: session2.activeLeadCallSid,
      agentStatus: session2.agentStatus,
      leadCallStatus: session2.leadCallStatus,
      lastEvent: session2.lastEvent,
      events: session2.events.slice(-20)
    });
  });
  app2.post("/api/connect/call-status", (req, res) => {
    const { CallSid, CallStatus, CallDuration } = req.body;
    let found = null;
    for (const session2 of connectSessions.values()) {
      if (session2.activeLeadCallSid === CallSid) {
        found = session2;
        break;
      }
    }
    if (!found) {
      console.log("[CONNECT_TEST] call-status: no matching session for", CallSid, CallStatus);
      return res.sendStatus(200);
    }
    const statusMap = {
      initiated: "dialing",
      ringing: "ringing",
      answered: "connected",
      "in-progress": "connected",
      completed: "completed",
      busy: "completed",
      "no-answer": "completed",
      canceled: "completed",
      failed: "failed"
    };
    const mapped = statusMap[CallStatus] || CallStatus;
    found.leadCallStatus = mapped;
    if (["completed", "failed"].includes(mapped)) found.activeLeadCallSid = null;
    addEvent(found, "CALL_STATUS_CALLBACK", { CallSid, CallStatus, CallDuration });
    return res.sendStatus(200);
  });
  app2.post("/api/connect/conference-status", (req, res) => {
    const { ConferenceSid, ConferenceStatusCallbackEvent, FriendlyName, CallSid } = req.body;
    let found = null;
    for (const session2 of connectSessions.values()) {
      if (session2.conferenceName === FriendlyName) {
        found = session2;
        break;
      }
    }
    if (found) {
      if (ConferenceSid) found.conferenceSid = ConferenceSid;
      if (ConferenceStatusCallbackEvent === "participant-join" && CallSid === found.agentCallSid) found.agentStatus = "connected";
      if (ConferenceStatusCallbackEvent === "participant-leave" && CallSid === found.agentCallSid) found.agentStatus = "disconnected";
      addEvent(found, "CONFERENCE_STATUS_CALLBACK", { ConferenceSid, ConferenceStatusCallbackEvent, FriendlyName, CallSid });
    } else {
      console.log("[CONNECT_TEST] conference-status: no matching session for conference", FriendlyName);
    }
    return res.sendStatus(200);
  });
  app2.post("/api/connect/lead-conference-status", (req, res) => {
    const { FriendlyName } = req.body;
    console.log("[CONNECT_TEST] lead-conference-status:", req.body);
    let found = null;
    for (const session2 of connectSessions.values()) {
      if (session2.conferenceName === FriendlyName) {
        found = session2;
        break;
      }
    }
    if (found) addEvent(found, "LEAD_CONFERENCE_STATUS_CALLBACK", req.body);
    return res.sendStatus(200);
  });
  console.log("[CONNECT_TEST] routes registered");
}
var connectSessions;
var init_connect_test_routes = __esm({
  "server/connect-test-routes.ts"() {
    "use strict";
    init_hardcoded_config();
    connectSessions = /* @__PURE__ */ new Map();
  }
});

// server/agent-anomaly-detector.ts
import { startOfDay } from "date-fns";
function isAgentTimeoutsMissing(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || error || "").toLowerCase();
  return code === "42P01" || message.includes('relation "public.agent_timeouts" does not exist');
}
async function checkAnomaly(supabase2, agentEmail, metricType, currentValue) {
  try {
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const { data: baselineData, error } = await supabase2.from("agent_anomaly_baselines").select("*").eq("agent_email", normalizedEmail).eq("metric_type", metricType).single();
    if (error || !baselineData) {
      console.log(`\u26A0\uFE0F No baseline found for ${normalizedEmail} / ${metricType} - allowing action`);
      return {
        isAnomaly: false,
        deviation: 0,
        currentValue
      };
    }
    const baseline = {
      agentEmail: baselineData.agent_email,
      metricType: baselineData.metric_type,
      meanValue: parseFloat(baselineData.mean_value),
      stdDev: parseFloat(baselineData.std_dev),
      sampleSize: baselineData.sample_size,
      calculatedAt: baselineData.calculated_at,
      dateRangeStart: baselineData.date_range_start,
      dateRangeEnd: baselineData.date_range_end
    };
    const deviation = baseline.stdDev > 0 ? (currentValue - baseline.meanValue) / baseline.stdDev : 0;
    const isAnomaly = Math.abs(deviation) > 1;
    return {
      isAnomaly,
      deviation,
      baseline,
      currentValue
    };
  } catch (error) {
    console.error("\u274C Error checking anomaly:", error);
    return {
      isAnomaly: false,
      deviation: 0,
      currentValue
    };
  }
}
async function getViolationCountToday(supabase2, agentEmail) {
  try {
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const todayStart = startOfDay(/* @__PURE__ */ new Date()).toISOString();
    const { count, error } = await supabase2.from("agent_anomaly_violations").select("*", { count: "exact", head: true }).eq("agent_email", normalizedEmail).gte("violation_timestamp", todayStart);
    if (error) {
      console.error("\u274C Error counting violations:", error);
      return 0;
    }
    return count || 0;
  } catch (error) {
    console.error("\u274C Error getting violation count:", error);
    return 0;
  }
}
function getTimeoutDuration(violationCount) {
  switch (violationCount) {
    case 1:
      return 0;
    // Warning only
    case 2:
      return 10 * 60;
    // 10 minutes
    case 3:
      return 60 * 60;
    // 1 hour
    case 4:
      return 24 * 60 * 60;
    // 24 hours
    default:
      return 24 * 60 * 60;
  }
}
async function recordViolation(supabase2, agentEmail, violationType, violationValue, metadata) {
  try {
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const violationCount = await getViolationCountToday(supabase2, normalizedEmail);
    const newViolationCount = violationCount + 1;
    const { data: baselineData } = await supabase2.from("agent_anomaly_baselines").select("*").eq("agent_email", normalizedEmail).eq("metric_type", violationType).single();
    const baselineMean = baselineData ? parseFloat(baselineData.mean_value) : 0;
    const baselineStdDev = baselineData ? parseFloat(baselineData.std_dev) : 0;
    const deviation = baselineStdDev > 0 ? (violationValue - baselineMean) / baselineStdDev : 0;
    const timeoutSeconds = getTimeoutDuration(newViolationCount);
    let actionTaken = "warning";
    let timeoutUntil;
    if (timeoutSeconds > 0) {
      const timeoutDate = /* @__PURE__ */ new Date();
      timeoutDate.setSeconds(timeoutDate.getSeconds() + timeoutSeconds);
      timeoutUntil = timeoutDate.toISOString();
      if (timeoutSeconds === 10 * 60) {
        actionTaken = "timeout_10min";
      } else if (timeoutSeconds === 60 * 60) {
        actionTaken = "timeout_1hr";
      } else if (timeoutSeconds === 24 * 60 * 60) {
        actionTaken = "timeout_24hr";
      }
    }
    const { error: violationError } = await supabase2.from("agent_anomaly_violations").insert({
      agent_email: normalizedEmail,
      violation_type: violationType,
      violation_value: violationValue,
      baseline_mean: baselineMean,
      baseline_std_dev: baselineStdDev,
      deviation_count: deviation,
      action_taken: actionTaken,
      timeout_until: timeoutUntil || null,
      metadata: metadata || null
    });
    if (violationError) {
      console.error("\u274C Failed to record violation:", violationError);
    } else {
      console.log(`\u{1F4DD} Recorded violation #${newViolationCount} for ${normalizedEmail}: ${actionTaken}`);
    }
    if (timeoutUntil && !agentTimeoutsTableUnavailable) {
      const timeoutType = violationType === "call_duration" ? "dialing" : violationType === "disposition_frequency" ? "disposition" : "all";
      const { error: timeoutError } = await supabase2.from("agent_timeouts").insert({
        agent_email: normalizedEmail,
        timeout_type: timeoutType,
        timeout_until: timeoutUntil,
        violation_count: newViolationCount
      });
      if (timeoutError) {
        if (isAgentTimeoutsMissing(timeoutError)) {
          agentTimeoutsTableUnavailable = true;
          console.warn("\u26A0\uFE0F agent_timeouts table missing; timeout writes disabled on this process.");
          return { actionTaken, timeoutUntil };
        }
        console.error("\u274C Failed to create timeout:", timeoutError);
      } else {
        console.log(`\u23F8\uFE0F Created ${actionTaken} timeout for ${normalizedEmail} until ${timeoutUntil}`);
      }
    }
    return { actionTaken, timeoutUntil };
  } catch (error) {
    console.error("\u274C Error recording violation:", error);
    return { actionTaken: "warning" };
  }
}
async function checkTimeout(supabase2, agentEmail) {
  try {
    if (agentTimeoutsTableUnavailable) {
      return { isTimedOut: false };
    }
    const normalizedEmail = agentEmail.toLowerCase().trim();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { data: timeouts, error } = await supabase2.from("agent_timeouts").select("*").eq("agent_email", normalizedEmail).gt("timeout_until", now).is("resolved_at", null).order("timeout_until", { ascending: true }).limit(1);
    if (error) {
      if (isAgentTimeoutsMissing(error)) {
        agentTimeoutsTableUnavailable = true;
        console.warn("\u26A0\uFE0F agent_timeouts table missing; timeout checks disabled on this process.");
        return { isTimedOut: false };
      }
      console.error("\u274C Error checking timeout:", error);
      return { isTimedOut: false };
    }
    if (!timeouts || timeouts.length === 0) {
      return { isTimedOut: false };
    }
    const timeout = timeouts[0];
    const timeoutUntil = new Date(timeout.timeout_until);
    const nowDate = /* @__PURE__ */ new Date();
    const remainingSeconds = Math.max(0, Math.floor((timeoutUntil.getTime() - nowDate.getTime()) / 1e3));
    return {
      isTimedOut: true,
      timeoutUntil: timeout.timeout_until,
      timeoutType: timeout.timeout_type,
      violationCount: timeout.violation_count,
      remainingSeconds
    };
  } catch (error) {
    console.error("\u274C Error checking timeout:", error);
    return { isTimedOut: false };
  }
}
async function resolveExpiredTimeouts(supabase2) {
  try {
    if (agentTimeoutsTableUnavailable) return;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { error } = await supabase2.from("agent_timeouts").update({ resolved_at: now }).lt("timeout_until", now).is("resolved_at", null);
    if (error) {
      if (isAgentTimeoutsMissing(error)) {
        agentTimeoutsTableUnavailable = true;
        console.warn("\u26A0\uFE0F agent_timeouts table missing; timeout cleanup disabled on this process.");
        return;
      }
      console.error("\u274C Error resolving expired timeouts:", error);
    } else {
      console.log("\u2705 Resolved expired timeouts");
    }
  } catch (error) {
    console.error("\u274C Error in resolveExpiredTimeouts:", error);
  }
}
var agentTimeoutsTableUnavailable;
var init_agent_anomaly_detector = __esm({
  "server/agent-anomaly-detector.ts"() {
    "use strict";
    agentTimeoutsTableUnavailable = false;
  }
});

// server/local-hot-tables.ts
function normalizeForDb(column, value) {
  if (value === void 0) return void 0;
  if (value === null) return null;
  if (JSON_COLUMNS.has(column)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}
function placeholders(start, count) {
  return Array.from({ length: count }, (_, i) => `$${start + i}`);
}
function columnValueExpr(column, placeholder) {
  if (JSON_COLUMNS.has(column)) return `${placeholder}::jsonb`;
  return placeholder;
}
function isDbConnectivityError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("timeout exceeded when trying to connect") || message.includes("connection terminated unexpectedly") || message.includes("could not connect") || code === "57P01" || code === "57P03" || code === "53300";
}
function shouldSkipTwilioCallLogWrite() {
  return Date.now() < twilioCallLogWritesPausedUntil;
}
function pauseTwilioCallLogWrites(error) {
  twilioCallLogWritesPausedUntil = Date.now() + DB_WRITE_COOLDOWN_MS;
  const now = Date.now();
  if (now - twilioCallLogPauseLoggedAt > DB_WRITE_COOLDOWN_MS) {
    twilioCallLogPauseLoggedAt = now;
    console.warn(
      `\u26A0\uFE0F Pausing twilio_call_logs writes for ${Math.round(DB_WRITE_COOLDOWN_MS / 1e3)}s after DB connectivity error:`,
      error?.message || String(error)
    );
  }
}
function shouldSkipDialMetricWrite() {
  return Date.now() < dialMetricWritesPausedUntil;
}
function pauseDialMetricWrites(error) {
  dialMetricWritesPausedUntil = Date.now() + DB_WRITE_COOLDOWN_MS;
  const now = Date.now();
  if (now - dialMetricPauseLoggedAt > DB_WRITE_COOLDOWN_MS) {
    dialMetricPauseLoggedAt = now;
    console.warn(
      `\u26A0\uFE0F Pausing agent_dial_metrics writes for ${Math.round(DB_WRITE_COOLDOWN_MS / 1e3)}s after DB connectivity error:`,
      error?.message || String(error)
    );
  }
}
async function flushTwilioCallLogLocalBuffer() {
  if (pendingTwilioCallLogLocalUpserts.size === 0) return;
  const payloads = [...pendingTwilioCallLogLocalUpserts.values()];
  pendingTwilioCallLogLocalUpserts.clear();
  for (const payload of payloads) {
    try {
      await upsertTwilioCallLogLocalDirect(payload);
    } catch (e) {
    }
  }
}
function ensureTwilioCallLogFlushTimer() {
  if (!twilioCallLogFlushTimer) {
    twilioCallLogFlushTimer = setInterval(flushTwilioCallLogLocalBuffer, 5e3);
  }
}
async function upsertTwilioCallLogLocal(payload) {
  if (shouldSkipTwilioCallLogWrite()) return;
  const sid = String(payload.twilio_call_sid || "").trim();
  if (sid) {
    const existing = pendingTwilioCallLogLocalUpserts.get(sid) || {};
    pendingTwilioCallLogLocalUpserts.set(sid, { ...existing, ...payload });
    ensureTwilioCallLogFlushTimer();
    return;
  }
  await upsertTwilioCallLogLocalDirect(payload);
}
async function upsertTwilioCallLogLocalDirect(payload) {
  if (shouldSkipTwilioCallLogWrite()) return;
  const entries = Object.entries(payload).filter(
    ([column, value]) => TWILIO_CALL_LOG_COLUMNS.has(column) && value !== void 0
  );
  if (!entries.length) return;
  const columns = entries.map(([column]) => column);
  const values = entries.map(([column, value]) => normalizeForDb(column, value));
  const valueExprs = placeholders(1, values.length).map(
    (ph, idx) => columnValueExpr(columns[idx], ph)
  );
  const updates = columns.filter((column) => column !== "twilio_call_sid").map((column) => `"${column}" = EXCLUDED."${column}"`);
  const sql3 = `
    INSERT INTO twilio_call_logs (${columns.map((c) => `"${c}"`).join(", ")})
    VALUES (${valueExprs.join(", ")})
    ON CONFLICT ("twilio_call_sid")
    DO UPDATE SET ${updates.length ? updates.join(", ") : `"twilio_call_sid" = EXCLUDED."twilio_call_sid"`}
  `;
  try {
    await pool.query(sql3, values);
  } catch (error) {
    if (isDbConnectivityError(error)) {
      pauseTwilioCallLogWrites(error);
      return;
    }
    throw error;
  }
}
async function existsRecentDialMetricLocal(params) {
  const result = await pool.query(
    `
      SELECT id
      FROM agent_dial_metrics
      WHERE agent_email = $1
        AND event_type = $2
        AND lead_phone = $3
        AND event_timestamp >= $4::timestamptz
      LIMIT 1
    `,
    [params.agentEmail, params.eventType, params.leadPhone, params.sinceIso]
  );
  return (result.rowCount || 0) > 0;
}
async function insertAgentDialMetricLocal(payload) {
  if (shouldSkipDialMetricWrite()) return null;
  const entries = Object.entries(payload).filter(
    ([column, value]) => AGENT_DIAL_METRIC_COLUMNS.has(column) && value !== void 0
  );
  if (!entries.length) return null;
  const columns = entries.map(([column]) => column);
  const values = entries.map(([column, value]) => normalizeForDb(column, value));
  const valueExprs = placeholders(1, values.length).map(
    (ph, idx) => columnValueExpr(columns[idx], ph)
  );
  const sql3 = `
    INSERT INTO agent_dial_metrics (${columns.map((c) => `"${c}"`).join(", ")})
    VALUES (${valueExprs.join(", ")})
    RETURNING id
  `;
  try {
    const result = await pool.query(sql3, values);
    return result.rows[0]?.id ?? null;
  } catch (error) {
    const isDuplicatePkey = String(error?.code || "") === "23505" && String(error?.constraint || "") === "agent_dial_metrics_pkey";
    if (!isDuplicatePkey) {
      if (isDbConnectivityError(error)) {
        pauseDialMetricWrites(error);
        return null;
      }
      throw error;
    }
    try {
      await pool.query(`
        SELECT setval(
          pg_get_serial_sequence('agent_dial_metrics', 'id'),
          COALESCE((SELECT MAX(id) FROM agent_dial_metrics), 0) + 1,
          false
        )
      `);
      const retry = await pool.query(sql3, values);
      return retry.rows[0]?.id ?? null;
    } catch (retryErr) {
      if (isDbConnectivityError(retryErr)) {
        pauseDialMetricWrites(retryErr);
        return null;
      }
      throw error;
    }
  }
}
async function incrementAgentDailyStat(agentEmail, eventType, statDate) {
  if (!agentEmail || !eventType) return;
  if (eventType === "booked") return;
  const email = agentEmail.toLowerCase().trim();
  const date = statDate || (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const col = eventType === "dial" ? "dials" : eventType === "reach" ? "reached" : eventType === "booked" ? "booked" : "instants";
  await pool.query(
    `INSERT INTO agent_daily_stats (agent_email, stat_date, ${col}, updated_at)
     VALUES ($1, $2::date, 1, NOW())
     ON CONFLICT (agent_email, stat_date)
     DO UPDATE SET ${col} = agent_daily_stats.${col} + 1, updated_at = NOW()`,
    [email, date]
  );
}
var DB_WRITE_COOLDOWN_MS, twilioCallLogWritesPausedUntil, twilioCallLogPauseLoggedAt, dialMetricWritesPausedUntil, dialMetricPauseLoggedAt, TWILIO_CALL_LOG_COLUMNS, AGENT_DIAL_METRIC_COLUMNS, JSON_COLUMNS, pendingTwilioCallLogLocalUpserts, twilioCallLogFlushTimer;
var init_local_hot_tables = __esm({
  "server/local-hot-tables.ts"() {
    "use strict";
    init_db();
    DB_WRITE_COOLDOWN_MS = 15e3;
    twilioCallLogWritesPausedUntil = 0;
    twilioCallLogPauseLoggedAt = 0;
    dialMetricWritesPausedUntil = 0;
    dialMetricPauseLoggedAt = 0;
    TWILIO_CALL_LOG_COLUMNS = /* @__PURE__ */ new Set([
      "twilio_call_sid",
      "owner_email",
      "agent_identity",
      "from_number",
      "to_number",
      "call_direction",
      "call_status",
      "call_duration",
      "call_started_at",
      "call_ended_at",
      "parent_call_sid",
      "call_source",
      "answered_by",
      "amd_duration_ms",
      "metadata",
      "recording_url",
      "associate_id",
      "lead_id",
      "taalk_lead_id",
      "created_at",
      "updated_at"
    ]);
    AGENT_DIAL_METRIC_COLUMNS = /* @__PURE__ */ new Set([
      "agent_email",
      "agent_name",
      "lead_id",
      "lead_phone",
      "lead_name",
      "lead_state",
      "event_type",
      "event_timestamp",
      "call_duration",
      "call_status",
      "disposition",
      "call_sid",
      "source",
      "notes",
      "isHotLead"
    ]);
    JSON_COLUMNS = /* @__PURE__ */ new Set(["metadata"]);
    pendingTwilioCallLogLocalUpserts = /* @__PURE__ */ new Map();
    twilioCallLogFlushTimer = null;
  }
});

// server/agent-dial-metrics-tracker.ts
var agent_dial_metrics_tracker_exports = {};
__export(agent_dial_metrics_tracker_exports, {
  isBookedDisposition: () => isBookedDisposition,
  isReachedDisposition: () => isReachedDisposition,
  logCallOutcome: () => logCallOutcome,
  logDialMetric: () => logDialMetric
});
async function logDialMetric(_supabase, params) {
  try {
    const {
      agentEmail,
      agentName,
      leadId,
      leadPhone,
      leadName,
      leadState,
      eventType,
      callDuration,
      callStatus,
      disposition,
      callSid,
      source = "dialer",
      notes,
      eventTimestamp
    } = params;
    if (!agentEmail || !leadPhone || !eventType) {
      console.error("\u274C Missing required fields for dial metric:", { agentEmail, leadPhone, eventType });
      return;
    }
    const cleanPhone = leadPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      console.error(`\u274C Invalid phone number after cleaning: ${leadPhone} -> ${cleanPhone}`);
      return;
    }
    const insertData = {
      agent_email: agentEmail.toLowerCase().trim(),
      agent_name: agentName?.trim() || null,
      lead_id: leadId || null,
      lead_phone: cleanPhone,
      lead_name: leadName?.trim() || null,
      lead_state: leadState?.trim().toUpperCase() || null,
      event_type: eventType,
      event_timestamp: eventTimestamp || (/* @__PURE__ */ new Date()).toISOString(),
      // CRITICAL: Only set call_duration if it's a valid positive number
      // If callDuration is 0, null, or undefined, set to null (don't use 0)
      call_duration: callDuration && callDuration > 0 ? callDuration : null,
      call_status: callStatus || null,
      disposition: disposition?.trim().toLowerCase() || null,
      call_sid: callSid?.trim() || null,
      source: source.trim().toLowerCase() || "dialer",
      notes: notes?.trim() || null
    };
    console.log(`\u{1F50D} Attempting to insert dial metric:`, {
      agent_email: insertData.agent_email,
      event_type: insertData.event_type,
      lead_phone: insertData.lead_phone,
      source: insertData.source
    });
    if (eventType === "dial" || eventType === "reach" || eventType === "booked") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3).toISOString();
      try {
        const localDuplicate = await existsRecentDialMetricLocal({
          agentEmail: insertData.agent_email,
          eventType,
          leadPhone: cleanPhone,
          sinceIso: oneHourAgo
        });
        if (localDuplicate) {
          console.log(`\u26A0\uFE0F DUPLICATE ${eventType} event prevented (local): ${insertData.agent_email} -> ${cleanPhone} (already exists in last hour)`);
          return;
        }
      } catch (localCheckErr) {
        console.error(`\u274C Local duplicate check failed for ${eventType}; skipped supabase fallback due to EOD-only mode:`, localCheckErr);
      }
    }
    const dispositionsRequiringCall = [
      "booked",
      "not_interested",
      "sale",
      "callback",
      "call_back",
      "appointment_set",
      "appointment",
      "instant_presentation",
      "already_been_sold",
      "medically_uninsurable",
      "duplicate",
      "over_age",
      "dnc",
      "do_not_call",
      "do-not-call",
      "do not call"
    ];
    const dispositionLower = insertData.disposition?.toLowerCase() || "";
    const requiresCallValidation = eventType === "booked" || eventType === "reach" || dispositionsRequiringCall.includes(dispositionLower);
    const exemptDispositions = ["no_answer", "no_answer_vm", "no_answer_voicemail", "wrong_number", "wrong number", "bad_number"];
    const isExempt = exemptDispositions.includes(dispositionLower);
    const eventTypesRequiringDuration = ["reach", "booked", "instant_presentation"];
    if (eventTypesRequiringDuration.includes(eventType) && (!callDuration || callDuration <= 0)) {
      console.error(`\u274C BLOCKED: Cannot log ${eventType} event without duration. Agent: ${agentEmail}, Phone: ${cleanPhone}, Duration: ${callDuration}`);
      return;
    }
    const dispositionsRequiringDuration = [
      "booked",
      "appointment",
      "appointment_set",
      "callback",
      "call_back",
      "instant_presentation",
      "sale",
      "not_interested",
      "already_been_sold",
      "medically_uninsurable",
      "duplicate",
      "over_age",
      "dnc",
      "do_not_call"
    ];
    if (dispositionsRequiringDuration.includes(dispositionLower) && !exemptDispositions.includes(dispositionLower) && (!callDuration || callDuration <= 0)) {
      console.error(`\u274C BLOCKED: Cannot log ${eventType} event with disposition ${disposition} without duration. Agent: ${agentEmail}, Phone: ${cleanPhone}, Duration: ${callDuration}`);
      return;
    }
    try {
      const insertedId = await insertAgentDialMetricLocal(insertData);
      if (!insertedId) {
        console.warn(`\u26A0\uFE0F Skipped ${eventType} metric local write for ${agentEmail} (db cooldown/timeout)`);
        return;
      }
      console.log(`\u2705 SUCCESSFULLY logged ${eventType} metric (local): ${agentEmail} -> ${cleanPhone}`);
      void incrementAgentDailyStat(
        agentEmail,
        eventType
      ).catch(
        (e) => console.warn(`\u26A0\uFE0F incrementAgentDailyStat failed (non-critical):`, e?.message)
      );
    } catch (localInsertErr) {
      console.error(`\u274C FAILED to log ${eventType} metric locally for ${agentEmail}:`, localInsertErr);
    }
  } catch (error) {
    console.error("\u274C Error logging dial metric:", error);
  }
}
function isReachedDisposition(disposition, duration, callStatus) {
  if (!disposition) {
    if (duration !== void 0 && duration !== null && duration > 0) {
      return true;
    }
    return false;
  }
  const disp = disposition.toLowerCase().trim();
  const reachedDispositions = [
    "contacted",
    "connected",
    "talked",
    "qualified",
    "interested",
    "not_interested",
    "transfer",
    "appointment",
    "booked",
    "callback_scheduled",
    "call_back",
    "callback",
    "sale",
    "instant_presentation"
  ];
  const notReachedDispositions = [
    "no_answer",
    "busy",
    "failed",
    "voicemail",
    "bad_number",
    "no_answer_vm",
    "no_answer_voicemail",
    "wrong_number",
    "wrong number"
  ];
  if (notReachedDispositions.includes(disp)) {
    return false;
  }
  if (reachedDispositions.includes(disp)) {
    if (duration !== void 0 && duration !== null && duration > 0) {
      return true;
    }
    console.warn(`\u26A0\uFE0F Skipping reach: disposition=${disp} but duration=${duration} (null or 0)`);
    return false;
  }
  if (duration !== void 0 && duration !== null && duration > 0) {
    return true;
  }
  return false;
}
function isBookedDisposition(disposition, duration) {
  if (!disposition) return false;
  const disp = disposition.toLowerCase().trim();
  const bookedDispositions = [
    "appointment",
    "appointment_set",
    "set_appointment",
    "booked",
    "qualified",
    "callback_scheduled",
    "instant_presentation",
    "sale",
    "meet"
  ];
  if (bookedDispositions.includes(disp)) {
    if (duration !== void 0 && duration !== null && duration > 0) {
      return true;
    }
    console.warn(`\u26A0\uFE0F Skipping booked: disposition=${disp} but duration=${duration} (null or 0)`);
    return false;
  }
  if (disp === "interested" && duration !== void 0 && duration !== null && duration > 0) {
    return duration >= 60;
  }
  return false;
}
async function logCallOutcome(supabase2, params) {
  const { disposition, callDuration: providedDuration, ...baseParams } = params;
  try {
    await resolveExpiredTimeouts(supabase2);
    const timeoutStatus = await checkTimeout(supabase2, baseParams.agentEmail);
    if (timeoutStatus.isTimedOut) {
      const remainingMinutes = timeoutStatus.remainingSeconds ? Math.ceil(timeoutStatus.remainingSeconds / 60) : 0;
      throw new Error(
        `\u23F8\uFE0F You've been temporarily paused for ${remainingMinutes} minute(s) due to unusual activity patterns. Timeout expires at ${timeoutStatus.timeoutUntil ? new Date(timeoutStatus.timeoutUntil).toLocaleString() : "unknown"}.`
      );
    }
    if (disposition) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1e3).toISOString();
      const { count: dispositionCount } = await supabase2.from("agent_dial_metrics").select("*", { count: "exact", head: true }).eq("agent_email", baseParams.agentEmail.toLowerCase().trim()).not("disposition", "is", null).gte("event_timestamp", oneHourAgo);
      if (dispositionCount !== null && dispositionCount > 0) {
        const anomalyCheck = await checkAnomaly(
          supabase2,
          baseParams.agentEmail,
          "disposition_frequency",
          dispositionCount + 1
          // Include current disposition
        );
        if (anomalyCheck.isAnomaly) {
          const { actionTaken } = await recordViolation(
            supabase2,
            baseParams.agentEmail,
            "disposition_frequency",
            dispositionCount + 1,
            {
              lead_id: baseParams.leadId,
              lead_phone: baseParams.leadPhone,
              disposition,
              call_sid: baseParams.callSid
            }
          );
          if (actionTaken !== "warning") {
            throw new Error(
              `\u23F8\uFE0F Disposition frequency anomaly detected. Action blocked due to timeout.`
            );
          } else {
            console.warn(`\u26A0\uFE0F Disposition frequency anomaly detected for ${baseParams.agentEmail}: ${dispositionCount + 1} dispositions/hour (baseline deviation: ${anomalyCheck.deviation.toFixed(2)})`);
          }
        }
      }
      if (providedDuration && providedDuration > 0) {
        const { data: recentDial } = await supabase2.from("agent_dial_metrics").select("event_timestamp").eq("agent_email", baseParams.agentEmail.toLowerCase().trim()).eq("lead_phone", baseParams.leadPhone.replace(/\D/g, "")).eq("event_type", "dial").order("event_timestamp", { ascending: false }).limit(1);
        if (recentDial && recentDial.length > 0) {
          const dialTime = new Date(recentDial[0].event_timestamp);
          const now = /* @__PURE__ */ new Date();
          const intervalSeconds = (now.getTime() - dialTime.getTime()) / 1e3;
          if (intervalSeconds > 0 && intervalSeconds < 3600) {
            const intervalCheck = await checkAnomaly(
              supabase2,
              baseParams.agentEmail,
              "action_interval",
              intervalSeconds
            );
            if (intervalCheck.isAnomaly && intervalCheck.deviation < -1) {
              const { actionTaken } = await recordViolation(
                supabase2,
                baseParams.agentEmail,
                "action_interval",
                intervalSeconds,
                {
                  lead_id: baseParams.leadId,
                  lead_phone: baseParams.leadPhone,
                  disposition,
                  call_sid: baseParams.callSid
                }
              );
              if (actionTaken !== "warning") {
                throw new Error(
                  `\u23F8\uFE0F Action interval anomaly detected (disposition applied too quickly). Action blocked due to timeout.`
                );
              } else {
                console.warn(`\u26A0\uFE0F Action interval anomaly detected: ${intervalSeconds.toFixed(1)}s between dial and disposition (baseline deviation: ${intervalCheck.deviation.toFixed(2)})`);
              }
            }
          }
        }
      }
      if (providedDuration && providedDuration > 0) {
        const durationCheck = await checkAnomaly(
          supabase2,
          baseParams.agentEmail,
          "call_duration",
          providedDuration
        );
        if (durationCheck.isAnomaly) {
          if (durationCheck.deviation < -1) {
            const { actionTaken } = await recordViolation(
              supabase2,
              baseParams.agentEmail,
              "call_duration",
              providedDuration,
              {
                lead_id: baseParams.leadId,
                lead_phone: baseParams.leadPhone,
                disposition,
                call_sid: baseParams.callSid
              }
            );
            if (actionTaken !== "warning") {
              throw new Error(
                `\u23F8\uFE0F Call duration anomaly detected (unusually short call). Action blocked due to timeout.`
              );
            } else {
              console.warn(`\u26A0\uFE0F Call duration anomaly detected: ${providedDuration}s (baseline deviation: ${durationCheck.deviation.toFixed(2)})`);
            }
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("\u23F8\uFE0F")) {
      throw error;
    }
    console.error("\u274C Error in anomaly detection (non-blocking):", error);
  }
  const realCallDuration = providedDuration && providedDuration > 0 ? providedDuration : null;
  console.log(`\u{1F4DE} logCallOutcome called: agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, disposition=${disposition || "null"}, duration=${realCallDuration || "null"} (provided: ${providedDuration || "null"})`);
  await logDialMetric(supabase2, {
    ...baseParams,
    eventType: "dial",
    disposition,
    callDuration: realCallDuration || 0
  });
  let isReached = false;
  if (realCallDuration && realCallDuration > 55) {
    console.log(`\u{1F3AF} AUTOMATIC REACH: Duration=${realCallDuration}s > 55s - counting as reached (disposition: ${disposition || "null"} is ignored)`);
    isReached = true;
  } else {
    isReached = isReachedDisposition(disposition, realCallDuration, baseParams.callStatus);
  }
  console.log(`\u{1F50D} isReached check: disposition=${disposition || "null"}, duration=${realCallDuration || "null"}, callStatus=${baseParams.callStatus || "null"}, callSid=${baseParams.callSid || "null"}, result=${isReached}`);
  if (isReached) {
    console.log(`\u2705 LOGGING REACH EVENT: agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, duration=${realCallDuration || "null"}s`);
    await logDialMetric(supabase2, {
      ...baseParams,
      eventType: "reach",
      disposition,
      callDuration: realCallDuration
    });
  }
  const isBooked = isBookedDisposition(disposition, realCallDuration);
  console.log(`\u{1F50D} isBooked check (auto-log disabled): disposition=${disposition || "null"}, duration=${realCallDuration || "null"}, callSid=${baseParams.callSid || "null"}, result=${isBooked}`);
  if (disposition && disposition.toLowerCase() === "instant_presentation") {
    if (realCallDuration !== void 0 && realCallDuration !== null && realCallDuration > 0) {
      console.log(`\u26A1 LOGGING INSTANT_PRESENTATION EVENT: agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, duration=${realCallDuration}s`);
      if (!isReached) {
        console.log(`\u2705 LOGGING REACH EVENT (from instant_presentation): agent=${baseParams.agentEmail}, phone=${baseParams.leadPhone}, duration=${realCallDuration}s`);
        await logDialMetric(supabase2, {
          ...baseParams,
          eventType: "reach",
          disposition,
          callDuration: realCallDuration
        });
      }
      await logDialMetric(supabase2, {
        ...baseParams,
        eventType: "instant_presentation",
        disposition,
        callDuration: realCallDuration
      });
    } else {
      console.warn(`\u26A0\uFE0F Skipping instant_presentation: disposition=instant_presentation but duration=${realCallDuration} (requires > 0 seconds)`);
    }
  }
}
var init_agent_dial_metrics_tracker = __esm({
  "server/agent-dial-metrics-tracker.ts"() {
    "use strict";
    init_agent_anomaly_detector();
    init_local_hot_tables();
  }
});

// server/twilio-call-logger.ts
var twilio_call_logger_exports = {};
__export(twilio_call_logger_exports, {
  TwilioCallLogger: () => TwilioCallLogger,
  twilioCallLogger: () => twilioCallLogger
});
var TwilioCallLogger, twilioCallLogger;
var init_twilio_call_logger = __esm({
  "server/twilio-call-logger.ts"() {
    "use strict";
    init_supabase();
    init_local_hot_tables();
    TwilioCallLogger = class _TwilioCallLogger {
      constructor() {
        console.log("TwilioCallLogger initialized");
      }
      /** Log a call — writes to local Postgres only, not Supabase */
      static async logCall(callData) {
        try {
          const {
            twilioCallSid,
            direction = "outbound",
            fromNumber,
            toNumber,
            status,
            ownerEmail,
            agentIdentity,
            callStartedAt,
            callSource = "unknown",
            metadata = {}
          } = callData;
          if (!twilioCallSid) return;
          const callLogData = {
            twilio_call_sid: twilioCallSid,
            call_direction: direction,
            from_number: fromNumber || "",
            to_number: toNumber || "",
            call_status: status || "initiated",
            call_duration: 0,
            owner_email: ownerEmail || "unknown@aoglobelife.com",
            agent_identity: agentIdentity || ownerEmail || "unknown@aoglobelife.com",
            call_started_at: callStartedAt || (/* @__PURE__ */ new Date()).toISOString(),
            call_source: callSource,
            metadata: typeof metadata === "string" ? metadata : JSON.stringify(metadata),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          await upsertTwilioCallLogLocal(callLogData);
          console.log(`\u2705 TwilioCallLogger: logged call ${twilioCallSid} for ${ownerEmail} (local Postgres)`);
        } catch (error) {
          console.error("\u274C TwilioCallLogger: Error logging call:", error);
        }
      }
      static normalizeDateRange(startDate, endDate) {
        const toIso = (value, isEnd = false) => {
          if (!value) return void 0;
          const raw = String(value).trim();
          if (!raw) return void 0;
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const suffix = isEnd ? "T23:59:59.999Z" : "T00:00:00.000Z";
            return `${raw}${suffix}`;
          }
          const dt = new Date(raw);
          if (Number.isNaN(dt.getTime())) return void 0;
          return dt.toISOString();
        };
        return {
          startIso: toIso(startDate, false),
          endIso: toIso(endDate, true)
        };
      }
      static async getAllCalls(ownerEmail, startDate, endDate, limit = 1e3) {
        try {
          if (!supabaseAdmin) {
            console.error("\u274C TwilioCallLogger.getAllCalls: supabaseAdmin not available");
            return [];
          }
          const { startIso, endIso } = _TwilioCallLogger.normalizeDateRange(startDate, endDate);
          const maxRows = Math.min(Math.max(Number(limit) || 1e3, 1), 5e3);
          let query = supabaseAdmin.from("twilio_call_logs").select("*").order("call_started_at", { ascending: false }).limit(maxRows);
          if (ownerEmail) {
            query = query.eq("owner_email", String(ownerEmail).toLowerCase().trim());
          }
          if (startIso) query = query.gte("call_started_at", startIso);
          if (endIso) query = query.lte("call_started_at", endIso);
          const { data, error } = await query;
          if (error) {
            console.error("\u274C TwilioCallLogger.getAllCalls query error:", error);
            return [];
          }
          return data || [];
        } catch (error) {
          console.error("\u274C TwilioCallLogger.getAllCalls error:", error);
          return [];
        }
      }
      static async getCallStats(ownerEmail, startDate, endDate) {
        const calls = await _TwilioCallLogger.getAllCalls(ownerEmail, startDate, endDate, 5e3);
        const totalCalls = calls.length;
        const completedCalls = calls.filter((c) => String(c.call_status || "").toLowerCase() === "completed").length;
        const answeredCalls = calls.filter((c) => {
          const d = Number(c.call_duration || 0);
          return Number.isFinite(d) && d > 0;
        }).length;
        const failedCalls = calls.filter((c) => {
          const s = String(c.call_status || "").toLowerCase();
          return s === "failed" || s === "busy" || s === "no-answer" || s === "canceled";
        }).length;
        const durations = calls.map((c) => Number(c.call_duration || 0)).filter((n) => Number.isFinite(n) && n > 0);
        const averageDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
        return {
          totalCalls,
          completedCalls,
          answeredCalls,
          failedCalls,
          averageDuration
        };
      }
      static async syncExistingTwilioCalls() {
        return 0;
      }
      static async clearAllCalls() {
        return true;
      }
      /** Update twilio_call_logs with Twilio AMD result — writes to local Postgres only */
      static async updateAmdResult(callSid, params, _maxRetries = 5) {
        try {
          if (!callSid) return;
          const { answeredBy, machineDetectionDurationMs } = params;
          console.log(`\u{1F4DE} TwilioCallLogger: Updating AMD for ${callSid}: answeredBy=${answeredBy}`);
          const update = {
            twilio_call_sid: callSid,
            answered_by: answeredBy || null,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (machineDetectionDurationMs != null) update.amd_duration_ms = machineDetectionDurationMs;
          await upsertTwilioCallLogLocal(update);
          console.log(`\u2705 TwilioCallLogger: AMD updated for ${callSid} (local Postgres)`);
        } catch (err) {
          console.error("\u274C TwilioCallLogger: updateAmdResult error:", err);
        }
      }
    };
    twilioCallLogger = new TwilioCallLogger();
  }
});

// server/queue/post-call-handlers.ts
var post_call_handlers_exports = {};
__export(post_call_handlers_exports, {
  registerPostCallHandlers: () => registerPostCallHandlers
});
function registerPostCallHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;
  registerQueueHandler("update-recording-url", async (payload) => {
    const { callSid, recordingUrl, recordingSid, parentCallSid } = payload;
    if (!callSid || !recordingUrl) return;
    await pool.query(
      `UPDATE twilio_call_logs
       SET recording_url = $1, recording_sid = $2, updated_at = NOW()
       WHERE twilio_call_sid = $3 OR twilio_call_sid = $4`,
      [recordingUrl, recordingSid || null, callSid, parentCallSid || callSid]
    );
    if (payload.leadId) {
      await masterleadClient.update(
        { id: payload.leadId },
        { recording_url: recordingUrl }
      );
    }
    console.log(`[POST_CALL_QUEUE] recording-url updated for ${callSid}`);
  });
  registerQueueHandler("find-child-calls", async (payload) => {
    const { parentCallSid, recordingUrl } = payload;
    if (!parentCallSid) return;
    const result = await pool.query(
      `SELECT twilio_call_sid FROM twilio_call_logs WHERE parent_call_sid = $1`,
      [parentCallSid]
    );
    if (result.rows.length === 0) return;
    const childSids = result.rows.map((r) => r.twilio_call_sid);
    await pool.query(
      `UPDATE twilio_call_logs
       SET recording_url = $1, updated_at = NOW()
       WHERE twilio_call_sid = ANY($2::text[])`,
      [recordingUrl, childSids]
    );
    console.log(`[POST_CALL_QUEUE] child-calls updated for parent ${parentCallSid} (${childSids.length} children)`);
  });
  registerQueueHandler("update-disposition", async (payload) => {
    const { leadId, taalkLeadId, phone, disposition, agentEmail, cnresolution } = payload;
    if (!disposition) return;
    const updates = {
      cnresolution: cnresolution || disposition,
      last_contacted: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (agentEmail) updates.cn_email = agentEmail;
    if (leadId) {
      await masterleadClient.update({ id: leadId }, updates);
    } else if (taalkLeadId) {
      await masterleadClient.update({ taalk_lead_id: taalkLeadId }, updates);
    } else if (phone) {
      await masterleadClient.update({ phone }, updates);
    }
    console.log(`[POST_CALL_QUEUE] disposition written: ${disposition} for lead ${leadId || phone}`);
  });
  registerQueueHandler("update-call-log", async (payload) => {
    const { callSid, ...fields } = payload;
    if (!callSid) return;
    const columns = Object.keys(fields);
    if (columns.length === 0) return;
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(", ");
    const values = [callSid, ...columns.map((c) => fields[c])];
    await pool.query(
      `UPDATE twilio_call_logs SET ${setClause}, updated_at = NOW() WHERE twilio_call_sid = $1`,
      values
    );
  });
  registerQueueHandler("update-agent-metrics", async (payload) => {
    const { agentEmail, eventType, leadId, callSid, duration } = payload;
    if (!agentEmail || !eventType) return;
    await dispositionWritePool.query(
      `INSERT INTO agent_dial_metrics
         (agent_email, event_type, lead_id, twilio_call_sid, duration_seconds, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [agentEmail, eventType, leadId || null, callSid || null, duration || null]
    );
  });
  console.log("[POST_CALL_QUEUE] All handlers registered");
}
var handlersRegistered;
var init_post_call_handlers = __esm({
  "server/queue/post-call-handlers.ts"() {
    "use strict";
    init_post_call_queue();
    init_db();
    init_local_masterlead_client();
    handlersRegistered = false;
  }
});

// server/webrtc-call-service.ts
var webrtc_call_service_exports = {};
__export(webrtc_call_service_exports, {
  WebRTCCallService: () => WebRTCCallService
});
import { WebSocketServer, WebSocket } from "ws";
var WebRTCCallService;
var init_webrtc_call_service = __esm({
  "server/webrtc-call-service.ts"() {
    "use strict";
    WebRTCCallService = class {
      wss;
      callSessions = /* @__PURE__ */ new Map();
      accountSid;
      apiKeySid;
      apiKeySecret;
      twimlAppSid;
      constructor(server) {
        this.wss = new WebSocketServer({
          server,
          path: "/ws/calls",
          verifyClient: (info) => {
            console.log("WebSocket connection attempt:", info.origin);
            return true;
          }
        });
        this.wss.on("connection", (ws, request) => {
          console.log("WebSocket connected for calls");
          ws.on("message", (data) => {
            try {
              const message = JSON.parse(data.toString());
              this.handleWebSocketMessage(ws, message);
            } catch (error) {
              console.error("Invalid WebSocket message:", error);
            }
          });
          ws.on("close", () => {
            console.log("WebSocket disconnected");
            this.handleDisconnection(ws);
          });
          ws.on("error", (error) => {
            console.error("WebSocket error:", error);
          });
        });
      }
      handleWebSocketMessage(ws, message) {
        const { type, sessionId, data } = message;
        switch (type) {
          case "join_call":
            this.joinCall(ws, sessionId, data.role);
            break;
          case "offer":
          case "answer":
          case "ice_candidate":
            this.relaySignaling(sessionId, message, ws);
            break;
          case "start_call":
            this.startCall(sessionId);
            break;
          case "end_call":
            this.endCall(sessionId);
            break;
          default:
            console.log("Unknown message type:", type);
        }
      }
      joinCall(ws, sessionId, role) {
        let session2 = this.callSessions.get(sessionId);
        if (!session2) {
          session2 = {
            sessionId,
            callStatus: "waiting"
          };
          this.callSessions.set(sessionId, session2);
        }
        if (role === "agent") {
          session2.agentSocket = ws;
          console.log(`Agent joined call session: ${sessionId}`);
        } else {
          session2.clientSocket = ws;
          console.log(`Client joined call session: ${sessionId}`);
        }
        this.broadcastToSession(sessionId, {
          type: "user_joined",
          role,
          sessionId
        });
        if (session2.agentSocket && session2.clientSocket) {
          session2.callStatus = "ringing";
          this.broadcastToSession(sessionId, {
            type: "call_ready",
            sessionId
          });
        }
        ws.send(JSON.stringify({
          type: "session_state",
          sessionId,
          callStatus: session2.callStatus,
          connectedUsers: {
            agent: !!session2.agentSocket,
            client: !!session2.clientSocket
          }
        }));
      }
      relaySignaling(sessionId, message, sender) {
        const session2 = this.callSessions.get(sessionId);
        if (!session2) return;
        const targetSocket = sender === session2.agentSocket ? session2.clientSocket : session2.agentSocket;
        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          targetSocket.send(JSON.stringify(message));
        }
      }
      startCall(sessionId) {
        const session2 = this.callSessions.get(sessionId);
        if (!session2) return;
        session2.callStatus = "connected";
        session2.startTime = /* @__PURE__ */ new Date();
        this.broadcastToSession(sessionId, {
          type: "call_started",
          sessionId,
          startTime: session2.startTime
        });
        console.log(`Call started for session: ${sessionId}`);
      }
      endCall(sessionId) {
        const session2 = this.callSessions.get(sessionId);
        if (!session2) return;
        session2.callStatus = "completed";
        session2.endTime = /* @__PURE__ */ new Date();
        this.broadcastToSession(sessionId, {
          type: "call_ended",
          sessionId,
          endTime: session2.endTime,
          duration: session2.startTime ? Math.floor((session2.endTime.getTime() - session2.startTime.getTime()) / 1e3) : 0
        });
        console.log(`Call ended for session: ${sessionId}`);
        setTimeout(() => {
          this.callSessions.delete(sessionId);
        }, 3e4);
      }
      broadcastToSession(sessionId, message) {
        const session2 = this.callSessions.get(sessionId);
        if (!session2) return;
        [session2.agentSocket, session2.clientSocket].forEach((socket) => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
          }
        });
      }
      handleDisconnection(ws) {
        for (const [sessionId, session2] of this.callSessions) {
          if (session2.agentSocket === ws || session2.clientSocket === ws) {
            if (session2.agentSocket === ws) {
              session2.agentSocket = void 0;
            }
            if (session2.clientSocket === ws) {
              session2.clientSocket = void 0;
            }
            if (!session2.agentSocket && !session2.clientSocket) {
              this.callSessions.delete(sessionId);
            } else {
              this.broadcastToSession(sessionId, {
                type: "user_disconnected",
                sessionId
              });
            }
            break;
          }
        }
      }
      getCallStatus(sessionId) {
        return this.callSessions.get(sessionId);
      }
      getActiveCalls() {
        return Array.from(this.callSessions.keys());
      }
      async generateAccessToken(identity) {
        console.log(`\u{1F3AB} Generating access token for identity: ${identity}`);
        const AccessToken = twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;
        const token = new AccessToken(
          this.accountSid,
          this.apiKeySid,
          this.apiKeySecret,
          { identity }
        );
        const voiceGrant = new VoiceGrant({
          outgoingApplicationSid: this.twimlAppSid,
          incomingAllow: true
        });
        token.addGrant(voiceGrant);
        const jwt = token.toJwt();
        console.log(`\u{1F3AB} Generated Twilio access token for ${identity}`);
        return jwt;
      }
    };
  }
});

// server/entry-twilio.ts
import http from "http";
import twilio5 from "twilio";

// server/setup-app.ts
init_hardcoded_config();
import express2 from "express";
import path2 from "path";
import fs from "fs";
import session from "express-session";

// server/vite.ts
import express from "express";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var isReplit = Boolean(process.env.REPL_ID || process.env.REPLIT);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    // Replit-only: local dev this overlay + external replit banner often cause noisy reloads / bad UX
    ...isReplit ? [runtimeErrorOverlay()] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets")
    },
    // Ensure proper module resolution across Node versions
    dedupe: ["lucide-react", "react", "react-dom"]
  },
  root: "client",
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    sourcemap: false,
    // faster deploys; enable only when debugging
    // Ensure all imports are properly resolved regardless of Node version
    commonjsOptions: {
      include: [/lucide-react/, /node_modules/],
      transformMixedEsModules: true
    },
    // Add build timestamp to filenames for cache busting
    rollupOptions: {
      output: {
        // Vite already adds hashes to filenames, but ensure they're always unique
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5e3,
    strictPort: true,
    allowedHosts: true,
    hmr: false,
    // Disable HMR to prevent WebSocket connection errors
    watch: {
      usePolling: false,
      // Avoid rebuild storms when Node touches logs, server TS, JWT cache, etc. (root is `client`, paths are relative to it)
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "../server/**",
        "../dist/**",
        "../attached_assets/**",
        "../*.log",
        "../hppro_jwt_cache.json",
        "../**/.cursor/**"
      ]
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:5001",
        ws: true
      }
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
var MAIN_TSX_CACHE_BUST = nanoid(8);
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// server/setup-app.ts
process.env.TZ = "America/Los_Angeles";
function createApp(options = {}) {
  const { serveSpa = true } = options;
  const app2 = express2();
  app2.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
  app2.get("/dashboard", (_req, res) => res.redirect(302, "/dashboard/connect"));
  const isShellApp = process.env.SHELL_APP === "1";
  if (serveSpa) {
    let sendIndex2 = function(_req, res) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Content-Type", "text/html");
      res.sendFile(indexPath);
    };
    var sendIndex = sendIndex2;
    const isProd = NODE_ENV === "production";
    const distPath = path2.resolve(process.cwd(), "dist", isShellApp ? "shell-public" : "public");
    const indexPath = path2.join(distPath, "index.html");
    if (isProd && fs.existsSync(indexPath)) {
      app2.get("/", sendIndex2);
      app2.get(/^\/dashboard\/.*/, sendIndex2);
    }
  }
  app2.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "*");
    if (req.path.endsWith(".html") || req.path.endsWith(".js") || req.path.endsWith(".css") || req.path === "/") {
      res.header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.header("Pragma", "no-cache");
      res.header("Expires", "0");
      res.header("ETag", "");
      res.header("Last-Modified", "");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app2.use("/uploads", express2.static(path2.join(process.cwd(), "uploads")));
  const attachedAssetsPath = path2.join(process.cwd(), "attached_assets");
  if (fs.existsSync(attachedAssetsPath)) {
    app2.use("/attached_assets", express2.static(attachedAssetsPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".mp4")) {
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Accept-Ranges", "bytes");
        }
      }
    }));
  }
  app2.use(express2.json({ limit: "50mb" }));
  app2.use(express2.urlencoded({ extended: false, limit: "50mb" }));
  app2.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1e3,
        sameSite: "lax"
      }
    })
  );
  app2.use((req, res, next) => {
    const start = Date.now();
    const reqPath = req.path;
    let capturedJsonResponse;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (reqPath.startsWith("/api")) {
        let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        if (logLine.length > 80) logLine = logLine.slice(0, 79) + "\u2026";
        log(logLine);
      }
    });
    next();
  });
  return app2;
}
function addErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const e = err;
    res.status(e?.status ?? e?.statusCode ?? 500).json({ message: e?.message ?? "Internal Server Error" });
    if (NODE_ENV !== "production") throw err;
  });
}

// server/routes-sections/routes-twilio.ts
import express4 from "express";
import twilio4 from "twilio";

// server/phone-utils.ts
function formatToE164(phoneNumber) {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (phoneNumber.startsWith("+")) {
    return phoneNumber;
  }
  return `+1${digits}`;
}

// server/routes-sections/routes-twilio.ts
init_hardcoded_config();

// server/external-service-urls.ts
function stripTrailingSlashes(s) {
  return s.replace(/\/+$/, "");
}
function normalizeBaseUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return stripTrailingSlashes(trimmed);
  return stripTrailingSlashes(`https://${trimmed}`);
}
function getAoirailDataServiceBaseUrl() {
  const raw = process.env.AOIRAIL_DATA_SERVICE_URL || process.env.DATA_SERVICE_URL || process.env.RAILWAY_SERVICE_AOIRAIL_DATA_URL || "";
  return normalizeBaseUrl(raw);
}

// server/routes-sections/routes-twilio.ts
init_supabase();
init_local_masterlead_client();

// server/twilio-status-webhook.ts
init_supabase();
init_hardcoded_config();
import express3 from "express";
import bodyParser from "body-parser";
import twilio2 from "twilio";
var twilioStatusRouter = express3.Router();
var pendingTwilioCallLogUpserts = /* @__PURE__ */ new Map();
async function flushTwilioCallLogBuffer() {
  if (pendingTwilioCallLogUpserts.size === 0) return;
  const rows = [...pendingTwilioCallLogUpserts.values()];
  pendingTwilioCallLogUpserts.clear();
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin.from("twilio_call_logs").upsert(rows, { onConflict: "twilio_call_sid" });
    if (error) {
      console.error(`\u274C STEP STATUS: Batch upsert error (${rows.length} rows):`, error);
    } else {
      console.log(`\u2705 STEP STATUS: Batch upserted ${rows.length} call log row(s)`);
    }
  } catch (err) {
    console.error(`\u274C STEP STATUS: Batch upsert exception:`, err);
  }
}
setInterval(flushTwilioCallLogBuffer, 5e3);
var twilioClient = twilio2(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
twilioStatusRouter.use(bodyParser.urlencoded({ extended: false }));
twilioStatusRouter.post("/", (req, res) => {
  console.log("\u{1F525}\u{1F525}\u{1F525} STEP STATUS: /api/twilio/call-status WEBHOOK HIT \u{1F525}\u{1F525}\u{1F525}");
  console.log("\u{1F50D} DEBUG: Request body:", JSON.stringify(req.body, null, 2));
  console.log("\u{1F50D} DEBUG: Request query:", JSON.stringify(req.query, null, 2));
  const b = req.body;
  const callSid = b.CallSid;
  const status = (b.CallStatus || "").toLowerCase();
  const to = b.To || b.to || b.Called || b.CalledNumber || b.DialCallTo || null;
  const from = b.From || b.from || b.Caller || b.CallerNumber || null;
  const parentSid = b.ParentCallSid || b.ParentCallSid || null;
  console.log(`\u{1F50D} DEBUG: callSid=${callSid}, status=${status}`);
  console.log(`\u{1F3AF} STATUS WEBHOOK: ${callSid} - ${status} - To: ${to} - From: ${from}`);
  if (from && from.startsWith("client:") && !to && !parentSid) {
    console.log(`\u23ED\uFE0F STEP STATUS: Skipping parent WebRTC call (no to_number) - callSid=${callSid}. Child call will be logged by dial-action endpoint.`);
    res.status(204).end();
    return;
  }
  res.status(204).end();
  if (!callSid || !status) {
    console.warn(`\u26A0\uFE0F STEP STATUS: Missing required fields - callSid=${callSid}, status=${status}`);
    return;
  }
  void (async () => {
    console.log(`\u2705 STEP STATUS: (async) Logging call - callSid=${callSid}, to=${to || "MISSING"}, from=${from || "MISSING"}, status=${status}`);
    try {
      if (!supabaseAdmin) return;
      const logData = {
        twilio_call_sid: callSid,
        call_status: status,
        call_started_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (to) {
        logData.to_number = to;
      } else {
        try {
          const twilioCall = await twilioClient.calls(callSid).fetch();
          if (twilioCall.to) {
            logData.to_number = twilioCall.to;
          } else {
            logData.to_number = "";
          }
          if (!logData.from_number && twilioCall.from) {
            logData.from_number = twilioCall.from;
          }
        } catch (twilioError) {
          console.error(`\u274C Failed to fetch call details from Twilio API:`, twilioError);
          logData.to_number = "";
        }
      }
      if (from) {
        logData.from_number = from;
        if (from.startsWith("client:")) {
          const agentEmail = from.replace("client:", "");
          logData.owner_email = agentEmail;
          logData.agent_identity = from;
        }
      }
      if (parentSid) {
        logData.parent_call_sid = parentSid;
      }
      if (to && !from?.startsWith("client:")) {
        logData.call_direction = "outbound";
      } else if (from?.startsWith("client:")) {
        logData.call_direction = "outbound";
      }
      const existing = pendingTwilioCallLogUpserts.get(callSid) || {};
      pendingTwilioCallLogUpserts.set(callSid, { ...existing, ...logData });
      console.log(`\u{1F4E5} STEP STATUS: Queued ${callSid} - ${status} (buffer size: ${pendingTwilioCallLogUpserts.size})`);
    } catch (error) {
      console.error(`\u274C STEP STATUS: Exception while logging:`, error);
    }
  })();
});

// server/lead-call-counter.ts
init_db();
var ensureSchemaPromise = null;
function normalizePhoneLast10(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return "";
}
async function ensureCounterSchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await pool.query(`
        ALTER TABLE masterlead
        ADD COLUMN IF NOT EXISTS call_attempts integer NOT NULL DEFAULT 0
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lead_call_counter_events (
          call_sid text PRIMARY KEY,
          lead_id bigint NULL,
          phone_last10 text NOT NULL,
          direction text NULL,
          status text NULL,
          created_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      ensureSchemaPromise = null;
      throw err;
    });
  }
  await ensureSchemaPromise;
}
function isEligibleOutboundAttempt(params) {
  const direction = String(params.direction || "").toLowerCase();
  const status = String(params.status || "").toLowerCase();
  if (direction !== "outbound") return false;
  return status === "initiated" || status === "ringing" || status === "in-progress";
}
async function incrementLeadCallAttemptCounter(params) {
  const callSid = String(params.callSid || "").trim();
  if (!callSid) return;
  if (!isEligibleOutboundAttempt(params)) return;
  const phoneLast10 = normalizePhoneLast10(params.toNumber);
  if (!phoneLast10) return;
  await ensureCounterSchema();
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    const eventInsert = await client2.query(
      `
        INSERT INTO lead_call_counter_events (call_sid, phone_last10, direction, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (call_sid) DO NOTHING
        RETURNING call_sid
      `,
      [callSid, phoneLast10, params.direction || null, params.status || null]
    );
    if ((eventInsert.rowCount || 0) === 0) {
      await client2.query("COMMIT");
      return;
    }
    const updatedLead = await client2.query(
      `
        WITH target AS (
          SELECT id
          FROM masterlead
          WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone::text, ''), '\\D', '', 'g'), 10) = $1
             OR RIGHT(REGEXP_REPLACE(COALESCE(phone_number::text, ''), '\\D', '', 'g'), 10) = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          LIMIT 1
        )
        UPDATE masterlead ml
        SET call_attempts = COALESCE(ml.call_attempts, 0) + 1
        FROM target
        WHERE ml.id = target.id
        RETURNING ml.id::text AS id
      `,
      [phoneLast10]
    );
    if ((updatedLead.rowCount || 0) > 0) {
      await client2.query(
        `UPDATE lead_call_counter_events SET lead_id = $2 WHERE call_sid = $1`,
        [callSid, updatedLead.rows[0].id]
      );
    }
    await client2.query("COMMIT");
  } catch (err) {
    await client2.query("ROLLBACK");
    throw err;
  } finally {
    client2.release();
  }
}

// server/routes-sections/routes-twilio.ts
init_post_call_queue();
var PRODUCTION_BASE_URL = PRODUCTION_URL;
var client = twilio4(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
async function registerTwilioRoutes(app2) {
  console.log("\u{1F527} Registering Twilio section routes...");
  app2.post("/webhook/webrtc-conference-test", async (req, res) => {
    const agentId = String(req.body?.agentId || req.query?.agentId || "test-agent");
    const sessionId = String(req.body?.sessionId || req.query?.sessionId || "");
    const callSid = req.body?.CallSid || req.body?.callSid || "";
    const confName = `connect-${sessionId}`;
    try {
      const { handleAgentConferenceJoin: handleAgentConferenceJoin2 } = await Promise.resolve().then(() => (init_connect_test_routes(), connect_test_routes_exports));
      handleAgentConferenceJoin2(agentId, sessionId, callSid);
    } catch (_) {
    }
    res.set("Content-Type", "text/xml");
    return res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Dial><Conference startConferenceOnEnter='true' endConferenceOnExit='false' beep='false' statusCallback='${PRODUCTION_BASE_URL}/api/connect/conference-status' statusCallbackEvent='start end join leave mute hold' statusCallbackMethod='POST'>${confName}</Conference></Dial></Response>`);
  });
  app2.all("/webhook/webrtc", async (req, res) => {
    const agentId = req.body?.agentId || req.query?.agentId;
    const sessionId = req.body?.sessionId || req.query?.sessionId;
    if (agentId && sessionId && String(agentId).startsWith("test-")) {
      const callSid = req.body?.CallSid || req.body?.callSid || "";
      const conferenceName2 = `connect-${sessionId}`;
      try {
        const { handleAgentConferenceJoin: handleAgentConferenceJoin2 } = await Promise.resolve().then(() => (init_connect_test_routes(), connect_test_routes_exports));
        handleAgentConferenceJoin2(String(agentId), String(sessionId), callSid);
      } catch (e) {
      }
      res.set("Content-Type", "text/xml");
      return res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Dial><Conference startConferenceOnEnter='true' endConferenceOnExit='false' beep='false' statusCallback='${PRODUCTION_BASE_URL}/api/connect/conference-status' statusCallbackEvent='start end join leave mute hold' statusCallbackMethod='POST'>${conferenceName2}</Conference></Dial></Response>`);
    }
    const toNumber = req.body.To || req.query.To;
    const conferenceName = req.body.conference || req.body.conferenceName || req.query.conference || req.query.conferenceName;
    const leadState = req.body.leadState || req.query.leadState;
    const callerIdentity = (req.body.Caller || req.body.From || req.query.Caller || req.query.From || "").toString();
    const hasClientIdentity = callerIdentity.toLowerCase().startsWith("client:") && callerIdentity.includes("@");
    const agentEmail = hasClientIdentity ? callerIdentity.replace(/^client:/i, "").trim().toLowerCase() : "";
    if (!agentEmail || !agentEmail.includes("@")) {
      console.warn("\u26A0\uFE0F WebRTC rejected: no user \u2014 Caller/From must be client:email (user must be logged in)");
      res.status(403).type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected"/></Response>');
      return;
    }
    if (agentEmail === "cnsysop@aoglobelife.com" || agentEmail === "unknown@aoglobelife.com") {
      console.warn(`\u26A0\uFE0F WebRTC rejected: invalid identity (${agentEmail}) \u2014 never cnsysop, never unknown`);
      res.status(403).type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected"/></Response>');
      return;
    }
    let twiml;
    if (toNumber) {
      const formattedToNumber = formatToE164(toNumber);
      let callerIdNumber = TWILIO_PHONE_NUMBER;
      const svc = global.localPresenceService;
      if (leadState && svc) {
        try {
          const localNumber = svc.getLocalNumber(leadState);
          if (localNumber && localNumber !== TWILIO_PHONE_NUMBER) callerIdNumber = localNumber;
        } catch (_) {
        }
      }
      const statusCallback = `${PRODUCTION_BASE_URL}/api/twilio/call-status?agentEmail=${encodeURIComponent(agentEmail)}`;
      const dialAction = `${PRODUCTION_BASE_URL}/api/twilio/dial-action?agentEmail=${encodeURIComponent(agentEmail)}`;
      const recordCb = `${PRODUCTION_BASE_URL}/api/twilio/recording-status`;
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerIdNumber}" action="${dialAction}" record="record-from-answer" recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST" statusCallback="${statusCallback}" statusCallbackMethod="POST" statusCallbackEvent="initiated,ringing,answered,completed">
    <Number statusCallback="${statusCallback}" statusCallbackMethod="POST" statusCallbackEvent="initiated,ringing,answered,completed">${formattedToNumber}</Number>
  </Dial>
</Response>`;
    } else {
      const confName = conferenceName || "Critical-Conference-" + Date.now();
      const recordCb = `${PRODUCTION_BASE_URL}/api/twilio/recording-status`;
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="false" maxParticipants="2" record="record-from-start" recordingStatusCallback="${recordCb}" recordingStatusCallbackMethod="POST">${confName}</Conference>
  </Dial>
</Response>`;
    }
    res.type("text/xml");
    res.send(twiml);
  });
  app2.post("/api/twilio/dial-action", async (req, res) => {
    const dialCallSid = req.body.DialCallSid;
    const dialCallStatus = req.body.DialCallStatus;
    let finalTo = req.body.To || req.body.DialCallTo || req.body.Called || req.body.DialCallToNumber;
    const from = req.body.From || req.body.Caller;
    const parentCallSid = req.body.ParentCallSid || req.body.CallSid;
    const recordingUrl = req.body.RecordingUrl || req.body.recording_url || null;
    const recordingSid = req.body.RecordingSid || req.body.recording_sid || null;
    if (dialCallSid && !finalTo) {
      try {
        const twilioClient2 = twilio4(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        const twilioCall = await twilioClient2.calls(dialCallSid).fetch();
        if (twilioCall.to) finalTo = twilioCall.to;
      } catch (_) {
      }
    }
    if (dialCallSid && finalTo) {
      try {
        const callDuration = parseInt(String(req.body.DialCallDuration), 10) || 0;
        const logData = {
          twilio_call_sid: dialCallSid,
          to_number: finalTo,
          from_number: from || "",
          call_status: dialCallStatus || "initiated",
          call_duration: callDuration,
          call_direction: "outbound",
          call_started_at: (/* @__PURE__ */ new Date()).toISOString(),
          parent_call_sid: parentCallSid,
          call_source: "webrtc_dial_action",
          metadata: req.body
        };
        if (recordingUrl) {
          logData.recording_url = recordingUrl;
          console.log(`\u{1F4F9} Dial-action: Found RecordingUrl for ${dialCallSid}: ${recordingUrl}`);
        }
        const BAD_OWNER = ["cnsysop@aoglobelife.com", "unknown@aoglobelife.com", "system@aoglobelife.com", "unknown", ""];
        const isBadOwner = (e) => !e || !e.includes("@") || BAD_OWNER.includes((e || "").trim().toLowerCase());
        let ownerToSet = null;
        if (from && from.startsWith("client:")) ownerToSet = from.replace("client:", "").trim().toLowerCase();
        if (ownerToSet && isBadOwner(ownerToSet) && parentCallSid) {
          const { data: parentRow } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").eq("twilio_call_sid", parentCallSid).maybeSingle();
          const parentOwner = parentRow?.owner_email?.trim?.();
          if (parentOwner && parentOwner.includes("@") && !BAD_OWNER.includes(parentOwner.toLowerCase())) ownerToSet = parentOwner.toLowerCase();
        }
        if (ownerToSet && !isBadOwner(ownerToSet)) {
          logData.owner_email = ownerToSet;
          logData.agent_identity = `client:${ownerToSet}`;
        }
        const { error } = await supabaseAdmin.from("twilio_call_logs").upsert(logData, { onConflict: "twilio_call_sid" });
      } catch (_) {
      }
    } else if (dialCallSid) {
      try {
        const logData = {
          twilio_call_sid: dialCallSid,
          call_status: dialCallStatus || "initiated",
          call_duration: parseInt(String(req.body.DialCallDuration), 10) || 0,
          call_direction: "outbound",
          call_started_at: (/* @__PURE__ */ new Date()).toISOString(),
          parent_call_sid: parentCallSid,
          call_source: "webrtc_dial_action",
          metadata: req.body
        };
        if (recordingUrl) {
          logData.recording_url = recordingUrl;
          console.log(`\u{1F4F9} Dial-action: Found RecordingUrl for ${dialCallSid}: ${recordingUrl}`);
        }
        const to = req.body.To || req.body.DialCallTo || req.body.Called;
        if (!finalTo && !to) {
          try {
            const twilioCall = await client.calls(dialCallSid).fetch();
            if (twilioCall.to) logData.to_number = twilioCall.to;
            if (twilioCall.from) logData.from_number = twilioCall.from;
          } catch (_) {
          }
        } else if (to) {
          logData.to_number = to;
          logData.from_number = from || "";
        }
        const BAD_OWNER_ELSE = ["cnsysop@aoglobelife.com", "unknown@aoglobelife.com", "system@aoglobelife.com", "unknown", ""];
        const isBadOwnerElse = (e) => !e || !e.includes("@") || BAD_OWNER_ELSE.includes((e || "").trim().toLowerCase());
        let ownerToSetElse = null;
        if (from && from.startsWith("client:")) ownerToSetElse = from.replace("client:", "").trim().toLowerCase();
        if (ownerToSetElse && isBadOwnerElse(ownerToSetElse) && parentCallSid) {
          const { data: parentRow } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").eq("twilio_call_sid", parentCallSid).maybeSingle();
          const parentOwner = parentRow?.owner_email?.trim?.();
          if (parentOwner && parentOwner.includes("@") && !BAD_OWNER_ELSE.includes(parentOwner.toLowerCase())) ownerToSetElse = parentOwner.toLowerCase();
        }
        if (ownerToSetElse && !isBadOwnerElse(ownerToSetElse)) {
          logData.owner_email = ownerToSetElse;
          logData.agent_identity = `client:${ownerToSetElse}`;
        }
        await supabaseAdmin.from("twilio_call_logs").upsert(logData, { onConflict: "twilio_call_sid" });
      } catch (_) {
      }
    }
    res.type("text/xml");
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });
  app2.use("/api/twilio/status", twilioStatusRouter);
  app2.post("/api/twilio/recording-status", (req, res) => {
    res.status(200).send("OK");
    const CallSid = req.body.CallSid;
    const ConferenceSid = req.body.ConferenceSid;
    const RecordingSid = req.body.RecordingSid;
    const RecordingUrl = req.body.RecordingUrl ?? req.body.recording_url ?? null;
    const RecordingStatus = req.body.RecordingStatus ?? req.body.recording_status ?? null;
    const RecordingDuration = req.body.RecordingDuration ?? req.body.recording_duration;
    if (RecordingStatus !== "completed" || !RecordingUrl) return;
    if (CallSid) {
      enqueuePostCallJob("update-recording-url", {
        callSid: CallSid,
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid || null,
        recordingDuration: RecordingDuration ? parseInt(String(RecordingDuration), 10) : null
      });
      enqueuePostCallJob("find-child-calls", {
        parentCallSid: CallSid,
        recordingUrl: RecordingUrl
      });
    }
    if (ConferenceSid && !CallSid) {
      enqueuePostCallJob("update-recording-url", {
        callSid: ConferenceSid,
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid || null,
        isConference: true
      });
    }
  });
  app2.post("/api/twilio/call-status", express4.urlencoded({ extended: false }), express4.json(), async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const query = req.query && typeof req.query === "object" ? req.query : {};
    const CallSid = String(body.CallSid || query.CallSid || "").trim();
    const CallStatus = String(body.CallStatus || query.CallStatus || "").trim();
    const CallDuration = String(body.CallDuration || query.CallDuration || "").trim();
    const From = String(body.From || query.From || "").trim();
    const To = String(body.To || query.To || "").trim();
    const Direction = String(body.Direction || query.Direction || "").trim();
    const ParentCallSid = String(body.ParentCallSid || query.ParentCallSid || "").trim();
    const ConferenceSid = String(body.ConferenceSid || query.ConferenceSid || "").trim();
    if (!CallSid) {
      console.warn("\u26A0\uFE0F /api/twilio/call-status missing CallSid; skipping", {
        bodyKeys: Object.keys(body || {}),
        queryKeys: Object.keys(query || {}),
        contentType: req.headers["content-type"] || null
      });
      return res.status(204).end();
    }
    let agentEmail = (query.agentEmail || query.agent_email || body["metadata[agent_email]"] || body.agent_email || body.AgentEmail || body.agentEmail || "").toString().trim();
    if (!agentEmail && From && String(From).startsWith("client:") && String(From).includes("@")) {
      agentEmail = String(From).replace(/^client:/i, "").trim().toLowerCase();
    }
    const BAD_OWNER = ["cnsysop@aoglobelife.com", "unknown@aoglobelife.com", "system@aoglobelife.com", "unknown", ""];
    const isBadOwner = (e) => !e || !e.includes("@") || BAD_OWNER.includes((e || "").trim().toLowerCase());
    let ownerForLog = agentEmail && !isBadOwner(agentEmail) ? agentEmail.trim().toLowerCase() : null;
    if (CallSid && !ownerForLog) {
      try {
        const lookupSids = [CallSid, ParentCallSid].filter(Boolean);
        for (const sid of lookupSids) {
          const { data: sidRow } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").eq("twilio_call_sid", sid).maybeSingle();
          const sidOwner = String(sidRow?.owner_email || "").trim().toLowerCase();
          if (sidOwner.includes("@") && !BAD_OWNER.includes(sidOwner)) {
            ownerForLog = sidOwner;
            break;
          }
        }
      } catch (ownerLookupErr) {
        console.warn("\u26A0\uFE0F Failed direct owner lookup from twilio_call_logs:", ownerLookupErr);
      }
    }
    if (CallSid && !ownerForLog) {
      const parentSidForChildren = ParentCallSid || CallSid;
      const { data: children } = await supabaseAdmin.from("twilio_call_logs").select("owner_email").eq("parent_call_sid", parentSidForChildren).limit(5);
      const childOwner = (children || []).map((r) => (r?.owner_email || "").trim()).find((e) => e.includes("@") && !BAD_OWNER.includes(e.toLowerCase()));
      if (childOwner) ownerForLog = childOwner.toLowerCase();
    }
    if (CallSid) {
      try {
        console.log(`\u{1F4DE} Call status webhook: CallSid=${CallSid}, Status=${CallStatus}, Duration=${CallDuration}, Owner=${ownerForLog || "none"}`);
        let direction = /outbound/i.test(Direction || "") ? "outbound" : "inbound";
        if (direction === "inbound" && /^client:/i.test(String(From || ""))) {
          direction = "outbound";
        }
        if (direction === "inbound" && (CallSid || ParentCallSid)) {
          try {
            const lookupSids = [CallSid, ParentCallSid].filter(Boolean);
            for (const sid of lookupSids) {
              const { data: directionRow } = await supabaseAdmin.from("twilio_call_logs").select("call_direction").eq("twilio_call_sid", sid).maybeSingle();
              const existingDirection = String(directionRow?.call_direction || "").toLowerCase();
              if (existingDirection === "outbound") {
                direction = "outbound";
                break;
              }
            }
          } catch (directionLookupErr) {
            console.warn("\u26A0\uFE0F Failed direction lookup from twilio_call_logs:", directionLookupErr);
          }
        }
        const status = (CallStatus || "").toLowerCase();
        const duration = CallDuration ? parseInt(CallDuration, 10) : null;
        const callData = {
          twilio_call_sid: CallSid,
          owner_email: ownerForLog,
          agent_identity: ownerForLog ? `client:${ownerForLog}` : null,
          from_number: From || null,
          to_number: To || null,
          call_direction: direction,
          call_status: status || "initiated",
          call_duration: duration,
          call_started_at: (/* @__PURE__ */ new Date()).toISOString(),
          parent_call_sid: ParentCallSid || null,
          call_source: "twilio_call_status_webhook"
        };
        if (status === "completed" || status === "failed") callData.call_ended_at = (/* @__PURE__ */ new Date()).toISOString();
        const { data, error } = await supabaseAdmin.from("twilio_call_logs").upsert(callData, { onConflict: "twilio_call_sid" }).select("twilio_call_sid");
        if (error) {
          console.error(`\u274C CRITICAL: Failed to upsert call ${CallSid} to twilio_call_logs:`, error);
          console.error(`   Error details:`, JSON.stringify(error, null, 2));
          console.error(`   Call data:`, JSON.stringify(callData, null, 2));
        } else {
          console.log(`\u2705 Successfully upserted call ${CallSid} to twilio_call_logs`);
        }
        await incrementLeadCallAttemptCounter({
          callSid: CallSid,
          toNumber: To || null,
          direction,
          status
        }).catch((counterErr) => {
          console.warn("\u26A0\uFE0F Lead call counter increment failed:", counterErr);
        });
        if (direction === "outbound" && (status === "ringing" || status === "in-progress") && ownerForLog && To) {
          try {
            const normalizedPhone = String(To).trim().replace(/\D/g, "").slice(-10);
            if (normalizedPhone && normalizedPhone.length >= 10) {
              const { data: leadRecord } = await masterleadClient.from("masterlead").select("id, cnresolution, cn_email").or(`phone.eq.${normalizedPhone},phone.eq.1${normalizedPhone}`).maybeSingle();
              if (leadRecord && leadRecord.cnresolution !== "awaitingdisposition") {
                console.log(`\u{1F525} MARKING LEAD AS AWAITING DISPOSITION: Lead ${leadRecord.id} (phone: ${normalizedPhone}) - Call ${status}`);
                await masterleadClient.from("masterlead").update({
                  cnresolution: "awaitingdisposition",
                  updated_at: (/* @__PURE__ */ new Date()).toISOString()
                }).eq("id", leadRecord.id);
              }
            }
          } catch (awaitingErr) {
            console.error("\u274C Error marking lead as awaitingdisposition:", awaitingErr);
          }
        }
        let effectiveDuration = Number(duration || 0);
        let effectiveTo = String(To || "").trim();
        let effectiveCallStartedAtIso = null;
        try {
          if (CallSid) {
            const { data: sidRow } = await supabaseAdmin.from("twilio_call_logs").select("call_duration,to_number,parent_call_sid,call_started_at").eq("twilio_call_sid", CallSid).maybeSingle();
            const sidDuration = Number(sidRow?.call_duration || 0);
            if (sidDuration > effectiveDuration) effectiveDuration = sidDuration;
            if (!effectiveTo && sidRow?.to_number) effectiveTo = String(sidRow.to_number || "").trim();
            if (sidRow?.call_started_at) effectiveCallStartedAtIso = String(sidRow.call_started_at);
            const parentSid = String(ParentCallSid || sidRow?.parent_call_sid || "").trim();
            if (parentSid) {
              const { data: parentRow } = await supabaseAdmin.from("twilio_call_logs").select("call_duration,to_number,call_started_at").eq("twilio_call_sid", parentSid).maybeSingle();
              const parentDuration = Number(parentRow?.call_duration || 0);
              if (parentDuration > effectiveDuration) effectiveDuration = parentDuration;
              if (!effectiveTo && parentRow?.to_number) effectiveTo = String(parentRow.to_number || "").trim();
              if (!effectiveCallStartedAtIso && parentRow?.call_started_at) effectiveCallStartedAtIso = String(parentRow.call_started_at);
            }
            if (effectiveDuration <= 0) {
              const { data: childRows } = await supabaseAdmin.from("twilio_call_logs").select("call_duration,to_number,call_started_at").or(`parent_call_sid.eq.${CallSid}${ParentCallSid ? `,parent_call_sid.eq.${ParentCallSid}` : ""}`).order("call_duration", { ascending: false }).limit(1);
              const child = Array.isArray(childRows) && childRows.length > 0 ? childRows[0] : null;
              const childDuration = Number(child?.call_duration || 0);
              if (childDuration > effectiveDuration) effectiveDuration = childDuration;
              if (!effectiveTo && child?.to_number) effectiveTo = String(child.to_number || "").trim();
              if (!effectiveCallStartedAtIso && child?.call_started_at) effectiveCallStartedAtIso = String(child.call_started_at);
            }
          }
        } catch (resolveErr) {
          console.warn("\u26A0\uFE0F Failed resolving effective duration/to_number from Twilio logs:", resolveErr);
        }
        if (direction === "outbound" && status === "completed" && effectiveDuration >= 600 && ownerForLog && effectiveTo) {
          try {
            const { logDialMetric: logDialMetric2 } = await Promise.resolve().then(() => (init_agent_dial_metrics_tracker(), agent_dial_metrics_tracker_exports));
            const normalizedPhone = String(effectiveTo).trim().replace(/\D/g, "").slice(-10);
            if (normalizedPhone && normalizedPhone.length >= 10) {
              console.log(`\u26A1 AUTO-LOGGING INSTANT PRESENTATION: agent=${ownerForLog}, phone=${normalizedPhone}, duration=${effectiveDuration}s (>= 600s/10min)`);
              await logDialMetric2(supabaseAdmin, {
                agentEmail: ownerForLog,
                leadPhone: normalizedPhone,
                eventType: "instant_presentation",
                disposition: "instant_presentation",
                callDuration: effectiveDuration
              }).catch((err) => {
                console.error("\u274C Failed to auto-log instant presentation:", err);
              });
              const sourceCallSid = String(ParentCallSid || CallSid || "").trim();
              const dedupeTag = `AUTO_INSTANT_CALL_SID:${sourceCallSid}`;
              if (sourceCallSid) {
                const { data: existingInstant } = await supabaseAdmin.from("appointments").select("id").eq("agent_email", ownerForLog).eq("disposition_source", "instant_presentation").ilike("internal_notes", `%${dedupeTag}%`).limit(1);
                if (!existingInstant || existingInstant.length === 0) {
                  const nowMs = Date.now();
                  const callDurationSeconds = Number(effectiveDuration) || 0;
                  const callStartedMs = effectiveCallStartedAtIso ? new Date(effectiveCallStartedAtIso).getTime() : NaN;
                  const hasStart = Number.isFinite(callStartedMs);
                  const startMs = hasStart ? callStartedMs : nowMs - callDurationSeconds * 1e3;
                  const endMs = Math.max(startMs + 15 * 60 * 1e3, nowMs);
                  const startIso = new Date(startMs).toISOString();
                  const endIso = new Date(endMs).toISOString();
                  const { data: leadRecord } = await masterleadClient.from("masterlead").select("id, taalk_lead_id, first_name, last_name, phone, taalk_market, market, taalk_state, state, city, taalk_city, email, address, taalk_groupcode, taalk_groupname").or(`phone.eq.${normalizedPhone},phone.eq.1${normalizedPhone}`).order("updated_at", { ascending: false }).limit(1);
                  const lead = Array.isArray(leadRecord) && leadRecord.length > 0 ? leadRecord[0] : null;
                  const leadDbId = lead?.id ?? null;
                  const aoLeadId = lead?.taalk_lead_id ?? null;
                  const leadName = `${String(lead?.first_name || "").trim()} ${String(lead?.last_name || "").trim()}`.trim() || "Unknown Lead";
                  const leadMarket = String(lead?.taalk_market || lead?.market || "").trim() || null;
                  const leadState = String(lead?.taalk_state || lead?.state || "").trim().toUpperCase() || null;
                  const leadCity = String(lead?.city || lead?.taalk_city || "").trim() || null;
                  const leadEmail = String(lead?.email || "").trim() || null;
                  const leadAddress = String(lead?.address || "").trim() || null;
                  const leadGroupCode = String(lead?.taalk_groupcode || "").trim() || null;
                  const leadGroupName = String(lead?.taalk_groupname || "").trim() || null;
                  const notes = [
                    `Auto-created from outbound call (${callDurationSeconds}s) after 10-minute instant threshold.`,
                    leadAddress ? `Address: ${leadAddress}` : "",
                    leadGroupCode ? `Group Code: ${leadGroupCode}` : "",
                    leadGroupName ? `Group Name: ${leadGroupName}` : "",
                    leadDbId ? `ML #${leadDbId}` : "",
                    aoLeadId ? `AO Lead ID ${aoLeadId}` : ""
                  ].filter(Boolean).join("\n");
                  const createPayload = {
                    title: `Instant Presentation - ${leadName}`,
                    appointmentType: "presentation",
                    startTime: startIso,
                    endTime: endIso,
                    duration: Math.max(15, Math.round((endMs - startMs) / 6e4)),
                    timezone: "UTC",
                    agentId: ownerForLog,
                    agentEmail: ownerForLog,
                    agentName: ownerForLog.split("@")[0] || ownerForLog,
                    leadId: aoLeadId ?? leadDbId ?? null,
                    leadName,
                    leadPhone: lead?.phone || normalizedPhone,
                    leadEmail,
                    leadCity,
                    leadState,
                    leadMarket,
                    status: "scheduled",
                    dispositionSource: "instant_presentation",
                    outcome: "pending",
                    notes,
                    internalNotes: `${dedupeTag}; PARENT_CALL_SID:${String(ParentCallSid || "").trim() || "none"}`
                  };
                  const dataServiceBase = getAoirailDataServiceBaseUrl() || PRODUCTION_BASE_URL;
                  const createEndpoint = `${dataServiceBase}/api/appointments`;
                  let apiCreateOk = false;
                  try {
                    const createRes = await fetch(createEndpoint, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(createPayload)
                    });
                    if (createRes.ok) {
                      apiCreateOk = true;
                    } else {
                      const errText = await createRes.text().catch(() => "");
                      console.error(`\u274C Instant appointment API create failed: ${createRes.status} ${createRes.statusText} ${errText}`);
                    }
                  } catch (createErr) {
                    console.error("\u274C Instant appointment API create threw:", createErr);
                  }
                  if (!apiCreateOk) {
                    const fallbackPayload = {
                      title: createPayload.title,
                      appointment_type: "presentation",
                      start_time: startIso,
                      end_time: endIso,
                      duration: createPayload.duration,
                      timezone: "UTC",
                      agent_id: createPayload.agentId,
                      agent_email: createPayload.agentEmail,
                      agent_name: createPayload.agentName,
                      lead_id: createPayload.leadId,
                      lead_name: createPayload.leadName,
                      lead_phone: createPayload.leadPhone,
                      lead_email: createPayload.leadEmail,
                      lead_market: createPayload.leadMarket,
                      lead_state: createPayload.leadState,
                      lead_city: createPayload.leadCity,
                      status: "scheduled",
                      confirmation_status: "pending",
                      outcome: "pending",
                      disposition_source: "instant_presentation",
                      notes: createPayload.notes,
                      internal_notes: createPayload.internalNotes,
                      created_at: (/* @__PURE__ */ new Date()).toISOString(),
                      updated_at: (/* @__PURE__ */ new Date()).toISOString()
                    };
                    const { error: insertInstantError } = await supabaseAdmin.from("appointments").insert(fallbackPayload);
                    if (insertInstantError) {
                      console.error("\u274C Fallback instant appointment insert failed:", insertInstantError);
                    }
                  }
                  console.log(`\u2705 Auto-created instant presentation appointment for ${ownerForLog} at ${startIso} (callSid=${sourceCallSid})`);
                } else {
                  console.log(`\u2139\uFE0F Instant presentation already exists for callSid=${sourceCallSid} (skipping duplicate create)`);
                }
              }
            }
          } catch (importErr) {
            console.error("\u274C Failed to import logDialMetric for instant presentation:", importErr);
          }
        }
      } catch (error) {
        console.error(`\u274C CRITICAL ERROR in call-status webhook for ${CallSid}:`, error);
        console.error(`   Error stack:`, error instanceof Error ? error.stack : "No stack trace");
        console.error(`   Request body:`, JSON.stringify(req.body, null, 2));
      }
    }
    res.status(204).end();
  });
  app2.post("/api/twilio/amd-status", async (req, res) => {
    try {
      const { CallSid, AnsweredBy, MachineDetectionDuration } = req.body;
      const agentEmail = req.query.agentEmail || req.body.agent_email || "";
      console.log(`\u{1F4DE} AMD callback received: CallSid=${CallSid}, AnsweredBy=${AnsweredBy}, Duration=${MachineDetectionDuration}ms, agentEmail=${agentEmail}`);
      console.log(`   Full request body:`, JSON.stringify(req.body, null, 2));
      if (!CallSid) {
        console.warn("\u26A0\uFE0F AMD callback missing CallSid - request body:", JSON.stringify(req.body));
        return res.status(200).send("OK");
      }
      if (supabaseAdmin) {
        const { TwilioCallLogger: TwilioCallLogger2 } = await Promise.resolve().then(() => (init_twilio_call_logger(), twilio_call_logger_exports));
        await TwilioCallLogger2.updateAmdResult(CallSid, {
          answeredBy: AnsweredBy || null,
          machineDetectionDurationMs: MachineDetectionDuration ? parseInt(String(MachineDetectionDuration), 10) : null
        });
        const { data: childCalls } = await supabaseAdmin.from("twilio_call_logs").select("twilio_call_sid").eq("parent_call_sid", CallSid).is("answered_by", null);
        if (childCalls && childCalls.length > 0) {
          console.log(`\u{1F4DE} Found ${childCalls.length} child calls with parent ${CallSid} - updating AMD for all`);
          for (const child of childCalls) {
            await TwilioCallLogger2.updateAmdResult(child.twilio_call_sid, {
              answeredBy: AnsweredBy || null,
              machineDetectionDurationMs: MachineDetectionDuration ? parseInt(String(MachineDetectionDuration), 10) : null
            });
          }
        }
      } else {
        console.error("\u274C AMD callback: supabaseAdmin is not available");
      }
      res.status(200).send("OK");
    } catch (error) {
      console.error("\u274C AMD callback error:", error);
      console.error("   Error stack:", error instanceof Error ? error.stack : "No stack trace");
      console.error("   Request body:", JSON.stringify(req.body));
      res.status(200).send("OK");
    }
  });
  try {
    const { registerConnectTestRoutes: registerConnectTestRoutes2 } = await Promise.resolve().then(() => (init_connect_test_routes(), connect_test_routes_exports));
    registerConnectTestRoutes2(app2, client, PRODUCTION_BASE_URL);
  } catch (e) {
    console.warn("[CONNECT_TEST] Failed to register connect test routes on twilio section:", e.message);
  }
  console.log("\u2705 Twilio section routes registered");
}

// server/entry-twilio.ts
init_local_presence_service();
init_hardcoded_config();
var PRODUCTION_BASE_URL2 = PRODUCTION_URL;
process.env.TZ = "America/Los_Angeles";
if (NODE_ENV === "production") {
  console.log = () => {
  };
  console.debug = () => {
  };
  console.info = () => {
  };
  console.warn = () => {
  };
}
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  if (NODE_ENV !== "production") process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
  if (NODE_ENV !== "production") process.exit(1);
});
var app = createApp({ serveSpa: false });
async function main() {
  await registerTwilioRoutes(app);
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found", path: req.path });
    next();
  });
  addErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  const server = http.createServer(app);
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error("Port", port, "in use");
      process.exit(1);
    }
    throw err;
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
  try {
    if (TWILIO_TWIML_APP_SID && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const twilioClient2 = twilio5(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      await twilioClient2.applications(TWILIO_TWIML_APP_SID).update({
        voiceUrl: `${PRODUCTION_BASE_URL2}/webhook/webrtc`,
        voiceMethod: "POST",
        statusCallback: `${PRODUCTION_BASE_URL2}/api/twilio/call-status`,
        statusCallbackMethod: "POST"
      });
      console.log("TwiML App configured");
    }
  } catch (e) {
    console.error("TwiML App config failed:", e);
  }
  try {
    const { registerPostCallHandlers: registerPostCallHandlers2 } = await Promise.resolve().then(() => (init_post_call_handlers(), post_call_handlers_exports));
    registerPostCallHandlers2();
  } catch (e) {
    console.error("[POST_CALL_QUEUE] Failed to register handlers:", e?.message);
  }
  const localPresenceService2 = new LocalPresenceService();
  global.localPresenceService = localPresenceService2;
  localPresenceService2.initialize().catch((e) => console.warn("LocalPresence init:", e));
  try {
    const { WebRTCCallService: WebRTCCallService2 } = await Promise.resolve().then(() => (init_webrtc_call_service(), webrtc_call_service_exports));
    new WebRTCCallService2(server);
    console.log("WebRTC Call Service initialized");
  } catch (e) {
    console.warn("WebRTC Call Service init failed:", e);
  }
  server.listen(port, () => {
    console.log("Twilio server listening on port", port);
  });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
