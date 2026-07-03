const BASE = '/api';

/** Pull Supabase access token from localStorage (set by the main AOIrail app's Supabase client) */
function getSupabaseToken(): string {
  try {
    // Supabase stores session under keys like "sb-<ref>-auth-token"
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const token = parsed?.access_token || parsed?.session?.access_token || '';
          if (token) return token;
        }
      }
    }
  } catch { /* ignore */ }
  return '';
}

async function apiFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const token = getSupabaseToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader, ...(opts.headers as any ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

/** Authenticated fetch for use in components — passes Supabase token automatically */
export async function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getSupabaseToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers as any ?? {}), ...authHeader },
  });
}

export const api = {
  // Agents
  getRTS: () => apiFetch('/agents/rts'),
  getRoster: () => apiFetch('/agents/roster'),
  suspendAgent: (mongoId: string) => apiFetch(`/agents/${mongoId}/suspend`, { method: 'POST' }),
  unsuspendAgent: (mongoId: string) => apiFetch(`/agents/${mongoId}/unsuspend`, { method: 'POST' }),

  // Campaigns
  getCampaigns: () => apiFetch('/campaigns'),
  setCampaignRate: (id: string, limitPerHour: number) =>
    apiFetch(`/campaigns/${id}/rate`, { method: 'POST', body: JSON.stringify({ limitPerHour }) }),
  pauseCampaign: (id: string) => apiFetch(`/campaigns/${id}/pause`, { method: 'POST' }),
  resumeCampaign: (id: string) => apiFetch(`/campaigns/${id}/resume`, { method: 'POST' }),
  bulkPause: () => apiFetch('/campaigns/bulk/pause', { method: 'POST' }),
  bulkResume: () => apiFetch('/campaigns/bulk/resume', { method: 'POST' }),

  // Auto-management
  getAutoLog: () => apiFetch('/auto/log'),
  toggleAuto: (enabled: boolean) => apiFetch('/auto/toggle', { method: 'POST', body: JSON.stringify({ enabled }) }),
  setOverride: (agentId: number, override: boolean) =>
    apiFetch(`/auto/override/${agentId}`, { method: 'POST', body: JSON.stringify({ override }) }),

  // Misc
  getStats: () => apiFetch('/stats'),
  forceRefresh: () => apiFetch('/refresh', { method: 'POST' }),
};
