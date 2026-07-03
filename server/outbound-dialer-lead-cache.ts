import { supabaseAdmin } from "./supabase";
import { masterleadClient } from "./local-masterlead-client";

interface OutboundLeadRecord {
  id: number | string;
  taalk_lead_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  state?: string | null;
  cnresolution?: string | null;
  cn_email?: string | null;
  updated_at?: string | null;
  is_hot_lead?: boolean | null;
  isHotLead?: boolean | null;
  source_table?: string | null;
  taalk_market?: string | null;
  market?: string | null;
  associate_id?: number | null;
  ao_lead_box?: string | null;
  priority_score?: number | null;
}

export interface CachedLead {
  id: string | number;
  taalk_lead_id?: string | null;
  name: string;
  phone?: string | null;
  state?: string | null;
  cnresolution?: string | null;
  updated_at?: string | null;
  cn_email?: string | null;
  is_hot_lead?: boolean | null;
  isHotLead?: boolean | null;
  source_table?: string | null;
  taalk_market?: string | null;
  market?: string | null;
  associate_id?: number | null;
  ao_lead_box?: string | null;
  aoLeadBox?: string | null;
  priority_score?: number | null;
}

interface AgentCacheEntry {
  leads: CachedLead[];
  fetchedAt: number;
}

class OutboundDialerLeadCache {
  private cache = new Map<string, AgentCacheEntry>();
  private inFlightLoads = new Map<string, Promise<CachedLead[]>>();
  private lastErrors = new Map<string, string>();
  private readonly ttlMs = 3 * 60 * 1000; // 3 minutes - stale leads reassign faster

  async getAgentLeads(agentEmail: string, forceRefresh = false): Promise<CachedLead[]> {
    if (!agentEmail) return [];

    const normalizedEmail = agentEmail.trim().toLowerCase();
    const cached = this.cache.get(normalizedEmail);
    const now = Date.now();

    if (!forceRefresh && cached && now - cached.fetchedAt < this.ttlMs) {
      this.lastErrors.delete(normalizedEmail);
      return cached.leads;
    }

    return this.loadAgentLeads(normalizedEmail);
  }

  async searchAgentLeads(agentEmail: string, query: string, limit = 50): Promise<CachedLead[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Search directly in database instead of loading all leads into cache
    // This is much more efficient for agents with 70k+ leads
    return this.searchLeadsInDatabase(agentEmail, query.trim(), limit);
  }

  private async searchLeadsInDatabase(agentEmail: string, query: string, limit: number): Promise<CachedLead[]> {
    if (!supabaseAdmin) {
      console.error("❌ Supabase admin client not configured - cannot search leads");
      return [];
    }

    try {
      const normalizedEmail = agentEmail.trim().toLowerCase();
      const normalizedQuery = query.toLowerCase();
      const digitsOnlyQuery = normalizedQuery.replace(/\D/g, "");

      const selectCols = "id, first_name, last_name, phone, state, cnresolution, cn_email, taalk_lead_id, updated_at, is_hot_lead, taalk_market, associate_id, ao_lead_box, priority_score";
      let dbQuery = masterleadClient.from('masterlead')
        .select(selectCols);

      // Strict ownership for outbound dialer: only current cn_email owner + pending rows.
      dbQuery = dbQuery
        .eq("cn_email", normalizedEmail)
        .or("cnresolution.eq.pending,cnresolution.is.null");

      // If query contains digits, search phone and taalk_lead_id
      if (digitsOnlyQuery.length >= 3) {
        dbQuery = dbQuery.or(`phone.ilike.%${digitsOnlyQuery}%,taalk_lead_id.ilike.%${normalizedQuery}%`);
      } else {
        // Search by name (first_name or last_name) or state
        dbQuery = dbQuery.or(`first_name.ilike.%${normalizedQuery}%,last_name.ilike.%${normalizedQuery}%,state.ilike.%${normalizedQuery}%`);
      }

      const { data, error } = await dbQuery
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error(`❌ Failed to search leads in database for ${normalizedEmail}:`, error);
        return [];
      }

      // Transform and filter results (additional client-side filtering for better matching)
      const transformed = (data || []).map(this.transformLead);
      
      // Additional filtering to ensure we match the query properly
      const normalizedQueryLower = normalizedQuery.toLowerCase();
      const digitsOnly = digitsOnlyQuery;
      
      const filtered = transformed.filter((lead) => {
        const nameLower = lead.name.toLowerCase();
        const nameMatch = nameLower.includes(normalizedQueryLower);
        const firstNameMatch = nameLower.split(" ")[0]?.includes(normalizedQueryLower) ?? false;
        const lastNameMatch = nameLower.split(" ").slice(1).join(" ").includes(normalizedQueryLower);
        const stateMatch = lead.state?.toLowerCase().includes(normalizedQueryLower) ?? false;
        const phoneMatch = digitsOnly
          ? (lead.phone || "").replace(/\D/g, "").includes(digitsOnly)
          : (lead.phone || "").toLowerCase().includes(normalizedQueryLower);
        const taalkMatch = lead.taalk_lead_id?.toLowerCase().includes(normalizedQueryLower) ?? false;

        return nameMatch || firstNameMatch || lastNameMatch || stateMatch || phoneMatch || taalkMatch;
      });

      return filtered.slice(0, limit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Unexpected error searching leads in database:", errorMessage);
      return [];
    }
  }

