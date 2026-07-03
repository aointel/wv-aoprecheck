import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { getTwilioTokenEndpoint, getTwilioTokenRequestInit } from '@/utils/webrtc-endpoints';
import { useQuery } from '@tanstack/react-query';

// ── Types ──────────────────────────────────────────────────────────────────
type StepStatus = 'pending' | 'running' | 'pass' | 'warn' | 'fail';
type Severity = 'warning';

interface StepResult {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  severity?: Severity;
  fixType?: 'phone' | 'photo' | 'mic' | 'support' | 'credits';
}

function isCreditsStep(s: Pick<StepResult, 'id' | 'fixType'>): boolean {
  return s.id === 'credits' || s.fixType === 'credits';
}

/** "All systems go" only when nothing failed; soft credit notices (warn) do not break it. */
function hasNonCreditStructuralIssue(s: StepResult): boolean {
  if (isCreditsStep(s) && s.status === 'warn') return false;
  return s.status === 'warn' || s.status === 'fail';
}

interface StartupSequenceProps {
  onComplete: () => void;
  userEmail: string;
}

// ── Config ─────────────────────────────────────────────────────────────────
/** Same-origin; server proxies to campaign manager (avoids CORS). */
const DIAGNOSTICS_HEALTH_PROXY = '/api/diagnostics/proxy/agent-health';

/** Under Railway load, unbounded fetch() can sit in queue for minutes — cap each call so the startup UI always advances. */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const ac = new AbortController();
  const id = window.setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ac.signal });
  } finally {
    window.clearTimeout(id);
  }
}

const SESSION_KEY = 'aoi_startup_complete';

function startupSequenceKeyContinueShouldIgnore(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!t.closest('input, textarea, select, [contenteditable="true"]');
}

/** AOI support entry point. */
const SUPPORT_GET_SUPPORT_HREF = '/help';

/** Std dev of RTT samples in ms — proxy for network jitter (not packet-level, but useful for diagnostics). */
function jitterStdDevMs(samples: number[]): number {
  if (samples.length < 2) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length;
  return Math.round(Math.sqrt(variance));
}

