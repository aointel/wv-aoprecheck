import type { Express } from "express";
import { supabaseAdmin } from "./supabase";

type TrainingModuleSeed = {
  slug: string;
  section: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  icon: string;
  isRequired?: boolean;
  isSupport?: boolean;
  sortOrder: number;
};

type TrainingModuleRecord = {
  id: string;
  slug: string;
  section: string;
  title: string;
  description: string | null;
  estimated_minutes: number | null;
  icon: string | null;
  is_required: boolean | null;
  is_support: boolean | null;
  created_at: string;
  updated_at: string;
};

const SECTION_TITLES: Record<string, string> = {
  welcome: "Welcome",
  ao_intelligence: "AO Intelligence",
  call_connector: "Call Connector Pro",
  ao_meet: "AO Meet",
  ao_recruit: "AO Recruit",
  ao_precheck: "AO Precheck",
  ao_precheck_admin: "AO Precheck Management",
  billing_center: "Billing Center",
  live_call_boardt: "Live Call Board",
  support: "Support & Troubleshooting",
};

const DEFAULT_TRAINING_MODULES: TrainingModuleSeed[] = [
  // Welcome
  {
    slug: "welcome-hero",
    section: "welcome",
    title: "Welcome to AO Intelligence",
    description: "Platform overview and how all the systems connect together.",
    estimatedMinutes: 2,
    icon: "Rocket",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "platform-overview",
    section: "welcome",
    title: "Platform Overview",
    description: "Navigation basics, dashboards, and how to find each product.",
    estimatedMinutes: 3,
    icon: "Rocket",
    isRequired: true,
    sortOrder: 20,
  },
  {
    slug: "profile-setup",
    section: "welcome",
    title: "Profile & Device Setup",
    description: "Setting up your profile, devices, Zoom info, and notifications.",
    estimatedMinutes: 4,
    icon: "Settings",
    isRequired: true,
    sortOrder: 30,
  },
  {
    slug: "credits-intro",
    section: "welcome",
    title: "Credits & Usage",
    description: "Understanding credits, billing basics, and how usage is tracked.",
    estimatedMinutes: 3,
    icon: "CreditCard",
    isRequired: true,
    sortOrder: 40,
  },

  // AO Intelligence (VDP)
  {
    slug: "ao-intelligence-intro",
    section: "ao_intelligence",
    title: "What is AO Intelligence?",
    description: "Inbound distribution overview and expectations.",
    estimatedMinutes: 3,
    icon: "Target",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "ao-intelligence-online",
    section: "ao_intelligence",
    title: "Going Online",
    description: "How to go online, stay connected, and monitor your status.",
    estimatedMinutes: 4,
    icon: "Wifi",
    isRequired: true,
    sortOrder: 20,
  },
  {
    slug: "ao-intelligence-markets",
    section: "ao_intelligence",
    title: "Markets & States",
    description: "Picking the right market and complying with licensing rules.",
    estimatedMinutes: 3,
    icon: "Target",
    isRequired: true,
    sortOrder: 30,
  },
  {
    slug: "ao-intelligence-handling-calls",
    section: "ao_intelligence",
    title: "Handling Live Calls",
    description: "Best practices for answering and dispositioning live transfers.",
    estimatedMinutes: 4,
    icon: "Phone",
    isRequired: true,
    sortOrder: 40,
  },

  // Call Connector Pro
  {
    slug: "ccp-opening",
    section: "call_connector",
    title: "Opening Call Connector Pro",
    description: "Interface tour, queue breakdown, and lead organization.",
    estimatedMinutes: 3,
    icon: "Phone",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "ccp-first-call",
    section: "call_connector",
    title: "Placing Your First Call",
    description: "Dialer controls, click-to-call, and Twilio phone bridge.",
    estimatedMinutes: 4,
    icon: "Phone",
    isRequired: true,
    sortOrder: 20,
  },
  {
    slug: "ccp-dispositions",
    section: "call_connector",
    title: "Lead Dispositions",
    description: "Correctly dispositioning calls and keeping queues clean.",
    estimatedMinutes: 4,
    icon: "CheckSquare",
    isRequired: true,
    sortOrder: 30,
  },
  {
    slug: "ccp-booking",
    section: "call_connector",
    title: "Booking Appointments",
    description: "Using AO Meet and scheduling workflows from the dialer.",
    estimatedMinutes: 4,
    icon: "CalendarCheck",
    isRequired: true,
    sortOrder: 40,
  },
  {
    slug: "ccp-ftc",
    section: "call_connector",
    title: "FTC & Compliance",
    description: "Complying with calling windows and DNC restrictions.",
    estimatedMinutes: 3,
    icon: "AlertCircle",
    isRequired: true,
    sortOrder: 50,
  },

  // AO Meet
  {
    slug: "ao-meet-overview",
    section: "ao_meet",
    title: "AO Meet Overview",
    description: "Scheduling and instant meetings inside AO Meet.",
    estimatedMinutes: 3,
    icon: "PlayCircle",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "ao-meet-best-practices",
    section: "ao_meet",
    title: "Meeting Best Practices",
    description: "Hosting productive client meetings and integrating with AOI.",
    estimatedMinutes: 4,
    icon: "Video",
    isRequired: true,
    sortOrder: 20,
  },

  // AO Precheck
  {
    slug: "ao-precheck-when-to-verify",
    section: "ao_precheck",
    title: "When to Verify",
    description: "Knowing when a verification is required after a sale.",
    estimatedMinutes: 3,
    icon: "ShieldCheck",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "ao-precheck-zoom-setup",
    section: "ao_precheck",
    title: "Setting Up Zoom",
    description: "Preparing your Zoom meeting room for verifications.",
    estimatedMinutes: 3,
    icon: "Video",
    isRequired: true,
    sortOrder: 20,
  },
  {
    slug: "ao-precheck-screenshots",
    section: "ao_precheck",
    title: "Screenshot Requirements",
    description: "Capturing compliant screenshots (screen share and in-person).",
    estimatedMinutes: 3,
    icon: "Camera",
    isRequired: true,
    sortOrder: 30,
  },
  {
    slug: "ao-precheck-submission",
    section: "ao_precheck",
    title: "Submitting Verification",
    description: "Submitting verification paperwork and SMS workflow.",
    estimatedMinutes: 4,
    icon: "CheckSquare",
    isRequired: true,
    sortOrder: 40,
  },

  // AO Precheck Management (for authorized users)
  {
    slug: "ao-precheck-admin-overview",
    section: "ao_precheck_admin",
    title: "AO Precheck Management Overview",
    description: "Monitoring verifications, assignments, and escalation paths.",
    estimatedMinutes: 4,
    icon: "Monitor",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "ao-precheck-admin-review",
    section: "ao_precheck_admin",
    title: "Review & Approval Process",
    description: "How to review submissions, approve, or request corrections.",
    estimatedMinutes: 4,
    icon: "ClipboardCheck",
    isRequired: true,
    sortOrder: 20,
  },

  // AO Recruit
  {
    slug: "ao-recruit-overview",
    section: "ao_recruit",
    title: "AO Recruit Overview",
    description: "Understanding the recruiting pipeline and automation.",
    estimatedMinutes: 3,
    icon: "Users",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "ao-recruit-prospects",
    section: "ao_recruit",
    title: "Building Your Prospect List",
    description: "Finding prospects and organizing outreach.",
    estimatedMinutes: 4,
    icon: "Target",
    isRequired: true,
    sortOrder: 20,
  },
  {
    slug: "ao-recruit-follow-up",
    section: "ao_recruit",
    title: "Follow Up & Onboarding",
    description: "Following up, booking recruit calls, and onboarding flow.",
    estimatedMinutes: 4,
    icon: "Users",
    isRequired: true,
    sortOrder: 30,
  },

  // Billing Center
  {
    slug: "billing-center-overview",
    section: "billing_center",
    title: "Billing Center Overview",
    description: "Navigating billing center and monitoring charges.",
    estimatedMinutes: 3,
    icon: "CreditCard",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "billing-center-invoices",
    section: "billing_center",
    title: "Invoices & Statements",
    description: "Reviewing invoices, statements, and usage charges.",
    estimatedMinutes: 3,
    icon: "FileText",
    isRequired: true,
    sortOrder: 20,
  },

  // Live Call Board (for authorized users)
  {
    slug: "live-call-board-overview",
    section: "live_call_boardt",
    title: "Live Call Board Overview",
    description: "Monitoring live performance and call metrics.",
    estimatedMinutes: 3,
    icon: "BarChart3",
    isRequired: true,
    sortOrder: 10,
  },
  {
    slug: "live-call-board-coaching",
    section: "live_call_boardt",
    title: "Coaching & Alerts",
    description: "Using alerts and coaching tools during live calls.",
    estimatedMinutes: 3,
    icon: "TrendingUp",
    isRequired: true,
    sortOrder: 20,
  },

  // Support & Troubleshooting (required for everyone)
  {
    slug: "support-no-leads",
    section: "support",
    title: "Not Getting Leads",
    description: "Troubleshooting lead delivery issues quickly.",
    estimatedMinutes: 2,
    icon: "HelpCircle",
    isRequired: true,
    isSupport: true,
    sortOrder: 10,
  },
  {
    slug: "support-call-quality",
    section: "support",
    title: "Call Quality Issues",
    description: "Fixing audio problems, delays, or dropped calls.",
    estimatedMinutes: 2,
    icon: "HelpCircle",
    isRequired: true,
    isSupport: true,
    sortOrder: 20,
  },
  {
    slug: "support-vdp",
    section: "support",
    title: "VDP Not Working",
    description: "Solving AO Intelligence availability issues.",
    estimatedMinutes: 2,
    icon: "HelpCircle",
    isRequired: true,
    isSupport: true,
    sortOrder: 30,
  },
  {
    slug: "support-credits",
    section: "support",
    title: "Credit Problems",
    description: "Resolving credit limits, billing holds, and usage alerts.",
    estimatedMinutes: 2,
    icon: "HelpCircle",
    isRequired: true,
    isSupport: true,
    sortOrder: 40,
  },
  {
    slug: "support-verification",
    section: "support",
    title: "Verification Issues",
    description: "Clearing verification blockers and resubmissions.",
    estimatedMinutes: 2,
    icon: "HelpCircle",
    isRequired: true,
    isSupport: true,
    sortOrder: 50,
  },
  {
    slug: "support-contact",
    section: "support",
    title: "Contact Support",
    description: "How to contact the support team and what to include.",
    estimatedMinutes: 1,
    icon: "Users",
    isRequired: true,
    isSupport: true,
    sortOrder: 60,
  },
  {
    slug: "support-add-states",
    section: "support",
    title: "Add Licensed States",
    description: "How to add or update your licensed states in your profile.",
    estimatedMinutes: 2,
    icon: "HelpCircle",
    isRequired: true,
    isSupport: true,
    sortOrder: 70,
  },
  {
    slug: "support-change-market",
    section: "support",
    title: "Change Market",
    description: "How to change your market assignment.",
    estimatedMinutes: 2,
    icon: "HelpCircle",
    isRequired: true,
    isSupport: true,
    sortOrder: 80,
  },
  {
    slug: "support-something-else",
    section: "support",
    title: "Something Else - Contact Support",
    description: "How to submit a support request for other issues.",
    estimatedMinutes: 2,
    icon: "Users",
    isRequired: true,
    isSupport: true,
    sortOrder: 90,
  },
];