  async refreshAgentLeads(agentEmail: string): Promise<CachedLead[]> {
    return this.loadAgentLeads(agentEmail.trim().toLowerCase(), true);
  }

  private async loadAgentLeads(agentEmail: string, force = false): Promise<CachedLead[]> {
    if (!supabaseAdmin) {
      console.error("❌ Supabase admin client not configured - cannot load leads into cache");
      return [];
    }

    if (!force && this.inFlightLoads.has(agentEmail)) {
      return this.inFlightLoads.get(agentEmail)!;
    }

    const loadPromise = (async () => {
      try {
        console.log(`🧠 Loading outbound dialer leads for ${agentEmail}${force ? " (forced)" : ""}`);

        // Strict ownership for outbound dialer cache: current cn_email owner only.
        const CACHE_LEAD_LIMIT = 200000;

        const selectCols = "id, first_name, last_name, phone, state, cnresolution, cn_email, taalk_lead_id, updated_at, is_hot_lead, taalk_market, associate_id, ao_lead_box, priority_score";
        const baseQuery = masterleadClient.from('masterlead')
          .select(selectCols)
          .eq("cn_email", agentEmail)
          .or("cnresolution.eq.pending,cnresolution.is.null")
          .order("updated_at", { ascending: false })
          .limit(CACHE_LEAD_LIMIT);

        let data: OutboundLeadRecord[] | null = null;
        let error: { message?: string } | null = null;

        const result = await baseQuery;
        error = result.error;
        data = result.data as OutboundLeadRecord[] | null;

        if (error) {
          const errorMessage = error.message ?? JSON.stringify(error);
          console.error("❌ Failed to fetch leads for cache:", errorMessage);
          this.lastErrors.set(agentEmail, errorMessage);
          return [];
        }

        const filtered = (data || []).filter((lead) => {
          const emailMatch = (lead.cn_email || "").toLowerCase() === agentEmail;
          const res = (lead.cnresolution || "").toLowerCase();
          const pendingMatch = res === "pending" || res === "";
          return emailMatch && pendingMatch;
        });
        const transformed = filtered.map((l) => this.transformLead(l as OutboundLeadRecord));
        this.cache.set(agentEmail, { leads: transformed, fetchedAt: Date.now() });
        this.lastErrors.delete(agentEmail);
        return transformed;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("❌ Unexpected error loading leads into cache:", errorMessage);
        this.lastErrors.set(agentEmail, errorMessage);
        return [];
      } finally {
        this.inFlightLoads.delete(agentEmail);
      }
    })();

    this.inFlightLoads.set(agentEmail, loadPromise);
    return loadPromise;
  }

  private transformLead(lead: OutboundLeadRecord): CachedLead {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown Lead";
    const aoBox = lead.ao_lead_box ?? null;
    return {
      id: lead.id,
      taalk_lead_id: lead.taalk_lead_id,
      name,
      phone: lead.phone,
      state: lead.state || null,
      cnresolution: lead.cnresolution || null,
      updated_at: lead.updated_at || null,
      cn_email: lead.cn_email || null,
      is_hot_lead: lead.is_hot_lead || null,
      isHotLead: lead.is_hot_lead || null,
      source_table: lead.source_table || null,
      taalk_market: lead.taalk_market || null,
      market: lead.market || null,
      associate_id: lead.associate_id ?? null,
      ao_lead_box: aoBox,
      aoLeadBox: aoBox,
      priority_score: lead.priority_score ?? null,
    };
  }

  getLastError(agentEmail: string): string | undefined {
    return this.lastErrors.get(agentEmail.trim().toLowerCase());
  }

  clearCache(agentEmail: string): void {
    const normalizedEmail = agentEmail.trim().toLowerCase();
    this.cache.delete(normalizedEmail);
    this.inFlightLoads.delete(normalizedEmail);
    this.lastErrors.delete(normalizedEmail);
    console.log(`🗑️ Cleared cache for ${normalizedEmail}`);
  }
}

export const outboundDialerLeadCache = new OutboundDialerLeadCache();

// Optional helper to warm cache for a list of agents
export async function preloadAgentLeads(agentEmails: string[]): Promise<void> {
  await Promise.all(agentEmails.map((email) => outboundDialerLeadCache.getAgentLeads(email)));
}

