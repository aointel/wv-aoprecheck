import { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { AgentTable } from './components/AgentTable';
import { LiveQueue } from './components/LiveQueue';
import { ActivityFeed } from './components/ActivityFeed';
import { ReactorPanel } from './components/ReactorPanel';
import { Analytics } from './components/Analytics';
import type { AgentScore } from './components/AgentTable';

type View = 'dashboard' | 'live' | 'analytics';

export default function App() {
  const data = useWebSocket();
  const [view, setView] = useState<View>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('aoi-theme') as 'dark' | 'light' | null;
    // AOI Command defaults to light mode for all views.
    return saved === 'light' ? 'light' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('aoi-theme', theme);
  }, [theme]);
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [creditsByAssociateId, setCreditsByAssociateId] = useState<Record<string, number>>({});
  const [agentScores, setAgentScores] = useState<Record<string, AgentScore>>({});
  const [reactorOpen, setReactorOpen] = useState(false);
  const [liveFeedLimit, setLiveFeedLimit] = useState(24);
  const [viewer, setViewer] = useState<{ email: string | null; isSysop: boolean; mgaName: string | null }>({
    email: null,
    isSysop: false,
    mgaName: null,
  });

  useEffect(() => {
    fetch('/api/viewer-context')
      .then((r) => (r.ok ? r.json() : null))
      .then((ctx) => {
        if (ctx) setViewer({
          email: ctx.email || null,
          isSysop: ctx.isSysop === true,
          mgaName: ctx.mgaName || null,
        });
      })
      .catch(() => {});
  }, []);

  const visibleMergedAgents = useMemo(() => {
    if (viewer.isSysop || !viewer.mgaName) return data.mergedAgents;
    const targetMga = viewer.mgaName.toLowerCase().trim();
    return data.mergedAgents.filter((a) => {
      const agentMga = String(a.mgaName || '').toLowerCase().trim();
      return agentMga === targetMga || String(a.email || '').toLowerCase().trim() === viewer.email;
    });
  }, [data.mergedAgents, viewer]);

  const visibleEmails = useMemo(() => new Set(visibleMergedAgents.map((a) => String(a.email || '').toLowerCase().trim())), [visibleMergedAgents]);
  const visibleAgents = useMemo(() => data.agents.filter((a) => {
    const email = `${(a.firstName || '').toLowerCase()}${(a.lastName || '').toLowerCase()}@aoglobelife.com`.replace(/\s+/g, '');
    return visibleEmails.has(email);
  }), [data.agents, visibleEmails]);
  const visibleActivitySummary = useMemo(() => {
    const idSet = new Set(visibleMergedAgents.map((a) => a.id));
    return data.activitySummary.filter((a) => idSet.has(a.agentId));
  }, [data.activitySummary, visibleMergedAgents]);
  const visibleQueuePositions = useMemo(() => {
    const idSet = new Set(visibleMergedAgents.map((a) => a.id));
    return data.queuePositions.filter((q) => idSet.has(q.agentId));
  }, [data.queuePositions, visibleMergedAgents]);
  const visibleAgentHealth = useMemo(() => {
    return data.agentHealth.filter((h) => visibleEmails.has(String(h.email || '').toLowerCase().trim()));
  }, [data.agentHealth, visibleEmails]);

  const scopedStats = useMemo(() => {
    const s = { ...data.stats };
    s.totalOnline = visibleMergedAgents.filter((a) => a.inboundEnabled || a.outboundEnabled).length;
    s.totalBusy = visibleMergedAgents.filter((a) => a.status === 'busy' || a.webrtcStatus === 'on_call' || a.webrtcStatus === 'dialing' || a.webrtcStatus === 'ringing').length;
    s.totalIdle = visibleMergedAgents.filter((a) => a.status === 'idle' || a.webrtcStatus === 'idle').length;
    s.totalAway = visibleMergedAgents.filter((a) => a.status === 'away').length;
    s.totalOffline = Math.max(0, visibleMergedAgents.length - s.totalOnline);
    return s;
  }, [data.stats, visibleMergedAgents]);

  const [teamDrb, setTeamDrb] = useState({ d: 0, r: 0, b: 0, i: 0 });
  const [drbByEmail, setDrbByEmail] = useState<Record<string, { d: number; r: number; b: number; i: number }>>({});
  const answerRate = teamDrb.d > 0 ? Math.round((teamDrb.r / teamDrb.d) * 100) : 0;

  const topAgentsByDrb = useMemo(() => {
    return visibleMergedAgents
      .map((a) => ({
        email: String(a.email || '').toLowerCase().trim(),
        name: a.fullName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || String(a.email || 'Unknown'),
        d: Number(drbByEmail[String(a.email || '').toLowerCase().trim()]?.d || 0),
        r: Number(drbByEmail[String(a.email || '').toLowerCase().trim()]?.r || 0),
        b: Number(drbByEmail[String(a.email || '').toLowerCase().trim()]?.b || 0),
      }))
      .sort((a, b) => {
        if (b.d !== a.d) return b.d - a.d;
        if (b.r !== a.r) return b.r - a.r;
        if (b.b !== a.b) return b.b - a.b;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [visibleMergedAgents, drbByEmail]);

  const liveEvents = useMemo(() => {
    const active = data.activeCalls.map((call, idx) => ({
      id: `active-${call.agentId}-${call.startedAt}-${idx}`,
      ts: new Date(call.startedAt).getTime(),
      kind: 'active' as const,
      title: `${call.agentName} on call`,
      subtitle: `${call.leadName || 'Unknown'} · ${call.market || 'Unknown'}`,
      meta: `${Math.max(0, Math.floor(Number(call.duration || 0) / 60))}m`,
    }));
    const completed = data.completedTransfers.map((t, idx) => ({
      id: `completed-${t.agentId}-${t.completedAt}-${idx}`,
      ts: new Date(t.completedAt).getTime(),
      kind: 'completed' as const,
      title: `${t.agentName} completed transfer`,
      subtitle: `${t.leadName || 'Unknown'} · ${t.market || 'Unknown'}`,
      meta: `${Math.max(0, Math.floor(Number(t.callDuration || 0) / 60))}m`,
    }));
    const missed = data.missedTransfers.map((m, idx) => ({
      id: `missed-${m.phone}-${m.missedAt}-${idx}`,
      ts: new Date(m.missedAt).getTime(),
      kind: 'missed' as const,
      title: `Missed transfer`,
      subtitle: `${m.leadName || 'Unknown'} · ${m.market || 'Unknown'}`,
      meta: `${(m.missedBy || []).length} agent(s)`,
    }));
    const actions = data.actionLog.map((a, idx) => ({
      id: `action-${a.id || idx}`,
      ts: new Date(a.timestamp).getTime(),
      kind: 'action' as const,
      title: `${a.agentName}: ${a.action}`,
      subtitle: a.detail || '',
      meta: a.success ? 'ok' : 'fail',
    }));
    return [...active, ...completed, ...missed, ...actions]
      .sort((a, b) => b.ts - a.ts);
  }, [data.activeCalls, data.completedTransfers, data.missedTransfers, data.actionLog]);

  const visibleLiveEvents = useMemo(() => liveEvents.slice(0, liveFeedLimit), [liveEvents, liveFeedLimit]);

  useEffect(() => {
    setLiveFeedLimit(24);
  }, [view]);

  useEffect(() => {
    const load = async () => {
      try {
        // Primary source: same DRB feed AgentTable uses.
        const drbRes = await fetch(`/api/agents/drb?_ts=${Date.now()}`, { cache: 'no-store' });
        const drbPayload = drbRes.ok ? await drbRes.json().catch(() => null) : null;
        const drbMap = (drbPayload?.drb && typeof drbPayload.drb === 'object') ? drbPayload.drb as Record<string, { d?: number; r?: number; b?: number; i?: number }> : null;
        const rawTeamDials = Number(drbPayload?.rawTeamDials || 0);
        if (drbMap) {
          let d = 0, r = 0, b = 0, i = 0;
          const nextByEmail: Record<string, { d: number; r: number; b: number; i: number }> = {};
          for (const row of Object.values(drbMap)) {
            d += Number(row?.d || 0);
            r += Number(row?.r || 0);
            b += Number(row?.b || 0);
            i += Number(row?.i || 0);
          }
          for (const [email, row] of Object.entries(drbMap)) {
            const normalized = String(email || '').toLowerCase().trim();
            if (!normalized) continue;
            nextByEmail[normalized] = {
              d: Number(row?.d || 0),
              r: Number(row?.r || 0),
              b: Number(row?.b || 0),
              i: Number(row?.i || 0),
            };
          }
          if (Object.keys(drbMap).length > 0) {
            if (rawTeamDials > 0) d = rawTeamDials;
            setTeamDrb({ d, r, b, i });
            setDrbByEmail(nextByEmail);
            return;
          }
        }

        // Secondary source: team endpoint.
        const teamRes = await fetch(`/api/agent-daily-stats/team?_ts=${Date.now()}`, { cache: 'no-store' });
        const teamPayload = teamRes.ok ? await teamRes.json().catch(() => null) : null;
        if (Array.isArray(teamPayload?.agents)) {
          let d = 0, r = 0, b = 0, i = 0;
          const nextByEmail: Record<string, { d: number; r: number; b: number; i: number }> = {};
          for (const a of teamPayload.agents) {
            const rowDials = Number(a?.dials) || 0;
            d += rowDials;
            r += Number(a?.reached) || 0;
            b += Number(a?.booked) || 0;
            i += Number(a?.instants) || 0;
            const normalized = String(a?.agent_email || a?.email || '').toLowerCase().trim();
            if (!normalized) continue;
            nextByEmail[normalized] = {
              d: rowDials,
              r: Number(a?.reached || 0),
              b: Number(a?.booked || 0),
              i: Number(a?.instants || 0),
            };
          }
          setTeamDrb({ d, r, b, i });
          if (Object.keys(nextByEmail).length > 0) setDrbByEmail(nextByEmail);
          return;
        }
      } catch (err) {
        console.warn('[AOI Command] team DRB poll failed', err);
      }

      // Last-resort fallback: keep dials from live campaign stats so UI does not show zero.
      const fallbackDials = Number(scopedStats.totalDialsThisHour || 0);
      if (fallbackDials > 0) {
        setTeamDrb((prev) => ({ ...prev, d: fallbackDials }));
      }
    };
    void load();
    const iv = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(iv);
  }, [scopedStats.totalDialsThisHour]);

  // Poll reactor state for agent scores (used to show tier badges in AgentTable)
  useEffect(() => {
    const poll = () => fetch('/api/reactor/state').then(r => r.json()).then(d => {
      if (d?.agentScores) setAgentScores(d.agentScores);
    }).catch(() => {});
    poll();
    const iv = setInterval(poll, 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const poll = () => fetch('/api/credits').then(r => r.json()).then(d => {
      setCredits(d.credits ?? {});
      setCreditsByAssociateId(d.byAssociateId ?? {});
    }).catch(() => {});
    poll();
    const iv = setInterval(poll, 300_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 py-2"
        style={{
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--fg)' }}>
            AOI Command
          </h1>
          <div className="flex items-center gap-1.5 ml-1">
            <div
              className={`dot ${data.connected ? 'pulse-ring' : ''}`}
              style={{ background: data.connected ? 'var(--green)' : 'var(--red)', width: 6, height: 6 }}
            />
            <span style={{ fontSize: 10, fontWeight: 500, color: data.connected ? 'var(--green)' : 'var(--red)' }}>
              {data.connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {([
            { key: 'dashboard' as View, label: 'Dashboard' },
            { key: 'live' as View, label: 'Live' },
            { key: 'analytics' as View, label: 'Analytics' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="px-4 py-2 text-sm font-medium rounded-md transition-all"
              style={{
                background: view === key ? 'var(--primary-soft)' : 'transparent',
                color: view === key ? 'var(--primary-fg)' : 'var(--fg-dim)',
                border: view === key ? '1px solid hsl(224 76% 48% / 0.25)' : '1px solid transparent',
              }}
            >
              <span className="relative">
                {label}
              </span>
            </button>
          ))}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="px-3 py-2 text-sm font-medium rounded-md transition-all"
            style={{ background: 'var(--bg-raised)', color: 'var(--fg-dim)', border: '1px solid var(--border)', fontSize: 14 }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >{theme === 'dark' ? 'Light' : 'Dark'}</button>
          <button
            onClick={() => setReactorOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded-md transition-all"
            style={{ background: 'var(--primary-soft)', color: 'var(--primary-fg)', border: '1px solid var(--border-bright)' }}
          >
            Reactor
          </button>
        </nav>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {view === 'dashboard' ? (
          <div className="h-full overflow-y-auto px-3 py-3 md:px-4 md:py-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-7">
              {[
                { label: 'Online', value: scopedStats.totalOnline },
                { label: 'On Call', value: scopedStats.totalBusy },
                { label: 'Dials', value: teamDrb.d },
                { label: 'Reached', value: teamDrb.r },
                { label: 'Booked', value: teamDrb.b },
                { label: 'Instants', value: teamDrb.i },
                { label: 'Answer Rate', value: `${answerRate}%` },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="text-[11px]" style={{ color: 'var(--fg-dim)' }}>{kpi.label}</div>
                  <div className="text-base font-semibold" style={{ color: 'var(--fg)' }}>{String(kpi.value)}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--fg-muted)', borderBottom: '1px solid var(--border)' }}>
                Top Activity Agents (D/R/B)
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {(topAgentsByDrb.length > 0 ? topAgentsByDrb : [{ email: 'none', name: 'No activity yet', d: 0, r: 0, b: 0 }]).map((agent) => (
                  <div key={`${agent.email}-${agent.name}`} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium" style={{ color: 'var(--fg)' }}>{agent.name}</div>
                    </div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--primary-fg)' }}>
                      D {agent.d} · R {agent.r} · B {agent.b}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : view === 'live' ? (
          <div className="h-full overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden flex min-h-0">
              <div className="flex-1 overflow-hidden flex flex-col" style={{ minWidth: 0 }}>
                <AgentTable
                  agents={visibleAgents}
                  mergedAgents={visibleMergedAgents}
                  activitySummary={visibleActivitySummary}
                  queuePositions={visibleQueuePositions}
                  stats={scopedStats}
                  agentHealth={visibleAgentHealth}
                  credits={credits}
                  creditsByAssociateId={creditsByAssociateId}
                  agentScores={agentScores}
                />
              </div>
              <div
                className="flex-shrink-0 overflow-hidden flex flex-col"
                style={{ width: 420, borderLeft: '1px solid var(--border)' }}
              >
                <LiveQueue
                  agents={visibleAgents}
                  activeCalls={data.activeCalls}
                  completedTransfers={data.completedTransfers}
                  missedTransfers={data.missedTransfers}
                  dialingCampaigns={data.dialingCampaigns}
                  stats={scopedStats}
                />
              </div>
            </div>
            <ActivityFeed actionLog={data.actionLog} agents={data.agents} autoEnabled={data.stats.autoManagementEnabled} />
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            <Analytics />
          </div>
        )}
      </div>

      {/* Reactor Modal */}
      {reactorOpen && (
        <>
          <div
            onClick={() => setReactorOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }}
          />
          <div style={{
            position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)',
            width: '90%', maxWidth: 1100, maxHeight: '90vh',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, zIndex: 51, display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>Reactor Control</span>
              <button onClick={() => setReactorOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--fg-dim)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>x</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ReactorPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
