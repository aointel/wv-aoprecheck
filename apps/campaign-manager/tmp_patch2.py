
import re, sys

with open('src/components/Funnel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Start length: {len(content)}", file=sys.stderr)

# ── 1. Remove PanelTab type (may still be present)
content = content.replace("type PanelTab = 'score' | 'calls' | 'coaching';\n\n", '')

# ── 2. Remove TABS array + its trailing newline
tabs_pattern = re.compile(
    r"  const TABS: \{ key: PanelTab; label: string \}\[\] = \[\n"
    r"    \{ key: 'score', label: '\U0001f4ca Score' \},\n"
    r"    \{ key: 'calls', label: '\U0001f4de Calls' \},\n"
    r"    \{ key: 'coaching', label: '\U0001f3af Coaching' \},\n"
    r"  \];\n\n  return \(",
    re.DOTALL
)
content = tabs_pattern.sub("  return (", content)

# ── 3. Remove the tab bar div block (between close-button and the </div> that closes the header inner div)
# Find: marginBottom: 8 ...close button block... Tab bar div ... </div>\n      </div>
tab_bar_pattern = re.compile(
    r"(\s*\{/\* Tab bar \*/\}\n"
    r"        <div style=\{\{ display: 'flex', gap: 0 \}\}>\n"
    r".*?"
    r"        </div>\n)"
    r"      </div>",
    re.DOTALL
)
content = tab_bar_pattern.sub("      </div>", content)

# ── 4. Replace the entire tab content block with always-on sections
# Target: from "{/* Tab content */}" down to the closing "</div>\n    </div>"
# which closes the content area and then the AgentDetail return

old_content_block = re.compile(
    r"      \{/\* Tab content \*/\}\n"
    r"      <div style=\{\{ flex: 1, overflowY: 'auto' \}\}>\n"
    r".*?"  # all the tab conditionals
    r"      </div>\n"
    r"    </div>\n"
    r"  \);\n"
    r"\}",
    re.DOTALL
)

new_content_block = """      {/* All sections — Score, Calls, Coaching */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Score Section ── */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)', marginBottom: 10 }}>AOI Score</div>
          {scoreLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} w="100%" h={28} />)}
            </div>
          ) : aoiScore ? (
            <>
              {/* Score bars */}
              <ScoreBar
                label="Show Rate"
                score={aoiScore.show_rate_score}
                max={20}
                color={aoiScore.show_rate_score >= 14 ? '#4ade80' : aoiScore.show_rate_score >= 8 ? '#fbbf24' : '#f87171'}
              />
              <ScoreBar
                label="Close Rate"
                score={aoiScore.close_rate_score}
                max={30}
                color={aoiScore.close_rate_score >= 21 ? '#4ade80' : aoiScore.close_rate_score >= 12 ? '#fbbf24' : '#f87171'}
              />
              <ScoreBar
                label="ALP Quality"
                score={aoiScore.alp_score}
                max={20}
                color={aoiScore.alp_score >= 14 ? '#4ade80' : aoiScore.alp_score >= 8 ? '#fbbf24' : '#f87171'}
              />
              <ScoreBar
                label="Call Grade"
                score={aoiScore.call_grade_score}
                max={20}
                color={aoiScore.call_grade_score >= 16 ? '#4ade80' : aoiScore.call_grade_score >= 10 ? '#fbbf24' : '#f87171'}
              />
              <ScoreBar
                label="Momentum"
                score={aoiScore.trend_score}
                max={10}
                color={aoiScore.trend_score >= 8 ? '#4ade80' : aoiScore.trend_score >= 5 ? '#fbbf24' : '#f87171'}
              />

              {/* Total score */}
              <div style={{
                marginTop: 16, padding: '12px 14px',
                background: 'var(--bg-raised)', borderRadius: 8, border: `1px solid ${gradeColors.border}`,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: gradeColors.fg, lineHeight: 1 }}>{aoiScore.total}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>/ 100</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: gradeColors.fg }}>Grade {aoiScore.grade}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 2 }}>AOI Performance Score</div>
                </div>
              </div>

              {/* Coaching insight */}
              <div style={{
                marginTop: 12, padding: '10px 12px',
                background: 'rgba(245,158,11,0.06)', borderRadius: 6,
                border: '1px solid rgba(245,158,11,0.25)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  \U0001f4a1 Coaching Insight
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>
                  {getWeakestInsight(aoiScore)}
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 14 }}>
                {[
                  { label: 'Close%', value: fmtPct(row.close_rate), color: closeColor(row.close_rate) },
                  { label: 'ALP', value: fmt$(row.alp), color: 'var(--fg)' },
                  { label: '$/Pres', value: fmt$(row.alp_per_pres), color: 'var(--fg)' },
                ].map(s => (
                  <div key={s.label} style={{ ...CARD, padding: '6px 10px' }}>
                    <div style={labelStyle}>{s.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', textAlign: 'center', padding: 24 }}>
              {row.email ? 'No score data available' : 'No email on file \u2014 cannot compute AOI Score'}
            </div>
          )}
        </div>

        {/* ── Calls Section ── */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)', marginBottom: 8 }}>Recent Calls</div>
          {callsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...Array(6)].map((_, i) => <Skeleton key={i} w="100%" h={38} />)}
            </div>
          ) : calls.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', textAlign: 'center', padding: 24 }}>
              No scored calls found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {calls.map(c => {
                const gc = aoiGradeColor(c.outcome_grade || 'F');
                const isExpanded = expandedCall === c.id;
                return (
                  <div
                    key={c.id}
                    style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '7px 9px', cursor: 'pointer',
                    }}
                    onClick={() => setExpandedCall(isExpanded ? null : c.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <span style={{ color: 'var(--fg-dim)', flexShrink: 0 }}>{fmtDate(c.call_date)}</span>
                      <span style={{ color: 'var(--fg-dim)', flexShrink: 0 }}>
                        {c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s` : '\u2014'}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700,
                        background: gc.bg, color: gc.fg, border: `1px solid ${gc.border}`, flexShrink: 0,
                      }}>{c.outcome_grade || '\u2014'}</span>
                      <span style={{
                        fontWeight: 700, fontSize: 11, flexShrink: 0,
                        color: c.converted ? 'var(--green)' : 'var(--fg-dim)',
                      }}>{c.converted ? '\u2713' : '\u2715'}</span>
                      <span style={{ flex: 1, fontSize: 10, color: 'var(--fg-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.cnresolution || ''}
                      </span>
                      <span style={{ color: 'var(--fg-dim)', fontSize: 10 }}>{isExpanded ? '\u25b2' : '\u25bc'}</span>
                    </div>
                    {isExpanded && c.ai_summary && (
                      <div style={{
                        marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)',
                        fontSize: 11, color: 'var(--fg)', lineHeight: 1.6,
                      }}>
                        {c.ai_summary}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Coaching Section ── */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-dim)', marginBottom: 8 }}>Coaching</div>
          {/* Alerts section */}
          <div style={{ ...labelStyle, marginBottom: 8 }}>Auto Alerts</div>
          {coachingLoading ? (
            <Skeleton w="100%" h={40} />
          ) : alerts.length === 0 ? (
            <div style={{
              fontSize: 11, color: 'var(--green)', padding: '8px 10px',
              background: 'rgba(34,197,94,0.08)', borderRadius: 5, border: '1px solid rgba(34,197,94,0.2)',
              marginBottom: 16,
            }}>\u2713 No active alerts for this agent</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
              {alerts.map((a, i) => {
                const isCritical = a.severity === 'critical';
                return (
                  <div key={i} style={{
                    padding: '7px 10px', borderRadius: 5, fontSize: 11,
                    background: isCritical ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${isCritical ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    color: isCritical ? '#f87171' : '#fbbf24',
                  }}>
                    <span style={{ fontWeight: 700 }}>{isCritical ? '\U0001f6a8' : '\u26a0\ufe0f'} {a.alert_type?.replace(/_/g, ' ').toUpperCase()}: </span>
                    {a.message}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes section */}
          <div style={{ ...labelStyle, marginBottom: 8 }}>Coaching Notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            {coachingLoading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} w="100%" h={54} />)
            ) : notes.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>No coaching notes yet</div>
            ) : notes.map((n: any) => (
              <div key={n.id} style={{
                background: 'var(--bg-raised)', borderRadius: 6,
                border: '1px solid var(--border)', padding: '8px 10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary-fg)' }}>{n.manager}</span>
                  <span style={{ fontSize: 10, color: 'var(--fg-dim)' }}>{fmtDate(n.created_at)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>{n.note}</div>
              </div>
            ))}
          </div>

          {/* Add note form */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Add Note</div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Coaching note\u2026"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 5, color: 'var(--fg)', fontSize: 12, padding: '7px 9px',
                fontFamily: 'inherit', marginBottom: 8,
              }}
            />
            <input
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              placeholder="Manager name"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 5, color: 'var(--fg)', fontSize: 12, padding: '6px 9px',
                fontFamily: 'inherit', marginBottom: 8,
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={submitting || !noteText.trim() || !managerName.trim()}
              style={{
                width: '100%', padding: '8px', fontSize: 12, fontWeight: 700,
                background: 'var(--primary-soft)', color: 'var(--primary-fg)',
                border: '1px solid rgba(99,102,241,0.4)', borderRadius: 5,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: (!noteText.trim() || !managerName.trim()) ? 0.5 : 1,
              }}
            >{submitting ? 'Saving\u2026' : 'Save Note'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}"""

match = old_content_block.search(content)
if match:
    print(f"Found content block at {match.start()}-{match.end()}", file=sys.stderr)
    content = content[:match.start()] + new_content_block + "\n" + content[match.end():]
else:
    print("ERROR: Could not find content block pattern!", file=sys.stderr)
    # Try to find what's there
    idx = content.find("Tab content")
    print(f"'Tab content' at: {idx}", file=sys.stderr)
    sys.exit(1)

print(f"End length: {len(content)}", file=sys.stderr)

with open('src/components/Funnel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!", file=sys.stderr)