const MODULE_SORT_LOOKUP = new Map(
  DEFAULT_TRAINING_MODULES.map((module, index) => [
    module.slug,
    module.sortOrder ?? (index + 1) * 10,
  ])
);

function mapModuleSeedToRow(seed: TrainingModuleSeed) {
  return {
    slug: seed.slug,
    section: seed.section,
    title: seed.title,
    description: seed.description,
    estimated_minutes: seed.estimatedMinutes,
    icon: seed.icon,
    is_required: seed.isRequired ?? true,
    is_support: seed.isSupport ?? false,
  };
}

async function ensureTrainingModulesExist() {
  if (!supabaseAdmin) {
    console.error("❌ Supabase admin client not configured – cannot seed training modules");
    return;
  }

  const seedRows = DEFAULT_TRAINING_MODULES.map(mapModuleSeedToRow);
  const { error } = await supabaseAdmin
    .from("platform_training_modules")
    .upsert(seedRows, { onConflict: "slug" });

  if (error) {
    console.error("❌ Failed to seed platform training modules:", error);
  }
}

async function fetchModulesForUser(userEmail: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not available");
  }

  await ensureTrainingModulesExist();

  const email = userEmail.toLowerCase();

  const { data: modules, error: modulesError } = await supabaseAdmin
    .from<TrainingModuleRecord>("platform_training_modules")
    .select("*");

  if (modulesError) {
    console.error("❌ Supabase fetch modules error:", modulesError);
    throw new Error(
      `Failed to load training modules: ${modulesError.message ?? modulesError.details ?? modulesError.code}`
    );
  }

  // Hardcode training completion for demo user(s)
  if (email === "aointeldemo@aoglobelife.com") {
    try {
      const rows =
        modules?.map((module) => ({
          user_email: email,
          module_id: module.id,
          completed_at: new Date().toISOString(),
        })) ?? [];

      if (rows.length > 0) {
        await supabaseAdmin
          .from("agent_training_progress")
          .upsert(rows, { onConflict: "user_email,module_id" });
      }
    } catch (error) {
      console.error("⚠️ Failed to auto-complete training for demo user:", error);
    }
  }

  const { data: progress, error: progressError } = await supabaseAdmin
    .from("agent_training_progress")
    .select("module_id, completed_at, user_email")
    .eq("user_email", email);

  if (progressError && progressError.code !== "PGRST116") {
    throw new Error(`Failed to load training progress: ${progressError.message}`);
  }

  const completedModuleIds = new Map<string, string | null>();
  (progress ?? []).forEach((row: any) => {
    if (row?.module_id) {
      completedModuleIds.set(row.module_id, row.completed_at ?? null);
    }
  });

  const sectionSummaries = new Map<
    string,
    {
      id: string;
      title: string;
      requiredModules: number;
      requiredCompleted: number;
    }
  >();

  const modulePayload = (modules ?? [])
    .map((module) => {
    const completedAt = completedModuleIds.get(module.id) ?? null;
    const isRequired = module.is_required !== false;
    const sortOrder =
      MODULE_SORT_LOOKUP.get(module.slug) ?? Number.MAX_SAFE_INTEGER;

    const summary = sectionSummaries.get(module.section) ?? {
      id: module.section,
      title: SECTION_TITLES[module.section] ?? module.section,
      requiredModules: 0,
      requiredCompleted: 0,
    };

    if (isRequired) {
      summary.requiredModules += 1;
      if (completedAt) {
        summary.requiredCompleted += 1;
      }
    }

    sectionSummaries.set(module.section, summary);

    return {
      id: module.id,
      slug: module.slug,
      section: module.section,
      title: module.title,
      description: module.description,
      estimatedMinutes: module.estimated_minutes,
      icon: module.icon,
      isRequired,
      isSupport: module.is_support ?? false,
      sortOrder,
      completed: completedAt != null,
      completedAt,
    };
  })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sections = Array.from(sectionSummaries.values()).map((section) => ({
    ...section,
    completed:
      section.requiredModules === 0
        ? false
        : section.requiredCompleted >= section.requiredModules,
  }));

  const completedSections = sections
    .filter((section) => section.completed)
    .map((section) => section.id);

  return {
    modules: modulePayload,
    sections,
    completedSections,
    userEmail: email,
  };
}

