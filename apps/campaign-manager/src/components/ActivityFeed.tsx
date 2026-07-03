import { useState } from 'react';
import type { AutoAction, NormalizedAgent } from '../../shared/types';
import { api } from '../hooks/useApi';

interface Props {
  actionLog: AutoAction[];
  agents: NormalizedAgent[];
  autoEnabled: boolean;
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    });
  } catch { return ts; }
}

function actionIcon(action: string): string {
  if (action === 'TRANSFER_RECEIVED') return '📞';
  if (action === 'CALL_COMPLETED') return '✅';
  if (action === 'WENT_AWAY') return '💤';
  if (action === 'IDLE_WARNING') return '⚠️';
  if (action === 'WEBRTC_SUSPEND') return '⏸';
  if (action === 'WEBRTC_UNSUSPEND') return '▶️';
  if (action === 'OUTBOUND_ONLY_WARNING') return '🚨';
  if (action.includes('WEBRTC')) return '📡';
  if (action.includes('PAUSED') || action.includes('ZERO')) return '⏸';
  if (action.includes('RESTORED') || action.includes('RESUMED')) return '▶️';
  if (action.includes('ERROR')) return '⚠️';
  if (action.includes('SUSPENDED')) return '🚫';
  if (action.includes('STATE_CHANGE')) return '🔄';
  if (action.includes('RATE_ADJUSTED')) return '📊';
  return '📋';
}

function actionColor(action: string): string {
  if (action === 'TRANSFER_RECEIVED') return 'var(--red)';
  if (action === 'CALL_COMPLETED') return 'var(--green)';
  if (action === 'WENT_AWAY') return 'var(--amber)';
  if (action === 'IDLE_WARNING') return 'var(--amber)';
  if (action === 'WEBRTC_SUSPEND') return 'var(--purple, #a78bfa)';
  if (action === 'WEBRTC_UNSUSPEND') return 'var(--cyan)';
  if (action === 'OUTBOUND_ONLY_WARNING') return 'var(--red)';
  if (action.includes('WEBRTC') && action.includes('ERROR')) return 'var(--amber)';
  if (action.includes('PAUSED') || action.includes('ZERO') || action.includes('SUSPENDED')) return 'var(--red)';
  if (action.includes('RESTORED') || action.includes('RESUMED')) return 'var(--green)';
  if (action.includes('ERROR')) return 'var(--amber)';
  if (action.includes('RATE_ADJUSTED')) return 'var(--cyan)';
  return 'var(--fg-muted)';
}

function actionLabel(action: string): string {
  if (action === 'TRANSFER_RECEIVED') return 'Transfer';
  if (action === 'CALL_COMPLETED') return 'Completed';
  if (action === 'WENT_AWAY') return 'Away';
  if (action === 'IDLE_WARNING') return 'Idle ⚠️';
  if (action === 'STATE_CHANGE') return 'Status';
  if (action === 'RATE_ADJUSTED') return 'Rate';
  if (action === 'WEBRTC_SUSPEND') return 'WebRTC ⏸';
  if (action === 'WEBRTC_UNSUSPEND') return 'WebRTC ▶️';
  if (action === 'OUTBOUND_ONLY_WARNING') return 'Shame 🚨';
  if (action.includes('WEBRTC')) return 'WebRTC';
  return action.replace(/_/g, ' ').toLowerCase();
}

export function ActivityFeed({ actionLog, autoEnabled }: Props) {
  const [toggling, setToggling] = useState(false);

  const handleToggleAuto = async () => {
    setToggling(true);
    try { await api.toggleAuto(!autoEnabled); } catch (e) { console.error(e); }
    setToggling(false);
  };

  return (
    <div
      className="flex-shrink-0 flex flex-col"
      style={{ height: 180, borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-1.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--fg-muted)' }}>
            Activity Feed
          </span>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--fg-dim)' }}>
            {actionLog.length} events
          </span>
        </div>
        <button
          onClick={handleToggleAuto}
          disabled={toggling}
          className="action-btn"
          style={{
            background: autoEnabled ? 'var(--green-soft)' : 'var(--gray-soft)',
            color: autoEnabled ? 'var(--green)' : 'var(--fg-dim)',
            border: `1px solid ${autoEnabled ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
          }}
        >
          {toggling ? '…' : `Auto-manage: ${autoEnabled ? 'On' : 'Off'}`}
        </button>
      </div>

      {/* Scrolling entries */}
      <div className="flex-1 overflow-y-auto px-4">
        {actionLog.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[11px]" style={{ color: 'var(--fg-dim)' }}>
            Waiting for activity…
          </div>
        ) : (
          <div className="py-1 space-y-0">
            {actionLog.slice(0, 100).map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-2 py-1 animate-fade-in"
                style={{ borderBottom: '1px solid var(--row-border)' }}
              >
                <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--fg-dim)', width: 72 }}>
                  {formatTime(entry.timestamp)}
                </span>
                <span className="text-[10px] flex-shrink-0" style={{ width: 16 }}>
                  {actionIcon(entry.action)}
                </span>
                <span
                  className="badge flex-shrink-0"
                  style={{
                    background: `${actionColor(entry.action)}15`,
                    color: actionColor(entry.action),
                    fontSize: 9,
                    minWidth: 55,
                    textAlign: 'center',
                  }}
                >
                  {actionLabel(entry.action)}
                </span>
                <span className="text-[11px] font-medium flex-shrink-0" style={{ color: 'var(--fg)', minWidth: 100 }}>
                  {entry.agentName}
                </span>
                <span className="text-[11px] truncate flex-1" style={{ color: 'var(--fg-muted)' }}>
                  {entry.detail}
                </span>
                {entry.action === 'STATE_CHANGE' && (
                  <span
                    className="badge flex-shrink-0"
                    style={{
                      background: 'var(--gray-soft)',
                      color: 'var(--fg-dim)',
                      fontSize: 9,
                    }}
                  >
                    {entry.previousState} → {entry.newState}
                  </span>
                )}
                {!entry.success && (
                  <span className="badge flex-shrink-0" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: 9 }}>
                    Failed
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
