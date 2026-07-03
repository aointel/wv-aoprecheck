import { useState, useEffect, useRef, useCallback } from 'react';

// ── Config ──────────────────────────────────────────────────────────────────
/** Same-origin proxy → server forwards to campaign manager (browser cannot call cross-origin without CORS). */
const DIAGNOSTICS_PROXY_BASE = '/api/diagnostics/proxy';

const DIAGNOSTICS_INTERVAL_MS = 30_000;
const COMMAND_POLL_INTERVAL_MS = 15_000;
let lastHealthProxyWarnAt = 0;
const MAX_ERROR_LOG = 10;

// ── Types ───────────────────────────────────────────────────────────────────
export interface AgentDiagnostics {
  email: string;
  mic: 'ok' | 'blocked' | 'none';
  network: { latency: number; quality: 'good' | 'fair' | 'poor' | 'offline' };
  browser: { name: string; version: string };
  audio: { input: string; output: string };
  webrtc: 'registered' | 'failed' | 'disconnected';
  wsConnectivity: 'ok' | 'blocked' | 'unknown'; // WebSocket to Twilio voice servers
  webrtcError: string | null;                    // Last WebRTC error code+message seen
  tokenExpiresIn: number | null;                 // Seconds until Twilio access token expires (null = unknown)
  credits: number;
  errors: string[];
  uptime: number;
  statesCount: number;
  market: string;
  timestamp: string;
}

export interface PreflightResult {
  mic: 'ok' | 'blocked' | 'none';
  browser: { name: string; version: string };
  credits: number;
  network: { latency: number; quality: 'good' | 'fair' | 'poor' | 'offline' };
  ready: boolean; // all critical checks pass
}

type RemoteCommand =
  | 'force_refresh'
  | 're_register'
  | 'test_audio'
  | 'clear_state'
  | 'screen_share';

// ── Helpers ─────────────────────────────────────────────────────────────────
const PAGE_LOAD_TIME = Date.now();

/** Intercept console.error once (HMR-safe) — rolling buffer for diagnostics */
const errorLog: string[] = [];
const g = globalThis as unknown as { __aoiDiagnosticsConsolePatched?: boolean };
if (!g.__aoiDiagnosticsConsolePatched) {
  g.__aoiDiagnosticsConsolePatched = true;
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
    errorLog.push(msg);
    if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
    _origError(...args);
  };
}

function collectRecentErrors(): string[] {
  return [...errorLog];
}

async function checkMicPermission(): Promise<'ok' | 'blocked' | 'none'> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    if (result.state === 'granted') return 'ok';
    if (result.state === 'denied') return 'blocked';
    return 'none'; // prompt
  } catch {
    return 'none';
  }
}

async function measureLatency(): Promise<{ latency: number; quality: 'good' | 'fair' | 'poor' | 'offline' }> {
  try {
    const start = performance.now();
    await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
    const latency = Math.round(performance.now() - start);
    const quality = latency < 150 ? 'good' : latency < 400 ? 'fair' : 'poor';
    return { latency, quality };
  } catch {
    return { latency: -1, quality: 'offline' };
  }
}

function parseBrowser(): { name: string; version: string } {
  // Preload sets this — most reliable Electron signal, no UA parsing needed
  if ((window as any).electronAPI?.isDesktopApp || (window as any).isDesktopApp) {
    const m = navigator.userAgent.match(/Electron\/([\d.]+)/);
    return { name: 'Electron', version: m?.[1] ?? '' };
  }
  const ua = navigator.userAgent;
  if (ua.includes('Electron')) {
    const m = ua.match(/Electron\/([\d.]+)/);
    return { name: 'Electron', version: m?.[1] ?? '' };
  }
  const match =
    ua.match(/(Edg|OPR|Chrome|Firefox|Safari)\/(\d+[\d.]*)/) ||
    ua.match(/(MSIE |rv:)(\d+[\d.]*)/);
  if (!match) return { name: 'Unknown', version: '' };
  let name = match[1];
  if (name === 'OPR') name = 'Opera';
  if (name === 'Edg') name = 'Edge';
  return { name, version: match[2] };
}

async function getAudioDevices(): Promise<{ input: string; output: string }> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const input = devices.find((d) => d.kind === 'audioinput')?.label || 'none';
    const output = devices.find((d) => d.kind === 'audiooutput')?.label || 'default';
    return { input, output };
  } catch {
    return { input: 'error', output: 'error' };
  }
}