// ── Animated star field (pure CSS keyframes injected once) ─────────────────
const STAR_STYLE_ID = 'aoi-startup-stars';
function injectStarStyles() {
  if (document.getElementById(STAR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STAR_STYLE_ID;
  style.textContent = `
    @keyframes aoi-twinkle {
      0%, 100% { opacity: 0.15; }
      50% { opacity: 0.8; }
    }
    @keyframes aoi-drift {
      0% { transform: translateY(0); }
      100% { transform: translateY(-20px); }
    }
    @keyframes aoi-pulse-glow {
      0%, 100% { box-shadow: 0 0 12px 2px rgba(99,102,241,0.3); }
      50% { box-shadow: 0 0 24px 6px rgba(139,92,246,0.5); }
    }
    @keyframes aoi-bar-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes aoi-rocket-launch {
      0% { transform: translateY(0) scale(1); opacity: 1; }
      60% { transform: translateY(-30px) scale(1.15); opacity: 1; }
      100% { transform: translateY(-60px) scale(1.2); opacity: 0.9; }
    }
    @keyframes aoi-success-glow {
      0% { text-shadow: 0 0 10px rgba(16,185,129,0.4); }
      50% { text-shadow: 0 0 30px rgba(16,185,129,0.8), 0 0 60px rgba(16,185,129,0.3); }
      100% { text-shadow: 0 0 10px rgba(16,185,129,0.4); }
    }
    @keyframes aoi-fail-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    @keyframes aoi-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .aoi-step-enter {
      animation: aoi-fade-in 0.3s ease-out forwards;
    }
  `;
  document.head.appendChild(style);
}

// ── Star field component ───────────────────────────────────────────────────
function StarField() {
  const stars = useMemo(() => {
    const s: { x: number; y: number; size: number; delay: number; duration: number }[] = [];
    for (let i = 0; i < 80; i++) {
      s.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 3,
      });
    }
    return s;
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animation: `aoi-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite, aoi-drift ${star.duration * 3}s ease-in-out ${star.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────
export default function StartupSequence({ onComplete, userEmail }: StartupSequenceProps) {
  const alreadyDone = useRef(false);
  /** Bumped on unmount so in-flight async work stops calling setState (Strict Mode / navigation). */
  const genRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [hasWarning, setHasWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [allGreen, setAllGreen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  /** Required before Continue when diagnostics reported warnings / soft notices. */
  const [diagnosticsAcknowledged, setDiagnosticsAcknowledged] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    inboundConnects7d: number;
    credits: number;
    market: string;
    states: string[];
    pendingLeads: number;
    recruitConnects7d: number;
    precheckClients7d: number;
    outboundDials7d: number;
  } | null>(null);

  const { data: billingSubData } = useQuery({
    queryKey: ['/api/billing/subscription/status', userEmail, showSummary],
    queryFn: async () => {
      const res = await fetch('/api/billing/subscription/status', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: showSummary && !!userEmail,
  });
  const outboundSubscriptionActive = billingSubData?.subscription?.outboundEnabled === true;

  // Inline fix state
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  // Inject CSS on mount
  useEffect(() => { injectStarStyles(); }, []);

  const issueSteps = useMemo(
    () => steps.filter((s) => s.status === 'warn' || s.status === 'fail'),
    [steps],
  );
  /** Non-credit issues in the top summary (credits have their own panel). */
  const topSummaryIssues = useMemo(
    () => issueSteps.filter((s) => !isCreditsStep(s)),
    [issueSteps],
  );
  const creditIssueSteps = useMemo(
    () => issueSteps.filter((s) => isCreditsStep(s)),
    [issueSteps],
  );
  const passedSteps = useMemo(() => steps.filter((s) => s.status === 'pass'), [steps]);

  // Auto-scroll to bottom when list updates
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [steps, issueSteps.length, passedSteps.length]);

  // Check sessionStorage on mount
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      alreadyDone.current = true;
      onComplete();
    }
  }, [onComplete]);

  // ── Run the sequence ──────────────────────────────────────────────────
  const runSequence = useCallback(async (runId: number) => {
    if (alreadyDone.current) return;
    const stale = () => runId !== genRef.current;
    setDiagnosticsAcknowledged(false);

    const TOTAL_STEPS = 16;
    let stepIndex = 0;
    const results: StepResult[] = [];

    const addResult = (r: StepResult) => {
      if (stale()) return;
      results.push(r);
      setSteps([...results]);
      stepIndex++;
      setProgress(Math.round((stepIndex / TOTAL_STEPS) * 100));
    };

    const setRunning = (label: string) => {
      if (stale()) return;
      setCurrentStep(label);
    };

    const healthReport: Record<string, any> = { email: userEmail, timestamp: new Date().toISOString() };

    // ── 1. Authenticating ───────────────────────────────────────────
    setRunning('Authenticating...');
    await delay(400);
    if (stale()) return;
    if (!userEmail) {
      addResult({ id: 'auth', label: 'Authentication', status: 'fail', detail: 'Not signed in', severity: 'warning', fixType: 'support' });
    } else {
      addResult({ id: 'auth', label: 'Authenticated', status: 'pass', detail: userEmail });
      healthReport.auth = 'ok';
    }

    // ── 2. Loading profile ──────────────────────────────────────────
    setRunning('Loading agent profile...');
    let profile: any = null;
    try {
      const res = await fetchWithTimeout(
        `/api/agent/profile-direct?userEmail=${encodeURIComponent(userEmail)}`,
        { credentials: 'include' },
        20_000,
      );
      if (res.ok) {
        profile = await res.json();
        addResult({ id: 'profile', label: 'Profile loaded', status: 'pass', detail: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'OK' });
        healthReport.profile = 'ok';
      } else {
        addResult({ id: 'profile', label: 'Profile', status: 'fail', detail: 'Could not load agent profile', severity: 'warning', fixType: 'support' });
        healthReport.profile = 'missing';
      }
    } catch {
      addResult({ id: 'profile', label: 'Profile', status: 'fail', detail: 'Network error loading profile', severity: 'warning', fixType: 'support' });
      healthReport.profile = 'error';
    }
    if (stale()) return;

    // ── 3. Phone number ─────────────────────────────────────────────
    setRunning('Checking phone number...');
    await delay(250);
    if (stale()) return;
    const phone = profile?.phone?.trim();
    if (!phone) {
      addResult({ id: 'phone', label: 'Phone number missing', status: 'fail', detail: 'Required for support & callbacks', severity: 'warning', fixType: 'phone' });
      healthReport.phone = 'missing';
    } else {
      addResult({ id: 'phone', label: `Phone: ${phone}`, status: 'pass' });
      healthReport.phone = 'ok';
    }

    // ── 4. Profile picture ──────────────────────────────────────────
    setRunning('Checking profile picture...');
    await delay(250);
    if (stale()) return;
    const pic = profile?.profilePicture?.trim();
    if (!pic) {
      addResult({ id: 'photo', label: 'No profile picture', status: 'warn', detail: 'Recommended for client trust', severity: 'warning', fixType: 'photo' });
      healthReport.photo = 'missing';
    } else {
      addResult({ id: 'photo', label: 'Profile picture', status: 'pass' });
      healthReport.photo = 'ok';
    }

    // ── 5. Associate ID ─────────────────────────────────────────────
    setRunning('Verifying Associate ID...');
    await delay(250);
    if (stale()) return;
    let associateId: string | null = null;
    let vdpCache: any = null;
    try {
      const vdpRes = await fetchWithTimeout(
        '/api/vdp/routing',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail }),
          credentials: 'include',
        },
        25_000,
      );
      if (vdpRes.ok) {
        vdpCache = await vdpRes.json();
        associateId = vdpCache?.associate_id;
      }
    } catch { /* handled below */ }
    if (stale()) return;

    if (!associateId) {
      addResult({ id: 'associate', label: 'Associate ID', status: 'fail', detail: 'Not found — contact support', severity: 'warning', fixType: 'support' });
      healthReport.associateId = 'missing';
    } else {
      addResult({ id: 'associate', label: `Associate ID: ${associateId}`, status: 'pass' });
      healthReport.associateId = associateId;
    }

    // ── 6. Market assignment ────────────────────────────────────────
    setRunning('Checking market assignment...');
    await delay(250);
    if (stale()) return;
    const market = vdpCache
      ? (typeof vdpCache.market === 'string' ? vdpCache.market : Array.isArray(vdpCache.market) ? vdpCache.market[0] : null)
      : null;
    const statesArr: string[] = vdpCache?.states && Array.isArray(vdpCache.states) ? vdpCache.states : [];

    if (!market) {
      addResult({ id: 'market', label: 'Market assignment', status: 'fail', detail: 'No market assigned — contact support', severity: 'warning', fixType: 'support' });
      healthReport.market = 'missing';
    } else {
      addResult({ id: 'market', label: `Market: ${market}`, status: 'pass' });
      healthReport.market = market;
    }

    // ── 7. State licenses ───────────────────────────────────────────
    setRunning('Checking state licenses...');
    await delay(250);
    if (stale()) return;
    if (statesArr.length === 0) {
      addResult({ id: 'states', label: 'State licenses', status: 'fail', detail: '0 states licensed — contact support', severity: 'warning', fixType: 'support' });
      healthReport.states = 0;
    } else {
      const stateLabel = statesArr.length === 1 ? `1 state (${statesArr[0]})` : `${statesArr.length} states`;
      addResult({ id: 'states', label: `Licensed: ${stateLabel}`, status: 'pass', detail: statesArr.join(', ') });
      healthReport.states = statesArr.length;
    }

    // ── 8. Credits ──────────────────────────────────────────────────
    setRunning('Checking credits...');
    let credits = 0;
    try {
      const credRes = await fetchWithTimeout(
        '/api/user/credits',
        { credentials: 'include', headers: { 'x-user-email': userEmail } },
        20_000,
      );
      if (credRes.ok) {
        const credData = await credRes.json();
        credits = credData.credits_remaining ?? credData.creditsRemaining ?? credData.credits ?? 0;
      }
    } catch { /* default 0 */ }
    healthReport.credits = credits;
    if (stale()) return;

    if (credits < 0) {
      addResult({
        id: 'credits',
        label: `Credits: ${credits}`,
        status: 'fail',
        severity: 'warning',
        detail: 'Credits are below zero. Contact support to restore service access.',
        fixType: 'credits',
      });
    } else if (credits === 0) {
      addResult({
        id: 'credits',
        label: 'Credits: 0',
        status: 'warn',
        detail: 'No credits currently available.',
        severity: 'warning',
        fixType: 'credits',
      });
    } else if (credits <= 10) {
      addResult({
        id: 'credits',
        label: `Credits: ${credits}`,
        status: 'warn',
        detail: 'Low credits — performance may be limited.',
        severity: 'warning',
      });
    } else {
      addResult({ id: 'credits', label: `Credits: ${credits}`, status: 'pass' });
    }

    // ── 9. Microphone ───────────────────────────────────────────────
    setRunning('Testing microphone...');
    let micStatus: 'ok' | 'blocked' | 'none' = 'none';
    try {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (perm.state === 'granted') { micStatus = 'ok'; }
      else if (perm.state === 'denied') { micStatus = 'blocked'; }
      else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          micStatus = 'ok';
        } catch { micStatus = 'blocked'; }
      }
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        micStatus = 'ok';
      } catch { micStatus = 'blocked'; }
    }
    healthReport.mic = micStatus;
    if (stale()) return;

    if (micStatus === 'blocked') {
      addResult({ id: 'mic', label: 'Microphone blocked', status: 'fail', detail: 'Enable in browser settings, then refresh', severity: 'warning', fixType: 'mic' });
    } else if (micStatus === 'none') {
      addResult({ id: 'mic', label: 'Microphone', status: 'warn', detail: 'Not yet granted — browser will prompt on first call', severity: 'warning' });
    } else {
      addResult({ id: 'mic', label: 'Microphone', status: 'pass', detail: 'Access granted' });
    }

    // ── 10. Audio output ────────────────────────────────────────────
    setRunning('Testing audio output...');
    await delay(200);
    if (stale()) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      if (outputs.length === 0) {
        addResult({ id: 'audio-out', label: 'Audio output', status: 'warn', detail: 'No output device detected', severity: 'warning' });
        healthReport.audioOutput = 'none';
      } else {
        addResult({ id: 'audio-out', label: 'Audio output', status: 'pass', detail: outputs[0].label || 'Default' });
        healthReport.audioOutput = 'ok';
      }
    } catch {
      addResult({ id: 'audio-out', label: 'Audio output', status: 'warn', detail: 'Could not enumerate devices', severity: 'warning' });
      healthReport.audioOutput = 'error';
    }

    // ── 11. Download speed (WebRTC: min 1 Mbps, optimal 5+; Opus ~40–80 kbps/dir but headroom matters) ──
    setRunning('Testing download speed...');
    let downloadMbps = 0;
    try {
      const t0 = performance.now();
      const res = await fetchWithTimeout('/api/speed-test', { cache: 'no-store', credentials: 'include' }, 45_000);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const elapsedSec = Math.max((performance.now() - t0) / 1000, 0.001);
      const bytes = blob.size;
      if (bytes >= 50_000) {
        downloadMbps = Math.round(((bytes * 8) / elapsedSec / 1_000_000) * 10) / 10;
      }
    } catch { /* leave at 0 */ }
    healthReport.speedDownMbps = downloadMbps;
    healthReport.speedMbps = downloadMbps;
    if (stale()) return;

    if (downloadMbps <= 0) {
      addResult({
        id: 'speed-down',
        label: 'Download speed',
        status: 'fail',
        detail: 'Could not measure — need ≥1 Mbps for WebRTC (CC Pro / Taalk)',
        severity: 'warning',
      });
    } else if (downloadMbps < 1) {
      addResult({
        id: 'speed-down',
        label: `Download: ~${downloadMbps} Mbps`,
        status: 'fail',
        detail: 'Below 1 Mbps minimum — voice will break up',
        severity: 'warning',
      });
    } else if (downloadMbps < 5) {
      addResult({
        id: 'speed-down',
        label: `Download: ~${downloadMbps} Mbps`,
        status: 'warn',
        detail: 'Meets minimum (1 Mbps); 5+ Mbps optimal for stable WebRTC',
        severity: 'warning',
      });
    } else {
      addResult({
        id: 'speed-down',
        label: `Download: ~${downloadMbps} Mbps`,
        status: 'pass',
        detail: 'Good headroom for WebRTC',
      });
    }

    // ── 12. Upload speed (same thresholds — upload matters for outbound / media) ──
    setRunning('Testing upload speed...');
    let uploadMbps = 0;
    const UPLOAD_BYTES = 512 * 1024;
    try {
      const body = new Uint8Array(UPLOAD_BYTES);
      body.fill(0x41);
      const t0 = performance.now();
      const res = await fetchWithTimeout(
        '/api/speed-test-upload',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body,
          cache: 'no-store',
          credentials: 'include',
        },
        45_000,
      );
      if (!res.ok) throw new Error(String(res.status));
      const elapsedSec = Math.max((performance.now() - t0) / 1000, 0.001);
      uploadMbps = Math.round(((UPLOAD_BYTES * 8) / elapsedSec / 1_000_000) * 10) / 10;
    } catch { /* leave at 0 */ }
    healthReport.speedUpMbps = uploadMbps;
    if (stale()) return;

    if (uploadMbps <= 0) {
      addResult({
        id: 'speed-up',
        label: 'Upload speed',
        status: 'fail',
        detail: 'Could not measure — need ≥1 Mbps up for WebRTC',
        severity: 'warning',
      });
    } else if (uploadMbps < 1) {
      addResult({
        id: 'speed-up',
        label: `Upload: ~${uploadMbps} Mbps`,
        status: 'fail',
        detail: 'Below 1 Mbps minimum',
        severity: 'warning',
      });
    } else if (uploadMbps < 5) {
      addResult({
        id: 'speed-up',
        label: `Upload: ~${uploadMbps} Mbps`,
        status: 'warn',
        detail: 'Meets minimum; 5+ Mbps optimal',
        severity: 'warning',
      });
    } else {
      addResult({
        id: 'speed-up',
        label: `Upload: ~${uploadMbps} Mbps`,
        status: 'pass',
        detail: 'Good headroom for WebRTC',
      });
    }

    // ── 13. Latency + jitter (GET samples; latency/jitter matter more than raw Mbps for Opus) ──
    setRunning('Measuring latency & jitter...');
    const latencies: number[] = [];
    const HEALTH_RTT_MS = 8_000;
    const HEALTH_SAMPLES = 5;
    try {
      const samples = await Promise.all(
        Array.from({ length: HEALTH_SAMPLES }, async () => {
          const start = performance.now();
          try {
            await fetchWithTimeout('/api/health', { method: 'GET', cache: 'no-store', credentials: 'include' }, HEALTH_RTT_MS);
            return performance.now() - start;
          } catch {
            return null;
          }
        }),
      );
      for (const ms of samples) {
        if (ms != null) latencies.push(ms);
      }
    } catch { /* empty */ }
    if (stale()) return;
    const avgLatency = latencies.length >= 2
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : -1;
    const jitterMs = jitterStdDevMs(latencies);
    healthReport.latencyMs = avgLatency;
    healthReport.jitterMs = jitterMs;
    if (stale()) return;

    const latBlock =
      avgLatency < 0
        ? { sev: 'warning' as const, detail: 'Offline or unreachable — check your connection' }
        : avgLatency > 1000
          ? { sev: 'warning' as const, detail: 'Latency >1000ms — calls will drop. Close streaming, downloads, Zoom, and other devices using your internet.' }
          : null;
    const jitBlock =
      jitterMs > 150
        ? { sev: 'warning' as const, detail: `Jitter ~${jitterMs}ms — voice will be unusable. Close streaming, downloads, Zoom, and other devices using your internet.` }
        : null;
    const networkTip = 'Close any streaming, downloads, Zoom calls, or other devices using your internet.';
    const latWarn =
      avgLatency >= 0 && avgLatency > 500
        ? { detail: `Latency >500ms — call quality may suffer. ${networkTip}` }
        : null;
    const jitWarn =
      jitterMs > 80 && jitterMs <= 150
        ? { detail: `Jitter ~${jitterMs}ms — may hear some choppiness. ${networkTip}` }
        : null;

    const softLatencyDetail = (() => {
      if (latWarn || (jitterMs > 30 && jitterMs <= 50)) {
        const parts = [latWarn?.detail, jitWarn?.detail].filter(Boolean);
        return parts.length ? parts.join(' · ') : undefined;
      }
      return undefined;
    })();

    const optimalHint =
      avgLatency >= 0 && avgLatency < 50 && jitterMs <= 10
        ? 'Optimal range for WebRTC'
        : avgLatency >= 0 && avgLatency < 150 && jitterMs <= 30
          ? 'Within typical WebRTC minimums (<150ms, <30ms jitter)'
          : undefined;

    if (avgLatency < 0) {
      addResult({
        id: 'latency',
        label: 'Network latency / jitter',
        status: 'fail',
        detail: latBlock?.detail || 'Could not measure RTT',
        severity: 'warning',
      });
    } else if (latBlock || jitBlock) {
      const detail =
        latBlock && jitBlock ? `${latBlock.detail} · ${jitBlock.detail}` : (latBlock?.detail ?? jitBlock?.detail ?? '');
      addResult({
        id: 'latency',
        label: `Latency ${avgLatency}ms · jitter ~${jitterMs}ms`,
        status: 'fail',
        detail,
        severity: 'warning',
      });
    } else if (softLatencyDetail) {
      addResult({
        id: 'latency',
        label: `Latency ${avgLatency}ms · jitter ~${jitterMs}ms`,
        status: 'warn',
        detail: softLatencyDetail || 'Elevated — Opus is sensitive to delay variation',
        severity: 'warning',
      });
    } else {
      addResult({
        id: 'latency',
        label: `Latency ${avgLatency}ms · jitter ~${jitterMs}ms`,
        status: 'pass',
        detail: optimalHint,
      });
    }

    // ── 14. WebRTC token (do NOT register Device here — main dialer creates the real Device; double register crashes tab)
    setRunning('Verifying voice token...');
    let voiceToken: string | null = null;
    try {
      const tokenRes = await fetchWithTimeout(getTwilioTokenEndpoint(), getTwilioTokenRequestInit(userEmail), 25_000);
      if (!tokenRes.ok) throw new Error(`Token ${tokenRes.status}`);
      const tokenData = await tokenRes.json();
      if (!tokenData.token) throw new Error('Empty token');
      voiceToken = tokenData.token;
      addResult({
        id: 'webrtc',
        label: 'Voice token OK',
        status: 'pass',
        detail: 'Twilio token issued — WebRTC registers when you power on',
      });
      healthReport.webrtc = 'token_ok';
    } catch (err: any) {
      addResult({
        id: 'webrtc',
        label: 'Voice / WebRTC',
        status: 'fail',
        detail: err?.message || 'Could not get token — sign in and retry',
        severity: 'warning',
      });
      healthReport.webrtc = 'failed';
    }
    if (stale()) return;

    // ── 15. WebSocket / Firewall test — prove Twilio voice servers are reachable ──
    setRunning('Testing Twilio WebSocket connection...');
    try {
      const wsOk = await new Promise<boolean>((resolve) => {
        try {
          const ws = new WebSocket('wss://chunderw-vpc-gll.twilio.com');
          // Timeout = truly unreachable (firewall). 403 onerror = server responded = reachable.
          const timer = setTimeout(() => { try { ws.close(); } catch { /**/ } resolve(false); }, 6000);
          ws.onopen = () => { clearTimeout(timer); try { ws.close(); } catch { /**/ } resolve(true); };
          ws.onerror = () => { clearTimeout(timer); try { ws.close(); } catch { /**/ } resolve(true); };
        } catch { resolve(false); }
      });
      if (wsOk) {
        addResult({ id: 'ws_firewall', label: 'Twilio WebSocket reachable', status: 'pass', detail: 'No firewall blocking voice connections' });
        (healthReport as any).wsConnectivity = 'ok';
      } else {
        addResult({
          id: 'ws_firewall',
          label: 'Twilio WebSocket blocked',
          status: 'fail',
          detail: 'Firewall or network policy is blocking Twilio voice WebSocket (wss://chunderw-vpc-gll.twilio.com). Inbound calls will not work.',
          severity: 'warning',
          fixType: 'support',
        });
        (healthReport as any).wsConnectivity = 'blocked';
      }
    } catch {
      addResult({ id: 'ws_firewall', label: 'WebSocket test', status: 'warn', detail: 'Could not run test', severity: 'warning' });
    }
    if (stale()) return;

    // ── 16. Report to AOI Command ───────────────────────────────────
    setRunning('Reporting to AOI Command...');
    try {
      const reportRes = await fetchWithTimeout(
        DIAGNOSTICS_HEALTH_PROXY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(healthReport),
        },
        30_000,
      );
      if (!reportRes.ok) {
        const t = await reportRes.text().catch(() => '');
        addResult({
          id: 'report',
          label: 'AOI Command report',
          status: 'warn',
          detail: t ? `Proxy ${reportRes.status}: ${t.slice(0, 120)}` : `Proxy returned ${reportRes.status}`,
          severity: 'warning',
        });
      } else {
        addResult({ id: 'report', label: 'Reported to AOI Command', status: 'pass' });
      }
    } catch {
      addResult({ id: 'report', label: 'AOI Command report', status: 'warn', detail: 'Could not reach command server', severity: 'warning' });
    }

    // ── Finalize ────────────────────────────────────────────────────
    if (stale()) return;
    setProgress(100);
    setCurrentStep('');

    const hasWarn = results.some((r) => r.status === 'warn' || r.status === 'fail');
    const hasStructuralIssue = results.some(hasNonCreditStructuralIssue);
    setHasWarning(hasWarn);
    setDone(true);

    const allGreenNow = !hasStructuralIssue;
    setAllGreen(allGreenNow);
    // Always persist summary when fetch settles — do not gate on runId or a Strict Mode remount can skip this
    // and leave "Continue to overview" disabled on "Loading overview…" forever.
    fetchSummaryData(userEmail, credits, market || '', statesArr)
      .then((data) => {
        setSummaryData(data);
      })
      .catch(() => {
        setSummaryData({
          inboundConnects7d: 0,
          credits,
          market: market || '',
          states: statesArr,
          pendingLeads: 0,
          recruitConnects7d: 0,
          precheckClients7d: 0,
          outboundDials7d: 0,
        });
      });
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail || alreadyDone.current) return;
    if (sessionStorage.getItem(SESSION_KEY) === 'true') return;
    genRef.current += 1;
    const runId = genRef.current;
    void runSequence(runId);
    return () => {
      genRef.current += 1;
    };
  }, [userEmail, runSequence]);

  // ── Fix handlers ──────────────────────────────────────────────────────
  const handleSavePhone = async () => {
    if (!phoneInput.trim()) return;
    setSavingPhone(true);
    try {
      const res = await fetch('/api/agent/profile-direct', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, phone: phoneInput.trim() }),
      });
      if (res.ok) {
        setSteps((prev) => {
          const updated = prev.map((s) =>
            s.id === 'phone' ? { ...s, status: 'pass' as StepStatus, label: `Phone: ${phoneInput.trim()}`, detail: undefined, fixType: undefined, severity: undefined } : s,
          );
          return updated;
        });
      }
    } catch { /* ignore */ }
    setSavingPhone(false);
  };

  const handleUploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('profilePicture', file);
      fd.append('userEmail', userEmail);
      const res = await fetch('/api/agent/upload-profile-picture', { method: 'POST', body: fd });
      if (res.ok) {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === 'photo' ? { ...s, status: 'pass' as StepStatus, label: 'Profile picture uploaded', detail: undefined, fixType: undefined, severity: undefined } : s,
          ),
        );
      }
    } catch { /* ignore */ }
    setUploadingPhoto(false);
  };

  const handleContinue = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setDismissed(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!done || showSummary || !summaryData) return;
    if (hasWarning && !diagnosticsAcknowledged) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (startupSequenceKeyContinueShouldIgnore(e)) return;
      e.preventDefault();
      setShowSummary(true);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [done, showSummary, summaryData, hasWarning, diagnosticsAcknowledged]);

  useEffect(() => {
    if (!showSummary || !summaryData) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (startupSequenceKeyContinueShouldIgnore(e)) return;
      e.preventDefault();
      handleContinue();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [showSummary, summaryData, handleContinue]);

  const renderStepBlock = (step: StepResult) => (
    <div key={step.id} className="aoi-step-enter">
      <div className="flex items-center gap-2.5 py-0.5">
        <span className="shrink-0 w-5 text-center text-sm">
          {step.status === 'pass' && '✅'}
          {step.status === 'warn' && '⚠️'}
          {step.status === 'fail' && '❌'}
          {step.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-indigo-400 inline" />}
        </span>
        <span
          className={`text-sm font-mono ${
            step.status === 'pass'
              ? 'text-emerald-400/90'
              : step.status === 'warn'
                ? 'text-amber-400'
                : step.status === 'fail'
                  ? 'text-red-400'
                  : 'text-white/50'
          }`}
        >
          {step.label}
        </span>
      </div>

      {step.detail && (step.status === 'warn' || step.status === 'fail') && (
        <div className="ml-[30px] text-[11px] text-white/35 mt-0.5 leading-tight">{step.detail}</div>
      )}
      {step.detail && step.status === 'pass' && (
        <div className="ml-[30px] text-[11px] text-white/30 mt-0.5 leading-tight">{step.detail}</div>
      )}

      {step.fixType === 'phone' && step.status === 'fail' && (
        <div className="ml-[30px] mt-2 flex items-center gap-2">
          <Input
            type="tel"
            placeholder="(555) 123-4567"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="h-8 w-44 bg-white/5 border-white/10 text-white text-sm placeholder:text-white/20 focus:border-indigo-500/50 focus:ring-indigo-500/20"
            onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
          />
          <Button
            size="sm"
            onClick={handleSavePhone}
            disabled={savingPhone || !phoneInput.trim()}
            className="min-h-10 h-auto py-2.5 px-4 text-sm bg-indigo-600 hover:bg-indigo-500 text-white border-0 touch-manipulation"
          >
            {savingPhone ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}

      {step.fixType === 'photo' && step.status === 'warn' && (
        <div className="ml-[30px] mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadPhoto(f);
            }}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="min-h-10 h-auto py-2.5 px-4 text-sm bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 touch-manipulation"
          >
            {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
            Upload Photo
          </Button>
        </div>
      )}

      {step.fixType === 'mic' && step.status === 'fail' && (
        <div className="ml-[30px] mt-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
          <p className="text-[11px] text-white/45 leading-relaxed">
            Click the 🔒 lock in your address bar → Site settings → Microphone →{' '}
            <span className="text-white/70 font-medium">Allow</span>, then refresh.
          </p>
        </div>
      )}

      {step.fixType === 'support' && step.status === 'fail' && (
        <div className="ml-[30px] mt-1 text-[11px] text-white/30">Contact your team lead or AOI support.</div>
      )}

      {step.fixType === 'credits' && step.status === 'fail' && (
        <div className="ml-[30px] mt-2 space-y-2">
          <p className="text-[10px] text-white/35 max-w-md">
            Credits issue detected. Reach out to your admin or support for account assistance.
          </p>
        </div>
      )}

    </div>
  );

  // ── Early exit ────────────────────────────────────────────────────────
  if (alreadyDone.current || dismissed) return null;

  // ── Product summary screen ──────────────────────────────────────────
  if (showSummary && summaryData) {
    return (
      <div
        className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden overscroll-y-contain"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #020617 50%, #0c0a1a 100%)',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
        <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center py-8 px-4 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
        <StarField />
        <div
          className="absolute pointer-events-none"
          style={{
            width: '600px', height: '600px', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
          }}
        />
        <div
          className="relative z-[2] isolate w-full max-w-lg px-6 pointer-events-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          <ProductSummary
            data={summaryData}
            userEmail={userEmail}
            outboundSubscriptionActive={outboundSubscriptionActive}
            onContinue={handleContinue}
          />
          <div className="text-center mt-6">
            <span className="text-[10px] text-white/10 font-mono tracking-widest uppercase">AO Intel · ConnectNow</span>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ── Diagnostic screen ─────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden overscroll-y-contain"
      style={{
        background: 'linear-gradient(145deg, #0f172a 0%, #020617 50%, #0c0a1a 100%)',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}
    >
      <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center py-8 px-4 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
      {/* Star field */}
      <StarField />

      {/* Subtle radial glow behind content */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '600px',
          height: '600px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)',
        }}
      />

      <div className="relative z-[2] isolate w-full max-w-6xl px-4 lg:px-6 pointer-events-auto">
        {/* Header with rocket */}
        <div className="text-center mb-8">
          <div
            className="inline-block text-4xl mb-3"
            style={{
              animation: allGreen ? 'aoi-rocket-launch 1.2s ease-out forwards' : undefined,
              filter: 'drop-shadow(0 0 12px rgba(99,102,241,0.6))',
            }}
          >
            🚀
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #818cf8, #a78bfa, #c4b5fd)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.3))',
            }}
          >
            Initializing AO Intel
          </h1>
          <p className="text-white/30 text-xs mt-1 font-mono tracking-widest uppercase">
            System Diagnostics
          </p>
        </div>

        {/* Current step (active label) */}
        {currentStep && !done && (
          <div className="text-center mb-5">
            <span
              className="text-white/90 text-sm font-mono inline-flex items-center gap-2"
              style={{ textShadow: '0 0 10px rgba(129,140,248,0.4)' }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400"
                style={{ animation: 'aoi-pulse-glow 1.5s ease-in-out infinite', boxShadow: '0 0 8px 2px rgba(99,102,241,0.5)' }}
              />
              {currentStep}
            </span>
          </div>
        )}

        {/* All-green celebration */}
        {allGreen && (
          <div className="text-center mb-5">
            <span
              className="text-emerald-400 text-xl font-bold"
              style={{ animation: 'aoi-success-glow 1.5s ease-in-out infinite' }}
            >
              All systems go!
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          {/* Left: scrolling diagnostic output */}
          <div
            className="space-y-4 pr-1 pb-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
          >
            {passedSteps.length > 0 && (
              <div className="space-y-1" role="region" aria-label="Passed checks">
                {(issueSteps.length > 0 || done) && (
                  <div className="text-[11px] font-semibold text-emerald-200/80 uppercase tracking-widest pb-1">
                    Passed ({passedSteps.length})
                  </div>
                )}
                <div className="space-y-1">{passedSteps.map((s) => renderStepBlock(s))}</div>
              </div>
            )}

            <div ref={stepsEndRef} />
          </div>

          {/* Right: sticky notices + progress + continue */}
          <div className="space-y-4 lg:sticky lg:top-6">
            {topSummaryIssues.length > 0 && (
              <div
                className="rounded-xl border-2 border-amber-400/50 bg-amber-950/50 p-4 space-y-3 shadow-lg shadow-amber-900/20"
                role="region"
                aria-label="Issue summary"
              >
                <div className="text-sm font-bold text-amber-100 tracking-tight">
                  {topSummaryIssues.length} notice{topSummaryIssues.length === 1 ? '' : 's'} — review below (you can still continue)
                </div>
                <ul className="space-y-2 text-left pl-0 list-none">
                  {topSummaryIssues.map((s) => (
                    <li
                      key={`summary-${s.id}`}
                      className="flex gap-2 text-xs text-amber-50/95 leading-snug border-b border-amber-500/15 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="shrink-0" aria-hidden>
                        {s.status === 'fail' ? '❌' : '⚠️'}
                      </span>
                      <span>
                        <span className="font-semibold text-amber-100">{s.label}</span>
                        {s.detail ? <span className="text-amber-200/80"> — {s.detail}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <a
                  href={SUPPORT_GET_SUPPORT_HREF}
                  className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg bg-amber-500/90 hover:bg-amber-400 text-slate-950 py-3 px-3 text-sm font-bold border border-amber-300/50 shadow-md transition-colors no-underline"
                >
                  🎫 Submit a ticket at Get Support
                </a>
                <p className="text-[10px] text-amber-200/60 text-center">
                  Need help? Submit a ticket at Get Support.
                </p>
              </div>
            )}

            {creditIssueSteps.length > 0 && (
              <div
                className="rounded-xl border border-slate-500/35 bg-slate-900/40 p-4 space-y-2"
                role="region"
                aria-label="Credits notice"
              >
                <div className="text-xs font-semibold text-slate-200/90 tracking-tight">
                  Credits
                </div>
                <ul className="space-y-2 text-left pl-0 list-none">
                  {creditIssueSteps.map((s) => (
                    <li key={`credit-${s.id}`} className="flex gap-2 text-xs text-slate-300/90 leading-snug">
                      <span className="shrink-0" aria-hidden>
                        ℹ️
                      </span>
                      <span>
                        <span className="font-medium text-slate-200">{s.label}</span>
                        {s.detail ? <span className="text-slate-400"> — {s.detail}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {issueSteps.length > 0 && (
              <div
                className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 space-y-2"
                role="region"
                aria-label="Fix these issues"
              >
                <div className="text-[11px] font-semibold text-amber-200/95 uppercase tracking-widest border-b border-amber-500/20 pb-2 mb-1">
                  Details &amp; fixes ({issueSteps.length})
                </div>
                <div className="space-y-2">{issueSteps.map((s) => renderStepBlock(s))}</div>
              </div>
            )}

            {/* Progress bar */}
            <div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}
          >
            <div
              className="h-full rounded-full relative"
              style={{
                width: `${progress}%`,
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                background: allGreen
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7)',
                boxShadow: allGreen
                  ? '0 0 12px rgba(16,185,129,0.4)'
                  : '0 0 12px rgba(124,58,237,0.4)',
              }}
            >
              {/* Shimmer overlay */}
              {!done && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'aoi-bar-shimmer 2s linear infinite',
                  }}
                />
              )}
            </div>
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-white/20 font-mono uppercase tracking-wider">
              {done ? (allGreen ? 'Ready' : 'Review notices') : 'Initializing'}
            </span>
            <span className="text-[10px] text-white/20 font-mono">{progress}%</span>
          </div>
            </div>

          </div>
        </div>

      </div>
      {/* Fixed action rail — keep continue controls visible even with long diagnostic output */}
      {done && (
        <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2 bg-gradient-to-t from-slate-950/95 via-slate-950/85 to-transparent pointer-events-auto">
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-white/10 bg-slate-900/85 backdrop-blur p-3 text-center space-y-3">
            {hasWarning ? (
              <label className="flex items-start gap-3 text-left text-sm text-white/80 cursor-pointer select-none rounded-xl border border-white/10 bg-white/[0.04] p-3 active:bg-white/[0.07]">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 rounded border-white/35 bg-white/10 text-indigo-500 focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-0 focus:ring-offset-transparent"
                  checked={diagnosticsAcknowledged}
                  onChange={(e) => setDiagnosticsAcknowledged(e.target.checked)}
                />
                <span className="leading-snug pt-0.5">
                  I have read the warnings and notices above (including the <span className="text-white/90 font-medium">Details &amp; fixes</span>{' '}
                  section and any credits notices). I understand them before continuing.
                </span>
              </label>
            ) : null}
            <button
              type="button"
              disabled={!summaryData || (hasWarning && !diagnosticsAcknowledged)}
              onClick={() => {
                if (summaryData) setShowSummary(true);
              }}
              className="w-full min-h-[52px] rounded-md text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:hover:from-indigo-600 disabled:hover:to-purple-600 text-white font-semibold px-8 py-4 shadow-lg shadow-indigo-500/20 border-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:saturate-50 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {!summaryData
                ? 'Loading overview…'
                : hasWarning
                  ? 'Acknowledge & continue'
                  : 'Continue to overview'}
            </button>
            <p className="text-[11px] text-white/40">
              {summaryData && (!hasWarning || diagnosticsAcknowledged)
                ? 'Press any key to continue'
                : hasWarning
                  ? 'Check the box above, then press any key (or click the button)'
                  : 'Press any key when the button is ready'}
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ── Fetch summary data for product cards ────────────────────────────────
async function fetchSummaryData(
  email: string,
  credits: number,
  market: string,
  states: string[],
): Promise<{
  inboundConnects7d: number;
  credits: number;
  market: string;
  states: string[];
  pendingLeads: number;
  recruitConnects7d: number;
  precheckClients7d: number;
  outboundDials7d: number;
}> {
  let inboundConnects7d = 0;
  let pendingLeads = 0;
  let recruitConnects7d = 0;
  let precheckClients7d = 0;
  let outboundDials7d = 0;

  // Rolling 30-day market stats from /api/market/stats-7d (legacy path name)
  try {
    const res = await fetchWithTimeout(
      `/api/market/stats-7d?market=${encodeURIComponent(market)}`,
      { credentials: 'include' },
      25_000,
    );
    if (res.ok) {
      const data = await res.json();
      inboundConnects7d = data.inboundConnects ?? 0;
      recruitConnects7d = data.recruitConnects ?? 0;
      precheckClients7d = data.precheckClients ?? 0;
      outboundDials7d = data.outboundDials ?? 0;
      pendingLeads = data.pendingLeads ?? 0;
    }
  } catch { /* default 0 */ }

  return { inboundConnects7d, credits, market, states, pendingLeads, recruitConnects7d, precheckClients7d, outboundDials7d };
}

// ── Product Summary Cards ───────────────────────────────────────────────
function ProductSummary({
  data,
  outboundSubscriptionActive,
  onContinue,
}: {
  data: {
    inboundConnects7d: number;
    credits: number;
    market: string;
    states: string[];
    pendingLeads: number;
    recruitConnects7d: number;
    precheckClients7d: number;
    outboundDials7d: number;
  };
  outboundSubscriptionActive?: boolean;
  onContinue: () => void;
}) {
  const [displayCredits, setDisplayCredits] = useState(data.credits);
  useEffect(() => {
    setDisplayCredits(data.credits);
  }, [data.credits]);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '20px 24px',
    transition: 'all 0.2s',
  };

  return (
    <div className="aoi-step-enter space-y-4 pointer-events-auto touch-manipulation">
      <div className="text-center mb-6">
        <h2
          className="text-xl font-bold"
          style={{
            background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          You're Ready
        </h2>
        <p className="text-white/30 text-xs mt-1">Here's what you have access to right now</p>
      </div>

      {/* AO Intelligence Inbound */}
      <div style={cardStyle} className="hover:border-indigo-500/30">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">📞</span>
          <div>
            <h3 className="text-sm font-bold text-white/90">AO Intelligence — Inbound</h3>
            <p className="text-xs text-indigo-300/60">Live transfers directly to you</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-black text-indigo-400">{data.inboundConnects7d}</span>
          <span className="text-xs text-white/40">inbound connects to {data.market || 'your market'} (last 30 days)</span>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-xs text-white/50">✓ Access to <span className="text-indigo-300 font-semibold">{data.market}</span> leads in <span className="text-indigo-300 font-semibold">{data.states.length} states</span></div>
          <div className="text-xs text-white/50">✓ Live warm transfers — client is already on the phone</div>
        </div>
        {displayCredits > 0 ? (
          <div className="mt-3 text-xs text-emerald-400/90 font-semibold">
            ✅ {displayCredits} credits loaded — you're in the queue
          </div>
        ) : (
          <div className="mt-3 text-xs text-slate-300/90 font-medium">
            Credits are currently unavailable. Contact support if queue access is blocked.
          </div>
        )}
      </div>

      {/* Outbound */}
      <div style={cardStyle} className="hover:border-purple-500/30">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="text-sm font-bold text-white/90">Outbound — Call Connector Pro</h3>
            <p className="text-xs text-purple-300/60">Power dialer with auto-assigned leads</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-black text-purple-400">{data.outboundDials7d ?? 0}</span>
          <span className="text-xs text-white/40">outbound dials by agents in {data.market || 'your market'} (last 30 days)</span>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-xs text-white/50">✓ Access to <span className="text-purple-300 font-semibold">{data.market}</span> leads</div>
          <div className="text-xs text-white/50">✓ Auto power dialer — leads assigned when you power on</div>
          {data.pendingLeads > 0 && (
            <div className="text-xs text-purple-400/90 font-semibold">📋 {data.pendingLeads} leads ready to dial now</div>
          )}
        </div>
        <div className="mt-3 text-xs text-emerald-400/90 font-semibold">
          {outboundSubscriptionActive ? 'Outbound access active.' : 'Outbound access available in your workspace.'}
        </div>
      </div>

      {/* AO Recruit */}
      <div style={cardStyle} className="hover:border-emerald-500/30">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🤝</span>
          <div>
            <h3 className="text-sm font-bold text-white/90">AO Recruit</h3>
            <p className="text-xs text-emerald-300/60">Pipeline candidates from AO Recruit activity</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-black text-emerald-400">{data.recruitConnects7d}</span>
          <span className="text-xs text-white/40">new recruit candidates (last 30 days, org-wide)</span>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-xs text-white/50">
            ✓ Access to live Veteran calls in your{' '}
            <span className="text-emerald-300 font-semibold">
              {data.states.length > 0 ? data.states.length : 46}
            </span>{' '}
            licensed states
          </div>
          <div className="text-xs text-white/50">✓ Build your downline with AO Recruit candidate flow</div>
        </div>
        {displayCredits <= 0 && (
          <div className="mt-3 text-xs text-slate-300/90 font-medium">
            Credits are currently unavailable. Contact support if access is restricted.
          </div>
        )}
      </div>

      {/* AO Precheck */}
      <div style={cardStyle} className="hover:border-cyan-500/30">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="text-sm font-bold text-white/90">AO Precheck</h3>
            <p className="text-xs text-cyan-300/60">Cement your business in real time</p>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-3xl font-black text-cyan-400">{data.precheckClients7d ?? 0}</span>
          <span className="text-xs text-white/40">verification sessions started (last 30 days, org-wide)</span>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-xs text-white/50">✓ Real-time policy verification — lock in your sale</div>
          <div className="text-xs text-white/50">✓ Retain more business — catch issues before they cancel</div>
          <div className="text-xs text-white/50">✓ Your retention tool — protect the commissions you earned</div>
        </div>
      </div>

      {/* Continue button */}
      <div className="text-center pt-4 space-y-2 pointer-events-auto touch-manipulation">
        <Button
          onClick={onContinue}
          className="w-full max-w-xs mx-auto min-h-[52px] text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-8 py-4 shadow-lg shadow-indigo-500/20 border-0"
        >
          Let's Go →
        </Button>
        <p className="text-[11px] text-white/40 mt-2">Press any key to continue</p>
        <button
          type="button"
          onClick={() => { window.location.href = '/login'; }}
          className="inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm text-white/40 hover:text-white/65 underline-offset-2 hover:underline touch-manipulation"
        >
          ← Return to Login
        </button>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// NOTE: Diagnostics screenshot sender — waiting for push
// When ready:
// 1. Add html2canvas to deps
// 2. Button captures page screenshot
// 3. Uploads to /api/support/diagnostic-screenshot
// 4. Server sends MMS to support number with agent email + screenshot
// 5. Creates ticket automatically