export function registerTrainingRoutes(app: Express) {
  app.get("/api/platform-training/modules", async (req, res) => {
    try {
      const headerEmail =
        (req.headers["x-user-email"] as string) ||
        (req.headers["user-email"] as string) ||
        (req.headers["User-Email"] as string);
      const sessionEmail = (req.session as any)?.user?.email;
      const userEmail = headerEmail || sessionEmail;

      if (!userEmail) {
        return res.status(401).json({ success: false, error: "User email required" });
      }

      const payload = await fetchModulesForUser(userEmail);
      res.json({ success: true, ...payload });
    } catch (error) {
      console.error("❌ Platform training modules error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load platform training modules",
        details: error instanceof Error ? error.message : error,
      });
    }
  });

  app.post("/api/platform-training/progress", async (req, res) => {
    try {
      const headerEmail =
        (req.headers["x-user-email"] as string) ||
        (req.headers["user-email"] as string) ||
        (req.headers["User-Email"] as string);
      const sessionEmail = (req.session as any)?.user?.email;
      const userEmail = headerEmail || sessionEmail;

      if (!userEmail) {
        return res.status(401).json({ success: false, error: "User email required" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, error: "Service unavailable" });
      }

      const { moduleSlug, completed = true } = req.body ?? {};

      if (!moduleSlug || typeof moduleSlug !== "string") {
        return res.status(400).json({ success: false, error: "moduleSlug required" });
      }

      await ensureTrainingModulesExist();

      const { data: moduleRecord, error: moduleError } = await supabaseAdmin
        .from<TrainingModuleRecord>("platform_training_modules")
        .select("*")
        .eq("slug", moduleSlug)
        .maybeSingle();

      if (moduleError) {
        console.error("❌ Failed to lookup training module:", moduleError);
        return res
          .status(500)
          .json({ success: false, error: "Failed to lookup module" });
      }

      if (!moduleRecord) {
        return res
          .status(404)
          .json({ success: false, error: "Training module not found" });
      }

      const normalizedEmail = userEmail.toLowerCase();

      let userId: string | null = null;
      try {
        const { data: userLookup, error: userLookupError } =
          await supabaseAdmin.auth.admin.listUsers({ email: normalizedEmail });
        if (userLookupError) {
          console.error("❌ Supabase admin user lookup error:", userLookupError);
        } else {
          userId =
            userLookup?.users?.find(
              (user) => user.email?.toLowerCase() === normalizedEmail
            )?.id ?? null;
        }
      } catch (lookupError) {
        console.error("❌ Supabase admin user lookup threw:", lookupError);
      }

      if (!userId) {
        return res.status(404).json({
          success: false,
          error: "User not found in authentication service",
        });
      }

      if (completed) {
        const upsertPayload = {
          user_email: normalizedEmail,
          user_id: userId,
          module_id: moduleRecord.id,
          completed_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabaseAdmin
          .from("agent_training_progress")
          .upsert(upsertPayload, { onConflict: "user_email,module_id" });

        if (upsertError) {
          console.error("❌ Failed to save training progress:", upsertError);
          return res
            .status(500)
            .json({ success: false, error: "Failed to save progress" });
        }
      } else {
        const { error: deleteError } = await supabaseAdmin
          .from("agent_training_progress")
          .delete()
          .eq("user_email", normalizedEmail)
          .eq("module_id", moduleRecord.id);

        if (deleteError) {
          console.error("❌ Failed to clear training progress:", deleteError);
          return res
            .status(500)
            .json({ success: false, error: "Failed to clear progress" });
        }
      }

      const payload = await fetchModulesForUser(normalizedEmail);
      res.json({ success: true, ...payload });
    } catch (error) {
      console.error("❌ Platform training progress error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update training progress",
      });
    }
  });

  // Admin override to mark all modules complete for a user
  app.post("/api/platform-training/admin/complete", async (req, res) => {
    try {
      const userEmail = (req.body?.userEmail as string)?.toLowerCase();
      if (!userEmail) {
        return res.status(400).json({ success: false, error: "userEmail is required" });
      }

      const { data: modules, error: moduleError } = await supabaseAdmin
        .from("platform_training_modules")
        .select("id");

      if (moduleError) {
        console.error("❌ Failed to fetch training modules:", moduleError);
        return res.status(500).json({ success: false, error: "Failed to fetch training modules" });
      }

      const rows = modules?.map((module) => ({
        user_email: userEmail,
        module_id: module.id,
        completed_at: new Date().toISOString(),
      })) ?? [];

      if (rows.length === 0) {
        return res.json({ success: true, message: "No modules to complete" });
      }

      const { error: upsertError } = await supabaseAdmin
        .from("agent_training_progress")
        .upsert(rows, { onConflict: "user_email,module_id" });

      if (upsertError) {
        console.error("❌ Failed to upsert training progress:", upsertError);
        return res.status(500).json({ success: false, error: "Failed to mark training complete" });
      }

      res.json({ success: true, message: `Training completed for ${userEmail}` });
    } catch (error) {
      console.error("❌ Training admin complete failed:", error);
      res.status(500).json({ success: false, error: "Failed to mark training complete" });
    }
  });
}