function checkWebRTCStatus(): 'registered' | 'failed' | 'disconnected' {
  try {
    // Check global Twilio Device state
    const win = window as any;
    // Twilio Device SDK exposes device.state
    const device = win.__twilioDevice || win.Twilio?.Device?.instances?.[0];
    if (device) {
      const state = device.state ?? device._state;
      if (state === 'registered') return 'registered';
      if (state === 'unregistered' || state === 'destroyed') return 'disconnected';
      return 'failed';
    }
    return 'disconnected';
  } catch {
    return 'disconnected';
  }
}

// Cache WS test result — firewalls don't change mid-session; blocked result re-checks every 5 min
let _wsCacheResult: 'ok' | 'blocked' | 'unknown' = 'unknown';
let _wsCacheAt = 0;
async function testTwilioWsConnectivity(): Promise<'ok' | 'blocked' | 'unknown'> {
  const RECHECK_MS = _wsCacheResult === 'blocked' ? 5 * 60_000 : 30 * 60_000;
  if (_wsCacheResult !== 'unknown' && Date.now() - _wsCacheAt < RECHECK_MS) return _wsCacheResult;
  return new Promise((resolve) => {
    try {
      // Twilio voice WebSocket endpoint
      const ws = new WebSocket('wss://chunderw-vpc-gll.twilio.com');
      // Only a timeout means the server is unreachable (firewall). A 403 error response
      // also fires onerror but means the server IS reachable — treat that as 'ok'.
      const timer = setTimeout(() => { try { ws.close(); } catch { /* noop */ } _wsCacheResult = 'blocked'; _wsCacheAt = Date.now(); resolve('blocked'); }, 5000);
      ws.onopen = () => {
        clearTimeout(timer);
        try { ws.close(); } catch { /* noop */ }
        _wsCacheResult = 'ok'; _wsCacheAt = Date.now();
        resolve('ok');
      };
      ws.onerror = () => {
        // Server responded (even with an error) — not a firewall block
        clearTimeout(timer);
        try { ws.close(); } catch { /* noop */ }
        _wsCacheResult = 'ok'; _wsCacheAt = Date.now();
        resolve('ok');
      };
    } catch {
      _wsCacheResult = 'unknown'; _wsCacheAt = Date.now();
      resolve('unknown');
    }
  });
}

function getLastWebRTCError(): string | null {
  try { return (window as any).__aoiLastWebRTCError ?? null; } catch { return null; }
}

function getTokenExpiresIn(): number | null {
  try {
    const exp = (window as any).__twilioTokenExpiry as number | undefined;
    if (!exp) return null;
    return Math.round((exp * 1000 - Date.now()) / 1000);
  } catch { return null; }
}

async function fetchCredits(email: string): Promise<number> {
  try {
    const res = await fetch(`/api/user/credits?email=${encodeURIComponent(email)}`, {
      credentials: 'include',
    });
    if (!res.ok) return -1;
    const data = await res.json();
    return data.credits_remaining ?? data.credits ?? -1;
  } catch {
    return -1;
  }
}

// ── Command Executor ────────────────────────────────────────────────────────
function executeCommand(cmd: RemoteCommand) {
  console.log(`[AOI-Diagnostics] Executing remote command: ${cmd}`);
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const isVerificationPath =
    path.includes('/dashboard/verification-start') ||
    path.includes('/verification') ||
    path.includes('/precheck');

  switch (cmd) {
    case 'force_refresh':
      if (isVerificationPath) {
        console.warn('[AOI-Diagnostics] force_refresh blocked on verification/precheck route');
        break;
      }
      window.location.reload();
      break;
    case 're_register': {
      // Attempt to destroy + recreate Twilio Device via global ref
      const win = window as any;
      const device = win.__twilioDevice;
      if (device) {
        try { device.destroy(); } catch { /* noop */ }
        // Re-registration should be triggered by the component's normal power-on flow
        console.log('[AOI-Diagnostics] Twilio device destroyed. User must power on again.');
      }
      break;
    }
    case 'test_audio': {
      // Play a 440 Hz test tone for 1 second
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.frequency.value = 440;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 1000);
      } catch (e) {
        console.error('[AOI-Diagnostics] test_audio failed', e);
      }
      break;
    }
    case 'clear_state':
      if (isVerificationPath) {
        console.warn('[AOI-Diagnostics] clear_state blocked on verification/precheck route');
        break;
      }
      // Destructive remote clear-state can sign users out; keep disabled by default.
      console.warn('[AOI-Diagnostics] clear_state command ignored by client safety policy');
      break;
    case 'screen_share':
      navigator.mediaDevices.getDisplayMedia({ video: true }).catch((e) =>
        console.error('[AOI-Diagnostics] screen_share failed', e)
      );
      break;
    default:
      console.warn(`[AOI-Diagnostics] Unknown command: ${cmd}`);
  }
}

