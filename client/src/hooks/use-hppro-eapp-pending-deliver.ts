import { useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

/** Must match EappSync `HttpListener` prefix (`http://localhost:7432/`) — `127.0.0.1` can fail URL routing on Windows. */
const LOCAL_INJECT = 'http://localhost:7432/inject-next';

function flattenInjectStrings(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

/**
 * While Present mode is on, poll AOIrail for HPPRO completion payloads and POST them to
 * local EappSync.exe (inject-next). Railway cannot reach the agent's localhost; the browser bridges.
 */
export function useHpproEappPendingDeliver(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      try {
        const res = await apiRequest('GET', '/api/hppro/eapp-pending');
        const data = (await res.json()) as {
          pending?: { id?: number; inject?: Record<string, unknown> } | null;
        };
        const p = data.pending;
        if (!p?.id || !p.inject || typeof p.inject !== 'object') return;

        const body = flattenInjectStrings(p.inject);
        const lr = await fetch(LOCAL_INJECT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          mode: 'cors',
        });
        if (!lr.ok) {
          const hint = await lr.text().catch(() => '');
          console.warn(
            '[HPPRO→eApp] POST',
            LOCAL_INJECT,
            'failed:',
            lr.status,
            hint.slice(0, 300),
          );
          return;
        }

        await apiRequest('POST', `/api/hppro/eapp-pending/${p.id}/ack`);
      } catch (e) {
        /* No pending row, 401 on GET, EappSync unreachable, mixed-content block, etc. */
        if (import.meta.env.DEV) {
          console.warn('[HPPRO→eApp] poll/inject error:', e);
        }
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, 3000);
    void tick();

    return () => clearInterval(id);
  }, [enabled]);
}
