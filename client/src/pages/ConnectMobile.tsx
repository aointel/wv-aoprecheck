import React, { useState, useEffect } from 'react';
import { X, Phone, ChevronDown, Bell, Check, ChevronsLeft, ChevronsRight, SkipForward, CalendarDays } from 'lucide-react';
import { OutboundDialerInterface } from '@/components/outbound-dialer/OutboundDialerInterface';
import { InboundCallHeaderPanel, type InboundPanelState } from '@/components/outbound-dialer/InboundCallHeaderPanel';
import { useAuth } from '@/hooks/use-auth';

interface MobileState {
  availableLeads: any[];
  currentLeadIndex: number;
  dialingStatus: string;
  inboundCallInfo: { from: string; to?: string; callSid?: string } | null;
  inboundCallLead: any | null;
  inboundPanelState: string;
  dailyStats: { total_dialed?: number; todayDialed?: number; reached?: number; booked?: number } | null;
  selectedQueue: 'hot' | 'plus';
  selectedDisposition?: string | null;
  dispositionApplied?: boolean;
  activeQueueTab?: 'hotlead' | 'plus' | 'my-leads';
  doubleDialMode?: boolean;
  priority99Count: number;
  stageCounts?: { ai?: number; queued?: number; ringing?: number; no_agent?: number } | null;
}

const INITIAL_STATE: MobileState = {
  availableLeads: [],
  currentLeadIndex: 0,
  dialingStatus: 'idle',
  inboundCallInfo: null,
  inboundCallLead: null,
  inboundPanelState: 'idle',
  dailyStats: null,
  selectedQueue: 'hot',
  priority99Count: 0,
  stageCounts: null,
};

interface DispDef {
  id: string;
  label: string;
}

const DISPOSITIONS: DispDef[] = [
  { id: 'no_answer_vm', label: 'No Answer / Voicemail' },
  { id: 'callback', label: 'Callback' },
  { id: 'booked', label: 'Booked' },
  { id: 'instant_presentation', label: 'Instant Presentation' },
  { id: 'sale', label: 'Sale' },
  { id: 'not_interested', label: 'Not Interested' },
  { id: 'already_been_sold', label: 'Already Been Seen' },
  { id: 'medically_uninsurable', label: 'Medically Uninsurable' },
  { id: 'over_age', label: 'Over Age' },
  { id: 'dnc', label: 'Do Not Call' },
  { id: 'wrong_number', label: 'Wrong Number' },
];

