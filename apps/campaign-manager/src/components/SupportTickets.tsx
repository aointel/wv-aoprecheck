import { useState, useEffect, useRef } from 'react';

interface SupportMessage {
  id: string;
  ticketId: string | null;
  phone: string;
  twilioSid: string;
  direction: 'inbound' | 'outbound';
  body: string;
  hasMedia: boolean;
  sentAt: string;
}

interface SupportTicket {
  id: string;
  phone: string;
  agentEmail: string | null;
  agentName: string | null;
  callerName: string | null;
  status: 'open' | 'replied' | 'resolved' | 'closed';
  priority: string;
  category: string | null;
  subject: string | null;
  notes: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  firstResponseAt: string | null;
  messages: SupportMessage[];
  waitTime: number;
}

function fmtWait(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function fmtTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return dateStr; }
}

function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return fmtTime(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + fmtTime(dateStr);
  } catch { return dateStr; }
}

const CATEGORIES = ['credits', 'technical', 'setup', 'billing', 'states', 'dialer', 'refund', 'other'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

function getSuggestedReply(ticket: SupportTicket): string | null {
  const firstName = (ticket.callerName || ticket.agentName || '').split(' ')[0];
  const hi = firstName ? `Hi ${firstName}! ` : 'Hi! ';
  switch (ticket.category) {
    case 'states':
      return `${hi}The "No valid associate_id" error means your states haven't been configured yet. Please reply with your associate ID and which states you need added, and we'll get it set up right away.`;
    case 'login':
      return `${hi}To reset your AO Intel password, go to planetaltig.com and click "Forgot Password". If the phone number on file doesn't match, reply with your account email and we'll reset it manually.`;
    case 'technical':
      return `${hi}For connection/speed issues, please try: 1) Clear your browser cache, 2) Use Chrome or Edge, 3) Go to planetaltig.com/ao-intel and click the wrench icon to run diagnostics. Still having issues? Let us know what the diagnostic shows.`;
    case 'billing':
    case 'credits':
      return `${hi}For your billing/credits question — can you reply with your account email and the specific issue? We'll look into it right away.`;
    case 'refund':
      return `${hi}I understand you'd like to cancel. Before we process that, can you share what prompted this? We may be able to resolve the issue or find a better option for you.`;
    case 'setup':
    case 'dialer':
      return `${hi}Happy to help with setup! Can you reply with your account email and a quick description of what step you're stuck on?`;
    default:
      return null;
  }
}
const STATUSES: SupportTicket['status'][] = ['open', 'replied', 'resolved', 'closed'];
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: 'var(--red-soft)', fg: 'var(--red)' },
  replied: { bg: 'var(--amber-soft)', fg: 'var(--amber)' },
  resolved: { bg: 'var(--green-soft)', fg: 'var(--green)' },
  closed: { bg: 'var(--gray-soft)', fg: 'var(--fg-dim)' },
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--red)', high: 'var(--amber)', normal: 'var(--fg-muted)', low: 'var(--fg-dim)',
};