// ── Preflight ───────────────────────────────────────────────────────────────
export async function runPreflight(email: string): Promise<PreflightResult> {
  const [mic, network, credits] = await Promise.all([
    checkMicPermission(),
    measureLatency(),
    fetchCredits(email),
  ]);
  const browser = parseBrowser();
  const criticalFail = mic === 'blocked' || credits === 0 || network.quality === 'offline';
  return { mic, browser, credits, network, ready: !criticalFail };
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useAgentDiagnostics(email?: string) {
  const [diagnostics, setDiagnostics] = useState<AgentDiagnostics | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightDone, setPreflightDone] = useState(false);
  const intervalDiag = useRef<ReturnType<typeof setInterval>>();
  const intervalCmd = useRef<ReturnType<typeof setInterval>>();

  // ── Gather full diagnostics ───────────────────────────────────────────
  const gatherDiagnostics = useCallback(async (): Promise<AgentDiagnostics | null> => {
    if (!email) return null;
    const [mic, network, audio, credits, wsConnectivity] = await Promise.all([
      checkMicPermission(),
      measureLatency(),
      getAudioDevices(),
      fetchCredits(email),
      testTwilioWsConnectivity(),
    ]);
    const diag: AgentDiagnostics = {
      email,
      mic,
      network,
      browser: parseBrowser(),
      audio,
      webrtc: checkWebRTCStatus(),
      wsConnectivity,
      webrtcError: getLastWebRTCError(),
      tokenExpiresIn: getTokenExpiresIn(),
      credits,
      errors: collectRecentErrors(),
      uptime: Math.round((Date.now() - PAGE_LOAD_TIME) / 1000),
      statesCount: 0,
      market: '',
      timestamp: new Date().toISOString(),
    };
    return diag;
  }, [email]);

  // ── Send diagnostics to AOI Command ───────────────────────────────────
  const sendDiagnostics = useCallback(async () => {
    const diag = await gatherDiagnostics();
    if (!diag) return;
    setDiagnostics(diag);
    try {
      const r = await fetch(`${DIAGNOSTICS_PROXY_BASE}/agent-health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(diag),
      });
      if (!r.ok && Date.now() - lastHealthProxyWarnAt > 120_000) {
        lastHealthProxyWarnAt = Date.now();
        console.warn('[AOI-Diagnostics] Health proxy non-OK:', r.status, await r.text().catch(() => ''));
      }
    } catch (e) {
      if (Date.now() - lastHealthProxyWarnAt > 120_000) {
        lastHealthProxyWarnAt = Date.now();
        console.warn('[AOI-Diagnostics] Failed to post health via proxy', e);
      }
    }
  }, [gatherDiagnostics]);

  // ── Poll for remote commands ──────────────────────────────────────────
  const pollCommands = useCallback(async () => {
    if (!email) return;
    try {
      const res = await fetch(
        `${DIAGNOSTICS_PROXY_BASE}/agent-command/${encodeURIComponent(email)}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = await res.json();
      // Expect { command: 'force_refresh' | ... } or { commands: [...] }
      const cmds: RemoteCommand[] = data.commands ?? (data.command ? [data.command] : []);
      for (const cmd of cmds) {
        executeCommand(cmd);
      }
    } catch {
      // silent
    }
  }, [email]);

  // ── Run preflight on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!email || preflightDone) return;
    runPreflight(email).then((result) => {
      setPreflight(result);
      setPreflightDone(true);
    });
  }, [email, preflightDone]);

  // ── Start intervals ───────────────────────────────────────────────────
  useEffect(() => {
    if (!email) return;

    // Run once immediately
    sendDiagnostics();
    pollCommands();

    intervalDiag.current = setInterval(sendDiagnostics, DIAGNOSTICS_INTERVAL_MS);
    intervalCmd.current = setInterval(pollCommands, COMMAND_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalDiag.current);
      clearInterval(intervalCmd.current);
    };
  }, [email, sendDiagnostics, pollCommands]);

  return { diagnostics, preflight, preflightDone };
}