export default function ConnectMobile() {
  const [ms, setMs] = useState<MobileState>(INITIAL_STATE);
  const [queueMenuOpen, setQueueMenuOpen] = useState(false);
  const [inboundModalOpen, setInboundModalOpen] = useState(false);
  const { authState } = useAuth();

  useEffect(() => {
    const handler = (e: Event) => setMs((e as CustomEvent<MobileState>).detail);
    window.addEventListener('aoi-mobile-update', handler);
    const existing = (window as any).__aoiMobile?.state;
    if (existing) setMs(existing);
    return () => window.removeEventListener('aoi-mobile-update', handler);
  }, []);

  const currentLead = ms.availableLeads[ms.currentLeadIndex] ?? null;
  const queueCount  = ms.availableLeads.length;

  const d = ms.dailyStats?.total_dialed ?? ms.dailyStats?.todayDialed ?? 0;
  const r = ms.dailyStats?.reached ?? 0;
  const b = ms.dailyStats?.booked ?? 0;

  const xp = d * 1 + r * 5 + b * 25;
  const tier =
    b >= 3 ? '🏆 Closer' :
    b >= 1 ? '🎯 On Target' :
    r >= 5 ? '📞 Dialing' :
    d >= 10 ? '⚡ Grinding' :
    '🌟 Starting';
  const isInboundActive =
    ms.inboundPanelState === 'ringing' ||
    ms.inboundPanelState === 'connecting' ||
    ms.inboundPanelState === 'connected';

  const doQueueSwitch   = (q: 'hot' | 'plus') => (window as any).__aoiMobile?.queueSwitch?.(q);
  const doStartDialing  = () => (window as any).__aoiMobile?.startDialing?.();
  const doDisposition   = (id: string) => (window as any).__aoiMobile?.handleDisposition?.(id);
  const doApplyDisposition = () => (window as any).__aoiMobile?.applyDisposition?.();
  const doCompleteAndContinue = () => (window as any).__aoiMobile?.completeAndContinue?.();
  const doPrevLead = () => (window as any).__aoiMobile?.previousLead?.();
  const doNextLead = () => (window as any).__aoiMobile?.nextLead?.();
  const doToggleDoubleDial = () => (window as any).__aoiMobile?.toggleDoubleDialMode?.();
  const doAnswerInbound = () => (window as any).__aoiMobile?.answerInbound?.();
  const doRejectInbound = () => (window as any).__aoiMobile?.rejectInbound?.();
  const queueTab = ms.activeQueueTab === 'plus' ? 'plus' : 'hot';

  const leadName = currentLead
    ? (currentLead.name ||
       [currentLead.first_name, currentLead.last_name].filter(Boolean).join(' ') ||
       'Unknown')
    : null;

  const rawData   = currentLead?.rawWebhookData ?? {};
  const dob       = currentLead?.dob || rawData.dob || rawData.date_of_birth || null;
  const address   = currentLead?.address || rawData.address || rawData.street_address || null;
  const aiSummary = currentLead?.ai_summary || rawData.ai_summary || currentLead?.notes || '';
  const cityState  = [currentLead?.city, currentLead?.state].filter(Boolean).join(', ');
  const marketGroup = [currentLead?.market, currentLead?.groupCode].filter(Boolean).join(' / ');

  const inboundState: InboundPanelState =
    ms.inboundPanelState === 'ringing' ||
    ms.inboundPanelState === 'connecting' ||
    ms.inboundPanelState === 'connected' ||
    ms.inboundPanelState === 'ended' ||
    ms.inboundPanelState === 'wrapping'
      ? (ms.inboundPanelState as InboundPanelState)
      : 'idle';

  return (
    <>
      {/* Keep desktop dialer mounted off-screen so VDP + call state stay alive. */}
      <div
        id="mobile-hidden-dialer"
        aria-hidden="true"
        style={{
          position: 'absolute', left: '-9999px', top: 0,
          width: '100%', height: '100vh',
          overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
        }}
      >
        <OutboundDialerInterface />
      </div>

      {/* Mobile shell — fixed, 100dvh, nothing scrolls */}
      <div style={{
        position: 'fixed', inset: 0, height: '100dvh',
        display: 'flex', flexDirection: 'column',
        background: '#0f172a', overflow: 'hidden',
      }}>

        {/* ── ZONE 1: HEADER (56px) ──────────────────────────────────────── */}
        <div style={{
          flexShrink: 0, height: 56,
          display: 'flex', alignItems: 'center',
          background: 'linear-gradient(to right, #3b82f6, #7c3aed, #1d4ed8)',
          padding: '0 10px', gap: 8,
          position: 'relative',
        }}>

          {/* Left: AO Queue pill + dropdown arrow */}
          <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => { doQueueSwitch('hot'); setQueueMenuOpen(false); }}
              style={{
                height: 34, padding: '0 10px 0 12px',
                borderRadius: '9999px 0 0 9999px',
                border: 'none',
                background: queueTab === 'hot' ? 'white' : 'rgba(255,255,255,0.2)',
                color: queueTab === 'hot' ? '#7c3aed' : 'white',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              AO Queue
            </button>
            <button
              onClick={() => setQueueMenuOpen(v => !v)}
              aria-label="Switch queue"
              style={{
                height: 34, width: 26,
                borderRadius: '0 9999px 9999px 0',
                border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)',
                background: queueTab === 'hot' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)',
                color: queueTab === 'hot' ? '#7c3aed' : 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronDown size={14} />
            </button>

            {/* Dropdown */}
            {queueMenuOpen && (
              <div style={{
                position: 'absolute', top: 38, left: 0, zIndex: 100,
                background: '#1e293b', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                overflow: 'hidden', minWidth: 140,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {([
                  { id: 'hot' as const, label: 'AO Queue' },
                  { id: 'plus' as const, label: '🟢 Plus Leads' },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { doQueueSwitch(opt.id); setQueueMenuOpen(false); }}
                    style={{
                      display: 'block', width: '100%', padding: '10px 14px',
                      background: queueTab === opt.id ? 'rgba(124,58,237,0.3)' : 'transparent',
                      border: 'none', color: 'white',
                      fontSize: 13, fontWeight: 600, textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center: DRB widget — copied exactly from CallConnectorPro.tsx:1759-1774 */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-white/20 shrink-0 text-xs">
              <div className="flex flex-col items-center px-2.5 py-1 bg-blue-900/50">
                <span className="tabular-nums font-black text-blue-200 text-base leading-none">{d}</span>
                <span className="text-[9px] font-semibold text-blue-300/70 uppercase tracking-wide">Dials</span>
              </div>
              <div className="w-px h-full bg-white/10" />
              <div className="flex flex-col items-center px-2.5 py-1 bg-amber-900/40">
                <span className="tabular-nums font-black text-amber-200 text-base leading-none">{r}</span>
                <span className="text-[9px] font-semibold text-amber-300/70 uppercase tracking-wide">Reached</span>
              </div>
              <div className="w-px h-full bg-white/10" />
              <div className="flex flex-col items-center px-2.5 py-1 bg-emerald-900/50">
                <span className="tabular-nums font-black text-emerald-300 text-base leading-none">{b}</span>
                <span className="text-[9px] font-semibold text-emerald-300/70 uppercase tracking-wide">Booked</span>
              </div>
            </div>
          </div>

          {/* Right: Calendar + AOI inbound buttons */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('aoirail-open-calendar'))}
            aria-label="My appointments"
            style={{
              height: 40, width: 40, borderRadius: 10, border: 'none', flexShrink: 0,
              background: 'rgba(255,255,255,0.15)',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CalendarDays size={18} />
          </button>
          <button
            onClick={() => setInboundModalOpen(true)}
            aria-label="Inbound calls"
            style={{
              height: 40, borderRadius: 10, border: 'none', flexShrink: 0,
              padding: '0 12px',
              background: isInboundActive ? '#dc2626' : 'rgba(255,255,255,0.15)',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
            }}
          >
            {isInboundActive ? <Phone size={16} /> : <Bell size={16} />}
            AOI
          </button>
        </div>

        {/* ── ZONE 2: LEAD CARD (flex-1, no scroll) ──────────────────────── */}
        <div style={{
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          margin: '8px 12px',
        }}>
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(160deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
            border: '1px solid rgba(148,163,184,0.25)',
            boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
            borderRadius: 14,
            display: 'flex', flexDirection: 'column',
            padding: '12px 14px', overflow: 'hidden',
          }}>
            {leadName ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 'clamp(21px, 5.4vw, 30px)',
                      fontWeight: 800,
                      color: 'white',
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {leadName}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.75)', marginTop: 4 }}>
                      Client Card
                    </div>
                  </div>
                  <div style={{
                    flexShrink: 0,
                    background: 'rgba(56,189,248,0.18)',
                    border: '1px solid rgba(56,189,248,0.45)',
                    color: '#bae6fd',
                    borderRadius: 999,
                    padding: '4px 9px',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}>
                    Live
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginBottom: 10,
                }}>
                  <div style={{
                    borderRadius: 10,
                    background: 'rgba(15,23,42,0.7)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    padding: '7px 9px',
                    minWidth: 0,
                  }}>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.9)', textTransform: 'uppercase', fontWeight: 700 }}>
                      ML ID
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 2, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentLead.id || 'N/A'}
                    </div>
                  </div>
                  <div style={{
                    borderRadius: 10,
                    background: 'rgba(15,23,42,0.7)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    padding: '7px 9px',
                    minWidth: 0,
                  }}>
                    <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.9)', textTransform: 'uppercase', fontWeight: 700 }}>
                      AO Lead ID
                    </div>
                    <div style={{ fontSize: 13, color: '#e2e8f0', marginTop: 2, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentLead.taalk_lead_id || 'N/A'}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 10,
                }}>
                  {currentLead.phone && (
                    <span style={{
                      background: 'rgba(16,185,129,0.14)',
                      border: '1px solid rgba(16,185,129,0.4)',
                      color: '#6ee7b7',
                      borderRadius: 999,
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {currentLead.phone}
                    </span>
                  )}
                  {cityState && (
                    <span style={{
                      background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.35)',
                      color: '#bfdbfe',
                      borderRadius: 999,
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {cityState}
                    </span>
                  )}
                  {marketGroup && (
                    <span style={{
                      background: 'rgba(168,85,247,0.15)',
                      border: '1px solid rgba(168,85,247,0.35)',
                      color: '#ddd6fe',
                      borderRadius: 999,
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {marketGroup}
                    </span>
                  )}
                </div>

                <div style={{
                  background: 'rgba(15,23,42,0.55)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: 11,
                  padding: '9px 10px',
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  rowGap: 6,
                  flexShrink: 0,
                }}>
                {dob && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'rgba(148,163,184,0.95)', fontWeight: 700 }}>DOB</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{dob}</span>
                  </div>
                )}
                {(currentLead.email || currentLead.taalk_email) && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                  }}>
                    <span style={{ color: 'rgba(148,163,184,0.95)', fontWeight: 700 }}>Email</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {currentLead.email || currentLead.taalk_email}
                    </span>
                  </div>
                )}
                {address && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                  }}>
                    <span style={{ color: 'rgba(148,163,184,0.95)', fontWeight: 700 }}>Address</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {address}
                    </span>
                  </div>
                )}
                {(currentLead.beneficiary || currentLead.relationship) && (
                  <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.3 }}>
                    {[
                      currentLead.beneficiary ? `Beneficiary: ${currentLead.beneficiary}` : null,
                      currentLead.relationship ? `Rel: ${currentLead.relationship}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
                </div>

                {aiSummary && (
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(226,232,240,0.88)',
                    lineHeight: 1.45,
                    background: 'rgba(30,41,59,0.45)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    marginTop: 10,
                  } as React.CSSProperties}>
                    {aiSummary}
                  </div>
                )}
              </>
            ) : (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.28)', fontSize: 16, fontStyle: 'italic',
              }}>
                No lead loaded
              </div>
            )}
          </div>
        </div>

        {/* ── ZONE 3: DESKTOP-LIKE MOBILE FOOTER ─────────────────────────── */}
        <div style={{
          flexShrink: 0,
          background: '#020617',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          padding: '10px 12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <button
            onClick={doStartDialing}
            style={{
              width: '100%',
              height: 46,
              background: '#16a34a',
              border: 'none',
              borderRadius: 10,
              color: 'white',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Phone size={18} />
            Start Dialing
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.07)',
              overflow: 'hidden',
            }}>
              <select
                value={ms.selectedDisposition || ''}
                onChange={(e) => doDisposition(e.target.value)}
                style={{
                  flex: 1,
                  height: 38,
                  border: 'none',
                  background: 'transparent',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '0 10px',
                  outline: 'none',
                }}
              >
                <option value="" style={{ color: '#111827' }}>Disposition</option>
                {DISPOSITIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} style={{ color: '#111827' }}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={doApplyDisposition}
                style={{
                  height: 38,
                  border: 'none',
                  borderLeft: '1px solid rgba(255,255,255,0.16)',
                  background: ms.dispositionApplied ? '#0f766e' : '#1d4ed8',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '0 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Check size={12} />
                {ms.dispositionApplied ? 'Applied' : 'Apply'}
              </button>
            </div>

            <select
              value={queueTab}
              onChange={(e) => doQueueSwitch((e.target.value as 'hot' | 'plus'))}
              style={{
                height: 38,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.07)',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                padding: '0 8px',
                outline: 'none',
              }}
            >
              <option value="hot" style={{ color: '#111827' }}>AO Queue</option>
              <option value="plus" style={{ color: '#111827' }}>Plus Leads</option>
            </select>

            <button
              onClick={doToggleDoubleDial}
              style={{
                height: 38,
                minWidth: 44,
                borderRadius: 10,
                border: ms.doubleDialMode ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.18)',
                background: ms.doubleDialMode ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)',
                color: ms.doubleDialMode ? '#86efac' : 'white',
                fontWeight: 900,
                fontSize: 13,
                cursor: 'pointer',
              }}
              title="Double Dial"
            >
              2x
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              onClick={doPrevLead}
              aria-label="Previous lead"
              style={{
                width: 40,
                height: 36,
                borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={doCompleteAndContinue}
              aria-label="Complete and continue"
              style={{
                width: 46,
                height: 36,
                borderRadius: 9,
                border: 'none',
                background: '#0ea5e9',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <SkipForward size={16} />
            </button>
            <button
              onClick={doNextLead}
              aria-label="Next lead"
              style={{
                width: 40,
                height: 36,
                borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronsRight size={16} />
            </button>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'rgba(255,255,255,0.55)',
            paddingTop: 2,
          }}>
            <span>Queue: {queueCount} leads</span>
            <span>{tier} {xp} XP</span>
          </div>
        </div>


      </div>

      {inboundModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            background: 'rgba(2,6,23,0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14,
          }}
        >
          <div
            style={{
              width: 'min(94vw, 430px)',
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,0.35)',
              background: 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(30,41,59,0.96))',
              boxShadow: '0 28px 60px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              height: 48,
              padding: '0 10px 0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(148,163,184,0.2)',
              background: 'rgba(15,23,42,0.8)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>AOI Inbound Panel</span>
                <span style={{
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.35)',
                  color: isInboundActive ? '#86efac' : '#cbd5e1',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                }}>
                  {isInboundActive ? 'Live' : 'Idle'}
                </span>
              </div>
              <button
                onClick={() => setInboundModalOpen(false)}
                aria-label="Close inbound panel modal"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'rgba(30,41,59,0.65)',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 8 }}>
              <InboundCallHeaderPanel
                state={inboundState}
                lead={ms.inboundCallLead || null}
                queuePosition={0}
                onAnswer={doAnswerInbound}
                onReject={doRejectInbound}
                onHangup={doRejectInbound}
                dailyStats={ms.dailyStats || null}
                connectionType="diamond"
                variant="vertical"
                vdpOnline={true}
                agentStatus="online"
              />
            </div>
          </div>
        </div>
      )}

    </>
  );
}