export function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('active'); // active, all, open, resolved
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResult, setAutoResult] = useState<string | null>(null);
  const [botEnabled, setBotEnabled] = useState(true);
  const [botRunning, setBotRunning] = useState(false);
  const [botResult, setBotResult] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = () => {
    fetch('/api/support/tickets').then(r => r.json()).then(d => {
      setTickets(d.tickets ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); const iv = setInterval(fetchTickets, 30000); return () => clearInterval(iv); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected, tickets]);
  useEffect(() => {
    fetch('/api/support/bot-status').then(r => r.json()).then(d => setBotEnabled(d.enabled)).catch(() => {});
  }, []);

  const selectedTicket = tickets.find(t => t.id === selected);
  const openCount = tickets.filter(t => t.status === 'open').length;

  useEffect(() => {
    if (selectedTicket) setNotes(selectedTicket.notes || '');
  }, [selectedTicket?.id]);

  const CAT_FILTERS = ['active', 'open', 'states', 'login', 'technical', 'billing', 'refund', 'resolved', 'all'];

  const filtered = tickets.filter(t => {
    if (filter === 'active') return t.status !== 'closed';
    if (filter === 'open') return t.status === 'open';
    if (filter === 'resolved') return t.status === 'resolved' || t.status === 'closed';
    if (CAT_FILTERS.includes(filter) && !['active','open','resolved','all'].includes(filter)) return t.category === filter;
    return true;
  });

  const handleSend = async () => {
    if (!selectedTicket || !reply.trim()) return;
    setSending(true);
    await fetch('/api/support/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: selectedTicket.phone, body: reply.trim() }) });
    setReply('');
    setSending(false);
    fetchTickets();
  };

  const updateTicket = async (field: string, value: string) => {
    if (!selectedTicket) return;
    await fetch(`/api/support/tickets/${selectedTicket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
    fetchTickets();
  };

  const saveNotes = async () => {
    if (!selectedTicket) return;
    await updateTicket('notes', notes);
    setEditingNotes(false);
  };

  const cs = (s: string): React.CSSProperties => ({ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: STATUS_COLORS[s]?.bg || 'var(--gray-soft)', color: STATUS_COLORS[s]?.fg || 'var(--fg-dim)', display: 'inline-block' });

  return (
    <div className="h-full flex overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Ticket list */}
      <div className="flex-shrink-0 overflow-y-auto flex flex-col" style={{ width: 340, borderRight: '1px solid var(--border)' }}>
        <div className="sticky top-0 px-3 py-2 flex flex-col gap-1.5" style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold" style={{ color: 'var(--fg-muted)' }}>Support Tickets</span>
            <div className="flex items-center gap-2">
              {openCount > 0 && <span style={cs('open')}>{openCount} open</span>}
              <button onClick={() => { setLoading(true); fetch('/api/support/refresh', { method: 'POST' }).then(() => fetchTickets()); }} className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>↻</button>
              <button
                onClick={() => {
                  setAutoRunning(true); setAutoResult(null);
                  fetch('/api/support/auto-categorize', { method: 'POST' }).then(r => r.json()).then(d => {
                    const cats = Object.entries(d.categorized || {}).map(([k,v]) => `${k}:${v}`).join(' ');
                    setAutoResult(`✓ closed ${d.closed} thanks · ${cats || 'no cats'} · ${d.uncategorized} unknown`);
                    fetchTickets();
                  }).finally(() => setAutoRunning(false));
                }}
                disabled={autoRunning}
                className="text-[9px] px-2 py-0.5 rounded font-semibold"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
              >{autoRunning ? '...' : '⚡ Auto-sort'}</button>
              <button
                onClick={() => {
                  setBotRunning(true); setBotResult(null);
                  fetch('/api/support/bot-run', { method: 'POST' }).then(r => r.json()).then(d => {
                    setBotResult(`🤖 replied:${d.replied} resolved:${d.resolved} skipped:${d.skipped}`);
                    fetchTickets();
                  }).finally(() => setBotRunning(false));
                }}
                disabled={botRunning}
                className="text-[9px] px-2 py-0.5 rounded font-semibold"
                style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.25)' }}
              >{botRunning ? '...' : '🤖 Run Bot'}</button>
              <button
                onClick={() => {
                  const next = !botEnabled;
                  fetch('/api/support/bot-toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }) })
                    .then(() => setBotEnabled(next));
                }}
                className="text-[9px] px-2 py-0.5 rounded font-semibold"
                style={{ background: botEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: botEnabled ? 'var(--green)' : 'var(--red)', border: `1px solid ${botEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}
              >Bot {botEnabled ? 'ON' : 'OFF'}</button>
            </div>
          </div>
          {autoResult && <div className="text-[8px] px-1" style={{ color: 'var(--green)' }}>{autoResult}</div>}
          {botResult && <div className="text-[8px] px-1" style={{ color: 'var(--green)' }}>{botResult}</div>}
          <div className="flex flex-wrap gap-0.5">
            {['active', 'open', 'states', 'login', 'technical', 'billing', 'refund', 'resolved', 'all'].map(f => {
              const count = f === 'active' ? tickets.filter(t => t.status !== 'closed').length
                : f === 'open' ? tickets.filter(t => t.status === 'open').length
                : f === 'resolved' ? tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
                : f === 'all' ? tickets.length
                : tickets.filter(t => t.category === f).length;
              return (
                <button key={f} onClick={() => setFilter(f)} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: filter === f ? 'var(--primary-soft)' : 'transparent', color: filter === f ? 'var(--primary-fg)' : 'var(--fg-dim)' }}>
                  {f}{count > 0 ? ` ${count}` : ''}
                </button>
              );
            })}
          </div>
        </div>
        {loading && <div className="p-4 text-center text-xs" style={{ color: 'var(--fg-dim)' }}>Loading...</div>}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(t => (
            <div key={t.id} onClick={() => setSelected(t.id)} className="cursor-pointer px-3 py-2"
              style={{ background: selected === t.id ? 'var(--bg-hover)' : 'transparent', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => { if (selected !== t.id) e.currentTarget.style.background = 'var(--bg-surface)'; }}
              onMouseLeave={e => { if (selected !== t.id) e.currentTarget.style.background = 'transparent'; }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--fg)' }}>{t.callerName || t.agentName || t.phone}</span>
                <span style={cs(t.status)}>{t.status}</span>
              </div>
              {(t.callerName || t.agentName) && <div className="text-[9px]" style={{ color: 'var(--fg-dim)' }}>{t.phone}</div>}
              {t.agentEmail && <div className="text-[9px]" style={{ color: 'var(--fg-dim)' }}>{t.agentEmail}</div>}
              <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--fg-dim)', maxWidth: 300 }}>
                {t.messages[t.messages.length - 1]?.body || '(media)'}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {t.category && <span className="text-[8px] px-1 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--fg-dim)' }}>{t.category}</span>}
                <span className="text-[8px]" style={{ color: PRIORITY_COLORS[t.priority] }}>{t.priority !== 'normal' ? t.priority : ''}</span>
                {t.status === 'open' && t.waitTime > 0 && (
                  <span className="text-[9px] font-semibold" style={{ color: t.waitTime > 3600000 ? 'var(--red)' : t.waitTime > 1800000 ? 'var(--amber)' : 'var(--fg-dim)' }}>⏱ {fmtWait(t.waitTime)}</span>
                )}
                <span className="text-[9px] ml-auto" style={{ color: 'var(--fg-dim)' }}>{fmtDate(t.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat + disposition panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTicket ? (
          <>
            {/* Header with disposition controls */}
            <div className="flex-shrink-0 px-4 py-2" style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{selectedTicket.callerName || selectedTicket.agentName || selectedTicket.phone}</span>
                {selectedTicket.agentEmail && <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>{selectedTicket.agentEmail}</span>}
                <span className="text-[10px]" style={{ color: 'var(--fg-dim)' }}>{selectedTicket.phone}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status */}
                <div className="flex gap-0.5">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => updateTicket('status', s)} className="text-[9px] px-2 py-0.5 rounded font-semibold"
                      style={{ background: selectedTicket.status === s ? STATUS_COLORS[s].bg : 'transparent', color: selectedTicket.status === s ? STATUS_COLORS[s].fg : 'var(--fg-dim)', border: selectedTicket.status === s ? `1px solid ${STATUS_COLORS[s].fg}20` : '1px solid transparent' }}>
                      {s}
                    </button>
                  ))}
                </div>
                <span style={{ color: 'var(--border)' }}>|</span>
                {/* Priority */}
                <select value={selectedTicket.priority} onChange={e => updateTicket('priority', e.target.value)}
                  className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {/* Category */}
                <select value={selectedTicket.category || ''} onChange={e => updateTicket('category', e.target.value)}
                  className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
                  <option value="">category...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {/* Quick actions */}
                <span style={{ color: 'var(--border)' }}>|</span>
                <button onClick={() => { updateTicket('status', 'resolved'); }} className="text-[9px] px-2 py-0.5 rounded font-semibold"
                  style={{ background: 'var(--green-soft)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Resolve</button>
                <button onClick={() => { updateTicket('status', 'closed'); }} className="text-[9px] px-2 py-0.5 rounded"
                  style={{ background: 'var(--gray-soft)', color: 'var(--fg-dim)', border: '1px solid var(--border)' }}>✕ Close</button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ background: 'var(--bg)' }}>
              {selectedTicket.messages.map(m => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%] rounded-lg px-3 py-2" style={{
                    background: m.direction === 'outbound' ? 'var(--primary-soft)' : 'var(--bg-surface)',
                    border: `1px solid ${m.direction === 'outbound' ? 'rgba(99,102,241,0.2)' : 'var(--border)'}`,
                  }}>
                    <div className="text-[11px]" style={{ color: 'var(--fg)' }}>{m.body || (m.hasMedia ? '' : '(empty)')}</div>
                    {m.hasMedia && m.twilioSid && (
                      <div style={{ marginTop: 4 }}>
                        <img
                          src={`/api/support/media/${m.twilioSid}`}
                          alt="attachment"
                          style={{ maxWidth: 280, maxHeight: 200, borderRadius: 6, cursor: 'pointer', display: 'block' }}
                          onClick={() => window.open(`/api/support/media/${m.twilioSid}`, '_blank')}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const link = document.createElement('a');
                            link.href = `/api/support/media/${m.twilioSid}`;
                            link.target = '_blank';
                            link.textContent = '📎 View attachment';
                            link.style.cssText = 'font-size:10px;color:#818cf8;text-decoration:underline;';
                            (e.target as HTMLImageElement).parentNode?.appendChild(link);
                          }}
                        />
                      </div>
                    )}
                    <div className="text-[9px] mt-1" style={{ color: 'var(--fg-dim)' }}>{fmtDate(m.sentAt)}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Notes */}
            <div className="flex-shrink-0 px-4 py-1.5" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
              {editingNotes ? (
                <div className="flex gap-1">
                  <input value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveNotes()}
                    className="input flex-1" style={{ fontSize: 10, padding: '3px 6px' }} placeholder="Internal notes..." />
                  <button onClick={saveNotes} className="text-[9px] px-2" style={{ color: 'var(--green)' }}>Save</button>
                  <button onClick={() => setEditingNotes(false)} className="text-[9px] px-1" style={{ color: 'var(--fg-dim)' }}>✕</button>
                </div>
              ) : (
                <div onClick={() => setEditingNotes(true)} className="cursor-pointer text-[10px]" style={{ color: notes ? 'var(--fg-muted)' : 'var(--fg-dim)' }}>
                  📝 {notes || 'Add internal notes...'}
                </div>
              )}
            </div>

            {/* Suggested reply */}
            {(() => {
              const suggestion = getSuggestedReply(selectedTicket);
              if (!suggestion || reply) return null;
              return (
                <div className="flex-shrink-0 px-4 py-2" style={{ background: 'rgba(99,102,241,0.06)', borderTop: '1px solid rgba(99,102,241,0.15)' }}>
                  <div className="flex items-start gap-2">
                    <span className="text-[9px] font-semibold mt-0.5 flex-shrink-0" style={{ color: '#818cf8' }}>💡 Suggested</span>
                    <span className="text-[10px] flex-1 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{suggestion}</span>
                    <button
                      onClick={() => setReply(suggestion)}
                      className="text-[9px] px-2 py-0.5 rounded font-semibold flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
                    >Use</button>
                  </div>
                </div>
              );
            })()}

            {/* Reply */}
            <div className="flex-shrink-0 px-4 py-2 flex gap-2" style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border)' }}>
              <input type="text" value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type a reply..." className="input flex-1" style={{ fontSize: 12, padding: '6px 10px' }} />
              <button onClick={handleSend} disabled={sending || !reply.trim()} className="action-btn"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary-fg)', border: '1px solid rgba(99,102,241,0.2)' }}>
                {sending ? '...' : 'Send'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--fg-dim)' }}>
            <div className="text-center">
              <div className="text-2xl mb-2">💬</div>
              <div className="text-sm">Select a ticket</div>
              <div className="text-xs mt-1">{openCount} open · {tickets.length} total</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
