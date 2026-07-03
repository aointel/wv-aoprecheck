/**
 * Taalk API client — uses `server/hardcoded-config.ts` only.
 */

import {
  TAALK_API_BASE_URL,
  TAALK_API_TOKEN,
  TAALK_VDP_DB,
} from "./hardcoded-config.js";

const taalkBase = TAALK_API_BASE_URL.replace(/\/$/, "");

export function isTaalkTokenConfigured(): boolean {
  return TAALK_API_TOKEN.length > 0;
}

async function taalkFetch(path: string, opts: RequestInit = {}): Promise<any> {
  if (!TAALK_API_TOKEN) {
    throw new Error(`Taalk API token missing — set TAALK_API_TOKEN in server/hardcoded-config.ts`);
  }
  const url = `${taalkBase}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TAALK_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Taalk ${res.status} ${res.statusText} — ${path}: ${text}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json();
  return { success: true };
}

// ── Real-Time Status (online agents only) ──
export async function fetchRTS(): Promise<any[]> {
  const data = await taalkFetch(
    `/api/vdp/rts?db=${encodeURIComponent(TAALK_VDP_DB)}`
  );
  return data?.payload?.agents ?? data?.payload ?? [];
}

// ── Full agent roster ──
export async function fetchAllAgents(): Promise<any[]> {
  const data = await taalkFetch("/api/vdp_agents");
  return data?.payload ?? [];
}

// ── Campaign list (paginated) ──
export async function fetchCampaigns(page = 1, pageSize = 200): Promise<{
  campaigns: any[];
  total: number;
}> {
  const data = await taalkFetch(
    `/api/campaign2s?page=${page}&pageSize=${pageSize}`
  );
  const campaigns = data?.payload ?? [];
  const total = data?.total ?? campaigns.length;
  return { campaigns: Array.isArray(campaigns) ? campaigns : [], total };
}

// Campaign IDs that must always be included (not returned by paginated list)
const PINNED_CAMPAIGN_IDS = ['68cc2de5f67f5aeafec89b3b'];

export async function fetchAllCampaigns(): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const { campaigns, total } = await fetchCampaigns(page, 200);
    all.push(...campaigns);
    if (all.length >= total || campaigns.length === 0) break;
    page++;
    if (page > 20) break;
  }

  // Fetch pinned campaigns by ID directly (they may not appear in paginated list)
  const existingIds = new Set(all.map((c: any) => c._id));
  for (const id of PINNED_CAMPAIGN_IDS) {
    if (existingIds.has(id)) continue;
    try {
      const data = await taalkFetch(`/api/campaign2s/${id}`);
      const c = data?.payload ?? data;
      if (c?._id) all.push(c);
    } catch { /* non-critical */ }
  }
  return all;
}

export async function updateCampaignRate(
  id: string,
  limitPerHour: number
): Promise<any> {
  return taalkFetch(`/api/campaign2s/${id}`, {
    method: "POST",
    body: JSON.stringify({ limitPerHour }),
  });
}

export async function pauseCampaign(id: string): Promise<any> {
  return taalkFetch(`/api/campaign2s/${id}/pause`, { method: "POST" });
}

export async function resumeCampaign(id: string): Promise<any> {
  return taalkFetch(`/api/campaign2s/${id}/resume`, { method: "POST" });
}

export async function suspendAgent(mongoId: string): Promise<any> {
  return taalkFetch(`/api/vdp_agents/${mongoId}`, {
    method: "POST",
    body: JSON.stringify({ suspended: true }),
  });
}

export async function unsuspendAgent(mongoId: string): Promise<any> {
  return taalkFetch(`/api/vdp_agents/${mongoId}`, {
    method: "POST",
    body: JSON.stringify({ suspended: false }),
  });
}

// ── Update agent rank (priority in queue) ──
export async function updateAgentRank(mongoId: string, rank: number): Promise<any> {
  return taalkFetch(`/api/vdp_agents/${mongoId}`, {
    method: 'POST',
    body: JSON.stringify({ rank }),
  });
}
